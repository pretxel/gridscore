## Why

The game only works if people make their calls before each market locks, and today three things quietly cost them picks. Each of the six market cards has its own Save button, so a driver tapped but not saved is lost without warning. Nothing tells a player how much of the weekend they have covered, or which empty market is about to close. And nothing reaches a player who simply forgot: there is no reminder of any kind, so a missed qualifying lock is only discovered after the fact.

## What Changes

- **Picks save themselves.** Choosing a driver (or Yes/No) saves that market immediately; the podium saves once all three places are filled. Each card shows its save state (saving, saved, failed with retry). The per-card Save button goes away.
- **No silent loss.** While a save is in flight, has failed, or a saved podium has been left incomplete, leaving the page asks for confirmation.
- **Weekend progress.** The Grand Prix header shows "4/6 calls made" with a progress meter. Unpicked markets that lock within 24 hours are highlighted as urgent.
- **Calendar progress.** Each calendar card shows the same count as a compact meter, and turns urgent when an unpicked market locks within 24 hours. It replaces the current "N calls to make" text.
- **Lock reminders by email.** An hourly job emails each player the markets they have not called that lock within their chosen lead time, sent through Resend. One email per player per run, listing every such market, and never twice for the same market.
- **Reminder preference.** A new settings page lets a player choose 24 hours before, 2 hours before, or off. Every reminder email carries a one-click link to turn them off.

## Capabilities

### New Capabilities
- `pick-autosave`: saving a call on selection, per-card save state, retry on failure, and the guard against leaving with unsaved or incomplete calls.
- `pick-progress`: the calls-made count and urgency highlighting on the weekend page and calendar cards.
- `lock-reminders`: the per-player reminder preference, the hourly reminder job, the reminder email and its one-click opt-out.

### Modified Capabilities
<!-- None: openspec/specs/ has no specs yet. -->

## Impact

- **UI**: `app/[locale]/(public)/gp/[slug]/market-form.tsx`, the GP page header, `components/grand-prix-card.tsx`, `app/[locale]/(public)/gp/page.tsx`; a new `app/[locale]/(app)/settings` page and a user-menu entry.
- **Server**: `submitPick` in `gp/[slug]/actions.ts` stays the single write path; a new `app/api/cron/send-reminders` route, authorized like the existing crons.
- **Database**: new migration: a `reminder_preferences` table (`24h` | `2h` | `off`, plus locale), a `reminder_sends` table for once-per-market delivery, `send_reminders` added to the operations tables, and a `pg_cron` + `pg_net` schedule that calls the route hourly.
- **Dependencies & config**: the `resend` package; `RESEND_API_KEY`, `REMINDER_FROM_EMAIL`, and a signing secret for opt-out links. A verified sending domain in Resend.
- **i18n**: new strings in `messages/en.json` and `messages/es.json`, including the email body in both locales.
- **Docs**: `docs/operator-guide.md` (the new job, Resend setup), `docs/data-model.md`.
