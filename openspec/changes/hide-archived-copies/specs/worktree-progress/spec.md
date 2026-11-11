## MODIFIED Requirements

### Requirement: Worktree listings

For every linked worktree, the panel SHALL run `openspec list --json` in that worktree, on the same machine, in parallel with the other worktrees' reads. Each listing SHALL be parsed and filtered exactly like the panel's own listing: dot-prefixed entries dropped before storing, every remaining entry mapped to a candidate row with its name, task counts, last-modified time and status. An active copy in a linked worktree whose name is archived in the panel's own worktree SHALL NOT be a candidate, as **Archived copies are hidden** defines. One row per change name is then chosen from the candidates, as **One row per change name** defines. A linked worktree whose listing reports no OpenSpec changes directory SHALL be omitted. A linked worktree whose listing fails any other way SHALL render its section with the first line of the error and SHALL NOT stop the other sections from rendering. Change names SHALL come only from `openspec list`; the panel SHALL NOT discover them from the filesystem, except for the archive folder names read only to hide stale copies.

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
- **THEN** every change name comes from an `openspec list` run in its worktree; the archive folder names are read only to hide stale copies and never become a row, path or command

## ADDED Requirements

### Requirement: Archived copies are hidden

Once per refresh, on the panel's machine, the panel SHALL read the folder names under its own worktree's `openspec/changes/archive/`. An active copy of a change in a linked worktree whose name equals one of those archive folder names, after removing a leading `YYYY-MM-DD-`, SHALL be treated as a stale leftover: it SHALL NOT become a row, SHALL NOT be counted in the header or a section header, and SHALL NOT be expanded, confirmed, marked, archived, opened in a viewer or handed off. Active changes in the panel's own worktree SHALL NOT be hidden by its own archive. A missing archive directory, an unreadable one, or a failed read SHALL hide nothing and SHALL NOT surface an error. Archive names SHALL never become a row, path or command.

#### Scenario: A branch cut before the archive

- **WHEN** the own worktree has archived `m54-join-on-grid` and a linked worktree still lists an active `m54-join-on-grid`
- **THEN** the linked section shows no `m54-join-on-grid` row, and its header count leaves the name out

#### Scenario: Unique work stays

- **WHEN** a linked worktree lists `col-27-swipe-touches-one-world` and the own worktree's archive does not hold that name
- **THEN** the change still renders as a row in the winning copy's section

#### Scenario: The own worktree is not filtered

- **WHEN** the own worktree lists a change and its archive holds the same name
- **THEN** the own active row still renders

#### Scenario: No archive directory

- **WHEN** the own worktree has no `openspec/changes/archive/` directory
- **THEN** every listing renders as it did before this change, and no error is shown

#### Scenario: Archive read fails

- **WHEN** the archive read exits non-zero or throws
- **THEN** every listing renders as it did before this change, and no error is shown
