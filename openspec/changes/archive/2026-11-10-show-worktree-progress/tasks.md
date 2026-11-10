## 1. Discovery and listing — `mods/openspec/main.js`

Re-locate anchors by symbol name (`grep -n "function visible\|refresh(cx)\|watch(root" mods/openspec/main.js`), not by line number.

- [x] 1.1 Add `parseWorktrees(text)` beside the list helpers per design D1: split the porcelain output on blank lines; for each block read the rest of the `worktree ` line as the path (never quote it — paths keep their spaces), `branch ` with `refs/heads/` stripped, and the `detached`, `bare`, `prunable` markers; return `{ path, branch, detached, bare, prunable }[]`. Comment the verified OpenCode path and that sibling checkouts are listed too.
- [x] 1.2 Add `worktreeLabel(wt)` (branch, or `detached: <basename of path>`) and `wtId(root)` (FNV-1a 32-bit in hex) per design D4; `node --check mods/openspec/main.js` passes.
- [x] 1.3 Add `readList(root, on)` beside `refresh`: run `openspec list --json` there, parse, drop dot entries, map to `{ name, done, total, at, status }`; return `{ changes }`, `{ none: true }` for "No OpenSpec changes directory found", or `{ error }` with the existing first-line detail. A thrown `exec` returns `{ error: "openspec is not installed" }`.
- [x] 1.4 Reorder `refresh()` per design D2: `git rev-parse --show-toplevel` from `cwd` first (fall back to `cwd`), then `git worktree list --porcelain` in the root, then `readList` for the own root and every linked root with `Promise.all`. Keep `this.loading`, the context-key guard, and the context-change reset exactly as they are.
- [x] 1.5 Build `this.sections` per design D3: own first (`own: true`), linked worktrees sorted by `worktreeLabel`, skipping `bare`/`prunable` and the entry equal to `this.root`; drop linked `{ none }` and empty listings; a linked `{ error }` keeps its section; the own `{ none }` is an empty section; any other own error calls `stale()` and stops before linked reads. Set every row's `root`, `wt`, `key`.
- [x] 1.6 Set `this.changes` to the flat union of section rows (unchanged shape plus `root`/`wt`/`key`), so header totals, the filter and the existing sweeps keep working.
- [x] 1.7 After the rebuild, prune `this.open`, `this.openRoot`, `this.openName`, `this.confirming`, `this.marking`, `this.busy` and `this.toggling` when their key is no longer in `this.changes`; reload the open row's tasks through `loadTasks` with its own root.
- [x] 1.8 Check: `node --check mods/openspec/main.js`; with a throwaway linked worktree that has an `openspec/changes/probe/` folder, `openspec list --json` in it reports the probe's counts (probed manually before this change).

## 2. Sections and rows — `mods/openspec/main.js`

- [x] 2.1 Add `visibleSections(self)` per design D6: filter each section's changes by the name substring case-insensitively, drop sections that end with no rows, then sort each remaining section with the existing `recent`/`name`/`done`/`state` comparators. Keep `visible()`'s body as a small wrapper over the flat rows if other code still calls it.
- [x] 2.2 Add `sectionHead(s, t)`: a 22px line in the state-header style, `⎇ <label>` left (`· this worktree` on the own section), `N changes · done/total` right from the section's visible rows; an error section shows the first error line instead of counts. Add the `t.border` divider between sections.
- [x] 2.3 Render sections in the list child: own first, linked after; render headers only when at least one linked section renders (per design D8). With no linked section, the children are the flat rows exactly as now — no header, no divider.
- [x] 2.4 Replace `this.open === c.name`, `this.confirming === c.name`, `this.busy === c.name`, `this.marking === c.name` and `this.toggling === c.name` with `c.key` comparisons in `row()`, `taskLine()`, `showArchive()` and the mark-all bar.
- [x] 2.5 Add `c.wt` to every name- or line-derived render id: `chg-${c.wt}-${c.name}`, `arch-${c.wt}-${c.name}`, `mark-${c.wt}-${c.name}`, `os-task-${c.wt}-${line}`; pass the section id into the fold-out's task lines. Comment why (same name in two worktrees must not share hover/focus state).
- [x] 2.6 Keep the header count, the task chip and the "No changes match" check on the flat visible rows (`sections.flatMap(s => s.rows)`), and make each section header count its own visible rows per design D6.
- [x] 2.7 Check: `node --check mods/openspec/main.js`; with two probe worktrees holding the same change name at different counts, both rows render and only the clicked one expands.

## 3. Worktree-scoped actions — `mods/openspec/main.js`

- [x] 3.1 `pick(c)`: store `this.open = c.key`, `this.openRoot = c.root`, `this.openName = c.name`; fold away on the same key; `requestViewer` uses `c.root` per design D5.
- [x] 3.2 `loadTasks(c, context)`: read `<c.root>/openspec/changes/<c.name>/tasks.md`; guard on the open key, not the bare name.
- [x] 3.3 `toggle(row, c)`: path under `c.root`; guard and settlement on `c.key`; keep the existing local compare-and-swap, remote `herdr-core file edit`, one retry and toasts unchanged.
- [x] 3.4 `markAll(c)`: path and key under `c.root`/`c.key`; same one-write semantics as today.
- [x] 3.5 `archive(c)`: run `openspec archive <name> --yes` with `cwd: c.root` on the panel's machine; put `c.root` in the failure offer; collapse the fold-out on `c.key`; refresh as today.
- [x] 3.6 `openRowMenu(c)`: run `openspec status` in `c.root` and pass `c.root` into the popup props, so its commands and viewer close over the row's worktree.
- [x] 3.7 Verify the hand-off path: the row menu's props root reaches `queueHandoff`, the selected-agent match compares against that root, and a new tab starts there; the toolbar Commands menu still uses `this.root`.
- [x] 3.8 `bulkArchive()` and the toolbar button: keep `this.root` (own worktree) and show the button only when the own section has a change per design D5.
- [x] 3.9 Check: `node --check mods/openspec/main.js`; with a probe linked worktree, tick a task there and confirm the own copy's `tasks.md` is byte-identical afterwards.

## 4. Live refresh and watches — `mods/openspec/main.js`

- [x] 4.1 Replace `watch(root, cx)` with a set-keyed version per design D7: `this.watched` is the joined sorted roots of the rendered sections; spawn one loop per root, each awaiting `watchFolder(<root>/openspec/changes)`, re-checking the key, then refreshing; a loop that throws clears `this.watched` only when its key is still current.
- [x] 4.2 Call `watch` with the section roots after a successful rebuild; arm nothing on a remote space and nothing for a worktree with no changes.
- [x] 4.3 Keep the 15-second timer and the manual refresh; a refresh that runs while another is in flight is still skipped by `this.loading`.
- [x] 4.4 Check: `node --check mods/openspec/main.js`; with the panel open in the app and a probe worktree, a task tick in the probe updates its section without waiting for the poll (manual, during the apply check).

## 5. Filter, sort and empty states

- [x] 5.1 Wire `visibleSections` into the render path for both the normal and `state` layouts per design D6: the state headers repeat inside each section and the section header stays above them.
- [x] 5.2 Keep the header `matched/total` and task chip across all sections; section headers show their own counts; a section hidden by the filter disappears entirely.
- [x] 5.3 Apply the empty/error precedence per design D9: own no-changes-directory is an empty section, linked no-changes-directory is omitted, a linked failure is a section error, "No active changes" when everything listed successfully and empty, "No OpenSpec here — run `openspec init`" when every worktree reported no changes directory, and the existing full-panel error for any other own failure.
- [x] 5.4 Keep the footer on `this.root` (the own worktree) and ensure no linked path is shown as the panel's own.
- [x] 5.5 Check: `node --check mods/openspec/main.js`; with a filter that matches only a linked row, only that section shows and the header reads `1/N`.

## 6. Specs and documentation

- [x] 6.1 Re-read the deltas against the implementation; adjust only where implementation forced a decision the spec did not name. `openspec validate show-worktree-progress --strict` passes.
- [x] 6.2 README top description: one or two clauses for worktree sections and their progress, without turning the paragraph into a manual.
- [x] 6.3 README **What it shows**: the section header line (label, `this worktree`, counts) and that rows act in their own worktree.
- [x] 6.4 README **Live**: watches cover every shown worktree; worktrees appear and disappear on refresh; remote spaces poll.
- [x] 6.5 README **What it runs**: `git worktree list --porcelain` per refresh, one `openspec list --json` per linked worktree, `openspec status`/archive in the row's worktree, and that no worktree is created or removed.
- [x] 6.6 README **Limits**: worktrees with no OpenSpec are not shown; bulk archive stays with the panel's own worktree; the poll and watch costs; no cross-worktree archive.
- [x] 6.7 RECIPE description and **What it runs** gain the matching sentences.

## 7. Checks and deploy

- [x] 7.1 `node --check mods/openspec/main.js` passes.
- [x] 7.2 `openspec validate show-worktree-progress --strict` passes.
- [x] 7.3 `openspec validate --specs --strict` passes.
- [x] 7.4 `herdr-app check mods/openspec` passes.
- [x] 7.5 Sync the mod snapshot (`rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/`) and reload the panel.
- [x] 7.6 Manual app check with a throwaway linked worktree (create one, add an `openspec/changes/probe/` with a `tasks.md`, then remove it): its section appears, progress matches, a tick writes only there, **View change** opens that worktree, **Bulk archive** is unaffected, and removing the worktree drops the section without breaking the own list.

## 8. One row per change name

- [x] 8.1 Add `fresher(a, b)` and de-duplicate after the sections are built per design D4: group every row by name, keep the highest completed ratio, then the most tasks done, then the latest last-modified time, then the larger total; drop every other copy from its section.
- [x] 8.2 Use the de-duplicated sections for `this.changes`, the header totals, the filter and the section headers; keep the Bulk archive button's own-worktree rule on the own section's pre-dedupe changes.
- [x] 8.3 Check: `node --check mods/openspec/main.js`; with copies at 0/6 in the own worktree, 6/6 in one linked worktree and 6/6 newer in another, one row renders in the latest section and the header counts 1.
- [x] 8.4 Re-read the deltas; `openspec validate show-worktree-progress --strict` and `openspec validate --specs --strict` pass.
- [x] 8.5 README and RECIPE: one sentence each on duplicate names and which copy is shown.
- [x] 8.6 Sync the snapshot and check the real `godot` repository in the app (filter `col-27` → one row at 6/6, in the latest copy's section).
