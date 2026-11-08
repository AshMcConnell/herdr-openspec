## MODIFIED Requirements

### Requirement: Display cap

The fold-out SHALL show at most the first 120 rows; beyond that it SHALL show "+ N more in tasks.md" pointing at the file. Rows and section headings that do not fit their width SHALL truncate. Resting the pointer on a task row or section heading SHALL show a styled hover card in the panel's own colours and surface, carrying the row's full text wrapped over as many lines as it needs rather than a single clipped line, and the card SHALL name the row's state — done or open for a task, section for a heading. The card SHALL stay open while the pointer moves from the row onto it.

#### Scenario: Long list

- **WHEN** a change's `tasks.md` holds 150 rows
- **THEN** the fold-out shows the first 120 and a "+ 30 more in tasks.md" line

#### Scenario: Hover for the full text

- **WHEN** a task row is too long for the panel's width
- **THEN** it truncates to the row and resting the pointer on it shows a styled card with the whole line wrapped over multiple lines

#### Scenario: Card stays open while reading

- **WHEN** the pointer moves from a task row onto its open hover card
- **THEN** the card stays open and the full text remains readable

#### Scenario: Card names the task state

- **WHEN** the pointer rests on a done task and then on an open task
- **THEN** each card names that task's state, done or open

#### Scenario: Section heading card

- **WHEN** a section heading is too long for the panel's width
- **THEN** it truncates and resting the pointer on it shows the full heading in a card that names it as a section
