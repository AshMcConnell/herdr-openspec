# Tasks

## 1. Change scaffold
- [x] 1.1 `openspec new change theme-proposal-viewer`; write proposal.md

## 2. Delta specs
- [x] 2.1 proposal-viewer delta — Viewer palette (built-in Tokyo Night dark table, fixed whatever the app theme, list untouched)

## 3. Mod — mods/openspec/main.js
- [x] 3.1 NIGHT constant table (bg/bgAlt/border/fg/muted/faint/error), each mapped from the theme's Obsidian variable
- [x] 3.2 proposalView(): root/header/footer/chip/states on NIGHT; TextView.markdown body inherits NIGHT.fg with text_size(15)/line_height(1.6); comments updated

## 4. Docs
- [x] 4.1 README.md — viewer bullet says Tokyo Night; Limits notes the palette is fixed (doesn't follow the app theme)
- [x] 4.2 RECIPE.md — viewer bullet mentions the Tokyo Night palette

## 5. Checks (all must pass before reporting)
- [x] 5.1 `node --check mods/openspec/main.js`; `herdr-app check mods/openspec` passes
- [x] 5.2 `openspec validate theme-proposal-viewer --strict` passes
- [x] 5.3 `openspec validate --specs --strict` passes (6/6, untouched); `openspec list` shows both changes active
- [ ] 5.4 In-app (owner): right-click → View proposal shows the Tokyo Night pane in dark and light app themes; the list keeps the app theme
