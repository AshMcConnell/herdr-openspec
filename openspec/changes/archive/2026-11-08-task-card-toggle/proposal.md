## Why

The hover card from `task-hover-card` lets the owner read a long task's full
text, but ticking it means leaving the card, finding the row back in the
fold-out, and clicking that. Reading and ticking are one action in practice:
read the full line, tick it, move on.

## What Changes

- **A toggle button inside the hover card**: task cards gain a small
  full-width button under the text — "✓ Mark done" on an open task,
  "↺ Reopen" on a done one — in the card's Tokyo Night palette.
- **The same write path as a row click**: the button calls the same
  `toggle(...)` the row uses — optimistic flip, compare-and-swap on the
  snapshot, one at a time, toast on failure. Local spaces only: a remote
  space's card shows no button, and a section heading's card never gets one.
- **The card stays open across the flip**: the kit's `HoverCard` owns its
  open state and exposes no way to close it from a script, and the flip
  rebuilds the card in place — the state line and the button both swap to
  the new state while the owner watches.
- **Nothing else changes**: rows still click to toggle, the `Boolean(text)`
  guard still hides cards for blank rows, and the change viewer's tasks tab
  is untouched.
- README.md's Expanded bullet gains the button.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `task-tracking`: the **Click to toggle** requirement gains the card's
  button — the same flip the row offers, local only, with remote and section
  cards showing no button.

## Impact

- Affected code at apply time: `mods/openspec/main.js` (`hoverCard` grows an
  optional activation parameter; `taskLine` passes the row's toggle), and
  README.md.
- Uses only `on_click` on plain elements, already declared in
  `mods/openspec/gpui-kit.d.ts`; no new dependency, no new file, no change to
  the toggle write or to `tasks.md` parsing.
- Coexists with the unarchived `task-hover-card` change; this change archives
  nothing. Archive order: `task-hover-card` archives first — this change's
  delta rewords the **Click to toggle** requirement around "a task's hover
  card", wording that only exists in the main spec once `task-hover-card`'s
  Display-cap delta lands.
