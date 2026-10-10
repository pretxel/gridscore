## Context

Two senders carry gridscore's email. **Supabase Auth** sends the magic link (the only auth flow the app uses today; sign-up confirmation, invite, email change and reauthentication exist as templates so nothing ever falls back to the default). **Resend** sends app mail, today only the lock reminder, behind the `Mailer` interface in `lib/email/mailer.ts` with `lib/email/resend.ts` as the production implementation. The decision that app mail goes through Resend and Supabase SMTP stays for auth is settled (see `improve-pick-flow`).

The five Supabase templates in `supabase/templates/` share one hand-written shell: chequered top edge, wordmark block, kicker + headline + bilingual copy, accent button with a kerb stripe under it, a "Your calls" info box, footer note, and a strap line below the card. They are bilingual because Supabase serves one template per project. The `[auth.email.template.*]` blocks in `config.toml` are commented out: the hosted free tier answers `Email template modification is not available for free tier projects using the default email provider` until a custom SMTP sender is configured. The CLI reads `.env` and resolves `env(...)` in `config.toml`; `supabase config push` sends the result to the linked project (ref in `supabase/.temp/project-ref`). Locally, `supabase start` runs Mailpit (`[inbucket]`, port 54334) and auth mail must keep landing there.

The reminder email (`lib/reminders/email.ts`) builds its own HTML string with a plainer card. Its content comes from the message catalogues, so it is translated and brand-checked like every string. `tests/reminder-email.test.ts` pins its subject, ordering, locale, time zone and unsubscribe headers.

Repo conventions that apply: generated files come from `scripts/gen-*.mts` with a `pnpm gen:*` script and a Vitest parity test that fails when the committed output is stale (`gen:scoring-parity`, `gen:circuit-layouts`); `tests/no-brand-literals.test.ts` forbids championship brand names in product text; Biome runs from `node_modules/.bin/biome`.

## Goals / Non-Goals

**Goals:**
- Production auth mail arrives branded, from the app's own domain, through Resend SMTP.
- Local development is untouched: Mailpit still catches every auth email.
- Every email the app sends, auth or app, renders from one shell, so a change to the shell reaches all of them.
- The Supabase templates cannot drift from the shell: they are generated, and CI fails when stale.
- An operator can go from a fresh Resend account to branded production auth mail by following the guide, with a verification step at the end.

**Non-Goals:**
- A new visual design. The shell is the one already in `supabase/templates/`; this change moves it to code and reuses it.
- A password flow. No `recovery` template or `password_changed` notification: the app has no passwords. Both are easy to add later through the same generator.
- Per-locale Supabase templates. Supabase serves one per project; the bilingual layout stays.
- Moving reminders off Resend's HTTP API onto SMTP, or moving auth mail onto the `Mailer`. Supabase Auth sends auth mail; the app never does.
- Supabase Branching. `[remotes.*]` is used only as a per-project override for the single linked project.

## Decisions

### 1. Resend SMTP, scoped to the production project with `[remotes.production]`

`config.toml` gets:

```toml
[remotes.production]
project_id = "<linked project ref>"

[remotes.production.auth.email.smtp]
enabled = true
host = "smtp.resend.com"
port = 465
user = "resend"
pass = "env(RESEND_API_KEY)"
admin_email = "env(SUPABASE_AUTH_SENDER_EMAIL)"
sender_name = "gridscore"
```

The base `[auth.email.smtp]` stays absent, so `supabase start` keeps Mailpit. `config push` applies the remote override whose `project_id` matches the linked project. The Resend values (host, port 465, user `resend`, API key as password) are Resend's documented SMTP settings. The same `RESEND_API_KEY` that reminders use is reused; it needs sending access only.

`SUPABASE_AUTH_SENDER_EMAIL` is a new variable holding a bare address on the verified domain (for example `signin@YOUR-DOMAIN`). It is separate from `REMINDER_FROM_EMAIL`, which is a display-name form (`gridscore <reminders@…>`) that the SMTP `admin_email` field does not accept, and because sign-in and reminder mail reading as two senders is a feature: a player can filter reminders without losing sign-in links.

*Alternatives:* `enabled = "env(…)"` on the base block (env substitution is for string values; a boolean driven by env is undocumented, and a missing variable would still point local GoTrue at Resend); a second `config.toml` for production (two files drift, and the CLI reads one); setting SMTP in the dashboard by hand (not in the repo, so a new project is misconfigured until someone remembers).

*Verification before relying on it:* task 1 includes running `supabase config push` and reading the diff it prints before confirming. The push shows the SMTP and template fields it is about to change; if the remote override is not applied (no SMTP lines in the diff), fall back to placing the block at the top level and documenting that `supabase start` needs it commented out, and record that in this design.

### 2. Templates are generated from a shared TypeScript layout

`lib/email/layout.ts` exports `renderEmailShell(options)` returning the full HTML document. Inputs are the slots the current templates fill:

- `locale`: `"en" | "es" | "bilingual"`. Bilingual renders English then Spanish for every copy slot, exactly as the current templates do; a single locale renders one.
- `lang`: the `<html lang>` value (`en`, `es`; bilingual uses `en`).
- `kicker`, `heading`, `paragraphs[]`: the text block. Each copy slot is `{ en, es }`; the renderer picks or stacks by `locale`.
- `button`: `{ label: {en, es}, href }` or none (reauthentication shows a code, not a button).
- `code`: optional one-time code block (reauthentication).
- `linkFallback`: optional raw link shown under the button for clients that block buttons.
- `infoBox`: optional kicker + body rows (the "Your calls" box in the magic link).
- `sections[]`: optional pre-rendered HTML rows for mail that lists content (the reminder's per-weekend blocks).
- `footer`: `{ en, es }` note, and `footerLinks[]` for opt-out and settings.

All strings pass through `escapeHtml` except `sections[]`, which are built by callers who escape their own values (as `renderReminderEmail` does today) and `href`s, which are escaped as attributes. Supabase placeholders (`{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .SiteURL }}`) are passed through unescaped by a dedicated `raw()` marker, so the generator can put them where a URL or code belongs; nothing else can bypass escaping.

Visual constants (accent `#E14D28`, zinc greys, stripe widths, card radius) live in the layout as named constants with the comment that the accent is the app's `signal` token converted from oklch. Tables, inline styles, no web fonts, no images: the current rules, now enforced by having one place to break them.

`lib/email/templates.ts` describes the five Supabase emails as data (subject copy is in `config.toml`; the body copy here) and `scripts/gen-email-templates.mts` writes each through the layout to `supabase/templates/<name>.html` with the explanatory header comment. `pnpm gen:email-templates` is added to `package.json`. `tests/email-templates.test.ts` reads each committed file and asserts it equals the generated output, with the hint to run the script.

*Alternatives:* keep the templates hand-written and only lint them for shared markers (drift is detected, not prevented); React Email or MJML (new dependency and build step for five static files and one dynamic email; the hand-written table markup already works in the clients that matter); Supabase templates rendered by the app at request time (Supabase renders them, not the app).

### 3. The reminder email renders through the layout

`renderReminderEmail` keeps its signature, subject, plain-text body, headers and every current test. Its HTML becomes `renderEmailShell({ locale, lang: locale, kicker: "gridscore" strap, heading, paragraphs: [intro], sections: <per-weekend rows with their own button>, footer: why, footerLinks: [optOut, settings] })`. The per-weekend blocks keep their own accent button per weekend, rendered with a `renderButton` helper exported from the layout so the button is the same markup as the auth button. The test file gains assertions that the HTML contains the shell's wordmark block and the chequered edge, and still escapes names.

### 4. Brand check covers the templates

`tests/no-brand-literals.test.ts` adds `supabase/templates` to `SCAN_DIRS`. The generator is also covered by scanning `lib/`, which it already does; the templates test makes the generated output explicit.

### 5. Operator guide step 6 becomes a procedure

Replace the paragraph with: create the API key (sending access), verify the domain (SPF, DKIM, DMARC, the same step reminders need), choose the sender address, set `RESEND_API_KEY` and `SUPABASE_AUTH_SENDER_EMAIL` in `.env`, run `supabase config push` and read the diff, then verify by requesting a magic link and checking it arrives branded from the new sender. Note the 30/hour ceiling in `[auth.rate_limit] email_sent` and Resend's plan limit, and that `supabase config push` must be re-run after the key rotates.

## Risks / Trade-offs

- [`[remotes.production]` override is not applied by `config push` on this CLI version] → verified in task 1 by reading the push diff before confirming; fallback documented in decision 1. The CLI is also behind (2.95.4 vs 2.120.0); upgrading before the push is part of the task.
- [Regenerating the templates changes bytes even though the look is the same, making the first diff noisy] → the generator reproduces the current structure slot for slot; review the rendered output in Mailpit for each of the five flows (task 3) rather than the diff.
- [A missing `RESEND_API_KEY` or `SUPABASE_AUTH_SENDER_EMAIL` at push time writes an empty SMTP password or sender] → the guide states both are read from `.env` at push time; `supabase config push` prints the fields it changes, and an empty `pass` is visible there. The verification magic link catches the rest.
- [Resend rate limits auth mail when a burst of sign-ins arrives] → `email_sent = 30` per hour already governs; the guide names the ceiling and where to raise it.
- [Supabase placeholders get escaped and the link breaks] → the `raw()` marker is the only unescaped path and the templates test asserts each placeholder is present verbatim in the output.
- [Bilingual auth mail reads long] → unchanged from today; single-locale rendering is already in the layout for when Supabase gains per-user locale, or if the app later sends auth-adjacent mail itself.

## Migration Plan

1. Land the layout, generator, regenerated templates, reminder change and tests (no production effect; the config blocks stay inert until pushed).
2. Operator: set the two variables in `.env`, upgrade the CLI, run `supabase config push`, confirm the diff.
3. Verify: request a magic link on production; it arrives branded from the new sender. Check the Resend dashboard shows the send.
4. Rollback: comment the `[remotes.production.auth.email.smtp]` block and the template blocks, push again; Supabase returns to its built-in sender and default template within the same push.

## Open Questions

- None blocking. Whether to name the remote `production` or after the project ref is cosmetic; `production` is used so the guide reads naturally.
