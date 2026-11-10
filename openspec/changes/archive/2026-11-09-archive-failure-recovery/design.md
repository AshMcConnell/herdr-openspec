## Context

Archiving is the panel's two-click path to `openspec archive <name> --yes`
(`archive()`, `mods/openspec/main.js:1136`). The run lives in one `cx.spawn`
task and reports only through a toast. All line numbers below are in
`mods/openspec/main.js` unless said.

Four weaknesses, in order of likelihood:

1. **The toast is the only report, and it is gone in seconds.** The failure tail
   calls `notify({ title: "Archive failed", ... })` with no `timeout` and no
   `action` (d.ts 22562–22569). The `toast` mod that draws it is replaceable and
   times out. The person clicks Archive, looks at the list, sees nothing happen —
   no persistent trace anywhere. This matches the owner's words ("we don't show
   an error") and their suggested fix (a dialog).
2. **The failure body can be blank.** The failure detail is
   `((r.stderr || r.stdout || \`exit ${r.code}\`).trim().split("\n").pop() ?? "")`
   — whitespace-only `stderr` is truthy, so `trim()` gives `""` and the toast
   reads "Archive failed" with an empty body. `exitDetail(r)` (275–283) already
   solves this correctly (last non-empty stderr line, then stdout, then
   `exit N`); the archive path predates it and was never migrated.
3. **The tail can be swallowed between the failure and the report.** The tail
   runs `this.refresh(cx)` *before* `this.busy = null` and `notify`. `refresh`
   calls `location()` / `key()` (`spaces()`, `focused()`, `panes()`, `props()`),
   which throw when the host call is gone (view released, script reloaded). If
   anything throws there, `busy` stays set forever (every archive button hidden
   by `showArchive`, 287) and **no toast at all** is posted. Same for
   `cx.notify()`, which throws once the build reloads (d.ts 403–405).
4. **A released task dies silently.** A mod reload (the sync step), a layout
   switch or a closing tab releases tasks — the `exec` await never resumes, no
   toast, `busy` stays set. Not fixable from inside the task; the fix for (3)
   plus posting the report before the refresh minimises the window.

Constraints: the mod imports `"herdr"` and cannot be loaded by Node, so no
committed unit test is practical without splitting modules (mod loader support
unverified). The gate stays `node --check mods/openspec/main.js`, plus manual
repro in the app.

## Goals / Non-Goals

**Goals:**

- Every failed archive is reported, with a real reason, even if the follow-up
  list refresh throws or the panel has moved to another folder.
- The panel always comes back ready for another archive — no stuck spinner and
  no permanently hidden buttons.
- Every failed archive offers a recovery: a dialog naming the change and the
  error, with "Archive using AI" / "Dismiss".
- "Archive using AI" starts an agent tab whose first message is
  `/opsx-archive <name>` in the same space and repository; with no agent
  installed — or an agent list not yet readable — it copies that command
  instead.
- The failure toast can open the same offer.

**Non-Goals:**

- A row chip or any per-row failure state. Row state lives per panel copy while
  failures are global, rows vanish on re-sort/filter, and the archive button
  slot (1299–1306) already has three states (button / "Archive?" / spinner).
- A "Paste in terminal" button: `terminal.paste` has no documented target
  (d.ts 22253) and under a dialog there is no focused terminal.
- Automatic retries of the archive, and any change to the success path.
- Fixing task release on mod reload (weakness 4) — outside the task's reach.
- Any change to `tasks.md` parsing or to the archive command itself.

## Decisions

**3.1 Make the report fire: reorder the `archive()` tail.**

New order: compute `detail` → clear `this.busy` → post `notify` (with `action`)
and open the dialog → then `refresh` in a `try/catch` → then `cx.notify()` in a
`try/catch`. The existing `key() === context` guard and its fold-out reset
(`if (this.open === name) { this.open = null; this.tasks = [] }`) stay exactly
as they are: `refresh` runs inside the guard, so a panel that has moved to
another repository does not refetch or drop another list's fold-out, while
`cx.notify()` sits outside it and still runs when the guard fails. Failure
`detail` becomes `exitDetail(r)` (non-empty guaranteed); success keeps
`openspec archive ${name}`. The active space id
(`spaces().find((s) => s.active)?.id`) is captured next to `cwd` / `on` at the
top, for 3.3.

*Rejected:* leaving the toast path alone and only adding the dialog — the dialog
is posted from the same tail, so a swallowed tail kills both; wrapping only
`refresh` in `try/catch` without reordering — the `cx.notify()` throws would
still kill the dialog post if they came after it.

**3.2 Presentation: modal overlay dialog (primary) + clickable toast (secondary).**

The dialog opens with
`setShared(DIALOG, openOverlay({ mod: "openspec", props: { archiveFailed: { panel, name, detail, root, on, space, seq } }, kind: "dialog", modal: true, width: 420 }))`
(`DIALOG = "openspec.archive-dialog"`, holding the newest overlay id).
`modal: true` means a click beside it does not close it (d.ts 22536–22538); Esc
and the buttons still close. The mod's `init` gains an `archiveFailed` mode,
checked after the `menuFor` check (638) and the `file` check (644): a small
Tokyo-Night dialog with the title "Archive failed", the error line, "Archive
<name> using AI?", and the two buttons. It takes the keyboard the way `menuView`
does — `init` calls `this.handle.focus()` and the render root adds
`.track_focus(this.handle)` — because an overlay does not take focus on its own,
and without it the `escape` handler that consumes the record never fires.
`render()` gets the matching branch beside the `menuFor` / `file` checks
(1479–1480), before the list body — without it the list body's `this.changes` /
`this.context` / `refresh` would throw on a dialog with none of them. `knownAgents` joins the `herdr` import (19). The view
closes itself with `closeOverlay(props().overlay)` (d.ts 22556). One dialog at a
time: the open overlay id lives in `DIALOG`, and anything that opens the dialog
— a new failure or the toast action — goes through one helper that closes the
id already stored there before opening the next.

The failure toast carries `action: { name: "openspec.archive-ai" }`; the toast
mod runs it and delivers `"archive-ai"` to `nextCommand()` (694–702). Because
`run`'s args never reach the mod (d.ts 22592 returns only a string), the failure
record rides in a shared map keyed by panel id — the repo's proven `OPENS` /
`openRequests` pattern (64–73, 295–313, 771–777). The addressed panel copy opens
the same dialog.

*Rejected:* toast action only — the toast is replaceable and times out, which is
exactly the complaint; a non-modal dialog — a stray click beside it would lapse
the offer, which defeats the point.

**3.3 What the action does: `tab.new` with `task: "/opsx-archive <name>"`, clipboard fallback.**

`run("tab.new", { space, folder: root, argv: agent.run, task: \`/opsx-archive ${name}\` })`,
with `argv` from `await knownAgents({ on })` (d.ts 22224) — the first
`installed` entry ("Start one with its `run` as `argv`"; `tab.new {argv, task}`
at 22243). Non-destructive: it never touches the person's composer typing or
clipboard. Fallback when no agent is installed:
`cx.write_to_clipboard(\`/opsx-archive ${name}\`)` (d.ts 348) plus a toast
"Copied — paste it into your agent". The same fallback covers the unknown: if
`knownAgents` is still pending or rejects (unreachable machine), the list is
treated as empty rather than the button blocking or throwing.

*Rejected:* `terminal.paste` as primary — it pastes the system clipboard
(clobbers it), the docs give it no arguments so it cannot be aimed at the
terminal the panel is following, and under a dialog there is no focused
terminal; opening a bare `terminal.open` with the command as `argv` — a shell
would just print it; doing both — one clear action beats two ambiguous ones.

**3.4 Round-tripping the name to the mod.**

The tail does
`setShared("openspec.archive-failed", { ...live, [this.panelId]: { panel: this.panelId, name, detail, root, on, space, seq: uid(), at: Date.now() } })`
before notifying, where `live` is the record map read the way `openRequests()`
reads `OPENS` (186–194), so stale entries drop on each write — a map keyed by
panel id, so two panel copies on one repository each keep their own record and
each toast action finds its own. The list-mode `nextCommand` branch handles
`"archive-ai"` exactly like `acceptOpen` (771–777): only the copy whose
`panelId` matches acts, and a record older than 60 seconds is ignored
(`OPEN_AGE_MS` precedent, 71). Dispatch deletes that copy's entry only after its
host calls have run (a throw takes the clipboard path first), Dismiss and the
dialog's `escape` handler delete it in their handlers, and the dialog's
`close()` deletes it again behind its own `seq` check (harmless when it is
already gone, and the check stops an older dialog from dropping a newer
failure's record). `close()` is insurance, not the mechanism: the docs
describe it as "Application root only: one final call when the host closes this
copy", and this repo only receives it for pane copies (925–942). With the
record gone, the toast action cannot reopen a finished offer.

**3.5 Second failure / lapse.**

Archives stay serialised per copy by `this.busy` (1137) — unchanged. A second
failure while a dialog is open closes the old overlay and opens the new one
(newest wins). Pressing "Archive using AI" sets a one-shot `dispatched` flag,
dispatches, then closes, so a double-click cannot spawn two tabs, and every host
call (`run("tab.new", …)`, `cx.write_to_clipboard`) still runs on a live view —
the rule `menuView` already follows (1328). The offer lapses on Dismiss/Esc, on
dispatch, or on a newer failure. Each ending deletes the record in its own
handler: **Dismiss** deletes then closes, the render's `escape` handler deletes
then closes (Esc is closed host-side — d.ts 22556, "Esc closes the top dialog
or popup" — so that handler is the only place that can consume it), and
dispatch deletes after its host calls have run. `close()` deletes it too, but
only as insurance behind its `seq` check, because its documented use is the
application root's final call and this repo only gets it for pane copies
(925–942). A record past a minute is ignored as well, so nothing lingers to be
replayed. If the change vanished meanwhile, the agent's own `/opsx-archive` run
reports it.

**3.6 Where the state lives.**

`this.panelId` (per panel copy) names the toast action's addressee; the failure
record (keyed by that id) and the open overlay id (`DIALOG`) are shared mod
values, because the toast action has no payload and the dialog is its own view
copy.

## Risks / Trade-offs

- **`terminal.paste` targetability is unverified** (d.ts 22253 lists it without
  args). The design does not depend on it; verify with `herdr-app commands`
  before ever adding a "Paste in terminal" button.
- **`tab.new` on a remote space**: no `machine` arg (d.ts 22243). That the tab's
  `folder` and `task` resolve on the space's machine is assumed from
  `space.new`'s semantics (22309–22311). If it does not, "Archive using AI" on
  remote degrades to the clipboard fallback; the manual remote check decides.
- **`argv` shape**: `knownAgents` returns `run: string[]` and the docs say pass
  it as `argv` — pass the array as-is. If `tab.new` rejects it, join it or pass
  the first element (runtime check).
- **Toast `action` delivery**: it runs through the replaceable toast mod. If the
  owner's toast mod ignores `action`, the dialog (always posted) still covers
  the flow.
- **A released task on mod reload** is not fixable inside the task; posting the
  report before the refresh minimises the window, and the manual repro is the
  check.
- **No committed test** (the mod cannot load in Node) → the gate is
  `node --check mods/openspec/main.js` plus the manual repro, with an ad-hoc
  `node -e` paste of `exitDetail` showing `exit 1` for blank streams.

## Migration Plan

No data or configuration migration. Apply the code change, validate
(`openspec validate archive-failure-recovery --strict`,
`openspec validate --specs --strict`, `node --check mods/openspec/main.js`), then
sync the snapshot the app runs
(`rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/`)
and reload the mod panel. Rollback is the reverse: restore the previous
`mods/openspec/main.js` and re-sync.

## Open Questions

- Does `tab.new {folder, task}` start the agent on a remote space's machine? If
  not, is the clipboard fallback acceptable there, or does a later change need
  a machine-routed agent start?
- Does the installed toast mod honour `action`? If not, the dialog still covers
  the flow, but the toast will not open the offer.
- The command name `/opsx-archive <name>` comes from the owner and is
  unverified in this environment (no such command was found here); it is passed
  to the agent verbatim, and manual check 6.2 is where a real agent run confirms
  it.
