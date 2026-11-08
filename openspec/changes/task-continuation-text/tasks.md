# Tasks

## 1. Parser and rows

- [x] 1. In `mods/openspec/main.js`, rework `taskRows` (~206) to fold continuation
   lines into the row they follow: track the last task row (`cur`, start null);
   a checkbox line pushes `{done, line, text}` with `text` the checkbox line's
   own content (unchanged) and sets `cur.full = cur.text`; a line matching
   `/^ {2,}(\S.*)/` while `cur` is set appends `cont[1].trim()` to `cur.full`
   as ``cur.full ? `${cur.full} ${piece}` : piece`` with `piece` the trimmed
   continuation, so an empty base takes no leading separator; a heading, a
   blank or flush-left line, or any other line sets `cur = null` and stays
   dropped. This is the markdown renderer's fold rule for list items at
   ~468–473, apart from the dropped `$` anchor (see design decision 3).
- [x] 2. Rewrite the comment above `taskRows` (currently "Continuation lines of a
   wrapped task are dropped") to describe the fold and the two texts:
   `row.text` is the checkbox line's text, the one a toggle matches on;
   `row.full` is the whole entry, the one every view shows.

## 2. Views

- [x] 3. In `taskLine` (~1243): destructure `full` from the row; render
   `full || " "` instead of `text || " "`; pass `full` to `hoverCard` and use
   `Boolean(full)` for the card guard, so a blank entry stays a blank row with
   no card. Make the row wrap: item container `min_h(18)` instead of `h(18)` and
   `items_start()` instead of `items_center()`, drop `.truncate()` from the
   text div, and give the mark and text divs the same `line_height("18px")` so
   the ✓/○ aligns with the first line (the viewer's `taskRowView` is the
   precedent). Section headings keep truncating with their card.
- [x] 4. In `taskRowView` (~1447): render `row.full || " "` instead of
   `row.text || " "`. Nothing else — it already wraps, and remote rows stay
   read-only.
- [x] 5. Check that `toggled`, `occurs`, `flipPair`, `writeFlip`, `toggle` and
   `toggleTask` are untouched: they match and rewrite the checkbox line through
   `row.text`, which keeps its meaning.

## 3. Specs, docs, checks and deploy

- [x] 6. Add the spec deltas `specs/task-tracking/spec.md` (MODIFIED "Task list
   parsing" and "Display cap") and `specs/proposal-viewer/spec.md` (MODIFIED
   "Task tab") under this change.
- [x] 7. Update `README.md`: the **Expanded** bullet (task rows show the entry's
   whole text wrapped over as many lines as it takes, continuation lines
   included; only section headings truncate) and the **Limits** bullet "Long
   task lines" (continuations are folded in and rows wrap; lists past 120 rows
   still point at the file).
- [x] 8. Run the checks: `openspec validate task-continuation-text --strict`, then
   `openspec validate --specs --strict`, then `node --check mods/openspec/main.js`.
- [x] 9. Deploy to the app's copied snapshot: `rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/`, then reload the mod panel in
   the app — the app runs that copied snapshot, not the repo.

## 4. Manual owner checks

- [ ] In change p145 (or any change with multi-line entries), fold out the row:
  entry 4.1 reads in full — "(set the key, not" and its continuation lines as
  one wrapped row — and so does 4.2; the same full text shows on the viewer's
  tasks tab and in the hover card.
- [ ] Tick a multi-line entry locally and again on a remote pane: only the
  checkbox line flips and the continuation lines are byte-identical afterwards
  (`git diff` shows exactly one changed line).
- [ ] On a remote pane, tick an entry whose checkbox line is identical to
  another entry's (their continuations differ): it refuses with the
  "the task's line is not unique in tasks.md" toast and the file is unchanged.
- [ ] A blank checkbox line still renders as a blank row with no hover card.
