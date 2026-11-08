## Context

The panel resolves a space with `location()` into `{ cwd, on }` (`on` is the
machine name, null locally). Reads already route: `exec("openspec", [...],
{ cwd, on })` (main.js:675) and `readTextFile(path, { on })` (main.js:769).
Ticking is local-only on purpose: `toggle()` (main.js:1107) opens with
`if (this.on || !this.root || this.toggling || typeof row.line !== "number")
return;`, `taskLine` gates the row click with `.when(!this.on, …)` and the
hover card's button with `!this.on ? … : null`, and the write is
`writeTextFile(path, next, body)` — compare-and-swap against the snapshot,
one re-read and retry on rejection, revert + toast on failure, one toggle at
a time via `this.toggling`.

The blocker is the kit's write primitive. In `mods/openspec/gpui-kit.d.ts`:

- `writeTextFile(path: string, text: string, expected: string | null)` (line
  22218) — "Writes UTF-8 text only if it still matches expected … Rejects on
  a stale snapshot" — has **no options parameter at all**, let alone `on`.
- `readTextFile(path, options?: { on?: string | null })` (22215) and
  `exec(command, args?, options?: { cwd?: string; on?: string | null })`
  (22203) both take `on`.
- `hc(args)` (22217) runs herdr-core locally.

So there is no machine-aware write in the kit; a remote tick must go through
herdr-core's file surface: `file read|write|edit [--on <machine>] <path>`,
where `edit` is an exact-text replace via `--old X --new Y`. Nothing in this
repo's docs (README.md, RECIPE.md, specs) mentions that file surface — it was
verified against the real CLI at runtime (see Decisions).

## Goals

- Tick and untick a task on a remote machine from the panel's fold-out rows
  and hover-card button, in the same interaction as local.
- Guard the remote write like the local one: never blind-overwrite a
  concurrent edit, verify the clicked line holds the flip, and on any failure
  show the file's real state and toast.
- Keep local behaviour byte-identical.
- Keep toggles one at a time across both routes.

## Non-Goals

- The change viewer's tasks tab on remote panes. It is `proposal-viewer`'s
  requirement ("Remote panes SHALL show the same checklist read-only") and a
  second, separate write copy (`toggleTask`, main.js:1007); lifting it is its
  own change with its own delta.
- Any remote write beyond the checkbox flip: no text editing, no adding or
  removing tasks, no writes outside `openspec/changes/<name>/tasks.md`.
- Byte-level compare-and-swap semantics on the remote side. The kit cannot
  provide them (no remote write primitive); the CLI's exact-text replace plus
  re-read verification is the achievable equivalent (see Decisions).
- Fixing or reshaping the local write path.

## Decisions

**`writeTextFile` has no machine option — verified, so the CLI route is
required, not preferred.** The d.ts quote in Context is the whole story: the
write primitive's signature has three parameters and no options bag. The
first design question (is there a kit write with `on`?) answers no.

**Vehicle: `exec("herdr-core", ["file", "edit", path, "--old", old, "--new",
neu], { cwd: this.root, on: machine })` — run herdr-core on the machine and
let the kit's `exec` route the whole process there.** Reasoning: `exec`'s
`on` uses the same routing the reads already use, so the edit runs where
`tasks.md` lives with `this.root` as its cwd; the absolute file argument is
`${this.root}/openspec/changes/${name}/tasks.md`. No `--on` is needed because
the process is already on the machine. Runtime evidence settled the vehicle
after the first live tick: the app's `herdr` binary is the app's workspace
CLI and has **no `file` subcommand** — that tick came back "run 'herdr
--help' for usage", and that surface lives in `herdr-core`; `herdr-core
machine ls` is `{"machines":[]}` locally, so `--on <machine>` has no local
registry to route through. The on-machine run needs no registry at all.
`file edit` was probed green: `herdr-core file edit <abs-path> --old X --new
Y` replaced exactly once (exit 0) and refused a duplicate with "the old text
is in the file 2 times" (exit 1, nothing written). The first tick over the
exec hop then still came back with a herdr-core usage error (a JSON object,
clipped by the toast), so two suspects remain — the values mangled in transit
to the machine, or a herdr-core there older than `file edit`. The helper now
sends single-line values only and Guard step 3 reports the CLI's own message,
so the next tick says which; the second's remedy is updating herdr-core on
that machine. Fallbacks, now unlikely
(one-line swap inside the helper, see Risks): route through the kit's
`hc(["file", "edit", path, "--old", old, "--new", new])` (add `hc` to the
import at main.js:18), or, once herdr-core's local registry holds the
machine, the off-machine form `exec("herdr-core", ["file", "edit", "--on",
machine, path, "--old", old, "--new", new])`. `toggle()` never learns which
vehicle ran.

**Guard: read → build exact old/new → edit → re-read → verify.** This is the
remote analogue of the local compare-and-swap:

1. **Old/new from current bytes, one line only.** `flipPair(body, line, next)`
   takes the `body` just read and the `next` that `toggled(body, line, task,
   to)` produced (caller already refused a null `next`), and returns
   `{ old, neu }`: that line's exact bytes in `body` and in `next` — the
   0-based `split("\n")` index `toggled` uses, trailing `\r` kept, nothing
   added. No trailing `\n` and no neighbouring context: a live tick had the
   machine's herdr-core answer with a usage error, and a pair of single-line
   values is one suspect fewer (the other is an older herdr-core there —
   step 3's readable error tells them apart). These strings are passed as
   exec argv entries — no shell, no quoting.
2. **Uniqueness before writing.** Count literal substring occurrences of
   `old` in `body` (`occurs(text, needle)` via split/join — never regex, task
   text can hold regex characters). Exactly one → proceed; otherwise throw
   "the task's line is not unique in tasks.md" and write nothing. There is no
   widening retry: the pair stays one line, and the CLI's own guard backs the
   refusal up (it refuses an `--old` found twice, all or none). The
   mixed-state twin (`- [x] Read spec` beside `- [ ] Read spec`) is unique in
   the clicked open state, so it passes here, and the line-index verify below
   cannot be fooled by the twin either. A pair whose `old` and `neu` are the
   same bytes changes nothing — the file already holds the asked state — so
   the helper hands it back and `writeFlip` returns the read text as settled
   without running an edit, the silent accept the local compare-and-swap
   gives.
3. **The edit.** `exec("herdr-core", ["file", "edit", path, "--old", old,
   "--new", neu], { cwd: this.root, on: machine })`. A non-zero exit throws
   `exitDetail(r)`: the last non-empty stderr line, else stdout's, parsed as
   JSON gives `herdr-core: <error.message> (<hint>)`, otherwise the raw line
   cut to 300 chars (the archive button's shape). The readable message settles
   the open question — a malformed-values complaint means the argv hop is
   mangling them; an unknown-command complaint means the machine's
   herdr-core predates `file edit` and needs updating there. If the file
   drifted on the clicked line, `--old` matches nowhere and the edit fails —
   that maps onto the existing "stale snapshot" retry exactly.
4. **Verify by line index.** Re-read with `readTextFile(path, { on: machine
   })`; null → throw "tasks.md is gone". Accept only when
   `reread.split("\n")[line] === next.split("\n")[line]` — the clicked line
   in the re-read byte-equals the clicked line in the intended content. Like
   the edit, this is line-scoped: the flipped text appearing elsewhere (a
   twin in the same state, or inside a longer line) cannot fail it, and the
   file's last line needs no trailing newline. Anything else throws "the
   write did not land as asked". Return the re-read as the settled text, so
   the panel shows the file's real bytes.

Semantic note (deliberate difference from local): the local CAS rejects a
write if *any* byte of the file changed; the remote edit is line-scoped, so a
concurrent edit elsewhere in the file still lets the flip land — safely,
because `edit` touches only the matched text and never rewrites the file. A
concurrent edit *on the clicked line* fails the `--old` match or the verify,
and falls into the same retry-once-then-revert path as a local rejection.

**Dispatch shape: one scaffolding, a `writeFlip` helper.** `toggle()` keeps
its optimistic flip, `settled`/`why` bookkeeping, retry, revert, toast and
`this.toggling` exactly where they are. The two write lines
(`try { await writeTextFile(path, next, body); settled = next; } catch
{ next = null; }` and the post-re-read `else` branch) become
`settled = await this.writeFlip(path, body, next, line, task, to)`, and the
retry re-read becomes `readTextFile(path, { on: this.on })` (`{ on: null }`
is the local read it performs today). Inside `writeFlip`, the local branch is
literally `await writeTextFile(path, next, body); return next;` — the same
call with the same arguments and the same exceptions — so local behaviour is
unchanged; the remote branch is the read–edit–verify above returning the
re-read. Alternatives rejected: branching the whole spawn body into two
copies duplicates the retry logic (the viewer's `toggleTask` already shows
how fast that copy drifts); branching only at the top of `toggle()` cannot
express the shared one-retry scaffolding.

**Gates: delete them, don't widen them.** `toggle()`'s guard drops `this.on`
(the restriction described a write that could not route; it now routes).
`taskLine`'s `.when(!this.on, (e) => e.cursor_pointer()…)` drops the
`.when` wrapper and keeps the chain unconditional; the hover card's fifth
argument becomes `(cx) => this.toggle(row, name, cx)` for every task row. A
`!this.on || true`-style widening leaves dead conditionals describing a
restriction that no longer exists. The section call site still passes nothing
for `onToggle`, so `hoverCard`'s "falsy onToggle renders no button" contract
stays meaningful — it now describes section cards only.

## Risks / Trade-offs

- **The `herdr-core file edit` surface was probed, not assumed.** The app's
  `herdr` binary has no `file` subcommand (its usage error was the first live
  tick), and `herdr-core machine ls` is empty locally, so `--on` cannot route
  from here; running herdr-core on the machine needs no registry. The local
  probe replaced exactly once (exit 0) and refused a duplicate ("the old text
  is in the file 2 times", exit 1, nothing written). The first tick over the
  exec hop still came back with a herdr-core usage error, so one of two
  suspects remains: the `--old/--new` values mangled in transit, or a
  herdr-core on that machine older than `file edit` (remedy: update it
  there). Single-line values and the readable error parse in Guard step 3
  make the next toast name the cause. The remote leg still needs the owner's
  first real tick on a machine (manual checks).
- **`--old/--new` semantics:** a uniquely matching old text is replaced
  exactly once and a duplicate is refused, so a silent replace-all cannot
  happen. The uniqueness rule and post-write verify stay as belt and braces;
  worst case is a refused toggle and a toast, never a corrupted file.
- **Race between the edit and the verify re-read.** A concurrent write in
  that window can fail verification although our flip landed — the panel then
  reverts the optimistic row and toasts, while the file (the truth) shows the
  flip and the next refresh reconciles. Rare and honest; the alternative
  (accepting without verification) is worse.
- **`readTextFile` caps at 1 MiB.** A remote `tasks.md` larger than that
  would read truncated and `toggled` would refuse or mis-pair. Same limit the
  remote reads already carry today; task lists this size are not real.
- **`exec` has a 30 s limit and rejects when the machine is unreachable.**
  The failure path is the existing revert + toast; no new surface.
- **Remote flips are line-scoped, not whole-file CAS.** Documented in
  Decisions; strictly narrower in what it can overwrite than the local path.

## Migration Plan

No data model, file format or API change. Rollback is restoring `this.on` in
`toggle()`'s guard and the two `taskLine` gates — remote rows fall back to
read-only. The app runs the copied snapshot at
`~/.config/herdr-app/mods/openspec/`, so sync before checking in the app:
`rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/`.
No archive-order dependency: both prior changes are archived and their
wording is already the main spec's.
