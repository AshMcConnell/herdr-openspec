## ADDED Requirements

### Requirement: Viewer palette

The proposal viewer SHALL paint every surface it draws from the mod's built-in
Tokyo Night dark palette (the owner's Obsidian theme), held as constants in
`main.js` — not the app theme's tokens and not a read of the vault's CSS:
body background #1a1b26, header/footer chrome #16161e, borders #292e42,
body text #c0caf5, muted text #a9b1d6, faint text #565f89, error text #db4b4b.
The markdown body's text SHALL inherit #c0caf5 at reading size. The palette
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
