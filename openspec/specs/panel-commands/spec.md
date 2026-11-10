# panel-commands Specification

## Purpose
TBD - created by archiving change panel-slash-commands. Update Purpose after archive.
## Requirements
### Requirement: Toolbar Commands menu

The toolbar SHALL offer a **Commands** button whenever the panel has a resolved repository — it SHALL NOT require an active change — placed between the filter box and **Bulk archive** (filter, Commands, Bulk archive, sort; the filter keeps the flexible width). Clicking it SHALL open a popup at the click, built from the mod's repo-level command table, which SHALL be the extension point for more commands. Today it SHALL hold one item: **New change**, which hands off `/opsx-propose` with nothing appended — the command itself prompts for the change to build. The popup SHALL behave like the row menu: ↑/↓ wrap the highlight, Enter runs it, `Esc` and a click beside it close it. Picking an item SHALL hand the command through the panel's shared command hand-off, and a pick while a hand-off is in flight SHALL do nothing.

#### Scenario: Open the Commands menu

- **WHEN** a repository is resolved, even with no active changes, and the user clicks **Commands**
- **THEN** the button is shown and the popup lists the command table's items

#### Scenario: New change

- **WHEN** the user picks **New change**
- **THEN** `/opsx-propose` with no argument appended is handed off through the shared paths

#### Scenario: Keyboard pick

- **WHEN** the popup is open and the user presses ↓ then Enter
- **THEN** the highlighted command runs and the popup closes

#### Scenario: No repository

- **WHEN** the panel has resolved no repository root
- **THEN** the Commands button is not shown

#### Scenario: Refused while busy

- **WHEN** a hand-off is in flight and a Commands item is picked
- **THEN** the pick does nothing

