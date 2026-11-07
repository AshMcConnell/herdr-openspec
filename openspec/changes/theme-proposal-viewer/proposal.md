# Proposal: Theme the proposal viewer Tokyo Night

## Why

The owner's Obsidian theme is Tokyo Night (dark) in every vault — but the
proposal viewer wears whatever Herdr's app theme hands it via `theme()`
tokens. Reading a proposal there should feel like reading it in Obsidian,
so the viewer paints itself from Tokyo Night instead of following the app.

## What Changes

- **Viewer palette** (new `proposal-viewer` delta requirement): the viewer's
  chrome — root, header, footer, chips, states — and the markdown body's
  text colour and typography take their colors from a built-in Tokyo Night
  dark palette, held as constants in `main.js`. Not the app theme's tokens,
  and not a read of the vault's CSS (the mod must not depend on Obsidian
  paths, and remote panes have no vault to read). The palette is fixed:
  a dark `#1a1b26` pane inside a light app theme is deliberate. The change
  list keeps the app theme's tokens — only the viewer is themed.
- **Honest limit**: the markdown body's text colour and typography are
  themed; the decorations the TextView component draws itself (headings,
  code chips, links) keep the component's own styling. gpui-kit has no
  per-block markdown styling — full CSS is not possible.

## Impact

- Affected specs: `proposal-viewer` (delta — ADDED requirement only; the
  capability's own change `view-proposal-pane` is untouched and both
  changes stay active together).
- Affected code: `mods/openspec/main.js` (+ README.md / RECIPE.md). No new
  programs, no network.
