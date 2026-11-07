# AGENTS.md

This repo holds the OpenSpec panel mod for the Herdr desktop app
(`mods/openspec/`) — a live list of the focused repository's OpenSpec changes.
The mod's behaviour is specified under `openspec/specs/`; behaviour changes go
through an OpenSpec change (deltas in `openspec/changes/<name>/specs/`),
archived into the specs when it lands. Run
`openspec validate --specs --strict` before finishing, and keep the specs in
step with `mods/openspec/main.js` — it is the source of truth.
