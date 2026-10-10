# pick-progress Specification

## Purpose
TBD - created by archiving change improve-pick-flow. Update Purpose after archive.
## Requirements
### Requirement: Weekend page shows calls made
For a signed-in player, the Grand Prix page header SHALL show how many of the weekend's markets the player has called out of the markets they could call, as "N/M" with a progress meter. Void markets SHALL NOT count. The count SHALL update as soon as a call is saved, without reloading the page.

#### Scenario: Partly called weekend
- **WHEN** a signed-in player has called 4 of the weekend's 6 markets
- **THEN** the header shows "4/6" with the meter filled to two thirds

#### Scenario: Count follows a save
- **WHEN** the player saves a fifth call on that page
- **THEN** the header shows "5/6" without a reload

#### Scenario: Void market excluded
- **WHEN** one of six markets is void
- **THEN** the total is 5

#### Scenario: Signed-out visitor
- **WHEN** a signed-out visitor opens the page
- **THEN** no calls-made count is shown

### Requirement: Urgent unpicked markets stand out
A market that is open, has no call from the signed-in player, and locks within 24 hours SHALL be marked as urgent on its card. A market that is called, locked, or more than 24 hours from locking SHALL NOT be marked urgent.

#### Scenario: Empty market locking tomorrow morning
- **WHEN** the qualifying-locked markets lock in 20 hours and the player has not called pole
- **THEN** the pole card is marked urgent

#### Scenario: Called market is never urgent
- **WHEN** the player has called pole and it locks in 1 hour
- **THEN** the pole card is not marked urgent

#### Scenario: Urgency clears on save
- **WHEN** the player saves a call on an urgent card
- **THEN** the urgent marking disappears without a reload

### Requirement: Calendar cards show calls made
On the calendar, each upcoming or live Grand Prix card SHALL show the signed-in player's calls made out of callable markets as a compact "N/M" meter, and SHALL be marked urgent when any of its markets would be urgent under the rule above. Completed and cancelled weekends SHALL NOT show the meter. Signed-out visitors SHALL keep seeing how many calls are open.

#### Scenario: Upcoming weekend partly called
- **WHEN** a signed-in player has called 2 of 6 markets for the next weekend
- **THEN** its calendar card shows "2/6"

#### Scenario: Calendar urgency
- **WHEN** that weekend has an uncalled market locking in 3 hours
- **THEN** its calendar card is marked urgent

#### Scenario: Fully called
- **WHEN** the player has called every callable market
- **THEN** the card shows the full meter and is not marked urgent

