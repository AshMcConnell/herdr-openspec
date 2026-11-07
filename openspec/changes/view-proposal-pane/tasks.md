# Tasks

## 1. Change scaffold
- [x] 1.1 `openspec new change view-proposal-pane`; write proposal.md

## 2. Delta specs
- [x] 2.1 context-menu delta — View proposal menu item (label, pane.split right, file/change/on props, no-root guard)
- [x] 2.2 proposal-viewer delta — pane content, states, refresh (local watch / remote + fallback poll), standalone

## 3. Mod — mods/openspec/main.js
- [x] 3.1 Import `run` (herdr) and `TextView` (gpui-kit); update the header comment
- [x] 3.2 MENU: add View proposal; popup props carry root/on; choose passes them to run()
- [x] 3.3 init/render: the `file`-prop viewer branch
- [x] 3.4 load/watchProposal (watch local, poll remote, fallback)
- [x] 3.5 proposalView(): header, TextView.markdown body, states, footer

## 4. Docs
- [x] 4.1 README.md — menu, viewer bullet, Live, What it runs, Limits
- [x] 4.2 RECIPE.md — menu, fourth way it shows itself, What it runs

## 5. Checks (all must pass before reporting)
- [x] 5.1 Sync main.js to ~/.config/herdr-app/mods/openspec/; `herdr-app check` passes
- [x] 5.2 `openspec validate view-proposal-pane --strict` passes
- [x] 5.3 `openspec validate --specs --strict` passes (6/6, untouched)
- [x] 5.4 In-app: right-click → View proposal opens the pane; markdown renders; a change without proposal.md shows the state; `openspec list` shows the change active
