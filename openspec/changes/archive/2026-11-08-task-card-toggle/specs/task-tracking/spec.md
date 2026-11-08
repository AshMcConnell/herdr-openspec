## MODIFIED Requirements

### Requirement: Click to toggle

Clicking a task row SHALL flip that checkbox in `tasks.md` on the local machine only: the row flips at once (optimistically), the write replaces the file only if it still matches the copy the panel read (a compare-and-swap against the snapshot just read), and a rejected write SHALL re-read the file and retry once. A task's hover card SHALL offer the same flip as a button inside the card, on the local machine only: the button SHALL name the flip it performs, SHALL run the identical write path as a row click (one at a time, optimistic, compare-and-swap), and after the flip the card SHALL stay open and show the task's new state. Remote spaces SHALL be read-only — task rows there SHALL not respond to clicks, and their cards SHALL show no toggle button. Section heading cards SHALL show no toggle button.

#### Scenario: Tick a task

- **WHEN** the user clicks an open task in a local space
- **THEN** the row flips to done at once, the file's checkbox line is rewritten to `[x]` with every other byte identical, and the counts follow when the refreshed list is read back

#### Scenario: Tick from the card

- **WHEN** the user rests on an open task's hover card and presses its button
- **THEN** the task flips exactly once through the same write as a row click, and the open card names the task done with the button now offering to reopen it

#### Scenario: Reopen from the card

- **WHEN** the user presses the button in a done task's card
- **THEN** the task flips back to open and the open card names it open

#### Scenario: Concurrent edit wins

- **WHEN** another writer changed `tasks.md` between the panel's read and its write
- **THEN** the rejected write is retried once against the fresh file, never overwriting the concurrent edit blindly

#### Scenario: Remote space

- **WHEN** the change lives on a remote machine
- **THEN** its task rows show state but do not respond to clicks, and their cards carry no toggle button

#### Scenario: Section heading

- **WHEN** the user rests on a section heading's card
- **THEN** the card shows the heading with no toggle button
