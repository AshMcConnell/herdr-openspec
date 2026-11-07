## Context

The list copy resolves its repository on every render through `location()`:
a pinned `folder` prop, else the focused pane's live folder, else the first
pane with a folder in the active space, else the focused item's own directory,
else the space's folder. `render()` calls `refresh()` whenever that resolution
changes, and the panel resets its list and expanded change.

A Herdr mod pane (`mod: "openspec"`) and a mod overlay have no folder of their
own. When the user clicks either one, focus leaves the terminal; `focused()`
then reports no usable `cwd`, and the `any` fallback picks the first pane in
the active space. That pane can be in another tab and another repository.
When the user clicks a change row from the floating OpenSpec window, the list
can therefore flip from the repository they were reading to the one a
different tab happens to sit in, and the next change they open is read from
the wrong project.

For colour, `theme().done` is a *status* colour. In the default graphite theme
it is `#76a8ff` (blue), because "done" is how an agent reports it finished.
The list used it for complete change state, so a finished change read blue
rather than the green the README and the change-state spec promise. The same
token coloured the name, count, chip, progress bar, group header and done task
marks.

## Goals / Non-Goals

**Goals:**

- Clicking the panel, an open change viewer or a floating OpenSpec window does
  not change which repository the list reads.
- A real terminal click still changes the folder immediately, including across
  tabs and spaces.
- Switching to another space resolves the new space afresh, without carrying
  the old space's folder across.
- Complete changes read the theme's bright green — name, count, chip, bar,
  state group header, and an expanded complete change's task ticks and text.
- Keep the list on the app theme's tokens; only the token that means
  "complete" changes.

**Non-Goals:**

- Pinning a panel to a repository across restarts (the `folder` prop already
  does that).
- Remembering the last folder across Herdr restarts or mod reloads. A fresh
  start resolves from the focused terminal again.
- Changing the viewer's fixed Tokyo Night palette. The viewer already reads
  green through; this brings the list's completion green in line with it.
- Changing the `done` token itself, or any other mod's use of it.

## Decisions

**Remember the last terminal location in the module, keyed by space.** A
module-level `last` holds `{ cwd, on, space }`, updated whenever focus resolves
to a real terminal folder (a focused pane's cwd or a focused layout terminal
block's cwd). When focus has no folder and `last.space` is the active space,
`location()` returns `last` instead of scanning other panes. If the active
space differs, the cache is ignored and resolution falls through to the
existing any-pane and space-folder fallbacks.

- *Why module-level:* every list copy follows the same focused terminal in the
  same window, so they should agree. Pinned copies never consult the cache.
- *Why keyed by space:* without it, switching from a space with an overlay
  focused could show the previous space's repository. Space changes are
  exactly the moment a fresh resolution is wanted.
- *Why not per-view state:* `location()` is a module function used by
  `refresh()`, `toggle()`, `archive()` and `render()`; threading a per-view
  previous location through all of them adds surface without changing the
  result, because unpinned list copies already share one live context.
- *Alternative:* drop the any-pane fallback entirely. That would fix the flip
  but leaves a first open with no focused terminal and no pinned folder
  showing "No folder" even when the space has a usable folder. The cache is
  narrower.

**A focused item's own folder wins over the any-pane fallback.** The order
becomes: pinned `folder`; focused pane's cwd; focused layout terminal block's
own `cwd`; remembered terminal location; any pane in the active space; the
space's folder. A layout terminal block is literally what the person focused,
so its folder should beat an unrelated pane.

- *Alternative:* keep the old `any` before `f?.cwd` order. It is what the
  current spec text lists, but it makes the focused item lose to a stranger
  pane and is part of the same "wrong folder" surprise.

**Complete state uses `ansi10`, then `ansi2`, then a fixed green.** A small
`green(t)` helper reads `t.ansi10 || t.ansi2 || "#3fae6a"`. ANSI bright green
is the conventional success slot in every Herdr theme, including light ones;
`ansi2` is the normal green and the fallback. The fixed value only covers a
pathological theme that defines neither.

- *Why not `done`:* it is the agent-status colour, and can be blue or another
  accent by design; a complete OpenSpec change is not an agent finishing.
- *Why not a fixed Tokyo Night green for the list:* the list deliberately
  follows the app theme; using its ANSI green keeps light and dark themes
  readable while still guaranteeing green.
- *Where it applies:* the complete row's name, `done/total` count, `✓
  complete` chip, progress bar, the `✓ Complete` state group header, and the
  expanded task rows' done ticks and task text when the change is complete.
  Singles-task ticks in a non-complete change also use it so the tick colour
  is consistent, but the task text stays muted as before.

## Risks / Trade-offs

- **No terminal has rendered since launch and focus is a mod pane** → the
  cache is empty, so the existing any-pane fallback resolves as today. The
  panel's 15-second poll and the next terminal click fill the cache quickly.
- **A stale folder after switching spaces while an overlay has focus** → the
  cache is keyed by space and ignored on a space change, so the new space is
  resolved from its own panes or folder.
- **A terminal pane with no live cwd** → it counts as "no folder" and keeps
  the remembered location. That is preferable to jumping to a stranger pane
  for a terminal that is restarting.
- **A theme with an unusual `ansi10`** → the fallback to `ansi2`, then a fixed
  green, still leaves complete rows green.
- **Two panels for different repositories** → only one can be unpinned and
  following the focused terminal; a panel that must stay on another repository
  uses its `folder` prop, which always wins.

## Migration Plan

No saved data or props change. The cache lives for the session. After a mod
reload or restart, the first render resolves from the focused terminal exactly
as before; no rollback beyond restoring `main.js` and the README.

## Open Questions

None. The owner asked for the folder to stay put when the window is clicked
and for complete changes to be obviously green; both choices above follow
directly from that.
