## ADDED Requirements

### Requirement: Hidden capabilities

The viewer SHALL ignore a delta-spec capability whose name begins with `.` — skipped when the specs listing parses the `find` output, in local and remote panes alike. A hidden capability SHALL NOT be rendered in the specs tab and SHALL NOT count as a delta spec for the tab's presence: a change whose only spec is hidden behaves as a change with no specs. The rule is a listing filter only — a viewer pane opened directly with a dot-named change's path still reads and renders what its props name.

#### Scenario: A dot capability is not listed

- **WHEN** a change's `specs/` holds `.backup/spec.md` beside `task-tracking/spec.md`
- **THEN** the specs tab renders only `task-tracking`, under its own heading

#### Scenario: Only a dot capability

- **WHEN** a change's `specs/` holds only `.backup/spec.md`
- **THEN** the viewer shows no specs tab, as a change with no specs

#### Scenario: Non-dot capabilities unaffected

- **WHEN** every capability directory has an ordinary name
- **THEN** the specs tab renders exactly as before

#### Scenario: A direct pane on a dot change

- **WHEN** a viewer pane is opened with a `file` prop inside a dot-named change
- **THEN** the pane still reads and renders that change's artifacts

#### Scenario: Remote panes filter the same

- **WHEN** the change lives on a remote machine
- **THEN** the parsed `find` output is filtered identically, with no extra commands
