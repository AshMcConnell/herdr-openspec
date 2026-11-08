## Why

A folded-out task row shows one truncated line, and the shell tooltip that
reveals the rest is a plain single-line strip: it cannot wrap, so a long task
runs off the edge of the screen, and it is drawn in the app's colours rather
than the panel's Tokyo Night palette. Long task lines are common — the full
text is exactly what the hover is for.

## What Changes

- **A styled hover card replaces the one-line tooltip** on folded-out task rows
  and section headings. The card is drawn by the panel: Tokyo Night surface,
  border, rounded corners and padding, capped to a readable width so the full
  line wraps over several lines instead of running off the screen.
- **The card says what the row is**: a done task shows its ✓ state, an open
  task its ○ state, and a section heading shows the full heading. The task's
  full text is the body of the card, never truncated.
- **A short rest opens it, the pointer can move onto it**: the card appears
  after a brief hover delay and stays open while the pointer is over the card,
  so a very long task can be read without holding perfectly still.
- **Nothing else changes**: the row still truncates, still clicks to tick a
  local task, and still refuses clicks in a remote space. The change viewer's
  tasks tab already shows every line in full and keeps its current look.
- README.md describes the card in its Expanded and Limits sections.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `task-tracking`: the **Display cap** requirement's hover clause changes from
  a shell tooltip showing the full text to a styled, width-capped, multi-line
  hover card that also names the row's state.

## Impact

- Affected code at apply time: `mods/openspec/main.js` (the fold-out
  `taskLine`, called from `row`), and README.md.
- Uses the existing `HoverCard` component already declared in
  `mods/openspec/gpui-kit.d.ts`; no new dependency, no new program, no shell,
  no network, and no change to `tasks.md` parsing or the toggle write.
- Up to 120 folded-out rows can carry a card, but a card is only drawn while
  the pointer rests on its row, so an idle list looks and costs the same.
