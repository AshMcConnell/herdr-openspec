## ADDED Requirements

### Requirement: Worktree discovery

The panel SHALL discover the worktrees of the repository it reads with `git worktree list --porcelain`, run in the resolved repository root on that repository's machine, once per refresh and never per render. The panel's own worktree SHALL be the entry whose path equals the resolved repository root; every other entry SHALL be a linked worktree, except entries marked `bare` or `prunable`, which SHALL be skipped. A linked worktree's label SHALL be its branch name with `refs/heads/` removed, or `detached: <folder name>` when its HEAD is detached. Linked worktrees SHALL be ordered by label using locale-aware comparison. When the command fails or git cannot be run, the panel SHALL show only its own worktree's changes, as it did before worktree sections existed.

#### Scenario: OpenCode's worktree is found

- **WHEN** the repository has a linked worktree at `~/.local/share/opencode/worktree/8dc283/col-27` checked out on branch `col-27`
- **THEN** the panel shows a section labelled `col-27` beside its own changes

#### Scenario: Sibling checkouts are found

- **WHEN** the repository has linked worktrees at `/Volumes/ExternalSSD/Code/orc/godot-m25` and `godot-m42`
- **THEN** both are listed, each under its branch label

#### Scenario: Bare and prunable entries are skipped

- **WHEN** `git worktree list --porcelain` reports an entry marked `bare` or `prunable`
- **THEN** no section is rendered for it

#### Scenario: Detached worktree label

- **WHEN** a linked worktree is at `.../col-28` with a detached HEAD
- **THEN** its section is labelled `detached: col-28`

#### Scenario: Git fails

- **WHEN** `git worktree list` exits non-zero or git cannot be run
- **THEN** the panel lists only its own worktree's changes and shows no section headers

### Requirement: Worktree listings

For every linked worktree, the panel SHALL run `openspec list --json` in that worktree, on the same machine, in parallel with the other worktrees' reads. Each listing SHALL be parsed and filtered exactly like the panel's own listing: dot-prefixed entries dropped before storing, every remaining entry mapped to a candidate row with its name, task counts, last-modified time and status. One row per change name is then chosen from the candidates, as **One row per change name** defines. A linked worktree whose listing reports no OpenSpec changes directory SHALL be omitted. A linked worktree whose listing fails any other way SHALL render its section with the first line of the error and SHALL NOT stop the other sections from rendering. Change names SHALL come only from `openspec list`; the panel SHALL NOT discover them from the filesystem.

#### Scenario: The more complete copy is the row

- **WHEN** the own worktree reports `add-oauth` at 3/10 and a linked worktree reports `add-oauth` at 9/10
- **THEN** one row shows 9/10 in the linked worktree's section, and the own copy is not a row

#### Scenario: A dot entry is dropped per worktree

- **WHEN** a linked worktree's listing returns both `fix-parser` and `.draft`
- **THEN** only `fix-parser` becomes a row in that section

#### Scenario: A worktree without OpenSpec is omitted

- **WHEN** a linked worktree's listing reports "No OpenSpec changes directory found"
- **THEN** that worktree has no section

#### Scenario: One worktree fails

- **WHEN** a linked worktree's listing exits non-zero for another reason
- **THEN** its section shows its header and the first line of the error, and every other section still renders

#### Scenario: No filesystem discovery

- **WHEN** the panel builds the list
- **THEN** every change name comes from an `openspec list` run in its worktree, never from scanning files

### Requirement: Worktree sections

The list SHALL group changes into one section per worktree: the panel's own worktree first, then linked worktrees in label order. Section headers SHALL render only when at least one linked worktree renders; when none does, the list SHALL render without headers exactly as it did before worktree sections existed. A section header SHALL show the worktree's label, its visible change count and its visible done/total task total, and the panel's own header SHALL say `this worktree`. A section with no visible change row SHALL not render, except that a section carrying an error SHALL render its header and that error instead of counts. A divider SHALL separate adjacent sections.

#### Scenario: Several worktrees

- **WHEN** the own worktree has two changes and `col-27` has one
- **THEN** the list shows the own section first, then `col-27`, separated by a divider

#### Scenario: One worktree

- **WHEN** the repository has no linked worktree with changes or errors
- **THEN** the list renders with no section header and looks exactly as before

#### Scenario: Section totals

- **WHEN** `col-27` has two visible changes with 4/5 and 1/5 tasks done
- **THEN** its header reads `2 changes · 5/10`

#### Scenario: An empty section is hidden

- **WHEN** a linked worktree's listing succeeds with no changes
- **THEN** no section or header is rendered for it

#### Scenario: The own section says so

- **WHEN** section headers are rendered
- **THEN** the own worktree's header reads `this worktree` beside its label

#### Scenario: An error section

- **WHEN** a linked worktree's listing fails
- **THEN** its header renders and the error's first line replaces its counts

### Requirement: Worktree-scoped rows

Every change row SHALL carry the worktree it came from. Expanding a row, reading or writing its `tasks.md`, marking all its tasks done, archiving it, opening its row menu and targeting a change viewer SHALL act in that row's worktree, on the panel's machine. Row identifiers SHALL include the worktree, because the copy a name shows can move between worktrees between refreshes and the row must act on the copy it shows. At most one change SHALL be expanded across every section, identified by its worktree and name. A command handed off from a row SHALL capture that row's worktree.

#### Scenario: A row that moved to another worktree

- **WHEN** a change name's shown copy moves from `col-27` to `col-stack` on a refresh
- **THEN** the row renders with `col-stack`'s id and actions, and the old `col-27` row is gone

#### Scenario: A tick lands in the clicked worktree

- **WHEN** the user ticks a task in `col-27`'s row
- **THEN** `col-27/openspec/changes/<name>/tasks.md` is written, and the own worktree's copy is untouched

#### Scenario: The shown copy is the one acted on

- **WHEN** a name exists in two worktrees and the list shows one copy
- **THEN** expanding, ticking or archiving that row acts on the shown copy's worktree, never the hidden one

#### Scenario: Archive acts in its worktree

- **WHEN** the user archives `col-27`'s change
- **THEN** `openspec archive <name> --yes` runs with `col-27` as its working directory

#### Scenario: The viewer targets its worktree

- **WHEN** the user picks **View change** on a `col-27` row
- **THEN** the viewer opens or retargets for `col-27`'s root, not the panel's own worktree

#### Scenario: A row command captures its worktree

- **WHEN** the user picks **Continue** on a `col-27` row
- **THEN** the hand-off's repository is `col-27`, and an agent working there can receive it

### Requirement: One row per change name

A change name that exists in more than one worktree SHALL render as exactly one row. When several worktrees hold the same name, the panel SHALL keep the copy with the highest completed-task ratio (a change with no tasks ranking below one with tasks), then the most tasks done, then the latest last-modified time, then the larger total task count; the row SHALL render in the kept copy's worktree section. Every other copy of that name SHALL NOT be a row, SHALL NOT be counted in the header or any section header, and SHALL NOT be expanded, confirmed, marked, archived, opened in a viewer or handed off. The shown row still acts only in its own worktree.

#### Scenario: A completed copy merged into a stacked branch

- **WHEN** the main worktree holds `col-27-swipe-touches-one-world` at 0/6, `col-27` holds it at 6/6, and `col-stack` holds it at 6/6 with the latest last-modified time
- **THEN** the list shows one `col-27-swipe-touches-one-world` row, at 6/6 in `col-stack`'s section, and neither the own nor the `col-27` copy is a row

#### Scenario: A stale main copy is hidden

- **WHEN** the main worktree's copy of a change is at 0/6 and a linked worktree's copy is at 6/6
- **THEN** one row shows 6/6 in the linked worktree, and the header counts the name once

#### Scenario: Equal progress takes the fresher copy

- **WHEN** two worktrees both hold a change at 6/6 and one copy was modified later
- **THEN** the later copy is the row, in its own section

#### Scenario: Unique names are unchanged

- **WHEN** every change name exists in one worktree only
- **THEN** the list renders exactly one row per name, as before

### Requirement: Live worktree refresh

On a local space the panel SHALL arm a folder watch on `openspec/changes` in every rendered worktree, as well as keeping its 15-second poll; a watch that cannot be armed SHALL leave the poll in place. On a remote space no folder watch SHALL be armed and the poll SHALL keep every section current. Each refresh SHALL discover worktrees again, so a worktree created, removed or pruned while the panel is open appears or disappears without a restart. A worktree that disappears SHALL take its section and its expanded change with it, and no key that named it SHALL remain in the panel's open, confirmation, mark-all, archive or toggle state.

#### Scenario: An agent ticks a task in its worktree

- **WHEN** `col-27/openspec/changes/add-oauth/tasks.md` changes while the panel is open
- **THEN** that section's counts and progress bar follow without waiting for the poll

#### Scenario: A worktree is added

- **WHEN** an agent creates a worktree with an OpenSpec change while the panel is open
- **THEN** its section appears on the next refresh

#### Scenario: A worktree is removed

- **WHEN** a linked worktree is removed while one of its changes is expanded
- **THEN** its section and fold-out disappear, and another worktree's same-named row is unaffected

#### Scenario: Remote space

- **WHEN** the panel follows a folder on a remote machine that has linked worktrees
- **THEN** no folder watch is armed and the 15-second poll refreshes every section
