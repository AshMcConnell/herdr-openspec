# Tasks

## 1. Review minors folded in (from theme-proposal-viewer)
- [x] 1.1 Blockquote bar `NIGHT_MD.quoteBar` `#80d0ff` (the owner's Tokyo Night theme accent, `hsl(202,100%,75%)` — not Obsidian's default), not `#565f89`; comment and any spec prose match
- [x] 1.2 `mdBlocks` splits lines with `/\r?\n/` so CRLF files parse; `toggled()` keeps `split("\n")` — its byte-exact `\r` round-trip is deliberate
- [x] 1.3 Fence info strings with spaces (```` ```rust title="x" ````) render their chip instead of being dropped or breaking the fence match
- [x] 1.4 The 2000-block cap now stated in the spec ("never drop content" except a document past the cap, ending in a faint "… truncated" line) — behavior already in `mdView`, text only; the truncation line stops naming `proposal.md` (generic text, since it now serves design and specs too)
- [x] 1.5 README.md and RECIPE.md say only http(s) links are clickable; other URLs stay coloured but inert

## 2. Viewer state and artifact discovery
- [x] 2.1 Change dir from the anchor prop (`file.replace(/[^/]*$/, "")`), name from `props.change` with the existing path fallback; no new props
- [x] 2.2 Artifact map per refresh: per artifact its text (undefined loading, null absent, string read) and error — one `readTextFile(path, {on})` per single file, probe and read in one call
- [x] 2.3 Specs listing: `exec("find", [specsDir, "-name", "spec.md"], {on})` for both local and remote — local `readdir` was refused for an arbitrary repository (no granted read root), so `find` is the one call; sorted by capability name, de-duplicated, failures degrade to a note
- [x] 2.4 Tab set recomputed each refresh: proposal always, design/tasks/specs only when present; open tab falls back to proposal when its artifact goes

## 3. Tab bar
- [x] 3.1 `Tabs.new(id)` / `Tab.new(id)` from gpui-base (the runtime's export); `selected(this.tab === id)`, `on_click` sets `this.tab` and reads that artifact, `set_position(i + 1, n)`
- [x] 3.2 NIGHT styling on the mod's own elements: selected `NIGHT.fg` with a `NIGHT.accent` (`#bb9af7`, Tokyo Night magenta) underline, unselected `NIGHT.muted`, hover `NIGHT.fg` — all palette constants, no app-theme token; bar replaces the 42 px header on `NIGHT.bgAlt` with its bottom border
- [x] 3.3 Retire the `proposal.md` chip from the header bar; tab labels are the artifact names
- [x] 3.4 Complete change reads green: change title, selected tab text and underline, a `✓ complete` chip in the tab bar, and the checklist text in `NIGHT_MD.done`; a change with no task rows is not complete; spec scenario added

## 4. Document tab bodies
- [x] 4.1 Proposal and design bodies through `mdView(text, change)` — the change's name stays the H1-style title
- [x] 4.2 Specs body: one scroll, each capability's `spec.md` under a heading of its capability name, title on the first only
- [x] 4.3 Per-tab states: "Loading proposal…", "Loading design.md…", "Loading tasks.md…", "Loading specs…", "<file> is empty", "No proposal.md — this change has none" for the anchor, the error's text on a throw
- [x] 4.4 Footer text = machine + change directory (not the opened file's path), omitted when empty — with the header name gone, this line identifies the change in the absent, empty and error states

## 5. Tasks tab and click-to-tick
- [x] 5.1 Themed checklist from `taskRows()` — section headings `NIGHT.muted`, ✓ `NIGHT_MD.done`, ○ `NIGHT.faint`, text not truncated to the row width, no row cap (continuation lines stay dropped, as the parser does)
- [x] 5.2 Click flips the line with the panel's compare-and-swap: viewer keeps its own `tasksText` snapshot and a one-at-a-time lock, `toggled()` then `writeTextFile(path, next, body)`
- [x] 5.3 Stale snapshot: one re-read and retry; optimistic flip; failure (or "the task changed under the click") reports by error toast; written body becomes the new snapshot
- [x] 5.4 Remote panes (`on` set) render the checklist with no click handler

## 6. Live updates
- [x] 6.1 Watch the change's own directory instead of the single file (`watchFolder` recurses on macOS/Windows, so `specs/` is covered); each wake re-runs discovery and re-reads the open tab
- [x] 6.2 Tab switch reads that artifact at once; other tabs are not read eagerly
- [x] 6.3 Remote panes poll every 15 s with the same discovery + open-tab read; a watch that cannot arm falls back to that poll; stale-prop guard kept

## 7. Menu and docs
- [x] 7.1 `MENU` label **View proposal** → **View change**; same `pane.split {direction: "right", mod, props: {file, change, on}}`; no-root error toast unchanged
- [x] 7.2 README.md — viewer bullet: tabbed change viewer (proposal / design / tasks / specs), ticking from the tasks tab, View change label
- [x] 7.3 README.md — Live section: viewer watches the change's folder (remote 15 s poll); What it runs: `find` for the specs listing (local and remote)
- [x] 7.4 README.md — Limits: remote ticks read-only, every click opens another pane, fixed palette
- [x] 7.5 RECIPE.md — viewer bullet and menu name updated to match
- [x] 7.6 Archive-time note for this change: a MODIFIED delta cannot change a spec's Purpose, so when **this** change is archived, hand-rewrite the merged `proposal-viewer` Purpose to describe the tabbed viewer (last time it was hand-filled at archive time)

## 8. Checks (all must pass before reporting)
- [x] 8.1 `node --check mods/openspec/main.js`; sync to `~/.config/herdr-app/mods/openspec/` and `herdr-app check mods/openspec` passes
- [x] 8.2 `openspec validate tabbed-change-viewer --strict` passes; `openspec validate --specs --strict` passes
- [x] 8.3 Live check (agent): `pane.split` a real change into the running app; tabs switch, tasks tick, an edit lands live; screenshot
- [x] 8.4 In-app (owner): right-click → **View change** opens the tabbed viewer in dark and light app themes; ticks from the tasks tab; the list keeps the app theme
