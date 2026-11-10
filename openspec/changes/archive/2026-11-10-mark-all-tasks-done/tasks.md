## 1. Pure helpers — `mods/openspec/main.js`

Re-locate every anchor by symbol name (`grep -n "writeFlip\|flipPair\|toggled\|occurs" mods/openspec/main.js`), not by line number — `panel-slash-commands` edits the same `row()`/init regions and may land first.

- [x] 1.1 Add `markedAll(text)` beside `toggled` per design D3: per line `^(\s*[-*]\s+\[)( |x|X)(\][\s\S]*)$`, space → `x`, `[x]`/`[X]` and every other line untouched, trailing `\r` kept; returns the new text, never null. Comment in the house voice.
- [x] 1.2 Add `flipPairs(body, next)` beside `flipPair` per design D4: walk both split texts, differing lines must match the checkbox-line regex and differ only in the mark (assert), collect `{ old, neu, line }`, and `occurs(body, old) === 1` per pair or throw `"the task's line is not unique in tasks.md"` before any write.
- [x] 1.3 Checks: `node --check mods/openspec/main.js` passes; re-read the diff confirming `toggled`, `flipPair` and `occurs` are untouched.

## 2. The write — `mods/openspec/main.js`

- [x] 2.1 Add `writeFlips(path, body, next)` beside `writeFlip` per design D5: local branch `await writeTextFile(path, next, body); return next;`; remote branch builds `flipPairs`, zero pairs returns `body`, else ONE `exec("herdr-core", ["file", "edit", path, ...pairs.flatMap((p) => [`--old=${p.old}`, `--new=${p.neu}`])], { cwd: this.root, on: this.on })`, non-zero exit throws `exitDetail(r)`, then the re-read with every differing line byte-equal to `next`'s line or `"the write did not land as asked"`. Comment quoting the `--help` line "repeatable … all or none".

## 3. The action and its arm — `mods/openspec/main.js`

- [x] 3.1 Add `markAll(name, cx)` beside `toggle` per design D6: guard, spend the arm, optimistic `r.done = true` for every non-section open row of the full `this.tasks`, `this.toggling = name`, one attempt + one re-read/rebuild/retry, settlement only when still open and the context matches, toast `"Tasks not updated"` with the reused reason strings, `this.refresh(cx)`.
- [x] 3.2 Init `this.marking = null; this.markUntil = 0;` beside `this.confirming`/`this.confirmUntil`.
- [x] 3.3 Wire the design D8 reset points, naming each function in the comment: the context-change reset, `pick()`, the change-leaves-list sweep, `toggle()`'s settlement, `loadTasks` (disarm only when the freshly read text differs), and `markAll`'s own start.

## 4. The header row — `mods/openspec/main.js`

- [x] 4.1 In `row()`'s fold-out, inside the `Array.isArray(this.tasks)` branch, add the right-aligned bar as the first child per design D1/D2/D7: idle label `Mark all N done`, armed `Mark all N?` with the chip's red chrome, spinner while `this.toggling === c.name`; first press sets `marking`/`markUntil = Date.now() + 6000`, second press inside the window calls `markAll`; hidden when N is 0, but it stays rendered while `this.toggling` names this change so the spinner can paint.

## 5. Specs

- [x] 5.1 Verify the delta still matches what was built; adjust only where implementation forced a decision the spec did not name.
- [x] 5.2 `git status` shows `panel-slash-commands/` and the owner's files untouched.

## 6. Documentation

- [x] 6.1 README **Expanded** bullet (60–75 re-check by text): the action and its two-click rule join the bullet.
- [x] 6.2 README **What it runs** (165–182 re-check by text): the one-write sentence — local one compare-and-swap; remote one `herdr-core file edit` with one pair per open line, all-or-none, verified by re-read.
- [x] 6.3 README **Limits**: the "Long task rows wrap" bullet loses "Only the tasks shown can be ticked from the panel" (no longer true).
- [x] 6.4 RECIPE description paragraph (~15–18) and **What it runs** (~102–108) gain the matching sentence.

## 7. Checks and deploy

- [x] 7.1 `openspec validate mark-all-tasks-done --strict` passes.
- [x] 7.2 `openspec validate --specs --strict` passes.
- [x] 7.3 `node --check mods/openspec/main.js` passes.
- [x] 7.4 `herdr-app check mods/openspec` passes.
- [x] 7.5 Sync the snapshot the app runs: `rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/`, then reload the OpenSpec panel.

## 8. Manual checks in the app (owner)

- [x] 8.1 Local mark-all: all rows flip at once, exactly one write, counts and progress bar follow on the refreshed list.
- [x] 8.2 A `tasks.md` with >120 rows: the action counts and ticks the rows past the cap too.
- [x] 8.3 Remote mark-all: one `file edit` lands whole; an ambiguous duplicated line refuses with nothing written; a forced failure reverts the optimistic flip and toasts "Tasks not updated".
- [x] 8.4 The arm lapses at ~6 s and on row switch, fold-away and a single task tick.
- [x] 8.5 A task click during a mark-all, and a mark-all press during a toggle, are each ignored; the action shows the spinner while in flight.
- [x] 8.6 Hidden with no `tasks.md`, no tasks, and when every task is done.
- [x] 8.7 The viewer's tasks tab and single-task toggles behave exactly as before.
