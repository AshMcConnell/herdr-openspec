## Why

When `openspec archive` fails, the panel's only report is a small toast that
vanishes in seconds — and sometimes carries no reason at all. There is nothing
to *do* about the failure either, so the person is left staring at a row that
will not archive. The owner's ask: show a real "Archive failed — Archive using
AI?" dialog, and hand `/opsx-archive <name>` to an agent so the agent can work
out what is wrong and finish the archive.

## What Changes

- **The failure report always fires, with a reason.** The failure toast uses the
  panel's existing error formatting (`exitDetail`), so its body is never blank —
  it shows the error's last non-empty line, or `exit <code>` when the streams
  are empty. The toast and the follow-up list refresh are reordered so a
  throwing refresh cannot swallow the report, and the panel always comes back
  ready for another archive.
- **Every failed archive opens a dialog** titled "Archive failed" naming the
  change and the error, with **Archive using AI** and **Dismiss**. It is modal,
  so a stray click beside it does not lapse the offer; Esc and the buttons close
  it.
- **"Archive using AI" starts an agent**: a new agent tab in the same space and
  repository whose first message is `/opsx-archive <name>`. When no agent is
  installed, or the agent list cannot be read or is still loading, it copies
  `/opsx-archive <name>` to the clipboard and says so.
- **The failure toast gains the same action**, for when the toast is what the
  person sees first; the toast action opens the same dialog.
- README.md: one sentence under the archive description and one under Limits,
  matching the spec's wording.

## Capabilities

### New Capabilities

None. The recovery offer belongs to archiving, so it extends the existing
`archive-flow` capability rather than adding one.

### Modified Capabilities

- `archive-flow`: **Archive result toast** now promises a report that always
  fires and always names a reason; **Archive in-flight behaviour** promises a
  settled archive leaves no spinner or hidden buttons; and a new requirement,
  **Archive failure recovery**, covers the dialog, the agent hand-off, the
  clipboard fallback, the toast action and the dismiss rules.

## Impact

- Affected code at apply time: `mods/openspec/main.js` — the `archive()` tail
  (failure detail, ordering, `try/catch` around the refresh), a new dialog mode
  in `init` and `render`, the shared failure records (one per panel copy), the
  toast action and its `nextCommand` branch. README.md.
- Uses only kit surfaces already declared in `mods/openspec/gpui-kit.d.ts`:
  `notify` with `action`, the `run`/`nextCommand` command loop, `setShared` /
  `shared`, `openOverlay` / `closeOverlay` / `props().overlay`,
  `knownAgents`, `run("tab.new", …)` and `cx.write_to_clipboard`.
- No new file in the mod, no change to `tasks.md` parsing, and no new
  capability. `tab.new`'s behaviour on a remote space is verified at runtime
  during apply (see design Risks).
