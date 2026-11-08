# Fold task continuation lines into their entry

## Why

A `tasks.md` entry can span several lines: a checkbox line followed by indented
continuation lines — normal markdown list-item continuation. The panel's task
parser keeps only the checkbox line, so everything after the first newline is
invisible in every view: the panel's fold-out rows, the change viewer's tasks
tab, and the hover card (its text is the row's text). In change p145, entries
4.1 and 4.2 each have five or six continuation lines in the file (e.g. "(ran
2026-11-07, quiet, one launch … carry the numbers)") but each shows as one line
ending mid-sentence — "(set the key, not" and "notes the option". Entry 4.3 only
looks complete because its single file line happens to wrap visually.

## What Changes

- The task parser folds an entry's indented continuation lines into its row,
  joined with single spaces — the same fold, and the same separator, the mod's
  markdown renderer already uses for wrapped item text — so every view shows
  the whole entry.
- Each row keeps two texts: the checkbox line's own text, which is what a
  toggle matches on (so the local compare-and-swap and the remote exact-text
  edit stay first-line-based and byte-exact), and the folded entry, which is
  what every view displays.
- Fold-out task rows wrap to the folded text instead of truncating to one
  line; the 120-row cap, section-heading truncation and the hover card stay.
- The README's Expanded and Limits bullets are brought in step.

## Capabilities

- `task-tracking`
- `proposal-viewer`

## Impact

- `mods/openspec/main.js`: `taskRows`, `taskLine`, `taskRowView` and the hover
  card call site. The toggle and remote write paths (`toggled`, `flipPair`,
  `writeFlip`, `toggle`, `toggleTask`) are untouched.
- Specs: `task-tracking` (Task list parsing, Display cap) and `proposal-viewer`
  (Task tab).
- `README.md`.
