## ADDED Requirements

### Requirement: Bulk archive in the selected LLM

The panel SHALL provide a **Bulk archive** action whenever it has a resolved repository and at least one active change. Pressing the action SHALL hand OpenSpec's bulk-archive command to Herdr's currently selected agent — the agent the agent list and agent block show — by sending `/opsx-bulk-archive` to that agent's terminal, on that agent's machine. The panel SHALL NOT run any `openspec archive` command for this action and SHALL NOT choose the changes to archive; the command's own workflow prompts for the selection, validates the changes, resolves conflicting delta specs, syncs the main specs, and archives.

If no agent is selected, the panel SHALL open a new agent tab in the panel's repository with the first installed agent and `/opsx-bulk-archive` as its first message. If the selected agent's live folder is not the panel's repository, or cannot be read, the panel SHALL NOT send the command to that agent; it SHALL open a new tab in the panel's repository with the selected agent's program when that program can be resolved, otherwise the first installed agent, and `/opsx-bulk-archive` as its first message. If no agent is installed, the agent list cannot be read, or the tab cannot start, the panel SHALL copy `/opsx-bulk-archive` to the clipboard and say so.

A toast SHALL confirm every hand-off — sent, opened, or copied. Only one hand-off SHALL be in flight at a time; a press while one is in flight SHALL do nothing. The single-change archive button and its two-click confirmation SHALL be unchanged.

#### Scenario: The selected agent receives the command

- **WHEN** the panel has a resolved repository, Herdr has a selected agent whose live folder is that repository, and the **Bulk archive** action is pressed
- **THEN** `/opsx-bulk-archive` is sent to that agent's terminal on its machine, a toast names the agent, and the panel runs no archive command and shows no archive spinner

#### Scenario: No selected agent

- **WHEN** the action is pressed and no agent is selected
- **THEN** a new agent tab opens in the panel's repository with `/opsx-bulk-archive` as its first message, and a toast says so

#### Scenario: Selected agent in another repository

- **WHEN** the action is pressed and the selected agent's live folder is not the panel's repository
- **THEN** no command is sent to that agent, and a new tab opens in the panel's repository with the selected agent's program (or the first installed agent when that program cannot be resolved) and `/opsx-bulk-archive` as its first message

#### Scenario: Selected agent's folder cannot be read

- **WHEN** the action is pressed and the selected agent's live folder cannot be read
- **THEN** it is treated as another repository: no command is sent, and the new-tab path in the previous scenario is taken

#### Scenario: No agent available

- **WHEN** no agent is installed, or the agent list cannot be read, or the new tab cannot start
- **THEN** `/opsx-bulk-archive` is copied to the clipboard, a toast says so, and no archive runs

#### Scenario: One hand-off at a time

- **WHEN** a hand-off is still in flight and the action is pressed again
- **THEN** nothing is sent or opened a second time

#### Scenario: No repository or no changes

- **WHEN** the panel has not resolved a repository, or the list holds no active changes
- **THEN** the **Bulk archive** action is not shown
