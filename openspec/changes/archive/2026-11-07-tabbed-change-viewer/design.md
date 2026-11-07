# Design: Tabbed change viewer

## Context

`mods/openspec/main.js` already has a viewer. A copy of the mod given
`props.file` renders `proposalView()`: a NIGHT-palette chrome bar with one
`proposal.md` chip, the file drawn by the mod's own markdown renderer
(`mdBlocks` / `mdView`), a machine-prefixed path in the footer, and a
15-second poll or a `watchFolder` on the file's folder. Panes are opened by
the row menu's **View proposal** item with
`pane.split {direction:"right", mod:"openspec", props:{file, change, on}}` —
props that Herdr saves with the tab, so a restored pane must keep working
from `file` alone.

Everything the change needs is already in the mod: `taskRows()` parses a
change's `tasks.md`, `toggled()` flips one checkbox line byte-for-byte, and
the panel's `toggle()` does the compare-and-swap write. What is new is a tab
bar, artifact discovery, several bodies, and refresh over a folder rather
than one file.

Constraints from the runtime: `Tabs` and `Tab` are `ComponentType`s with
semantics only — no styling (`Tab` is controlled: `selected(…)` in,
`on_click(…)` out; `set_position(i, size)` places them). `readTextFile(path,
{on})` probes local or remote and returns `null` for an absent file.
`readdir` is `fs/promises` — local only and, at apply time, refused for an
arbitrary repository ("outside every granted read root"), so the specs
listing goes through `exec("find", …)` on both local and remote machines.
`watchFolder` recurses on macOS and Windows, so watching the change's own
directory covers `specs/`.

## Goals / Non-Goals

**Goals:**

- One pane shows the whole change: proposal, design, tasks, specs, each on
  its own tab, only tabs for artifacts that exist.
- Ticking a task works in the tasks tab, with the same safety as the panel's
  list (compare-and-swap, one retry, one at a time, toast on failure).
- Any artifact edit — including a spec delta — shows up live on a local pane.
- Old saved panes open as the tabbed viewer, unchanged props, no migration.
- Same Tokyo Night look as today's themed proposal page.

**Non-Goals:**

- No new capability and no rename: this is `proposal-viewer` and
  `context-menu` modified.
- The panel's list, its row folding and `task-tracking` are untouched.
- No editing anything but `tasks.md` checkboxes; no artifact creation,
  renaming or deletion from the viewer.
- No remote task ticking — `writeTextFile` has no `on`, exactly as for the
  panel.
- No new dependency, no network, no reading the Obsidian vault.

## Decisions

**Naming note:** the `context-menu` requirement's title stays **View proposal
item** even though the item becomes **View change**. MODIFIED delta headers
must match the merged spec character-exactly or `openspec archive` refuses the
delta, so the title is knowingly left alone — do not "fix" it at apply time.

### D1 — `file` stays the anchor prop

The viewer keeps `file` as the only anchor it needs. The change's directory
is `file.replace(/[^/]*$/, "")` (everything up to the last slash) and the
name stays `props.change`, with today's fallback (second-to-last path
segment) when it is missing. A saved pane therefore reopens as the tabbed
viewer with no migration, and the menu's `pane.split` call keeps the props it
already sends.

*Alternative rejected:* new `change` + `root` props. That breaks every pane
already saved with `{file, change, on}` and buys nothing the path does not
already say.

### D2 — Artifact model and discovery

A fixed list of four tabs:

| Tab | Artifact | Cardinality |
| --- | --- | --- |
| proposal | `proposal.md` | one, always shown (anchor) |
| design | `design.md` | zero or one |
| tasks | `tasks.md` | zero or one |
| specs | `specs/<capability>/spec.md` | zero or many |

Discovery runs in one pass and re-runs on every refresh:

- The three single files are probed with `readTextFile(path, {on})` — the
  same call the body needs anyway, so a probe and a read are one operation
  (`null` = absent). That works identically local and remote.
- The specs listing is `exec("find", [specsDir, "-name", "spec.md"], {on})` —
  local and remote alike, because at apply time `readdir` was refused for an
  arbitrary repository (no granted read root). Results are sorted by
  capability name and de-duplicated. An exec failure means "no specs content"
  plus a note — it must never break the viewer.
- Tabs are recomputed each refresh: present artifacts get a tab, missing ones
  lose theirs. Proposal always has one; an absent or archived change keeps
  the existing "No proposal.md — this change has none" body rather than an
  empty pane.

Because a change has no `specs/` directory until it has deltas, and because a
finished change's artifacts move to `openspec/changes/archive/…` while a pane
may be open, discovery must be tolerant of every combination — including a
directory that disappears entirely.

### D3 — Tab state and the bar

`this.tab` is one of `"proposal" | "design" | "tasks" | "specs"`, default
`"proposal"`. The bar is built as before with plain elements:

- `Tabs.new(id)` wraps `Tab.new(id)` children; each is given
  `selected(this.tab === id)`, an `on_click` that sets `this.tab` (plus a
  read of that artifact) and notifies, and `set_position(i + 1, n)` for its
  place among `n` tabs.
- The mod draws the visuals on NIGHT colours because the components carry
  none: selected `NIGHT.fg` with a `NIGHT.accent` (`#bb9af7`, the Tokyo Night
  magenta) underline, unselected `NIGHT.muted`, hover `NIGHT.fg`. The accent
  is a palette constant like the rest — no app-theme token.
- The bar replaces the old 42 px header (`NIGHT.bgAlt`, bottom border). The
  old `proposal.md` chip retires — the tabs say which artifact is showing,
  and the footer's machine-prefixed change-directory path is what identifies
  the change once the header is gone.
- A selected tab whose artifact disappears during a refresh falls back to
  `proposal`.

### D4 — Rendering per tab

- Proposal, design and specs bodies use the existing `mdView(text, title)`.
  The change's name stays the H1-style title: on the proposal tab as today,
  and on the other document tabs so every body reads as the same note.
- Specs tab: one scroll container; each capability's `spec.md` renders under
  a heading of its capability name (a plain heading element in the palette,
  then its own `mdView` call with the title only on the first).
- Tasks tab is deliberately not markdown: it is a checklist built from
  `taskRows()` — section headings in `NIGHT.muted`, ✓ in `NIGHT_MD.done`,
  ○ in `NIGHT.faint`, text not truncated to the row width and no row cap
  (that lifts the panel row's ellipsis and its capped folded-out list; the
  parser still drops wrapped continuation lines, as it always has). The panel
  truncates and caps because it is a list row; the viewer is the page.
- States are per artifact: loading text while the first read is in flight,
  the per-file absent and empty text, and the error's text when the read
  throws. The footer is `machine: <change dir>`, omitted when the path is
  empty; with the header's name gone, that footer line is what identifies the
  change in the absent, empty and error states.

### D5 — Ticking from the tasks tab

Same semantics as the panel's `toggle()`, moved to the viewer's own state:

- The viewer keeps `this.tasksText`, its snapshot of `tasks.md`, and a
  `this.toggling` lock so only one write runs at a time.
- A click flips the row optimistically, then `toggled(text, line, task, to)`
  produces the next body and `writeTextFile(path, next, body)` writes it.
  The `body` argument is the compare-and-swap: if the file changed since the
  snapshot the write is rejected, the viewer re-reads, retries once, and
  reports by error toast with the reason when the task no longer matches.
- Local panes only (`on === null`). Remote panes render the checklist with no
  click handler, like the panel.
- After a successful write the viewer adopts the written body as its new
  snapshot, so the next click compares against what it wrote.

### D6 — Real-time updates

Reuse the shape of `watchProposal`, watching the change's own directory
instead of one file:

- Local: `watchFolder(changeDir)` (recursive on macOS/Windows, so spec deltas
  are covered). Each wake re-runs discovery and re-reads the open tab's
  artifact. Other tabs are read fresh when selected.
- Remote, or a watch that cannot arm: the existing 15-second timer runs the
  same discovery + open-tab read cycle.
- Reads are guarded against a stale `file` prop, as today.

### D7 — A complete change reads green

Completeness is derived from the tasks text on every render: at least one
checkbox row, and every row done. A change with no task rows is not complete
(there is nothing to finish). When complete, the viewer takes the same green
the panel uses for a finished change (`NIGHT_MD.done`, #9ece6a): the change's
name, the selected tab's text and underline, a `✓ complete` chip at the right
of the tab bar, and the checklist's text. The rest of the markdown keeps its
own palette — a red heading stays red; the green marks the change's state,
not a repaint of the document. Detection is local to the viewer and needs no
new read: `taskRows()` already runs for the tasks tab.

## Risks / Trade-offs

- **Tabs may draw their own chrome** → The d.ts documents semantics, not
  looks. Style plainly and verify in the running app at apply time; if the
  component adds its own underline or background, drop it and keep the
  mod-drawn bar.
- **The specs listing depends on `find`** → An exec failure (no `find`, a
  permission error) degrades to no specs content with a note, never a broken
  viewer. Local and remote use the same call, so there is one failure path.
- **Re-reading big spec files on every switch** → Only the open tab is read
  eagerly; a local `watchFolder` wake already re-reads just that tab.
  Discovery probes are small and cached by the OS.
- **Several bodies in one pane could get heavy** → Each tab renders one body;
  no tab mounts the others, so memory tracks the open artifact only.
- **CRLF files** → The block parser will split CRLF-aware (`/\r?\n/`) so
  headings and fences render clean, but `toggled()` must keep splitting on
  `"\n"` exactly — it preserves each line's trailing `\r` byte-for-byte and
  the spec requires that round-trip.
- **Archived change under an open pane** → Discovery finds no artifacts; the
  proposal tab keeps the "none" state and the other tabs vanish; a fallback
  to `proposal` keeps the pane coherent.

## Migration Plan

None in the data sense: saved panes carry `{file, change, on}` and are read
exactly as before. The menu label changes, so the recipe and README text that
names **View proposal** is updated at apply time. Rollback is the single
`main.js` commit, since no file outside the mod and docs changes.

## Open Questions

- Whether `Tabs`/`Tab` need `set_position` at all when they are laid out in a
  flex row; resolve by eye in the running app (it is documented, so use it
  first, drop it only if it fights the layout).
