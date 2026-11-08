## MODIFIED Requirements

### Requirement: Task list parsing

The panel SHALL parse `tasks.md` into flat rows in file order: markdown headings (1–6 `#`) become section rows, and `- [ ]` / `- [x]` checkbox lines (dash or asterisk bullets) become task rows that remember their line number in the file. An indented continuation line (two or more leading spaces, non-blank, and not a flush-left heading or another checkbox line) that follows a task row SHALL fold into that row's entry, joined with a single space; a blank or flush-left line ends the entry. Each task row SHALL keep the checkbox line's own text as the text a toggle matches on, and the folded entry as the text shown.

#### Scenario: Sections and tasks

- **WHEN** `tasks.md` holds two `##` headings with checkboxes under each
- **THEN** the fold-out shows the headings as section rows and the checkboxes as task rows beneath them, in file order

#### Scenario: Wrapped task continuation

- **WHEN** a checkbox line is followed by indented continuation lines
- **THEN** the row shows the whole entry — the checkbox line's text and the continuations joined with spaces — and keeps the checkbox's own line number

#### Scenario: Continuation ends at a blank line

- **WHEN** a checkbox line is followed by an indented line, then a blank or flush-left line, then another indented line
- **THEN** only the first indented line folds into the entry and the later one is dropped

### Requirement: Display cap

The fold-out SHALL show at most the first 120 rows; beyond that it SHALL show "+ N more in tasks.md" pointing at the file. A task row SHALL show the entry's whole folded text, wrapped over as many lines as it needs; section headings that do not fit their width SHALL truncate. Resting the pointer on a task row or section heading SHALL show a styled hover card in the panel's own colours and surface, carrying the row's full text wrapped over as many lines as it needs rather than a single clipped line, and the card SHALL name the row's state — done or open for a task, section for a heading. The card SHALL stay open while the pointer moves from the row onto it.

#### Scenario: Long list

- **WHEN** a change's `tasks.md` holds 150 rows
- **THEN** the fold-out shows the first 120 and a "+ 30 more in tasks.md" line

#### Scenario: A multi-line entry reads in full

- **WHEN** a task entry's continuation lines make it longer than the panel's width
- **THEN** the fold-out row wraps to show the whole entry, and resting the pointer on it shows the same full text in a styled card

#### Scenario: Card stays open while reading

- **WHEN** the pointer moves from a task row onto its open hover card
- **THEN** the card stays open and the full text remains readable

#### Scenario: Card names the task state

- **WHEN** the pointer rests on a done task and then on an open task
- **THEN** each card names that task's state, done or open

#### Scenario: Section heading card

- **WHEN** a section heading is too long for the panel's width
- **THEN** it truncates and resting the pointer on it shows the full heading in a card that names it as a section
