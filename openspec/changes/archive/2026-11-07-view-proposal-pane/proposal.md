# Proposal: View proposal pane

## Why

Reading a change today means finding and opening its `proposal.md` in an
editor. The panel already knows the change's name, the repository root, and
the machine the change lives on — so a right-click can put the proposal
beside the work as rendered markdown, the way Herdr's own viewers open
files (`pane.split {direction, mod, props: { file }}`).

## What Changes

- **Context menu** (`context-menu` delta): the row's right-click menu gains a
  second item, **View proposal**, appended to the menu table — the table
  stays the extension point. It opens the change's `proposal.md` in a pane
  to the right via `pane.split`, handing the mod its own props; with no
  repository root resolved it reports by error toast and opens nothing.
- **Proposal viewer** (new `proposal-viewer` capability): the same mod,
  given a `file` prop, renders the proposal viewer instead of the list —
  header (change name, a `proposal.md` chip), the file rendered as markdown
  (selectable text, its own scrolling), footer (the machine-prefixed path),
  and the states Loading / No proposal.md / empty / error. Local panes watch
  the change's own folder; remote panes (and a watch that cannot arm) poll
  every 15 seconds.

## Impact

- Affected specs: `context-menu` (delta) and a new `proposal-viewer`
  capability.
- Affected code: `mods/openspec/main.js` (+ README.md / RECIPE.md). No new
  programs, no network.
