# AGENTS.md

This repo holds the OpenSpec panel mod for the Herdr desktop app
(`mods/openspec/`) — a live list of the focused repository's OpenSpec changes.
The mod's behaviour is specified under `openspec/specs/`; behaviour changes go
through an OpenSpec change (deltas in `openspec/changes/<name>/specs/`),
archived into the specs when it lands. Run
`openspec validate --specs --strict` before finishing, and keep the specs in
step with `mods/openspec/main.js` — it is the source of truth.

## Syncing to the Herdr app

The app runs the mod from a copied snapshot at `~/.config/herdr-app/mods/openspec/` —
never the repo working copy, so repo edits do nothing in the app until synced.
After changing anything under `mods/openspec/`, sync before checking in the app:

```
rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/
```

Then reload the mod panel in the app — a change is only live once this has run.
