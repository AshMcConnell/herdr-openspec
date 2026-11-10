## 1. Change list — `mods/openspec/main.js`

Re-locate every anchor by symbol name (`grep -n "listSpecs\|this.confirming\|parsed.changes" mods/openspec/main.js`), not by line number — `panel-slash-commands` edits the same `row()`/init regions and may land first.

- [x] 1.1 In `refresh()`, filter dot names before the `.map()` per design D1 — `(parsed.changes ?? []).filter((c) => !(c.name ?? "").startsWith(".")).map(...)` — with a comment naming the verified CLI behaviour (the CLI lists dot folders as change entries).
- [x] 1.2 Checks: `node --check mods/openspec/main.js` passes; re-read the diff confirming `parsed.changes`'s other fields and the error paths are untouched.

## 2. Viewer specs — `mods/openspec/main.js`

- [x] 2.1 Extend the `listSpecs()` skip condition per design D2: `if (parts.length !== 2 || !parts[0] || parts[1] !== "spec.md" || parts[0].startsWith(".")) continue;` with a comment.
- [x] 2.2 Checks: `node --check mods/openspec/main.js` passes; confirm `discover()` and `select()` are unchanged.

## 3. Specs

- [x] 3.1 Verify the two deltas match the built behaviour; adjust only where implementation forced a decision the spec did not name.
- [x] 3.2 `git status` is clean of forbidden paths (`panel-slash-commands/`, `mods/`, README/RECIPE, the owner's uncommitted files).

## 4. Documentation

- [x] 4.1 README **What it runs**: "change entries and capability directories whose name begins with a dot are ignored — `openspec list` reports dot folders as changes, and the viewer's `find` can return a `spec.md` inside a dot directory, so the panel hides both (they are hidden, not deleted)".
- [x] 4.2 README **Limits**: that one-line bullet.
- [x] 4.3 RECIPE **What it runs** gains the matching sentence.

## 5. Checks and deploy

- [x] 5.1 `openspec validate ignore-dot-entries --strict` passes.
- [x] 5.2 `openspec validate --specs --strict` passes.
- [x] 5.3 `node --check mods/openspec/main.js` passes.
- [x] 5.4 `herdr-app check mods/openspec` passes.
- [x] 5.5 Sync the snapshot the app runs: `rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/`, then reload the OpenSpec panel.

## 6. Manual checks in the app (owner)

- [x] 6.1 A `.draft` folder under `openspec/changes/` is absent from the panel and from every count.
- [x] 6.2 A `.backup/spec.md` in a change leaves the specs tab showing only real capabilities.
- [x] 6.3 A dots-only repository shows "No active changes" and no error.
- [x] 6.4 A dot-only `specs/` shows no specs tab.
- [x] 6.5 Non-dot entries render exactly as before.
- [x] 6.6 The same in a remote space.
- [x] 6.7 A viewer pane opened directly on a dot change's `proposal.md` still renders.
- [x] 6.8 The watch still refreshes when a dot entry changes.
