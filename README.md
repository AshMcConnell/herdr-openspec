# OpenSpec for Herdr

A live list of your [OpenSpec](https://github.com/Fission-AI/OpenSpec) changes
for the [Herdr](https://herdr.dev) desktop app — what `openspec list` prints,
but always current, in a panel beside your work. Written as a native Herdr
mod: no web view, no server, just small JavaScript the app runs itself.

![OpenSpec docked in the side panel](preview-panel.png)

Click a change to fold out its task list from `tasks.md`, and press the box
button to archive a change (`openspec archive`, confirmed twice, reported by
toast). The list follows the repository of the terminal you're focused on —
including spaces that live on another machine.

![OpenSpec as a floating window](preview-window.png)

## What it shows

- **Header**: the change count and the total tasks done, a refresh button, and
  a close button when it floats.
- **Toolbar**: a filter box (matches change names, case-insensitive, `Esc` or
  the × clears it) and a sort button that cycles **recent → A–Z → % done**.
  The choice is remembered. Header totals follow the filtered set.
- **One row per active change**: name, progress bar, `done/total` tasks, a
  status chip when it isn't `in-progress` (OpenSpec's `✓ Complete` shows
  green), and when the change was last touched. Rows sort most recent first,
  as `openspec list` does.
- **Expanded**: the change's task list — ✓ for done, ○ for open, under its
  `tasks.md` section headings. Click again to fold it away.
- **Archive** (the box button): first click turns it into a red
  **Archive?** chip; second click runs `openspec archive <name> --yes`. It
  cancels if you click anything else or wait a few seconds. While it runs the
  row shows a spinner, and a toast reports the result. Works on incomplete
  changes too — OpenSpec warns and continues under `--yes`.
- **Footer**: the folder being read (with the machine's name when it isn't
  this one).

## Live

The panel watches `openspec/changes/`, so a task an agent ticks or a change
it creates appears right away. A 15-second poll covers remote machines (the
folder watch is local-only), and switching spaces or panes re-reads at once.
It runs `openspec list --json` in the focused repository — on its machine for
remote spaces, the same way Herdr's own panels run `git`.

## Install

You need the Herdr desktop app and the `openspec` CLI on your `PATH`.

Ask your Herdr agent: *"add the mod at
github.com/AshMcConnell/herdr-openspec"*. It reads
[RECIPE.md](RECIPE.md) and the files, copies `mods/openspec/` into
`~/.config/herdr-app/mods/`, and checks it.

Or by hand:

```sh
git clone https://github.com/AshMcConnell/herdr-openspec
cp -R herdr-openspec/mods/openspec ~/.config/herdr-app/mods/
```

The mod loads in place — no restart. Herdr's Files and Changes panels show
where one goes: to open OpenSpec beside a terminal right away:

```sh
herdr-app do pane.split '{"direction":"right","mod":"openspec"}'
```

`pane.split` accepts a fixed folder too, if you want it pinned to one
repository: add `"props":{"folder":"/path/to/repo"}`.

### Updating

An installed copy doesn't update itself.

```sh
cd herdr-openspec && git pull
rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/
```

### Dock it like Files and Changes

Herdr's tab bar has **Files** and **Changes** buttons, each opening a side
panel. [docs/top-bar.md](docs/top-bar.md) adds an **OpenSpec** button beside
them (your agent can do it in a minute), by cloning Herdr's `main` layout and
`tabs` mod. Herdr never auto-docks mods into its own shipped layouts — the
clones are how every panel mod docks.

### Or open it as a floating window

Give it a key: in `~/.config/herdr-app/keys.json`, under `"global"`, add

```json
"cmd-alt-o": "mod.open:openspec",
```

Now `cmd-alt-o` opens the list as a small floating window over anything
(press it again to close; the × in its header closes it too). Herdr remembers
where you dropped it, and it comes back with your layout if it was open when
you quit.

## What it runs

The mod runs `openspec` in the repository it follows: `openspec list --json`
(every 15 seconds, when something under `openspec/changes/` changes, and when
you switch pane or space), and `openspec archive <name> --yes` when you press
the archive button's chip. One `git rev-parse --show-toplevel` per switch
finds the repository root for reading `tasks.md` — read with Herdr's file
reader, on the pane's machine for remote spaces. It never runs a shell: every
call is an argument list, and change names come from `openspec list`, never
typed input. Nothing goes to the network.

## Limits

- **Archive skips OpenSpec's prompts** (`--yes`), because the mod can't
  answer them: archiving a change with unfinished tasks proceeds with
  OpenSpec's own warning instead of asking.
- **Remote spaces poll** every 15 seconds rather than watching files (Herdr's
  folder watch is local-only).
- **Long task lines** truncate to the row; continuation lines of a wrapped
  task in `tasks.md` aren't shown, and lists past 120 tasks point at the file.
- **The filter matches change names** — not task text or specs.

## License

[MIT](LICENSE)
