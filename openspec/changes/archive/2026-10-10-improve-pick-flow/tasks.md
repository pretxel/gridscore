## 1. Shared progress logic

- [x] 1.1 Add `pickProgress(markets, pickedIds, now)` to `lib/market-utils.ts` returning `{ called, callable, urgent }` (void excluded; urgent = open, uncalled, locks within 24h) and export the 24h constant
- [x] 1.2 Add `isMarketUrgent(market, called, now)` for a single card, reusing the same constant
- [x] 1.3 Unit tests: partial weekend, void excluded, called-but-closing not urgent, locked not urgent, exactly-24h boundary

## 2. Autosave on the market card

- [x] 2.1 Refactor `market-form.tsx` state into draft + confirmed pick + status (`idle | saving | saved | error`), keeping `submitPick` as the only write
- [x] 2.2 Save automatically when `toPick` yields a complete pick that differs from the confirmed one; skip identical selections
- [x] 2.3 Latest-wins sequencing: tag each request, ignore stale responses, send the newest selection after an in-flight save settles
- [x] 2.4 Inline save state on the card (saving / saved / error with retry) replacing the Save button and success toast; keep the selection shown on error
- [x] 2.5 On `errorLocked`, switch the card to the locked summary showing the last confirmed pick
- [x] 2.6 Show the "podium needs a third driver" hint while the podium is incomplete
- [x] 2.7 Add the new strings to `messages/en.json` and `messages/es.json`; remove unused Save/Update strings; i18n parity test passes
- [x] 2.8 Tests for the save state machine (extract it as a pure reducer in `lib/` so it can be unit-tested): complete pick saves, incomplete podium does not, stale response ignored, lock refusal reverts to confirmed

## 3. Pending registry and navigation guard

- [x] 3.1 Create `PendingPicksProvider` (client context) that cards report `{ pending, called, callable }` to
- [x] 3.2 Register `beforeunload` only while any card is pending
- [x] 3.3 Add a capture-phase document click listener that confirms before following same-origin links while pending; ignore modified clicks, `target=_blank`, and in-page hash links
- [x] 3.4 Wrap the markets grid on the GP page with the provider
- [x] 3.5 Manually verify: failed save → nav link asks; all saved → no prompt; cleared podium P2 → tab close asks

## 4. Progress UI

- [x] 4.1 GP header: "N/M calls made" with a meter, server-rendered from `getMyPickStates`, live-updated from the provider; hidden when signed out
- [x] 4.2 Urgent styling on market cards that are open, uncalled and lock within 24h; clears on save
- [x] 4.3 Calendar: compute `pickProgress` per weekend in `gp/page.tsx` and pass it to `GrandPrixCard`
- [x] 4.4 `GrandPrixCard`: compact N/M meter and urgent state for signed-in players; hidden for completed/cancelled; signed-out keeps the "N calls open" text
- [x] 4.5 Check both themes and 375px width; meter has an accessible label ("4 of 6 calls made")

## 5. Database

- [x] 5.1 Migration: `reminder_preferences (user_id, lead_time 24h|2h|off default 24h, locale en|es)` with own-row RLS — a table rather than `profiles` columns, since every signed-in user can read every profile
- [x] 5.2 Migration: `reminder_sends (user_id, market_id, sent_at)` with PK `(user_id, market_id)`, FKs with cascade, RLS on, no client policies
- [x] 5.3 Migration: extend `operation_runs.kind` / `operation_settings.kind` checks with `send_reminders`; seed its settings row (enabled = false until rollout)
- [x] 5.4 SQL function `reminder_candidates(now timestamptz)` returning per-player uncalled, un-reminded open markets within each player's lead (excluding admins and `off`), with email, locale, timezone and GP slug/name
- [x] 5.5 Migration: enable `pg_cron` + `pg_net`; schedule an hourly call to `/api/cron/send-reminders` with the bearer from Vault, created only when the Vault secrets exist
- [x] 5.6 SQL tests (`pnpm test:db`): defaults, own-row update of `reminder_lead`, other users refused, `reminder_candidates` excludes called / reminded / admin / off / outside window
- [x] 5.7 Regenerate `lib/database.types.ts`; add `send_reminders` to `OperationKind` and `lib/operations/schedule.ts` (hourly, external trigger)

## 6. Email

- [x] 6.1 Add the `resend` dependency
- [x] 6.2 `lib/email/mailer.ts` (`Mailer` interface) and `lib/email/resend.ts` (Resend adapter; reports unavailable without `RESEND_API_KEY`)
- [x] 6.3 `renderReminderEmail({ locale, timezone, player, grandsPrix })` producing subject, HTML and text from `next-intl` messages; lock times in the player's timezone; links to each GP page; no championship branding
- [x] 6.4 Signed opt-out token helpers (`sign`, `verify` with constant-time compare) using `REMINDER_SIGNING_SECRET`
- [x] 6.5 `List-Unsubscribe` and `List-Unsubscribe-Post` headers on every reminder
- [x] 6.6 Unit tests: rendering in en/es, UTC fallback, token round-trip, tampered token rejected
- [x] 6.7 Brand-guard test covers the email templates

## 7. Reminder job

- [x] 7.1 `lib/reminders/run.ts`: load candidates, group per player, send one email each through the injected `Mailer`, insert `reminder_sends` only after acceptance, return `{ sent, skipped, failed }`
- [x] 7.2 `app/api/cron/send-reminders/route.ts`: `authorizeCron`, operation-enabled check, `missing-env` skip, `recordRun("send_reminders", …)`
- [x] 7.3 Add the job to the admin operations page with "Run now"
- [x] 7.4 Tests with a fake mailer: one email per player listing all markets, nothing on empty, provider failure records nothing, second run does not repeat a market, unauthorized request refused
- [x] 7.5 Add the new env vars to `.env.example` and the startup env check where appropriate

## 8. Settings and opt-out

- [x] 8.1 `app/[locale]/(app)/settings/page.tsx`: reminder lead radio group (24 h / about 2 h / off); server action upserts the caller's own `reminder_preferences` row with the current locale (the display name stays in the user menu, which already edits it)
- [x] 8.2 Set `profiles.locale` on onboarding completion too
- [x] 8.3 Add "Settings" to the user menu
- [x] 8.4 `app/[locale]/reminders/off`: the page verifies the token and asks for one confirming click (link scanners open every URL); `/api/reminders/off` POST is the RFC 8058 one-click target; an invalid token shows an error page and changes nothing
- [x] 8.5 Strings in en/es; tests for the settings action and the opt-out route

## 9. Docs and rollout

- [x] 9.1 `docs/operator-guide.md`: the reminder job, Resend domain verification (SPF/DKIM/DMARC), env vars, Vault secrets for `pg_cron`, how to disable
- [x] 9.2 `docs/data-model.md`: new columns, `reminder_sends`, `reminder_candidates`
- [x] 9.3 `docs/test-plan.md`: smoke steps for autosave, progress, settings, and a reminder to a test account
- [x] 9.4 Full check: `pnpm typecheck`, `pnpm test`, `pnpm test:db`, Biome, `pnpm build`
