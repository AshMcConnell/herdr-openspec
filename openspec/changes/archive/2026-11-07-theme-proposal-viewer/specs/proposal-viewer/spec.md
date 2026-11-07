## ADDED Requirements

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
