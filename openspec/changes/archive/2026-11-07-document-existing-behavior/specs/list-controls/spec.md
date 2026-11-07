## ADDED Requirements

### Requirement: Name filter

The panel SHALL provide a filter box that narrows the list to changes whose name contains the typed text, matched case-insensitively as a substring. The filter SHALL match change names only — not task text or specs. Pressing `Esc` while typing SHALL clear the filter, a × button SHALL appear beside the box to clear it, and the header count SHALL show `matched/total` while a filter is active instead of the plain count.

#### Scenario: Filter narrows the list

- **WHEN** the list holds "add-oauth" and "fix-parser" and the user types "OAUTH"
- **THEN** only "add-oauth" is shown

#### Scenario: Escape clears

- **WHEN** a filter is active and the user presses `Esc` in the filter box
- **THEN** the filter clears, the full list returns, and focus returns to the panel

#### Scenario: Clear button

- **WHEN** a filter is active
- **THEN** a × button is shown next to the filter box and clicking it clears the filter

#### Scenario: Count while filtering

- **WHEN** a filter matches 2 of 7 changes
- **THEN** the header count reads "2/7" until the filter is cleared

#### Scenario: Task totals follow the filter

- **WHEN** a filter is active
- **THEN** the header's done/total task chip counts only the matched changes

### Requirement: No-match state

The panel SHALL show "No changes match" with the typed text when a filter is active and matches no change — not the empty-state messages used for an empty repository.

#### Scenario: Nothing matches

- **WHEN** the user types "zzz" and no change name contains it
- **THEN** the list area shows the no-match message with "zzz"

### Requirement: Sort modes

The panel SHALL provide a sort button that cycles through four modes — recent (the CLI's own last-modified-first order), A–Z (alphabetical by change name using locale-aware comparison), % done (highest completion ratio first, ties broken by the larger total), and state — showing the current mode's label on the button.

#### Scenario: Cycling

- **WHEN** the sort button is clicked four times from "recent"
- **THEN** the label steps through A–Z, % done, state, and back to recent

#### Scenario: Percent-done ordering

- **WHEN** sorting by % done, a change at 9/10 and one at 1/2 are listed
- **THEN** the 9/10 change comes first; if two ratios tie, the change with more tasks comes first

### Requirement: Sort persistence

The panel SHALL remember the chosen sort mode in `localStorage` under the key "sort" and SHALL restore it on the next show; a stored value that is not one of the four modes SHALL fall back to recent.

#### Scenario: Remembered

- **WHEN** the user picks "state" and reopens the panel later
- **THEN** the sort starts at "state"

#### Scenario: Invalid stored value

- **WHEN** `localStorage` holds a sort key the panel does not know
- **THEN** the sort starts at "recent"

### Requirement: State grouping

The state sort SHALL group the list under headers — ✓ Complete, Nearly done, In progress, Unstarted, No tasks, in that order — each header showing how many changes are in its group, with changes keeping the CLI's recent-first order inside their group.

#### Scenario: Grouped list

- **WHEN** the state sort is active with changes in several states
- **THEN** the list shows one header per occupied state with its count, in the fixed order, and the changes under each header stay most-recent-first
