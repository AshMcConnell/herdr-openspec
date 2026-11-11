## 1. Archive check

- [x] 1.1 Add `readArchive(root, on)` beside `readList` per design D1: `find <root>/openspec/changes/archive -mindepth 1 -maxdepth 1 -type d`, take each folder's base name, strip a leading `YYYY-MM-DD-`; a missing directory, failed command or thrown read returns an empty list.
- [x] 1.2 In `refresh()`, run `readArchive` on the own root in parallel with the listings; before the one-row choice, drop a linked section's rows whose names are archived and leave the own section's rows alone.
- [x] 1.3 Check: `node --check mods/openspec/main.js`; with the own worktree's 16 archived M54/lightmap names, the col worktrees' copies are hidden and the header counts drop them.

## 2. Specs and documentation

- [x] 2.1 Re-read the delta against the implementation; `openspec validate hide-archived-copies --strict` passes.
- [x] 2.2 README: the worktree section bullet and limits explain that the own worktree's archive hides stale linked copies.
- [x] 2.3 RECIPE: the What it runs list gains the archive read.

## 3. Checks and deploy

- [x] 3.1 `node --check mods/openspec/main.js` passes.
- [x] 3.2 `openspec validate hide-archived-copies --strict` and `openspec validate --specs --strict` pass.
- [x] 3.3 `herdr-app check mods/openspec` passes.
- [x] 3.4 Sync the snapshot and check the real `godot` repository in the app: the stale M54/lightmap copies disappear, col-27 at 6/6 still shows, and the header counts follow.
