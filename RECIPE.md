# OpenSpec

A live list of the focused terminal's OpenSpec changes for the Herdr desktop
app: one row per active change (name, progress bar, done/total tasks, and
its age), newest first, with header totals. A toolbar under the header has a
filter box (change-name substring; `Esc` or × clears it) and a sort button
cycling recent → A–Z → % done → state (remembered in the panel's
`localStorage` under `"sort"`); the header totals follow the filtered set.
Each row carries a state chip — `✓ complete`, `N left` (at most 2 tasks
remaining), `unstarted`, or `no tasks` (proposal-only) — and the progress
bar takes the state's color (a complete change reads green all through:
name, count, bar, chip, and its task list once expanded); the green is the
theme's ANSI bright green, not its `done` status colour (which can be blue).
The **state** sort groups the list under ✓ Complete / Nearly done / In
progress / Unstarted / No tasks headers with counts. Clicking a row folds out
the change's task list from its `tasks.md` (✓ done, ○ open, section
headings; hovering shows a truncated row's full text); clicking a task ticks
or unticks its checkbox in `tasks.md` itself (this machine only), and a
**Mark all N done** action above the rows ticks every open box in one write
once two presses confirm it. The box
button on a row archives that change: first click turns it into a red
"Archive?" chip, the second runs `openspec archive <name> --yes` and reports
by toast. The toolbar's **Bulk archive** button hands `/opsx-bulk-archive` to
the selected agent instead — the command's own workflow prompts for the
changes, validates each one, resolves conflicting delta specs, syncs the
specs and archives; the panel itself runs no archive command for it. A
**Commands** button beside it (shown whenever a repository is resolved)
opens a small repo-level menu, today one item: **New change**, which hands
off `/opsx-propose` with nothing appended.
Right-click a row for a small menu of its own: **Copy name** puts the
change's name on the clipboard (`write_to_clipboard`; a toast confirms), and
**View change** opens the whole change as a tabbed viewer beside the work —
proposal, design, tasks and specs, one tab for each artifact the change has,
with the tasks tab's checklist ticking checkboxes in `tasks.md` (this
machine only). A further **View change** switches the newest open viewer for
the same repository and machine instead of adding a pane, and opens a new
pane only when no viewer answers; clicking another row switches that viewer
too and never opens one. Under a divider the same menu carries five command
items: **Continue** (`/opsx-continue <name>`), **Apply** (`/opsx-apply
<name>`), **Verify** (`/opsx-verify <name>`), **Sync specs** (`/opsx-sync
<name>`) and **Archive using AI** (`/opsx-archive <name>`). Each is the same
kind of hand-off as **Bulk archive**. The panel reads the change's status
before opening and hides what cannot apply: Continue when the change is
complete; Apply and Verify until the tasks artifact is done (Apply also
until the row shows open tasks); Sync specs until the specs artifact is done.
Archive using AI is always shown; a failed status read shows all five.
It reads
the repository of the last focused terminal — clicking the panel, an open
viewer or the floating window leaves that folder alone — else any pane with a
folder in the active space, else the space's folder — running `openspec`
there, on its machine for remote spaces.

![OpenSpec docked in the side panel](preview-panel.png)

It shows itself four ways:

- **A side panel** like Files/Changes when a layout puts it in a block
  (`"content": { "mod": "openspec" }`), or docks it: with
  `"place": "right"` in `mod.json`, Herdr docks a copy the first time it
  sees the folder while a personal (cloned) layout is shown. Shipped
  layouts never auto-dock mods; see [docs/top-bar.md](docs/top-bar.md) for
  the clone recipe.
- **A floating window**: `mod.open {"name":"openspec"}` toggles it
  (`"overlay"` in `mod.json`: 480 px wide, 75% of the window, remembered by
  its `key`, reopened on start if it was open). A keys.json line such as
  `"cmd-alt-o": "mod.open:openspec"` binds a key.
- **A pane**: `herdr-app do pane.split '{"direction":"right","mod":"openspec"}'`.
  A `"props":{"folder":"/path/to/repo"}` pins it to one repository.
- **A change viewer**: the same pane split with
  `"props":{"file":"/path/to/repo/openspec/changes/<name>/proposal.md","change":"<name>","on":null}`
  shows the same mod as a tabbed viewer for that change — **proposal /
  design / tasks / specs**, a tab only for each artifact present, every body
  drawn by the mod's own renderer in a fixed Tokyo Night (the owner's
  Obsidian theme) palette (scrollable and padded, not text-selectable; only
  http(s) links are clickable, other URLs stay coloured but inert). The
  tasks tab is a full checklist; on this machine a click ticks that line in
  `tasks.md` with the panel's compare-and-swap write (remote panes are
  read-only). When every task is done the viewer reads green — its name, the
  selected tab, a `✓ complete` chip and the checklist. Normally opened from
  the row menu's **View change**; the props are saved with the tab, so the
  pane survives restarts. An already-open viewer (newest for the same
  repository and machine) is switched in place by a row click or another
  **View change**; its saved props still name the change it was opened on,
  so a restart returns it there.

## What it runs

- `openspec list --json` in the repository — on refresh (first show, a pane
  or space switch), every 15 seconds, and when Herdr's watch on
  `openspec/changes/` fires (local spaces only; remote spaces get the poll).
- `openspec archive <name> --yes` when the archive chip is confirmed. `--yes`
  is required: the mod has no TTY to answer OpenSpec's prompts, so an
  incomplete change proceeds with OpenSpec's warning instead of asking.
- `git rev-parse --show-toplevel` once per switch, to anchor the watch and
  the `tasks.md` reads and writes at the repository root (the folder itself
  when git fails).
- `find <change>/specs -name spec.md` when a viewer lists a change's delta
  specs (local and remote alike; the mod has no granted read root for
  `readdir`).

The row menu's copy uses the app's clipboard directly — not a command.

Change entries and capability directories whose name begins with a dot are
ignored — `openspec list` reports dot folders as changes, and the `find` over
a change's specs can return a `spec.md` inside a dot directory, so the mod
hides both (they are hidden, not deleted).

The row menu's **View change** opens the same mod as a pane beside the
work (`pane.split` with `{file, change, on}` props) and reads the change's
artifacts with `readTextFile` (on the pane's machine for remote spaces): a
folder watch on the change's own folder keeps a local pane current —
`specs/` included — and remote panes poll every 15 seconds (as does a watch
that cannot arm). List and viewer copies address each other through Herdr's
shared values (`openspec.viewers`, `openspec.views`, `openspec.view.ack`,
`openspec.view.quiet` and `openspec.opens`) and the mod's own `view` /
`open` commands, so an open viewer is switched in place rather than
duplicated. Those are the same kind of command every mod key binding uses;
no programs are started.

Nothing else: no shell, no network. `readTextFile` reads the expanded
change's `tasks.md`, and a task click writes it back with `writeTextFile`:
a compare-and-swap on the copy just read (a concurrent edit rejects the
write instead of being overwritten), local machine only (the writer takes
no `on`), and only ever to `openspec/changes/<name>/tasks.md` with `<name>`
from the list. **Mark all done** is one write of the same kinds: one
compare-and-swap of the whole file on this machine, or one `herdr-core file
edit` on a remote machine carrying a pair per open line (all-or-none, each
old line pre-checked unique, every changed line verified against a re-read).
Change names come from `openspec list`, never from typed
input, and none of the calls can start with `-`.

## Watch out

**Bulk archive** is a hand-off, not an archive: the button sends
`/opsx-bulk-archive` (typed with `herdr-core send`, on the agent's machine),
starts it in a new tab, or copies it to the clipboard — it never runs
`openspec archive` itself, never waits for the agent, and never reports the
result; the folder watch (or the 15-second poll) shows it. One hand-off runs
at a time. The send only happens when the selected agent's live folder is the
panel's repository (read from its pane, remembered from the last real
terminal focus); an agent in another repository, an unreadable folder, or no
selected agent instead starts a new tab in this repository with that agent's
program, else the first installed agent (`knownAgents`). No agent installed,
an unreadable agent list, or a tab that cannot start copies the command to
the clipboard instead. The row menu's five commands and the Commands menu's
**New change** take the same order of paths and the same one-at-a-time rule,
so a pick while any hand-off is in flight does nothing.

## Install

Copy this repository's `mods/openspec/` into `~/.config/herdr-app/mods/`:

```sh
git clone https://github.com/AshMcConnell/herdr-openspec
cp -R herdr-openspec/mods/openspec ~/.config/herdr-app/mods/
```

It hot-loads; no restart. Requires the `openspec` CLI on the user's `PATH`
(on every machine whose spaces will show it).

Check it:

```sh
herdr-app check ~/.config/herdr-app/mods/openspec
```

Expect `check passed`. Then verify it shows real data:

```sh
herdr-app do pane.split '{"direction":"right","mod":"openspec"}'
```

In a space whose folder holds an `openspec/changes/` directory, the panel
should list its changes within a second or two. Empty states it may show,
all normal: `No folder` (nothing focused with a folder), `openspec is not
installed`, `No OpenSpec here — run `openspec init`` (the folder has no
`openspec/changes/`), `No active changes`.

### If the person wants it docked beside Files and Changes

Follow [docs/top-bar.md](docs/top-bar.md): clone Herdr's `tabs` mod and
`main` layout, point the clone layout's tab bar at the clone tabs, add an
`openspec` block to the `panel-body` stack, and add the button. Herdr will
not dock mods into its shipped layouts by itself.

### If the person wants a key for the floating window

In `~/.config/herdr-app/keys.json`, under `"global"`, add e.g.
`"cmd-alt-o": "mod.open:openspec",`. The window toggles with the key; the
header's × closes it.

## Uninstall

```sh
rm -rf ~/.config/herdr-app/mods/openspec
```

Plus, if they were added: the `openspec` block in the layout clone's
`panel-body` stack, the button and enabled entry in the cloned tabs mod, and
any `mod.open:openspec` line in `keys.json`.

## Updating

Ask the agent to pull and re-copy, as in the README's
[Updating](README.md#updating) section: the installed copy is a plain
folder, not a git checkout.
