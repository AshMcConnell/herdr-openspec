# change-state Specification

## Purpose
A change's task counts say where it stands at a glance. This capability fixes how the panel derives a state — complete, no tasks, unstarted, nearly done, in progress — from those counts, and how the state colours the row: its chip, its progress bar, and the green-through rendering of a finished change.
## Requirements
### Requirement: State derivation

The panel SHALL derive each change's state from its task counts: complete when it has tasks and all are done, "no tasks" when it has none, unstarted when it has tasks and none are done, nearly done when at most 2 tasks remain, and in progress otherwise. The 2-remaining threshold SHALL be fixed, not a percentage.

#### Scenario: Complete

- **WHEN** a change reports 5 of 5 tasks done
- **THEN** its state is complete

#### Scenario: No tasks

- **WHEN** a change reports 0 total tasks
- **THEN** its state is "no tasks", regardless of anything else

#### Scenario: Unstarted

- **WHEN** a change reports 0 of 4 tasks done
- **THEN** its state is unstarted

#### Scenario: Nearly done

- **WHEN** a change has 8 tasks and 6 are done (2 remaining)
- **THEN** its state is nearly done

#### Scenario: In progress

- **WHEN** a change has 10 tasks and 3 are done (7 remaining)
- **THEN** its state is in progress

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

### Requirement: Progress bar colour

The progress bar SHALL take the state's colour: the done colour when complete, the accent colour when nearly done, and the working colour otherwise. A change with no tasks SHALL show no bar at all.

#### Scenario: Colours follow state

- **WHEN** complete, nearly done, and in-progress rows are shown
- **THEN** their bars use the done, accent, and working colours respectively

### Requirement: Complete reads green through

A complete change SHALL read green throughout: its name, its task count, its chip, and its expanded task rows (once done) all use the done colour, so a finished change is recognisable at a glance.

#### Scenario: Finished change at a glance

- **WHEN** a complete change's task list is expanded
- **THEN** the name, the count, and its done task rows all render in the done colour

