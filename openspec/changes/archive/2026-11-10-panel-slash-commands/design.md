## Context

The panel's row menu (right-click a row, `mods/openspec/main.js:1443`) opens a popup built from the built-in `MENU` table (391) and rendered by `menuView()` (1596): **Copy name** and **View change**, keyboard-wrapping, Esc to close. The panel already owns one slash-command hand-off: `bulkArchive()` (1552) hands `/opsx-bulk-archive` (`BULK`, 425) to Herdr's selected agent, guarded by `selectedAgent()` (75) and `sameRepo()` (96), falling back to a new tab from `knownAgents({ on })` and then to the clipboard, one hand-off at a time via `this.bulkBusy` (801). The toolbar (1779-1805) holds filter, clear ×, **Bulk archive** and sort.

Every other OpenSpec step is a command file: `.opencode/commands/opsx-continue.md`, `opsx-apply.md`, `opsx-verify.md`, `opsx-sync.md`, `opsx-archive.md`, `opsx-propose.md`. The panel knows the change names from `openspec list` and, as verified, `openspec status --change <name> --json` reports `isComplete` and `artifacts[]` with `id`/`status` — enough to know which commands can apply.

Popups cannot run the hand-off themselves: a popup's `cx` ends when it closes. The mod already solves this for the viewer with the OPENS shared-key request pattern (`OPENS` at 116, `openRequests()` at 236, `acceptOpen()` at 895): the popup writes a request into Herdr's shared values and wakes the panel copy by name, and the panel copy does the work in its own long-lived `cx.spawn`.

## Goals / Non-Goals

**Goals:**

- Every OpenSpec command the panel can name is one pick away: five row commands per change, and a repo-level **Commands** menu for commands that need no change.
- One shared hand-off order of paths — selected agent in this repository, new tab in the panel's repository, clipboard — with one in-flight guard across every source.
- Menu items that can apply are shown; ones that cannot are hidden, decided before the popup opens.
- Bulk archive keeps its behaviour and toast wording byte-for-byte.

**Non-Goals:**

- Running any command in the panel, or watching its progress. The hand-off only delivers the text; the agent does the work.
- Changing the archive-failure dialog's **Archive using AI** path (`archiveWithAI()`).
- Changing `archive-flow`'s specified behaviour in any way.
- A generic command palette, custom commands, or per-command arguments beyond the change name.

## Decisions

### D1. Capability split

`command-handoff` is new: the algorithm — send, then new tab, then clipboard, one at a time, routed through the panel copy — must be stated once, and duplicating it in `archive-flow`, `context-menu` and `panel-commands` would let the copies drift. `context-menu` is modified: the row menu's table, plain-data popup, divider, height and keyboard are that capability's subject. `panel-commands` is new: a repo-level actions menu is not a list control — `list-controls`' purpose is entirely "narrow and order the list" (filter + sort), and stretching it with an actions menu would couple two unrelated evolution paths. Precedent: bulk's toolbar button lives in `archive-flow` because it is one archive action; the Commands menu is deliberately a multi-command table, so it gets its own capability.

### D2. `archive-flow` untouched

Bulk's behaviour and toast wording are preserved byte-for-byte, so no specified behaviour of that capability changes and no delta is warranted. Its **Bulk archive in the selected LLM** requirement now lives in the main `archive-flow` spec (synced when `bulk-archive-selected-llm` archived on 2026-11-09), so nothing here rewrites a live delta either — no merge-order dependency. The shared guard generalises "one hand-off SHALL be in flight at a time" across sources without contradicting archive-flow's wording: bulk's hand-off is still one hand-off, merely no longer the only one. A follow-up can slim the bulk requirement to defer to `command-handoff` (Open Questions).

### D3. Menu table mechanics

`MENU` keeps its ordered shape and gains: one `{ divider: true }` entry after View change, and five command entries `{ label, command, when }` where `when(status, entry)` is a pure predicate (`null`/absent `when` = always shown, which covers Archive using AI and the existing two). A pure function `rowMenuItems(status, entry)` walks MENU and returns plain data — `[{ i, label } | { div: true }]` with `i` the MENU index — plus the height, and places the divider only between the groups (never dangling: Archive using AI is always visible, so the command group is never empty). The popup renders only what it is given; it never evaluates predicates.

### D4. Resolve status before opening

The right-click handler calls a new `openRowMenu(c, pos, cx)` which spawns `exec("openspec", ["status", "--change", c.name, "--json"], { cwd: this.root, on: this.on })`, bounded by a ~1500 ms race (exact value an implementation taste; a hang must not swallow the menu); any failure/timeout → `status = null` → full static set. Parse only `isComplete` and `artifacts[]` (`id` "tasks"/"specs", `status === "done"`). The click position comes from the event (`MouseButtonEvent.position`) and is passed to `openOverlay` as `at: { x, y }`, so the popup lands where the right-click happened rather than where the pointer drifted during the read (verify the coordinate space at runtime; fall back to the default `"pointer"` if they differ). Width stays 200; height is computed: `10 (p(5) top+bottom) + 31 × visible items + 9 × dividers` — the full set (7 items + divider) ≈ 236, matching today's future-proofed 240.

### D5. The visibility rules, and why Apply needs the list entry

`openspec status` knows artifact doneness, not task doneness, so Apply also consults the row's entry from `openspec list` (`c.total > 0 && c.done < c.total`), refreshed by the watch/poll. The rules: **Continue** hidden when `isComplete` is true; **Apply** hidden when the `tasks` artifact is not `done`, or when the entry shows no tasks or every task done; **Verify** hidden when `tasks` is not `done`; **Sync specs** hidden when `specs` is not `done`; **Archive using AI** always shown.

### D6. Popup rendering and keyboard

`menuView(t)` reads `props().items` (defensive fallback: render all of MENU when absent), renders dividers as a non-interactive `div().h(9).mx(6).border_t(1)` in the border colour, and keeps a `pickable` index list; ↑/↓ wrap over `pickable.length`, `this.at` is clamped to it on open, Enter maps `items[pickable[this.at]].i` → `MENU[i].run(name, cx, at)` then closes — the existing `run(name, cx, at)` contract is unchanged for Copy name/View change.

### D7. Toolbar Commands menu

A `COMMANDS = [{ label: "New change", command: "/opsx-propose" }]` table — the extension point; entries get the same `run(name, cx, at)`-shaped behaviour with a null name. Button `id("openspec-commands")`, same chrome as the sort/bulk buttons (h(24), px(8), rounded(7), 1 px border, 11 px text, `flex_none`), label "Commands ▾", shown `.when(this.root, …)` — no change-count condition, unlike bulk's. Toolbar order: filter (flex_1) → clear × → Commands → Bulk archive → sort. Click opens the same popup renderer with `props: { commandsFor: true, root, on, panel, items }` and `menuFor` absent — that absent `menuFor` is what distinguishes the two popups (init checks `menuFor` first, as today, then `commandsFor`); no async read, so it opens at once, still anchored at the click point.

### D8. One shared helper, one guard

Extract `bulkArchive()`'s body into `handoff(cx, req)` with `req = { command, kind, sent, opened, failed, root, on, space }` — toast titles passed by the caller so bulk's strings ("Bulk archive sent"/"Bulk archive opened"/"Could not hand off the bulk archive") stay byte-identical; the clipboard toast ("Copied — paste it into your agent") is shared verbatim. New commands pass generic titles ("Command sent"/"Command opened"/"Could not hand off the command", bodies matching bulk's: agent name / agent name / `Run by hand: ${command}`). The guard becomes `this.handoffBusy` + `this.handoffKind` (replacing `bulkBusy`); `handoff` returns at once when busy or `!root` (root = `req.root`, not the live `this.root`), sets both, clears them in `finally` with the same context-check repaint. The bulk button's spinner condition becomes `this.handoffBusy && this.handoffKind === "bulk"` — bulk's look preserved; a row-command hand-off in flight does not spin it but its press is refused. The helper performs, in one `cx.spawn`, exactly today's three paths: `selectedAgent()` + `sameRepo(selected, root, on)`, `exec("herdr-core", ["send", selected.local, command], { on: selected.machine })` with `exitDetail(r)`, `knownAgents({ on })`, program match `list.find((a) => a.installed && selected?.programKey && a.key === selected.programKey) ?? list.find((a) => a.installed)`, `run("tab.new", { space, folder: root, argv: agent.run, task: command })`, `cx.write_to_clipboard(command)`, and the nested try/catch ladder with the final never-lost error toast.

### D9. Routing from popups

A `HANDOFF = "openspec.handoff"` shared key holding `{ [panel]: { panel, command, kind, sent, opened, failed, root, on, space, seq, at } }`, age-swept at 60 s like `openRequests()`. A menu item's `run` writes the record (capturing root/on/space/panel from `at` plus a `uid()` seq) and calls `run("openspec.command")`; the panel copy's existing `nextCommand` loop gains `else if (command === "command") this.acceptHandoff(cx)`, and `acceptHandoff` mirrors `acceptOpen`: only its own record, once per seq (`this.handledHandoff`). The panel copy's long-lived `cx.spawn` carries the async work — the reason the popup does not. Defensive: `at.panel` is always set (the popup is only opened by a panel copy); a missing id no-ops with a comment.

### D10. Never type names; clipboard carries the full text

Names come from the row (`openspec list`); the command string is built once per item (`/opsx-continue ${name}`) and that exact string is the send text, the tab's first message and the clipboard content. `/opsx-propose` gets nothing appended.

## Risks / Trade-offs

- **The status read delays the menu** by one command (~100-300 ms local, longer remote) → bounded by the 1500 ms race; beyond it the full static set opens.
- **Two rapid right-clicks can stack popups** — the host's popup stacking, Esc closes the top → accepted.
- **`e.position` vs `at` coordinate space** may differ → verified at implementation time; fallback is the default pointer anchor, accepting drift during the read.
- **The guard is per panel copy**, so two panels for the same repository could still hand off twice (as today for bulk) → accepted.
- **Sending while an agent sits mid-approval-prompt** may land the text oddly → documented in README limits, as bulk did.
- **`knownAgents` caches installed checks for up to a minute**, so a just-installed agent can be missing → the clipboard fallback covers it.

## Migration Plan

No data, schema or CLI change. The feature ships with the mod; sync the app snapshot (`rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/`) and reload the panel. Rollback is the previous mod folder; nothing is persisted.

## Open Questions

- **Toast wording for the new commands** — decided: generic titles "Command sent"/"Command opened"/"Could not hand off the command", bodies matching bulk's (agent name / agent name / `Run by hand: <command>`). Per-command titles ("Continue sent") were the alternative. Bulk's strings are fixed either way.
- **Toolbar label** — decided: "Commands ▾" for the 480 px panel; alternatives ("⌘", "New ▾") if it proves too wide.
- **Status timeout** — decided: 1500 ms; revisit only if slow remote machines make the fallback fire too often.
- **`at: { x, y }` coordinate space** — decided in principle: use the click position if `MouseButtonEvent.position` and `openOverlay`'s `at` share a space (verified at implementation time); otherwise fall back to the default pointer anchor, accepting drift.
- **Follow-up (not this change):** a small change can MODIFIED `archive-flow`'s **Bulk archive in the selected LLM** requirement to defer the path order to `command-handoff` instead of restating it — possible now that `bulk-archive-selected-llm` has archived.
