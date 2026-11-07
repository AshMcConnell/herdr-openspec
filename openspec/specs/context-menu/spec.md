# context-menu Specification

## Purpose
One small popup per row keeps actions on a change within a right-click. This capability describes that menu: it renders from the mod's built-in menu table, ships with Copy name, and works from the keyboard as well as the mouse.
## Requirements
### Requirement: Row context menu

Right-clicking a change's row SHALL open a small popup menu over the list, built from the mod's built-in menu table (its items and their order). The table SHALL be the extension point — new items are appended there and the popup renders them in order.

#### Scenario: Open the menu

- **WHEN** the user right-clicks a change's row
- **THEN** a popup opens listing the menu table's items in order

### Requirement: Copy name

The menu SHALL include **Copy name**, which SHALL write the change's name to the clipboard and confirm with a success toast naming the change.

#### Scenario: Copy

- **WHEN** the user picks **Copy name** for the change "add-oauth"
- **THEN** "add-oauth" is on the clipboard and a toast confirms "Name copied"

### Requirement: Menu keyboard and dismissal

The popup SHALL support the keyboard: ↑ and ↓ move the highlight (wrapping at the ends), Enter activates the highlighted item, and `Esc` closes it. A click beside the popup SHALL close it too.

#### Scenario: Keyboard pick

- **WHEN** the popup is open and the user presses ↓ then Enter
- **THEN** the highlighted item runs and the popup closes

#### Scenario: Escape and outside click

- **WHEN** the user presses `Esc` or clicks outside the popup
- **THEN** the popup closes without running any item

