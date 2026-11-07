# proposal-viewer Specification

## Purpose
A change's row menu opens it beside the list: a copy of the mod that reads only its own props and renders the change's proposal in Tokyo Night — its chrome, its markdown body — keeping itself current and explaining a missing, empty or unreadable file.
## Requirements
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

### Requirement: Viewer palette

The proposal viewer SHALL paint every surface it draws from the mod's built-in
Tokyo Night dark palette (the owner's Obsidian theme), held as constants in
`main.js` — not the app theme's tokens and not a read of the vault's CSS:
body background #1a1b26, header/footer chrome #16161e, borders #292e42,
body text #c0caf5, muted text #a9b1d6, faint text #565f89, error text #db4b4b.
The body SHALL be rendered in #c0caf5 at reading size, and each element in it
SHALL take its colour from the palette. The palette
SHALL be fixed regardless of the app theme, and the change list SHALL keep
the app theme's tokens.

#### Scenario: Themed viewer

- **WHEN** a proposal pane renders
- **THEN** its root, header, footer, chip, states and body text take their colors from the built-in Tokyo Night palette

#### Scenario: Same in every app theme

- **WHEN** Herdr's app theme is light or dark
- **THEN** the viewer looks the same — Tokyo Night dark

#### Scenario: The list is not themed

- **WHEN** the panel list renders beside a themed viewer
- **THEN** the list still draws with the app theme's tokens

### Requirement: Markdown body

The viewer SHALL render the proposal body with the mod's own markdown
renderer built from plain elements (not the app-themed TextView component),
and every rendered part SHALL take its colour from the theme.css-derived
palette: headings h1–h6 in red/yellow/green/cyan/blue/magenta (--h1-color
..--h6-color), bold and italic cyan, links magenta (hover cyan, http(s)
links clickable into the system browser), inline and fenced code on #242838
with #c0caf5 text, blockquotes a faint #565f89 left bar over #16161e, rules
#292e42. The renderer SHALL never drop content: syntax it does not support
SHALL render as literal text. The change's name SHALL lead the body as a
title in the H1 style, and the header bar SHALL carry only the proposal.md
chip. The body SHALL scroll inside its container
and SHALL be padded so the text does not touch the pane's edges.

#### Scenario: Body elements carry their Tokyo Night colours

- **WHEN** a proposal contains headings, links, inline code, blockquotes or fenced code blocks
- **THEN** each is drawn in its palette colour — h1–h6 red/yellow/green/cyan/blue/magenta, links magenta, code chips and blocks on #242838, quotes a #565f89 bar over #16161e, rules #292e42

#### Scenario: The name is the title

- **WHEN** a proposal pane opens (name from the row menu or the file prop's path)
- **THEN** the change's name renders as the body's first element in the H1 style — heading size, bold, red — above the document, which renders as-is below it, and the header bar shows only the proposal.md chip

#### Scenario: Unsupported syntax stays visible

- **WHEN** the markdown holds syntax the renderer does not support (tables, images, nested lists beyond one level, unknown escapes)
- **THEN** it renders as literal text lines — no content is dropped

#### Scenario: Clickable links

- **WHEN** a link targets an http(s) URL
- **THEN** clicking it opens the URL in the system browser, and a non-http target stays coloured but inert

#### Scenario: Scrolling padded body

- **WHEN** the rendered document is taller than the pane
- **THEN** it scrolls inside the body container, with padding around the whole document so the text never touches the pane edges

