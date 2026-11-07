# Proposal: Theme the proposal viewer Tokyo Night

## Why

The owner's Obsidian theme is Tokyo Night (dark) in every vault — but the
proposal viewer wears whatever Herdr's app theme hands it via `theme()`
tokens. Reading a proposal there should feel like reading it in Obsidian,
so the viewer paints itself from Tokyo Night instead of following the app.

## What Changes

- **Viewer palette** (new `proposal-viewer` delta requirement): the viewer's
  chrome — root, header, footer, chips, states — and the whole markdown body
  take their colors from a built-in Tokyo Night dark palette, held as
  constants in `main.js`. Not the app theme's tokens, and not a read of the
  vault's CSS (the mod must not depend on Obsidian paths, and remote panes
  have no vault to read). The palette is fixed: a dark `#1a1b26` pane inside
  a light app theme is deliberate. The change list keeps the app theme's
  tokens — only the viewer is themed.
- **The body is drawn by the mod's own renderer**: gpui-kit's TextView
  styles itself from the app theme, so its headings, code chips and links
  read flat charcoal beside the navy pane — the chrome alone did not look
  themed at all. The mod instead parses the markdown itself (headings,
  fenced code, lists one level deep, blockquotes, rules, merged paragraphs;
  inline code, bold, italics, links) and lays it out with plain elements,
  every part coloured from the palette; http(s) links open in the system
  browser. Unsupported syntax (tables, images, deeper nesting, escapes)
  renders as literal text, never dropped. The change's name leads the body
  as an H1-style title (Obsidian-note style) and the header bar slims to
  the proposal.md chip. Trade-off: the rendered document
  is not text-selectable (the TextView was), and the document is padded
  inside its scroll container rather than the component's own margins.

## Impact

- Affected specs: `proposal-viewer` (delta — ADDED requirement only; the
  capability's own change `view-proposal-pane` is untouched and both
  changes stay active together).
- Affected code: `mods/openspec/main.js` (+ README.md / RECIPE.md). No new
  programs, no network.
