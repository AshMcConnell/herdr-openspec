## MODIFIED Requirements

### Requirement: Archive result toast

The panel SHALL report the archive's outcome by toast: "Change archived" with the command on success, or "Archive failed" with a reason on failure (up to 300 characters). The failure body SHALL name a reason — the error's last non-empty line, or `exit N` when the streams are blank — and never be an empty body. The report SHALL be posted even when the follow-up list refresh fails or the panel has moved to another folder.

#### Scenario: Success

- **WHEN** `openspec archive <name> --yes` exits 0
- **THEN** a success toast reads "Change archived" and names the command

#### Scenario: Failure

- **WHEN** the command exits non-zero or cannot be run
- **THEN** an error toast reads "Archive failed" and shows the error's last non-empty line

#### Scenario: Blank error stream

- **WHEN** the command fails with empty or whitespace-only stderr and stdout
- **THEN** the toast body reads `exit <code>`

#### Scenario: The report survives the refresh

- **WHEN** the list refresh after the archive throws or the panel has moved on
- **THEN** the toast is still posted and the panel accepts another archive

### Requirement: Archive in-flight behaviour

While an archive runs, its row SHALL show a spinner and every other row's archive button SHALL be hidden; further archive clicks SHALL be ignored until it settles. When it finishes, the archived change's fold-out SHALL collapse if it was open and the list SHALL refresh, both when the panel still shows that repository. No archive SHALL start when no repository root is known. A settled archive — success or failure — SHALL leave no spinner and no hidden archive buttons while the panel is still live.

#### Scenario: Single archive at a time

- **WHEN** an archive is running and the user clicks another row's archive button
- **THEN** the other rows' buttons are hidden and the click cannot start a second archive

#### Scenario: After the archive

- **WHEN** the archive command finishes
- **THEN** the row's spinner stops, an open fold-out of that change collapses, and the list refreshes — the last two when the panel still shows that repository

#### Scenario: A failure frees the panel

- **WHEN** the archive command fails
- **THEN** the spinner stops, the archive buttons return and the list is refreshed when the panel still shows that repository

## ADDED Requirements

### Requirement: Archive failure recovery

When an archive fails, the panel SHALL present an "Archive failed" dialog naming the change and the error and asking "Archive <name> using AI?", with buttons **Archive using AI** and **Dismiss**. The dialog SHALL be modal, so a click beside it does not close it, and Esc and the buttons SHALL close it. **Archive using AI** SHALL open a new agent tab in the same space and repository whose first message is `/opsx-archive <name>`; when no agent is installed, or the agent list cannot be read, or the agent list is still loading, it SHALL copy `/opsx-archive <name>` to the clipboard instead and say so. The same offer SHALL be reachable from the failure toast's action for a short time after the failure. Only one such dialog SHALL be open at a time. Once the offer is dispatched or dismissed, the same failure SHALL NOT open the dialog again.

#### Scenario: Failure opens the offer

- **WHEN** an archive fails
- **THEN** a dialog titled "Archive failed" shows the change name and the error line and asks "Archive <name> using AI?"

#### Scenario: Hand it to an agent

- **WHEN** "Archive using AI" is pressed and an agent is available
- **THEN** a new agent tab opens in the same space and repository whose first message is `/opsx-archive <name>`, and the dialog closes

#### Scenario: No agent available

- **WHEN** no agent is installed, or the agent list cannot be read, or the agent list is still loading
- **THEN** the command `/opsx-archive <name>` is copied to the clipboard, a toast says so, and the dialog closes

#### Scenario: Toast opens the same offer

- **WHEN** the failure toast's action is run
- **THEN** the same dialog opens

#### Scenario: Dismiss

- **WHEN** Dismiss is pressed or Esc
- **THEN** the dialog closes, no command runs, and that failure's offer cannot be reopened

#### Scenario: A newer failure wins

- **WHEN** a second archive fails while the dialog is open
- **THEN** the dialog shows the newer failure

#### Scenario: One shot

- **WHEN** the recovery has been dispatched
- **THEN** the dialog is closed, a further press does nothing, and the toast action no longer opens that offer
