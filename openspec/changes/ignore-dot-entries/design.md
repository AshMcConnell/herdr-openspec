## Context

Verified facts, reproduced in a temp project today: `openspec list --json` returns a `.hidden-change` folder as a change entry, with full counts, and `find <change>/specs -name spec.md` returns `.backup/spec.md`. Two code points let both through: `refresh()`'s map at main.js:871–874 stores every entry the CLI lists, and `listSpecs()`'s `parts.length !== 2` rule at 1114 accepts `specs/.backup/spec.md` as a two-part path. `discover()` (1132–1141) decides the specs tab from `specs.items.length > 0 || specs.error`; `visible()` (493–502), the header totals (1757), state grouping (1807–1814) and the empty state (1815–1817) all read `this.changes` directly. The change list is the only source of change names (the change-list spec's **List source**: "The panel SHALL NOT discover change names from the filesystem"), so the filter must sit on the parsed output, never on a directory read.

## Goals / Non-Goals

**Goals:**

- Both surfaces hide dot entries: the change list and the viewer's specs tab.
- Every derived number follows the filtered list — counts, totals, groups, filter, empty state.
- A dots-only listing is a normal empty state, not an error.
- Remote spaces behave identically, with no extra commands.
- Non-dot behaviour is unchanged, byte for byte.

**Non-Goals:**

- The folder watch: `watchFolder`'s event handling stays — a dot entry's edit still fires a refresh, which then filters.
- Deleting, renaming or creating anything.
- Filtering anything but the leading-dot name (no hidden files, no ignore-file support).
- The CLI's own listing.

## Decisions

### D1. Filter at store time, not render time

In `refresh()`: `(parsed.changes ?? []).filter((c) => !(c.name ?? "").startsWith(".")).map(...)` — one point, so every consumer follows without its own guard: `visible()`'s filter/sort, the header `done/total` reduce, state grouping, the empty state, the bulk button's `this.changes.length > 0`, the `confirming` sweep (876) and the open-change fold (881). Rejected: filtering inside `visible()` — `this.changes` would still hold dot entries that those direct readers see.

### D2. The viewer's filter is one condition in the existing rule

In `listSpecs()`, extend line 1114 to `if (parts.length !== 2 || !parts[0] || parts[1] !== "spec.md" || parts[0].startsWith(".")) continue;`. `discover()` and `select()` need no change: zero non-dot items and no error already means no specs tab, and `select("specs")`'s empty-listing fallback already removes the tab — the dots-only case rides both existing paths. A dot change's own pane still works because the pane's paths come from its `file` prop, not from any listing.

### D3. The fold-away of a previously open dot entry needs no new code

On the first refresh after the filter lands, a dot change that was `this.open` is no longer in `this.changes`, and 881's existing rule folds it away — the **Expand and collapse** "Change archived or deleted elsewhere" scenario already specifies this.

### D4. Capability split and the ADDED shape

Two existing capabilities gain one ADDED requirement each — `change-list`'s **Dot entries hidden** and `proposal-viewer`'s **Hidden capabilities**. ADDED, not MODIFIED, for `proposal-viewer`: the existing **Specs tab** and **Viewer content** wordings remain true as written; the new requirement supplies the one missing definition — which directories count as delta specs — and covers both consequences (not listed, doesn't enable the tab) in one place. A MODIFIED of **Specs tab** would restate that whole requirement to change one clause and still leave "Viewer content"'s "the specs tab only when the change has delta specs" depending on the same unstated definition. It also mirrors change-list's ADDED shape — symmetric and low-churn, the `panel-slash-commands` precedent (D1 there) for when to add rather than modify.

change-list's delta also MODIFIES **List source**: its "each entry becomes one row" sentence gains the dot exception (dropped from the parsed output), so archiving the change cannot leave that requirement contradicting **Dot entries hidden**.

### D5. Remote parity for free

Both `exec` calls already route with `{ on }`; the filter runs on parsed output in the panel, so no machine sees an extra command.

## Risks / Trade-offs

- **An owner who deliberately names a real change with a leading dot cannot see it** — accepted (owner's decision); rename the change.
- **The `openspec` CLI may one day filter dot entries itself**, making this dead but harmless.
- **The README must say "hidden, not deleted"** so nobody thinks the panel ate their backup.

## Migration Plan

None. Rollback is removing the one `.filter()` and the one `||` clause. Sync the app snapshot (`rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/`) before checking in the app.

## Open Questions

- **README placement for the note** — decided: one sentence in **What it runs** plus a **Limits** bullet, so the "hidden, not deleted" guarantee is visible where people look for caveats; **What it runs** alone was the alternative.
- No other real forks: both surfaces, the not-the-watch boundary, the parsed-output-not-filesystem rule and the dots-only empty state are all fixed; nothing in the implementation forces a further choice.
