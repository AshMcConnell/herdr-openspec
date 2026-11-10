## Why

Agents often work in git worktrees — OpenCode puts its own under
`~/.local/share/opencode/worktree/<hash>/<name>`, and other checkouts of the
same repository are linked too. Each worktree has its own working copy of
`openspec/changes`, so an agent ticking tasks there is invisible to the panel:
the panel reads only the repository of the focused terminal. Sitting in the
main worktree, the owner cannot tell whether an agent's change is half done,
nearly done or stuck.

The data is already available. `git worktree list --porcelain` names every
linked worktree, and `openspec list --json` run inside one reports that
worktree's changes and task counts. The panel already knows how to read a
list, watch a folder and act on a change — it just needs to do it for each
worktree and show them side by side.

Worktrees also repeat a change: a completed branch merges into a stacked one
and both keep their copy, and the main worktree often keeps a stale one.
Listing every copy shows the same change two or three times, and the stale
0/N copy reads as no progress, so the list keeps one row per change name.

## What Changes

- Discover the repository's worktrees with `git worktree list --porcelain` on
  the repository's machine: the main worktree and every linked one, skipping
  bare and missing (prunable) entries. OpenCode's worktrees are standard
  linked worktrees, so no special case is needed.
- Read each linked worktree with `openspec list --json` run in that worktree,
  in parallel with the others. Each worktree keeps its own rows, task counts,
  last-modified times and status.
- Group the list into **worktree sections**: the panel's own worktree first,
  then the other worktrees with visible changes, ordered by branch label. When
  no linked worktree has changes, the list renders exactly as today, with no
  headers.
- Show a section header per worktree — its branch (or `detached: <folder>`),
  its visible change count and its visible done/total task total — with the
  panel's own section marked "this worktree".
- Remember each row's worktree. Expanding its tasks, ticking a task, marking
  all done, archiving, the right-click menu, the viewer target and a command
  hand-off all act in that row's worktree.
- Show one row per change name: when several worktrees hold the same change
  (a completed copy merged into a stacked branch, or a stale copy in the main
  worktree), keep the copy with the most progress, then the freshest, and hide
  the others. The row acts in the worktree whose copy it shows.
- Watch every shown worktree's `openspec/changes` on a local space, and keep
  the 15-second poll for remote spaces. A worktree created, removed or pruned
  while the panel is open appears or disappears on the next refresh.
- Leave out a linked worktree with no `openspec/changes`; render a linked
  worktree that fails another way as its own section with the first line of
  its error, without breaking the other sections.
- Apply the filter, the sort modes and the state grouping inside each
  section; the header counts cover every visible row.
- Keep **Bulk archive** with the panel's own worktree, and offer it only when
  that worktree has changes.
- Never create, remove, prune or lock a worktree. Discovery is read-only.

## Capabilities

### New Capabilities

- `worktree-progress`: discovering the repository's worktrees, reading each
  one's changes, grouping the list into sections, de-duplicating same-named
  changes across worktrees, worktree-scoped rows, live refresh per worktree
  and the states of a worktree whose list cannot be read.

### Modified Capabilities

- `change-list`: the list source, refresh triggers and empty/error states now
  cover the panel's own worktree plus every linked one.
- `list-controls`: the filter, sort modes and state grouping apply within each
  worktree section; the header and section counts follow.
- `task-tracking`: expanding, ticking and marking all done act on the clicked
  row's worktree, with one open change and one task write across sections.
- `archive-flow`: archive runs in the row's worktree; bulk archive stays with
  the panel's own worktree.
- `command-handoff`: a row command captures the row's worktree, and the
  selected-agent match and new tab use it.
- `context-menu`: status reads and viewer targeting use the row's worktree.

## Impact

- `mods/openspec/main.js`: worktree discovery and parsing, per-worktree
  listing and watching, the section model and headers, one-row-per-name
  de-duplication, and worktree-scoped keys for the fold-out, task writes,
  archive, row menu, viewer requests and hand-offs.
- New and modified spec deltas in this change.
- `README.md` and `RECIPE.md`: the new behaviour and what it runs.
- One extra `git worktree list --porcelain` per refresh and one
  `openspec list --json` per linked worktree per refresh; one folder watch per
  shown local worktree. No new dependencies, no network, and no writes beyond
  the existing `tasks.md` and `openspec archive` paths.
