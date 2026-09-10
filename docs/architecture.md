# Architecture

Process boundaries, data flow, the lock and scoring paths, and the race data
sync. Column-level detail lives in [`data-model.md`](./data-model.md); the
design rationale in
[`superpowers/specs/2026-09-10-gridscore-design.md`](./superpowers/specs/2026-09-10-gridscore-design.md).

## Stack

- **Next.js 16** App Router (TypeScript, React 19). Reads are Server
  Components; writes are server actions or route handlers.
- **Tailwind 4** + **shadcn/ui** primitives (`components/ui/**`).
- **Supabase**: Postgres 17 + Auth (magic link) + RLS, through `@supabase/ssr`.
- **next-intl** for `en` / `es`.
- **Vercel** for hosting and crons (`vercel.json`).

## Process boundaries

```
                          +----------------------------+
                          |  Supabase                  |
                          |   Postgres (RLS on)        |
                          |   Auth (magic link)        |
                          +-------------^--------------+
              anon / user JWT           |   service_role
+-----------+           +---------------+----------------+        +-----------+
|  Browser  | <-------> |  Next.js (Vercel)              | -----> |  Jolpica  |
|           |           |   proxy.ts (locale + session)  |  cron  |  (race    |
|           |           |   RSC pages, server actions    |        |   data)   |
|           |           |   /api/cron/* (service role)   |        +-----------+
+-----------+           +--------------------------------+
```

Three Supabase clients, never interchangeable:

| client | key | where |
|---|---|---|
| `lib/supabase/server.ts` | anon + session cookie | RSC pages, user-facing actions (RLS applies) |
| `lib/supabase/browser.ts` | anon | client components (sign-in, realtime) |
| `lib/supabase/admin.ts` | service role | admin actions after `assertAdmin()`, cron routes, sync stores |

Both server clients accept a season slug and send it as the `x-season`
header, which `active_season_id()` reads in SQL.

`proxy.ts` resolves the locale (next-intl) and refreshes the Supabase
session cookie. It does not authorize: layouts and RLS do.

## Routing

| group | guard | purpose |
|---|---|---|
| `app/[locale]/(public)` | none | landing, calendar, Grand Prix detail, leaderboard |
| `app/[locale]/(auth)` | none | sign-in, sign-out |
| `app/[locale]/(app)` | signed in + display name | my picks, leagues, stats |
| `app/[locale]/leagues/join/[code]` | handles its own gate | invite landing; redirects to sign-in / onboarding with `?next=` back to itself |
| `app/[locale]/(admin)` | `profiles.is_admin` | control room |
| `app/[locale]/onboarding` | signed in | display name |
| `app/auth/callback` | none | magic-link code exchange |
| `app/api/cron/*` | `CRON_SECRET` bearer | scheduled jobs |

## Lock path

Each market carries its own `locks_at` (pole → qualifying, sprint winner →
sprint, everything else → race). A pick write must pass two independent
checks:

1. **RLS** on `predictions`: own row, not an admin, market `open` and
   `locks_at > now()`. A late write from a user JWT fails with `42501`.
2. **Trigger** `guard_prediction_lock` (BEFORE INSERT OR UPDATE): raises
   `prediction locked` on the same condition. It also runs for the service
   role, so no job or admin tool can write a late pick either.

The UI countdown is cosmetic; the database clock decides.

## Scoring path

```
result arrives (provider sync or admin form)
   |
   v
markets UPDATE result -> trg_markets_before_write validates + sets resolved
   |
   v
trg_markets_recompute_scores -> compute_market_scores(market)
   |   DELETE scores for the market, INSERT one row per prediction
   |   points = round(base(scoring_rules) * grands_prix.multiplier)
   v
scores changes -> Realtime -> leaderboard clients refetch the view
```

Recompute is idempotent. A rule or multiplier edit does not rescore by itself;
the admin panel calls `compute_grand_prix_scores(gp)`. `lib/scoring.ts` is
the TypeScript replica used by unit tests and the UI explainer.

## Race data sync

```
lib/race-sync/
  types.ts        RaceDataProvider + Remote* shapes (provider-agnostic)
  providers/
    jolpica.ts    Ergast-compatible client: spacing, 429 retry, mappers
    index.ts      defaultProvider()
  multipliers.ts  default Grand Prix multiplier (finale > legend > sprint)
  store.ts        CalendarStore / ResultsStore interfaces + Supabase impl
  calendar.ts     runCalendarSync: teams, drivers, Grands Prix (upsert)
  results.ts      runResultsSync: lock due markets, resolve / suggest
lib/operations/   recordRun ledger, kill switch, schedule
app/api/cron/
  sync-calendar   daily 06:00 UTC
  sync-results    daily (hourly on Vercel Pro); self-skips when nothing provider-resolvable locked
                  in the last 7 days; ?force=1 backfills
```

Swapping providers means implementing `RaceDataProvider` and returning it
from `defaultProvider()`; the jobs and stores do not change.

**Calendar sync** upserts by provider key / round. It never overwrites an
admin-locked multiplier (`multiplier_locked`) or a terminal Grand Prix
status, keeps existing slugs, and skips rows that would not change so
`updated_at` stays meaningful. Markets are created by the database trigger
when a Grand Prix row lands.

**Results sync** first calls `lock_due_markets()`, then for every locked
market fetches only the sessions it needs (one request per session per
weekend):

| market | source | outcome |
|---|---|---|
| pole | qualifying P1 | resolved |
| podium | race P1–P3 | resolved |
| fastest_lap | race fastest-lap rank 1 | resolved |
| sprint_winner | sprint P1 | resolved |
| first_retirement | fewest laps among retired (`R`) cars | `suggested_result`; a tie yields no suggestion |
| safety_car | not in the provider | admin only |

A resolved market is immutable to the job; corrections go through the
admin panel. Every run is wrapped in `recordRun()` and lands in
`operation_runs`; `operation_settings` pauses a job's cron without touching
the admin "Run now" path.

## Caching

Public pages are dynamic (they read the session cookie). Admin writes call
`revalidatePath` on the surfaces they affect; the leaderboard also
subscribes to Realtime on `scores` and refetches the view on change.

## Where things live

```
app/                      routes (see Routing)
components/ui             shadcn primitives
components/admin          admin shell + form primitives
lib/supabase              clients
lib/db.ts                 narrowed row aliases
lib/markets.ts            market vocabulary, pick schemas, lock sessions
lib/race-sync             provider interface, Jolpica, calendar/results jobs
lib/operations            cron ledger + kill switch
lib/cron/authorize.ts     bearer-secret gate for cron routes
messages/                 en.json, es.json
supabase/migrations       schema
supabase/tests            SQL invariants (pnpm test:db)
tests/                    Vitest suites, recorded provider fixtures
```
