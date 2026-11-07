## MODIFIED Requirements

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

## ADDED Requirements

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

A viewer copy SHALL listen for its mod's `view` command. When a request queue in the shared value named for its id holds one or more requests, it SHALL acknowledge every one with its id and the request's token and, unless the last request names the change it already shows, switch to it. On a switch the viewer SHALL take the request's change file, change name and machine, clear the previous change's documents, spec listing and task snapshot, invalidate reads already in flight, select the proposal tab, read the new change's artifacts, and re-arm refresh: the change folder watch for a local change, the 15-second poll for a remote one. A request whose token it has already handled SHALL be ignored, and a request in another copy's queue SHALL never be read. A task tick already in flight SHALL still write the change it was clicked in, but SHALL NOT overwrite the documents of the newly shown change.

#### Scenario: Switch on request

- **WHEN** the panel asks an open viewer to show "fix-parser"
- **THEN** the viewer shows that change's proposal tab with its own name, and its tab bar is rebuilt from that change's artifacts

#### Scenario: The request is acknowledged

- **WHEN** a viewer receives a request addressed to it
- **THEN** it records the acknowledgement before it starts reading the new change, so the panel can tell the viewer answered

#### Scenario: Requests queue for one viewer

- **WHEN** two panels ask the same viewer for different changes before it reads the queue
- **THEN** it acknowledges both requests and shows the last one

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
