# An OpenSpec button in the top bar

Herdr's main layout has a **Files** and a **Changes** button at the right end
of the tab bar, each opening a side panel. These steps add **OpenSpec**
beside them, opening this mod in the same panel. They are written for the
person's agent to follow; a person can follow them too.

Herdr's own layouts and mods are read-only (they're replaced on every
start), so the button goes into *clones* of the `main` layout and the `tabs`
mod. This mod doesn't ship those clones: they'd be frozen copies of Herdr's
code. You make them from the version you have now.

What clones cost: they're yours and never updated. When a Herdr release
changes the tab bar or the main layout, the clones keep the old ones until
you clone again and redo these steps.

Tested against Herdr 0.1.13; in another version, find the same two places
(the enabled-panels line and the Changes button of `tabs`; the `tabs` block
and the `panel-body` stack of the layout).

## 1. Clone the tab bar and the layout

```sh
herdr-app do mod.clone '{"name":"tabs","as":"tabs-openspec"}'
herdr-app do layout.clone '{"name":"main","as":"main-openspec"}'
```

`layout.clone` switches the window to the clone. If a clone name already
exists, reuse it instead of re-cloning (check it isn't a different mod's).

## 2. Add the button: `mods/tabs-openspec/main.js`

Two edits.

The enabled panels decide which buttons show and which panel a space may
reopen. Add `"openspec"` to them:

```js
// before
const enabled = shared("workspace.panels") ?? ["files", "changes"];
// after
const enabled = [...(shared("workspace.panels") ?? ["files", "changes"]), "openspec"];
```

Then add the button right after the Changes one:

```js
// before
      .when(enabled.includes("changes"), el => el.child(panelButton("changes", "Changes", "mods/changes/changes.svg")))
// after
      .when(enabled.includes("changes"), el => el.child(panelButton("changes", "Changes", "mods/changes/changes.svg")))
      .when(enabled.includes("openspec"), el => el.child(panelButton("openspec", "OpenSpec", "mods/openspec/openspec.svg")))
```

## 3. Add the panel: `layouts/main-openspec.json`

- The node with `"id": "tabs"`: set its `content.mod` to
  `"tabs-openspec"`.
- The stack with `"id": "panel-body"` (it holds `files` and `changes`):
  append a third child:

```json
{
  "id": "openspec",
  "type": "block",
  "content": { "mod": "openspec" }
}
```

## 4. Check

The edits apply live. Confirm:

```sh
python3 -m json.tool ~/.config/herdr-app/layouts/main-openspec.json > /dev/null && echo ok
herdr-app check ~/.config/herdr-app/mods/tabs-openspec
herdr-app status
```

`status` lists any layout or mod errors; expect `"errors": []`. The tab bar
now shows the **OpenSpec** button; clicking it opens the panel (and records
the choice per space, as Files and Changes do).

## Undo

Switch back to the shipped `main` layout (`layout.switch` cycles, or the
palette), then remove the clones:

```sh
rm -rf ~/.config/herdr-app/layouts/main-openspec.json ~/.config/herdr-app/mods/tabs-openspec
```

Herdr's `layout.reset main` restores the shipped layout if it was ever
edited; the clones leave it alone.
