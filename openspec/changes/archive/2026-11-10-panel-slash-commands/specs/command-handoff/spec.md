## ADDED Requirements

### Requirement: Hand-off paths

Every slash-command hand-off from the panel — the row menu's command items, the toolbar Commands menu, and **Bulk archive** — SHALL use one shared order of paths. First, send the command text to Herdr's currently selected agent by typing it into that agent's terminal on that agent's machine, but only when the selected agent's live folder is the panel's repository (a folder that cannot be read counts as a mismatch). Second, open a new agent tab in the panel's repository with the selected agent's program when that program is installed, otherwise the first installed agent, and the command as the tab's first message. Third, copy the command text to the clipboard and say so. A failed send or a tab that cannot start SHALL fall through to the next path; when even the clipboard fails, a final error toast SHALL name the command so it is never lost. A toast SHALL confirm every path, and no toast SHALL claim the command's work finished. Each hand-off SHALL run against the repository, machine and space captured when the action was picked, because the panel may switch folders while a menu is open. The command text SHALL be exactly the command with the change's name appended (a name from `openspec list`, never typed or invented by the panel), or the bare command for repo-level commands.

#### Scenario: The selected agent receives the command

- **WHEN** a command is picked and the selected agent's live folder is the panel's repository
- **THEN** the command text is sent to that agent's terminal on its machine and a toast names the agent

#### Scenario: Selected agent in another repository

- **WHEN** the selected agent's live folder is not the panel's repository, or cannot be read
- **THEN** no command is sent to that agent, and a new tab opens in the panel's repository with the selected program (or the first installed agent when that program cannot be resolved) and the command text as its first message

#### Scenario: No agent available

- **WHEN** no agent is installed, the agent list cannot be read, or the new tab cannot start
- **THEN** the exact command text (name appended) is on the clipboard and a toast says so

#### Scenario: Every path failed

- **WHEN** the send, the new tab and the clipboard all fail
- **THEN** an error toast names the command so it can be run by hand

#### Scenario: The captured repository is used

- **WHEN** the panel switches folders between picking a command and running the hand-off
- **THEN** the hand-off still runs against the repository captured at pick time

### Requirement: One hand-off at a time

One hand-off SHALL be in flight at a time across every command source. A pick while one is in flight SHALL do nothing. The **Bulk archive** toolbar button SHALL keep its spinner exactly while its own hand-off is the one in flight — a row-command or Commands-menu hand-off in flight SHALL NOT spin it, but presses on it are still refused.

#### Scenario: A second pick is refused

- **WHEN** two command sources are pressed in turn while the first hand-off is still in flight
- **THEN** exactly one command is sent or one tab opened

#### Scenario: Bulk's spinner stays its own

- **WHEN** a row command's hand-off is in flight and the **Bulk archive** button is pressed
- **THEN** the button shows no spinner and its press does nothing

### Requirement: Popups ask the panel copy

A command picked in a popup SHALL be run by the panel copy that opened it, not the popup: a popup's context ends when it closes. The item SHALL record the request — command, toast titles, repository, machine, space and a per-copy sequence number — in Herdr's shared values and wake the panel copy by name; only the named copy SHALL act, and each request SHALL run at most once.

#### Scenario: The popup closes, the hand-off runs

- **WHEN** a command item in a popup is picked
- **THEN** the popup closes and the panel copy that opened it performs the hand-off

#### Scenario: Another panel ignores it

- **WHEN** a second panel copy is live and a hand-off request names the first
- **THEN** only the copy named in the request acts

#### Scenario: A request runs once

- **WHEN** the same hand-off request arrives twice
- **THEN** the hand-off happens once
