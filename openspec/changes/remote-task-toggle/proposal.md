## Why

Remote spaces already read fine — the panel lists changes, folds out tasks and
reads `tasks.md` on the pane's machine — but ticking is walled off: `toggle()`
returns early when the space names a machine, remote rows get no click chain,
and their hover cards no button, all because `writeTextFile` only writes local
files. The owner works across machines and has to hop onto the remote space to
tick a task the panel is already showing. Reads route to the machine; the
write should too.

## What Changes

- **Remote ticks go through herdr-core's exact-text edit on the machine**: a
  remote toggle re-reads `tasks.md` on the machine, builds an exact old/new
  pair for that one checkbox line (with neighbouring context until the old
  text matches exactly one place in the file), runs `herdr-core file edit
  <path> --old … --new …` there, then re-reads and verifies the flip landed
  exactly once before accepting it. Anything that cannot land or verify reverts the
  optimistic flip and toasts, exactly like the local failure path.
- **Local ticks are untouched**: same compare-and-swap `writeTextFile`, same
  one-retry-against-a-fresh-read, byte-identical behaviour.
- **Rows and cards become interactive on remote spaces**: `toggle()`'s `this.on`
  early-return is gone, the row click chain and the hover card's "✓ Mark done"
  / "↺ Reopen" button are no longer gated on `!this.on`, and the write
  dispatches local vs remote inside one shared optimistic/retry scaffolding.
  `this.toggling` still allows one toggle at a time across both routes.
- **The change viewer's tasks tab stays read-only on remote panes** — it is a
  separate capability (`proposal-viewer`) with its own write copy; a follow-up
  change can lift it.
- README.md: the Expanded bullet, the "What it runs" write paragraph and two
  Limits bullets follow.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `task-tracking`: **Click to toggle** and **Toggle failure reporting** lose
  their local-only restriction — remote rows tick through the CLI's
  exact-text edit guarded by a read–edit–verify round trip, and the
  failure-reporting and one-at-a-time rules cover both routes.

## Impact

- Affected code at apply time: `mods/openspec/main.js` (`toggle()`'s guard and
  write dispatch, `taskLine`'s gates, a `writeFlip` helper plus `flipPair` /
  `occurs` helpers beside `toggled`), and README.md.
- Uses `exec` and `readTextFile`'s machine option, both already declared in
  `mods/openspec/gpui-kit.d.ts`; the `herdr` CLI's `file edit` surface is the
  owner's documented CLI and is verified at runtime (see design Risks). No new
  file in the mod, no change to `tasks.md` parsing.
- Both prior changes (`task-hover-card`, `task-card-toggle`) are archived and
  their deltas are already in the main spec, so this delta reads against the
  current **Click to toggle** wording directly; no archive-order dependency.
