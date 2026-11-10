## MODIFIED Requirements

### Requirement: List source

The panel SHALL build its list from `openspec list --json` run in the resolved directory: each row takes the change's name, completed and total task counts, last-modified time, and the CLI's own status. Change entries whose name begins with `.` SHALL be dropped from the parsed output before the list is stored (see **Dot entries hidden**), so every remaining entry becomes one row. The panel SHALL NOT discover change names from the filesystem.

#### Scenario: Normal listing

- **WHEN** `openspec list --json` exits 0 with parseable output
- **THEN** each non-dot entry becomes one row with its name, `done/total` counts, age, and status

#### Scenario: Change names come only from the CLI

- **WHEN** the panel needs a change's name — to read its `tasks.md`, archive it, or copy it
- **THEN** that name comes from `openspec list` output, never from typed input

## ADDED Requirements

### Requirement: Dot entries hidden

The panel SHALL ignore any change entry whose name begins with `.` — dropped from the parsed `openspec list --json` output before the list is stored, in local and remote spaces alike. The header counts, the done/total totals, the filter, sorting, state grouping and the empty state SHALL all follow the filtered list, and a hidden entry SHALL never reach a file path or a command. When every entry the CLI lists is a dot entry, the panel SHALL show its normal empty state for a successful empty listing, not an error.

#### Scenario: A dot change is not listed

- **WHEN** `openspec list --json` returns a `.draft` entry beside real ones
- **THEN** only the real ones become rows, and the counts, totals, sorting and grouping follow the filtered set

#### Scenario: Only dot entries

- **WHEN** every entry the CLI lists begins with a dot
- **THEN** the panel shows "No active changes" and no error

#### Scenario: Non-dot entries unaffected

- **WHEN** the listing holds only ordinary names
- **THEN** the panel renders exactly as before

#### Scenario: A dot name never reaches a path or command

- **WHEN** the panel needs a change's name — to read its `tasks.md`, archive it, view it or copy it
- **THEN** no dot-prefixed name can be that name, because none is stored

#### Scenario: Remote spaces filter the same

- **WHEN** the folder lives on a remote machine
- **THEN** the parsed listing is filtered identically, with no extra commands on that machine
