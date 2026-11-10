## Why

The panel lists changes and can archive them, but every other OpenSpec workflow step — continue the next artifact, apply tasks, verify, sync delta specs, archive with AI judgement, start something new — means leaving the panel, opening an agent, and typing `/opsx-continue <name>` by hand. The commands exist (`.opencode/commands/opsx-*.md`); the panel knows the change names from `openspec list`, and it already owns one proven hand-off: `bulkArchive()` hands `/opsx-bulk-archive` to the selected agent with a repository guard, a new-tab fallback and a clipboard fallback. That logic should serve every command, not one button.

## What Changes

- The row right-click menu gains a divider after **Copy name** / **View change**, then five command items: **Continue** → `/opsx-continue <name>`, **Apply** → `/opsx-apply <name>`, **Verify** → `/opsx-verify <name>`, **Sync specs** → `/opsx-sync <name>`, **Archive using AI** → `/opsx-archive <name>`.
- Items are context-aware: before the popup opens the panel runs `openspec status --change <name> --json` on the change's machine and hides items that cannot apply (Continue hidden when complete; Apply/Verify hidden until the tasks artifact is done, Apply also hidden when the list entry shows no tasks or all done; Sync specs hidden until the specs artifact is done; Archive always shown). A failed or timed-out read shows the full static set. The popup opens only after the status resolves, so items neither appear nor vanish under the pointer.
- The toolbar gains a **Commands** menu (shown whenever a repository is resolved, no active change needed), built from a repo-level command table with one item today: **New change** → `/opsx-propose` (no argument; the command prompts for what to build). The table is the extension point for more.
- One shared hand-off implementation, extracted from `bulkArchive()`: selected agent in this repository first, else a new tab in the panel's repository with the selected program (or the first installed agent), else the clipboard; one hand-off in flight at a time across every source; a toast per path. Bulk archive uses it unchanged — same behaviour, same toast wording.
- The archive-failure dialog's **Archive using AI** is unchanged.

## Capabilities

### New Capabilities

- `command-handoff`: the shared order of paths every panel slash-command takes — selected agent in this repository, then a new agent tab in the panel's repository, then the clipboard — with its one-at-a-time rule and how a pick in a popup reaches the panel copy that opened it.
- `panel-commands`: the toolbar **Commands** menu — a repo-level actions menu for commands that need no change name, starting with **New change**.

### Modified Capabilities

- `context-menu`: the row menu's popup becomes status-aware — the panel decides the visible items before it opens and hands them over as plain data, the popup's height follows them, a divider separates the groups, and five command items join the table after it.

`archive-flow` is deliberately untouched: bulk's behaviour and toast wording are preserved byte-for-byte, so no requirement of that capability changes (its **Bulk archive in the selected LLM** requirement now lives in the main `archive-flow` spec, synced when `bulk-archive-selected-llm` archived). The shared hand-off generalises archive-flow's "only one hand-off SHALL be in flight at a time" without contradicting it.

## Impact

- `mods/openspec/main.js`: the MENU table and its visibility predicates, the `openspec status` read before the row popup opens, the popup taking plain data with a computed height and divider-aware keyboard, the COMMANDS table and toolbar button, the shared `handoff()` helper extracted from `bulkArchive()`, and hand-off request routing from popups to the panel copy.
- The three spec deltas in this change (`command-handoff`, `panel-commands`, `context-menu`).
- `README.md` and `RECIPE.md`: the new menu items, the Commands menu and the hand-off limits (implementation tasks in this change).
- Uses only the existing Herdr API and the existing `/opsx-*` commands. No new programs, files or network access beyond the `exec`/`herdr-core` calls the mod already makes.
