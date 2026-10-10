## ADDED Requirements

### Requirement: A call saves when it is made
The system SHALL save a signed-in player's call for an open market as soon as the selection forms a complete pick, without a separate Save action. A driver market or first retirement SHALL save on selecting a driver (or "none"); safety car SHALL save on choosing Yes or No; the podium SHALL save once P1, P2 and P3 hold three distinct drivers. Every save SHALL go through the existing pick action, so the database lock still decides whether it is accepted.

#### Scenario: Driver market saves on selection
- **WHEN** a signed-in player taps a driver on the open pole market
- **THEN** the call is saved without pressing any button
- **AND** the card shows it as saved

#### Scenario: Podium waits for three places
- **WHEN** a player has filled P1 and P2 of the podium but not P3
- **THEN** nothing is saved yet
- **AND** the card says the podium needs a third driver

#### Scenario: Podium saves when complete
- **WHEN** the player fills P3 with a driver not already in P1 or P2
- **THEN** the podium call is saved

#### Scenario: Changing a call saves the new one
- **WHEN** a player with a saved pole call taps a different driver before the market locks
- **THEN** the new driver replaces the saved call

#### Scenario: Selection matching the saved call does not save again
- **WHEN** a player's selection becomes identical to the call already saved
- **THEN** no save request is sent

### Requirement: Each card shows its save state
Each open market card SHALL show one of: not yet called, saving, saved, or failed. A failed save SHALL show the reason and a retry control, and SHALL keep the player's selection on screen.

#### Scenario: Save in flight
- **WHEN** a save request is pending
- **THEN** the card shows a saving indicator

#### Scenario: Save fails
- **WHEN** the save is rejected or the request fails
- **THEN** the card shows the localized error and a retry control
- **AND** the selection the player made is still shown

#### Scenario: Retry succeeds
- **WHEN** the player presses retry and the save is accepted
- **THEN** the card shows the call as saved

#### Scenario: Market locked before the save landed
- **WHEN** a save is refused because the market has locked
- **THEN** the card switches to its locked state showing the last call that was actually saved

### Requirement: Rapid changes save the last selection
When a player changes the selection of a market several times while an earlier save is still in flight, the system SHALL end with the last selection saved, and SHALL NOT let an earlier response overwrite the state of a later one.

#### Scenario: Two quick taps
- **WHEN** a player taps driver A then driver B on the same market before A's save returns
- **THEN** the saved call ends as driver B
- **AND** the card shows B as saved

### Requirement: Leaving with unsaved work asks first
While any market on the page has a save in flight, a failed save, or a previously saved podium left incomplete, the system SHALL ask for confirmation before the player reloads, closes the tab, or follows an in-app link away from the page. When nothing is pending the system SHALL NOT ask.

#### Scenario: Leaving with a failed save
- **WHEN** a card shows a failed save and the player follows a link to the leaderboard
- **THEN** the system asks the player to confirm leaving

#### Scenario: Leaving with everything saved
- **WHEN** every change on the page is saved and the player leaves
- **THEN** the system does not ask for confirmation

#### Scenario: Incomplete podium after a saved one
- **WHEN** a player with a saved podium clears P2 and tries to close the tab
- **THEN** the browser asks for confirmation
- **AND** the saved podium in the database is unchanged
