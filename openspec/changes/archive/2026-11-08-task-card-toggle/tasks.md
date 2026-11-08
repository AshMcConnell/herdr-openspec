## 1. Toggle button in the hover card

- [x] 1.1 Widen the helper in `mods/openspec/main.js` to `hoverCard(id, trigger, state, text, onToggle)`: when `onToggle` is truthy, append a button under the body text with `.when(onToggle, ...)` on the card's `v_flex` — `h_flex().id(\`${id}-toggle\`).w_full().h(24).flex_none().items_center().justify_center().rounded(6).border_1().border_color(NIGHT.border).text_size(10).font_semibold().cursor_pointer()`, label "✓ Mark done" in `NIGHT_MD.done` for an open task or "↺ Reopen" in `NIGHT.muted` for a done one, `.hover((s) => s.bg(NIGHT.bgAlt).text_color(NIGHT.fg))`, `.on_click((_e, cx) => onToggle(cx))`.
- [x] 1.2 In `taskLine`, pass the toggle only for local task rows: the task branch calls `this.hoverCard(\`os-task-card-${line}\`, item, done ? "done" : "open", text, !this.on ? (cx) => this.toggle(row, name, cx) : null)`. The section branch, the row's own `.when(!this.on, ...)` click chain, and the `Boolean(text)` guard are unchanged.
- [x] 1.3 Update the comment above `hoverCard` to describe the button and its local-only gate.

## 2. Documentation

- [x] 2.1 Update the README **Expanded** bullet: the hover card also carries a "Mark done" / "Reopen" button that ticks the task from the card, local spaces only (remote cards show no button).

## 3. Checks and deploy

- [x] 3.1 Run `openspec validate task-card-toggle --strict`.
- [x] 3.2 Run `openspec validate --specs --strict`.
- [x] 3.3 Run `node --check mods/openspec/main.js`.
- [x] 3.4 Sync the snapshot the app runs: `rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/`, then reload the mod panel in the Herdr app.

## 4. Manual owner checks

- [x] 4.1 Hover a long open task in a local space and press "✓ Mark done": exactly one flip — the row ticks, the card stays open showing "✓ done", and the button now reads "↺ Reopen".
- [x] 4.2 Press the button on a done task: it reopens, and row and card flip back.
- [x] 4.3 Hover a remote space's task: the card shows the task with no button, and the row still does not toggle.
- [x] 4.4 Hover a section heading: the card shows the heading labelled `section`, with no button.
- [x] 4.5 Click a task row directly (an open and a done task) and confirm the row's own click still toggles exactly once.
