## MODIFIED Requirements

### Requirement: Progress bar colour

The progress bar SHALL take the state's colour: the complete green (see **Complete reads green through**) when complete, the accent colour when nearly done, and the working colour otherwise. A change with no tasks SHALL show no bar at all.

#### Scenario: Colours follow state

- **WHEN** complete, nearly done, and in-progress rows are shown
- **THEN** their bars use the complete green, the accent colour, and the working colour respectively

### Requirement: Complete reads green through

A complete change SHALL read green throughout: its name, its task count, its `✓ complete` chip, its progress bar, its `✓ Complete` state group header, and its expanded task rows (once done) all use the theme's bright ANSI green (`ansi10`), falling back to its normal ANSI green (`ansi2`), and then to a fixed green. They SHALL NOT use the theme's `done` colour, which is an agent-status colour and may be blue or another accent. The green SHALL make a finished change recognisable at a glance. A single task tick in a change that is not yet complete SHALL use the same green for the tick mark.

#### Scenario: Finished change at a glance

- **WHEN** a complete change's task list is expanded
- **THEN** the name, the count, the chip, the bar, the state group header, and its done task rows all render in the theme's green

#### Scenario: A blue done status does not make completion blue

- **WHEN** the app theme's `done` colour is not green (graphite's is blue)
- **THEN** a complete change still renders green

#### Scenario: Ticks share the green

- **WHEN** a task row is ticked in the change list, whether or not its change is complete
- **THEN** the tick mark uses the same green as a complete change
