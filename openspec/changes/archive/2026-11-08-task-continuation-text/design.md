## Context

`taskRows` (mods/openspec/main.js, ~206) turns `tasks.md` into flat rows: a
markdown heading becomes a `{section}` row, a `- [ ]` / `- [x]` checkbox line
becomes `{done, line, text}` where `line` is the checkbox line's 0-based index
in `text.split("\n")` and `text` is that line's own content after the box. Any
other line is dropped — including the indented continuation lines of a wrapped
entry. The comment above the helper says so outright: "Continuation lines of a
wrapped task are dropped".

Every view renders `row.text`: the fold-out row (`taskLine`, ~1243) in a fixed
`h(18)` row with `.truncate()`, so it clips to one line; the hover card
(`hoverCard`, ~1223) at 340px wide where the text wraps; the viewer's tasks tab
(`taskRowView`, ~1447) at 13px/20px where it also wraps. There is no row cap in
the parser — the fold-out slices at 120 rows (`row()`, ~1295).

Toggling depends on `row.text` being that one line. `toggled(text, line, task,
to)` (~221) returns null unless the checkbox line still holds exactly `task`
(`box[4].trim() !== task`), and both toggle paths pass `row.text` (`toggle`
~1183 for the panel, `toggleTask` ~1053 for the viewer). `flipPair` (~242)
builds the remote old/new pair from that one line's bytes in body and next —
single-line by design, so the whole edit travels as argv values — and its
uniqueness check (`occurs(body, old) !== 1`) counts only that line.

## Goals

- Every view — fold-out rows, the viewer's tasks tab, the hover card — shows a
  task entry's whole text, continuation lines included.
- Toggling keeps working unchanged, locally and remotely, and the remote pair
  stays first-line-only.

## Non-Goals

- Changing the toggle, remote write, verification or failure-reporting paths.
- Full CommonMark list semantics (lazy flush-left continuations stay dropped).
- Multi-line section headings.

## Decisions

1. **`row.text` stays the match text; a new `row.full` is the display text.**
   `toggled`'s guard compares against the checkbox line's own text, and both
   toggle call sites pass `row.text` as the task. If the row's `text` became
   the folded entry, the checkbox line would no longer contain it and every
   toggle would refuse with "the task changed under the click". Keeping `text`
   as the checkbox line and adding `full` for display means `toggled`,
   `flipPair`, `occurs`, `writeFlip`, `toggle` and `toggleTask` are untouched —
   the change is one parse step plus display swaps. The alternative (display in
   `text`, match on a new field) moves the risk onto the two toggle paths and
   the remote pair for no gain.

2. **Continuation lines join with a single space**, each piece trimmed. The
   precedent is the mod's own markdown renderer (main.js ~468–473): "An
   indented non-marker line continues the item above it (markdown's wrapped
   item text); a blank or flush-left line ends the list", joined with
   `` `${last.text} ${cont[1]}` ``. The owner compares against rendered
   markdown, which flows paragraphs, and a space-join keeps every display site
   a single string needing no multi-line text node.

3. **A continuation is an indented, non-blank, non-heading, non-checkbox line
   (`/^ {2,}(\S.*)/`) while a task row is current** — the markdown renderer's
   fold rule, but anchor-less: its regex keeps the `$` anchor, ours drops it
   for CRLF, where `.` never captures `\r` so `$` would drop every CRLF
   continuation and end the entry early; with LF endings the two match
   identically. The renderer still drops CRLF continuations — keeping both
   parsers identical is approximate by design. A blank or flush-left line ends
   the entry; an indented line with no task above it stays dropped. Folded
   text is trimmed on every append as belt-and-braces.

4. **Fold-out task rows wrap instead of truncating.** The complaint is that the
   continuation is invisible; folding it into a row that still truncates would
   change nothing in the panel, where the first line already fills the width.
   So `taskLine`'s item drops `.truncate()` and its fixed `h(18)` (→ `min_h(18)`,
   `items_start()`, `line_height("18px")` on the mark and the text so the ✓/○
   aligns with the first line — `taskRowView` is the precedent for a wrapping
   row). Section headings keep truncating with their card. The 120-row cap is a
   row count and is untouched; rows are taller, so a long fold-out scrolls
   further.

5. **Blank checkbox lines stay blank rows with no card — measured after
   folding.** `taskLine`'s `Boolean(text)` card guard and `text || " "` move to
   `full`. An entry blank on the checkbox line with no continuation renders
   exactly as today. An entry blank on the checkbox line but continued below is
   not a blank entry: it shows its text and gets a card.

6. **The remote pair and the uniqueness check stay first-line-based.**
   `flipPair` reads `before[line]` / `after[line]` — the checkbox line's bytes
   only — so the argv-safe single-line edit is unchanged and a flip never
   touches the continuation lines. Two entries whose checkbox lines are
   identical but whose continuations differ still refuse on remote with "the
   task's line is not unique in tasks.md"; that honest refusal stands.

## Risks

- Taller fold-out rows change the panel's proportions where entries have long
  continuations. If it reads too tall, the fallback is to truncate the row
  again and let the hover card carry the full text — a one-line revert of
  decision 4.
- Space-joining discards the author's hard line breaks inside an entry. That
  matches rendered markdown flow, but an entry using line breaks as structure
  reads as one paragraph.
- The fold rule is the markdown renderer's, not full CommonMark: a lazy
  flush-left continuation still drops. Keeping both parsers identical apart
  from the anchor is the deliberate choice.
- A checkbox line blank on the first line but continued below gains visible
  text and a card (decision 5); today it renders blank.

## Migration Plan

No data migration. The parse change is display-only: `toggled`, `flipPair` and
the remote read–edit–verify round trip keep matching and rewriting the checkbox
line's exact bytes, so open panes and older snapshots keep working — rows are
rebuilt from the file each pane already reads. After landing, sync the mod to
the app's copied snapshot (the command is in tasks.md) and reload the panel.
