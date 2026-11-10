# archive-flow Specification

## Purpose
Archiving moves a change out of `openspec/changes/` once it is finished (or abandoned) — OpenSpec's own command does it, with prompts the panel cannot answer. This capability is the panel's two-click path to that command: the confirmation chip, the run, and what happens on the list while it runs and after it lands.
## Requirements
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

The confirmed archive SHALL run `openspec archive <name> --yes` in the confirmed row's worktree, on that worktree's machine — `--yes` because the panel has no TTY to answer OpenSpec's prompts. An incomplete change SHALL proceed with OpenSpec's own warning instead of being blocked.

#### Scenario: Archive an incomplete change

- **WHEN** the user confirms the archive on a change with unfinished tasks
- **THEN** the command runs with `--yes` and OpenSpec proceeds, warning rather than prompting

#### Scenario: Archive a linked worktree's change

- **WHEN** the user confirms the archive on a row under `col-27`
- **THEN** `openspec archive <name> --yes` runs with `col-27` as its working directory, and the own worktree is untouched

### Requirement: Archive in-flight behaviour

While an archive runs, its row SHALL show a spinner and every other row's archive button SHALL be hidden, in every worktree section; further archive clicks SHALL be ignored until it settles. When it finishes, the archived change's fold-out SHALL collapse if it was open and the list SHALL refresh, both when the panel still shows that repository. No archive SHALL start when no repository root is known. A settled archive — success or failure — SHALL leave no spinner and no hidden archive buttons while the panel is still live.

#### Scenario: Single archive at a time

- **WHEN** an archive is running and the user clicks another row's archive button, in the same or another worktree
- **THEN** the other rows' buttons are hidden and the click cannot start a second archive

#### Scenario: After the archive

- **WHEN** the archive command finishes
- **THEN** the row's spinner stops, an open fold-out of that change collapses, and the list refreshes — the last two when the panel still shows that repository

#### Scenario: A failure frees the panel

- **WHEN** the archive command fails
- **THEN** the spinner stops, the archive buttons return and the list is refreshed when the panel still shows that repository

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

### Requirement: Archive failure recovery

When an archive fails, the panel SHALL present an "Archive failed" dialog naming the change and the error and asking "Archive <name> using AI?", with buttons **Archive using AI** and **Dismiss**. The dialog SHALL be modal, so a click beside it does not close it, and Esc and the buttons SHALL close it. **Archive using AI** SHALL open a new agent tab in the same space and the failed change's worktree whose first message is `/opsx-archive <name>`; when no agent is installed, or the agent list cannot be read, or the agent list is still loading, it SHALL copy `/opsx-archive <name>` to the clipboard instead and say so. The same offer SHALL be reachable from the failure toast's action for a short time after the failure. Only one such dialog SHALL be open at a time. Once the offer is dispatched or dismissed, the same failure SHALL NOT open the dialog again.

#### Scenario: Failure opens the offer

- **WHEN** an archive fails
- **THEN** a dialog titled "Archive failed" shows the change name and the error line and asks "Archive <name> using AI?"

#### Scenario: Hand it to an agent

- **WHEN** "Archive using AI" is pressed and an agent is available
- **THEN** a new agent tab opens in the same space and the failed change's worktree whose first message is `/opsx-archive <name>`, and the dialog closes

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

### Requirement: Bulk archive in the selected LLM

The panel SHALL provide a **Bulk archive** action whenever it has a resolved repository and at least one active change in its own worktree; a change that exists only in a linked worktree SHALL NOT show the action and SHALL NOT be archived by it. Pressing the action SHALL hand OpenSpec's bulk-archive command to Herdr's currently selected agent — the agent the agent list and agent block show — by sending `/opsx-bulk-archive` to that agent's terminal, on that agent's machine. The panel SHALL NOT run any `openspec archive` command for this action and SHALL NOT choose the changes to archive; the command's own workflow prompts for the selection, validates the changes, resolves conflicting delta specs, syncs the main specs, and archives.

If no agent is selected, the panel SHALL open a new agent tab in the panel's own worktree with the first installed agent and `/opsx-bulk-archive` as its first message. If the selected agent's live folder is not the panel's own worktree, or cannot be read, the panel SHALL NOT send the command to that agent; it SHALL open a new tab in the panel's own worktree with the selected agent's program when that program can be resolved, otherwise the first installed agent, and `/opsx-bulk-archive` as its first message. If no agent is installed, the agent list cannot be read, or the tab cannot start, the panel SHALL copy `/opsx-bulk-archive` to the clipboard and say so.

#### Scenario: Only linked worktrees have changes

- **WHEN** the panel's own worktree has no changes and `col-27` has two
- **THEN** the **Bulk archive** action is not shown

#### Scenario: Own worktree has changes

- **WHEN** the panel's own worktree has a change
- **THEN** the action is shown and its hand-off targets the panel's own worktree, regardless of linked sections above or below

