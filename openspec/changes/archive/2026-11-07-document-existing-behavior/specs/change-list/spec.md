## ADDED Requirements

### Requirement: Location resolution

The panel SHALL resolve the repository it reads, in this order of preference: a `folder` prop pinned by the layout or `pane.split`, the working directory of the focused pane, the working directory of any pane in the active space, the focused item's own directory, and finally the space's folder. The resolution SHALL be recomputed whenever the render runs, and a changed resolution SHALL reset the panel's state — list, expanded change, task rows, error, and any pending archive confirmation — before re-reading.

#### Scenario: Pinned folder wins

- **WHEN** the layout or `pane.split` pins the panel with a `folder` prop
- **THEN** the panel reads OpenSpec from that folder regardless of which pane is focused

#### Scenario: Follows the focused pane

- **WHEN** no folder is pinned and the focused pane has a working directory
- **THEN** the panel reads OpenSpec from that pane's directory

#### Scenario: Falls back through the space

- **WHEN** no folder is pinned, the focused pane has no directory, but another pane in the active space has one
- **THEN** the panel reads OpenSpec from that pane's directory, else from the space's folder

#### Scenario: Nothing to read

- **WHEN** no pinned folder, pane directory, or space folder resolves
- **THEN** the panel shows "No folder" and runs no commands

### Requirement: Remote machine follow

The panel SHALL resolve which machine the folder lives on from the focused item and space, and SHALL run every command and file read on that machine — omitting the machine label in the footer when it is the local one.

#### Scenario: Remote space

- **WHEN** the resolved folder lives on a remote machine
- **THEN** commands run on that machine and the footer shows the machine's name before the path

### Requirement: List source

The panel SHALL build its list from `openspec list --json` run in the resolved directory: each row takes the change's name, completed and total task counts, last-modified time, and the CLI's own status. The panel SHALL NOT discover change names from the filesystem.

#### Scenario: Normal listing

- **WHEN** `openspec list --json` exits 0 with parseable output
- **THEN** each entry becomes one row with its name, `done/total` counts, age, and status

#### Scenario: Change names come only from the CLI

- **WHEN** the panel needs a change's name — to read its `tasks.md`, archive it, or copy it
- **THEN** that name comes from `openspec list` output, never from typed input

### Requirement: Refresh triggers

The panel SHALL re-read the list on its first show, every 15 seconds, when a watch on `<repository-root>/openspec/changes` fires, when the pane or space switches, and when the header's refresh button is clicked. The watch SHALL be armed only for local spaces (remote spaces rely on the poll), and the repository root SHALL be found once per switch with `git rev-parse --show-toplevel`, falling back to the resolved directory itself when git fails.

#### Scenario: First show and poll

- **WHEN** the panel is first shown and then left alone
- **THEN** the list is read at once and again every 15 seconds

#### Scenario: File watch on a local space

- **WHEN** a file under `openspec/changes/` changes in a local space
- **THEN** the list refreshes without waiting for the poll

#### Scenario: Remote spaces poll instead

- **WHEN** the folder lives on a remote machine
- **THEN** no folder watch is armed and the 15-second poll keeps the list current

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

The panel SHALL explain itself instead of showing a blank list: "Loading changes…" while the first read is in flight or no location is known yet, "No active changes" when the CLI succeeded but listed none, "openspec is not installed" when the CLI could not be run, "No OpenSpec here — run `openspec init`" when the CLI reports there is no changes directory, the first line of the CLI's error output for any other non-zero exit, "Unexpected output from openspec list" when the JSON does not parse, and the error's text when the read itself throws.

#### Scenario: Empty repository

- **WHEN** `openspec list --json` succeeds with no changes
- **THEN** the panel shows "No active changes"

#### Scenario: CLI missing

- **WHEN** the `openspec` command cannot be executed at all
- **THEN** the panel shows "openspec is not installed"

#### Scenario: No OpenSpec in the folder

- **WHEN** the CLI fails because the folder has no OpenSpec changes directory
- **THEN** the panel shows "No OpenSpec here — run `openspec init`"

#### Scenario: Other CLI failure

- **WHEN** the CLI exits non-zero for any other reason
- **THEN** the panel shows the first line of its error output, or `openspec list failed (<code>)` when it printed nothing

#### Scenario: Unparseable output

- **WHEN** the CLI exits 0 but prints JSON that does not parse
- **THEN** the panel shows "Unexpected output from openspec list"

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
