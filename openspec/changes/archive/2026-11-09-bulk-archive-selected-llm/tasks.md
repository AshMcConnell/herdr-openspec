## 1. Selected agent and its live folder — `mods/openspec/main.js`

- [x] 1.1 Add `agents` to the `herdr` import (19). Beside `lastTerminal` (32) add module-level `lastAgent = null` — `{ address, cwd, on, space }` — with a comment saying why it exists: clicking the panel moves keyboard focus to a mod pane, so the agent the person had selected must be remembered the same way the list remembers its last terminal.
- [x] 1.2 In `location()` (34-52), after `f` / `space` / `on` are read, update `lastAgent` only when a real terminal is focused and it is an agent: `const term = f?.terminal; if (term && agents().some((a) => a.address === term)) lastAgent = { address: term, cwd: f.cwd ?? null, on, space: space?.id ?? null };`. Do not overwrite it when `f?.terminal` is null (the panel itself is focused) and do not use `f.cwd` from a mod-pane focus — it is the panel's folder, not the agent's. Like `lastTerminal`, keep it per space so a real space switch resolves afresh.
- [x] 1.3 Add a module-level `selectedAgent()` helper near `location()`. Prefer `focused()?.agent`, else `lastAgent?.address`; return null when neither names an agent. Return `{ address, local, machine, cwd, programKey, name }`: split `address` on its first `/` for the machine prefix and local herdr-core address (no slash means this computer); take `cwd` from `agents().find((a) => a.address === address)` → `panes().find((p) => p.pane === a.pane)?.cwd`, else the remembered `lastAgent.cwd` only when the addresses match, else null; take `programKey` from that agent's `program.key`; take `name` from its `program.name`, else "the selected agent". `focused().agent` may name an agent not in `agents()` (a layout block): keep the address, and use the remembered folder only when it is the same address.
- [x] 1.4 Add a small `sameRepo(selected, root, on)` helper: normalize one trailing slash, return true only when the selected folder equals the root or is inside it (`folder === root || folder.startsWith(root + "/")`) and `(selected.machine ?? null) === (on ?? null)`. Null or empty folder is false. Comment the reason: the bulk command archives the agent's working folder, so sending it to an agent in another repository would sync and move the wrong changes.

## 2. The bulk action — `mods/openspec/main.js`

- [x] 2.1 In the list-mode `init` (744-772) add `this.bulkBusy = false;` beside `this.busy` / `this.confirming`. Do not reset it in `refresh()`: the async hand-off always clears it in its `finally`, and resetting on a folder switch would allow a second hand-off while the first is still in flight (D6).
- [x] 2.2 Add `const BULK = "/opsx-bulk-archive";` beside the menu/sort constants (343-372) and a `bulkArchive(cx)` method near `archive()` (1225) / `archiveWithAI()` (1469). It returns at once when `this.bulkBusy` or `!this.root`; sets `bulkBusy`, captures `root = this.root`, `on = this.on`, `space = spaces().find((s) => s.active)?.id ?? null`, `context = key()`, and `cx.notify()`. In one `cx.spawn`:
  - Resolve `selectedAgent()`. When it exists and `sameRepo(selected, root, on)` passes, send with `exec("herdr-core", ["send", selected.local, BULK], { on: selected.machine })`; a non-zero code throws `exitDetail(r)` (275-283). On success toast `{ title: "Bulk archive sent", body: selected.name, level: "success" }` and return. The panel runs no `openspec archive` itself and shows no row spinner.
  - Otherwise open a new tab in the panel's repository: `knownAgents({ on })` in a `try`; choose `list.find((a) => a.installed && selected?.programKey && a.key === selected.programKey) ?? list.find((a) => a.installed)`; when an agent exists, `run("tab.new", { space, folder: root, argv: agent.run, task: BULK })` and toast `{ title: "Bulk archive opened", body: agent.name, level: "success" }`; when none exists, use the clipboard path.
  - The clipboard path is `cx.write_to_clipboard(BULK)` plus `{ title: "Copied — paste it into your agent", level: "info" }`. Wrap every host call in the shape `archiveWithAI()` uses (1469-1487): a throwing send or `tab.new` falls through to the new-tab path and then to the clipboard, and if even the clipboard throws, one final error toast says `Could not hand off the bulk archive` with body `Run by hand: ${BULK}` — a throwing send must never leave a dead button and a lost command.
  - `finally`: clear `this.bulkBusy`, then `try { if (key() === context) cx.notify(); } catch { /* a released view cannot repaint */ }`. Do not touch `this.busy`, `showArchive`, the fold-out, or call `this.refresh`; the folder watch and 15-second poll bring the agent's archive back.
- [x] 2.3 Add the toolbar button in `render()` between the clear-× block (1679-1682) and the sort button (1683-1691): `.when(this.root && this.changes.length > 0, (e) => e.child(...))` with `id("openspec-bulk-archive")`, `h(24)`, `px(8)`, `gap(5)`, `rounded(7)`, `border_1().border_color(t.border)`, `text_size(11)`, `t.muted` turning `t.foreground` on hover, `on_mouse_down` stopping propagation, and `on_click` calling `this.bulkArchive(cx)`. The icon is `svg("mods/openspec/archive.svg").size(12)` normally and the existing spinner (`svg("mods/workspace-chrome/spinner.svg").size(12).spin(900)`, the row pattern at 1401) while `bulkBusy`; the label is **Bulk archive**, `flex_none`, allowed to truncate in a narrow panel. The filter input keeps `flex_1` and absorbs the width.
- [x] 2.4 Keep the command text in `BULK` everywhere — the send, the `tab.new` task and the clipboard — so the three paths cannot drift. Confirm no path appends change names, the filter, or a selection: the command's own multi-select is the gate and the panel has no multi-select to pass.

## 3. Spec and documentation

- [x] 3.1 Verify `openspec/changes/bulk-archive-selected-llm/specs/archive-flow/spec.md` is an `## ADDED Requirements` delta with the full **Bulk archive in the selected LLM** requirement and its six `#### Scenario:` blocks; adjust only if the implementation forced a behaviour decision the spec did not name.
- [x] 3.2 `README.md`: under **Archive** (76-83) describe the toolbar **Bulk archive** action — it hands `/opsx-bulk-archive` to the selected agent, and the command prompts for the changes, validates, syncs specs, resolves conflicts and archives. Under **Limits** (188-225) add the fallbacks: selected agent in another repository starts a new tab with that program; no selected agent uses the first installed; no agent copies the command; one hand-off at a time; the panel does not wait for or report the archive. Match the spec's wording.
- [x] 3.3 `RECIPE.md`: add the same action to the archive description and the fallbacks to **Watch out**, in the recipe's plain voice. Read the file first and place it where the current archive flow is described.

## 4. Checks and deploy

- [x] 4.1 `openspec validate bulk-archive-selected-llm --strict` passes.
- [x] 4.2 `openspec validate --specs --strict` passes.
- [x] 4.3 `node --check mods/openspec/main.js` passes.
- [x] 4.4 `herdr-app check mods/openspec` passes (the app's mod check; if it rejects the repo path, sync in 4.5 first and run `herdr-app check ~/.config/herdr-app/mods/openspec`).
- [x] 4.5 Sync the snapshot the app runs: `rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/`, then reload the OpenSpec panel.

## 5. Manual checks in the app (owner)

- [x] 5.1 Select an agent in this repository (`cmd-]` / `agent.focus`), click the panel so it holds the keyboard, press **Bulk archive**: `/opsx-bulk-archive` appears in that agent's terminal, the toast names it, no row spinner appears, and the agent starts the bulk workflow.
- [x] 5.2 Select an agent working in another repository and press the action: no command reaches that agent; a new tab opens in this repository with the selected program and `/opsx-bulk-archive` as its first message.
- [x] 5.3 With no agent selected, press it: a new tab opens with the first installed agent and the command. On a machine with no agent installed, confirm the clipboard plus the "Copied" toast.
- [x] 5.4 Press twice quickly: exactly one command is sent or one tab opened.
- [x] 5.5 On a remote space, select an agent in the same repository and press it: the send reaches that machine; if it does not, confirm the new-tab fallback is what runs. After the agent archives, the list updates through the watch/poll.
- [x] 5.6 Regression: the single-change archive still arms the red chip, spins, reports by toast and shows the failure dialog; "Archive using AI" is unchanged.
- [x] 5.7 With no repository (`openspec` missing) or no active changes, confirm the **Bulk archive** button is not shown.

## 6. Review pass

- [x] 6.1 Re-read the diff against `design.md`: `bulkArchive` must never call `openspec archive`, must never set `this.busy` or hide row buttons, and must use `BULK` for all three paths.
- [x] 6.2 Confirm `lastAgent` is only written from a real terminal focus, that a mod-pane focus cannot overwrite its folder, and that a space switch re-resolves it.
- [x] 6.3 Confirm the README, RECIPE and spec all describe the same fallback order and none of them claims the archive completed.
