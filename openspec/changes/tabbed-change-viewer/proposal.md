# Proposal: Tabbed change viewer

## Why

Opening a change today shows one artifact — its `proposal.md` — and the rest
of the change (the design, the task list, the spec deltas) lives somewhere
else: an editor, a terminal, another window. A change should open as a whole
change. And the task list is the part you act on, so ticking a box should
work where you read it — in the Tokyo Night page — not only by folding the
row out in the panel.

## What Changes

- **The proposal viewer becomes a change viewer** (`proposal-viewer` delta):
  a tab bar with **proposal / design / tasks / specs**, one tab per artifact
  the change actually has (proposal always present as the anchor; specs can
  be several, one per capability). Same Tokyo Night palette, same
  `pane.split` props (`file`, `change`, `on`), so panes saved under the old
  viewer reopen as the tabbed one with no migration.
- **The tasks tab is a themed checklist** (`proposal-viewer` delta): sections
  and rows from the change's `tasks.md`, ✓ green for done, ○ faint for open,
  full text untruncated. On a local pane a click ticks that line in the file
  with the panel's compare-and-swap semantics — a stale snapshot gets one
  re-read and retry, the flip is optimistic, a failure reports by toast, and
  only one toggle runs at a time. Remote panes are read-only.
- **The specs tab** (`proposal-viewer` delta): the change's delta specs,
  rendered under a heading of each capability's name; no specs directory
  means no specs tab.
- **Live updates for every artifact** (`proposal-viewer` delta): a local
  pane watches the change's own folder, so edits to any artifact — including
  `specs/<capability>/spec.md` — show up as they happen; remote panes and a
  watch that cannot arm fall back to the 15-second poll. Switching tabs reads
  that artifact fresh.
- **The menu item is relabelled View change** (`context-menu` delta) and
  opens the same viewer with the same props; the no-root error toast stays.
- **The review minors from `theme-proposal-viewer` are folded in** (labelled
  in `tasks.md` §1): the blockquote bar is the Obsidian accent `#80d0ff`
  (`#565f89` was the wrong token), the block parser splits lines CRLF-aware
  (while the task ticker keeps its byte-exact round-trip), fence info strings
  containing spaces render their chip, the spec now states the 2000-block
  truncation carve-out to "never drop content", and README/RECIPE say that
  only http(s) links are clickable.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `proposal-viewer`: the viewer becomes tabbed — artifact discovery, the tab
  bar, per-tab bodies, ticking tasks from the tasks tab, and refresh covering
  every artifact rather than one file. The merged spec currently contradicts
  itself — **Viewer content** still promises selectable TextView text while
  **Markdown body** draws with the mod's own renderer — and this change's
  MODIFIED set resolves that in favour of the renderer.
- `context-menu`: the **View proposal** item is relabelled **View change**
  and opens the change viewer.

## Impact

- Affected code at apply time: `mods/openspec/main.js`, plus README.md and
  RECIPE.md. This round writes artifacts only — no code.
- No new programs beyond the `find` used to list a remote change's specs
  (local listing uses `readdir`). No network.
- Remote panes render every tab but cannot tick tasks — the panel behaves the
  same way.
- The panel's change list is untouched, and `task-tracking` still specs the
  panel's own folded-out list rather than this viewer.
