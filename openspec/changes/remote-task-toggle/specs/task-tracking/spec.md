## MODIFIED Requirements

### Requirement: Click to toggle

Clicking a task row SHALL flip that checkbox in `tasks.md` in the pane's space — this machine, or the remote machine the pane follows. The row flips at once (optimistically). On this machine the write replaces the file only if it still matches the copy the panel read (a compare-and-swap against the snapshot just read). On a remote machine the panel SHALL replace the clicked line's exact text through herdr-core's exact-text edit on that machine (`file edit` with the line's exact bytes as the old text and the flipped line as the new): the old/new pair SHALL be built from the copy the panel last read, matching exactly one place in the file, and the toggle SHALL be refused without writing when it does not. When the line already holds the asked state, the panel SHALL accept the file as it stands without running an edit. After the remote edit the panel SHALL re-read the file and check that the clicked line holds the flipped text before accepting the toggle. A rejected write, a refused edit or a verification that does not pass SHALL re-read the file and retry once. A task's hover card SHALL offer the same flip as a button inside the card, in every space: the button SHALL name the flip it performs, SHALL run the identical write path as a row click (one at a time, optimistic, guarded), and after the flip the card SHALL stay open and show the task's new state. Section heading cards SHALL show no toggle button.

#### Scenario: Tick a task

- **WHEN** the user clicks an open task in a local space
- **THEN** the row flips to done at once, the file's checkbox line is rewritten to `[x]` with every other byte identical, and the counts follow when the refreshed list is read back

#### Scenario: Tick a remote task

- **WHEN** the user clicks an open task in a remote space
- **THEN** the row flips to done at once, exactly that checkbox line is rewritten on the machine through the CLI's exact-text edit and verified against a re-read, and the counts follow when the refreshed list is read back

#### Scenario: Tick from the card

- **WHEN** the user rests on an open task's hover card and presses its button
- **THEN** the task flips exactly once through the same write as a row click, and the open card names the task done with the button now offering to reopen it

#### Scenario: Reopen from the card

- **WHEN** the user presses the button in a done task's card
- **THEN** the task flips back to open and the open card names it open

#### Scenario: Concurrent edit wins

- **WHEN** another writer changed `tasks.md` between the panel's read and its write
- **THEN** the rejected write is retried once against the fresh file, never overwriting the concurrent edit blindly

#### Scenario: Ambiguous remote line

- **WHEN** the clicked task's line text matches more than one place in the remote file
- **THEN** the panel refuses the toggle without writing, shows the file's real state and toasts that the task was not updated

#### Scenario: Remote flip that does not verify

- **WHEN** the re-read after a remote edit does not show the clicked line holding the flipped text
- **THEN** the panel shows the file's real state and toasts that the task was not updated

#### Scenario: Section heading

- **WHEN** the user rests on a section heading's card
- **THEN** the card shows the heading with no toggle button

### Requirement: Toggle failure reporting

When a toggle cannot be applied — the file is gone, the task's line no longer holds that task, the local write still fails after the retry, or the remote edit or its verification still fails after the retry — the panel SHALL show the file's real state and report the failure by toast. Toggles SHALL run one at a time across every space and route; any click on a task SHALL be ignored while a toggle is in flight.

#### Scenario: Task changed under the click

- **WHEN** the clicked line no longer holds the clicked task when the write is attempted
- **THEN** the panel shows the file's current state and toasts that the task was not updated

#### Scenario: One at a time

- **WHEN** a toggle is still in flight — local or remote — and the user clicks another task
- **THEN** the second click is ignored until the first settles
