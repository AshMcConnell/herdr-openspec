## Why

The panel can archive one change with a two-click `openspec archive <name> --yes`, but archiving several finished changes needs OpenSpec's bulk-archive workflow: it validates each change, detects delta specs that touch the same capability, resolves the conflicts against the code, syncs the specs, and only then archives. That is agentic work the panel cannot do with a bare command, so today it means leaving the panel, opening an agent, and typing `/opsx-bulk-archive` there.

Herdr already has a selected agent — the one its agent list and agent block show — and the panel already knows the repository it is listing. A bulk archive started from the panel should run in that selected LLM, not in an arbitrary new agent. The existing "Archive using AI" hand-off always opens a new tab with the first installed agent from `knownAgents()`, which ignores the person's current choice; a bulk action should not repeat that.

## What Changes

- Add a **Bulk archive** action to the panel toolbar, shown while a repository is resolved and at least one active change is listed.
- Pressing it hands `/opsx-bulk-archive` to Herdr's currently selected agent (the agent an agent block shows, `focused().agent`) by typing the command into that agent's terminal through herdr-core, on the agent's machine.
- The panel does not choose the changes and runs no archive command itself. The command's own workflow prompts for the selection, validates each change, syncs specs, resolves conflicts, and archives.
- When no agent is selected, open a new agent tab in the panel's repository with the first installed agent and `/opsx-bulk-archive` as its first message. When the selected agent is in another folder, start its program in the panel's repository in a new tab instead of sending into the wrong repository. When no agent is installed, or the tab cannot start, copy `/opsx-bulk-archive` to the clipboard and say so.
- Confirm every hand-off with a toast, and allow only one hand-off at a time so a double press cannot send the command twice.
- Leave the single-change archive button, its two-click confirmation, its spinner and its failure dialog unchanged.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `archive-flow`: add the bulk-archive hand-off to the selected LLM, its repository check, its fallbacks, its feedback and its one-at-a-time rule.

## Impact

- `mods/openspec/main.js`: a toolbar button, selected-agent and repository resolution, the herdr-core send, the new-tab and clipboard fallbacks, and toasts.
- `openspec/specs/archive-flow/spec.md` through this change's delta.
- `README.md` and `RECIPE.md`: the bulk action and its limits.
- Uses only the existing Herdr API (`focused`, `agents`, `panes`, `knownAgents`, `run("tab.new")`, `notify`) and the existing `/opsx-bulk-archive` command. No new programs, files or network access beyond the herdr-core send the mod already uses for remote task writes.
