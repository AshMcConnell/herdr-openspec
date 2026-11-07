## MODIFIED Requirements

### Requirement: Progress bar colour

The progress bar SHALL take the state's colour: the done colour when complete, the accent colour when nearly done, and the working colour otherwise. A change with no tasks SHALL show no bar at all.

#### Scenario: Colours follow state

- **WHEN** complete, nearly done, and in-progress rows are shown
- **THEN** their bars use the done, accent, and working colours respectively

### Requirement: State chips

Each row SHALL carry a chip for its state: a green `✓ complete` when complete, an accent-coloured `N left` (the remaining count) when nearly done, `unstarted` when unstarted, and `no tasks` when the change has none. An in-progress change SHALL show the CLI's own status as the chip only when it has one and it is not literally "in-progress"; otherwise no chip.

#### Scenario: Chips per state

- **WHEN** rows for a complete, nearly done, unstarted, and taskless change are shown
- **THEN** their chips read `✓ complete`, `2 left`, `unstarted`, and `no tasks` respectively

#### Scenario: In-progress status chip

- **WHEN** a change is in progress and the CLI reports a status other than "in-progress" (for example "blocked")
- **THEN** the row shows that status text as its chip

#### Scenario: Plain in-progress

- **WHEN** a change is in progress and the CLI's status is "in-progress" or empty
- **THEN** the row shows no chip
