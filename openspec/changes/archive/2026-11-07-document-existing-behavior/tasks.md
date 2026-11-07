# Tasks

## 1. Scaffolding

- [x] 1.1 Run `openspec init --tools opencode` and confirm the created tree
- [x] 1.2 Run `openspec new change document-existing-behavior`
- [x] 1.3 Write proposal.md (retrospective documentation; no code changes)

## 2. Specs (one delta spec per capability, from main.js + README + RECIPE)

- [x] 2.1 `change-list` — location resolution, `openspec list --json` source, refresh triggers (watch/poll/switch/manual), rows, empty & error states, footer, exec constraints
- [x] 2.2 `change-state` — state derivation (complete / no tasks / unstarted / nearly ≤ 2 left / in progress), chips, bar colour, green-through complete rendering
- [x] 2.3 `list-controls` — filter (case-insensitive name substring, Esc/× clear, counts follow filter) and sort (recent → A–Z → % done → state, persisted, grouping headers with counts)
- [x] 2.4 `task-tracking` — expand/collapse, tasks.md parsing, 120-row cap and hover text, local-only click-to-toggle with compare-and-swap write and one retry, read-only remote, empty states
- [x] 2.5 `archive-flow` — 6-second "Archive?" confirm chip, `openspec archive <name> --yes`, spinner, single-archive lock, toast result, collapse + refresh after
- [x] 2.6 `context-menu` — right-click popup, Copy name with clipboard + toast, keyboard navigation, extensible menu

## 3. Verify

- [x] 3.1 `openspec validate document-existing-behavior --type change --strict` (note: 1.3.1 may report nothing to validate — the gate is 3.3)
- [x] 3.2 Cross-check every requirement against main.js; no invented behaviour, no missed README feature

## 4. Archive and final gate

- [x] 4.1 `openspec archive document-existing-behavior --yes`; confirm 6 capabilities merged into `openspec/specs/`
- [x] 4.2 Fill any empty Purpose sections in the merged specs
- [x] 4.3 `openspec validate --specs --strict` passes 6/6
- [x] 4.4 `openspec list` shows no active changes; `openspec list --json` parses

## 5. Repo polish

- [x] 5.1 One README sentence pointing at `openspec/specs/`
- [x] 5.2 Root `AGENTS.md` (behaviour changes go through OpenSpec changes; validate before finishing)
- [x] 5.3 Single commit; leave `mods/openspec/jsconfig.json` and `mods/openspec/gpui-kit.d.ts` untracked
