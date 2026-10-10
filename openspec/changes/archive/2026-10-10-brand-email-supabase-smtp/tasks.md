## 1. Supabase config: SMTP sender and templates

- [x] 1.1 Add `SUPABASE_AUTH_SENDER_EMAIL` to `.env.example` (CLI section, with the bare-address note and why it differs from `REMINDER_FROM_EMAIL`) and to the local `.env`
- [x] 1.2 Add `[remotes.production]` with the linked `project_id` and `[remotes.production.auth.email.smtp]` (Resend host, port 465, user `resend`, `pass = "env(RESEND_API_KEY)"`, `admin_email = "env(SUPABASE_AUTH_SENDER_EMAIL)"`, `sender_name = "gridscore"`) to `supabase/config.toml`; leave the base `[auth.email.smtp]` absent so `supabase start` keeps Mailpit
- [x] 1.3 Uncomment the five `[auth.email.template.*]` blocks; drop the duplicate default `invite` and `password_changed` stubs; rewrite the comment above them to describe the generated templates and the push
- [x] 1.4 Run `supabase start` (or restart) and confirm a local magic link still lands in Mailpit with the branded template
- [x] 1.5 Upgrade the Supabase CLI, run `supabase config push`, and read the diff: confirm the SMTP fields and the five templates appear for the linked project before confirming. If the remote override is not applied, move the SMTP block to the top level, document the local caveat, and update design.md decision 1
  - Done 2026-10-09 on CLI v2.95.4 (not upgraded): the remote override applied, so the SMTP block stays in `[remotes.production]`.

## 2. Shared email layout

- [x] 2.1 Create `lib/email/layout.ts`: `renderEmailShell(options)` with the slots from design decision 2 (locale mode, kicker, heading, paragraphs, button, code, linkFallback, infoBox, sections, footer, footerLinks), named visual constants, `escapeHtml`, the `raw()` marker, and an exported `renderButton` helper
- [x] 2.2 Unit tests in `tests/email-layout.test.ts`: bilingual stacks en then es with `lang="en"`; single locale renders one language with matching `lang`; text and attributes are escaped; `raw()` passes through; output contains no `<img>`, `<link>`, `@import` or `url(`
- [x] 2.3 Confirm `lib/email/layout.ts` is free of brand literals (`pnpm test tests/no-brand-literals.test.ts`)

## 3. Generated Supabase templates

- [x] 3.1 Create `lib/email/templates.ts` describing the five Supabase emails as data (copy for each slot in en and es, placeholders via `raw()`, the header comment text) and an exported `renderSupabaseTemplate(name)`
- [x] 3.2 Create `scripts/gen-email-templates.mts` that writes each template to `supabase/templates/<name>.html`; add `"gen:email-templates"` to `package.json` scripts
- [x] 3.3 Run the generator and review each of the five files against the current ones for lost slots (info box, fallback link, code block, old/new address in email change); fix the data until the rendered output matches the existing look
- [x] 3.4 Create `tests/email-templates.test.ts`: each committed file equals the generated output (hint names the command); each file contains its required placeholders verbatim; each contains the shell markers
- [x] 3.5 Add `supabase/templates` to `SCAN_DIRS` in `tests/no-brand-literals.test.ts` and confirm the suite passes
- [x] 3.6 Send each of the five flows locally (done for four; sign-up confirmation cannot fire locally with `enable_confirmations = false`, covered by the render tests)  
  Original: Send each of the five flows locally (magic link, sign-up confirmation, invite via admin, email change, reauthentication) and view them in Mailpit; fix rendering issues at the layout, then regenerate

## 4. Reminder email on the shell

- [x] 4.1 Change `renderReminderEmail` in `lib/reminders/email.ts` to build its HTML through `renderEmailShell` (single locale, per-weekend rows as `sections`, buttons via `renderButton`, opt-out and settings as `footerLinks`); keep subject, text body and headers untouched
- [x] 4.2 Extend `tests/reminder-email.test.ts` with shell assertions (wordmark block, chequered edge, `lang` per locale) and keep every existing assertion unchanged and passing
- [x] 4.3 Render one reminder locally (the cron route against the local stack, or a one-off script in the scratchpad) and check it in Mailpit or the Resend test inbox

## 5. Docs

- [x] 5.1 Rewrite operator guide step 6 as the procedure in design decision 5: API key, domain verification, sender address, the two env vars, `supabase config push` and its diff, verification by magic link, the 30/hour ceiling, re-push on key rotation, rollback
- [x] 5.2 Update the "Reminders stopped" / `missing-env` troubleshooting lines in `docs/operator-guide.md` and the email paragraph in `docs/architecture.md` to describe the shared layout and generated templates
- [x] 5.3 Note `pnpm gen:email-templates` in `docs/contributing.md` next to the other generators

## 6. Verification

- [x] 6.1 `pnpm test`, `pnpm typecheck`, and `node_modules/.bin/biome check` pass
- [x] 6.2 Production check after the push: request a magic link on the deployed site; it arrives branded, from `gridscore <SUPABASE_AUTH_SENDER_EMAIL>`, and the send shows in the Resend dashboard
  - Done 2026-10-10: "Your gridscore sign-in link" from `"gridscore" <no-reply@edselserrano.com>` delivered at 10:38 UTC, shown in Resend.
