## 1. Shared hand-off helper — `mods/openspec/main.js`

- [x] 1.1 Add `HANDOFF = "openspec.handoff"` beside the shared keys (116-118) and an `openHandoffs()` age-swept reader mirroring `openRequests()` (236-244, 60 s).
- [x] 1.2 Replace `this.bulkBusy` (801) with `this.handoffBusy = false; this.handoffKind = null;` (comment: one hand-off at a time across every command source; cleared only in `handoff`'s `finally`, never on a folder switch).
- [x] 1.3 Extract `bulkArchive()`'s spawn body (1559-1591) into `handoff(cx, { command, kind, sent, opened, failed, root, on, space })` per design D8 — identical ladder, toasts from `sent`/`opened`/`failed`, clipboard toast verbatim, `finally` clearing both fields with the `key() === context` repaint guard; add `this.handledHandoff = null` to list init.
- [x] 1.4 Rewrite `bulkArchive(cx)` as a thin wrapper: guard on `this.handoffBusy || !this.root`, pass `BULK`, kind `"bulk"`, bulk's exact toast strings, live `root/on/space`.
- [x] 1.5 Change the toolbar spinner condition (1793) to `this.handoffBusy && this.handoffKind === "bulk"`.
- [x] 1.6 Checks: `node --check`; re-read the diff — bulk's three toast titles and bodies byte-identical, no `openspec archive` call, `this.busy`/row buttons untouched.

## 2. Row command items and the status-aware menu — `mods/openspec/main.js`

- [x] 2.1 Extend `MENU` (391-409): after View change add `{ divider: true }` and the five `{ label, command, when }` entries in order Continue/Apply/Verify/Sync specs/Archive using AI (Archive no `when`); each command item's `run` queues the hand-off request (task 3.3) with `${command} ${name}`.
- [x] 2.2 Add pure `rowMenuItems(status, entry)` returning `{ items: [{ i, label } | { div: true }], height }` with the D3/D4/D5 rules (Apply's entry check uses the row's `done/total`).
- [x] 2.3 Replace the right-click body (1443-1446) with `openRowMenu(c, e.position, cx)`: stop propagation; when `!this.root` open immediately with the static set; else spawn the bounded `openspec status` read, then `openOverlay({ mod: "openspec", kind: "popup", at: { x: pos.x, y: pos.y }, width: 200, height, props: { menuFor: c.name, root, on, panel: this.panelId, items } })`.
- [x] 2.4 Rework `menuView(t)` (1596-1619): render `props().items` (fallback: all MENU), divider as non-interactive `div().h(9).mx(6).border_t(1).border_color(t.border)`, `pickable` list of non-divider indices, wrap/clamp `this.at`, Enter → `MENU[item.i].run(name, cx, at)`.
- [x] 2.5 Checks: full static set height ≈ 236 (was 240); keyboard never rests on the divider; Copy name/View change behaviour unchanged.

## 3. Toolbar Commands menu and routing — `mods/openspec/main.js`

- [x] 3.1 Add `COMMANDS = [{ label: "New change", command: "/opsx-propose" }]` beside `BULK` (425) with a comment naming it the extension point.
- [x] 3.2 Toolbar button `id("openspec-commands")` between the clear-× block (1784-1787) and bulk (1788-1796), `.when(this.root, …)`, bulk's chrome, label "Commands ▾", click → `openOverlay({ …, at: { x, y } from the click, width: 200, height: computed, props: { commandsFor: true, root, on, panel, items } })`.
- [x] 3.3 Init: after the `menuFor` check (739) add a `commandsFor` branch (focus + return); `render` (1752) dispatch it to the shared popup renderer; make the renderer handle a null `menuFor` (toolbar items' `run(null, cx, at)`).
- [x] 3.4 Add module-level `queueHandoff(at, { command, kind, sent, opened, failed, root, on, space })` writing the swept HANDOFF record (seq `uid()`) then `run("openspec.command")`; the panel `nextCommand` loop (815-826) gains the `"command"` case; `acceptHandoff(cx)` mirrors `acceptOpen` (895-901) and calls `this.handoff(cx, req)`.
- [x] 3.5 Checks: pick Continue in the popup → the hand-off completes after the popup closes; a second panel copy ignores the request; a repeat wake runs once.

## 4. Specs

- [x] 4.1 Verify the three delta files match the implemented behaviour; adjust only where implementation forced a decision the spec did not name.
- [x] 4.2 Confirm `archive-flow` and `bulk-archive-selected-llm` are untouched (`git status`).

## 5. Documentation

- [x] 5.1 `README.md`: extend the right-click bullet (46-59) with the five items, the divider and the visibility rules; add a Commands bullet to the Toolbar line (32-34) and the hand-off fallbacks to the Bulk archive bullet (84-91); add the same limits bulk documented (agent mid-prompt, minute cache) to **Limits**.
- [x] 5.2 `RECIPE.md`: describe both menus in the mod description and add the fallbacks to **Watch out** (110), in the recipe's plain voice; read the file first.

## 6. Checks and deploy

- [x] 6.1 `openspec validate panel-slash-commands --strict` passes.
- [x] 6.2 `openspec validate --specs --strict` passes.
- [x] 6.3 `node --check mods/openspec/main.js` passes.
- [x] 6.4 `herdr-app check mods/openspec` passes.
- [x] 6.5 Sync the snapshot the app runs: `rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/`, then reload the OpenSpec panel.

## 7. Manual checks in the app (owner)

- [x] 7.1 Right-click a complete change: Continue, Apply, Verify and Sync specs hidden, Archive using AI shown; popup opens at the click and is shorter than the full set.
- [x] 7.2 Right-click an artifact-incomplete change: the full five-item command set under the divider.
- [x] 7.3 Right-click a change on a remote machine: the status read runs on its machine and the menu opens at the click point.
- [x] 7.4 Pick Continue with a selected same-repository agent: the command lands in that agent's terminal and the toast names it.
- [x] 7.5 Pick Continue with a selected wrong-repository agent: no send; a new tab opens in the panel's repository with the command as first message.
- [x] 7.6 With no agent installed, pick Continue: the full `/opsx-continue <name>` is on the clipboard with the Copied toast.
- [x] 7.7 With zero active changes, the Commands button is shown; New change hands bare `/opsx-propose` and the command prompts for what to build.
- [x] 7.8 Double-press refusal across sources: a row pick while a bulk hand-off is in flight does nothing, and bulk's spinner shows only for bulk.
- [x] 7.9 Bulk regression: toasts unchanged, the failure dialog and its Archive using AI unchanged.

## 8. Review pass

- [x] 8.1 Re-read the diff against `design.md`: no path types or invents a change name; every send text, tab task and clipboard content is the same string.
- [x] 8.2 Confirm the dialog path (`archiveWithAI`) is untouched.
- [x] 8.3 Confirm README, RECIPE and the deltas describe one fallback order.
