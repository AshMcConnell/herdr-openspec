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
the herdr CLI's file surface: `file read|write|edit [--on <machine>] <path>`,
where `edit` is an exact-text replace via `--old X --new Y`. Nothing in this
repo's docs (README.md, RECIPE.md, specs) mentions that CLI surface — it is
the owner's documentation of the CLI and must be verified at runtime (Risks).

## Goals

- Tick and untick a task on a remote machine from the panel's fold-out rows
  and hover-card button, in the same interaction as local.
- Guard the remote write like the local one: never blind-overwrite a
  concurrent edit, verify the flip landed exactly once, and on any failure
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

**Vehicle: `exec("herdr", ["file", "edit", "--on", machine, path, "--old",
old, "--new", new])` — run the CLI where the panel runs and let `--on` route
the edit to the machine.** Reasoning: the CLI documents `--on <machine>` as
its machine selector, which only makes sense when the CLI runs off-machine
and routes the write through Herdr — the same routing `exec`'s `on` uses
("through herdr-core"). This also removes the "is `herdr` on the
remote machine's PATH?" risk entirely: the binary is needed only on the
machine running the app, which is the install the owner documented. The file
argument is absolute (`${this.root}/openspec/changes/${name}/tasks.md`,
`this.root` from `git rev-parse --show-toplevel` on the machine) and the
CLI's `--on` names the machine, so no `cwd` option is passed — note that
`this.root` is a *remote* path and must not be used as a local `cwd`.
Runtime caveat and fallbacks (one-line swap inside the helper, see Risks):
if the local form is refused, run it on the machine instead —
`exec("herdr", ["file", "edit", path, "--old", old, "--new", new], { cwd:
this.root, on: machine })` — or route through the kit's
`hc(["file", "edit", "--on", machine, …])` (add `hc` to the import at
main.js:18). `toggle()` never learns which vehicle ran.

**Guard: read → build exact old/new → edit → re-read → verify.** This is the
remote analogue of the local compare-and-swap:

1. **Old/new from current bytes.** `flipPair(body, line, next)` takes the
   `body` just read and the `next` that `toggled(body, line, task, to)`
   produced (caller already refused a null `next`), and returns
   `{ old, neu }`: that line's exact bytes in `body` and in `next` — the
   0-based `split("\n")` index `toggled` uses, trailing `\r` kept, and the
   trailing `\n` appended whenever the line is not the file's last (so
   `- [ ] fix parser` can never match inside `- [ ] fix parser quickly`).
   These strings are passed as exec argv entries — no shell, no quoting.
2. **Uniqueness before writing, on both sides.** Count literal substring
   occurrences of `old` in `body` and of `neu` in `next` (`occurs(text,
   needle)` via split/join — never regex, task text can hold regex
   characters). Both exactly one → proceed. Otherwise retry with the previous
   line's bytes + `\n` prepended to both sides (neighbour context). Still not
   exactly one on either side → throw "the task's line is not unique in
   tasks.md" and write nothing. This is the guard against `--old` replacing
   more than one place, and the `neu` half is what makes the post-edit verify
   ("present exactly once") satisfiable at all: two task lines with the same
   text in different states, or a short task whose longer ticked sibling
   contains the flipped text, would otherwise land correctly and then fail
   verification. A pair whose `old` and `neu` are the same bytes changes
   nothing — the file already holds the asked state — so the helper hands it
   back and `writeFlip` returns the read text as settled without running an
   edit, the silent accept the local compare-and-swap gives.
3. **The edit.** `exec("herdr", ["file", "edit", "--on", machine, path,
   "--old", old, "--new", neu])`; a non-zero exit throws with the last
   stderr/stdout line (same reporting shape as the archive button). If the
   file drifted on the clicked line, `--old` matches nowhere and the edit
   fails — that maps onto the existing "stale snapshot" retry exactly.
4. **Verify.** Re-read with `readTextFile(path, { on: machine })`; null →
   throw "tasks.md is gone". Accept only if `occurs(reread, neu) === 1 &&
   occurs(reread, old) === 0` — the flip landed exactly once. Anything else
   throws "the write did not land as asked". Return the re-read as the
   settled text, so the panel shows the file's real bytes.

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

- **The `herdr file edit` surface is not evidenced in this repo.** README and
  RECIPE document `herdr-app` commands only; the flags come from the owner.
  The first manual check probes the exact invocation before anything is
  trusted; if the local form is refused, the one-line vehicle swap in the
  helper (on-machine `exec`, or `hc([...])`) is the fix, not a redesign.
- **`--old/--new` semantics (replace-all vs first match) are unverified.**
  Both are made safe: the uniqueness rule refuses any old text that appears
  more than once in the file, and the post-write verify would catch a
  multi-replace that slipped through (old gone but new present twice →
  fail). Worst case is a refused toggle and a toast, never a corrupted file.
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
