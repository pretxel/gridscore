# gridscore — design spec

Grand Prix predictions pool derived from Winscore (`../winscore-app`). This
document fixes the decisions the phased plan builds on. Where a decision
copies Winscore verbatim it says so; everything else is new or adapted.

## 1. Product

- One prediction "round" per Grand Prix. Each Grand Prix exposes several
  independent **markets**; a user predicts each market separately and each
  market locks at its own session start.
- Global leaderboard per season plus private **leagues** (invite code).
- Data (calendar, drivers, teams, results) comes from the Jolpica API behind a
  provider interface. Admin can enter or correct any result by hand.
- Brand rule: the product, domain, copy, assets and code never use "F1",
  "Formula 1", "Formula One", "FIA" or "FOM", nor official logos. Generic
  words only: "Grand Prix", "race", "season", circuit codes. Driver, team,
  circuit and race names are stored as data from the provider and rendered as
  data. A regression test greps `app/`, `components/`, `lib/`, `messages/`,
  `public/` for the forbidden literals.
- Locales: `en` (default) and `es`, both complete from the first screen.
- Product name: **gridscore**. League join codes are `GP-XXXXX`.

## 2. Stack (copied from Winscore)

Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, shadcn
(`base-nova`), next-intl, Supabase (Postgres 17, Auth magic link, RLS,
`@supabase/ssr`), Biome, Vitest, Turbo, Husky, pnpm, Vercel with crons in
`vercel.json`. No GitHub Actions: `turbo build` depends on lint, typecheck and
test; Husky runs tests pre-commit and Biome + build pre-push.

Files copied unchanged or with only naming changes: `proxy.ts`, `i18n.ts`,
`lib/i18n.ts`, `lib/supabase/{server,browser,admin}.ts`, `lib/env.ts`
(trimmed), `lib/db.ts` pattern, `lib/operations/*`, `components/ui/*`,
`components/admin/*`, `components/leaderboard-live.tsx`,
`components/local-time.tsx`, `components/language-switcher.tsx`,
`components/theme-*.tsx`, `app/auth/callback/route.ts`, `(auth)/sign-in`,
`onboarding`, root and locale layouts, tooling config files, Husky hooks,
`tests/setup-env.ts`, `tests/shims`, `tests/i18n.test.ts`.

## 3. Data model

One consolidated init migration (`supabase/migrations/<ts>_init.sql`). All
timestamps `timestamptz` UTC. `set_updated_at()` trigger on every table with
`updated_at`. Names below are final.

### profiles (copied)

`id` (FK auth.users), `display_name` (2–32), `is_admin`, `plan`
(`free|pro`, default `free`), `timezone`, `created_at`, `updated_at`.
Triggers: `handle_new_user` on `auth.users` insert; `guard_profiles_is_admin`
(only service role may flip `is_admin`); same guard extended to `plan`.

### seasons

| column | notes |
|---|---|
| `id` uuid | |
| `year` int unique | e.g. 2026 |
| `slug` text unique | `'2026'` |
| `name` text | "2026 season" |
| `status` text | `upcoming \| active \| finished \| manage` (Winscore lifecycle) |
| `providers` jsonb | `{ "jolpica": { "season": "2026" } }` |

`active_season_id()` = season named by request header `x-season` (slug), else
first `status = 'active'`. Every season-scoped view, policy and RPC resolves
through it (Winscore's `active_competition_id()` pattern). Routes do not carry
a season segment in v1; the header is set by the server client only when a
caller needs a non-active season (admin).

### teams

`id`, `season_id`, `provider_key` (constructorId), `name`, `short_name`,
`color` (hex, nullable), `created_at`, `updated_at`.
Unique `(season_id, provider_key)`.

### drivers

`id`, `season_id`, `provider_key` (driverId), `code` (3 letters), `number`
int null, `given_name`, `family_name`, `team_id` FK teams null, `active` bool
default true. Unique `(season_id, provider_key)`.

### grands_prix

| column | notes |
|---|---|
| `id`, `season_id`, `round` int | unique `(season_id, round)` |
| `slug` text | unique per season, e.g. `monaco` (from circuitId) |
| `name` text | provider raceName as data |
| `circuit_key`, `circuit_name`, `country`, `locality` | |
| `has_sprint` bool | |
| `multiplier` numeric(4,2) not null default 1 | check `>= 1` |
| `multiplier_reason` text | `normal \| sprint \| legend \| finale \| custom` |
| `multiplier_locked` bool default false | true once an admin edits; sync never overwrites a locked multiplier |
| `fp1_at`, `fp2_at`, `fp3_at`, `sprint_qualifying_at`, `sprint_at`, `qualifying_at`, `race_at` | session instants, nullable except `race_at` |
| `status` text | `scheduled \| in_progress \| completed \| cancelled` |
| `provider_metadata` jsonb | raw provider row for review |

Default multiplier rule, applied by the calendar sync unless locked:
`finale` (last round) 2.00 > `legend` (circuit_key in
`monaco, monza, suzuka, interlagos, silverstone`) 1.50 > `sprint` 1.25 >
`normal` 1.00. Admin panel edits `multiplier` and `multiplier_reason` and
sets `multiplier_locked`.

### markets

| column | notes |
|---|---|
| `id`, `grand_prix_id` | unique `(grand_prix_id, type)` |
| `type` text | `pole \| podium \| fastest_lap \| first_retirement \| safety_car \| sprint_winner` |
| `locks_at` timestamptz not null | derived, see below |
| `status` text | `open \| locked \| resolved \| void` |
| `result` jsonb null | same shape as the pick for that type |
| `suggested_result` jsonb null | provider heuristic awaiting admin confirmation |
| `resolution_source` text null | `provider \| manual` |
| `resolved_at`, `resolved_by` | |

`market_locks_at(gp, type)`: `pole → qualifying_at`, `sprint_winner →
sprint_at`, everything else `→ race_at`. `ensure_markets_for_grand_prix(gp_id)`
(SECURITY DEFINER) inserts the missing markets for a GP (`sprint_winner` only
when `has_sprint`) and refreshes `locks_at` of markets still `open`. Fired by
an AFTER INSERT OR UPDATE trigger on `grands_prix` when session columns or
`has_sprint` change. `status` moves `open → locked` by `lock_due_markets()`
(called from the results cron and opportunistically by the GP page) and to
`resolved` when `result` is set. RLS and the lock trigger read `locks_at`, not
`status`, so a stale status can never unlock anything.

Pick and result JSON shapes (validated by `validate_market_pick(type, jsonb)`,
an IMMUTABLE function raising on bad shape, used by both the predictions and
the markets triggers):

| type | shape |
|---|---|
| `pole`, `fastest_lap`, `sprint_winner` | `{"driver_id": "<uuid>"}` |
| `podium` | `{"p1": "<uuid>", "p2": "<uuid>", "p3": "<uuid>"}` all distinct |
| `first_retirement` | `{"driver_id": "<uuid>"}` or `{"driver_id": null}` meaning "none" |
| `safety_car` | `{"value": true}` / `{"value": false}` |

Driver uuids must exist in `drivers` for the GP's season and be `active`.

### predictions

`id`, `user_id`, `market_id`, `pick` jsonb, `submitted_at`. Unique
`(user_id, market_id)`.

Lock enforcement, two layers:

1. RLS (copied pattern): insert/update `WITH CHECK (user_id = auth.uid() AND
   EXISTS (SELECT 1 FROM markets m WHERE m.id = market_id AND m.locks_at >
   now() AND m.status = 'open'))`. Admins are excluded from writing picks
   (`is_admin() = false`).
2. BEFORE INSERT OR UPDATE trigger `guard_prediction_lock()` raising
   `prediction locked` when the market's `locks_at <= now()`. This also stops
   service-role writes, which bypass RLS.

Read policies: own rows always; everyone's rows once the market is
`resolved` or `locks_at <= now()` (picks become public at lock, so league
members can compare).

### scoring_rules

`id`, `season_id`, `market_type`, `rule_key`, `points` int, unique
`(season_id, market_type, rule_key)`. Seeded per season:

| market_type | rule_key | points |
|---|---|---|
| podium | `exact_position` | 10 |
| podium | `in_podium` | 4 |
| podium | `all_exact_bonus` | 25 |
| pole | `exact` | 8 |
| fastest_lap | `exact` | 6 |
| first_retirement | `exact` | 6 |
| safety_car | `exact` | 3 |
| sprint_winner | `exact` | 6 |

`scoring_rule_points(season_id, market_type, rule_key)` returns the value or
0 when missing. Admin panel edits the rows. Editing does not recompute past
markets automatically; admin has "Recompute Grand Prix" for that.

### scores

`user_id`, `market_id`, `points` int, `hit_type` text, `computed_at`. PK
`(user_id, market_id)`. No user write policies; only
`compute_market_scores(market_id)` (SECURITY DEFINER) writes it. Trigger on
`markets` AFTER UPDATE when `result` or `status` changes.

Scoring function (SQL is source of truth; `lib/scoring.ts` is the tested TS
replica, same as Winscore):

```
base(pick, result, rules):
  pole / fastest_lap / sprint_winner:
      exact when pick.driver_id = result.driver_id → rules.exact, hit 'exact'
  first_retirement:
      exact when both null or same driver → rules.exact, hit 'exact'
  safety_car:
      exact when pick.value = result.value → rules.exact, hit 'exact'
  podium:
      per position i in p1..p3:
        pick.pi = result.pi          → exact_position
        else pick.pi in result set   → in_podium
      if all three exact → + all_exact_bonus, hit 'podium_exact_all'
      elif points > 0 → hit 'podium_partial'
  otherwise → 0, hit 'miss'
points = round(base * grands_prix.multiplier)   -- half up, integer
```

A `void` market yields no scores rows.

### leaderboards

Same aggregation shape for every surface (Winscore rule: admins filtered
inside the aggregate CTE so ranks stay contiguous).

Columns: `user_id, display_name, total_points, podium_exact_all_hits,
exact_hits, markets_scored, first_submit, rank`.
Order: `total_points desc, podium_exact_all_hits desc, exact_hits desc,
first_submit asc`.

- `v_leaderboard_overall` — season scoped through `active_season_id()`.
- `leaderboard_for_grand_prix(gp_id)`.
- `leaderboard_for_league(league_id)` — member scoped; each member counted only
  for markets whose GP `race_at >= league_members.joined_at` (Winscore
  join-date rule).
- `scores` added to the `supabase_realtime` publication; the client
  re-fetches the view on change (Winscore `LeaderboardLive`).

### leagues, league_members (Winscore groups renamed)

`leagues`: `id`, `season_id`, `name` (2–40), `owner_id`, `join_code` unique,
`plan` (`free | pro`, default `free`), `created_at`, `updated_at`.
`league_members`: `(league_id, user_id)` PK, `role` (`owner | member`),
`joined_at`, `invited_by_user_id`.

RPCs (SECURITY DEFINER, only mutation paths): `create_league(name)`,
`join_league(code, invited_by)`, `leave_league(id)`,
`remove_league_member(id, user_id)`, `league_preview(code)`,
`league_member_cap(plan)` → 10 for `free`, null (unlimited) for `pro`.
`join_league` raises `league is full` when the cap is reached. Join code
alphabet excludes `0 O 1 I L`, prefix `GP-`.

### operation_runs, operation_settings (copied)

Ledger of cron runs and per-job kill switch. Kinds: `sync_calendar`,
`sync_results`.

## 4. Data sync

`lib/race-sync/types.ts`:

```ts
export type RemoteSession = { at: string | null };          // ISO UTC or null
export type RemoteGrandPrix = {
  round: number; name: string; circuitKey: string; circuitName: string;
  country: string; locality: string;
  race: string; qualifying: string | null; sprint: string | null;
  sprintQualifying: string | null; fp1: string | null; fp2: string | null; fp3: string | null;
  raw: unknown;
};
export type RemoteDriver = { key: string; code: string | null; number: number | null;
  givenName: string; familyName: string; teamKey: string | null };
export type RemoteTeam = { key: string; name: string };
export type RemoteClassification = {
  position: number | null; driverKey: string; teamKey: string; laps: number;
  status: string; fastestLapRank: number | null;
};
export type RemoteQualifying = { driverKey: string; position: number }[];

export interface RaceDataProvider {
  name: string;
  available(): boolean;
  fetchCalendar(season: number): Promise<RemoteGrandPrix[]>;
  fetchDrivers(season: number): Promise<RemoteDriver[]>;
  fetchTeams(season: number): Promise<RemoteTeam[]>;
  fetchQualifying(season: number, round: number): Promise<RemoteQualifying | null>;
  fetchRaceResults(season: number, round: number): Promise<RemoteClassification[] | null>;
  fetchSprintResults(season: number, round: number): Promise<RemoteClassification[] | null>;
}
```

`lib/race-sync/providers/jolpica.ts` implements it against
`https://api.jolpi.ca/ergast/f1/...` (`JOLPICA_BASE_URL` env override).
`null` from a results call means "session not run yet" (empty `Races[]`).
Respect limits: at most 3 requests per second, retry once on 429 after the
`Retry-After` header.

`lib/race-sync/calendar.ts` `runCalendarSync({ seasonYear })`: upserts teams,
drivers, grands_prix (by provider keys), computes default multiplier for
unlocked rows, returns `{ grandsPrix, drivers, teams, errors }`.

`lib/race-sync/results.ts` `runResultsSync({ seasonYear, now })`: for each GP
with any session ended (`locks_at <= now`) and an unresolved market: call
`lock_due_markets()`, fetch qualifying/race/sprint as needed, resolve:

| market | source | auto-resolve |
|---|---|---|
| pole | qualifying position 1 | yes |
| podium | race positions 1–3 | yes |
| fastest_lap | race `fastestLapRank = 1` | yes |
| sprint_winner | sprint position 1 | yes |
| first_retirement | lowest `laps` among non-`Finished`/`+N Lap(s)` statuses; tie → `suggested_result` only | writes `suggested_result`, admin confirms |
| safety_car | not available from provider | admin only |

A resolved market is immutable to the provider; corrections go through admin
(Winscore rule). Every run is wrapped in `recordRun(kind, trigger, fn)`.

Cron routes: `GET /api/cron/sync-calendar` daily `0 6 * * *`;
`GET /api/cron/sync-results` hourly `0 * * * *`, self-skipping when no market
locked in the last 48 h. Both require `Authorization: Bearer $CRON_SECRET`
and honour `operation_settings`.

## 5. Routes

```
app/[locale]/
  page.tsx                          landing (next GP, countdown, leader)
  (public)/gp/page.tsx              season calendar
  (public)/gp/[slug]/page.tsx       GP detail: all markets + forms + results
  (public)/leaderboard/page.tsx     overall | per GP (?gp=slug)
  (public)/how-it-works/page.tsx    scoring table rendered from scoring_rules
  (app)/my-picks/page.tsx
  (app)/leagues/...                 list, [id], join/[code]
  (app)/stats/page.tsx              premium (phase 8)
  (admin)/admin/{grands-prix,grands-prix/[id],drivers,scoring,leagues,operations}
  (auth)/sign-in, sign-out          copied
  onboarding, welcome               copied
app/api/cron/{sync-calendar,sync-results}/route.ts
app/auth/callback/route.ts
```

## 6. Monetization hooks (no payments)

- `profiles.plan` and `leagues.plan` columns; `lib/plans.ts` exports
  `PLAN_FEATURES = { free: {...}, pro: {...} }`, `isPro(profile)`,
  `leagueMemberCap(plan)` mirroring the SQL function.
- `/stats` page: per-market accuracy, current streak, delta vs league
  average; server-side gate `isPro`, otherwise a locked preview.
- `<SponsorSlot placement="header" | "gp-detail" | "leaderboard" />` renders
  a bordered placeholder when the viewer is not `pro`; content comes from
  `lib/sponsor.ts` (static config now).

## 7. Testing strategy

- Unit (Vitest): `lib/scoring.ts` (every rule, multipliers 1 / 1.25 / 1.5 /
  2, rounding), pick validation helpers, multiplier defaults, Jolpica mappers
  against recorded JSON fixtures in `tests/fixtures/jolpica/*.json`,
  `lib/race-sync/{calendar,results}.ts` with the mocked Supabase chain pattern
  from Winscore, cron routes (auth, kill switch, ledger), i18n key parity,
  brand-literal guard.
- DB (SQL, run against local Supabase with `psql -v ON_ERROR_STOP=1`):
  `supabase/tests/*.sql` transactions that roll back: lock trigger and RLS
  refuse writes after `locks_at`, pick shape validation, market generation,
  `compute_market_scores` idempotence and multiplier application, league cap.
  Script `pnpm test:db`.
- No Playwright in v1; manual smoke checklist in `docs/test-plan.md`.

## 8. Out of scope (v1)

Quiz, news, AI recaps, transactional emails beyond Supabase magic link, web
push, wagers, social share images, analytics, Docker self-host stack, extra
locales, payments.
