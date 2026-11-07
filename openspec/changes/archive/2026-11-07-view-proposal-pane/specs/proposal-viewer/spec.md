## ADDED Requirements

### Requirement: Viewer pane

A copy of the mod given a `file` prop SHALL render the proposal viewer instead of the list, reading only its props (`file`, `change`, `on`) — never the focused pane's location — so the pane works standalone and keeps working after Herdr restarts (pane props are saved with the tab).

#### Scenario: Standalone viewer

- **WHEN** `pane.split` gives the mod `props: { file, change, on }`
- **THEN** that copy renders the proposal viewer for that file, regardless of which pane is focused

#### Scenario: Restored with the tab

- **WHEN** Herdr restarts and reopens a tab holding a proposal pane
- **THEN** the viewer reads its saved props and re-arms its own refresh

### Requirement: Viewer content

The viewer SHALL show a header with the change's name and a `proposal.md` chip, the file rendered as markdown in the body (headings, lists, code blocks) with selectable text and its own scrolling, and a footer with the machine-prefixed file path — the footer omitted when the path is empty.

#### Scenario: A proposal on screen

- **WHEN** the viewer shows a `proposal.md` with headings and bullets
- **THEN** the header names the change, the body renders them as markdown, and the footer shows the file's path

#### Scenario: Select and scroll

- **WHEN** the proposal is longer than the pane
- **THEN** the body scrolls on its own and its text can be selected

### Requirement: Viewer states

The viewer SHALL explain itself instead of showing a blank pane: "Loading proposal…" while the first read is in flight, "No proposal.md" when the file is absent (including after the change is archived under an open pane), "proposal.md is empty" for a zero-length file, and the error's text when the read throws.

#### Scenario: Change without a proposal

- **WHEN** the viewer's file does not exist
- **THEN** the viewer shows "No proposal.md" rather than an empty body

#### Scenario: Read failure

- **WHEN** reading the file throws
- **THEN** the viewer shows the error's text

### Requirement: Viewer refresh

Local panes SHALL watch the change's own folder and re-read when it changes; remote panes (an `on` machine) SHALL poll every 15 seconds; a watch that cannot be armed SHALL fall back to the poll.

#### Scenario: Edit updates the pane

- **WHEN** `proposal.md` is edited in a local space while its pane is open
- **THEN** the pane re-reads it without waiting for a poll

#### Scenario: Remote pane

- **WHEN** the viewer's file lives on a remote machine
- **THEN** no watch is armed and a 15-second poll keeps the pane current

#### Scenario: Watch cannot arm

- **WHEN** the folder watch fails (for example a tree too large to watch)
- **THEN** the viewer falls back to the 15-second poll
