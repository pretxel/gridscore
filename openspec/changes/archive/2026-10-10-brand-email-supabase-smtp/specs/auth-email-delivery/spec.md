## ADDED Requirements

### Requirement: Auth mail is sent through the app's own SMTP sender
Supabase Auth for the linked production project SHALL send email through Resend SMTP (`smtp.resend.com`, port 465, user `resend`, the Resend API key as password) from a sender address on the verified sending domain, with the sender name `gridscore`. The configuration SHALL live in `supabase/config.toml` and be applied with `supabase config push`; the API key and sender address SHALL be read from environment variables, never written in the file.

#### Scenario: Magic link arrives from the app's sender
- **WHEN** a player requests a magic link on the production site after the config has been pushed
- **THEN** the email arrives from `gridscore <SUPABASE_AUTH_SENDER_EMAIL>` and the send appears in the Resend dashboard

#### Scenario: Secrets stay out of the repo
- **WHEN** `supabase/config.toml` is read
- **THEN** the SMTP password and sender address appear only as `env(...)` references

### Requirement: Local development keeps the mail catcher
The SMTP sender SHALL apply only to the linked production project. `supabase start` SHALL continue to deliver every auth email to the local mail catcher.

#### Scenario: Local magic link lands in Mailpit
- **WHEN** a developer requests a magic link against the local stack
- **THEN** the email appears in Mailpit and no request reaches Resend

### Requirement: Branded templates are active
The five custom templates (magic link, confirmation, invite, email change, reauthentication) SHALL be enabled in `supabase/config.toml` with their subjects, and pushed together with the SMTP configuration, so that no auth flow uses Supabase's default template.

#### Scenario: Branded magic link in production
- **WHEN** a magic link is sent by the production project
- **THEN** its body is the generated branded template and its subject is the one set in `config.toml`

#### Scenario: Push reports the templates
- **WHEN** `supabase config push` runs against the linked project
- **THEN** the diff it prints includes the SMTP fields and the five template entries before asking for confirmation

### Requirement: Operator procedure and verification
The operator guide SHALL describe, in order: creating the Resend API key, verifying the domain, choosing the sender address, setting `RESEND_API_KEY` and `SUPABASE_AUTH_SENDER_EMAIL` for the CLI, pushing the config and reading its diff, and verifying by requesting a magic link. It SHALL state the hourly auth-mail ceiling (`[auth.rate_limit] email_sent`) and that the config must be pushed again when the key rotates.

#### Scenario: Fresh operator reaches branded mail
- **WHEN** an operator follows the guide on a project with no SMTP configured
- **THEN** the final step produces a branded magic link from the new sender, and every variable they needed was named in the guide

#### Scenario: Rollback
- **WHEN** the operator comments out the SMTP and template blocks and pushes again
- **THEN** the project returns to Supabase's built-in sender and default templates
