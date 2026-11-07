# Proposal: Document existing behavior

## Why

The OpenSpec panel mod in `mods/openspec/` predates OpenSpec's arrival in this
repository: the mod was written and iterated (commits for state chips, the
state sort, the right-click menu) before any `openspec/` tree existed here.
Adopting OpenSpec retroactively means the mod's own behaviour should be
captured as specs — so future changes to the mod can be proposed, reviewed,
and archived against a written description of what it does today, rather
than against tribal memory.

This change is documentation only: it writes down behaviour that already
ships, derived from `mods/openspec/main.js`, `README.md`, and `RECIPE.md`.
Nothing in the mod changes.

## What Changes

Six capability specs, each describing current behaviour as ADDED
requirements:

- `change-list` — how the panel resolves which repository (and machine) to
  read, where its rows come from, what refreshes the list, what a row
  shows, and the empty/error states.
- `change-state` — how a change's state is derived from its task counts,
  the chip it earns, the bar colour, and the green-through rendering of
  complete changes.
- `list-controls` — the filter box and the sort button, their exact
  behaviours, persistence, and the state grouping.
- `task-tracking` — expanding a change, parsing `tasks.md`, display caps,
  and the click-to-toggle write with its compare-and-swap retry.
- `archive-flow` — the two-click archive confirmation, the CLI invocation,
  the spinner/lock, the toast, and the refresh afterwards.
- `context-menu` — the row's right-click popup and its Copy name item.

## Impact

- Affected specs: six new capabilities under `openspec/specs/`.
- Affected code: none.
- New files: the `openspec/` tree and `.opencode/` tool files created by
  `openspec init --tools opencode`.
