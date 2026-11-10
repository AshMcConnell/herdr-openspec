## MODIFIED Requirements

### Requirement: Name filter

The panel SHALL provide a filter box that narrows the list to changes whose name contains the typed text, matched case-insensitively as a substring, across every worktree section. The filter SHALL match change names only — not task text or specs. Pressing `Esc` while typing SHALL clear the filter, a × button SHALL appear beside the box to clear it, and the header count SHALL show `matched/total` while a filter is active instead of the plain count, where the total covers every worktree and counts each change name once. A section whose changes all fail to match SHALL not render. Each worktree section header's count and task totals SHALL follow that section's visible rows.

#### Scenario: Filter narrows the list

- **WHEN** the own worktree holds "add-oauth" and `col-27` holds "fix-parser", and the user types "OAUTH"
- **THEN** only "add-oauth" is shown, and `col-27`'s section is hidden

#### Scenario: Escape clears

- **WHEN** a filter is active and the user presses `Esc` in the filter box
- **THEN** the filter clears, every section returns, and focus returns to the panel

#### Scenario: Clear button

- **WHEN** a filter is active
- **THEN** a × button is shown next to the filter box and clicking it clears the filter

#### Scenario: Count while filtering

- **WHEN** a filter matches 2 of 7 changes spread over two worktrees
- **THEN** the header count reads "2/7" until the filter is cleared

#### Scenario: Task totals follow the filter

- **WHEN** a filter is active
- **THEN** the header's done/total task chip counts only the matched changes

#### Scenario: Section totals follow the filter

- **WHEN** a filter leaves one of `col-27`'s two changes visible
- **THEN** its header reads `1/2 changes` and counts only that change's tasks

### Requirement: Sort modes

The panel SHALL provide a sort button that cycles through four modes — recent (the CLI's own last-modified-first order), A–Z (alphabetical by change name using locale-aware comparison), % done (highest completion ratio first, ties broken by the larger total), and state — showing the current mode's label on the button. Each mode SHALL apply inside every worktree section; the sections themselves SHALL keep their fixed order — the panel's own worktree first, then linked worktrees by label.

#### Scenario: Cycling

- **WHEN** the sort button is clicked four times from "recent"
- **THEN** the label steps through A–Z, % done, state, and back to recent

#### Scenario: Percent-done ordering

- **WHEN** sorting by % done, a change at 9/10 and one at 1/2 are listed in one section
- **THEN** the 9/10 change comes first; if two ratios tie, the change with more tasks comes first

#### Scenario: Sorting stays inside a section

- **WHEN** the sort is A–Z and the own worktree's last change sorts after `col-27`'s first
- **THEN** `col-27`'s rows still follow the own worktree's section, sorted among themselves

### Requirement: State grouping

The state sort SHALL group each worktree section's rows under headers — ✓ Complete, Nearly done, In progress, Unstarted, No tasks, in that order — each header showing how many of that section's changes are in its group, with changes keeping the CLI's recent-first order inside their group. The worktree section header SHALL stay above its state groups.

#### Scenario: Grouped list

- **WHEN** the state sort is active with changes in several states in one worktree
- **THEN** that section shows one header per occupied state with its count, in the fixed order, and the changes under each header stay most-recent-first

#### Scenario: Every section groups its own rows

- **WHEN** the state sort is active with changes in two worktrees
- **THEN** each worktree section carries its own state headers, and no state group spans sections
