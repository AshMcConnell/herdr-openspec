## MODIFIED Requirements

### Requirement: View proposal item

The menu SHALL include **View change**, which SHALL open the change viewer for the change in a pane to the right via `pane.split`, giving the mod itself `props` naming the change's `proposal.md` (`<root>/openspec/changes/<name>/proposal.md`), the change's name, and the machine the change lives on (null for this one), so the viewer derives the rest of the change's artifacts from that path. When the panel has resolved no repository root, the item SHALL open nothing and report by an error toast.

#### Scenario: Open the change viewer

- **WHEN** the user picks **View change** for the change "add-oauth"
- **THEN** a pane opens to the right showing that change's tabbed viewer, its proposal tab selected

#### Scenario: No repository yet

- **WHEN** the user picks **View change** while the panel has resolved no repository root
- **THEN** an error toast reports it and no pane opens
