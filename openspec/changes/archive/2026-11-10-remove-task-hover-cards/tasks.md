## 1. Code — `mods/openspec/main.js`

- [x] 1.1 Drop `HoverCard` from the `gpui-base` import.
- [x] 1.2 Delete the `hoverCard(id, trigger, state, text, onToggle)` helper and return `taskLine` to plain rows and headings: the section branch returns its truncating `div`, the task branch returns the row `h_flex` with its click and hover background, both without a card wrapper.
- [x] 1.3 `node --check mods/openspec/main.js` passes and no `HoverCard`/`hoverCard` reference remains.

## 2. Specs

- [x] 2.1 Delta modifies **Display cap** — the card sentences and the card scenarios go, the wrapping and truncation stay — and **Click to toggle** — the in-card button and its scenarios go, the write semantics stay.

## 3. Documentation

- [x] 3.1 README **Expanded** bullet: drop the hover-card sentences and the in-card button, keep the wrapped task rows and the truncating headings.
- [x] 3.2 README **Limits**: the long-task-rows bullet no longer promises a heading's full text in a hover card.
- [x] 3.3 RECIPE description paragraph: drop "hovering shows a truncated row's full text".

## 4. Checks and deploy

- [x] 4.1 `openspec validate remove-task-hover-cards --strict` passes.
- [x] 4.2 `openspec validate --specs --strict` passes.
- [x] 4.3 `herdr-app check mods/openspec` passes.
- [x] 4.4 Sync the snapshot the app runs: `rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/`, then reload the OpenSpec panel.

## 5. Manual checks in the app (owner)

- [x] 5.1 Rest on an open task, a done task and a long section heading: no card appears, and the rows below stay visible.
- [x] 5.2 Clicking a task still ticks or unticks it, and its row still takes the hover background.
- [x] 5.3 The change viewer's tasks tab is unchanged.
