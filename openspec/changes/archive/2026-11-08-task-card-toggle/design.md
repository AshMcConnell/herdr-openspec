## Context

The just-landed `task-hover-card` change replaced the fold-out's shell
tooltips with a styled card built by `hoverCard(id, trigger, state, text)`
beside `taskLine` in `mods/openspec/main.js`. Its design called the card
"read-only, pointer-transparent content" as a non-goal. The owner has used
the card and wants to tick a task from it: read the full line, tick it, move
on.

The moving parts today:

- `taskLine` builds the row and gates its own click on `!this.on` (remote
  spaces read-only): `.when(!this.on, (e) => e.cursor_pointer().hover(...)
  .on_click((_e, cx) => this.toggle(row, name, cx)))`.
- `toggle(row, name, cx)` (main.js:1107) owns every guard and the whole
  write: early return on `this.on` / no root / `this.toggling` / no line
  number, optimistic flip, compare-and-swap on the snapshot, one retry
  against a fresh read, toast on failure.
- `hoverCard` builds the card content inside the same render pass, so a
  closure over the row's handler is available at build time.
- Section headings call the same helper with state `"section"`.

## Goals / Non-Goals

**Goals:**

- A toggle button inside task hover cards, wired to the same `toggle(...)`
  the row uses — no second write path.
- Local spaces only; a remote space's card stays read-only and buttonless.
- Section heading cards never get a button.
- Keep the `Boolean(text)` guard, the row's own click target, the 120-row
  cap, and the change viewer's tasks tab exactly as they are.

**Non-Goals:**

- Closing the card on toggle. The kit has no close API (see Decisions); the
  card staying open is the design, not a compromise half-measured.
- Any edit beyond the checkbox flip — no text editing, no task adding.
- Keyboard activation for the button: `on_click` keyboard activation exists
  "only on components whose Base primitive supports it" (d.ts, on_click
  doc); a plain element gets the pointer. The row has the same property
  today.
- Changing the row's click behaviour, the write path, or hover timing.

## Decisions

**Clicks do land inside `HoverCard` content — the old "pointer-transparent"
non-goal was wrong.** Evidence from `mods/openspec/gpui-kit.d.ts`:

- The `content` slot doc (lines 631–638) says the element "is part of *this*
  render: it is described beside its trigger and rebuilt with it, which is
  exactly what makes `cx.notify()` reach inside an open surface", and
  illustrates the slot with an interactive open menu: "pick an item in an
  open menu, watch a count outside the menu change". Interactive content in
  an anchored surface is the documented purpose of the slot.
- The same doc (lines 640–643): "A `HoverCard` wraps what it is given in an
  element of its own, so that moving the pointer onto the card keeps it
  open... the region the pointer has to reach is the wrapper around it."
  The wrapper is a hit region the pointer reaches; nothing in the
  declaration says clicks fall through it.
- `on_click` is declared on the shared Element interface (line 720), and the
  pointer handlers are "wired" on plain `div`, `h_flex`, `v_flex`, `Button`,
  `Link`, `Checkbox`, `Switch`, `Radio`, `Toggle`, `Tabs` and `Tab`
  (lines 738–742). The card body is a `v_flex` of `div`s, so a plain
  element inside `.content(...)` is wired. The warning covers *other*
  components — the handler goes on a plain element inside the content, never
  on the `HoverCard` itself.
- The one restriction the d.ts puts on `on_click` placement (lines 838–851,
  on `on_item_click`) is about virtual-list item renderers, whose per-row
  handlers would accumulate as the list scrolls. The card content is built
  inline in `taskLine`'s render pass — the same pass that registers the
  row's own `on_click` — so it does not apply.

Conclusion: a button in the card wired to the row's toggle is possible. The
`task-hover-card` non-goal was an unverified assumption; this change drops
it, and the first manual check verifies it live (one flip per press, not a
passthrough double toggle, not a dead click).

**Wire it by closure: `hoverCard(id, trigger, state, text, onToggle)`.** The
card content is built inside `hoverCard`, but the toggle needs `taskLine`'s
`row` and `name`. The smallest change is an optional fifth parameter:
`taskLine` passes `(cx) => this.toggle(row, name, cx)` when `!this.on`; the
section call site passes nothing. A falsy `onToggle` renders no button, which
is also exactly the remote case. Alternatives rejected: passing `row`/`name`
and letting `hoverCard` call `this.toggle` couples the helper to the toggle
and to the remote gate it should not know about; a boolean "interactive" flag
still needs the handler, so it is the same parameter with less information.

**The card stays open across the toggle — forced, and better.** The d.ts is
plain: a HoverCard "owns its own open state: there is no `open` to control
and no press to handle, only `open_delay` and `close_delay`
(lines 21074–21079), and `on_open_change` is notification-only ("A
`HoverCard` accepts this too, and today never calls it", lines 904–907).
There is no close or dismiss call anywhere on the component, so
close-on-toggle cannot be written. Staying open is also the better outcome:
`toggle()` flips the row optimistically and calls `cx.notify()`, the open
card is rebuilt in the same render (content is "part of this render"), and
the card id `os-task-card-<line>` is stable because the line number survives
the flip — so the state line and the button swap to the new state in place.
The lean was to close on toggle, mirroring the row click; the kit forbids it,
and the owner reads the confirmation off the card instead.

**Button look: a plain full-width element in the card's palette, not a kit
`Button`.** The kit's `Button` draws its own interior in the app theme, which
would clash with the card's Tokyo Night surface. The repo already styles
small controls as plain elements — the "Archive?" chip on a change row
(main.js:1198–1200) and the viewer's task rows (main.js:1369:
`cursor_pointer().hover((s) => s.bg(NIGHT.bgAlt)).on_click(...)`). The button
mirrors those, under the card's body text:

- `h_flex().id(\`${id}-toggle\`).w_full().h(24).flex_none().items_center()
  .justify_center().rounded(6).border_1().border_color(NIGHT.border)
  .text_size(10).font_semibold().cursor_pointer()` — full width in the 340 px
  card (a flex-column child stretches), a bigger hit target than an inline
  chip, and it separates reading (above) from acting (below).
- Label "✓ Mark done" in `NIGHT_MD.done` (the checkbox green the card
  already uses for the done state line) on an open task; "↺ Reopen" in
  `NIGHT.muted` on a done one. The label names the flip it performs.
- `.hover((s) => s.bg(NIGHT.bgAlt).text_color(NIGHT.fg))` — the same hover
  surface the viewer's rows use.
- `.on_click((_e, cx) => onToggle(cx))`. No `cx.stop_propagation()`: the
  click lands in the card's layer above the window, where none of our
  elements sit above the button, so nothing can double-fire. The row
  underneath is not an ancestor of the layer. The manual check confirms one
  flip per press.

**Section cards and remote rows get no button, structurally.** The button is
keyed on `onToggle`, and only the task branch of `taskLine` passes one, so
the section call site changes not at all. Remote rows pass the closure only
when `!this.on` — the same gate the row's own click uses — so a remote card
renders exactly as it does today.

**One-at-a-time and failure paths come free.** `toggle()` already
early-returns while `this.toggling` is set, so a second press (row or
button) is ignored until the write settles; a failed write re-renders the
card to the file's real state and toasts, exactly like a row click. No new
guard belongs in the card. The `Boolean(text)` guard is untouched too: the
button is card content, so a blank checkbox row never sees it.

## Risks / Trade-offs

- **The d.ts says clicks work; the previous design said they do not.** The
  d.ts is the stronger evidence — it documents interactive content as the
  slot's purpose. If the live press still does not land, the fallback is a
  row-side control (an explicit tick button beside the row's glyph) as a new
  change; do not patch this one in place.
- **The card stays open over the row that flipped.** The flip is visible in
  the card's own state line and button; moving the pointer away closes it as
  today. Nothing new to handle.
- **The closure captures the row object `toggle()` mutates optimistically.**
  That is the same object the row click uses, and the settle path replaces
  the whole fold-out's rows on refresh, so no stale-card path exists.
- **120 rows could each describe a button.** As with the card itself, the
  button is only drawn while its card is open; the idle cost is unchanged.

## Migration Plan

No data model, file format or API change: one optional parameter on a
private helper, one call site that passes it, and a README bullet. Rollback
is dropping the parameter — the card falls back to read-only. Archive order:
`task-hover-card` archives first — this change's delta rewords the
**Click to toggle** requirement with "a task's hover card" wording that only
exists in the main spec once `task-hover-card`'s Display-cap delta lands.
The Herdr app
runs the copied snapshot at `~/.config/herdr-app/mods/openspec/`, so sync
before checking in the app:
`rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/`.
