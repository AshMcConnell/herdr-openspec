## Context

The fold-out in `row()` (main.js:1466–1474) renders `this.tasks.slice(0, 120)`. Ticking is one row at a time: `toggled()` (324) rewrites one checkbox line with the CRLF-preserving `[\s\S]` trick; `occurs()`/`flipPair()` (333–354) carry the uniqueness refusal and the clap `--old=` lesson; `writeFlip()` (1332–1343) is the local compare-and-swap vs the remote read–edit–verify; `toggle()` (1352–1383) does the optimistic flip, one retry, the `this.toggling` guard and the toast "Task not updated". The archive chip already has a two-click confirmation pattern: `confirming`/`confirmUntil` (800, 849, 876, 1264, 1436, 1462), a render-side `Date.now()` check with no timer. `pick()` (1259) and `loadTasks` (958) own the snapshot `this.tasksText` the write is compared against.

The remote write shape is already probed: `herdr-core file edit --help` says "Replace exact text found once (--old X --new Y, repeatable); all or none" and "--old … (repeatable, paired with --new in order)". The repeatable pair is what makes one command possible.

## Goals / Non-Goals

**Goals:**

- One press ticks every open task in one write, in local and remote spaces alike.
- Rows past the 120-row display cap are counted and ticked too.
- A confirmation that cannot fire by accident.
- No new race with single toggles — one guard covers both.
- Failure always leaves the panel showing the file's truth.

**Non-Goals:**

- The change viewer's tasks tab (`proposal-viewer`'s separate write copy).
- Any untick-all or partial selection.
- Changing single-task toggle behaviour.
- New toasts on success.

## Decisions

### D1. Placement

The header row sits inside the fold-out's `v_flex` as its first child, before the task rows: `h_flex().justify_end()`, `text_size(10)`/`t.dim` like the "+ N more" line. Not the row menu (the action is change-scoped, and the active `panel-slash-commands` change owns that menu), not the viewer (a separate write copy with its own snapshot). No `stop_propagation` needed — the fold-out sits outside the clickable row header, unlike the archive chip, which is inside it.

### D2. Arm state

`this.marking` (the armed change name) and `this.markUntil` (the deadline), separate from `confirming`/`confirmUntil`, so arming archive and arming mark-all never withdraw each other. The render-side check is `this.marking === c.name && Date.now() < this.markUntil`, exactly the chip's pattern — no timer; the label goes back on the next repaint after the window (the chip's accepted behaviour). Armed chrome mirrors the chip (`bg` tint + coloured text).

### D3. The pure rewrite — `markedAll(text)`

Beside `toggled`: per line, match `^(\s*[-*]\s+\[)( |x|X)(\][\s\S]*)$`; when the mark is a space, rewrite it to `x`; `[x]`/`[X]` and every other line are untouched; `[\s\S]` keeps the trailing `\r` so CRLF files survive byte-for-byte. Returns the new text — never null, because there is no per-line identity to check; identity is the compare-and-swap's/the edit's job. The caller treats `next === body` as the silent already-holds-it accept, mirroring `writeFlip`'s same-pair branch.

### D4. The remote pair builder — `flipPairs(body, next)`

Beside `flipPair`: walk both split texts; for every index where the lines differ, assert both match the checkbox-line regex and differ only in the mark (they do by construction from `markedAll`; the assert fails safe), and collect `{ old, neu, line }`. For each pair, `occurs(body, old) === 1` or throw `"the task's line is not unique in tasks.md"` — before any write, so the CLI's all-or-none is the backstop, not the first line of defence.

### D5. The write — `writeFlips(path, body, next)`

Beside `writeFlip`. Local branch is literally `await writeTextFile(path, next, body); return next;`. Remote branch: build `flipPairs`; zero pairs → return `body`; else ONE `exec("herdr-core", ["file", "edit", path, ...pairs.flatMap((p) => [`--old=${p.old}`, `--new=${p.neu}`])], { cwd: this.root, on: this.on })` — the `=` form, the clap lesson from `remote-task-toggle` (every value starts `- ` or `* `). A non-zero exit throws `exitDetail(r)`. Then `readTextFile(path, { on: this.on })` (null → `"tasks.md is gone"`) and accept only when **every** differing line byte-equals `next`'s line (`reread.split("\n")[i] === next.split("\n")[i]`), else `"the write did not land as asked"`; return the re-read as settled.

### D6. `markAll(name, cx)`

Beside `toggle`, same scaffolding: guard `!this.root || this.toggling || this.open !== name || typeof this.tasksText !== "string"`; spend the arm (`this.marking = null`); optimistically set `r.done = true` in place for every non-section open row of the full `this.tasks` (past-cap rows included); `this.toggling = name`; then `body = this.tasksText`, one attempt at `writeFlips`, on throw one re-read + one rebuild + one retry (the shared retry shape — an ambiguity refusal simply refuses twice and writes nothing), and the outer catch sets `why` and `settled = body`. Settlement replaces `this.tasksText`/`this.tasks` only when still `this.open === name` and the context matches; `this.toggling = null`; `if (why) notify({ title: "Tasks not updated", body: why, level: "error" })`; `this.refresh(cx)`. Reason strings are reused from the single-task path: `"tasks.md is gone"`, `"the task changed under the click"`, `"the task's line is not unique in tasks.md"`, `"the write did not land as asked"`, `exitDetail(r)`.

### D7. Visibility and spinner

Rendered only inside the `Array.isArray(this.tasks)` branch, gated by `openCount > 0 || this.toggling === c.name` where `openCount = this.tasks.filter((r) => !r.section && !r.done).length`; the in-flight half matters because the optimistic flip empties `openCount` before the write settles, so the bar also stays up while this change's write runs — otherwise the spinner is never rendered. While `this.toggling === c.name` the label is replaced by the row spinner (`svg("mods/workspace-chrome/spinner.svg").size(12).spin(900)`) and the press guard refuses. Counts and the progress bar are **not** bumped optimistically — same as a single toggle; the refreshed `openspec list` (watch or poll) brings them.

### D8. Arm reset points

Each named: init beside `confirming` (main.js:800); the context-change reset (848–849); `pick()` beside `this.confirming = null` (1264); the change-leaves-list sweep (876/881); `toggle()`'s settlement (1375–1377 — a single tick changed the task state, so N changed); `loadTasks` (963–964) — disarm only when the freshly read text differs from the `this.tasksText` it replaces, so a poll that re-reads an unchanged file (fired by an unrelated sibling change's edit) does not spend the arm; and `markAll`'s own start. The arm never survives into its own write.

## Risks / Trade-offs

- **argv length for the one remote edit** — a `tasks.md` with hundreds of open lines is still far under ARG_MAX; noted, accepted.
- **Pathological task text containing another checkbox line** could make a later `--old` ambiguous after an earlier pair applies — the CLI's per-pair found-once check plus all-or-none refuses the whole edit; worst case a toast, never a partial file.
- **The 6-second arm can go visually stale** until the next repaint — inherited from the chip pattern.
- **Both confirmations can be armed at once** — independent fields, no collision.
- **`panel-slash-commands` shifts line numbers** — anchors are located by symbol name (`grep`), not by line number.

## Migration Plan

None: no data, schema or CLI change. Rollback is deleting the header row, `markAll`, `writeFlips`, the two helpers and the two state fields. Sync the app snapshot (`rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/`) before checking in the app.

## Open Questions

- **Armed chip colour** — decided: archive red (`t.ansi1` + 22-hex tint, the modelled pattern) for consistency with the archive chip; accent is the alternative, a one-token change.
- **Success feedback** — decided: silent success, a row of flipped ticks plus arriving counts, exactly like a single toggle, which never toasts; a "Tasks updated" toast is the alternative.
- **Arm vs poll re-read** — decided: disarm only when a re-read's text actually differs; the simpler "disarm on any `loadTasks` landing" is the alternative, and its cost is that an unrelated sibling change's file edit during the 6 s window would spend the arm.
