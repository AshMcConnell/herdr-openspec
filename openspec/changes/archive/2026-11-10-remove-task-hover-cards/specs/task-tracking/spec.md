## MODIFIED Requirements

### Requirement: Display cap

The fold-out SHALL show at most the first 120 rows; beyond that it SHALL show "+ N more in tasks.md" pointing at the file. A task row SHALL show the entry's whole folded text, wrapped over as many lines as it needs; section headings that do not fit their width SHALL truncate.

#### Scenario: Long list

- **WHEN** a change's `tasks.md` holds 150 rows
- **THEN** the fold-out shows the first 120 and a "+ 30 more in tasks.md" line

#### Scenario: A multi-line entry reads in full

- **WHEN** a task entry's continuation lines make it longer than the panel's width
- **THEN** the fold-out row wraps to show the whole entry

#### Scenario: Long section heading

- **WHEN** a section heading is too long for the panel's width
- **THEN** it truncates to the panel's width

### Requirement: Click to toggle

Clicking a task row SHALL flip that checkbox in `tasks.md` in the pane's space — this machine, or the remote machine the pane follows. The row flips at once (optimistically). On this machine the write replaces the file only if it still matches the copy the panel read (a compare-and-swap against the snapshot just read). On a remote machine the panel SHALL replace the clicked line's exact text through herdr-core's exact-text edit on that machine (`file edit` with the line's exact bytes as the old text and the flipped line as the new): the old/new pair SHALL be built from the copy the panel last read, matching exactly one place in the file, and the toggle SHALL be refused without writing when it does not. When the line already holds the asked state, the panel SHALL accept the file as it stands without running an edit. After the remote edit the panel SHALL re-read the file and check that the clicked line holds the flipped text before accepting the toggle. A rejected write, a refused edit or a verification that does not pass SHALL re-read the file and retry once.

#### Scenario: Tick a task

- **WHEN** the user clicks an open task in a local space
- **THEN** the row flips to done at once, the file's checkbox line is rewritten to `[x]` with every other byte identical, and the counts follow when the refreshed list is read back

#### Scenario: Tick a remote task

- **WHEN** the user clicks an open task in a remote space
- **THEN** the row flips to done at once, exactly that checkbox line is rewritten on the machine through the CLI's exact-text edit and verified against a re-read, and the counts follow when the refreshed list is read back

#### Scenario: Concurrent edit wins

- **WHEN** another writer changed `tasks.md` between the panel's read and its write
- **THEN** the rejected write is retried once against the fresh file, never overwriting the concurrent edit blindly

#### Scenario: Ambiguous remote line

- **WHEN** the clicked task's line text matches more than one place in the remote file
- **THEN** the panel refuses the toggle without writing, shows the file's real state and toasts that the task was not updated

#### Scenario: Remote flip that does not verify

- **WHEN** the re-read after a remote edit does not show the clicked line holding the flipped text
- **THEN** the panel shows the file's real state and toasts that the task was not updated
