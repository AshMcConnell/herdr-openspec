## MODIFIED Requirements

### Requirement: View proposal item

The menu SHALL include **View change**. When no change viewer for the panel's repository and machine is registered, it SHALL open the change viewer for the chosen change in a pane to the right via `pane.split`, giving the mod itself `props` naming the change's `proposal.md` (`<root>/openspec/changes/<name>/proposal.md`), the change's name, and the machine the change lives on (null for this one), so the viewer derives the rest of the change's artifacts from that path. When a viewer for the same repository and machine is registered, the item SHALL instead ask the most recently opened one to switch to that change and wait up to 700 ms for its acknowledgement: an acknowledgement SHALL open no pane, a missing one SHALL mark that viewer unanswered for a 15-second cooldown, skip it and try the next, and when no viewer is left the item SHALL open a pane as above. A silent viewer SHALL stay registered, so a live copy that was hidden can answer later. A viewer for another repository or machine SHALL NOT be retargeted and SHALL NOT count as open for this decision. When the panel has resolved no repository root, the item SHALL open nothing and report by an error toast.

#### Scenario: Open the change viewer

- **WHEN** the user picks **View change** for the change "add-oauth" and no viewer for this repository and machine is registered
- **THEN** a pane opens to the right showing that change's tabbed viewer, its proposal tab selected

#### Scenario: Retarget the open viewer

- **WHEN** the user picks **View change** for "fix-parser" and a viewer for this repository and machine is registered and answers
- **THEN** that viewer switches to "fix-parser" and no pane is opened

#### Scenario: The most recent viewer answers

- **WHEN** two viewers are registered for this repository and machine
- **THEN** the item addresses the one registered most recently, and the other keeps its change

#### Scenario: A silent viewer is skipped

- **WHEN** the newest registered viewer does not acknowledge within 700 ms and another viewer is registered
- **THEN** the silent one is marked unanswered for the cooldown but stays registered, and the next one is asked

#### Scenario: A silent viewer is retried later

- **WHEN** a viewer was marked unanswered and the cooldown has passed
- **THEN** it is a candidate again and can answer a later request

#### Scenario: No viewer answers

- **WHEN** no registered viewer acknowledges within 700 ms
- **THEN** a pane opens for the chosen change as if no viewer were open

#### Scenario: Another repository's viewer is left alone

- **WHEN** the only registered viewer belongs to another repository
- **THEN** it is neither retargeted nor marked unanswered, and the item opens a pane for the chosen change

#### Scenario: No repository yet

- **WHEN** the user picks **View change** while the panel has resolved no repository root
- **THEN** an error toast reports it and no pane opens
