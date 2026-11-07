## MODIFIED Requirements

### Requirement: Location resolution

The panel SHALL resolve the repository it reads, in this order of preference: a `folder` prop pinned by the layout or `pane.split`, the working directory of the focused pane or focused layout terminal block, the last location resolved from a terminal in the active space when the focused item has no working directory of its own (the mod's own pane, another mod pane, or an overlay), the working directory of any pane in the active space, and finally the space's folder. The remembered location SHALL only be used while the active space is the one it was resolved in. The resolution SHALL be recomputed whenever the render runs, and a changed resolution SHALL reset the panel's state — list, expanded change, task rows, error, and any pending archive confirmation — before re-reading.

#### Scenario: Pinned folder wins

- **WHEN** the layout or `pane.split` pins the panel with a `folder` prop
- **THEN** the panel reads OpenSpec from that folder regardless of which pane is focused

#### Scenario: Follows the focused pane

- **WHEN** no folder is pinned and the focused pane or layout terminal block has a working directory
- **THEN** the panel reads OpenSpec from that directory, even if another pane in the space has a different folder

#### Scenario: Clicking the panel keeps its repository

- **WHEN** no folder is pinned, the panel is reading a repository resolved from a terminal, and the user then clicks the panel, an open change viewer, or the floating OpenSpec window so focus is on a mod pane or overlay with no folder
- **THEN** the panel keeps reading the same repository and does not switch to another pane's folder

#### Scenario: A new space resolves afresh

- **WHEN** the active space changes while focus has no folder of its own
- **THEN** the location remembered in the previous space is not used, and the panel resolves from the new space's panes or its folder

#### Scenario: Falls back through the space

- **WHEN** no folder is pinned, the focused item has no directory, no terminal location has been remembered for this space, but another pane in the active space has one
- **THEN** the panel reads OpenSpec from that pane's directory, else from the space's folder

#### Scenario: Nothing to read

- **WHEN** no pinned folder, pane directory, remembered location, or space folder resolves
- **THEN** the panel shows "No folder" and runs no commands
