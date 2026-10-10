## Why

Every email a player gets should look like it came from the same product, and today it does not. The five branded Supabase templates in `supabase/templates/` are wired up in `config.toml` but commented out, because the hosted free tier refuses custom templates until a custom SMTP sender exists; so a magic link in production still arrives as Supabase's unstyled default, from a rate-limited shared sender. The lock-reminder email, meanwhile, was built with its own simpler markup, so the one app email and the five auth emails share a colour and nothing else. Two shells drift the moment either is touched.

## What Changes

- **Auth mail goes out through Resend SMTP.** `config.toml` gains an `[auth.email.smtp]` block that points Supabase Auth at Resend, scoped to the linked production project so local development keeps using Mailpit. Credentials come from environment variables, never the file.
- **The branded templates switch on.** The five `[auth.email.template.*]` blocks (magic link, confirmation, invite, email change, reauthentication) are uncommented and pushed with `supabase config push`, so no auth flow falls back to the default template.
- **One email shell for the whole app.** A shared layout module in `lib/email/` renders the chequered edge, kerb stripe, wordmark, button and footer strap that the Supabase templates already use. It renders in one locale (for app mail, where the player's locale is known) or bilingually (for Supabase, which serves one template per project).
- **Supabase templates become generated output.** A script (`pnpm gen:email-templates`, like the existing `gen:*` scripts) renders the five templates from the shared layout into `supabase/templates/`, and a parity test fails when the committed files are stale. The look stays what it is today; the source of truth moves to one place.
- **The reminder email adopts the shell.** `renderReminderEmail` keeps its content, subject, plain-text body and unsubscribe headers, and renders its HTML through the shared layout instead of its own markup.
- **Operator steps get real.** The operator guide's SMTP step becomes concrete: which Resend values to set, which env vars the push reads, how to verify, and what the rate-limit ceiling means.

## Capabilities

### New Capabilities
- `branded-email`: the shared email shell (structure, locale modes, motifs, escaping rules), the generated Supabase templates and their parity with the shell, and the reminder email rendered through it.
- `auth-email-delivery`: Supabase Auth sending through a custom SMTP sender with the branded templates applied, scoped so local development is unaffected, configured from environment and pushed from the repo.

### Modified Capabilities
<!-- None: openspec/specs/ has no synced specs yet. The lock-reminders capability from improve-pick-flow keeps its requirements; only the reminder HTML's rendering path changes. -->

## Impact

- **Config**: `supabase/config.toml` (`[remotes.production]` with the SMTP block, uncommented template blocks); `.env.example` and `.env` gain the SMTP sender variables the push reads.
- **Code**: new `lib/email/layout.ts` (shared shell) and `lib/email/templates.ts` (the five Supabase bodies); `lib/reminders/email.ts` renders through the layout; new `scripts/gen-email-templates.mts` and a `gen:email-templates` script in `package.json`.
- **Generated files**: the five files in `supabase/templates/` are regenerated from the shell.
- **Tests**: `tests/reminder-email.test.ts` gains shell assertions; new `tests/email-templates.test.ts` (parity with the generator, placeholders present, no brand literals); `tests/no-brand-literals.test.ts` scans `supabase/templates`.
- **Docs**: `docs/operator-guide.md` step 6 (SMTP setup and verification), `docs/architecture.md` (email section).
- **External**: a Resend API key with sending access and a verified sending domain, already required for reminders; a `supabase config push` against the linked project.
