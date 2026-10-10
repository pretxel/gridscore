## Context

The weekend page (`app/[locale]/(public)/gp/[slug]/page.tsx`) renders one `MarketForm` client component per market. Each form keeps its own draft, compares it to the last saved pick, and saves through the `submitPick` server action when its Save button is pressed. The action validates, checks the lock, upserts into `predictions` and revalidates the weekend, calendar and my-picks pages. The lock is enforced twice in the database (RLS + trigger), so the client never decides it.

The calendar (`gp/page.tsx`) already computes `marketsNeedingPick` per weekend and shows it as text ("3 calls to make") on `GrandPrixCard`.

Scheduled work runs as Vercel cron routes under `app/api/cron/*`, authorized by `lib/cron/authorize.ts` (`CRON_SECRET` bearer), switchable in `operation_settings`, and recorded in `operation_runs` via `recordRun`. The project is on the Vercel Hobby plan, which allows each cron **once a day** (see `lib/operations/schedule.ts`); both existing jobs are daily for that reason.

There is no transactional email today. Supabase's SMTP carries only auth mail (magic links), capped at 30/hour so logins are never starved; it cannot carry reminders. The provider is **Resend**.

`profiles` has `timezone` but no locale; `auth.users` holds the email.

## Goals / Non-Goals

**Goals:**
- A call is never lost because a button was not pressed.
- A player can see at a glance what is left for the weekend and what closes soon.
- A player who forgot is reminded before the lock, once per market, and can stop it in one click.

**Non-Goals:**
- Web push or native notifications (the manifest exists; a service worker is a later change).
- Reminders in any channel but email; per-market or per-league reminder settings.
- Batch "save all" across cards — autosave makes it unnecessary.
- Changing the lock, scoring, or the `predictions` schema.

## Decisions

### 1. Autosave per card, not a "save all" bar
Each card saves when its selection forms a complete pick (`toPick` already returns `null` until it does). The Save button is removed.

*Alternative:* a sticky "Save all (3)" bar. Rejected: it keeps the failure mode — the player still has to remember a final action — and adds a second write path. Autosave keeps `submitPick` as the only write, one market per request, which is also what the lock needs (a partial batch where one market locked mid-request would need its own error model).

The form becomes a small state machine: `idle | saving | saved | error`, with the last *confirmed* pick kept separately from the draft. Each save carries an incrementing sequence number; a response is applied only if it belongs to the latest request, so a slow early response cannot overwrite a later selection. When a save is in flight and the player changes the selection again, the new selection is sent after the current request settles (latest-wins; intermediate selections are dropped).

A lock refusal (`errorLocked`) flips the card to its locked summary showing the last confirmed pick, not the draft.

### 2. Page-level unsaved-work registry and a global navigation guard
A client context (`PendingPicksProvider`) wraps the markets grid. Each card reports `pending` when it is saving, has failed, or holds a draft that differs from its confirmed pick and cannot be saved (an incomplete podium). The provider:
- registers `beforeunload` only while anything is pending (covers reload, tab close, external links);
- adds one capture-phase `click` listener on `document` for same-origin `<a>` elements, and asks `window.confirm` before letting the navigation through. This catches the site nav and footer links, which live outside the page and cannot take a per-link `onNavigate`.

*Alternative:* Next's `<Link onNavigate>` — only works on links the page owns. Browser back/forward via `popstate` is not guarded; with autosave the pending window is a second or two, and failed saves stay visible on return.

### 3. Progress derived client-side from the cards
The header count and meter read from the same provider: each card reports `called` (has a confirmed pick) and `callable` (not void). The server renders the initial "N/M" from `getMyPickStates`, so there is no flash; the client updates it as saves confirm. Urgency is `open && !called && locks_at - now <= 24h`, re-evaluated by the existing countdown tick.

The calendar computes the same numbers server-side from data it already loads (`markets`, `pickedIds`) and passes `{ called, callable, urgent }` to `GrandPrixCard`, which draws a compact meter instead of the text. A shared pure helper in `lib/market-utils.ts` (`pickProgress(markets, pickedIds, now)`) is used by both pages and unit-tested. The 24h threshold is a constant there, not a setting.

### 4. Reminder schedule: Supabase `pg_cron` calls the route hourly
The Hobby plan cannot run a Vercel cron hourly, and a 2-hour lead time needs at least hourly runs. The route `app/api/cron/send-reminders` is triggered by `pg_cron` in Supabase, using `pg_net` to issue `GET https://<domain>/api/cron/send-reminders` with the `CRON_SECRET` bearer. The secret and the URL are read from Supabase Vault, never committed.

*Alternatives:* Vercel Pro (hourly cron in `vercel.json`) — costs money, and the route stays identical, so switching later is a config change; GitHub Actions `schedule` — delays of up to an hour under load, too coarse for a 2-hour window. The route itself does not care who calls it, so either can replace `pg_cron` without code changes.

Because runs are hourly, "locks within the lead time" means `now < locks_at <= now + lead`. A market enters the window once and stays in it until it locks, so a run that fails is covered by the next one.

### 5. Once-per-market delivery via `reminder_sends`
New table `reminder_sends (user_id, market_id, sent_at)`, primary key `(user_id, market_id)`, service-role writes only. The job:
1. Loads open markets of the active season with `locks_at` in `(now, now + 24h]`.
2. Loads eligible players: non-admin, `lead_time <> 'off'` (no preference row = 24h).
3. Per player: markets within their lead, minus ones they have predicted, minus ones already in `reminder_sends`.
4. Sends one email per player with any left; **on provider acceptance**, inserts those `(user_id, market_id)` rows.

A crash between send and insert can repeat one email on the next run; that is preferred to losing the reminder. The selection is a single SQL function (`reminder_candidates(now)`) returning `(user_id, email, locale, timezone, market_id, …)` so the join happens in Postgres, not in a per-user loop.

Sends are sequential with a small concurrency cap to stay under Resend's rate limit; the run summary records `sent`, `skipped`, `failed`.

### 6. Resend behind a `Mailer` interface
`lib/email/mailer.ts` defines `Mailer.send({ to, subject, html, text, headers })`; `lib/email/resend.ts` implements it with the `resend` SDK. The job takes a `Mailer`, so tests use a fake, matching how the race-data provider sits behind an interface. A missing `RESEND_API_KEY` makes the job skip with `missing-env`, like the other crons.

The email is plain HTML + text built by a function (`renderReminderEmail`) using the `next-intl` messages for the player's locale; no React Email dependency. It carries `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers pointing at the opt-out endpoint, which mail clients show as a native unsubscribe button.

### 7. Opt-out by signed token
The body link is `/{locale}/reminders/off?t=<token>`: a page that verifies the token and turns reminders off on **one confirming click**, because mail security scanners fetch every link in an inbox and a GET that acted would opt players out unseen. The `List-Unsubscribe` header points at `/api/reminders/off?l=<locale>&t=<token>`, whose POST (RFC 8058 one-click) acts directly and whose GET redirects to the page. The token is token = `base64url(user_id) + "." + HMAC-SHA256(user_id, REMINDER_SIGNING_SECRET)`. No expiry: an old email must still work. Verification uses a constant-time compare. The opt-out sets `lead_time = 'off'` through the service-role client and confirms, with a link to settings.

*Alternative:* a random token stored per user — needs a table and a lookup, gains only revocability, which nothing needs.

### 8. Data model additions (one migration)
- `reminder_preferences (user_id pk, lead_time '24h'|'2h'|'off' default '24h', locale 'en'|'es' null)`, with own-row RLS. A separate table, not `profiles` columns: `profiles` is readable by every signed-in user (leaderboards need names), and a player's reminder setting is nobody else's. No row means the 24h default. `locale` is set when the player saves settings or completes onboarding; null falls back to `en`.
- `reminder_sends` as above, RLS on, no client policies.
- `operation_runs.kind` and `operation_settings.kind` checks gain `send_reminders`; a seed row enables it.
- `pg_cron` + `pg_net` extensions and the hourly job, reading URL and secret from Vault.
- `pg_cron` fires hourly at minute 0 regardless; `call_send_reminders()` reads the URL and bearer from Vault and returns without a request until both exist, so local and CI databases stay quiet and production starts as soon as the secrets are added.

### 9. Settings page
`app/[locale]/(app)/settings/page.tsx`: a radio group (24 h / about 2 h / off), saved by a server action that upserts the caller's own preference row and records the current locale. Reached from the user menu, which keeps editing the display name as before.

## Risks / Trade-offs

- **Autosave fires on a mis-tap** → the call is changed immediately. Mitigation: calls can be changed freely until the lock, the card shows exactly what is saved, and the toast is replaced by an inline "Saved" so the change is visible where it happened.
- **More server-action calls** (one per selection, not per button press) → negligible at this scale; identical selections are not re-sent.
- **`window.confirm` in the navigation guard** is blunt UI → it only appears when something is actually pending, which autosave makes rare.
- **Reminder mail lands in spam** → verified sending domain with SPF/DKIM/DMARC in Resend, plain content, `List-Unsubscribe` headers. Operator guide covers the DNS setup.
- **`pg_cron` job silently stops** (Vault secret rotated, domain changed) → every run is recorded in `operation_runs`; the operations page shows the last run, and a gap is visible there.
- **Duplicate email after a crash between send and insert** → accepted; one extra reminder beats a missed lock.
- **Hourly granularity** → a 2-hour reminder arrives between 1 and 2 hours before the lock. Stated in the settings copy ("about 2 hours before").

## Migration Plan

1. Ship the migration (columns with defaults, new table, extended checks). Existing players default to 24 h reminders.
2. Ship autosave and progress (no dependency on email).
3. Configure Resend: verify the domain, set `RESEND_API_KEY`, `REMINDER_FROM_EMAIL`, `REMINDER_SIGNING_SECRET` in Vercel.
4. Deploy the reminder route with the job **disabled** in `operation_settings`; trigger it by hand from the operations page against a test account.
5. Add the Vault secrets so `pg_cron` starts calling hourly; enable the job.

Rollback: disable the job in the operations page (immediate, no deploy). Autosave can be reverted by redeploying the previous `market-form.tsx`; the schema additions are additive and can stay.

## Open Questions

- Default for existing players: 24 h on (proposed) or off until they opt in? On is more useful; off is more conservative about unsolicited email.
- Sending address and domain for Resend (e.g. `reminders@<domain>`).
