## MODIFIED Requirements

### Requirement: Row context menu

Right-clicking a change's row SHALL open a small popup menu over the list, built from the mod's built-in menu table (its items and their order). The table SHALL be the extension point — new items are appended there and the popup renders them in order. The panel SHALL decide which items are visible before the popup opens, and the popup SHALL receive the visible items as plain data; the popup's height SHALL follow its visible items, and it SHALL open where the right-click happened. A separator between the table's groups SHALL be shown as a non-interactive divider that the keyboard never highlights. The existing **Copy name** and **View change** SHALL remain the first items.

#### Scenario: Open the menu

- **WHEN** the user right-clicks a change's row
- **THEN** a popup opens listing the visible items in table order

#### Scenario: Height follows the items

- **WHEN** the status read hides some menu items
- **THEN** the popup is proportionally shorter than the full set

#### Scenario: The divider is skipped

- **WHEN** ↓ or ↑ moves the highlight through the menu
- **THEN** the highlight wraps over the visible non-divider items and never rests on the divider

#### Scenario: It opens at the click

- **WHEN** the user right-clicks a change's row
- **THEN** the popup appears at the click point, not wherever the pointer later moved

## ADDED Requirements

### Requirement: Change commands

The menu SHALL offer, after the divider: **Continue** (`/opsx-continue <name>`), **Apply** (`/opsx-apply <name>`), **Verify** (`/opsx-verify <name>`), **Sync specs** (`/opsx-sync <name>`) and **Archive using AI** (`/opsx-archive <name>`). Before the popup opens the panel SHALL read `openspec status --change <name> --json` in the panel's repository on the change's machine and hide items that cannot apply: **Continue** when `isComplete` is true; **Apply** when the `tasks` artifact is not `done`, or when the change's list entry shows no tasks or every task done; **Verify** when the `tasks` artifact is not `done`; **Sync specs** when the `specs` artifact is not `done`. **Archive using AI** SHALL always be shown. When the status read fails or times out, the full static set of five SHALL be shown. Picking an item SHALL hand the exact command, name appended, through the panel's shared command hand-off.

#### Scenario: A complete change

- **WHEN** the user right-clicks a change whose `isComplete` is true and whose list entry shows every task done
- **THEN** Continue, Apply, Verify and Sync specs are hidden per the rules, and Archive using AI is shown

#### Scenario: Tasks not done

- **WHEN** the change's `tasks` artifact is not `done`
- **THEN** Apply and Verify are hidden

#### Scenario: A proposal-only draft

- **WHEN** the change's list entry shows no tasks
- **THEN** Apply is hidden

#### Scenario: Specs not done

- **WHEN** the change's `specs` artifact is not `done`
- **THEN** Sync specs is hidden

#### Scenario: The status read failed

- **WHEN** the `openspec status` command fails or times out
- **THEN** all five command items are shown

#### Scenario: The hand-off is shared

- **WHEN** the user picks Continue
- **THEN** the command goes through the same paths and one-at-a-time rule as Bulk archive, with `/opsx-continue <name>` as the text
