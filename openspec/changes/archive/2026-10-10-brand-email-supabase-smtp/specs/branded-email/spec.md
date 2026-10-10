## ADDED Requirements

### Requirement: One shell for every email
The system SHALL render every email it produces, whether sent by Supabase Auth or by the app, through a single shared layout that carries the brand motifs: the chequered top edge, the wordmark block, the accent button with its kerb stripe, the footer note and the strap line. The layout MUST use table-based markup with inline styles only, no web fonts and no images, so it renders in clients that block remote content.

#### Scenario: Auth email uses the shell
- **WHEN** any of the five Supabase templates (magic link, confirmation, invite, email change, reauthentication) is rendered
- **THEN** its HTML contains the chequered edge, the wordmark block and the footer strap produced by the shared layout

#### Scenario: Reminder email uses the shell
- **WHEN** the lock-reminder email is rendered for a player
- **THEN** its HTML contains the same chequered edge and wordmark block, and each weekend's call-to-action is the layout's accent button

#### Scenario: No remote resources
- **WHEN** any email is rendered through the layout
- **THEN** the HTML contains no `<img>`, `<link>` or `@import` and no `url(` reference

### Requirement: Locale modes
The layout SHALL render each copy slot either in one locale or bilingually. In bilingual mode, short labels (kicker, button, info-box kicker) SHALL read "English · Spanish" on one line, running copy (paragraphs, footer notes, the link fallback) SHALL stack English then Spanish, and display text (the headline, info-box lines, the strap) SHALL show English only, with the `lang` attribute set to `en`. In single-locale mode only that locale's text SHALL appear and the `lang` attribute SHALL match it.

#### Scenario: Supabase templates are bilingual
- **WHEN** a Supabase template is generated
- **THEN** labels and running copy carry English and then Spanish, because Supabase serves one template per project, and the headline is English

#### Scenario: Reminder email is single-locale
- **WHEN** the reminder email is rendered for a player whose locale is `es`
- **THEN** the HTML carries `lang="es"` and contains only the Spanish copy

### Requirement: Escaping with an explicit raw path
The layout SHALL HTML-escape every text slot and attribute value it receives. Supabase template placeholders (`{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .SiteURL }}`) SHALL pass through unescaped only when wrapped in the layout's explicit raw marker. Pre-rendered section rows supplied by a caller are the caller's responsibility to escape.

#### Scenario: Player-supplied text is escaped
- **WHEN** a Grand Prix name containing `<b>GP</b>` reaches the reminder email
- **THEN** the HTML contains `&lt;b&gt;GP&lt;/b&gt;` and no `<b>` element

#### Scenario: Placeholders survive verbatim
- **WHEN** the magic-link template is generated
- **THEN** `{{ .ConfirmationURL }}` appears verbatim in both the button `href` and the fallback link text

### Requirement: Supabase templates are generated and checked
The five files in `supabase/templates/` SHALL be produced by `pnpm gen:email-templates` from the shared layout. A test SHALL fail when a committed template differs from the generator's output, naming the command to run. Each generated template SHALL contain the placeholders its flow needs: `{{ .ConfirmationURL }}` for magic link, confirmation, invite and email change; `{{ .Token }}` for reauthentication; `{{ .NewEmail }}` for email change.

#### Scenario: Stale template fails the suite
- **WHEN** the layout changes and the templates are not regenerated
- **THEN** the templates test fails and its message says to run `pnpm gen:email-templates`

#### Scenario: Required placeholders present
- **WHEN** the templates are generated
- **THEN** each file contains every placeholder listed for its flow

### Requirement: Reminder content is unchanged
Rendering the reminder email through the layout SHALL NOT change its subject, plain-text body, market ordering, time-zone handling, opt-out link, or the `List-Unsubscribe` and `List-Unsubscribe-Post` headers.

#### Scenario: Existing reminder expectations hold
- **WHEN** the reminder email tests that predate this change run
- **THEN** they pass without modification

### Requirement: Brand guard covers email
The brand-literal test SHALL scan `supabase/templates/` in addition to the product directories it already covers.

#### Scenario: Brand name in a template
- **WHEN** a generated template contains a forbidden championship brand literal
- **THEN** the brand-literal test fails for that file
