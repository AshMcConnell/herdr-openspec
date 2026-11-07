## ADDED Requirements

### Requirement: Two-click archive confirmation

Every row SHALL carry an archive button (a box icon, a touch brighter on complete changes). The first click SHALL arm it — turning it into a red "Archive?" chip — for 6 seconds; the confirmation SHALL lapse when the 6 seconds pass or when any other click interferes (such as picking the change). The second click on the chip SHALL start the archive.

#### Scenario: Arm then confirm

- **WHEN** the archive button is clicked once and then the red "Archive?" chip is clicked within 6 seconds
- **THEN** the archive starts

#### Scenario: Confirmation lapses

- **WHEN** the archive button is clicked once and nothing else for 6 seconds
- **THEN** the chip reverts to the plain archive button and no archive runs

#### Scenario: Something else clicked

- **WHEN** the chip is armed and the user clicks the row (or anything else that changes the panel)
- **THEN** the pending confirmation is dropped and no archive runs

### Requirement: Archive command

The confirmed archive SHALL run `openspec archive <name> --yes` in the resolved directory, on the folder's machine — `--yes` because the panel has no TTY to answer OpenSpec's prompts. An incomplete change SHALL proceed with OpenSpec's own warning instead of being blocked.

#### Scenario: Archive an incomplete change

- **WHEN** the user confirms the archive on a change with unfinished tasks
- **THEN** the command runs with `--yes` and OpenSpec proceeds, warning rather than prompting

### Requirement: Archive in-flight behaviour

While an archive runs, its row SHALL show a spinner and every other row's archive button SHALL be hidden; further archive clicks SHALL be ignored until it settles. When it finishes, the archived change's fold-out SHALL collapse if it was open and the list SHALL refresh. No archive SHALL start when no repository root is known.

#### Scenario: Single archive at a time

- **WHEN** an archive is running and the user clicks another row's archive button
- **THEN** the other rows' buttons are hidden and the click cannot start a second archive

#### Scenario: After the archive

- **WHEN** the archive command finishes
- **THEN** the row's spinner stops, an open fold-out of that change collapses, and the list refreshes

### Requirement: Archive result toast

The panel SHALL report the archive's outcome by toast: "Change archived" with the command on success, or "Archive failed" with the error's last line (up to 300 characters) on failure.

#### Scenario: Success

- **WHEN** `openspec archive <name> --yes` exits 0
- **THEN** a success toast reads "Change archived" and names the command

#### Scenario: Failure

- **WHEN** the command exits non-zero or cannot be run
- **THEN** an error toast reads "Archive failed" and shows the error's last line
