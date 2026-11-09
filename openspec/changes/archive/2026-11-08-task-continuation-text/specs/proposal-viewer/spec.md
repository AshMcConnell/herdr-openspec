## MODIFIED Requirements

### Requirement: Task tab

The tasks tab SHALL render the change's `tasks.md` as a themed checklist built from the mod's task parser — section headings in the muted colour, ✓ in green for a done task, ○ in the faint colour for an open one, each task's whole entry shown in full (continuation lines folded into their entry as the parser does), not truncated to the row width and with no row cap (the panel's capped folded-out list is what the viewer lifts). On a local pane, clicking a task SHALL flip that checkbox line in the change's `tasks.md` with the panel's compare-and-swap write: the flip is optimistic, a stale snapshot is re-read and retried once, only one toggle runs at a time, and a failure reports by error toast naming the reason. Remote panes SHALL show the same checklist read-only.

#### Scenario: Tick from the viewer

- **WHEN** the user clicks an open task on a local pane's tasks tab
- **THEN** the row flips at once and that line's checkbox is written to `tasks.md`

#### Scenario: A concurrent edit

- **WHEN** another writer changed `tasks.md` between the viewer's read and its write
- **THEN** the viewer re-reads, retries once, and keeps the file's real state — reporting by toast when the task no longer matches

#### Scenario: Remote read-only

- **WHEN** the user clicks a task on a remote pane's tasks tab
- **THEN** the checklist renders but a click writes nothing

#### Scenario: A multi-line task entry

- **WHEN** a task in `tasks.md` has indented continuation lines
- **THEN** the tasks tab shows the whole entry as one checklist row, the same folded text the panel shows
