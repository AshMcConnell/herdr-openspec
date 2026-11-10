# change-list Specification

## Purpose
The OpenSpec panel for the Herdr desktop app shows the active space's OpenSpec changes as a live list. This capability covers where the panel reads from — which repository, on which machine — how it stays current, what each row shows, and how it explains an empty or broken state.
## Requirements
### Requirement: Location resolution

The panel SHALL resolve the repository it reads, in this order of preference: a `folder` prop pinned by the layout or `pane.split`, the working directory of the focused pane or focused layout terminal block, the last location resolved from a terminal in the active space when the focused item has no working directory of its own (the mod's own pane, another mod pane, or an overlay), the working directory of any pane in the active space, and finally the space's folder. The remembered location SHALL only be used while the active space is the one it was resolved in. The resolution SHALL be recomputed whenever the render runs, and a changed resolution SHALL reset the panel's state — list, expanded change, task rows, error, and any pending archive confirmation — before re-reading.

#### Scenario: Pinned folder wins

- **WHEN** the layout or `pane.split` pins the panel with a `folder` prop
- **THEN** the panel reads OpenSpec from that folder regardless of which pane is focused

#### Scenario: Follows the focused pane

- **WHEN** no folder is pinned and the focused pane or layout terminal block has a working directory
- **THEN** the panel reads OpenSpec from that directory, even if another pane in the space has a different folder

#### Scenario: Clicking the panel keeps its repository

- **WHEN** no folder is pinned, the panel is reading a repository resolved from a terminal, and the user then clicks the panel, an open change viewer, or the floating OpenSpec window so focus is on a mod pane or overlay with no folder
- **THEN** the panel keeps reading the same repository and does not switch to another pane's folder

#### Scenario: A new space resolves afresh

- **WHEN** the active space changes while focus has no folder of its own
- **THEN** the location remembered in the previous space is not used, and the panel resolves from the new space's panes or its folder

#### Scenario: Falls back through the space

- **WHEN** no folder is pinned, the focused item has no directory, no terminal location has been remembered for this space, but another pane in the active space has one
- **THEN** the panel reads OpenSpec from that pane's directory, else from the space's folder

#### Scenario: Nothing to read

- **WHEN** no pinned folder, pane directory, remembered location, or space folder resolves
- **THEN** the panel shows "No folder" and runs no commands

### Requirement: Remote machine follow

The panel SHALL resolve which machine the folder lives on from the focused item and space, and SHALL run every command and file read on that machine — omitting the machine label in the footer when it is the local one.

#### Scenario: Remote space

- **WHEN** the resolved folder lives on a remote machine
- **THEN** commands run on that machine and the footer shows the machine's name before the path

### Requirement: List source

The panel SHALL build its list from `openspec list --json` run in the resolved directory and in every linked worktree, as **worktree-progress** defines. The panel's own rows come from the resolved directory; each linked worktree's rows come from `openspec list --json` run in that worktree. Every row takes the change's name, completed and total task counts, last-modified time, and the CLI's own status. Change entries whose name begins with `.` SHALL be dropped from each listing's parsed output before the list is stored (see **Dot entries hidden**), so every remaining entry becomes a candidate row in its worktree's section; a name that several worktrees hold renders once, as **worktree-progress** defines. The panel SHALL NOT discover change names from the filesystem.

#### Scenario: Normal listing

- **WHEN** `openspec list --json` exits 0 with parseable output in the resolved directory
- **THEN** each non-dot entry becomes one row with its name, `done/total` counts, age, and status

#### Scenario: Linked worktree listing

- **WHEN** a linked worktree's `openspec list --json` exits 0 with parseable output
- **THEN** its non-dot entries become candidate rows in that worktree's section, with that worktree's counts and ages, and a name another worktree holds more completely is hidden there

#### Scenario: Change names come only from the CLI

- **WHEN** the panel needs a change's name — to read its `tasks.md`, archive it, or copy it
- **THEN** that name comes from an `openspec list` run in that change's worktree, never from typed input

#### Scenario: No linked worktree

- **WHEN** the repository has no linked worktree
- **THEN** the list is built from the resolved directory's listing alone, as before

### Requirement: Refresh triggers

The panel SHALL re-read the list on its first show, every 15 seconds, when a watch on the `openspec/changes` folder of any worktree it renders fires, when the pane or space switches, and when the header's refresh button is clicked. The watches SHALL be armed only for local spaces (remote spaces rely on the poll) and only for worktrees that have changes. The repository root SHALL be found on every refresh with `git rev-parse --show-toplevel`, falling back to the resolved directory itself when git fails; the worktree list SHALL be read after it with `git worktree list --porcelain`.

#### Scenario: First show and poll

- **WHEN** the panel is first shown and then left alone
- **THEN** the list is read at once and again every 15 seconds

#### Scenario: File watch on the own worktree

- **WHEN** a file under the own worktree's `openspec/changes/` changes in a local space
- **THEN** the list refreshes without waiting for the poll

#### Scenario: File watch on a linked worktree

- **WHEN** a file under a linked worktree's `openspec/changes/` changes in a local space
- **THEN** that section refreshes without waiting for the poll

#### Scenario: Remote spaces poll instead

- **WHEN** the folder lives on a remote machine
- **THEN** no folder watch is armed and the 15-second poll keeps every section current

#### Scenario: Worktree created or removed

- **WHEN** a worktree is added, removed or pruned while the panel is open
- **THEN** the next refresh discovers it and adds or drops its section

#### Scenario: Switch re-reads

- **WHEN** the pane or space switches to a different directory
- **THEN** the panel resets and re-reads at once, anchoring at the new repository root

#### Scenario: Manual refresh

- **WHEN** the ↻ button in the header is clicked
- **THEN** the list re-reads immediately

### Requirement: Row content

Each row SHALL show the change's name, its `done/total` task count when the change has tasks, a relative age for its last modification ("just now", then minutes, hours, days, then months), and a progress bar when the change has tasks.

#### Scenario: Full row

- **WHEN** a change has tasks and was modified 2 hours ago
- **THEN** its row shows the name, `done/total`, "2h ago", and a progress bar filled in proportion

#### Scenario: Taskless row

- **WHEN** a change has no tasks
- **THEN** its row shows the name without a count or progress bar

### Requirement: Command execution constraints

The panel SHALL run every command as an argument list — never through a shell — and SHALL NOT touch the network. Task writes SHALL only ever target `openspec/changes/<name>/tasks.md`, with `<name>` taken from `openspec list`, never typed input.

#### Scenario: Argument lists only

- **WHEN** the panel runs `openspec` or `git`
- **THEN** each call passes a program name and an argument list, with no shell in between

#### Scenario: Writes stay in the changes tree

- **WHEN** the panel writes a file at all
- **THEN** the path is `openspec/changes/<name>/tasks.md` for a change named by the list

### Requirement: Empty and error states

The panel SHALL explain itself instead of showing a blank list: "Loading changes…" while the first read is in flight or no location is known yet, "No active changes" when every worktree's listing succeeded and none listed a change, "openspec is not installed" when the CLI could not be run, "No OpenSpec here — run `openspec init`" when every worktree reported no changes directory, the first line of the CLI's error output for any other non-zero exit in the panel's own worktree, "Unexpected output from openspec list" when the panel's own JSON does not parse, and the error's text when the panel's own read throws. A linked worktree that reports no changes directory SHALL be omitted; a linked worktree that fails another way SHALL show its section with the first line of its error, without changing the panel-wide state. The panel's own worktree with no changes directory SHALL be treated as empty rather than a panel-wide error, so linked sections still render, and SHALL produce "No OpenSpec here — run `openspec init`" when no other worktree has a change.

#### Scenario: Empty repository

- **WHEN** every `openspec list --json` succeeds with no changes
- **THEN** the panel shows "No active changes"

#### Scenario: Empty everywhere, no OpenSpec anywhere

- **WHEN** every worktree reports no changes directory
- **THEN** the panel shows "No OpenSpec here — run `openspec init`"

#### Scenario: The own worktree is not initialised but a linked one is

- **WHEN** the resolved directory has no OpenSpec changes directory and a linked worktree has changes
- **THEN** the linked section renders and the panel shows no panel-wide error

#### Scenario: CLI missing

- **WHEN** the `openspec` command cannot be executed at all
- **THEN** the panel shows "openspec is not installed"

#### Scenario: No OpenSpec in the folder

- **WHEN** the CLI fails because the own folder has no OpenSpec changes directory
- **THEN** the panel shows no linked section error for it, and shows "No OpenSpec here — run `openspec init`" when no linked worktree has a change

#### Scenario: Other CLI failure

- **WHEN** the own worktree's CLI exits non-zero for any other reason
- **THEN** the panel shows the first line of its error output, or `openspec list failed (<code>)` when it printed nothing

#### Scenario: Unparseable output

- **WHEN** the own worktree's CLI exits 0 but prints JSON that does not parse
- **THEN** the panel shows "Unexpected output from openspec list"

#### Scenario: A linked worktree's error is local

- **WHEN** a linked worktree's listing fails
- **THEN** its section shows the error's first line and the other sections keep their rows

### Requirement: Footer

The panel SHALL show the folder it reads in a footer, prefixed with the machine's name and a colon when the folder is not on the local machine, and SHALL omit the footer when no repository root is known.

#### Scenario: Local repository

- **WHEN** the panel reads a local repository
- **THEN** the footer shows the repository root path alone

### Requirement: Floating window close

The panel SHALL show a × button in its header when it is shown as a floating window, and SHALL omit it when docked.

#### Scenario: Floating close button

- **WHEN** the panel is shown as a floating window (it carries an overlay reference)
- **THEN** the header shows a × button that closes it

#### Scenario: Docked panel

- **WHEN** the panel is docked in a layout block with no overlay reference
- **THEN** the header shows no × button

### Requirement: Dot entries hidden

The panel SHALL ignore any change entry whose name begins with `.` — dropped from each worktree's parsed `openspec list --json` output before the list is stored, in local and remote spaces alike. The header counts, the done/total totals, the filter, sorting, state grouping, the worktree section totals and the empty state SHALL all follow the filtered lists, and a hidden entry SHALL never reach a file path or a command. When every entry a worktree lists is a dot entry, that worktree SHALL show its normal empty state — its section omitted — not an error.

#### Scenario: A dot change is not listed

- **WHEN** the own worktree's `openspec list --json` returns a `.draft` entry beside real ones
- **THEN** only the real ones become rows, and the counts, totals, sorting and grouping follow the filtered set

#### Scenario: A dot change in a linked worktree

- **WHEN** a linked worktree's listing returns a `.draft` entry beside real ones
- **THEN** only the real ones become rows in that section

#### Scenario: Only dot entries

- **WHEN** every entry a worktree lists begins with `.`
- **THEN** that worktree shows no section and no error

#### Scenario: Non-dot entries unaffected

- **WHEN** the listing holds only ordinary names
- **THEN** the panel renders exactly as before

#### Scenario: A dot name never reaches a path or command

- **WHEN** the panel needs a change's name — to read its `tasks.md`, archive it, view it or copy it
- **THEN** no dot-prefixed name can be that name, because none is stored

#### Scenario: Remote spaces filter the same

- **WHEN** the folder lives on a remote machine
- **THEN** each worktree's parsed listing is filtered identically, with no extra commands on that machine

