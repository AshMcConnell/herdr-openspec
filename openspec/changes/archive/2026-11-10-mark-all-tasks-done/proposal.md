## Why

Ticking a long `tasks.md` one row at a time is the panel's biggest click cost: a 60-task change means 60 clicks, and rows past the 120-row display cap can't be ticked from the panel at all (README Limits already says "Only the tasks shown can be ticked"). The panel already owns every ingredient: the parsed task rows (`taskRows`), the file snapshot (`this.tasksText`), the single-task write paths (`writeFlip`'s local compare-and-swap and the remote `herdr-core file edit`), and the two-click confirmation pattern (the archive chip's `confirming`/`confirmUntil`). One bulk action closes the gap.

## What Changes

- A **Mark all N done** action in a small right-aligned header row at the top of the expanded task list, N counting **every** open checkbox in `tasks.md`, past the 120-row cap included; already-done tasks (`[x]` and `[X]`) are left as they are.
- Two-click confirmation: the first press arms it as **Mark all N?**, a second press within ~6 seconds writes, and the arm lapses on timeout or when the panel changes the open change/task state — separate `marking`/`markUntil` state, so it never collides with the archive chip's confirmation.
- One write, not N clicks: locally one `writeTextFile(path, next, body)` compare-and-swap of the whole file against the read snapshot; remotely ONE `herdr-core file edit` with one repeated `--old=`/`--new=` pair per open line (repeatable, all-or-none per its `--help`), each old line pre-checked unique so an ambiguous line fails before anything is written, then a re-read verifying every changed line holds the ticked text.
- Joins the existing one-at-a-time guard (`this.toggling`), so a mark-all cannot race a task click and vice versa.
- Optimistic UI: every task row in `this.tasks` flips to done at once, and the counts and progress bar follow when the refreshed `openspec list` lands.
- On failure, re-read the file, show its real state, and toast "Tasks not updated" with a reason.
- Hidden when `tasks.md` is absent, when there are no task rows, or when every task is done; spinner and refused presses while any task write is in flight.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `task-tracking`: gains one ADDED requirement, **Mark all done** — the header action, its two-click arm, the single-write semantics (one local compare-and-swap; one remote all-or-none `file edit` with a pair per open line, pre-checked unique and verified by re-read), the shared one-at-a-time rule, the optimistic flip and the failure reporting. No new capability: the action lives in the fold-out that capability already owns, reusing its parser, snapshot and write semantics.

Explicitly out of scope: the change viewer's tasks tab (`toggleTask` is a separate write copy — `proposal-viewer`'s **Task tab** requirement is untouched), the row right-click menu, the hover-card button.

## Impact

- `mods/openspec/main.js`: two pure helpers beside `flipPair`, one `writeFlips` beside `writeFlip`, one `markAll` beside `toggle`, the header row in `row()`'s fold-out, arm-state init and resets.
- The spec delta in this change (`task-tracking`).
- `README.md` (the Expanded bullet, What it runs) and `RECIPE.md` (implementation tasks in this change).
- No new programs, no new files, no network; the only new external call shape is the already-probed repeatable-pair form of `herdr-core file edit`.
