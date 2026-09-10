# gridscore

**gridscore** is a Grand Prix predictions pool. Every signed-in user calls the
markets of each race weekend (pole, podium, fastest lap, first retirement,
safety car, sprint winner), each call locks when its session starts, and a
season leaderboard plus private leagues rank everyone as results come in.

- **Stack:** Next.js 16 (App Router), TypeScript, Tailwind 4, shadcn/ui, Supabase (Postgres + Auth + RLS), next-intl (en/es).
- **Spec:** `docs/superpowers/specs/2026-09-10-gridscore-design.md`; phased plan in `docs/superpowers/plans/2026-09-10-gridscore-phases.md`.

---

## Documentation

- `docs/architecture.md` — system overview, RSC + server-action data flow, scoring trigger + recompute path, per-market lock at the RLS layer, data sync.
- `docs/data-model.md` — every table, constraint, index, RLS policy and function.
- `docs/operator-guide.md` — standing up an environment, the weekly rhythm of a season, plans, monitoring queries, and what to do when something breaks.
- `docs/test-plan.md` — the manual smoke walk to run against a deployment before a release.
- `docs/contributing.md` — local dev setup, code conventions, commit style, regenerating Supabase types.

---

## Local development

```bash
pnpm install
cp .env.example .env.local      # then fill in the Supabase keys from `supabase start`
supabase start
pnpm dev
```

Open <http://localhost:3000>. The dev server fails fast at module load if any of
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY`
is missing. Local magic-link emails land in Mailpit at <http://127.0.0.1:54334>.

### Scripts

| command          | purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `pnpm dev`       | Next dev server with Turbopack.                                |
| `pnpm build`     | Production build.                                              |
| `pnpm typecheck` | `tsc --noEmit`.                                                |
| `pnpm lint`      | Biome (lint + format check).                                   |
| `pnpm format`    | Biome write.                                                   |
| `pnpm test`      | Vitest unit tests (scoring, sync, i18n parity, brand guard).   |
| `pnpm test:db`   | SQL invariant tests against the local Supabase stack.          |
| `pnpm db:types`  | Regenerate `lib/database.types.ts` from the local database.    |

Git hooks (Husky): `pnpm test` before every commit, `biome check` + `pnpm build` before every push.

---

## First-time setup (operator runbook)

1. **Create a Supabase project** at <https://supabase.com/dashboard>. Copy the project URL,
   the `anon` key, and the `service_role` key into `.env.local` and (later) into Vercel.
2. **Link the Supabase CLI** to that project:
   ```bash
   supabase login
   supabase link --project-ref <YOUR-PROJECT-REF>
   ```
3. **Apply the schema:** `supabase db push` (migrations live in `supabase/migrations/`).
4. **Regenerate the TypeScript types:** `supabase gen types typescript --linked > lib/database.types.ts`.
5. **Sign in once** on the deployed app with your owner email. That creates a row in
   `auth.users` and an empty `public.profiles` row via trigger.
6. **Promote yourself to admin.** Edit `supabase/seed/admin.sql`, replace the placeholder
   email, and run it in the Supabase SQL editor (service role).
7. The "Admin" link now appears in the nav.

The season calendar, drivers and teams arrive through the calendar sync cron
(`/api/cron/sync-calendar`, daily) once `CRON_SECRET` is set; trigger it by hand with
`curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/cron/sync-calendar?force=1`.

---

## Day-to-day operations

- **Calendar sync** and **results sync** run daily (`vercel.json`; the Vercel Hobby plan
  allows one run per day per cron, so results sync at 03:00 UTC picks up the previous
  weekend — on a Pro plan set it to `0 * * * *` for hourly scoring). Both are bearer-gated
  by `CRON_SECRET`, write a row to `operation_runs`, and can be paused per job through
  `operation_settings`. Trigger either by hand with
  `curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/cron/sync-results?force=1`.
- **The admin panel** (`/admin`, `is_admin` only) covers the rest: session times and the
  sprint flag per weekend, results entered by hand or confirmed from the sync's suggestion,
  void and reopen, multipliers (a hand-set one is locked against the next sync), scoring
  rules, the driver and team roster, league plans, and Run now plus the per-job kill switch.
- **Rescoring is always explicit.** Editing a multiplier or a scoring rule changes future
  results only; press "Rescore" on a Grand Prix to apply it to points already awarded.

---

## Deploy

1. **Push to GitHub** and **import the repo into Vercel.** Project root = repo root.
2. **Set environment variables** in the Vercel project (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, keep it secret)
   - `NEXT_PUBLIC_SITE_URL` (your production domain)
   - `CRON_SECRET` (random string; Vercel sends it on every cron invocation)
   - `JOLPICA_BASE_URL` (optional override of the race data endpoint)
3. **Update Supabase Auth → URL Configuration:** site URL = production URL; additional
   redirect URLs = `https://YOUR-DOMAIN/auth/callback` and your preview-scoped
   `https://<project>-*-<team>.vercel.app/auth/callback`.
4. **Deploy**, then sign in once with the email that will own the site and promote it with
   `supabase/seed/admin.sql`.
5. **Import the season** from Admin → Operations → Calendar sync → Run now.
6. **Walk [`docs/test-plan.md`](docs/test-plan.md)** against the deployed URL. It covers
   sign-in, the lock, result entry, the live leaderboard, leagues, plans and the crons.

The full runbook, including the weekly rhythm of a race season, is in
[`docs/operator-guide.md`](docs/operator-guide.md).

---

## How scoring works

Points per market live in the `scoring_rules` table (editable from the admin panel) and
every Grand Prix carries a multiplier. Defaults seeded for the season:

| Market            | Rule                          | Points |
| ----------------- | ----------------------------- | ------ |
| Podium            | driver in the exact position  | 10     |
| Podium            | driver on the podium, wrong spot | 4   |
| Podium            | all three exact (bonus)       | +25    |
| Pole position     | exact                         | 8      |
| Fastest lap       | exact                         | 6      |
| First retirement  | exact (or "none")             | 6      |
| Safety car        | yes / no                      | 3      |
| Sprint winner     | exact                         | 6      |

**Multipliers:** normal ×1, sprint weekend ×1.25, legend circuits (Monaco, Monza, Suzuka,
Interlagos, Silverstone) ×1.5, season finale ×2. Final points = `round(base × multiplier)`.

**Tie-breakers** (in order): more all-exact podiums, more exact hits, then earlier
`submitted_at` of the user's first counted pick.

**Lock rule:** each market has its own `locks_at` (pole at qualifying, sprint winner at the
sprint, everything else at lights out). Writes after that instant are refused by an RLS
policy **and** a database trigger, so a bypassed UI or a service-role job still cannot
write late.

---

## Monetization hooks (no payments)

Nothing here charges anyone. The plan columns and the gates exist so a payment
provider can be added later without touching product code.

- **Where a plan lives.** `profiles.plan` and `leagues.plan`, both `free | pro`
  and both writable only by the service role (a guard trigger rejects a user
  JWT). Today an operator flips them: league plans from the admin panel, a
  profile plan with one SQL update.
- **What Pro unlocks** is listed once, in `PLAN_FEATURES` in `lib/plans.ts`:
  `premiumStats`, `sponsorFree` and an unlimited league member cap (free stops
  at 10). Every other file asks `hasFeature()`, `isPro()` or
  `leagueMemberCap()`; a test fails the build if any file compares a plan
  against `"pro"` directly.
- **Premium stats.** `/stats` shows accuracy per market, streaks, best weekend
  and the gap to the field average. Free readers get the same page with the
  numbers blurred and an upgrade note. The SQL functions behind it are scoped
  to the active season and refuse to return another user's rows.
- **Sponsor slots.** `<SponsorSlot placement="header" | "gp-detail" |
  "leaderboard" />` renders a bordered placeholder for free readers and
  nothing at all for Pro. Inventory is a static map in `lib/sponsor.ts`; only
  absolute `https` links are rendered.

**Adding a payment provider** means one new thing: a webhook route that
verifies the event and writes `plan = 'pro'` on the profile or league it names,
using the service-role client. No gate has to move, because every gate already
reads the column.

---

## Trademark note

The product never uses the championship's name, the governing body's name or official
logos. Only generic terms (Grand Prix, race, season, circuit codes) appear in the product;
driver, team and circuit names are provider data. `tests/no-brand-literals.test.ts` enforces
this on every commit.

---

## Where things live

```
app/
  [locale]/page.tsx              landing
  [locale]/(auth)/sign-in/       magic-link sign-in
  [locale]/(auth)/sign-out/      POST sign-out
  [locale]/(public)/gp/          calendar and Grand Prix pages (pick forms)
  [locale]/(public)/leaderboard/ season and per-weekend standings, live
  [locale]/how-it-works/         scoring rules and multipliers, read from the DB
  [locale]/(app)/                authed routes (my picks, leagues, stats)
  [locale]/(app)/leagues/        league list, create/join forms, league page
  [locale]/leagues/join/[code]/  invite landing (outside the gate so ?next= survives sign-in)
  [locale]/(admin)/admin/        admin control room (grands-prix, drivers, scoring, leagues, operations)
  [locale]/onboarding/           forces a display name on first sign-in
  auth/callback/                 magic-link code exchange
  api/cron/                      calendar and results sync jobs
components/
  ui/                            shadcn primitives
  admin/                         admin shell + form primitives
  site-nav.tsx                   global nav + footer
lib/
  supabase/{server,browser,admin}.ts   Supabase clients
  database.types.ts              generated; regenerate with `pnpm db:types`
  db.ts                          narrowed row aliases
  markets.ts, market-utils.ts    market vocabulary, pick schemas, lock helpers
  leagues.ts, league-form.ts     league queries; name/code rules and error mapping
  plans.ts                       free/pro features, league member cap (mirrors SQL)
  admin/                         admin queries, form parsing, action wrapper
  scoring.ts                     TypeScript replica of the SQL scoring function
  race-sync/                     provider interface, Jolpica client, sync jobs
  i18n.ts, env.ts                locale list, env loader
messages/
  en.json, es.json               UI copy (key parity enforced by tests)
supabase/
  migrations/                    schema, RLS, triggers, scoring, leaderboards
  seed/                          season defaults, dev fixture, admin promotion
  tests/                         SQL invariant suites (`pnpm test:db`)
tests/
  *.test.ts                      Vitest suites
  scoring-cases.ts               shared scoring cases (TS + generated SQL parity)
```

## License

MIT. See `LICENSE`.
