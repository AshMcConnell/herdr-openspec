## MODIFIED Requirements

### Requirement: Expand and collapse

Clicking a change's row SHALL fold out that change's task list, read from its `tasks.md` under `openspec/changes/<name>/`; clicking the row again SHALL fold it away. When a change viewer for the panel's repository and machine is registered, the click that folds a change's tasks out SHALL also ask the most recently opened viewer to switch to that change, without waiting for an acknowledgement. Clicking the row that is already open, and clicking the change the viewer already shows, SHALL leave the viewer alone, and a viewer for another repository or machine SHALL NOT be switched. Opening one change SHALL collapse any pending archive confirmation, and a change that disappears from the list SHALL fold away on the next refresh.

#### Scenario: Fold out and away

- **WHEN** the user clicks a change's row and then clicks it again
- **THEN** the task list folds out on the first click and folds away on the second

#### Scenario: Fold out and switch the viewer

- **WHEN** a viewer for this repository and machine is open and the user clicks another change's row
- **THEN** that change's task list folds out and the viewer switches to that change

#### Scenario: No viewer open

- **WHEN** no change viewer is registered and the user clicks a change's row
- **THEN** the task list folds out and nothing else opens or switches

#### Scenario: Clicking the open row again

- **WHEN** a row is already folded out and the user clicks it again
- **THEN** the task list folds away and the viewer keeps showing its current change

#### Scenario: Another repository's viewer

- **WHEN** the only registered viewer belongs to another repository or machine
- **THEN** clicking a row folds its tasks without switching that viewer

#### Scenario: Change archived or deleted elsewhere

- **WHEN** an expanded change is no longer in the list after a refresh
- **THEN** the panel folds it away without waiting for a click
