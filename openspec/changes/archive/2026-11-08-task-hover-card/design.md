## Context

A folded-out change shows its `tasks.md` as compact rows inside the panel's
scrollable list. `taskLine` in `mods/openspec/main.js` builds each row: section
headings are a 10 px muted line, task rows are a ✓/○ glyph plus a truncated
11 px line. Both call the kit's `.tooltip(text)` when the row has text.

That `tooltip(text)` is the shell's own label. It takes a string, cannot wrap,
draws in the app theme rather than the panel's Tokyo Night colours, and offers
no room for anything but the raw line. A long task — the case the hover exists
for — becomes one strip that runs to the window edge.

The kit already ships `HoverCard`: a trigger plus a `content` element rendered
in a layer above the window. It owns its open state (there is no `open` to
wire), opens after `open_delay` (default 600 ms), closes after `close_delay`
(default 300 ms), keeps the card open while the pointer crosses the gap and
rests on it, and clamps the surface inside the window. `content` is an element
from the current render, so it can use the panel's `NIGHT` palette and any
layout the list already uses.

Constraints: the fold-out caps at 120 rows, lives in an
`overflow_y_scrollbar` region, and its task rows are click targets for the
toggle write (local panes only). The card must not break either.

## Goals / Non-Goals

**Goals:**

- Replace the one-line tooltip with a panel-styled card: Tokyo Night surface,
  border, rounded corners, padding, readable text size and line height.
- Keep the full text readable: cap the card width and let the text wrap over
  as many lines as it needs. Never clip it.
- Name the row's state in the card: done or open for a task, section for a
  heading.
- Leave truncation, the 120-row cap, click-to-toggle, remote read-only
  behaviour and the change viewer's tasks tab exactly as they are.
- Stay inside the existing kit — no new component, dependency or file.

**Non-Goals:**

- Rich markdown in the card (bold, links, code spans). The body is the plain
  row text, as the tooltip was.
- Showing the card in the change viewer's tasks tab — that page already shows
  every line in full.
- Detecting whether the row actually truncated and showing the card only then.
  The kit exposes no text-width measurement, and the existing tooltip already
  shows on every non-empty row.
- Re-styling the shell tooltip globally or changing any other hover.
- Making the card interactive: read-only as this change ships it — superseded
  by `task-card-toggle`, which later adds a toggle button inside the card.

## Decisions

**Use `HoverCard` on the row, not another tooltip.** `HoverCard.new(id)` with
the existing row as its `.trigger(...)` and a styled `v_flex` as `.content(...)`
is the smallest change: the kit owns open/close timing, the pointer crossing
the gap, Escape-free dismissal and window clamping. The trigger stays the same
element, so the row's `.hover(...)` background and `.on_click(...)` toggle are
untouched. Alternatives:

- `.tooltip(text)` — rejected: string-only, one line, shell-themed. That is
  the thing being replaced.
- `Popup` with mouse-enter/leave state — rejected: the script would have to
  own open state and close timing to reproduce what `HoverCard` already does,
  and a press-opened surface is the wrong interaction.
- A floating `overlay` pane — rejected: far too heavy for a hover, and it
  would steal focus.

**Wrap the whole row as the trigger.** The old tooltip covered the whole row,
checkbox glyph included; wrapping only the text div would shrink the hover
target and make the glyph feel dead. The row id (`os-task-<line>`,
`os-sec-<section>`) stays on the inner element; the card gets its own id
(`os-task-card-<line>`, `os-sec-card-<section>`) so the two elements are not
confused. The trigger also gets `.w_full()`, so the wrapper the component adds
cannot shrink the row's hover background or click area.

**Card layout: one small state line, then the full text.**

- `v_flex().w(340).p(10).gap(6).rounded(8)` — a fixed, readable measure. The
  text wraps at that width; short rows get a slightly wide card, which is
  preferable to a card that jumps width row by row.
- `.bg(NIGHT.bg)`, `.border_1().border_color(NIGHT.border)`,
  `.text_color(NIGHT.fg)`, `.text_size(12.5).line_height("18px")` — the same
  Tokyo Night surface the change viewer uses, at a comfortable reading size.
- State line: `✓ done` in `NIGHT_MD.done` or `○ open` in `NIGHT.muted`, 10 px
  and semibold; section cards show `section` in `NIGHT.faint` instead.
- Body: the full row text in `NIGHT.fg`, `.min_w(0)` so it wraps rather than
  pushes the card wider. A done task stays in the neutral body colour: the
  state line carries the green, and a wall of green body text is harder to
  read, especially for a change that is entirely complete.
- Alternative considered: width-by-content (`max_w(340)` only). The kit gives
  no measurement hook, and a content-sized box makes long tasks sit at the cap
  while short ones jitter; a fixed width is predictable and simple.

**Anchor `top_left`.** Task rows are left-aligned in a narrow panel, so pinning
the card's left edge to the row's left edge keeps it near the text it belongs
to. The kit's default `top_center` would centre a 340 px card over an 11 px
glyph and push it towards the pane's middle. The surface is clamped to the
window either way, so a row near the right edge still stays visible.

**Delays: 400 ms open, 250 ms close.** Slightly quicker than the kit defaults
(600/300) because the card replaces a tooltip the user already expects, but
slow enough that moving the pointer down a 120-row list does not strobe cards.
The close delay is what lets the pointer leave the row and land on the card
without it disappearing. Both are constants next to the layout choice, so they
are easy to tune.

**Only for rows with text.** Keep the existing `Boolean(text)` guard: a blank
checkbox line renders the existing blank row and no card. Section headings
already guard on their own text.

## Risks / Trade-offs

- **The card can cover rows below it.** It is a transient layer and closes
  when the pointer leaves; this is the normal hover-card trade-off, and the
  alternative (a wider row) costs list density. The kit clamps it to the
  window.
- **340 px can be wider than a narrow panel** and spill over the neighbouring
  pane. That is expected for an anchored surface and keeps long text readable;
  a narrower card would add more lines than the pane has height.
- **120 rows each describe a card element per render.** The card is only drawn
  while open, and its content is a handful of divs with no markdown, so the
  idle cost is the trigger wrapper. If this ever measurably slows a list, the
  fallback is to keep the card on the row but shorten its body; dropping to
  `.tooltip` per row would restore the old problem.
- **A hover card is not a screen-reader label.** As with the tooltip it
  replaces, the row's text is already in the accessibility tree; the card
  adds no semantics. No `accessibility_label` work is needed.
- **Click-to-toggle must keep working through the wrapper.** The row is the
  trigger and keeps its own `on_click`; the HoverCard owns only hover state.
  This is verified as part of the change's manual checks (tick a task, tick a
  done task, click a remote row).
- **Duplicate section headings would produce duplicate card ids.** The
  existing section row id has the same property and has not been a problem;
  tasks carry a unique line number, which is the common case.

## Migration Plan

No persisted state, no data model and no API change: replace the two
`.tooltip(...)` calls in `taskLine` with the card, update README.md, and
reload the mod. Rollback is restoring the two `.tooltip(text)` calls; nothing
else depends on the card.
