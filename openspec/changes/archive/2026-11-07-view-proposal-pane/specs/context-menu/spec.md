## ADDED Requirements

### Requirement: View proposal item

The menu SHALL include **View proposal**, which SHALL open the change's `proposal.md` in a pane to the right via `pane.split`, giving the mod itself `props` naming the file (`<root>/openspec/changes/<name>/proposal.md`), the change's name, and the machine the change lives on (null for this one). When the panel has resolved no repository root, the item SHALL open nothing and report by an error toast.

#### Scenario: Open the viewer

- **WHEN** the user picks **View proposal** for the change "add-oauth"
- **THEN** a pane opens to the right showing that change's `proposal.md` rendered as markdown

#### Scenario: No repository yet

- **WHEN** the user picks **View proposal** while the panel has resolved no repository root
- **THEN** an error toast reports it and no pane opens
