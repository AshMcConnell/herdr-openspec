## MODIFIED Requirements

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
