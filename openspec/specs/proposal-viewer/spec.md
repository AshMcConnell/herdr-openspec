# proposal-viewer Specification

## Purpose
A change's row menu opens it beside the list, and a row click or another **View change** switches that open viewer to another change: a copy of the mod that reads its props as an anchor and renders the whole change in Tokyo Night — proposal, design, tasks and specs in tabs, its markdown body and tickable task list — keeping itself and every artifact current, and explaining a missing, empty or unreadable one.
## Requirements
### Requirement: Viewer pane

A copy of the mod given a `file` prop SHALL render the change viewer instead of the list, reading only its props (`file`, `change`, `on`) — never the focused pane's location — with the change's directory derived from the file's path, so the pane works standalone, keeps working after Herdr restarts (pane props are saved with the tab), and panes saved under the older proposal-only viewer reopen as this one unchanged. A viewer's current change MAY be retargeted while it is open (see **Viewer retargeting**), but its saved props SHALL NOT change: a restart reopens the pane on the change its props name.

#### Scenario: Standalone viewer

- **WHEN** `pane.split` gives the mod `props: { file, change, on }`
- **THEN** that copy renders the change viewer for that file's change, regardless of which pane is focused

#### Scenario: Restored with the tab

- **WHEN** Herdr restarts and reopens a tab holding a viewer pane
- **THEN** the viewer reads its saved props and re-arms its own refresh

#### Scenario: A pane saved before the tabs

- **WHEN** a pane saved by the proposal-only viewer reopens
- **THEN** it renders the tabbed change viewer, its change directory and name taken from the same `file` prop

#### Scenario: Restart after a switch

- **WHEN** a viewer was switched to another change and Herdr later restarts
- **THEN** the pane reopens on the change its saved props name, not the one it was switched to

### Requirement: Viewer content

The viewer SHALL show a tab bar with **proposal**, **design**, **tasks** and **specs**, one tab for each artifact the change has: the proposal tab SHALL always be present as the anchor, the design and tasks tabs SHALL appear only when their files exist, and the specs tab only when the change has delta specs, or when a remote listing failed, in which case the tab says so. The body SHALL show the selected tab's artifact — for the document tabs (proposal, design, specs) the change's name as its H1-style title above the artifact, with the artifact rendered per its kind — and a footer SHALL carry the machine-prefixed change directory, omitted when the path is empty. The tab bar SHALL replace the previous header and its `proposal.md` chip.

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

The viewer SHALL explain itself per artifact instead of showing a blank body: "Loading proposal…" while the proposal tab's first read is in flight, "Loading design.md…" and "Loading tasks.md…" for those tabs, and "Loading specs…" for the specs listing and reads; "No proposal.md — this change has none" when the anchor file is absent (including after the change is archived under an open pane), "<file> is empty" for a zero-length artifact, and the error's text when a read throws. A tab whose artifact disappears SHALL fall back to the proposal tab.

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
body text #c0caf5, muted text #a9b1d6, faint text #565f89, error text #db4b4b,
accent (`NIGHT.accent`) #bb9af7 — Tokyo Night's magenta, the selected tab's underline,
done green #9ece6a — a complete change's name, selected tab and checklist.
A selected tab SHALL read in the body text colour with the accent, and an unselected tab in the muted colour.
When every task in the change's `tasks.md` is done, the viewer SHALL make completeness obvious in the done green: the change's name, the selected tab's text and underline, a `✓ complete` chip in the tab bar, and the checklist's text; a change with no task rows SHALL NOT count as complete. The body SHALL be rendered in #c0caf5 at reading size, and each element in it
SHALL take its colour from the palette. The palette
SHALL be fixed regardless of the app theme, and the change list SHALL keep
the app theme's tokens.

#### Scenario: Themed viewer

- **WHEN** a change viewer renders
- **THEN** its root, tab bar, footer, states, markdown bodies and checklist take their colors from the built-in Tokyo Night palette

#### Scenario: Tab colours

- **WHEN** the bar draws its tabs
- **THEN** the selected tab takes the body text colour with a #bb9af7 accent underline (the done green when the change is complete), and the others the muted colour, hover brightening to the body text colour

#### Scenario: Same in every app theme

- **WHEN** Herdr's app theme is light or dark
- **THEN** the viewer looks the same — Tokyo Night dark

#### Scenario: A complete change reads green

- **WHEN** every task in the change's `tasks.md` is done
- **THEN** the change's name, the selected tab and its underline, a `✓ complete` chip and the checklist text all take the done green

#### Scenario: A change with no tasks

- **WHEN** the change has no task rows
- **THEN** the viewer shows no `✓ complete` chip and no green completion styling

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
with #c0caf5 text, blockquotes a #80d0ff left bar (the owner's Tokyo Night
theme accent, `hsl(202,100%,75%)`; not Obsidian's default) over #16161e, rules
#292e42. The renderer SHALL never drop content: syntax it does not support
SHALL render as literal text — except that a document past 2000 blocks SHALL end in a faint "… truncated" line saying the rest is not shown. The change's name SHALL lead the body as a
title in the H1 style. The body SHALL scroll inside its container
and SHALL be padded so the text does not touch the pane's edges.

#### Scenario: Body elements carry their Tokyo Night colours

- **WHEN** an artifact contains headings, links, inline code, blockquotes or fenced code blocks
- **THEN** each is drawn in its palette colour — h1–h6 red/yellow/green/cyan/blue/magenta, links magenta, code chips and blocks on #242838, quotes a #80d0ff bar (the owner's theme accent) over #16161e, rules #292e42

#### Scenario: The name is the title

- **WHEN** a document tab (proposal, design or specs) renders
- **THEN** the change's name leads the body in the H1 style — heading size, bold, red — above the document, which renders as-is below it

#### Scenario: Unsupported syntax stays visible

- **WHEN** the markdown holds syntax the renderer does not support (tables, images, nested lists beyond one level, unknown escapes)
- **THEN** it renders as literal text lines within the rendered blocks — no content inside them is dropped (the 2000-block cap aside)

#### Scenario: A document past the block cap

- **WHEN** a document holds more than 2000 blocks
- **THEN** the body ends in a faint "… truncated" line noting the rest is not shown

#### Scenario: Clickable links

- **WHEN** a link targets an http(s) URL
- **THEN** clicking it opens the URL in the system browser, and a non-http target stays coloured but inert

#### Scenario: Scrolling padded body

- **WHEN** the rendered document is taller than the pane
- **THEN** it scrolls inside the body container, with padding around the whole document so the text never touches the pane edges

### Requirement: Viewer registration

While a change viewer is open it SHALL register itself in a shared value that every copy of the mod can read: a random id, when it registered, its current `proposal.md` path, the repository root taken from the part of its change directory before `/openspec/changes/`, and the machine the change lives on (`null` for this one). It SHALL update the registered file when it switches and SHALL remove its entry when it closes. The registry SHALL be filtered by repository root and machine when the panel or a menu looks for a viewer to retarget, so a viewer for another repository or another machine is never a candidate. A viewer that does not acknowledge a request SHALL NOT be removed from the registry; it SHALL be skipped for a 15-second cooldown and become a candidate again afterwards.

#### Scenario: A viewer registers

- **WHEN** a change viewer pane starts
- **THEN** the shared registry holds an entry with its id, its change file, its repository root and its machine

#### Scenario: The registry follows a switch

- **WHEN** a viewer switches to another change in the same repository
- **THEN** its registry entry names the new change's file

#### Scenario: A viewer closes

- **WHEN** a viewer pane closes
- **THEN** its entry is removed from the registry

#### Scenario: A silent viewer stays registered

- **WHEN** a viewer does not answer a retarget request
- **THEN** it is skipped for the cooldown but its registry entry is kept, so it can answer once it is shown again

#### Scenario: Another repository is not a candidate

- **WHEN** the panel reads repository A and the registry holds a viewer for repository B
- **THEN** that viewer is not chosen for A's retarget requests

### Requirement: Viewer retargeting

A viewer copy SHALL listen for its mod's `view` command. When the request queue under its id in the shared request map holds one or more requests, it SHALL acknowledge every one with its id and the request's token and, unless the last request names the change it already shows, switch to it. On a switch the viewer SHALL take the request's change file, change name and machine, clear the previous change's documents, spec listing and task snapshot, invalidate reads already in flight, select the proposal tab, read the new change's artifacts, and re-arm refresh: the change folder watch for a local change, the 15-second poll for a remote one. A request whose token it has already handled SHALL be ignored, and a request in another copy's queue SHALL never be read. A request whose acknowledgement window has closed SHALL be withdrawn from the queue before the panel moves on, and a viewer SHALL ignore any request older than its 700 ms window even if it is still present, so a copy that drains the queue later SHALL NOT act on it. A task tick already in flight SHALL still write the change it was clicked in, but SHALL NOT overwrite the documents of the newly shown change.

#### Scenario: Switch on request

- **WHEN** the panel asks an open viewer to show "fix-parser"
- **THEN** the viewer shows that change's proposal tab with its own name, and its tab bar is rebuilt from that change's artifacts

#### Scenario: The request is acknowledged

- **WHEN** a viewer receives a request addressed to it
- **THEN** it records the acknowledgement before it starts reading the new change, so the panel can tell the viewer answered

#### Scenario: Requests queue for one viewer

- **WHEN** two panels ask the same viewer for different changes before it reads the queue
- **THEN** it acknowledges both requests and shows the last one

#### Scenario: A late request is withdrawn

- **WHEN** a request was marked unanswered when its 700 ms window closed and the viewer drains the queue later
- **THEN** that request is gone and the viewer does not switch for it

#### Scenario: A request past its window is ignored

- **WHEN** the panel stopped waiting and withdrew nothing (its timer died), and the viewer later wakes to an old request
- **THEN** the viewer ignores it and does not switch

#### Scenario: A request for another copy

- **WHEN** a viewer's queue holds only requests for another id
- **THEN** it acknowledges nothing and changes nothing

#### Scenario: The same change again

- **WHEN** a viewer is asked for the change it already shows
- **THEN** it acknowledges and leaves its tab, documents and refresh alone

#### Scenario: Local refresh re-armed

- **WHEN** a local viewer switches to a change in another folder
- **THEN** its old folder watch stops and a watch on the new change's folder starts, with a discovery read at once

#### Scenario: Remote refresh re-armed

- **WHEN** a viewer switches to a change on a remote machine
- **THEN** no folder watch is armed and the 15-second poll reads the new change

#### Scenario: An old read cannot land

- **WHEN** a read for the previous change finishes after the switch
- **THEN** its result is discarded and the new change's documents stay on screen

#### Scenario: A tick in flight during a switch

- **WHEN** a task toggle is still writing when the viewer switches away
- **THEN** the write finishes in the change that was clicked, and the new change's tasks document is not replaced by the old one

### Requirement: Task tab

The tasks tab SHALL render the change's `tasks.md` as a themed checklist built from the mod's task parser — section headings in the muted colour, ✓ in green for a done task, ○ in the faint colour for an open one, each task's text not truncated to the row width and with no row cap (the panel's ellipsis and capped folded-out list are what the viewer lifts; the parser still drops wrapped continuation lines). On a local pane, clicking a task SHALL flip that checkbox line in the change's `tasks.md` with the panel's compare-and-swap write: the flip is optimistic, a stale snapshot is re-read and retried once, only one toggle runs at a time, and a failure reports by error toast naming the reason. Remote panes SHALL show the same checklist read-only.

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

