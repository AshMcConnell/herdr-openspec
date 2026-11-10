## MODIFIED Requirements

### Requirement: Expand and collapse

Clicking a change's row SHALL fold out that change's task list, read from its own worktree's `tasks.md` under `openspec/changes/<name>/`; clicking the row again SHALL fold it away. At most one change SHALL be expanded across every worktree section, identified by its worktree and name. When a change viewer for the row's worktree and machine is registered, the click that folds a change's tasks out SHALL also ask the most recently opened viewer to switch to that change, without waiting for an acknowledgement, and SHALL never open a pane. Clicking the row that is already open, and clicking the change the viewer already shows, SHALL leave the viewer alone, and a viewer for another worktree or machine SHALL NOT be switched. Opening one change SHALL collapse any pending archive confirmation, and a change that disappears from its worktree's list SHALL fold away on the next refresh.

#### Scenario: Fold out and away

- **WHEN** the user clicks a change's row and then clicks it again
- **THEN** the task list folds out on the first click and folds away on the second

#### Scenario: Fold out in a linked worktree

- **WHEN** the user clicks a row in the `col-27` section
- **THEN** the fold-out shows `col-27/openspec/changes/<name>/tasks.md`

#### Scenario: One row open across sections

- **WHEN** a `col-27` row is expanded and the user clicks another change's row in another section
- **THEN** that row's tasks replace the fold-out and the first row collapses

#### Scenario: Fold out and switch the viewer

- **WHEN** a viewer for the row's worktree and machine is open and the user clicks another change's row there
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

#### Scenario: Another worktree's viewer

- **WHEN** the only registered viewer belongs to another worktree or machine
- **THEN** clicking a row folds its tasks without switching that viewer

#### Scenario: Change archived or deleted elsewhere

- **WHEN** an expanded change is no longer in its worktree's list after a refresh
- **THEN** the panel folds it away without waiting for a click

### Requirement: Click to toggle

Clicking a task row SHALL flip that checkbox in the clicked row's `tasks.md`, under that row's worktree root, in the pane's space — this machine, or the remote machine the pane follows. The row flips at once (optimistically). On this machine the write replaces the file only if it still matches the copy the panel read (a compare-and-swap against the snapshot just read). On a remote machine the panel SHALL replace the clicked line's exact text through herdr-core's exact-text edit on that machine (`file edit` with the line's exact bytes as the old text and the flipped line as the new): the old/new pair SHALL be built from the copy the panel last read, matching exactly one place in the file, and the toggle SHALL be refused without writing when it does not. When the line already holds the asked state, the panel SHALL accept the file as it stands without running an edit. After the remote edit the panel SHALL re-read the file and check that the clicked line holds the flipped text before accepting the toggle. A rejected write, a refused edit or a verification that does not pass SHALL re-read the file and retry once. A toggle SHALL only ever write the file in the clicked row's worktree; a same-named change in another worktree SHALL NOT be touched.

#### Scenario: Tick a task

- **WHEN** the user clicks an open task in a local space
- **THEN** the row flips to done at once, the file's checkbox line is rewritten to `[x]` with every other byte identical, and the counts follow when the refreshed list is read back

#### Scenario: Tick a task in a linked worktree

- **WHEN** the user clicks an open task under the `col-27` section
- **THEN** `col-27`'s `tasks.md` is the file written, and the own worktree's copy stays as it was

#### Scenario: Tick a remote task

- **WHEN** the user clicks an open task in a remote space
- **THEN** the row flips to done at once, exactly that checkbox line is rewritten in its worktree on the machine through the CLI's exact-text edit and verified against a re-read, and the counts follow when the refreshed list is read back

#### Scenario: Concurrent edit wins

- **WHEN** another writer changed `tasks.md` between the panel's read and its write
- **THEN** the rejected write is retried once against the fresh file, never overwriting the concurrent edit blindly

#### Scenario: Ambiguous remote line

- **WHEN** the clicked task's line text matches more than one place in the remote file
- **THEN** the panel refuses the toggle without writing, shows the file's real state and toasts that the task was not updated

#### Scenario: Remote flip that does not verify

- **WHEN** the re-read after a remote edit does not show the clicked line holding the flipped text
- **THEN** the panel shows the file's real state and toasts that the task was not updated

### Requirement: Mark all done

The expanded task list SHALL offer a **Mark all N done** action in a small right-aligned header row above the task rows, where N counts every open task in the expanded row's worktree `tasks.md`, including rows past the 120-row display cap. The action SHALL be hidden when the change has no `tasks.md`, has no task rows, or has no open task. A first press SHALL arm it — the label becomes "Mark all N?" — and only a second press within ~6 seconds SHALL write; the arm SHALL lapse after that window, when the panel switches or folds the open change, when the change's task state changes under it, or when the change leaves the list, and the arm SHALL be kept apart from the row's pending archive confirmation. One press SHALL tick every open checkbox in a single write that leaves every already-done checkbox and every other byte of the file unchanged: on this machine one compare-and-swap of the whole file against the snapshot the panel read; on a remote machine one exact-text edit on that machine carrying one old/new pair per open line — each pair's old text checked to appear exactly once in the file before anything is written, and the edit all-or-none — followed by a re-read in which every changed line SHALL hold the ticked text. The write SHALL run under the same one-at-a-time rule as a task toggle: it SHALL NOT start while any task write is in flight, and task clicks and further presses SHALL be ignored while it runs, the action showing a spinner. Every open task row SHALL flip to done at once, optimistically, and the counts and progress bar SHALL follow when the refreshed list lands. A write that cannot land or verify SHALL re-read the file, show its real state and toast "Tasks not updated" with a reason. A mark-all SHALL only ever write the open row's worktree; a same-named change in another worktree SHALL keep its own tasks.

#### Scenario: Mark all from the header

- **WHEN** the fold-out shows open tasks and the user presses **Mark all N done** then confirms
- **THEN** every open checkbox in that worktree's `tasks.md` is ticked in one write, already-done checkboxes and every other byte unchanged, and the rows flip to done at once

#### Scenario: A same-named change elsewhere

- **WHEN** the expanded `col-27` change is also present in the own worktree and the user marks all done
- **THEN** only `col-27`'s `tasks.md` is written, and the own worktree's counts stay as they were

#### Scenario: Past the display cap

- **WHEN** a change's `tasks.md` holds 150 rows with open tasks beyond the first 120
- **THEN** the action counts and ticks those beyond the cap too

#### Scenario: Two presses, one write

- **WHEN** the user presses the action once and again within ~6 seconds
- **THEN** the first press only arms the label "Mark all N?" and the second performs exactly one write, not one write per task

#### Scenario: The arm lapses

- **WHEN** the user arms the action and then waits past the window, clicks another change's row in any section, folds the list away, ticks a task, or a refresh brings a changed `tasks.md`
- **THEN** the arm is withdrawn without writing

#### Scenario: One remote edit, all or none

- **WHEN** the change lives on a remote machine
- **THEN** one `file edit` on that machine carries every open line's old/new pair, and either every line is ticked or none is

#### Scenario: An ambiguous line fails first

- **WHEN** an open task's line appears more than once in `tasks.md`
- **THEN** the mark-all refuses before writing anything, shows the file's real state and toasts "Tasks not updated"

#### Scenario: A write that does not verify

- **WHEN** the re-read after the write leaves any changed line without the ticked text
- **THEN** the panel shows the file's real state and toasts "Tasks not updated"

#### Scenario: One at a time

- **WHEN** any task write — single toggle or mark-all, in any worktree — is in flight and the user clicks a task or presses the action
- **THEN** the press is ignored and the action shows a spinner

#### Scenario: Nothing to do

- **WHEN** the change has no `tasks.md`, no task rows, or every task done
- **THEN** the header row is not shown
