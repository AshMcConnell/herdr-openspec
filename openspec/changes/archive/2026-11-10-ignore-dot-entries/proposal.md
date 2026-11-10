## Why

Editors and agents leave dot-prefixed scratch directories under `openspec/changes/` (`.hidden-change`) and under a change's `specs/` (`.backup/`), and both leak into the panel: verified today, `openspec list --json` returns a `.hidden-change` folder as a change entry (reproduced in a temp project), so the panel renders it as a row and counts it in every total; and the viewer's `find <change>/specs -name spec.md` returns `.backup/spec.md`, which the `parts.length !== 2` rule accepts — the specs tab then lists a capability literally named `.backup`. Dot entries are backup/scratch, not work; the panel should not show them. The CLI will not filter them for us, and the panel must not scan the filesystem instead (the change-list spec's **List source** forbids it), so the filter belongs on the parsed output.

## What Changes

- **Change list**: any entry whose name starts with `.` is dropped from the parsed `openspec list --json` output before it is stored. Header counts, done/total totals, sorting, state grouping, the filter, the bulk button and the empty state all follow the filtered list; if every entry is a dot entry the panel shows its normal "No active changes" state, not an error.
- **Viewer specs**: a capability whose name starts with `.` is skipped when parsing the `find` output; a change whose only spec is hidden behaves as one with no specs (no specs tab). A viewer pane opened directly with a dot change's path still works — this is a listing filter, not an access rule.
- **Remote machines**: the same filtering after parsing; no extra commands.
- The folder watch (`watchFolder`'s event handling) is deliberately untouched.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-list`: gains one ADDED requirement, **Dot entries hidden** — dot-prefixed change entries are dropped from the parsed listing before it is stored, and every derived count, sort, group, filter and empty state follows the filtered set.
- `proposal-viewer`: gains one ADDED requirement, **Hidden capabilities** — dot-prefixed capability directories are skipped when the specs listing parses the `find` output, and a hidden capability neither renders nor enables the specs tab.

No new capability: each surface already belongs to an existing one.

## Impact

- `mods/openspec/main.js`: one `.filter()` in `refresh()` (~871) and one `|| parts[0].startsWith(".")` condition in `listSpecs()` (~1114).
- The two spec deltas in this change (`change-list`, `proposal-viewer`).
- `README.md` and `RECIPE.md` sentences (implementation tasks in this change).
- No new commands, files or network; behaviour for non-dot entries is byte-identical.
