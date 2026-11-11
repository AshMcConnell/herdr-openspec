## Why

A branch cut before a change is archived keeps that change's old active
folder. `openspec list` run in that worktree still reports it as an active
change, so the panel shows a stale copy of work already merged and archived on
the panel's own worktree. In the owner's `godot` repository, `col-stack` holds
16 such copies — 14 M54 changes and two lightmap changes — archived on `main`,
and the panel reads them as live work beside the branch's real changes.

The archive is already on disk as `openspec/changes/archive/<date>-<name>`.
The panel reads each worktree for active changes; it now also reads its own
worktree's archive and hides the copies that only exist because a branch was
cut earlier.

## What Changes

- Read the folder names under the panel's own worktree's
  `openspec/changes/archive/` once per refresh, in parallel with the listings.
- Hide an active copy in a linked worktree whose name matches an archived
  name in the panel's own worktree: it is a stale leftover, not live work.
- Never hide the panel's own active changes, even when its archive holds the
  same name.
- Hide nothing when the archive directory is missing or unreadable, and show
  no error for it.
- Use archive names only for this suppression; they never become rows, paths
  or commands.
- Document the check and its limit in the README and RECIPE.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `worktree-progress`: an active copy of a change archived in the panel's own
  worktree is hidden from the linked worktree's section and counts.

## Impact

- `mods/openspec/main.js`: one `find` on the own worktree's archive per
  refresh and a name filter before the one-row choice.
- `README.md` and `RECIPE.md`: the archive check and what it runs.
- No new dependencies, no writes; one extra read-only command per refresh.
