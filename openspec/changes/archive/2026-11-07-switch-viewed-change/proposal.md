# Proposal: Switch the viewed change

## Why

A change viewer sits beside the list to be looked through, but it is pinned to
the change it was opened on: clicking another row only folds out that row's
tasks, and **View change** on another row opens yet another pane. Looking at
several changes leaves a row of viewer panes to close by hand. The viewer
should follow the change the user selects.

## What Changes

- **A row click retargets an open viewer** (`task-tracking` delta): clicking a
  change's row still folds its task list out (or away), and when a change
  viewer for the same repository and machine is open, it also switches to that
  change. Clicking the already-open row leaves the viewer alone.
- **View change retargets instead of splitting** (`context-menu` delta): when
  a viewer for the same repository and machine is open, the row menu's **View
  change** switches the most recently opened one to the chosen change. Only
  when no viewer is open — or none answers — does it open a pane as before.
- **The viewer follows a retarget request** (`proposal-viewer` delta): a
  viewer copy registers itself while open (an id, the change's repository
  root and machine), follows a request addressed to it, and acknowledges it.
  On a switch it takes the new change's `proposal.md` path, change name and
  machine, clears the old change's documents and spec list, selects the
  proposal tab, re-reads every artifact and re-arms its refresh — the change
  folder watch locally, the 15-second poll remotely. A request it has already
  seen, or one addressed to another copy, is ignored.
- **A silent viewer is skipped**: the panel waits briefly for the viewer's
  acknowledgement; a copy that does not answer (closed without saying so, or
  in a layout that is not shown) is marked unanswered for a short cooldown,
  skipped, and the next one is tried, else a pane opens. The copy is not
  removed — a live viewer in a hidden tab can answer once it is shown again.
  This keeps **View change** working after a stale registration.
- **The saved props stay the anchor**: switching changes what the pane shows
  for this session only. The pane keeps the props it was opened with, so a
  Herdr restart reopens it on the original change. The reader is told this in
  the limits.
- README.md and RECIPE.md describe the switching behaviour and update the old
  "every View change click opens another pane" limit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `proposal-viewer`: adds viewer registration, retarget requests and the
  switch itself (state reset, tab fallback, refresh re-armed).
- `context-menu`: **View change** retargets an open viewer instead of always
  opening a pane, with the acknowledgement fallback.
- `task-tracking`: the row click that folds the task list also retargets an
  open viewer for the same repository and machine.

## Impact

- Affected code at apply time: `mods/openspec/main.js`, README.md and
  RECIPE.md. No new programs, no shell, no network — the list and viewer
  copies talk through Herdr's `shared` values and the mod's own `view`
  command.
- Works for remote spaces too: the switch just changes which change the
  existing viewer reads; the machine stays the same, because only viewers on
  the panel's machine are candidates.
- Multiple viewers for one repository: only the most recently opened copy is
  retargeted. Viewers for a different repository or machine are left alone.
- **Archive order**: this change's deltas are written against the behaviour in
  `tabbed-change-viewer`, which is implemented but not yet archived. Archive
  `tabbed-change-viewer` first; otherwise its deltas would overwrite this
  change's merged requirement text.
