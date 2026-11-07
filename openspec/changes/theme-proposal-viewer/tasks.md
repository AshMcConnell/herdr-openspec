# Tasks

## 1. Change scaffold
- [x] 1.1 `openspec new change theme-proposal-viewer`; write proposal.md

## 2. Delta specs
- [x] 2.1 proposal-viewer delta — Viewer palette (built-in Tokyo Night dark table, fixed whatever the app theme, list untouched)

## 3. Mod — mods/openspec/main.js
- [x] 3.1 NIGHT constant table (bg/bgAlt/border/fg/muted/faint/error), each mapped from the theme's Obsidian variable
- [x] 3.2 proposalView(): root/header/footer/chip/states on NIGHT; the body drawn by the mod's own markdown renderer inside a scroll container; comments updated
- [x] 3.3 NIGHT_MD table — the markdown decorations mapped from theme.css rules (headings h1–h6, bold/italic, links, code, quote bar/bg, hr, list markers, task boxes), with the Obsidian defaults noted where the theme is silent
- [x] 3.4 Block parser (mdBlocks): headings, fenced code with its language chip, lists (one nesting level, task boxes), merged blockquotes, rules, merged paragraphs; 2000-block cap ending in a faint "… truncated" line
- [x] 3.5 Inline parser and runs (mdInline/mdRuns): code chips, bold/italic runs, http(s) links clickable through the system browser, unknown syntax kept literal
- [x] 3.6 Document padding: the rendered body padded inside its scroll container (p(14)) so the text never touches the pane's edges
- [x] 3.7 The change's name as the document title: first element of the body in the exact H1 style (size/weight/colour), header bar slimmed to the proposal.md chip

## 4. Docs
- [x] 4.1 README.md — viewer bullet says Tokyo Night; Limits notes the palette is fixed (doesn't follow the app theme)
- [x] 4.2 RECIPE.md — viewer bullet mentions the Tokyo Night palette

## 5. Checks (all must pass before reporting)
- [x] 5.1 `node --check mods/openspec/main.js`; `herdr-app check mods/openspec` passes
- [x] 5.2 `openspec validate theme-proposal-viewer --strict` passes
- [x] 5.3 `openspec validate --specs --strict` passes (6/6, untouched); `openspec list` shows both changes active
- [x] 5.5 Live check (agent): pane-split a real proposal into the running app and screenshot it — Tokyo Night body styling (coloured headings, code chips, links) and the document padding visible; pane left open for the owner
- [ ] 5.4 In-app (owner): right-click → View proposal shows the Tokyo Night pane in dark and light app themes; the list keeps the app theme
