## Why

The fold-out's task rows and section headings pop a styled hover card after a 400 ms rest. The card floats over the rows below and covers the list while the pointer moves down it, so reading a long task list means dismissing a panel that keeps reopening. Task rows already wrap to their whole text, so for tasks the card only repeats what the row shows; the one thing it adds — the "✓ Mark done" / "↺ Reopen" button — duplicates the row click that sits directly under the pointer.

## What Changes

- Task rows and section headings in the fold-out no longer show a hover card. Resting the pointer leaves the list alone.
- The `hoverCard` helper and the `HoverCard` import go; `taskLine` returns plain rows and headings.
- The row's own hover background and click-to-toggle are unchanged, and task rows still wrap to the entry's whole text.
- A long section heading still truncates to the panel; its full text remains readable in the change viewer's tasks tab.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `task-tracking`: the **Display cap** requirement loses the hover-card sentences and the card scenarios, and the **Click to toggle** requirement loses the in-card button and its scenarios.

## Impact

- `mods/openspec/main.js`: `taskLine` and the removed `hoverCard` helper and import.
- `openspec/specs/task-tracking/spec.md` via this change's delta.
- `README.md` (Expanded and Limits bullets) and `RECIPE.md` (the description paragraph).
- No new programs, files, writes or commands.
