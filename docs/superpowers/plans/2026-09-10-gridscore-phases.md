# gridscore Implementation Plan (phases)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Each phase gets its own bite-sized task file `docs/superpowers/plans/2026-09-10-gridscore-phase-N.md` written when the phase starts; this file is the phase contract (scope, files, tests, acceptance criteria).

**Goal:** Ship a bilingual Grand Prix predictions pool with per-market DB-enforced locks, DB-configurable scoring, live leaderboards, private leagues, Jolpica sync with admin fallback, and monetization hooks, reusing Winscore wherever it applies.

**Architecture:** Next.js 16 App Router on Vercel talking to Supabase (Postgres + Auth + RLS). Reads are Server Components on the anon client; user writes are server actions under RLS; admin writes use the service-role client behind `assertAdmin()`. Scoring lives in SQL (SECURITY DEFINER function + trigger) with a tested TypeScript replica. Data enters through `RaceDataProvider` implementations driven by Vercel crons.

**Tech Stack:** Next.js 16.3, React 19.2, TypeScript, Tailwind 4, shadcn base-nova, next-intl, Supabase (@supabase/ssr, supabase-js), zod, Biome, Vitest, Turbo, Husky, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-09-10-gridscore-design.md`

**Source of reuse:** `/Users/edselserrano/Projects/personal/winscore-app` (read-only reference).

## Global Constraints

- Never emit the literals `F1`, `Formula 1`, `Formula One`, `FIA`, `FOM` in `app/`, `components/`, `lib/`, `messages/`, `public/`, README or domain. Enforced by `tests/no-brand-literals.test.ts` from phase 0.
- Scoring points live in `scoring_rules`; GP multipliers live in `grands_prix.multiplier`. No hardcoded points in SQL or TS except the seed and the test expectations.
- Every market has its own `locks_at`; lock is enforced by RLS **and** a BEFORE trigger.
- Locales `en` + `es` from phase 0; every UI string goes through next-intl; `tests/i18n.test.ts` enforces key parity.
- Commits: small, English, Conventional Commits (`feat(scope): ...`), no AI attribution trailers.
- A phase is done only when `pnpm lint && pnpm typecheck && pnpm test` pass (and `pnpm test:db` from phase 1).
- Package manager `pnpm@10.33.2`. Next `16.3.x`. Supabase CLI local stack for DB tests.

---

## Phase 0 — Scaffold, auth, i18n routing, tooling

**Scope.** New Next app in this repo, copy Winscore's tooling and auth skeleton, bilingual routing, brand guard, README skeleton, MIT license.

**Files.**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `biome.json`, `vitest.config.ts`, `turbo.json`, `components.json`, `.husky/pre-commit`, `.husky/pre-push`, `.gitignore`, `.vercelignore`, `.env.example`, `LICENSE` (MIT), `README.md` (Winscore structure, gridscore content), `global.d.ts`
- Copy/adapt: `proxy.ts`, `i18n.ts`, `lib/i18n.ts` (locales `["en","es"]`), `lib/env.ts` (supabase, siteUrl, cronSecret, jolpicaBaseUrl only), `lib/utils.ts`, `lib/supabase/{server,browser,admin}.ts` (header `x-season`), `lib/database.types.ts` (stub until phase 1), `lib/db.ts` (empty aliases)
- Copy: `components/ui/*` (12 primitives), `components/theme-provider.tsx`, `components/theme-toggle.tsx`, `components/language-switcher.tsx`, `components/local-time.tsx`, `components/timezone-sync.tsx`, `components/logotype.tsx` (new wordmark "gridscore"), `components/site-nav.tsx`, `components/site-nav-client.tsx`
- Copy/adapt: `app/layout.tsx`, `app/globals.css` (new palette: asphalt dark + signal accent; keep token names), `app/[locale]/layout.tsx`, `app/[locale]/page.tsx` (placeholder landing), `app/[locale]/(auth)/sign-in/*`, `app/[locale]/(auth)/sign-out/route.ts`, `app/auth/callback/route.ts`, `app/[locale]/onboarding/*`, `app/[locale]/profile-actions.ts`, `app/[locale]/(app)/layout.tsx`, `app/[locale]/(admin)/admin/layout.tsx` + `components/admin/*`, `app/[locale]/error.tsx`, `app/[locale]/not-found.tsx`
- Create: `messages/en.json`, `messages/es.json` (namespaces `common, nav, siteMeta, signIn, onboarding, admin, error, notFound, footer, languageSwitcher`)
- Tests: `tests/setup-env.ts`, `tests/shims/server-only.ts`, `tests/i18n.test.ts`, `tests/no-brand-literals.test.ts`
- Supabase: `supabase/config.toml` (project_id `gridscore`, ports as Winscore, no SMTP block), `supabase/seed/admin.sql`

**Acceptance criteria.**
- [ ] `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.
- [ ] `supabase start` boots; `/en` and `/es` render the landing with nav, theme toggle and language switcher; bare `/` redirects by `Accept-Language`.
- [ ] Magic-link sign-in works against local Supabase (Inbucket), creates `profiles` row, forces onboarding display name, `/en/admin` returns the forbidden page for non-admins and renders the admin shell after `seed/admin.sql`.
- [ ] `tests/no-brand-literals.test.ts` fails when a forbidden literal is added to `messages/en.json` (verified by a deliberate temporary edit during review).
- [ ] Husky hooks installed and firing (`pnpm test` on commit, `biome check` + build on push).
- [ ] README has the Winscore sections: intro, Documentation, Local development, Scripts, First-time setup, Day-to-day operations, Deploy, How scoring works (placeholder table), Where things live.

**Exit gate.** All boxes checked, ~6–10 commits (`chore(scaffold)`, `feat(auth)`, `feat(i18n)`, `docs(readme)`, `test(guards)`).

---

## Phase 1 — Schema and migrations

**Scope.** Single init migration implementing spec §3, SQL invariant tests, generated types, `lib/db.ts` aliases, zod mirrors for JSON shapes.

**Files.**
- Create: `supabase/migrations/20260910000000_init.sql` with sections in this order: extensions; `profiles` (+ `plan`); `seasons` + `active_season_id()`; `teams`, `drivers`; `grands_prix`; `validate_market_pick(type, jsonb)`, `market_locks_at(...)`, `markets`, `ensure_markets_for_grand_prix`, trigger on `grands_prix`, `lock_due_markets()`; `predictions` + `guard_prediction_lock` trigger + RLS; `scoring_rules` + `scoring_rule_points()`; `scores` + `score_market_pick(type, pick, result, rules...)` + `compute_market_scores(market_id)` + trigger on `markets`; leaderboard view + functions; `leagues`, `league_members`, RPCs, `leaderboard_for_league`, `league_member_cap`; `operation_runs`, `operation_settings`; realtime publication; grants.
- Create: `supabase/seed/season-2026.sql` (season row + `scoring_rules` seed), `supabase/seed/dev-fixture.sql` (one GP, 6 drivers, 2 teams, markets for local dev)
- Create: `supabase/tests/{lock.sql, picks.sql, markets.sql, scoring.sql, leagues.sql}` (transaction + rollback, `pg_temp.raises()` helper from Winscore)
- Create: `scripts/test-db.sh` → `pnpm test:db` (runs `supabase db reset` then each SQL test with `psql -v ON_ERROR_STOP=1`)
- Create: `lib/markets.ts` (`MARKET_TYPES`, zod schemas `pickSchemaFor(type)`, `marketLocksAt(gp, type)` TS mirror), `lib/db.ts` aliases (`SeasonRow, DriverRow, TeamRow, GrandPrixRow, MarketRow, MarketType, PredictionRow, ScoreRow, HitType, LeaderboardRow, LeagueRow, LeagueMemberRow`)
- Generate: `lib/database.types.ts` via `supabase gen types typescript --local`
- Tests: `tests/markets.test.ts` (pick schemas accept/reject each shape; locks_at mapping)
- Docs: `docs/data-model.md`

**Acceptance criteria.**
- [ ] `supabase db reset` applies the migration and seeds without error.
- [ ] `pnpm test:db` passes: (a) insert prediction after `locks_at` fails under RLS as `authenticated` and under service role via the trigger; (b) bad pick shapes and podium duplicates are rejected; (c) inserting a GP creates 5 markets, 6 when `has_sprint`, and changing `qualifying_at` moves only the `pole` `locks_at` while a resolved market keeps its own; (d) `compute_market_scores` yields the spec table values for exact/partial/miss with multipliers 1, 1.25, 1.5, 2 and is idempotent; (e) `join_league` refuses the 11th member on a `free` league and accepts on `pro`.
- [ ] `v_leaderboard_overall` excludes admins with contiguous ranks; `leaderboard_for_league` applies the `joined_at` cutoff (asserted in `leagues.sql`).
- [ ] `lib/database.types.ts` regenerated, `pnpm typecheck` green, `tests/markets.test.ts` green.
- [ ] `docs/data-model.md` lists every table, policy, function with line anchors into the migration.

**Exit gate.** All boxes; commits `feat(db): ...` per section, `test(db): ...`, `docs(data-model)`.

---

## Phase 2 — Data sync (Jolpica)

**Scope.** Provider interface, Jolpica client with recorded fixtures, calendar and results sync, cron routes, operations ledger, admin "run now" hooks (UI in phase 6).

**Files.**
- Create: `lib/race-sync/types.ts` (spec §4 interfaces), `lib/race-sync/providers/jolpica.ts`, `lib/race-sync/providers/index.ts` (`defaultProviders()`), `lib/race-sync/multipliers.ts` (`defaultMultiplier({ round, lastRound, hasSprint, circuitKey })`, `LEGEND_CIRCUITS`), `lib/race-sync/calendar.ts` (`runCalendarSync`), `lib/race-sync/results.ts` (`runResultsSync`, `resolveFromClassification(type, rows)`, `firstRetirement(rows)`), `lib/race-sync/staleness.ts` (`dueGrandsPrix(gps, now)`)
- Copy/adapt: `lib/operations/record-run.ts` (kinds `sync_calendar | sync_results`), `lib/operations/settings.ts`, `lib/operations/schedule.ts`, `lib/operations/queries.ts`
- Create: `app/api/cron/sync-calendar/route.ts`, `app/api/cron/sync-results/route.ts`, `vercel.json`
- Create fixtures: `tests/fixtures/jolpica/{races-2025.json, drivers-2025.json, constructors-2025.json, qualifying-2025-1.json, results-2025-1.json, sprint-2025-2.json}` recorded from the live API (2025 is the last complete season available; the mapper is season-agnostic)
- Tests: `tests/jolpica-provider.test.ts` (mapping, null on empty Races, 429 retry, rate limiter), `tests/multipliers.test.ts`, `tests/calendar-sync.test.ts` (mocked Supabase chain: upserts, locked multiplier preserved, has_sprint), `tests/results-sync.test.ts` (each market resolution, first_retirement tie → suggested only, resolved market untouched, void when cancelled), `tests/cron-routes.test.ts` (401 without secret, 204 `x-skipped` when disabled or nothing due, ledger row written), `tests/first-retirement.test.ts`

**Acceptance criteria.**
- [ ] Against local Supabase and the live API: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/sync-calendar` imports the 2026 calendar (all rounds, all sessions, `has_sprint` correct, multipliers: finale 2, legends 1.5, sprint 1.25) plus drivers and teams; second run is a no-op (same row count, `updated_at` unchanged where nothing changed).
- [ ] With the dev fixture GP set in the past, `sync-results` resolves `pole`, `podium`, `fastest_lap` (and `sprint_winner`) from fixtures, writes `suggested_result` for `first_retirement`, leaves `safety_car` open, and `scores` rows appear via the trigger.
- [ ] All new Vitest suites green; `pnpm test` total runtime < 30 s.
- [ ] `operation_runs` shows one row per run with `status` `success|partial|error` and the summary JSON.
- [ ] `docs/architecture.md` has the sync section (providers, cron, ledger, manual fallback).

**Exit gate.** Boxes checked; commits `feat(sync): ...`, `test(sync): ...`, `chore(cron)`.

---

## Phase 3 — Predictions and lock UX

**Scope.** Public calendar and GP pages, per-market prediction forms, server action with RLS error mapping, my-picks.

**Files.**
- Create: `lib/grands-prix.ts` (`listSeasonGrandsPrix()`, `getGrandPrixBySlug()`, `getMarketsForGrandPrix()`, `nextGrandPrix()`), `lib/drivers.ts` (`listActiveDrivers()`), `lib/predictions.ts` (`getMyPicksForGrandPrix()`, `listMyPicks()`), `lib/market-utils.ts` (`isMarketLocked`, `lockReason`, `isClosingSoon`, `marketLabelKey`)
- Create: `app/[locale]/(public)/gp/page.tsx`, `app/[locale]/(public)/gp/loading.tsx`, `app/[locale]/(public)/gp/[slug]/page.tsx`, `.../[slug]/actions.ts` (`submitPick(input)` with zod per type, admin blocked, maps `42501` and `prediction locked` to i18n errors), `.../[slug]/market-form.tsx` (client; driver select, ordered podium picker with three selects and duplicate guard, yes/no toggle, "none" option), `components/market-lock-countdown.tsx`, `components/grand-prix-card.tsx`, `components/session-schedule.tsx`, `components/driver-badge.tsx`
- Create: `app/[locale]/(app)/my-picks/page.tsx`
- Update: `app/[locale]/page.tsx` landing (next GP + countdown + CTA)
- Messages: namespaces `gp, markets, pickForm, myPicks, home`
- Tests: `tests/market-utils.test.ts`, `tests/submit-pick.test.ts` (action: validation per type, admin rejection, lock error mapping with mocked client), `tests/grands-prix.test.ts` (`nextGrandPrix` selection)

**Acceptance criteria.**
- [ ] Signed-in user can submit and edit every market on an open GP; each form shows its own countdown; a market past `locks_at` renders read-only with the saved pick.
- [ ] Manual check: set a market `locks_at` to the past via SQL while the page is open, submit → toast shows the localized "locked" message (RLS refusal), no row written.
- [ ] Podium form cannot submit duplicate drivers; `first_retirement` offers "None"; `safety_car` is yes/no.
- [ ] Admin accounts see forms disabled and the action rejects server-side.
- [ ] `/my-picks` lists picks grouped by GP with lock state and result when resolved.
- [ ] All strings in `en` and `es`; parity test green.

**Exit gate.** Boxes checked; commits `feat(gp): ...`, `feat(picks): ...`, `test(picks)`.

---

## Phase 4 — Scoring and leaderboard

**Scope.** TS scoring replica with exhaustive tests, leaderboard pages (overall, per GP), realtime refresh, how-it-works from `scoring_rules`.

**Files.**
- Create: `lib/scoring.ts` (`scoreMarket({ type, pick, result, rules, multiplier }) → { points, hitType }`, `roundHalfUp`), `lib/scoring-rules.ts` (`getScoringRules(seasonId)` → map), `lib/leaderboard.ts` (`getOverallBoard()`, `getGrandPrixBoard(gpId)`), `lib/leaderboard-segment.ts` (`?gp=` param parsing)
- Create: `app/[locale]/(public)/leaderboard/page.tsx` + `loading.tsx`, `components/leaderboard-table.tsx`, copy `components/leaderboard-live.tsx`, `components/leaderboard-segment-switcher.tsx`, `app/[locale]/how-it-works/page.tsx`, `components/scoring-explainer.tsx`
- Tests: `tests/scoring.test.ts` (every rule; podium: 3 exact = 30+25, 2 exact + 1 in podium = 24, 1 exact = 10, 3 in wrong order = 12, none = 0; multipliers 1.25 on 4 → 5, 1.5 on 55 → 83 (82.5 half up), 2 on 8 → 16; `first_retirement` none/none exact; void ignored), `tests/scoring-parity.test.ts` (runs the same 20 cases through `compute_market_scores` in `supabase/tests/scoring_parity.sql` generated from the TS cases so SQL and TS cannot drift), `tests/leaderboard-segment.test.ts`

**Acceptance criteria.**
- [ ] `tests/scoring.test.ts` covers all hit types and multipliers; SQL parity file passes in `pnpm test:db`.
- [ ] Setting a market result (SQL or sync) updates the overall board on the open leaderboard page within ~1 s without reload (realtime).
- [ ] Leaderboard shows rank, player, points, podium-exact count, exact count, with "you" highlight; per-GP segment works via `?gp=<slug>`.
- [ ] `/how-it-works` renders the points table from `scoring_rules` and the multiplier legend from the season's GPs; no hardcoded numbers in the page.
- [ ] Admins never appear on any board.

**Exit gate.** Boxes checked; commits `feat(scoring)`, `feat(leaderboard)`, `test(scoring-parity)`.

---

## Phase 5 — Leagues

**Scope.** Private leagues with invite code, member management, league board, free cap.

**Files.**
- Create: `lib/leagues.ts` (`listMyLeagues`, `getLeague`, `getLeagueBoard`, `getLeaguePreview`), `lib/plans.ts` (`PLAN_FEATURES`, `leagueMemberCap`, `isPro`)
- Create: `app/[locale]/(app)/leagues/page.tsx`, `leagues/actions.ts` (`createLeagueAction`, `joinLeagueAction`, `renameLeagueAction`, `leaveLeagueAction`, `removeMemberAction`, `deleteLeagueAction`), `leagues/league-forms.tsx`, `leagues/[id]/page.tsx`, `leagues/[id]/league-controls.tsx`, `leagues/join/[code]/page.tsx`, `leagues/join/[code]/join-confirm.tsx`, `components/league-board.tsx`, `components/invite-code.tsx` (copy + share link)
- Messages: `leagues`, `leagueInvite`
- Tests: `tests/leagues-actions.test.ts` (error key mapping incl. `league is full` → `errorLeagueFull`), `tests/plans.test.ts`

**Acceptance criteria.**
- [ ] Create league → redirected to its page with code `GP-XXXXX`; join by code and by `/leagues/join/GP-XXXXX` link; preview shows league name before joining.
- [ ] Owner can rename, remove members, delete; member can leave; owner cannot leave.
- [ ] League board ranks members only, applies `joined_at` cutoff (verified with a member joined after a resolved GP).
- [ ] 11th join on a free league shows the localized "league is full" error with an upgrade hint; `pro` league accepts.
- [ ] `leagues.plan` and `profiles.plan` are only writable by service role (guard trigger test in `pnpm test:db`).

**Exit gate.** Boxes checked; commits `feat(leagues)`, `test(leagues)`.

---

## Phase 6 — Admin panel

**Scope.** Operators manage GPs (multipliers, sessions), results per market (manual entry, confirm suggestions, void), scoring rules, drivers/teams, leagues (plan flip), operations (runs, run now, kill switch).

**Files.**
- Create: `lib/admin/current-user.ts` (copy), `lib/admin/managed-season.ts` (cookie `gs_admin_managed_season`)
- Create: `app/[locale]/(admin)/admin/page.tsx` (overview), `admin/grands-prix/page.tsx` + `actions.ts` (`saveGrandPrix`, `setMultiplier`, `recomputeGrandPrix`), `admin/grands-prix/[id]/page.tsx` (sessions, markets table, per-market result form with driver selects / yes-no / none, "accept suggestion", "void", "recompute"), `admin/grands-prix/[id]/market-result-form.tsx`, `admin/scoring/page.tsx` + `actions.ts` (`saveScoringRule`), `admin/drivers/page.tsx` + `actions.ts` (`saveDriver`, `saveTeam`, `toggleDriverActive`), `admin/leagues/page.tsx` + `actions.ts` (`setLeaguePlan`), `admin/operations/page.tsx` + `actions.ts` (`runNow(kind)`, `toggleOperation`), reuse `components/admin/*`
- Messages: `admin` namespace expansion
- Tests: `tests/admin-actions.test.ts` (assertAdmin rejection, result payload validation per type, void clears scores via RPC call, multiplier lock flag set on edit), `tests/operations-actions.test.ts`

**Acceptance criteria.**
- [ ] Non-admin hitting any admin action gets "Admin only"; admin UI hidden from nav for non-admins.
- [ ] Admin can enter a `safety_car` result and confirm a `first_retirement` suggestion; scores recompute instantly and the public leaderboard reflects it.
- [ ] Editing a multiplier sets `multiplier_locked`; next calendar sync leaves it untouched (integration test + manual run).
- [ ] Editing a scoring rule and pressing "Recompute Grand Prix" rescored that GP; other GPs unchanged.
- [ ] Operations page lists last 20 runs per job, next scheduled run, "Run now" works with the ledger recording `trigger = manual`, kill switch stops the cron (route returns 204 `x-skipped: disabled`).

**Exit gate.** Boxes checked; commits `feat(admin): ...` per surface, `test(admin)`.

---

## Phase 7 — i18n completeness

**Scope.** Audit every surface for untranslated strings, review Spanish copy, dates and numbers per locale, metadata per locale, brand guard on messages.

**Files.**
- Update: `messages/en.json`, `messages/es.json`; every page `generateMetadata`; `components/local-time.tsx` locale formats; `lib/format.ts` (`formatPoints`, `formatSessionTime(locale, tz)`)
- Tests: extend `tests/i18n.test.ts` with a scan that fails on JSX text nodes with ≥ 3 consecutive letters outside `t(...)` in `app/` and `components/` (allowlist file `tests/i18n-allowlist.json` for brand words and codes); `tests/no-brand-literals.test.ts` covers `messages/*`.

**Acceptance criteria.**
- [ ] Untranslated-text scan passes with an allowlist ≤ 10 entries, each justified in the file.
- [ ] Switching locale on any page keeps the route and state; session times render in the viewer's timezone with locale formatting.
- [ ] Spanish copy reviewed line by line (motorsport vocabulary: "pole", "vuelta rápida", "coche de seguridad", "abandono").
- [ ] `<html lang>` and OG locale per route; sitemap lists both locales.

**Exit gate.** Boxes checked; commits `feat(i18n)`, `test(i18n)`.

---

## Phase 8 — Monetization hooks

**Scope.** Plan columns already exist; add feature flags, premium stats page, sponsor slot, upgrade CTAs. No payment provider.

**Files.**
- Create: `lib/stats.ts` (`getUserStats(userId)`: accuracy per market type, current/best streak of scored GPs with points > 0, delta vs league average), `app/[locale]/(app)/stats/page.tsx` + `stats-locked.tsx`, `components/sponsor-slot.tsx`, `lib/sponsor.ts`, `components/upgrade-cta.tsx`
- Update: `app/[locale]/layout.tsx` (header slot), GP detail and leaderboard pages (slots), leagues page (Pro badge, cap notice)
- Migration: `supabase/migrations/<ts>_user_stats.sql` (`user_market_stats(user_id)` function, season scoped)
- Tests: `tests/stats.test.ts` (pure aggregation helpers), `tests/plans.test.ts` extended, `tests/sponsor-slot.test.ts` (renders placeholder only for free)

**Acceptance criteria.**
- [ ] `/stats` shows the locked preview for `free` and full stats for `pro` (flipped via SQL); numbers match a hand-computed fixture.
- [ ] Sponsor slots render for free viewers in header, GP detail and leaderboard, and are absent for pro.
- [ ] `PLAN_FEATURES` is the single place listing gated features; no other file compares `plan === "pro"` directly (grep in a test).
- [ ] README "Monetization" section documents the hooks and how a payment provider would flip `plan`.

**Exit gate.** Boxes checked; commits `feat(plans)`, `feat(stats)`, `feat(sponsor)`.

---

## Phase 9 — Release readiness

**Scope.** Final docs, deploy, smoke test.

**Files.**
- Update: `README.md` (final scoring table, operations, deploy), `docs/architecture.md`, `docs/operator-guide.md`, `docs/test-plan.md` (manual smoke list), `docs/contributing.md`
- Create: Vercel project, env vars, Supabase cloud project, `supabase db push`, auth redirect URLs

**Acceptance criteria.**
- [ ] Production deploy: sign-in, calendar import via cron, pick submit, lock at a real session time, admin result entry, leaderboard update, league join — all verified on the deployed URL.
- [ ] `docs/test-plan.md` walked once; every failure fixed or logged as an issue.

---

## Phase order and dependencies

```
0 scaffold → 1 schema → 2 sync → 3 predictions → 4 scoring/leaderboard → 5 leagues → 6 admin → 7 i18n → 8 monetization → 9 release
```

Phase 2 and 3 only share the schema; they could run in parallel worktrees if needed. Phases 4–6 depend on 3. Phase 7 touches everything and must come after 6.
