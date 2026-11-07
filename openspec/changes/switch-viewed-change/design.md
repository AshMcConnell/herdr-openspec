## Context

The tabbed change viewer is a second copy of the mod, opened with
`pane.split {props: {file, change, on}}` from the row menu's **View change**.
It reads only its props, so it is pinned to that change. The list copy knows
every pane through `panes()`, but a viewer pane and a list pane both report
`mod: "openspec"` and no props — the mod cannot ask Herdr which pane holds a
viewer, and `pane.split` returns no pane id to the caller.

Herdr does give mod copies two channels that reach each other:
`shared(key)` / `setShared(key, value)` (app-wide, persisted, re-renders every
copy) and `run("<mod>.<command>")` → `nextCommand()` (reaches copies whose
layout block is shown). Any switching design has to work through those.

## Goals / Non-Goals

**Goals:**

- A row click or **View change** retargets an open viewer for the same
  repository and machine instead of adding panes.
- A retargeted viewer shows the new change's artifacts at once and stays
  current: local folder watch, remote 15-second poll.
- A viewer that has gone away never blocks the menu: the next **View change**
  still opens a pane.
- Switching is safe for a task toggle that is already in flight.

**Non-Goals:**

- Remembering the switched-to change across a Herdr restart — the pane's
  saved props remain the anchor.
- Retargeting every open viewer at once, or viewers for another repository or
  machine.
- Closing viewer panes from the list (the mod cannot tell one openspec pane
  from another).
- Changing how a viewer is opened the first time.

## Decisions

**Viewer registry in a shared value.** Every viewer copy registers
`{id, at, file, root, on}` in `shared("openspec.viewers")` keyed by a random
id when it starts, and removes itself in `Optional View.close(cx)`. Entries
older than 7 days are pruned and the registry is capped at 40. `root` is the
part of the viewer's change directory before `/openspec/changes/`; `file` is
its current anchor, updated when it switches.

- *Why:* the registry is the only way the list can know that a viewer exists
  and which one to address. It is app-wide and persisted, so restored panes
  register again when they start.
- *Alternatives:* keying off `panes()` alone cannot separate a viewer from the
  list (both are `mod: "openspec"`, and props are not exposed). A single
  undirected "show this change" value would switch every open viewer, which is
  wrong when two viewers are open on purpose.

**Addressed requests and an acknowledgement.** The panel writes the request
into `shared("openspec.view.<id>")`, a slot belonging to one viewer, and calls
`run("openspec.view")`. The slot holds a small map keyed by request token, so
two panels asking the same viewer at once cannot overwrite each other. The
viewer's `nextCommand()` loop reads every queued request for its id,
acknowledges each in `shared("openspec.view.ack")`, and lands on the last one;
the shared value carries the payload because `nextCommand()` returns only a
command name.

- *Why an ack:* the panel must decide between retargeting and opening a pane,
  and a closed or hidden copy cannot answer. The panel waits 700 ms; without
  an ack it records the id in `shared("openspec.view.quiet")` for a 15-second
  cooldown, skips it and tries the next candidate for the same repository and
  machine, else falls back to `pane.split`. A row click uses the same wait and
  retry but never opens a pane as its fallback. A viewer that later answers
  clears its cooldown at once.
- *Why not drop a silent viewer:* a copy in another tab or a hidden layout
  stays alive but cannot receive the `view` command. Deleting it would leave a
  live viewer orphaned and every later View change would open a duplicate
  pane. The cooldown keeps it registered and retryable, while a stale entry
  costs at most one 700 ms wait per 15 seconds.
- *Why a command as well as the shared value:* a render must not have side
  effects, and `nextCommand` reaches shown copies only — a viewer in a layout
  that is not shown is not a useful target until it is shown again.
- *Alternatives:* a heartbeat would keep the registry honest but makes every
  copy on the machine re-render on a timer; the one-shot ack only costs
  something when a viewer is missing. Dropping the entry is cheaper but, as
  above, wrong for a hidden copy.

**The menu hands the job to the panel that rendered the row.** The row menu is
its own overlay copy of the mod, and its `cx` ends when the overlay closes, so
it cannot own a 700 ms wait. The **View change** item instead writes
`shared("openspec.open.<panel>") = {panel, name, root, on, seq}` — `panel` is
a random id the list copy puts in the menu's props — and calls
`run("openspec.open")`. Every shown list copy receives the command; only the
one whose `panelId` matches handles it, with the same wait/retry/split logic
the row click uses. This keeps the decision and the timer in a copy that lives
on, and it stops a second list panel for the same repository from also opening
a pane.

- *Alternatives:* keep the popup open until the acknowledgement (a visible
  700 ms stall when no viewer answers, and the overlay still owns the timer);
  let every list copy react to the shared value (two panels for one repository
  could open two panes).

**The newest matching viewer is the target.** Candidates are filtered by
`root` (equal to the panel's resolved root) and `on` (same machine), sorted by
registration time, newest first. A row click addresses the newest and never
opens a pane; **View change** walks the list on timeouts and opens a pane when
it runs out.

- *Why:* "the viewer that is open" is almost always the last one opened. A
  second viewer is left alone, so two changes can still be compared. The
  cost: a viewer in another tab is a candidate too, and because a copy cannot
  learn its own pane the switch may only be seen on returning to that tab.
- *Alternative:* one global target owned by the last viewer to claim it; that
  is the same rule with more state to keep clean.

**Switching resets the per-change state.** `switch to` bumps `this.file`,
`this.dir`, `this.change` and `this.machine`, increments `generation`
(invalidating every in-flight read), clears `docs`, `specs`, `specsLoading`
and `tasksText`, sets `tabsAvailable = ["proposal"]` and `tab = "proposal"`,
then runs discovery and re-arms refresh. The previous watch or poll task is
cancelled, so timers do not accumulate over a session; a watch loop also exits
when its captured directory is no longer `this.dir`, as a second guard.

- *Why the proposal tab:* a switch is a fresh look at another change, and the
  new change may not have the tab that was selected. Discovery then applies
  the usual "fall back to proposal when the artifact is gone" rule.
- *Alternative:* keep the selected tab when the new change has it. It reads
  as continuity, but `specs` can be present in one change and absent in the
  next, and the reset is easier to reason about. Decided against.

**In-flight writes are keyed by the change that started them.** `toggleTask`
captures the current `file` at click time; its completion only writes
`docs.tasks`/`tasksText` when `this.file` is still that file. The write itself
still lands in the old change's `tasks.md` — which is what the click meant —
and a switch clears `toggling` so the new change is not blocked by the old
one's write.

**Saved props stay the anchor.** Switching does not, and cannot, rewrite the
pane's props. After a restart (or a mod reload) the viewer opens on the change
its props name. This is documented in the README limits rather than worked
around with per-pane `localStorage`, which cannot distinguish a restart from a
new pane and would make a fresh **View change** reopen an old selection.

## Risks / Trade-offs

- **A stale registry entry after a crash or quit** → **View change** waits one
  700 ms acknowledgement, records the silent id as quiet for 15 seconds and
  continues; the worst case is one delayed click, never a dead menu, and the
  entry is never destroyed while its copy might still be alive.
- **A close write races a register write** (a viewer closes while another
  starts) → both writers re-read the registry immediately before merging, so a
  lost entry is at most an old viewer that had no further role; the ack
  fallback covers it.
- **A background-tab viewer is targeted** → it is the newest matching viewer.
  If hidden copies receive the command, only that one switches, invisibly until
  the user returns to its tab; if they do not, it is skipped for the cooldown
  and **View change** opens a pane. Either way no live copy is deleted.
- **A task tick is in flight during a switch** → the old write finishes into
  its own file; the viewer's new change is never overwritten (file-keyed
  guard), and the new checklist is re-read fresh.
- **Hot reload forgets the switched-to change** → the props anchor wins, as
  after a restart. A viewer showing a selection rather than its props is the
  deliberate limit of not being able to save props.
- **Command delivery to hidden copies** → a viewer that cannot receive the
  command cannot ack; it stays registered and is retried after the 15-second
  cooldown, so showing it again makes it a target once more.

## Migration Plan

No file or prop changes for saved panes. Two mod-internal commands
(`openspec.view`, `openspec.open`) and a small set of shared values are new; a
viewer pane saved by the current version reopens exactly as before and
registers itself on start, and the first **View change** after the update
either retargets it or opens a pane, as it always did. Old request values left
by an earlier build are ignored. No rollback work beyond restoring `main.js`.

## Open Questions

None — the one product fork (row click versus menu only) was settled: both
retarget an open viewer.
