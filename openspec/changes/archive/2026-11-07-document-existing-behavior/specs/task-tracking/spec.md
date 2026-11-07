## ADDED Requirements

### Requirement: Expand and collapse

Clicking a change's row SHALL fold out that change's task list, read from its `tasks.md` under `openspec/changes/<name>/`; clicking the row again SHALL fold it away. Opening one change SHALL collapse any pending archive confirmation, and a change that disappears from the list SHALL fold away on the next refresh.

#### Scenario: Fold out and away

- **WHEN** the user clicks a change's row and then clicks it again
- **THEN** the task list folds out on the first click and folds away on the second

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

The fold-out SHALL show at most the first 120 rows; beyond that it SHALL show "+ N more in tasks.md" pointing at the file. Rows and section headings that do not fit their width SHALL truncate, and hovering one SHALL show its full text.

#### Scenario: Long list

- **WHEN** a change's `tasks.md` holds 150 rows
- **THEN** the fold-out shows the first 120 and a "+ 30 more in tasks.md" line

#### Scenario: Hover for the full text

- **WHEN** a task row is too long for the panel's width
- **THEN** it truncates to the row and hovering shows the whole line

### Requirement: Click to toggle

Clicking a task row SHALL flip that checkbox in `tasks.md` on the local machine only: the row flips at once (optimistically), the write replaces the file only if it still matches the copy the panel read (a compare-and-swap against the snapshot just read), and a rejected write SHALL re-read the file and retry once. Remote spaces SHALL be read-only — task rows there SHALL not respond to clicks.

#### Scenario: Tick a task

- **WHEN** the user clicks an open task in a local space
- **THEN** the row flips to done at once, the file's checkbox line is rewritten to `[x]` with every other byte identical, and the counts follow when the refreshed list is read back

#### Scenario: Concurrent edit wins

- **WHEN** another writer changed `tasks.md` between the panel's read and its write
- **THEN** the rejected write is retried once against the fresh file, never overwriting the concurrent edit blindly

#### Scenario: Remote space

- **WHEN** the change lives on a remote machine
- **THEN** its task rows show state but do not respond to clicks

### Requirement: Toggle failure reporting

When a toggle cannot be applied — the file is gone, the task's line no longer holds that task, or the write still fails after the retry — the panel SHALL show the file's real state and report the failure by toast. Toggles SHALL run one at a time; any click on a task SHALL be ignored while a toggle is in flight.

#### Scenario: Task changed under the click

- **WHEN** the clicked line no longer holds the clicked task when the write is attempted
- **THEN** the panel shows the file's current state and toasts that the task was not updated

#### Scenario: One at a time

- **WHEN** a write is still in flight and the user clicks another task
- **THEN** the second click is ignored until the first settles

### Requirement: Task list empty states

A change with no `tasks.md` SHALL show "No tasks.md" when expanded; a `tasks.md` with no headings or checkboxes SHALL show "No tasks yet".

#### Scenario: Missing file

- **WHEN** an expanded change has no `tasks.md`
- **THEN** the fold-out shows "No tasks.md"

#### Scenario: Empty file

- **WHEN** an expanded change's `tasks.md` holds no headings and no checkboxes
- **THEN** the fold-out shows "No tasks yet"
