## ADDED Requirements

### Requirement: Mark all done

The expanded task list SHALL offer a **Mark all N done** action in a small right-aligned header row above the task rows, where N counts every open task in the change's `tasks.md`, including rows past the 120-row display cap. The action SHALL be hidden when the change has no `tasks.md`, has no task rows, or has no open task. A first press SHALL arm it — the label becomes "Mark all N?" — and only a second press within ~6 seconds SHALL write; the arm SHALL lapse after that window, when the panel switches or folds the open change, when the change's task state changes under it, or when the change leaves the list, and the arm SHALL be kept apart from the row's pending archive confirmation. One press SHALL tick every open checkbox in a single write that leaves every already-done checkbox and every other byte of the file unchanged: on this machine one compare-and-swap of the whole file against the snapshot the panel read; on a remote machine one exact-text edit on that machine carrying one old/new pair per open line — each pair's old text checked to appear exactly once in the file before anything is written, and the edit all-or-none — followed by a re-read in which every changed line SHALL hold the ticked text. The write SHALL run under the same one-at-a-time rule as a task toggle: it SHALL NOT start while any task write is in flight, and task clicks and further presses SHALL be ignored while it runs, the action showing a spinner. Every open task row SHALL flip to done at once, optimistically, and the counts and progress bar SHALL follow when the refreshed list lands. A write that cannot land or verify SHALL re-read the file, show its real state and toast "Tasks not updated" with a reason.

#### Scenario: Mark all from the header

- **WHEN** the fold-out shows open tasks and the user presses **Mark all N done** then confirms
- **THEN** every open checkbox in `tasks.md` is ticked in one write, already-done checkboxes and every other byte unchanged, and the rows flip to done at once

#### Scenario: Past the display cap

- **WHEN** a change's `tasks.md` holds 150 rows with open tasks beyond the first 120
- **THEN** the action counts and ticks those beyond the cap too

#### Scenario: Two presses, one write

- **WHEN** the user presses the action once and again within ~6 seconds
- **THEN** the first press only arms the label "Mark all N?" and the second performs exactly one write, not one write per task

#### Scenario: The arm lapses

- **WHEN** the user arms the action and then waits past the window, clicks another change's row, folds the list away, ticks a task, or a refresh brings a changed `tasks.md`
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

- **WHEN** any task write — single toggle or mark-all — is in flight and the user clicks a task or presses the action
- **THEN** the press is ignored and the action shows a spinner

#### Scenario: Nothing to do

- **WHEN** the change has no `tasks.md`, no task rows, or every task done
- **THEN** the header row is not shown
