# task-tracking Specification

## Purpose
A change's `tasks.md` is the truth about its work, and the panel edits that file in place when a task is ticked. This capability describes folding the task list out of the row (which also retargets an open change viewer), how the file is parsed, how far the panel will render it, and the compare-and-swap write that ticks a box without stepping on a concurrent edit.
## Requirements
### Requirement: Expand and collapse

Clicking a change's row SHALL fold out that change's task list, read from its `tasks.md` under `openspec/changes/<name>/`; clicking the row again SHALL fold it away. When a change viewer for the panel's repository and machine is registered, the click that folds a change's tasks out SHALL also ask the most recently opened viewer to switch to that change, without waiting for an acknowledgement, and SHALL never open a pane. Clicking the row that is already open, and clicking the change the viewer already shows, SHALL leave the viewer alone, and a viewer for another repository or machine SHALL NOT be switched. Opening one change SHALL collapse any pending archive confirmation, and a change that disappears from the list SHALL fold away on the next refresh.

#### Scenario: Fold out and away

- **WHEN** the user clicks a change's row and then clicks it again
- **THEN** the task list folds out on the first click and folds away on the second

#### Scenario: Fold out and switch the viewer

- **WHEN** a viewer for this repository and machine is open and the user clicks another change's row
- **THEN** that change's task list folds out and the viewer switches to that change

#### Scenario: No viewer open

- **WHEN** no change viewer is registered and the user clicks a change's row
- **THEN** the task list folds out and nothing else opens or switches

#### Scenario: No viewer answers a row click

- **WHEN** viewers are registered but all are in their acknowledgement cooldown and the user clicks another change's row
- **THEN** the task list folds out and no pane opens

#### Scenario: Clicking the open row again

- **WHEN** a row is already folded out and the user clicks it again
- **THEN** the task list folds away and the viewer keeps showing its current change

#### Scenario: Another repository's viewer

- **WHEN** the only registered viewer belongs to another repository or machine
- **THEN** clicking a row folds its tasks without switching that viewer

#### Scenario: Change archived or deleted elsewhere

- **WHEN** an expanded change is no longer in the list after a refresh
- **THEN** the panel folds it away without waiting for a click

### Requirement: Task list parsing

The panel SHALL parse `tasks.md` into flat rows in file order: markdown headings (1–6 `#`) become section rows, and `- [ ]` / `- [x]` checkbox lines (dash or asterisk bullets) become task rows that remember their line number in the file. Continuation lines of a wrapped task SHALL be dropped — a panel row is one file line.

#### Scenario: Sections and tasks

- **WHEN** `tasks.md` holds two `##` headings with checkboxes under each
- **THEN** the fold-out shows the headings as section rows and the checkboxes as task rows beneath them, in file order

#### Scenario: Wrapped task continuation

- **WHEN** a checkbox line is followed by an indented continuation line
- **THEN** the continuation line is not shown and the task row keeps the checkbox's own line number

### Requirement: Display cap

The fold-out SHALL show at most the first 120 rows; beyond that it SHALL show "+ N more in tasks.md" pointing at the file. Rows and section headings that do not fit their width SHALL truncate. Resting the pointer on a task row or section heading SHALL show a styled hover card in the panel's own colours and surface, carrying the row's full text wrapped over as many lines as it needs rather than a single clipped line, and the card SHALL name the row's state — done or open for a task, section for a heading. The card SHALL stay open while the pointer moves from the row onto it.

#### Scenario: Long list

- **WHEN** a change's `tasks.md` holds 150 rows
- **THEN** the fold-out shows the first 120 and a "+ 30 more in tasks.md" line

#### Scenario: Hover for the full text

- **WHEN** a task row is too long for the panel's width
- **THEN** it truncates to the row and resting the pointer on it shows a styled card with the whole line wrapped over multiple lines

#### Scenario: Card stays open while reading

- **WHEN** the pointer moves from a task row onto its open hover card
- **THEN** the card stays open and the full text remains readable

#### Scenario: Card names the task state

- **WHEN** the pointer rests on a done task and then on an open task
- **THEN** each card names that task's state, done or open

#### Scenario: Section heading card

- **WHEN** a section heading is too long for the panel's width
- **THEN** it truncates and resting the pointer on it shows the full heading in a card that names it as a section

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

### Requirement: Task list empty states

A change with no `tasks.md` SHALL show "No tasks.md" when expanded; a `tasks.md` with no headings or checkboxes SHALL show "No tasks yet".

#### Scenario: Missing file

- **WHEN** an expanded change has no `tasks.md`
- **THEN** the fold-out shows "No tasks.md"

#### Scenario: Empty file

- **WHEN** an expanded change's `tasks.md` holds no headings and no checkboxes
- **THEN** the fold-out shows "No tasks yet"

