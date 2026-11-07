# Tasks

## 1. Keep the terminal's folder

- [x] 1.1 In `mods/openspec/main.js`, add a module-level remembered location `{ cwd, on, space }`, updated whenever `location()` resolves a real terminal folder (focused pane's cwd or a focused layout terminal block's cwd)
- [x] 1.2 In `location()`, when focus has no cwd and the remembered location belongs to the active space, return it before the any-pane fallback; otherwise resolve as now and remember the result when it came from a terminal
- [x] 1.3 Reorder resolution so a focused layout terminal block's own cwd beats the any-pane fallback; keep the `folder` prop first and the space folder last
- [x] 1.4 Confirm the cache is ignored when the active space changes, and that a pinned `folder` never updates or reads it

## 2. Complete is green

- [x] 2.1 Add a `green(t)` helper in `mods/openspec/main.js`: `t.ansi10 || t.ansi2 || "#3fae6a"`, with a comment saying the theme's `done` is an agent-status colour and may be blue
- [x] 2.2 Use it for the complete progress bar, row name, `done/total` count and `✓ complete` chip
- [x] 2.3 Use it for the `✓ Complete` state group header (`STATES` complete colour) and for done task ticks and complete task text in `taskLine`

## 3. Docs

- [x] 3.1 README.md — say the list follows the focused terminal and that clicking the panel, a viewer or the floating window does not change the folder
- [x] 3.2 README.md — say completion uses the theme's bright ANSI green, and that a complete change's bar, chip and ticks are green even when the theme's `done` status colour is not
- [x] 3.3 RECIPE.md — the list reads the last focused terminal's folder (panel clicks leave it alone) and completion's green is the ANSI bright green, not `done`

## 4. Checks

- [x] 4.1 `node --check mods/openspec/main.js`
- [x] 4.2 `openspec validate follow-terminal-and-green-complete --strict` and `openspec validate --specs --strict`
- [x] 4.3 Sync `mods/openspec/main.js` to `~/.config/herdr-app/mods/openspec/main.js`, then `herdr-app check mods/openspec` and `herdr-app status` (no mod errors)
- [x] 4.4 In-app (owner): with the list reading herdr-openspec, click the panel and a viewer — the footer and rows stay on herdr-openspec; click another terminal — it switches; switch space with no terminal focused — it resolves afresh
- [x] 4.5 In-app (owner): a complete change's row, chip, bar and expanded tasks read obviously green (not the theme's blue `done`)
