## Context

The panel is single-root today. `location()` resolves `{ cwd, on }`, `refresh()`
runs `openspec list --json` there, then `git rev-parse --show-toplevel` sets
`this.root`; the result is one flat `this.changes`, and `watch(this.root)` arms
one folder watch. Every change interaction assumes that root: `loadTasks`,
`toggle`, `markAll`, `archive`, `openRowMenu`, `requestViewer` and the command
hand-off all read `this.root` (or `location().cwd`), and `this.open`,
`this.confirming`, `this.marking`, `this.busy` and `this.toggling` are change
names.

That assumption breaks in worktrees. Each linked worktree has its own working
copy of `openspec/changes`, so an agent's ticks live in that worktree and
`git rev-parse` there returns the linked path. OpenCode creates standard
linked worktrees under `~/.local/share/opencode/worktree/<hash>/<name>` (a
`.git` file pointing into the main repo's `.git/worktrees/<id>`), and sibling
checkouts such as `/Volumes/ExternalSSD/Code/orc/godot-m25` are registered in
the same list, so `git worktree list --porcelain` finds all of them from any
one of them. The command prints `worktree <path>` lines verbatim (spaces
included), with `HEAD`, `branch refs/heads/<name>`, `detached`, `bare`,
`locked` and `prunable` markers.

The row renderer already has a 22px, 10pt section-header style from the state
sort. A worktree section can reuse it.

## Goals / Non-Goals

**Goals:**

- Show every worktree's changes and task progress in one list, live, from the
  panel's own worktree.
- Keep each row acting on the worktree it came from: expand, tick, mark all,
  archive, row menu, viewer, command hand-off.
- Keep a single-worktree repository looking and behaving exactly as it does
  today, headers included.
- Work on remote spaces through `exec`'s `on`, with the poll instead of a
  watch.

**Non-Goals:**

- Creating, removing, pruning, locking or switching worktrees.
- Showing a worktree with no OpenSpec changes; merging the task contents of
  two same-named changes (the list picks one copy, it does not combine them).
- Clones that are not linked worktrees of the same repository.
- Section collapsing, per-worktree filters, or archiving across worktrees in
  one action.
- Changing the change viewer's internals or its registry.

## Decisions

### D1. Discovery — `git worktree list --porcelain`

Run it in `this.root` (after `git rev-parse`), once per refresh and never per
render, on the panel's machine. Parse blank-line-separated blocks into
`{ path, branch, detached, bare, prunable }`; take the rest of the
`worktree ` line as the path (porcelain does not quote spaces). Skip `bare`
and `prunable` entries, and the entry whose path equals `this.root` — that is
the panel's own worktree. The label is the branch with `refs/heads/` stripped,
or `detached: <folder name>` when `detached`. Linked worktrees are ordered by
label with `localeCompare`; the own section always comes first. If git fails,
or the folder is not a repository, there are no linked sections and the panel
is exactly its old single-root self.

Rejected: scanning `~/.local/share/opencode/worktree` (only finds OpenCode's
worktrees, misses sibling checkouts, and knows a vendor path); reading
`.git/worktrees` directly (private layout, and misses the main worktree).

### D2. Listing each worktree

After discovery, run `openspec list --json` in the own root and every linked
worktree **in parallel**, each with `{ cwd: path, on }`, and reuse the current
parse: `parsed.changes`, dot entries dropped before storing, each entry mapped
to the row shape. The own read is now part of the same parallel batch rather
than a serial first step; `git rev-parse` and the worktree list run first
because discovery needs the root.

One worktree's failure is not the panel's failure:

- "No OpenSpec changes directory found" means the worktree is not initialised:
  a linked worktree is omitted; the own worktree becomes an empty section (so
  linked sections still render).
- Any other own failure (missing CLI, non-zero exit, bad JSON, thrown read)
  keeps today's full-panel error state and linked worktrees are not read —
  the same CLI would fail there too.
- Any other linked failure renders that section with the first line of its
  error; the other sections stand.

Names still come only from the CLI; the filesystem is never scanned for
changes.

### D3. Section model

`refresh()` builds `this.sections = [{ root, label, own, wt, changes, error }]`,
keeps one row per change name across the sections (D4), and keeps
`this.changes` as the flat union of every kept row. Each row gains `root`,
`wt` (the section's short id) and `key` (see D4).

Rendering rules:

- A section renders when it has at least one visible row or an error. An own
  section with no rows renders nothing.
- Section headers appear **only when at least one linked section renders**.
  With no linked worktree, `row()` output is unchanged — no header, no
  divider.
- A header is a 22px row like the state headers: `⎇ <label>` on the left
  (plus `· this worktree` on the own section), `N changes · done/total` on the
  right, counting the section's visible rows. An error section shows its
  header and the first error line in the body instead of counts.
- A 1px `t.border` divider separates sections.

Section order is fixed: own first, linked worktrees by label. Sorting never
reorders sections, only rows inside them.

### D4. Row identity, and one row per change name

Paths are unique per worktree and names are unique inside one, so:

- `key = root + "\u0000" + name` (internal only; never a render id).
- `wt` = a short FNV-1a hash of the root in hex, computed once per section, so
  duplicate names in different worktrees get distinct gpui ids:
  `chg-${c.wt}-${c.name}`, `arch-${c.wt}-${c.name}`,
  `mark-${c.wt}-${c.name}`, `os-task-${c.wt}-${line}`. A duplicate id would
  share hover/focus state and make one row's click look like another's.
- `this.open` becomes a key plus `this.openRoot`/`this.openName` for reads.
  `pick(c)` opens only its own row; clicking another row moves the fold-out
  there.
- `this.confirming`, `this.marking`, `this.busy` and `this.toggling` hold
  keys. `showArchive` compares `self.busy === c.key`; the spinner and arm
  checks compare keys; a refresh drops any key that is no longer in
  `this.changes`.

A name can exist in several worktrees at once: a completed branch is merged
into a stacked branch and both keep their copy, and the main worktree often
keeps a stale copy at 0/N. One row per worktree would repeat the change two or
three times and let the stale copy read as no progress. After the sections are
built, group every section's rows by name and keep **one**:

1. the highest completed-task ratio (a change with no tasks ranks below any
   with tasks);
2. then the most tasks done;
3. then the latest `lastModified` (the copy touched most recently, which is
   where an agent is working);
4. then the larger total task count.

The kept row stays in its own section; every other copy is not a row, not
counted in the header or a section header, and cannot be expanded, archived or
handed off. `this.changes` and `this.sections` hold only the kept rows, so the
existing open/confirming/marking/busy/toggling sweeps prune a key whose copy
loses on the next refresh.

Why progress first rather than mtime first: checking out a worktree gives
every file a fresh mtime, so a stale copy could otherwise win on time alone.
The completed ratio is the copy that carries the work. The `key` keeps the
root because the kept copy can move between worktrees between refreshes, and
an old key must not act on the new copy.

Why not trust the branch stack instead: the panel cannot know which branch
contains which without running extra git commands, and a worktree can be
checked out at any point; task progress and mtime are already in the listing.

### D5. Every action is worktree-scoped

Replace `this.root` with the row's root in each action:

- `loadTasks(c)`: `<c.root>/openspec/changes/<name>/tasks.md`.
- `toggle(row, c)` / `markAll(c)`: same local compare-and-swap and remote
  `herdr-core file edit`, path under `c.root`, `on` unchanged (worktrees live
  on the panel's machine).
- `archive(c)`: `openspec archive <name> --yes` with `cwd: c.root`; the
  failure offer carries `c.root`; on success the open row collapses only when
  its key matches.
- `openRowMenu(c)`: the `openspec status` read runs in `c.root`, and the
  popup's props carry `c.root`.
- `pick(c)`: `requestViewer(name, { root: c.root, on })`. The viewer registry
  already keys on its root, so a viewer for another worktree is never
  retargeted.
- Row commands: `openRowMenu` already passes the root into the hand-off
  request; it now reads the row's root. The selected-agent match and the new
  tab use that root.
- `bulkArchive()` stays on `this.root` — the panel's own worktree — and the
  toolbar button is shown only when the own worktree's listing has a change,
  even when a worktree's newer copy hides that row as a duplicate (the command
  is the own worktree's own workflow). It is a repository-level command and is
  not run once per section.

### D6. Filter, sort and counts per section

Replace `visible(self)` with `visibleSections(self)`: filter every section's
changes by the name substring, drop sections that end with no rows, then sort
each remaining section's rows with the existing comparators (`recent`,
`name`, `done`, `state`). Sections and rows are already de-duplicated (D4), so
every count is a count of change names. The state sort groups rows inside each
section; the section header stays above its state groups. Section order never
changes.

`rows = sections.flatMap(s => s.rows)` feeds the header count, the task chip
and the "No changes match" check. A section header's counts use its own
visible rows, so a filter shows `1/2 changes` there and the header shows the
matched/total across every section.

### D7. Refresh and watches

`refresh()` becomes:

1. resolve `{ cwd, on }` (unchanged; reset the panel when the context key
   changes, as today);
2. `git rev-parse --show-toplevel` from `cwd` → `this.root`, falling back to
   `cwd`;
3. `git worktree list --porcelain` in `this.root` (skip on failure);
4. list the own root and every linked root in parallel;
5. rebuild sections, then drop stale keys (`open`, `confirming`, `marking`,
   `busy`, `toggling`) whose row left the list;
6. reload the open row's tasks from its own root;
7. arm watches for every rendered root.

Watches: replace the single `this.watched = root` with a key built from the
sorted rendered roots (`this.watched = roots.join("\n")`). Spawn one loop per
root; each awaits `watchFolder(<root>/openspec/changes)`, checks the key is
still current, then refreshes. The old loops stop at their next wake when the
key changes, the same guard the viewer uses for its folder. Remote spaces arm
no watch and keep the 15-second poll. A worktree with no changes is not
watched.

Concurrency: `this.loading` still skips a refresh while one is in flight, and
the 15-second timer catches up; parallel CLI calls keep one refresh to roughly
the slowest worktree.

### D8. Single-worktree compatibility

When discovery finds no linked worktree that renders, the panel draws no
header, no divider and the same footer as today. This is not a special code
path: the header condition is "a linked section rendered", and a repository
with one worktree has none. The only visible change in that case is that
`git worktree list` runs on each refresh.

### D9. Error and empty precedence

- Own "no changes directory" + linked changes → linked sections only; no
  panel-wide error.
- Own "no changes directory" + nothing anywhere → "No OpenSpec here — run
  `openspec init`".
- Own valid empty + linked valid empty → "No active changes".
- Own other failure → the existing full-panel error, no linked reads.
- A linked failure → its section header plus the first error line; the section
  never counts as a change and never stops the others.
- A linked worktree with no changes directory is omitted entirely.

## Risks / Trade-offs

- **Process cost** — one extra `git` per refresh and one `openspec list` per
  linked worktree per 15 seconds. Worktrees are expected to be few; the calls
  run in parallel and a worktree with no changes is never watched. If a repo
  grows dozens of worktrees, the poll would need a cache keyed on each
  worktree's changes mtime; out of scope here.
- **Worktree churn** — an agent can add or remove one mid-refresh. Discovery
  runs every refresh and a failed section is local, so the next poll
  corrects; a removed worktree's section and open row disappear with it.
- **Stale branches** — a worktree checked out on an old branch may hold an old
  `openspec/` or none. It shows its own truth, which is the point; it is
  omitted when it has no changes directory.
- **Duplicate names** — one row per name (D4): the most complete copy, then
  the freshest, is shown in its own section. A losing copy's edits are
  invisible until it wins on progress or time, and the 15-second poll brings
  that back; if an agent deliberately edits two copies at once, only the
  leading copy is shown. `key` and `wt` stay root-scoped, so the row that is
  shown always acts on the copy it came from.
- **Header density** — a 480px panel gains a 22px line per worktree. Only
  worktrees with changes or errors get one, and single-worktree repos get
  none; collapse is left out until the list proves too long.
- **Remote paths** — `git worktree list` on the remote machine returns remote
  paths, and every read/command already carries `on`. No local path can leak
  into a remote action because the root and the machine travel together from
  the same refresh.

## Migration Plan

No data migration. Implement in `mods/openspec/main.js`, sync the snapshot to
`~/.config/herdr-app/mods/openspec/` and reload the mod panel (AGENTS.md).
Rolling back is reverting the change; the panel reads the same files and runs
no new commands beyond `git worktree list`.

## Open Questions

None blocking. The section collapse control and a per-worktree "open in this
worktree" gesture are deliberately deferred.
