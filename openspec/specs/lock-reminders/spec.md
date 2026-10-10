# lock-reminders Specification

## Purpose
TBD - created by archiving change improve-pick-flow. Update Purpose after archive.
## Requirements
### Requirement: Players choose their reminder lead time
Each player SHALL have a reminder preference of 24 hours, 2 hours, or off, defaulting to 24 hours. A signed-in player SHALL be able to change it on a settings page reachable from the user menu. Only the player SHALL be able to read or change their own preference.

#### Scenario: New player default
- **WHEN** a player signs up
- **THEN** their reminder preference is 24 hours

#### Scenario: Changing the preference
- **WHEN** a player selects "2 hours before" on the settings page and saves
- **THEN** later reminders use a 2-hour lead time

#### Scenario: Another user's preference
- **WHEN** a player tries to change another player's reminder preference
- **THEN** the change is refused

### Requirement: Hourly reminder job
An authorized job SHALL run every hour. For each player whose preference is not off, it SHALL find the open markets of the active season that the player has not called and that lock within the player's lead time. When there is at least one, it SHALL send the player one email listing all of them. The job SHALL be protected by the same cron authorization as the existing jobs, SHALL be switchable off from the operations page, and SHALL record each run.

#### Scenario: Player missing two calls
- **WHEN** the job runs and a player on 24 hours has not called pole or sprint winner, both locking in 20 hours
- **THEN** that player receives one email listing both markets

#### Scenario: Nothing missing
- **WHEN** a player has called every market locking within their lead time
- **THEN** that player receives no email

#### Scenario: Preference off
- **WHEN** a player's preference is off
- **THEN** that player receives no email

#### Scenario: Admins are not reminded
- **WHEN** the job runs
- **THEN** admin accounts, which cannot make calls, receive no email

#### Scenario: Job disabled
- **WHEN** an admin has disabled the reminder job
- **THEN** a run sends nothing and is reported as skipped

#### Scenario: Unauthorized call
- **WHEN** the reminder route is called without the cron secret
- **THEN** it is refused and nothing is sent

### Requirement: A market is reminded at most once per player
The system SHALL record every market included in a sent reminder, per player, and SHALL NOT include that market in any later reminder to the same player. A market SHALL only be recorded once the email has been accepted by the provider.

#### Scenario: Consecutive runs
- **WHEN** a player was reminded about pole at 10:00 and still has not called it at 11:00
- **THEN** the 11:00 run does not email about pole again

#### Scenario: New market enters the window
- **WHEN** at 11:00 the race-locked markets enter the player's window and are uncalled
- **THEN** the 11:00 email lists only those markets

#### Scenario: Provider failure
- **WHEN** the email provider rejects a send
- **THEN** no market is recorded as reminded for that player
- **AND** the next run tries again while the market is still open

### Requirement: Reminder email content
The reminder email SHALL be written in the player's locale (English or Spanish, falling back to English), SHALL list each missing market with its lock time in the player's timezone (falling back to UTC), SHALL link to the Grand Prix page, and SHALL contain a one-click link that turns reminders off. It SHALL NOT use championship branding.

#### Scenario: Spanish player in Madrid
- **WHEN** a Spanish-locale player with timezone Europe/Madrid is reminded
- **THEN** the email is in Spanish and shows lock times in Madrid time

#### Scenario: Email links to the weekend
- **WHEN** the player opens the link in the email
- **THEN** they land on that Grand Prix page

### Requirement: One-click opt-out
The opt-out link SHALL let the player turn reminders off without requiring sign-in, using a signed token that identifies the player. Opening the link SHALL NOT by itself change anything, because mail security scanners open every link; one confirming click SHALL. A mail client's one-click unsubscribe (an RFC 8058 POST) SHALL turn reminders off directly. A tampered or malformed token SHALL be refused without changing any preference.

#### Scenario: Opting out from the email
- **WHEN** a player opens the opt-out link from a reminder and confirms
- **THEN** their preference becomes off
- **AND** a page confirms it and links to settings to turn reminders back on

#### Scenario: Link scanner opens the link
- **WHEN** a mail scanner fetches the opt-out link without confirming
- **THEN** the preference is unchanged

#### Scenario: One-click unsubscribe from the mail client
- **WHEN** the mail client POSTs to the List-Unsubscribe URL with a valid token
- **THEN** the preference becomes off

#### Scenario: Tampered link
- **WHEN** the token in an opt-out link has been altered
- **THEN** no preference changes and an error page is shown

