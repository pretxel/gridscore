# Data model

Every table, constraint, trigger, function, view and RLS policy in the gridscore
schema. Runtime sources of truth:

- [`supabase/migrations/20260910000000_profiles.sql`](../supabase/migrations/20260910000000_profiles.sql) — accounts.
- [`supabase/migrations/20260910100000_core.sql`](../supabase/migrations/20260910100000_core.sql) — everything else, in numbered sections (§1–§11) that this document follows.
- [`supabase/migrations/20260910110000_scores_public_read.sql`](../supabase/migrations/20260910110000_scores_public_read.sql) — scores readable by anonymous visitors.

TypeScript sees the schema through the generated `lib/database.types.ts`
(`pnpm db:types`) and the narrowed aliases in `lib/db.ts`. Pick/result shapes
and lock-session mapping are mirrored in `lib/markets.ts`.

Invariants are covered by `supabase/tests/*.sql` (`pnpm test:db`).

## Season scoping

`public.active_season_id()` (§1) returns the season named by the request
header `x-season` (a slug such as `2026`), else the newest season with
`status = 'active'`. The server Supabase clients send the header only when a
caller asks for a specific season; everything else resolves to the active one.
`v_leaderboard_overall` and `create_league()` use it; RLS on predictions does
not need it because markets are already tied to a Grand Prix.

## Tables

### `profiles`

One row per auth user, created by `handle_new_user()` on `auth.users` insert.

| column | type | notes |
|---|---|---|
| `id` | uuid PK | FK `auth.users` cascade |
| `display_name` | text | 2–32 chars, null until onboarding |
| `is_admin` | boolean | service-role only (guard trigger) |
| `plan` | text | `free \| pro`, service-role only (same guard) |
| `timezone` | text | IANA name, optional |

RLS: any signed-in user reads any profile; users update their own row;
admins do anything. `trg_profiles_guard_privileged` raises when `is_admin` or
`plan` changes under a user JWT.

### `seasons` (§1)

| column | notes |
|---|---|
| `year` int unique, `slug` text unique | e.g. `2026` / `'2026'` |
| `name` | display name; keep it locale-neutral (a bare year), it is interpolated into translated copy |
| `status` | `upcoming \| active \| finished \| manage` |
| `providers` jsonb | provider config, e.g. `{"jolpica": {"season": "2026"}}` |

RLS: public read, admin write.

### `teams`, `drivers` (§2)

Provider-keyed rosters per season. `drivers.code` is a 3-letter uppercase code
(nullable), `number` 0–99, `team_id` nullable (set null on team delete),
`active` marks drivers still eligible for new picks. Unique
`(season_id, provider_key)` on both. RLS: public read, admin write.

### `grands_prix` (§3)

| column | notes |
|---|---|
| `season_id`, `round` | unique per season |
| `slug` | unique per season, kebab-case |
| `name`, `circuit_key`, `circuit_name`, `country`, `locality` | provider data |
| `has_sprint` | requires `sprint_at` (`grands_prix_sprint_needs_time`) |
| `multiplier` numeric(4,2) ≥ 1 | applied to every market of the weekend |
| `multiplier_reason` | `normal \| sprint \| legend \| finale \| custom` |
| `multiplier_locked` | true once an admin edits; sync leaves it alone |
| `fp1_at … race_at` | session instants; only `race_at` is required |
| `status` | `scheduled \| in_progress \| completed \| cancelled` |
| `provider_metadata` jsonb | raw provider row |

Trigger `trg_grands_prix_ensure_markets` (after insert / update of
`has_sprint`, `race_at`, `qualifying_at`, `sprint_at`) calls
`ensure_markets_for_grand_prix()`.

### `markets` (§4)

One row per `(grand_prix_id, type)`.

| column | notes |
|---|---|
| `type` | `pole \| podium \| fastest_lap \| first_retirement \| safety_car \| sprint_winner` |
| `locks_at` | from `market_locks_at()`: pole → qualifying, sprint_winner → sprint, else race (race is the fallback when the session has no time) |
| `status` | `open \| locked \| resolved \| void` |
| `result` jsonb | same shape as a pick; setting it resolves the market |
| `suggested_result` jsonb | provider heuristic awaiting admin confirmation |
| `resolution_source` | `provider \| manual` |
| `resolved_at`, `resolved_by` | |

Constraints: `markets_resolved_has_result` (resolved ⇒ result),
`markets_result_means_resolved` (result ⇒ resolved).

`trg_markets_before_write`: `void` wins and clears the result; a non-null
result is validated with `validate_market_pick()` and forces
`status = 'resolved'` + `resolved_at`; `suggested_result` is validated too.

`ensure_markets_for_grand_prix(gp)`: inserts missing markets (5, or 6 on a
sprint weekend), refreshes `locks_at` on markets still `open`, and voids
`sprint_winner` when the weekend loses its sprint. `lock_due_markets()` flips
`open → locked` where `locks_at <= now()` and returns the count.

RLS: public read, admin write. Recompute RPCs are service-role only.

### `predictions` (§5)

`(user_id, market_id)` unique; `pick` jsonb; `submitted_at` refreshed by the
trigger on every write.

**Lock, two layers:**

1. RLS `predictions_insert_own_before_lock` / `predictions_update_own_before_lock`:
   `user_id = auth.uid() AND NOT is_admin() AND market.status = 'open' AND
   market.locks_at > now()`.
2. `trg_predictions_guard_lock` (BEFORE INSERT OR UPDATE): raises
   `prediction locked` when `locks_at <= now()` or the market is not `open`,
   then validates the pick shape against the season roster. Runs for every
   writer including the service role.

Reads: own rows; everyone's rows once the market's `locks_at` has passed;
admins read all. No delete policy.

### Pick / result shapes (`validate_market_pick(type, jsonb, season_id)`)

| type | shape |
|---|---|
| `pole`, `fastest_lap`, `sprint_winner` | `{"driver_id": "<uuid>"}` |
| `podium` | `{"p1","p2","p3"}` distinct driver uuids |
| `first_retirement` | `{"driver_id": "<uuid>"}` or `{"driver_id": null}` |
| `safety_car` | `{"value": true \| false}` |

Exactly those keys; drivers must belong to the Grand Prix's season.

### `scoring_rules` (§6)

`(season_id, market_type, rule_key)` unique, `points ≥ 0`. Rule keys:
`exact` (single-answer markets), `exact_position`, `in_podium`,
`all_exact_bonus` (podium). `scoring_rule_points()` returns 0 for a missing
row. RLS: public read, admin write. Seeded by `supabase/seed/season-2026.sql`.

### `scores` (§7)

`(user_id, market_id)` PK, `points ≥ 0`, `hit_type` in
`exact | podium_exact_all | podium_partial | miss`. Readable by everyone
(`scores_select_public`, migration `20260910110000`): points are public once
results land, and Realtime can then deliver score changes to any leaderboard
viewer. No write policies; only `compute_market_scores()` writes. Published on
`supabase_realtime`.

**Scoring** — `score_market_pick(type, pick, result, season_id, multiplier)`:

- single-answer markets: `exact` when the ids match (`first_retirement`
  treats null/null as a match);
- `safety_car`: booleans match;
- `podium`: per position `exact_position`, else `in_podium` when the driver is
  anywhere on the result podium; three exact adds `all_exact_bonus` and hit
  `podium_exact_all`; any points → `podium_partial`; none → `miss`.
- `points = round(base × multiplier)` (half away from zero).

`compute_market_scores(market)` deletes the market's rows and re-inserts from
the current result (no rows unless `resolved`). `compute_grand_prix_scores(gp)`
loops over the weekend. `trg_markets_recompute_scores` fires on insert or when
`result` / `status` change. A multiplier or rule edit does **not** rescore by
itself; the admin panel calls the GP recompute.

### Leaderboards (§8)

Shared columns: `user_id, display_name, total_points, podium_exact_all_hits,
exact_hits, markets_scored, first_submit, rank`. Admins are excluded inside
the aggregate so ranks stay contiguous. Order:
`total_points desc, podium_exact_all_hits desc, exact_hits desc, first_submit asc`.

- `v_leaderboard_overall` — season via `active_season_id()`; readable by anon.
- `leaderboard_for_grand_prix(gp_id)`.
- `leaderboard_for_league(league_id)` — members only, each counted from the
  Grand Prix whose `race_at >= joined_at`; empty for non-members.

### `leagues`, `league_members` (§9)

`leagues`: `season_id`, `name` 2–40, `owner_id`, `join_code` unique
(`GP-` + 5 chars from an alphabet without `0 O 1 I L`), `plan` `free | pro`
(service-role only via `trg_leagues_guard_plan`).
`league_members`: `(league_id, user_id)` PK, `role` `owner | member`,
`joined_at`, `invited_by_user_id`.

RPCs (SECURITY DEFINER, the only mutation paths): `create_league(name)`
(needs an active season), `join_league(code, invited_by)` (idempotent;
raises `league is full` at `league_member_cap(plan)` = 10 on `free`, unlimited
on `pro`), `league_preview(code)`, `leave_league(id)` (owner cannot),
`remove_league_member(id, user)` (owner only, not self). Deleting a league
cascades memberships.

RLS: members (and admins) read their leagues and co-members; owner updates
and deletes. No insert policies.

### Statistics functions (migration `20260910120000`)

Read-only, season-scoped by `active_season_id()`, and gated by
`can_read_user_stats(user)` — the caller must be that user or an admin.
`user_market_stats(user)` returns scored/hits/points per market type,
`user_weekend_points(user)` one row per Grand Prix ordered by round, and
`season_average_points()` the field's mean total from the leaderboard view.
The plan gate is not here: the database decides who may read whose rows, the
app (`lib/plans.ts`) decides what a plan unlocks.

### `operation_runs`, `operation_settings` (§10)

Cron ledger and per-job kill switch for `sync_calendar` and `sync_results`.
Admin read; service-role write.

## Grants summary

| object | grantee |
|---|---|
| `v_leaderboard_overall`, `leaderboard_for_grand_prix` | anon, authenticated |
| `lock_due_markets`, `score_market_pick`, `scoring_rule_points`, `validate_market_pick`, `market_locks_at`, `league_member_cap`, `active_season_id` | anon, authenticated |
| league RPCs, `leaderboard_for_league`, `is_league_*` | authenticated |
| `compute_market_scores`, `compute_grand_prix_scores`, `ensure_markets_for_grand_prix`, `generate_join_code` | service role only |
