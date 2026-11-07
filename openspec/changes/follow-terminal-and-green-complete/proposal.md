# Proposal: Follow the terminal, and show green completion

## Why

Clicking the OpenSpec panel takes focus off the terminal. With no focused
pane's folder to read, the panel falls back to the first pane in the active
space — which can be another tab working in a different repository. The list
then silently switches from the repository the user was reading (for example
`herdr-openspec`) to another (`godot`), and a change clicked afterwards is
from the wrong project.

Separately, a complete change does not look finished: the list paints it with
the theme's `done` colour, which is an agent-status colour and can be blue
(graphite's is `#76a8ff`), not the green a finished change should wear.

## What Changes

- **The panel keeps the last terminal's folder while a mod pane or overlay is
  focused** (`change-list` delta): clicking the panel, a viewer or a floating
  OpenSpec window no longer changes the repository. The remembered location is
  kept per active space, so switching spaces still resolves afresh, and a real
  terminal click immediately takes over again.
- **A more faithful focus order** (`change-list` delta): a focused layout
  terminal block's own folder now wins over an unrelated pane in the same
  space, matching the order the user sees.
- **Complete changes read the theme's bright ANSI green** (`change-state`
  delta): the row's name, count, `✓ complete` chip, progress bar, the state
  group header, and an expanded complete change's done ticks and task text use
  `ansi10` (falling back to `ansi2`), not the `done` status token. A finished
  change is obviously green in every theme.
- README describes the stable folder and the green completion.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-list`: location resolution keeps the last terminal folder when
  focus is on a mod pane or overlay, and a focused item's own folder wins over
  the any-pane fallback.
- `change-state`: complete rows use the theme's green (`ansi10`/`ansi2`)
  rather than its `done` status colour, and the green covers the bar and the
  expanded task ticks too.

## Impact

- Affected code at apply time: `mods/openspec/main.js`, README.md and
  RECIPE.md.
- No new programs, shell, files or network. The list still uses app theme
  tokens; only which token means "complete" changes.
- The remembered folder is in memory for the session. A Herdr restart starts
  from the focused terminal again, as today.
