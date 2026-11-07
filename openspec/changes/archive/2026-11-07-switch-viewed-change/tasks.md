# Tasks

## 1. Shared registry and request plumbing

- [x] 1.1 Add `shared`, `setShared` and `nextCommand` to the `herdr` import in `mods/openspec/main.js`
- [x] 1.2 Module helpers: `VIEWERS = "openspec.viewers"`, `VIEW = "openspec.view"` (per-viewer key prefix), `ACK = "openspec.view.ack"`, `QUIET = "openspec.view.quiet"`, `OPEN = "openspec.open"` (per-panel key prefix); `viewKey(id)` / `openKey(panel)`; a random `uid()` (time + `Math.random`, no `crypto` dependency); `repoOf(dir)` taking the part before `/openspec/changes/`
- [x] 1.3 Registry read/merge helpers: prune entries older than 7 days, cap at 40, always re-read and merge immediately before writing; entries carry `{at, file, root, on}`
- [x] 1.4 `matchingViewers(root, on)` returns `[id, entry]` pairs whose `root` and `(on ?? null)` equal the panel's and which are not in a quiet cooldown, newest `at` first; a null root matches nothing
- [x] 1.5 `quietMap()` / `isQuiet(id)` / `markQuiet(id)` / `clearQuiet(id)`: a viewer that does not answer is skipped for 15 seconds, not removed from the registry

## 2. Panel coordinator

- [x] 2.1 Give each list copy a random `panelId` at init and pass it to the row menu: right-click's `openOverlay` props become `{menuFor, root, on, panel}`
- [x] 2.2 In the list branch of `init`, start a `nextCommand()` loop with a try/catch: on `"open"`, read `shared(openKey(panelId))`, ignore requests for another panel id or an already-handled `seq`, then call `requestViewer(req.name, cx, {root: req.root, on: req.on, openIfNone: true})`
- [x] 2.3 `requestViewer(name, cx, {root, on, openIfNone})`: build `<root>/openspec/changes/<name>/proposal.md`; candidates = `matchingViewers(root, on)`; every candidate is asked, including one already naming the file (a live viewer acks without moving, so a stale entry cannot fake success); write the request into `shared(viewKey(id))` as a queue keyed by token, then `run("openspec.view")`
- [x] 2.4 Wait 700 ms for the acknowledgement of that token; on a match clear the viewer's quiet mark and stop; on a timeout `markQuiet(id)` for 15 seconds and try the next candidate
- [x] 2.5 When candidates run out: with `openIfNone`, `run("pane.split", {direction: "right", mod: "openspec", props: {file, change: name, on}})`; without it (row clicks), do nothing
- [x] 2.6 A per-panel request token invalidates earlier waits when a new request starts, so a stale timer cannot open a pane after a newer click; `closed` guards stop a timer that outlives its copy

## 3. Row click retargets

- [x] 3.1 In `pick`, when a row is being opened (`this.open` changes from something else to `name`), call `requestViewer(name, cx, {root: this.root, on: this.on, openIfNone: false})`; folding a row away or clicking the row already open makes no request
- [x] 3.2 Keep the existing task read and archive-confirmation reset in `pick`; a missing root simply skips the request

## 4. Menu sends the request

- [x] 4.1 `MENU` **View change** no longer calls `pane.split` itself: it keeps the no-root error toast, then writes `shared(openKey(at.panel)) = {panel: at.panel, name, root: at.root, on: at.on, seq: uid()}` and calls `run("openspec.open")`
- [x] 4.2 The popup still closes on click; no timer or async work belongs to the popup's `cx`
- [x] 4.3 Keep the menu item text **View change** and the rest of the menu unchanged

## 5. Viewer registration

- [x] 5.1 In the viewer branch of `init`, set `viewerId = uid()`, `seenSeq = null`, `closed = false`, register `{at, file: this.file, root: repoOf(this.dir), on: this.machine}` in `VIEWERS`
- [x] 5.2 Implement `Optional View.close(cx)`: set `closed`, stop the refresh task, remove this viewer's registry entry, and clear its per-viewer request slot (a closing list copy clears its per-panel open slot)
- [x] 5.3 On a switch, update the registry entry's `file`; the id is never removed by a timeout, so it does not need re-adding

## 6. Viewer follows a retarget

- [x] 6.1 Start a `nextCommand()` loop with a try/catch in the viewer copy: on `"view"`, read the queue at `shared(viewKey(viewerId))`; ignore a token already seen and never read another copy's queue
- [x] 6.2 Acknowledge every queued request before switching: store its id under each token in `ACK`, clear this viewer's quiet mark, land on the last queued request; if it names the file already shown, acknowledge and return without touching state
- [x] 6.3 `switchTo(req, cx)`: ignore a call after `close`, bump `generation`, take `file`/`dir`/`change`/`machine` from the request, reset `docs` to blank, `specs` to empty, `specsLoading` false, `tasksText` null, `tabsAvailable` `["proposal"]`, `tab` `"proposal"`
- [x] 6.4 Cancel the old refresh task (store the `cx.spawn`/`cx.timer.every` handle), then arm the new one: a folder watch on the new change dir for a local change, `cx.timer.every(15000, …)` for a remote one, with a fallback poll when the watch cannot arm
- [x] 6.5 Guard the watch loop with its captured dir (`while (this.dir === dir)`), so a wake from the old folder exits instead of reading the new one with stale state
- [x] 6.6 Run discovery at once after the switch and `cx.notify()`; the existing `loadArtifacts` generation/file guards discard reads that finish for the old change
- [x] 6.7 Keep the tab fallback: a request may arrive while `design`/`tasks`/`specs` was selected; the reset to `proposal` plus the existing "artifact gone" rule covers it

## 7. Writes during a switch

- [x] 7.1 In `toggleTask`, capture the current `file` and a new toggle token at click time; only apply the optimistic flip, the settled text and the final `loadArtifacts` when `this.file` is still that file and the token is current
- [x] 7.2 On `switchTo`, clear `toggling` so the new change can be ticked at once; the old write still finishes into its own change's `tasks.md`
- [x] 7.3 In `loadArtifacts`, keep the existing `if (this.toggling) next.docs.tasks = this.docs.tasks` rule scoped to the current change (the reset makes it a no-op after a switch)

## 8. Docs

- [x] 8.1 README.md — right-click bullet: **View change** switches the newest open viewer for the same repository and machine, and opens a pane only when none answers
- [x] 8.2 README.md — expanded-row bullet: a row click also retargets an open viewer; clicking the open row again only folds it away
- [x] 8.3 README.md — Limits: replace "Every View change click opens another pane — no de-duplication" with the newest-viewer rule, the same-repository/machine filter, the 700 ms acknowledgement and 15-second cooldown, the no-pane row-click rule, and that a restart returns the pane to its saved props' change
- [x] 8.4 README.md — Live section: a switched viewer re-arms its watch on the new change folder (remote: 15-second poll)
- [x] 8.5 RECIPE.md — menu bullet and viewer description match the switch behaviour; **What it runs** notes the per-viewer/per-panel shared values and the `openspec.view` / `openspec.open` commands (no new programs)
- [x] 8.6 Keep the specs in step: the three deltas (`proposal-viewer`, `context-menu`, `task-tracking`) are the source of truth for behaviour

## 9. Checks (all must pass before reporting)

- [x] 9.1 `node --check mods/openspec/main.js`
- [x] 9.2 Sync to `~/.config/herdr-app/mods/openspec/` and `herdr-app check mods/openspec` passes
- [x] 9.3 `openspec validate switch-viewed-change --strict` and `openspec validate --specs --strict` pass
- [x] 9.4 Live (agent): open a viewer, click another row — the viewer switches and the task list folds out; **View change** on a third change switches it again — one viewer pane only; close the viewer and **View change** opens a fresh pane; a local artifact edit still lands live after a switch
- [x] 9.5 In-app (owner): two viewers open — only the newest switches; a viewer on a remote space switches too; restart after a switch returns the pane to the change its props name
- [x] 9.6 Archive-time note: archive `tabbed-change-viewer` **before** this change so its deltas do not overwrite the retargeting requirements; hand-rewrite the merged `proposal-viewer` Purpose to describe the tabbed, switchable viewer; then validate the merged `proposal-viewer`, `context-menu` and `task-tracking` specs

## 10. Review fixes (subagent findings)

- [x] 10.1 Remove the "already naming the file" shortcut: every candidate is asked and must acknowledge, so a stale entry cannot make **View change** silently do nothing
- [x] 10.2 Never remove a silent viewer from the registry: mark it quiet for 15 seconds and retry later, so a live viewer in a hidden tab is not orphaned
- [x] 10.3 Per-target request slots (`openspec.view.<id>`, `openspec.open.<panel>`) and a token-keyed queue, so two panels cannot overwrite each other's requests
- [x] 10.4 `closed` flags and try/catch around the `nextCommand` loops, so a reload wake or a raced close cannot kill retargeting or re-register a closed copy
- [x] 10.5 Docs: scope the pane fallback to **View change** (row clicks never open a pane); the machine never changes on a switch
- [x] 10.6 Consolidate request slots into `openspec.views` / `openspec.opens` maps, sweeping ids with no live viewer, so stale keys cannot accumulate
- [x] 10.7 Withdraw a request when its window closes and ignore requests older than 700 ms, so an abandoned click cannot switch a viewer after the fallback pane
- [x] 10.8 Final spec re-merge after the tabbed archive, with the cooldown, queue and withdrawal behaviour validated
