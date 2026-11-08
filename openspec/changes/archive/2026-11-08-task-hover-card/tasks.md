## 1. Hover card in the fold-out

- [x] 1.1 Add a `hoverCard(id, trigger, state, text)` helper beside `taskLine` in `mods/openspec/main.js`: `HoverCard.new(id)` with the row as `.trigger(...)`, the styled body as `.content(...)`, `anchor("top_left")`, `open_delay(400)` and `close_delay(250)`.
- [x] 1.2 Build the card body in that helper: `v_flex().w(340).p(10).gap(6).rounded(8)` on `NIGHT.bg`, a `NIGHT.border` border, a 10 px state line (`✓ done` in `NIGHT_MD.done`, `○ open` in `NIGHT.muted`, `section` in `NIGHT.faint`) and the full text at 12.5 px with an 18 px line height in `NIGHT.fg`.
- [x] 1.3 Replace both `.tooltip(...)` calls in `taskLine` — the task row and the section heading — with the card, keeping the existing `Boolean(text)` guards, and give each trigger `.w_full()` so the component's wrapper cannot shrink its hover background or click area.
- [x] 1.4 Give the cards unique ids (`os-task-card-<line>`, `os-sec-card-<section>`) that are distinct from the row ids (`os-task-<line>`, `os-sec-<section>`).

## 2. Documentation

- [x] 2.1 Update the README **Expanded** bullet: hovering a truncated row shows a styled multi-line card that names the task's state, instead of "the full text shows on hover".
- [x] 2.2 Update the README **Limits** bullet on long task lines: the full text shows in a hover card.

## 3. Checks

- [x] 3.1 Run `openspec validate task-hover-card --strict` and `openspec validate --specs --strict`.
- [x] 3.2 Reload the mod; hover a long open task and a long done task and confirm a styled multi-line card with the matching state line and no clipped text.
- [x] 3.3 Hover a long section heading and confirm the card shows the full heading labelled `section`.
- [x] 3.4 Move the pointer from the row onto the open card and confirm it stays open; move away and confirm it closes after the short delay.
- [x] 3.5 Click an open task and a done task in a local space and confirm each still toggles; confirm a remote space's rows show the card but still do not toggle.
