## MODIFIED Requirements

### Requirement: View proposal item

The menu SHALL include **View change**. When no change viewer for the change's worktree and machine is registered, it SHALL open the change viewer for the chosen change in a pane to the right via `pane.split`, giving the mod itself `props` naming the change's `proposal.md` (`<worktree-root>/openspec/changes/<name>/proposal.md`), the change's name, and the machine the change lives on (null for this one), so the viewer derives the rest of the change's artifacts from that path. When a viewer for the same worktree and machine is registered, the item SHALL instead ask the most recently opened one to switch to that change and wait up to 700 ms for its acknowledgement: an acknowledgement SHALL open no pane, a missing one SHALL mark that viewer unanswered for a 15-second cooldown, skip it and try the next, and when no viewer is left the item SHALL open a pane as above. A silent viewer SHALL stay registered, so a live copy that was hidden can answer later. A viewer for another worktree or machine SHALL NOT be retargeted and SHALL NOT count as open for this decision. When the row has no resolved worktree root, the item SHALL open nothing and report by an error toast.

#### Scenario: Open the change viewer

- **WHEN** the user picks **View change** for the change "add-oauth" in the own worktree and no viewer for that worktree is registered
- **THEN** a pane opens to the right showing that change's tabbed viewer, its proposal tab selected

#### Scenario: Open a linked worktree's change viewer

- **WHEN** the user picks **View change** for a "fix-parser" row under `col-27` and no viewer for `col-27` is registered
- **THEN** a pane opens for `col-27/openspec/changes/fix-parser/proposal.md`

#### Scenario: Retarget the open viewer

- **WHEN** the user picks **View change** for "fix-parser" and a viewer for the same worktree and machine is registered and answers
- **THEN** that viewer switches to "fix-parser" and no pane is opened

#### Scenario: Two worktrees, two viewers

- **WHEN** a viewer is open for the own worktree and the user picks **View change** on a `col-27` row
- **THEN** the own viewer is not retargeted, and a pane opens for the `col-27` change

#### Scenario: The most recent viewer answers

- **WHEN** two viewers are registered for the same worktree and machine
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

#### Scenario: Another worktree's viewer is left alone

- **WHEN** the only registered viewer belongs to another worktree
- **THEN** it is neither retargeted nor marked unanswered, and the item opens a pane for the chosen change

#### Scenario: No repository yet

- **WHEN** the user picks **View change** while the row has no resolved worktree root
- **THEN** an error toast reports it and no pane opens

### Requirement: Change commands

The menu SHALL offer, after the divider: **Continue** (`/opsx-continue <name>`), **Apply** (`/opsx-apply <name>`), **Verify** (`/opsx-verify <name>`), **Sync specs** (`/opsx-sync <name>`) and **Archive using AI** (`/opsx-archive <name>`). Before the popup opens the panel SHALL read `openspec status --change <name> --json` in the row's worktree on the change's machine and hide items that cannot apply: **Continue** when `isComplete` is true; **Apply** when the `tasks` artifact is not `done`, or when the change's list entry shows no tasks or every task done; **Verify** when the `tasks` artifact is not `done`; **Sync specs** when the `specs` artifact is not `done`. **Archive using AI** SHALL always be shown. When the status read fails or times out, the full static set of five SHALL be shown. Picking an item SHALL hand the exact command, name appended, through the panel's shared command hand-off, capturing that row's worktree.

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

#### Scenario: Status is read in the row's worktree

- **WHEN** the user right-clicks a row under `col-27`
- **THEN** `openspec status` runs in `col-27`, and the menu follows that worktree's artifacts

#### Scenario: The hand-off is shared

- **WHEN** the user picks Continue
- **THEN** the command goes through the same paths and one-at-a-time rule as Bulk archive, with `/opsx-continue <name>` as the text and the row's worktree captured
