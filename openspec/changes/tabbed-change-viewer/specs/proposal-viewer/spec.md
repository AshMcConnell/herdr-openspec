## MODIFIED Requirements

### Requirement: Viewer pane

A copy of the mod given a `file` prop SHALL render the change viewer instead of the list, reading only its props (`file`, `change`, `on`) — never the focused pane's location — with the change's directory derived from the file's path, so the pane works standalone, keeps working after Herdr restarts (pane props are saved with the tab), and panes saved under the older proposal-only viewer reopen as this one unchanged.

#### Scenario: Standalone viewer

- **WHEN** `pane.split` gives the mod `props: { file, change, on }`
- **THEN** that copy renders the change viewer for that file's change, regardless of which pane is focused

#### Scenario: Restored with the tab

- **WHEN** Herdr restarts and reopens a tab holding a viewer pane
- **THEN** the viewer reads its saved props and re-arms its own refresh

#### Scenario: A pane saved before the tabs

- **WHEN** a pane saved by the proposal-only viewer reopens
- **THEN** it renders the tabbed change viewer, its change directory and name taken from the same `file` prop

### Requirement: Viewer content

The viewer SHALL show a tab bar with **proposal**, **design**, **tasks** and **specs**, one tab for each artifact the change has: the proposal tab SHALL always be present as the anchor, the design and tasks tabs SHALL appear only when their files exist, and the specs tab only when the change has delta specs. The body SHALL show the selected tab's artifact — the change's name as its H1-style title and the artifact rendered per its kind — and a footer SHALL carry the machine-prefixed change directory, omitted when the path is empty. The tab bar SHALL replace the previous header and its `proposal.md` chip.

#### Scenario: Tabs for what exists

- **WHEN** a change has `proposal.md`, `design.md` and `tasks.md` but no `specs/` directory
- **THEN** the bar shows proposal, design and tasks tabs and no specs tab

#### Scenario: Proposal only

- **WHEN** a change has only `proposal.md`
- **THEN** the bar shows the proposal tab alone and its body renders that file

#### Scenario: A document tab on screen

- **WHEN** the design tab is selected
- **THEN** the body shows the change's name as the title and `design.md` rendered as markdown, and the footer shows the change directory

### Requirement: Viewer states

The viewer SHALL explain itself per artifact instead of showing a blank body: a loading line while an artifact's first read is in flight, "No proposal.md — this change has none" when the anchor file is absent (including after the change is archived under an open pane), "<file> is empty" for a zero-length artifact, and the error's text when a read throws. A tab whose artifact disappears SHALL fall back to the proposal tab.

#### Scenario: Change without a proposal

- **WHEN** the viewer's change has no `proposal.md` (for example it was archived)
- **THEN** the proposal tab shows "No proposal.md — this change has none" rather than an empty body

#### Scenario: An empty artifact

- **WHEN** the selected tab's file exists but holds nothing
- **THEN** the body says that file is empty

#### Scenario: Read failure

- **WHEN** reading the selected artifact throws
- **THEN** the viewer shows the error's text

#### Scenario: The open tab's artifact vanishes

- **WHEN** a refresh finds the selected tab's artifact gone
- **THEN** the viewer falls back to the proposal tab

### Requirement: Viewer refresh

Local panes SHALL watch the change's own directory — covering every artifact, `specs/<capability>/spec.md` included — and on each change SHALL re-run artifact discovery and re-read the open tab's artifact; selecting a tab SHALL read that artifact fresh. Remote panes (an `on` machine) SHALL poll every 15 seconds with the same discovery and read, and a watch that cannot be armed SHALL fall back to that poll.

#### Scenario: Edit updates the pane

- **WHEN** `proposal.md` is edited in a local space while its pane is open
- **THEN** the pane re-reads it without waiting for a poll

#### Scenario: A spec delta edited

- **WHEN** a file under the change's `specs/` is edited while the pane is open
- **THEN** the open tab reflects it once the watch wakes

#### Scenario: New artifact appears

- **WHEN** a `design.md` is created in a change whose pane is open
- **THEN** the next refresh adds the design tab

#### Scenario: Remote pane

- **WHEN** the viewer's change lives on a remote machine
- **THEN** no watch is armed and a 15-second poll keeps the pane current

#### Scenario: Watch cannot arm

- **WHEN** the folder watch fails (for example a tree too large to watch)
- **THEN** the viewer falls back to the 15-second poll

#### Scenario: Switching tabs

- **WHEN** the user selects the tasks tab
- **THEN** the viewer reads `tasks.md` at that moment rather than showing a stale copy

### Requirement: Viewer palette

The change viewer SHALL paint every surface it draws — root, tab bar, footer, states, markdown bodies and the tasks checklist — from the mod's built-in
Tokyo Night dark palette (the owner's Obsidian theme), held as constants in
`main.js` — not the app theme's tokens and not a read of the vault's CSS:
body background #1a1b26, header/footer chrome #16161e, borders #292e42,
body text #c0caf5, muted text #a9b1d6, faint text #565f89, error text #db4b4b.
A selected tab SHALL read in the body text colour with the accent, and an unselected tab in the muted colour. The body SHALL be rendered in #c0caf5 at reading size, and each element in it
SHALL take its colour from the palette. The palette
SHALL be fixed regardless of the app theme, and the change list SHALL keep
the app theme's tokens.

#### Scenario: Themed viewer

- **WHEN** a change viewer renders
- **THEN** its root, tab bar, footer, states, markdown bodies and checklist take their colors from the built-in Tokyo Night palette

#### Scenario: Tab colours

- **WHEN** the bar draws its tabs
- **THEN** the selected tab takes the body text colour with the accent, and the others the muted colour, hover brightening to the body text colour

#### Scenario: Same in every app theme

- **WHEN** Herdr's app theme is light or dark
- **THEN** the viewer looks the same — Tokyo Night dark

#### Scenario: The list is not themed

- **WHEN** the panel list renders beside a themed viewer
- **THEN** the list still draws with the app theme's tokens

### Requirement: Markdown body

The viewer SHALL render the proposal, design and specs bodies with the mod's own markdown
renderer built from plain elements (not the app-themed TextView component),
and every rendered part SHALL take its colour from the theme.css-derived
palette: headings h1–h6 in red/yellow/green/cyan/blue/magenta (--h1-color
..--h6-color), bold and italic cyan, links magenta (hover cyan, http(s)
links clickable into the system browser), inline and fenced code on #242838
with #c0caf5 text, blockquotes a #80d0ff left bar (Obsidian's default accent) over #16161e, rules
#292e42. The renderer SHALL never drop content: syntax it does not support
SHALL render as literal text — except that a document past 2000 blocks SHALL end in a faint "… truncated" line saying the rest is not shown. The change's name SHALL lead the body as a
title in the H1 style. The body SHALL scroll inside its container
and SHALL be padded so the text does not touch the pane's edges.

#### Scenario: Body elements carry their Tokyo Night colours

- **WHEN** an artifact contains headings, links, inline code, blockquotes or fenced code blocks
- **THEN** each is drawn in its palette colour — h1–h6 red/yellow/green/cyan/blue/magenta, links magenta, code chips and blocks on #242838, quotes a #80d0ff bar over #16161e, rules #292e42

#### Scenario: The name is the title

- **WHEN** a document tab (proposal, design or specs) renders
- **THEN** the change's name leads the body in the H1 style — heading size, bold, red — above the document, which renders as-is below it

#### Scenario: Unsupported syntax stays visible

- **WHEN** the markdown holds syntax the renderer does not support (tables, images, nested lists beyond one level, unknown escapes)
- **THEN** it renders as literal text lines — no content is dropped

#### Scenario: A document past the block cap

- **WHEN** a document holds more than 2000 blocks
- **THEN** the body ends in a faint "… truncated" line noting the rest is not shown

#### Scenario: Clickable links

- **WHEN** a link targets an http(s) URL
- **THEN** clicking it opens the URL in the system browser, and a non-http target stays coloured but inert

#### Scenario: Scrolling padded body

- **WHEN** the rendered document is taller than the pane
- **THEN** it scrolls inside the body container, with padding around the whole document so the text never touches the pane edges

## ADDED Requirements

### Requirement: Task tab

The tasks tab SHALL render the change's `tasks.md` as a themed checklist built from the mod's task parser — section headings in the muted colour, ✓ in green for a done task, ○ in the faint colour for an open one, each task's text shown in full, untruncated and uncapped. On a local pane, clicking a task SHALL flip that checkbox line in the change's `tasks.md` with the panel's compare-and-swap write: the flip is optimistic, a stale snapshot is re-read and retried once, only one toggle runs at a time, and a failure reports by error toast naming the reason. Remote panes SHALL show the same checklist read-only.

#### Scenario: Tick from the viewer

- **WHEN** the user clicks an open task on a local pane's tasks tab
- **THEN** the row flips at once and that line's checkbox is written to `tasks.md`

#### Scenario: A concurrent edit

- **WHEN** the file changed since the viewer read it and the write is rejected
- **THEN** the viewer re-reads, retries once, and keeps the file's real state — reporting by toast when the task no longer matches

#### Scenario: Remote read-only

- **WHEN** the viewer's change lives on a remote machine
- **THEN** the checklist renders but a click writes nothing

### Requirement: Specs tab

The specs tab SHALL list the change's delta specs: with one capability it SHALL render that `specs/<capability>/spec.md`; with several it SHALL render each one under a heading of its capability name, in one scroll. A change with no `specs/` directory SHALL have no specs tab. A remote listing that fails SHALL leave the tab without content and a note rather than break the viewer.

#### Scenario: Several capabilities

- **WHEN** a change has deltas for two capabilities
- **THEN** the specs tab shows both, each under its capability name

#### Scenario: No specs

- **WHEN** a change has no `specs/` directory
- **THEN** the bar shows no specs tab

#### Scenario: Remote listing fails

- **WHEN** listing the specs on a remote machine fails
- **THEN** the viewer still renders, its specs tab saying the listing failed
