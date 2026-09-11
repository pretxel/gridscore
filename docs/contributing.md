# Contributing

Conventions for working in this repository. The design spec lives in
[`superpowers/specs/2026-09-10-gridscore-design.md`](./superpowers/specs/2026-09-10-gridscore-design.md)
and the phased plan in
[`superpowers/plans/2026-09-10-gridscore-phases.md`](./superpowers/plans/2026-09-10-gridscore-phases.md).

## Local development

```bash
pnpm install
cp .env.example .env.local      # fill in the keys printed by `supabase start`
supabase start
pnpm dev
```

The dev server fails fast at module load if any of `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` is missing
(`lib/env.ts`). Magic-link emails from the local stack land in Mailpit at
<http://127.0.0.1:54334>.

Two env files, because two tools read different ones: **Next.js reads
`.env.local`** and the **Supabase CLI reads `.env`**. Both are gitignored and
both are templated in `.env.example`. The `.env` one carries the auth URLs that
`supabase/config.toml` resolves with `env(...)`, so the same config file serves
local development and the deployed project.

### Useful scripts

| command             | purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `pnpm dev`          | Next dev server with Turbopack.                            |
| `pnpm build`        | Production build.                                          |
| `pnpm typecheck`    | `tsc --noEmit`.                                            |
| `pnpm lint`         | Biome lint + format check.                                 |
| `pnpm format`       | Biome write.                                               |
| `pnpm test`         | Vitest unit tests.                                         |
| `pnpm test:watch`   | Vitest watch mode.                                         |
| `pnpm test:db`      | SQL invariant tests against the local Supabase stack.      |
| `pnpm db:types`     | Regenerate `lib/database.types.ts` from the local database.|
| `pnpm gen:scoring-parity` | Render the shared scoring cases into the SQL parity suite. |

Run `pnpm typecheck && pnpm lint && pnpm test` before opening a PR. Husky runs
`pnpm test` before every commit and `biome check` + `pnpm build` before every push.

## Code conventions

### General

- **Next.js 16 App Router.** Read the relevant guide in `node_modules/next/dist/docs/`
  before adopting an API you have not used on this codebase; defaults differ from
  older Next.js versions.
- **Server Components by default.** Add `"use client"` only when the file needs
  browser APIs, state, or event handlers.
- **Server actions over route handlers** for app mutations. Route handlers exist
  only where a `Request` object is required (auth callback, sign-out, cron).
- **No emojis** in code, copy, or commits. Plain ASCII.
- **Brand rule.** Never write the championship's name, the governing body or the
  commercial rights holder in code, copy or assets. `tests/no-brand-literals.test.ts`
  fails the build on any hit. Use "Grand Prix", "race", "season", circuit codes.

### Forms and validation

- Native HTML forms + server actions, validated with `zod`. Server actions return
  a serialisable result (`{ ok: true } | { ok: false; error: string }`) or `void`.
  Throwing is acceptable for admin-only actions where the error boundary catches.

### UI primitives

- shadcn primitives live under `components/ui/**` and carry `data-slot` attributes.
- Use `cn(...)` from `lib/utils.ts` for conditional classes.
- Tailwind 4 with no `tailwind.config.*`; tokens live in `app/globals.css`.
  Brand tokens: `signal` (accent), `flag` (secondary warm accent), `live`.

### Database access

- User-context reads/writes → `createServerSupabaseClient()` (`lib/supabase/server.ts`).
- Client components → `createBrowserSupabaseClient()` (`lib/supabase/browser.ts`).
- Admin-only writes that bypass RLS → `createAdminSupabaseClient()` (`lib/supabase/admin.ts`),
  always after `assertAdmin()` from `lib/admin/current-user.ts`.
- Never call `getSession()` in Server Components; use `getUser()` and lean on RLS.
- Prefer the narrowed aliases in `lib/db.ts` over raw `Tables<…>`.

### i18n

- Every user-visible string goes through next-intl. Add the key to both
  `messages/en.json` and `messages/es.json` in the same commit; the parity test
  fails otherwise.
- Pages read the locale from `params`, validate it with `isLocale`, and call
  `setRequestLocale(locale)` before any translation.
- `tests/untranslated-text.test.ts` fails on any JSX text node carrying prose.
  If something genuinely cannot be translated, add it to
  `tests/i18n-allowlist.json` with a `why`; the list is capped at ten entries.
- Format numbers and instants through `lib/format.ts`, never with a bare
  `toLocaleString`. Data that is interpolated into translated sentences (a
  season name, say) has to be locale-neutral.

### Plans

- `PLAN_FEATURES` in `lib/plans.ts` is the only place that decides what a plan
  unlocks. Call `hasFeature()`, `isPro()` or `leagueMemberCap()`; a test fails
  the build if any other file compares a plan against `"free"` or `"pro"`.

### Tests

- Biome's `noExportsInTest` forbids exports from a `*.test.ts` file, and it only
  surfaces in `biome check` — which the pre-push hook runs. A helper a test needs
  to export goes in `lib/` instead (`lib/brand-guard.ts`, `lib/i18n-scan.ts`).
- Keep arithmetic in pure modules so it can be unit-tested, and let the
  server-only module do the querying (`lib/stats.ts` beside `lib/user-stats.ts`,
  `lib/leaderboard-segment.ts` beside `lib/leaderboard.ts`).

## Before a release

Walk [`test-plan.md`](./test-plan.md) against the deployment. The operator
runbook is [`operator-guide.md`](./operator-guide.md).

## Migrations

Schema changes go in a new file under `supabase/migrations/` with a sortable
timestamp prefix. Apply locally with `supabase db reset`. Forward-only: no
down-migration policy. After any migration:

1. `supabase db reset`
2. `pnpm db:types`
3. Update narrowed aliases in `lib/db.ts` if a union changed.
4. `pnpm typecheck && pnpm test && pnpm test:db`.

## Commits

- One logical change per commit. Conventional Commits in English:
  `feat(scope): …`, `fix(scope): …`, `docs: …`, `test(scope): …`, `chore: …`.
- No AI attribution trailers.
- Never use `--no-verify` after a hook failure; fix the cause and commit again.

## Pull requests

- Squash-merge to `main`. Titles under 70 characters; detail in the body.
- Include a short `## Summary` and `## Test plan` checklist.
