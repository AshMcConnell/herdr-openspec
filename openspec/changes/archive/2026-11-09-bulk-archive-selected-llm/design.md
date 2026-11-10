## Context

The panel's archive is one change at a time: the row's box button runs `openspec archive <name> --yes` directly (`archive()`, `mods/openspec/main.js:1225`). Its failure dialog hands `/opsx-archive <name>` to a new agent tab using the first installed entry from `knownAgents()` (`archiveWithAI()`, 1469). Neither path covers several changes at once.

Bulk archiving is not a loop of `openspec archive`. OpenSpec's bulk workflow prompts for a multi-select, validates every change, reads each delta spec, detects capabilities touched by more than one change, resolves those conflicts against the code, syncs the main specs, and only then archives in order. That is agent-driven work, which is why the command exists: `/opsx-bulk-archive`.

The panel already knows the repository it lists and follows the focused terminal (`location()`, 34). When the panel itself takes the keyboard, `lastTerminal` keeps the last terminal location so the list does not jump repositories. The same problem applies to the selected agent: clicking the panel moves focus off the agent, but the person's choice must survive long enough to press the button. Herdr exposes the selected agent as `focused().agent` — "the agent an agent block shows" (herdr.d.ts 230) — and herdr-core can type into any terminal with `hc send <address> <text>`.

## Goals / Non-Goals

**Goals:**

- One press starts `/opsx-bulk-archive` in Herdr's currently selected LLM, in the panel's repository.
- Never send the command into an agent working in another repository: a wrong-folder bulk archive would sync and move the wrong changes.
- Fall back predictably when there is no selected agent, no installed agent, or the send fails, without leaving a dead button or a lost command.
- Leave the single-change archive button, confirmation, spinner and failure dialog unchanged.

**Non-Goals:**

- Choosing the changes in the panel. The bulk command's own multi-select and confirmation are the gate.
- Running, watching or reporting the archive from the panel. The list's folder watch (local) and 15-second poll (remote) already reflect the result.
- Adding a multi-select UI, changing the existing "Archive using AI" hand-off, or choosing an LLM program from a menu.
- Waiting for the agent to finish, or representing its progress in the panel.

## Decisions

### D1. The selected LLM is `focused().agent`, with a remembered fallback

`focused().agent` is Herdr's selected agent — the one the agent block shows and `agent.next` / `agent.prev` move. It is the freshest source, and it is readable while the panel renders.

A click on the panel focuses a mod pane, so the panel also remembers the last selected agent it saw, exactly as `location()` already remembers `lastTerminal` (32-52). The memory is `{ address, cwd, on, space }`, updated whenever the panel reads a real agent focus (`focused().agent`, or the focused terminal's entry in `agents()`). At press time the order is:

1. `focused().agent`, when present;
2. the remembered `lastAgent`, when the panel has just taken focus;
3. nothing — use the new-tab path.

Using `agents().find((a) => a.focused)` alone is not enough: while the panel holds the keyboard no agent is focused, and the last focused agent is not necessarily the selected one.

### D2. Send into the selected agent's terminal with `herdr-core send`

The command is typed into the selected agent's live terminal:

```js
exec("herdr-core", ["send", localAddress, "/opsx-bulk-archive"], { on: machine })
```

`hc send` pastes the text and presses Enter, the same keystrokes a person makes. It targets an address, so it works while the panel holds the keyboard; `terminal.paste` would only reach a focused terminal, and `run("tab.new", …)` would start a new session rather than run in the selected one. Local calls can use the `hc([...])` helper; the `exec` form above keeps one code path and mirrors the remote write already in `writeFlip()` (1283).

Selected-agent addresses are machine-prefixed on remote spaces (`machine/t7`). Split on the first `/`: the prefix is the machine, the rest the address herdr-core knows there. No slash means this computer (`on: null`). The send resolves when the text is entered, not when the agent finishes; the button must not imply the archive is done.

### D3. The repository guard decides between "send" and "new tab"

The bulk command archives the changes in the agent's current folder. Sending it into an agent working in another repository would validate, sync and archive that repository's changes — the destructive wrong answer. The panel therefore resolves the selected agent's live folder:

1. `agents().find((a) => a.address === address)`, then `panes().find((p) => p.pane === a.pane)?.cwd`;
2. the remembered `lastAgent.cwd`, captured from `focused().cwd` while that agent was focused;
3. otherwise unknown.

It sends only when the folder is the panel's `root` or inside it (`folder === root || folder.startsWith(root + "/")`) and the machines match (`this.on` against the address prefix / the agent's space machine). A folder it cannot read counts as a mismatch. A mismatch takes the new-tab path in D4 instead of sending.

Passing the repository path in the message was considered and rejected: the command's arguments are not a reliable place for a path, and the agent's working directory would still be wrong. A new tab in the right folder is unambiguous.

### D4. Fallbacks, in order

1. **Send** — selected agent, repository guard passes (D2/D3). Toast "Bulk archive sent — <agent>".
2. **New tab** — no selected agent, a repository mismatch, or a failed send. Resolve the selected agent's program through `agents()` (`program.key`) and `knownAgents({ on: this.on })`, falling back to the first `installed` entry, then:
   ```js
   run("tab.new", { space: activeSpace, folder: root, argv: agent.run, task: "/opsx-bulk-archive" })
   ```
   This is the existing `archiveWithAI()` shape (1474), with the selected program when it can be resolved. Toast "Bulk archive opened — <agent>".
3. **Clipboard** — `knownAgents` is empty or rejects, or `tab.new` throws: `cx.write_to_clipboard("/opsx-bulk-archive")` plus "Copied — paste it into your agent". The same wrapping as `archiveWithAI()` (1469-1487) applies: a throwing host call must still land on the clipboard, and a final toast reports the failure if even that is unavailable.

`knownAgents` is called on the panel's machine (`this.on`) because the new tab opens in the panel's space and folder; the selected program's key is matched there, and a program not installed there falls back to the first installed one.

### D5. A toolbar button, one press, no second confirmation

The button sits in the toolbar row beside the filter and sort controls (`render()`, 1674-1691): 24 px high, `px(8)`, rounded 7, a 1 px border, 11 px text, the archive box SVG at 13 px, `flex_none`, id `openspec-bulk-archive`. It reads **Bulk archive**; the panel can be narrow, so the label may truncate but the icon and tooltip remain.

It is shown only while `this.root` is resolved and `this.changes` holds at least one active change; it is hidden while loading, stale or empty. While `bulkBusy` it swaps the icon for the existing spinner SVG (the row spinner pattern at 1401) and ignores presses.

There is no second-click confirmation. The bulk workflow itself prompts for the changes and a final confirmation before anything is archived; the panel's click only sends the command. A mis-click is visible in the agent and can be cancelled there. The single-change archive keeps its two-click chip untouched.

### D6. One hand-off at a time, and no archive state on the panel

`this.bulkBusy` starts `false` in `init`. `bulkArchive(cx)` returns immediately when it is set, sets it, and clears it in a `finally` with `cx.notify()`. It does not touch `this.busy`, the single-archive spinner, or the row archive buttons: those describe a command the panel itself runs, and bulk is only a hand-off. The list updates through the existing folder watch and 15-second poll.

Toasts are the only panel-side report: sent, opened, copied, or "Could not hand off the bulk archive" with the clipboard fallback already tried. No toast claims the archive completed.

### D7. The command is exactly `/opsx-bulk-archive`

No change names, filter or selection are appended. The command's first step is to prompt for the changes and it is explicitly forbidden from auto-selecting; the panel has no multi-select to express a choice. Appending names would skip the command's own selection and could archive without its intended confirmation. The person answers the prompt in the agent.

## Risks / Trade-offs

- **`focused().agent` can be null** when nothing has been selected in this window → the remembered `lastAgent` covers the click-on-panel case, and a genuinely empty selection takes the new-tab path. The fallback is a new tab, not a failure.
- **The selected agent's folder can be unreadable** (remote pane not in `panes()`, a layout terminal block) → treated as a mismatch and the new tab starts the same program in the panel's repository. Context is lost, correctness is kept.
- **`herdr-core send` can fail** (terminal gone, remote core unreachable) → caught, then the new-tab path, then the clipboard. No archive command has run in the panel.
- **Sending while the agent is working** queues the message; that is how its chat behaves, but the toast says "sent", not "done". If the agent is in an approval prompt, the text may land somewhere unexpected; the person can see it and cancel. Documented in README limits.
- **The slash command is agent-specific.** The existing hand-off uses `/opsx-archive`, so `/opsx-bulk-archive` is the parallel contract. An agent without the command answers with an error; the clipboard path remains.
- **Two panels for different repositories share one selected agent.** The guard lets only the panel whose root matches send; the other opens a new tab. This is the intended safety property.
- **Path comparison is textual.** A symlinked or differently mounted copy of the same repository does not match and takes the new-tab path — safe, if slightly less convenient.
- **`knownAgents` caches installed checks for up to a minute**, so a just-installed agent can be missing; the clipboard fallback covers it.

## Migration Plan

No data, schema or CLI change. The button ships with the mod; sync the app snapshot (`rm -rf ~/.config/herdr-app/mods/openspec && cp -R mods/openspec ~/.config/herdr-app/mods/`) and reload the panel. Rollback is the previous mod folder; nothing is persisted.

## Open Questions

- Should the existing "Archive using AI" hand-off also prefer the selected agent over the first installed one? Out of scope here; a natural follow-up once the selection helper exists.
- Should the button hide when no change is complete? No: the workflow warns about incomplete changes and lets the person choose, and a bulk archive of one change is valid.
