// OpenSpec panel for the Herdr desktop app: the active space's OpenSpec
// changes, like `openspec list`, but always current. Watches openspec/changes/
// so a ticked task or a new change shows up at once (local spaces only; remote
// spaces fall back to a 15-second poll). Click a change to fold out its task
// list from tasks.md; click a task to tick or untick it in the file itself
// (on this machine or the pane's remote one); right-click it for a small menu
// (Copy name; View change opens the whole change beside the work — proposal,
// design, tasks and specs, one tab each — drawn in Tokyo Night, the owner's
// Obsidian theme, by the mod's own markdown renderer, since the TextView
// component styles itself from the app theme and reads flat; the tasks tab
// ticks checkboxes in tasks.md); the box button archives it (openspec archive
// --yes).
//
// Lives at ~/.config/herdr-app/mods/openspec/.
// https://github.com/AshMcConnell/herdr-openspec — MIT license.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, Tabs, Tab } from "gpui-base";
import { agents, spaces, panes, focused, exec, readTextFile, writeTextFile, watchFolder, theme, props, openOverlay, closeOverlay, notify, run, settings, shared, setShared, knownAgents, nextCommand } from "herdr";

// Where we are: a `folder` prop if the layout or pane.split gave one, else the
// focused pane's (or focused layout terminal block's) live folder, else the
// last folder a terminal gave us in this space, else any pane with one in the
// active space (any tab — this mod's own pane has none), else the space's.
// `on` is the machine that folder lives on (null: this one).
//
// Clicking the panel, a viewer or the floating window focuses a mod pane or an
// overlay, which has no folder. That must not send the list to whichever other
// tab happens to be first: `lastTerminal` keeps the terminal location the list
// was following. It is keyed by active space so a real space switch still
// resolves afresh.
let lastTerminal = null; // { cwd, on, space }

// The agent the person had selected, remembered the same way: clicking the
// panel moves keyboard focus to a mod pane, where focused().agent reads
// empty, so the Bulk archive press would otherwise lose the choice. Written
// only from a real terminal focus (see location()), keyed by active space
// like lastTerminal so a real space switch resolves afresh.
let lastAgent = null; // { address, cwd, on, space }

function location() {
  const pinned = typeof props()?.folder === "string" ? props().folder : null;
  const space = spaces().find((s) => s.active), f = focused();
  const all = panes(), tabs = new Set((space?.tabs ?? []).map((c) => c.id));
  const pane = f?.pane ? all.find((p) => p.pane === f.pane && p.cwd) : null;
  const cwd = pane?.cwd || f?.cwd || null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  // Remember the selected agent only while a real terminal holds the focus: a
  // mod-pane focus has no terminal, and its f.cwd is this panel's folder, not
  // the agent's — it must not overwrite either field.
  const term = f?.terminal;
  if (term && agents().some((a) => a.address === term)) lastAgent = { address: term, cwd: f.cwd ?? null, on, space: space?.id ?? null };
  // Focus is the mod's own surface (no folder): keep following the terminal
  // the list was reading, as long as we are still in the same space.
  if (!pinned && !cwd && lastTerminal && lastTerminal.space === space?.id) {
    return { cwd: lastTerminal.cwd, on: lastTerminal.on };
  }
  const any = all.find((p) => tabs.has(p.tab) && p.cwd);
  const next = { cwd: pinned || cwd || any?.cwd || space?.folder || null, on };
  // Remember only a folder that came from a real terminal focus, never the
  // any-pane guess, so the next mod-pane click keeps this exact repository.
  if (cwd && space?.id) lastTerminal = { cwd, on, space: space.id };
  return next;
}
const key = () => JSON.stringify(location());

// The agent the person has selected: Herdr's focused().agent — the agent an
// agent block shows — else the last agent a real terminal focus showed this
// panel (lastAgent, above), because the click that reaches the button moves
// the keyboard onto the panel first. Null when neither names an agent.
// focused().agent can name an agent missing from agents() (a layout terminal
// block): keep its address, and use the remembered folder only when it is the
// same agent. Its live folder is read from its pane; a remote address's
// machine prefix (`machine/t7`) splits off, so no slash means this computer.
function selectedAgent() {
  const address = focused()?.agent || lastAgent?.address || null;
  if (!address) return null;
  const slash = address.indexOf("/");
  const found = agents().find((a) => a.address === address);
  const cwd = (found ? panes().find((p) => p.pane === found.pane)?.cwd ?? null : null)
    ?? (lastAgent?.address === address ? lastAgent.cwd ?? null : null);
  return {
    address,
    local: slash > -1 ? address.slice(slash + 1) : address,
    machine: slash > -1 ? address.slice(0, slash) : null,
    cwd,
    programKey: found?.program?.key ?? null,
    name: found?.program?.name ?? "the selected agent",
  };
}

// Whether the selected agent works in the panel's repository: the bulk
// command archives the agent's working folder, so sending it to an agent in
// another repository would sync and move the wrong changes. One trailing
// slash is normalized; a folder we cannot read counts as a mismatch.
function sameRepo(selected, root, on) {
  const folder = typeof selected?.cwd === "string" ? selected.cwd.replace(/\/$/, "") : "";
  const base = typeof root === "string" ? root.replace(/\/$/, "") : "";
  if (!folder || !base) return false;
  return (folder === base || folder.startsWith(`${base}/`)) && (selected.machine ?? null) === (on ?? null);
}

// ---- Viewer switching -----------------------------------------------------
//
// A viewer pane's change lives in its own props, so it cannot be reopened on
// another change without a new pane. The panel and the open viewers therefore
// talk through Herdr's shared values: each viewer registers itself, the panel
// addresses a retarget request to one id, and the viewer's `view` command is
// the cue to look — rendering must not have side effects. The panel names the
// list copy that should wait for the acknowledgement (`open`), because the
// row menu is a popup whose cx ends when it closes.
const VIEWERS = "openspec.viewers"; // { [id]: { at, file, root, on } }
const VIEWS = "openspec.views";     // { [id]: { [seq]: { id, seq, file, change, on } } }
const ACK = "openspec.view.ack";    // { [seq]: id }
const QUIET = "openspec.view.quiet";// { [id]: ms } a viewer that did not answer
const OPENS = "openspec.opens";     // { [panel]: { panel, name, root, on, seq, at } }
const HANDOFF = "openspec.handoff"; // { [panel]: { panel, command, kind, sent, opened, failed, root, on, space, seq, at } }
const FAILED = "openspec.archive-failed"; // { [panel]: { panel, name, detail, root, on, space, seq, at } }
const DIALOG = "openspec.archive-dialog"; // the newest failure dialog's overlay id
const VIEW_ACK_MS = 700;
const VIEW_QUIET_MS = 15000;
const OPEN_AGE_MS = 60000;
const VIEWER_AGE_MS = 7 * 86400000;
const VIEWER_CAP = 40;

const mapOf = (key) => {
  const value = shared(key);
  return value && typeof value === "object" ? value : {};
};

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// <repository>/openspec/changes/<name>/ -> <repository>. Null when the path
// is not a change directory (a hand-written pane prop, say).
const repoOf = (dir) => {
  const i = (dir || "").indexOf("/openspec/changes/");
  return i > 0 ? dir.slice(0, i) : null;
};

// The registry, pruned of entries too old to still be a live copy and capped
// so it cannot grow forever. `at` is the launch time, in ms.
function pruneViewers(all = shared(VIEWERS)) {
  const now = Date.now();
  const map = all && typeof all === "object" ? all : {};
  return Object.fromEntries(Object.entries(map)
    .filter(([, v]) => v && typeof v.at === "number" && now - v.at < VIEWER_AGE_MS)
    .sort((a, b) => a[1].at - b[1].at)
    .slice(-VIEWER_CAP));
}

// Add or update one viewer. The registry is re-read and pruned immediately
// before every write, so a close and a register that overlap lose at most an
// entry the ack fallback can do without.
function saveViewer(id, patch) {
  const all = pruneViewers();
  setShared(VIEWERS, { ...all, [id]: { at: Date.now(), ...all[id], ...patch } });
}

function forgetViewer(id) {
  const all = pruneViewers();
  if (!(id in all)) return;
  const next = { ...all };
  delete next[id];
  setShared(VIEWERS, next);
}

// A viewer that did not answer a request is skipped for a short cooldown
// rather than deleted: the copy may be alive in a hidden tab, where the view
// command cannot reach it. Clearing the mark when it answers makes it a
// candidate again at once.
function quietMap() {
  const now = Date.now(), map = mapOf(QUIET);
  return Object.fromEntries(Object.entries(map)
    .filter(([, at]) => typeof at === "number" && now - at < VIEWER_AGE_MS)
    .sort((a, b) => a[1] - b[1])
    .slice(-VIEWER_CAP));
}

const isQuiet = (id) => {
  const at = quietMap()[id];
  return typeof at === "number" && Date.now() - at < VIEW_QUIET_MS;
};

function markQuiet(id) {
  setShared(QUIET, { ...quietMap(), [id]: Date.now() });
}

function clearQuiet(id) {
  const all = quietMap();
  if (!(id in all)) return;
  const next = { ...all };
  delete next[id];
  setShared(QUIET, next);
}

// Open viewers for this repository and machine, newest first, leaving out a
// copy that recently failed to answer. A panel with no resolved root matches
// nothing.
const matchingViewers = (root, on) => root ? Object.entries(pruneViewers())
  .filter(([id, v]) => !isQuiet(id) && v.root === root && (v.on ?? null) === (on ?? null))
  .sort((a, b) => b[1].at - a[1].at) : [];

// One acknowledgement per request token, kept short: two panels can have
// requests in flight at once, and one key per token keeps them apart.
function acknowledge(seq, id) {
  const next = { ...mapOf(ACK), [seq]: id };
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - 20))) delete next[k];
  setShared(ACK, next);
}

const acknowledged = (seq, id) => mapOf(ACK)[seq] === id;

// The viewer request map, swept of ids that no longer have a live viewer, so
// a reload, a crash, or a late request to a closed copy cannot leave a slot
// behind in the persisted store.
function liveViews() {
  const live = new Set(Object.keys(pruneViewers()));
  return Object.fromEntries(Object.entries(mapOf(VIEWS)).filter(([id]) => live.has(id)));
}

// Take one request back when its acknowledgement window closes, so a copy
// that wakes late cannot switch after the panel has moved on or opened a pane.
function withdrawView(id, seq) {
  const all = mapOf(VIEWS), queue = all[id];
  if (!queue || typeof queue !== "object" || !(seq in queue)) return;
  const left = { ...queue };
  delete left[seq];
  const next = { ...all };
  if (Object.keys(left).length) next[id] = left;
  else delete next[id];
  setShared(VIEWS, next);
}

// Menu requests older than a minute are dead: the popup that wrote them is
// long gone. Keeping the map bounded stops a crash from leaving it forever.
function openRequests() {
  const now = Date.now();
  return Object.fromEntries(Object.entries(mapOf(OPENS))
    .filter(([, r]) => r && typeof r.at === "number" && now - r.at < OPEN_AGE_MS)
    .sort((a, b) => a[1].at - b[1].at)
    .slice(-VIEWER_CAP));
}

// Hand-off requests older than a minute are dead: the popup that wrote them is
// long gone. Swept on every read, like openRequests, so a crash cannot leave
// the map growing forever.
function openHandoffs() {
  const now = Date.now();
  return Object.fromEntries(Object.entries(mapOf(HANDOFF))
    .filter(([, r]) => r && typeof r.at === "number" && now - r.at < OPEN_AGE_MS)
    .sort((a, b) => a[1].at - b[1].at)
    .slice(-VIEWER_CAP));
}

// A popup cannot run a hand-off: its cx ends when it closes. It records the
// request — command, toast titles, repository, machine, space and a fresh
// sequence — in Herdr's shared values and wakes the panel copy that opened it
// by name. `at` carries the panel's root/on/space/panel captured at open time,
// so the hand-off survives the panel switching folders.
function queueHandoff(at, { command, kind, sent, opened, failed }) {
  const panel = at?.panel ?? null;
  if (!panel) return; // a popup is only ever opened by a panel copy; nothing to wake
  setShared(HANDOFF, { ...openHandoffs(), [panel]: {
    panel, command, kind, sent, opened, failed,
    root: at.root ?? null, on: at.on ?? null, space: at.space ?? null,
    seq: uid(), at: Date.now(),
  } });
  run("openspec.command");
}

// Failure offers older than a minute are dead: the toast that could replay them
// has gone. Swept on every write, like openRequests.
function failedOffers() {
  const now = Date.now();
  return Object.fromEntries(Object.entries(mapOf(FAILED))
    .filter(([, r]) => r && typeof r.at === "number" && now - r.at < OPEN_AGE_MS)
    .sort((a, b) => a[1].at - b[1].at)
    .slice(-VIEWER_CAP));
}

// Drop one panel copy's offer, but only while the stored record is still the
// one this dialog was opened for: a newer failure's record must survive. The
// write goes through the age-swept map, so an offer that outlived its minute
// is swept out of the persisted store too, not just hidden from readers.
function forgetFailed(panel, seq) {
  const r = mapOf(FAILED)[panel];
  if (!r || r.seq !== seq) return;
  const next = failedOffers();
  delete next[panel];
  setShared(FAILED, next);
}

// One failure dialog at a time: close the one already shown (a newer failure
// or the toast action replaces it), then open this offer. DIALOG is cleared
// before the old overlay closes, so the replaced copy's close() insurance no
// longer sees itself as the live dialog and cannot drop the record out from
// under the dialog about to open — the toast action re-opens the same offer,
// seq included, in a fresh copy.
function openFailureDialog(offer) {
  const current = shared(DIALOG);
  if (typeof current === "string" && current) {
    setShared(DIALOG, null);
    closeOverlay(current);
  }
  setShared(DIALOG, openOverlay({ mod: "openspec", props: { archiveFailed: offer }, kind: "dialog", modal: true, width: 420 }));
}

const ago = (at) => {
  if (!at) return "";
  const d = Math.max(0, Date.now() - at);
  return d < 60000 ? "just now" : d < 3600000 ? `${Math.max(1, Math.round(d / 60000))}m ago`
    : d < 86400000 ? `${Math.round(d / 3600000)}h ago` : d < 86400000 * 60 ? `${Math.round(d / 86400000)}d ago`
    : `${Math.round(d / (86400000 * 30))}mo ago`;
};

// tasks.md -> flat rows: {section} headings and {done, line, text, full}
// checkbox rows. An indented continuation line folds into the task above it,
// joined with a space — the same fold the markdown renderer gives a wrapped
// list item — so `text` is the checkbox line's own text, the one a toggle
// matches on, and `full` is the whole entry, the one every view shows. Each
// checkbox remembers its line in the file — the click that ticks it rewrites
// exactly that line.
function taskRows(text) {
  const rows = [];
  let cur = null;
  (text ?? "").split("\n").forEach((line, i) => {
    const head = /^#{1,6}\s+(.+)/.exec(line);
    if (head) { rows.push({ section: head[1].trim() }); cur = null; return; }
    const box = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)/.exec(line);
    if (box) {
      cur = { done: box[1].toLowerCase() === "x", line: i, text: box[2].trim() };
      cur.full = cur.text;
      rows.push(cur);
      return;
    }
    const cont = /^ {2,}(\S.*)/.exec(line);
    if (cont && cur) {
      const piece = cont[1].trim();
      cur.full = cur.full ? `${cur.full} ${piece}` : piece;
      return;
    }
    cur = null;
  });
  return rows;
}

// tasks.md with one checkbox flipped: the mark on that line becomes `to`
// ("x" when ticking, " " when not), every other byte identical — CRLF
// endings included (`[\s\S]` keeps the line's trailing `\r`). Null when
// the line no longer holds that task — the file changed shape under us.
function toggled(text, line, task, to) {
  const lines = text.split("\n"), box = /^(\s*[-*]\s+\[)( |x|X)(\]\s+)([\s\S]*)/.exec(lines[line]);
  if (!box || box[4].trim() !== task) return null;
  lines[line] = `${box[1]}${to ? "x" : " "}${box[3]}${box[4]}`;
  return lines.join("\n");
}

// tasks.md with every open checkbox ticked at once: a space mark becomes
// `x`, while an `[x]`/`[X]` and every other line stay byte-for-byte — the
// `[\s\S]` tail keeps a CRLF line's trailing `\r`. Never null: there is no
// per-line identity to check here, so the whole-file compare-and-swap (or the
// remote edit's pre-checked pairs) is what proves the file still holds these
// lines.
function markedAll(text) {
  const mark = /^(\s*[-*]\s+\[)( |x|X)(\][\s\S]*)$/;
  return text.split("\n").map((line) => {
    const box = mark.exec(line);
    return box && box[2] === " " ? `${box[1]}x${box[3]}` : line;
  }).join("\n");
}

// How many times `needle` appears in `text`, counted literally — split/join,
// never a regex, because task text can hold regex characters.
function occurs(text, needle) {
  return needle ? text.split(needle).length - 1 : 0;
}

// The exact old/new text a remote edit swaps: that line's bytes in `body` and
// in `next` (the toggled text) — one line, nothing added, trailing `\r` kept —
// so the whole edit travels as a pair of single-line argv values and needs no
// neighbouring context. Refuse (throw) when that line is not unique in the
// file: `--old` would be ambiguous, and the CLI's own all-or-none guard backs
// the refusal up. A pair that changes nothing comes back as-is for writeFlip
// to accept without an edit. Null when the two lines differ beyond the
// checkbox.
function flipPair(body, line, next) {
  const before = body.split("\n"), after = next.split("\n");
  if (typeof before[line] !== "string" || typeof after[line] !== "string") return null;
  const mark = /^(\s*[-*]\s+\[)[ xX](\][\s\S]*)$/, b = mark.exec(before[line]), a = mark.exec(after[line]);
  if (!b || !a || b[1] !== a[1] || b[2] !== a[2]) return null;
  const old = before[line], neu = after[line];
  if (old === neu) return { old, neu };
  if (occurs(body, old) !== 1) throw "the task's line is not unique in tasks.md";
  return { old, neu };
}

// The pairs one remote mark-all edit carries: every line `next` ticked, as
// its exact bytes in `body` and its ticked bytes — one line each, trailing
// `\r` kept, so no pair needs neighbouring context. `markedAll` builds `next`,
// so a pair that differs beyond the mark cannot happen; the assert throws
// rather than shipping it. Each old line must appear exactly once in the file
// (`--old` is ambiguous otherwise) — checked here, before anything is written,
// so the CLI's all-or-none is the backstop, not the first line of defence.
function flipPairs(body, next) {
  const mark = /^(\s*[-*]\s+\[)( |x|X)(\][\s\S]*)$/;
  const before = body.split("\n"), after = next.split("\n");
  if (before.length !== after.length) throw "the tasks changed under the click";
  const pairs = [];
  for (let i = 0; i < before.length; i++) {
    if (before[i] === after[i]) continue;
    const b = mark.exec(before[i]), a = mark.exec(after[i]);
    if (!b || !a || b[1] !== a[1] || b[3] !== a[3] || b[2] !== " " || a[2].toLowerCase() !== "x") throw "the tasks changed under the click";
    if (occurs(body, before[i]) !== 1) throw "the task's line is not unique in tasks.md";
    pairs.push({ old: before[i], neu: after[i], line: i });
  }
  return pairs;
}

// A failed command's detail for a toast. The last non-empty stderr line wins
// (a stdout tail must not shadow the error), then stdout's, then "exit N";
// herdr-core reports a usage error as a JSON object on one line, so that
// becomes "herdr-core: message (hint)" and the real fault reads. Anything
// else is reported as the line itself, truncated to 300 chars — the archive
// button's shape.
function exitDetail(r) {
  const lastLine = (text) => `${text ?? ""}`.split("\n").filter((l) => l.trim()).pop();
  const last = lastLine(r.stderr) ?? lastLine(r.stdout) ?? `exit ${r.code}`;
  try {
    const err = JSON.parse(last)?.error;
    if (err && typeof err.message === "string") return `herdr-core: ${err.message}${err.hint ? ` (${err.hint})` : ""}`.slice(0, 300);
  } catch { /* not JSON: report the line itself */ }
  return last.slice(0, 300);
}

// The same shape for a thrown value — `exec` rejecting (machine gone, spawn
// failed) rather than exiting non-zero: the thrown text's last non-empty
// line, never empty, at most 300 characters, so the toast body keeps the
// spec's guarantee whatever the rejection carried.
function thrownDetail(e) {
  const last = `${e ?? ""}`.split("\n").filter((l) => l.trim()).pop();
  return (last ?? "the archive command could not run").slice(0, 300);
}

// The archive button sits on every row (completed ones a touch brighter);
// hidden while another archive is running.
const showArchive = (c, self) => !self.busy || self.busy === c.key;

// The row's right-click menu: what each item does with the change's name.
// More items append here; the popup renders them in order. Items take
// (name, cx, at) where `at` is { root, on, panel }: the repository root and
// machine the panel had resolved when the menu opened (null when it found
// none), and the panel copy that can act on the request after this popup's
// own cx has gone.
// One command item: the label, the command it hands off (nothing else is
// appended but the change's name), and a visibility predicate over the
// status read (`{ complete, tasks, specs }` booleans; absent when the read
// failed). Its `run` only queues the request — the popup cannot run it.
const commandMenu = (label, command, when) => ({
  label, command, when,
  run: (name, _cx, at) => queueHandoff(at, {
    command: `${command} ${name}`, kind: "command",
    sent: "Command sent", opened: "Command opened", failed: "Could not hand off the command",
  }),
});

const MENU = [
  { label: "Copy name", run: (name, cx) => {
    cx.write_to_clipboard(name);
    notify({ title: "Name copied", body: name, level: "success" });
  } },
  { label: "View change", run: (name, _cx, at) => {
    if (!at?.root) { notify({ title: "No repository yet", body: "The panel is still finding this folder", level: "error" }); return; }
    const file = `${at.root}/openspec/changes/${name}/proposal.md`;
    // The list copy owns the acknowledgement wait (this popup stops when it
    // closes), so it opens the pane or switches the viewer instead.
    if (!at.panel) {
      run("pane.split", { direction: "right", mod: "openspec",
        props: { file, change: name, on: at.on ?? null } });
      return;
    }
    setShared(OPENS, { ...openRequests(), [at.panel]: { panel: at.panel, name, root: at.root, on: at.on ?? null, seq: uid(), at: Date.now() } });
    run("openspec.open");
  } },
  { divider: true },
  commandMenu("Continue", "/opsx-continue", (s) => !s.complete),
  commandMenu("Apply", "/opsx-apply", (s, entry) => s.tasks && Boolean(entry) && entry.total > 0 && entry.done < entry.total),
  commandMenu("Verify", "/opsx-verify", (s) => s.tasks),
  commandMenu("Sync specs", "/opsx-sync", (s) => s.specs),
  commandMenu("Archive using AI", "/opsx-archive", null),
];

// The visible items for one row's popup, as plain data (`{ i, label }` into
// MENU, or `{ div: true }`), plus the popup height. A failed status read
// (`status` null) shows the full static set. The divider is only placed when
// the command group has something in it: Archive using AI is always shown, so
// it always does. The height matches the p(5) padding plus 31 px a row and 9
// px for the divider.
function rowMenuItems(status, entry) {
  const shown = (it) => !it.when || status === null || it.when(status, entry);
  const items = [];
  let height = 10;
  const commands = MENU.some((it) => it.command && shown(it));
  MENU.forEach((it, i) => {
    if (it.divider) {
      if (!commands) return;
      items.push({ div: true });
      height += 9;
      return;
    }
    if (!shown(it)) return;
    items.push({ i, label: it.label });
    height += 31;
  });
  return { items, height };
}

// Sort modes the header button cycles through. "recent" keeps openspec list's
// own order (last modified first); "done" floats the closest-to-finished up;
// "state" groups the list under ✓ Complete / Nearly done / In progress /
// Unstarted / No tasks headers. "nearly" = at most 2 tasks left.
const SORTS = [
  { id: "recent", label: "recent" },
  { id: "name", label: "A–Z" },
  { id: "done", label: "% done" },
  { id: "state", label: "state" },
];

// The bulk-archive command handed to the selected agent (or a new tab, or the
// clipboard): one constant for all three paths, so they cannot drift. Nothing
// is appended to it — the command prompts for the changes itself.
const BULK = "/opsx-bulk-archive";

// The repo-level commands the toolbar's Commands menu offers: commands that
// need no change name. This table is the extension point — append here and the
// popup renders the new item in order. Each run queues the bare command (no
// name appended) through the same shared hand-off as the row menu; it takes
// the command from the entry itself, so editing the table is enough.
const repoCommand = (label, command) => ({
  label, command,
  run: (_name, _cx, at) => queueHandoff(at, {
    command, kind: "command",
    sent: "Command sent", opened: "Command opened", failed: "Could not hand off the command",
  }),
});

const COMMANDS = [
  repoCommand("New change", "/opsx-propose"),
];

const STATES = [
  { id: "complete", label: "✓ Complete", chip: "✓ complete", color: "ansi10" },
  { id: "nearly", label: "Nearly done", chip: null, color: "accent" },
  { id: "progress", label: "In progress", chip: null, color: "muted" },
  { id: "unstarted", label: "Unstarted", chip: "unstarted", color: "muted" },
  { id: "draft", label: "No tasks", chip: "no tasks", color: "dim" },
];

// Tokyo Night (dark) — the owner's Obsidian theme, as constants (the mod must
// not read a vault's CSS or depend on Obsidian paths). The change viewer only;
// the change list keeps the app theme.
const NIGHT = {
  bg: "#1a1b26",    // --background-primary
  bgAlt: "#16161e", // --background-secondary (tab bar/footer chrome)
  border: "#292e42",// --background-modifier-border
  fg: "#c0caf5",    // --text-normal
  muted: "#a9b1d6", // --text-muted (unselected tabs)
  faint: "#565f89", // --text-faint (footer path, loading/absent/empty states)
  error: "#db4b4b", // --text-error (read failure)
  accent: "#bb9af7", // --magenta (the selected tab's underline)
};

// The markdown decorations, beside NIGHT's chrome colours — each entry mapped
// from the rule that styles it in the owner's Tokyo Night theme.css (dark
// block; the theme's own base vars --red/--yellow/--green/--cyan/--blue/
// --magenta are rgb(255,117,127)/rgb(224,175,104)/rgb(158,206,106)/
// rgb(125,207,255)/rgb(122,162,247)/rgb(187,154,247)). Where the theme leaves
// a variable unset it falls through to Obsidian's default, noted per line.
const NIGHT_MD = {
  h: ["#ff757f", "#e0af68", "#9ece6a", "#7dcfff", "#7aa2f7", "#bb9af7"],
    // --h1-color..--h6-color: var(--red)/--yellow/--green/--cyan/--blue/--magenta
  bold: "#7dcfff",    // --bold-color: var(--cyan)
  italic: "#7dcfff",  // --italic-color: var(--cyan)
  link: "#bb9af7",    // --link-color and --link-external-color: var(--magenta)
  linkHover: "#7dcfff", // --link-color-hover/--link-external-color-hover: var(--cyan)
  codeBg: "#242838",  // --code-background: var(--bg_highlight_dark) (inline and fenced share it)
  codeFg: "#c0caf5",  // --code-normal: var(--fg)
  quoteBar: "#80d0ff",// the owner's Tokyo Night theme accent (hsl(202,100%,75%))
  quoteBg: "#16161e", // --blockquote-background-color: var(--bg_dark)
  hr: "#292e42",      // Obsidian's default --hr-color: var(--background-modifier-border)
  marker: "#565f89",  // Obsidian's default --list-marker-color: var(--text-faint)
  done: "#9ece6a",    // --checkbox-color: var(--green) (a checked task box)
};

// One artifact's read state: `text` is undefined while the first read is in
// flight, null when the file is absent, a string once read; `error` is the
// failure's text when the read throws.
const blankDoc = () => ({ text: undefined, error: null });

function stateOf(c) {
  if (c.total > 0 && c.done >= c.total) return "complete";
  if (c.total === 0) return "draft";
  if (c.done === 0) return "unstarted";
  if (c.total - c.done <= 2) return "nearly";
  return "progress";
}

// The green a complete change wears. The theme's `done` token is an agent
// status colour (blue in graphite), not a success colour; the ANSI bright
// green is the conventional green in every theme, with the normal ANSI green
// and a fixed green as fallbacks.
const green = (t) => t.ansi10 || t.ansi2 || "#3fae6a";

// One section's rows in the chosen sort. openspec's order is already
// recent-first; "state" sorts by the order of STATES, keeping it inside each
// group (the section renderer draws the group headers).
function sortedRows(rows, sort) {
  if (sort === "name") return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "done") return [...rows].sort((a, b) =>
    (b.total ? b.done / b.total : -1) - (a.total ? a.done / a.total : -1) || b.total - a.total);
  if (sort === "state") return [...rows].sort((a, b) =>
    STATES.findIndex((s) => s.id === stateOf(a)) - STATES.findIndex((s) => s.id === stateOf(b)));
  return rows;
}

// Which copy of a same-named change the list keeps: the most complete copy
// first (it carries the work), then the most tasks done, then the freshest
// listing, then the larger task list. Progress before time because checking
// out a worktree stamps every file with a new mtime, so a stale copy could
// otherwise win on time alone.
function fresher(a, b) {
  const ratio = (c) => (c.total ? c.done / c.total : -1);
  const at = (c) => (typeof c.at === "number" ? c.at : -Infinity);
  if (ratio(a) !== ratio(b)) return ratio(a) > ratio(b);
  if (a.done !== b.done) return a.done > b.done;
  if (at(a) !== at(b)) return at(a) > at(b);
  return a.total > b.total;
}

// Keep one row per change name across the sections (design D4): the winner
// stays in its own worktree's section and every other copy is dropped, so a
// merged or stale duplicate is never rendered, counted or acted on.
function dedupeSections(sections) {
  const winners = new Map();
  for (const s of sections) for (const c of s.changes) {
    const kept = winners.get(c.name);
    if (!kept || fresher(c, kept)) winners.set(c.name, c);
  }
  for (const s of sections) s.changes = s.changes.filter((c) => winners.get(c.name) === c);
  return sections;
}

// The visible list per worktree section: the filter (name substring,
// case-insensitive) applied inside each section, sections left without a row
// dropped, then each remaining section sorted. A section carrying an error has
// no rows but stays — its header and message are its content. Section order
// never changes; only the rows inside a section sort.
function visibleSections(self) {
  const q = (self.filter || "").trim().toLowerCase();
  return (self.sections ?? []).map((s) => {
    const rows = q ? s.changes.filter((c) => c.name.toLowerCase().includes(q)) : s.changes;
    return { ...s, rows: sortedRows(rows, self.sort) };
  }).filter((s) => s.rows.length || s.error);
}

// The flat visible rows: the header count, the task chip and the
// "No changes match" check read every section's rows together.
function visible(self) {
  return visibleSections(self).flatMap((s) => s.rows);
}

// `git worktree list --porcelain` -> one entry per blank-line-separated block.
// The rest of a `worktree ` line is the path, verbatim: porcelain does not
// quote spaces. `prunable` (and `locked`) may carry a reason after the marker.
// OpenCode's own worktrees (~/.local/share/opencode/worktree/<hash>/<name>)
// are standard linked worktrees and appear here, as do sibling checkouts of
// the same repository.
function parseWorktrees(text) {
  const list = [];
  for (const block of `${text ?? ""}`.trim().split(/\r?\n\r?\n/)) {
    const wt = { path: null, branch: null, detached: false, bare: false, prunable: false };
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("worktree ")) wt.path = line.slice("worktree ".length);
      else if (line.startsWith("branch ")) wt.branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
      else if (line === "detached") wt.detached = true;
      else if (line === "bare") wt.bare = true;
      else if (line === "prunable" || line.startsWith("prunable ")) wt.prunable = true;
    }
    if (wt.path) list.push(wt);
  }
  return list;
}

// The section label: the branch, or the folder name for a detached HEAD.
function worktreeLabel(wt) {
  if (wt?.branch) return wt.branch;
  const at = `${wt?.path ?? ""}`.replace(/\/+$/, "");
  return `detached: ${at.split("/").filter(Boolean).pop() ?? at}`;
}

// A short stable id for a worktree root (FNV-1a, 32-bit hex). Two change rows
// with the same name in different worktrees must get distinct render ids — a
// duplicate id would share hover/focus state and make one row's click look
// like another's. Internal only: `key` (root + name) names the row in state.
function wtId(root) {
  const text = `${root ?? ""}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// ---- The markdown body renderer ------------------------------------------
//
// gpui-kit's TextView.markdown styles itself from the app theme, so beside
// this navy pane it drew app-charcoal headings, code and links — the pane
// read as "same dark pane as before". The mod therefore draws its own
// markdown out of plain elements, every one coloured from NIGHT/NIGHT_MD.
// Blocks: headings, fenced code, lists (one nesting level; deeper indents
// nest), blockquotes, rules, paragraphs (consecutive non-block lines merge,
// like markdown). Inline: `code`, **bold**, *italic*, _italic_ and
// [text](url). Anything else — tables, images, escapes — stays literal text:
// nothing is ever dropped.

// Block cap for a pathological file; change documents are a few KB.
const MAX_MD_BLOCKS = 2000;

// Heading text sizes on the 15px reading size, at roughly Obsidian's em
// proportions (1.8/1.5/1.34/1.2/1.1/1.0em): H1 at document scale — the pane's
// title takes MD_HEAD[0] too and grows with it. `mt` is the extra top margin
// for big headings (on top of the block gap) so they don't sit glued to the
// previous paragraph. Colours come from NIGHT_MD.h.
const MD_HEAD = [
  { size: 30, lh: "40px", mt: 14 }, { size: 22.5, lh: "30px", mt: 10 },
  { size: 19, lh: "26px", mt: 6 }, { size: 16.5, lh: "22px", mt: 2 },
  { size: 15, lh: "21px", mt: 2 }, { size: 14, lh: "20px", mt: 2 },
];

// A markdown document -> { blocks, truncated }. Blocks are {kind:"h",level,text},
// {kind:"p",text}, {kind:"code",lang,lines}, {kind:"quote",text},
// {kind:"list",items:[{marker,depth,task,text}]} (task: null, or the checkbox
// state), {kind:"hr"}.
function mdBlocks(text) {
  const lines = text.split(/\r?\n/), blocks = [];
  let para = null, truncated = false;
  const flush = () => { if (para) { blocks.push({ kind: "p", text: para }); para = null; } };
  for (let i = 0; i < lines.length; i++) {
    if (blocks.length >= MAX_MD_BLOCKS) { truncated = true; break; }
    const line = lines[i];
    if (/^\s*$/.test(line)) { flush(); continue; }
    const fence = /^\s*(`{3,}|~{3,})\s*(.*?)\s*$/.exec(line);
    if (fence) {
      flush();
      const close = new RegExp(`^\\s*${fence[1][0]}{${fence[1].length},}\\s*$`), code = [];
      let j = i + 1;
      for (; j < lines.length && !close.test(lines[j]); j++) code.push(lines[j]);
      blocks.push({ kind: "code", lang: fence[2] || "", lines: code });
      i = j; // past the closing fence, or EOF
      continue;
    }
    const head = /^(#{1,6})\s+(.*?)(?:\s+#+\s*)?$/.exec(line);
    if (head) { flush(); blocks.push({ kind: "h", level: head[1].length, text: head[2].trim() }); continue; }
    if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flush(); blocks.push({ kind: "hr" }); continue; }
    const quoted = /^ {0,3}> ?(.*)$/.exec(line);
    if (quoted) {
      flush();
      const text = [quoted[1]];
      let j = i + 1;
      for (; j < lines.length; j++) {
        const q = /^ {0,3}> ?(.*)$/.exec(lines[j]);
        if (!q) break;
        text.push(q[1]);
      }
      blocks.push({ kind: "quote", text: text.join(" ") });
      i = j - 1;
      continue;
    }
    if (/^(\s*)([-*+]|\d+[.)])\s+(.+)$/.test(line)) {
      flush();
      const items = [];
      let j = i;
      for (; j < lines.length; j++) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.+)$/.exec(lines[j]);
        if (m) {
          const task = /^\[( |x|X)\]\s*(.*)$/.exec(m[3]);
          items.push({
            marker: /\d/.test(m[2]) ? m[2] : "•",
            depth: m[1].length >= 2 ? 1 : 0,
            task: task ? task[1].toLowerCase() === "x" : null,
            text: task ? task[2] : m[3],
          });
          continue;
        }
        // An indented non-marker line continues the item above it (markdown's
        // wrapped item text); a blank or flush-left line ends the list.
        const cont = /^ {2,}(\S.*)$/.exec(lines[j]);
        if (!cont || !items.length) break;
        const last = items[items.length - 1];
        last.text = `${last.text} ${cont[1]}`;
      }
      blocks.push({ kind: "list", items });
      i = j - 1;
      continue;
    }
    para = para ? `${para} ${line.trim()}` : line.trim();
  }
  flush();
  return { blocks, truncated };
}

// One inline run splitter for everything: `code`, **bold**, [text](url),
// *italic*, _italic_ (underscore requires a non-word before and after, so
// snake_case stays literal). Alternatives are ordered so ** wins over *.
const MD_INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[[^\]\n]+\]\([^()\s]+\))|(\*[^*\n]+\*)|((?<![\w`])_[^_\n]+_(?![\w`]))/g;

// A paragraph's text -> runs {t:"text"|"code"|"bold"|"italic"|"link", s, url}.
function mdInline(text) {
  const runs = [];
  let at = 0, m;
  MD_INLINE.lastIndex = 0;
  while ((m = MD_INLINE.exec(text))) {
    if (m.index > at) runs.push({ t: "text", s: text.slice(at, m.index) });
    const s = m[0];
    if (m[1]) runs.push({ t: "code", s: s.slice(1, -1) });
    else if (m[2]) runs.push({ t: "bold", s: s.slice(2, -2) });
    else if (m[3]) {
      const link = /^\[([^\]\n]+)\]\(([^()\s]+)\)$/.exec(s);
      runs.push({ t: "link", s: link[1], url: link[2] });
    } else runs.push({ t: "italic", s: s.slice(1, -1) });
    at = m.index + s.length;
  }
  if (at < text.length) runs.push({ t: "text", s: text.slice(at) });
  return runs;
}

// Code and links keep their text whole; plain/bold/italic runs split into
// word+trailing-space chunks so the flex_wrap row below wraps mid-sentence
// the way inline text does (a whole sentence as one flex child could not).
const mdChunks = (s) => s.match(/\S+\s*|\s+/g) ?? [];

// The mono face for code: the terminal font (a mono face, settings.json's
// `font`), falling back to JetBrains Mono, which ships with Herdr.
const monoFont = () => (typeof settings()?.font === "string" && settings().font) || "JetBrains Mono";

// Inline runs -> styled elements laid out inline inside a flex_wrap row. The
// container supplies colour and line height; runs add their own, and take
// `size` explicitly — a heading's text_size must land on the words even if
// the style failed to cascade, so the hierarchy can't silently flatten.
function mdRuns(tokens, key, size) {
  const out = [];
  tokens.forEach((r, n) => {
    if (r.t === "code") {
      out.push(div().flex_none().px(5).rounded(4).bg(NIGHT_MD.codeBg).text_color(NIGHT_MD.codeFg)
        .font_family(monoFont()).text_size(13).child(r.s || " "));
    } else if (r.t === "link") {
      if (/^https?:\/\//i.test(r.url ?? "")) {
        out.push(div().flex_none().id(`os-md-link-${key}-${n}`).text_size(size).text_color(NIGHT_MD.link).underline()
          .cursor_pointer().hover((st) => st.text_color(NIGHT_MD.linkHover))
          .on_click((_e, cx) => cx.open_url(r.url)).child(r.s));
      } else { // a relative or non-http target: coloured, not clickable
        out.push(div().flex_none().text_size(size).text_color(NIGHT_MD.link).underline().child(r.s));
      }
    } else {
      const bold = r.t === "bold", italic = r.t === "italic";
      out.push(...mdChunks(r.s).map((chunk) => {
        const el = div().flex_none().text_size(size).child(chunk);
        if (bold) el.font_bold().text_color(NIGHT_MD.bold);
        if (italic) el.italic().text_color(NIGHT_MD.italic);
        return el;
      }));
    }
  });
  return out;
}

// A styled paragraph row: the words of every run flowing and wrapping inline.
const mdPara = (text, key, size, lh) => h_flex().flex_wrap().items_baseline().flex_none()
  .text_size(size).line_height(lh).text_color(NIGHT.fg)
  .children(mdRuns(mdInline(text), key, size));

// The change's name as a title in the exact H1 style (a kebab-case name, not
// a `#` line — the document below renders as-is either way).
function mdTitle(title, key = "mdtitle", color = NIGHT_MD.h[0]) {
  return h_flex().flex_wrap().items_baseline().flex_none().text_size(MD_HEAD[0].size)
    .line_height(MD_HEAD[0].lh).text_color(color).font_bold()
    .children(mdRuns(mdInline(title), key, MD_HEAD[0].size));
}

// The document's blocks as flat elements. `prefix` keeps the inline link ids
// apart when several documents share one scroll (the specs tab).
function mdBody(text, prefix = "md") {
  const { blocks, truncated } = mdBlocks(text);
  const out = [];
  blocks.forEach((b, i) => {
    const key = `${prefix}${i}`;
    if (b.kind === "h") {
      const head = MD_HEAD[b.level - 1];
      out.push(h_flex().flex_wrap().items_baseline().flex_none().text_size(head.size)
        .line_height(head.lh).text_color(NIGHT_MD.h[b.level - 1]).font_bold()
        .when(i > 0, (e) => e.mt(head.mt))
        .children(mdRuns(mdInline(b.text), key, head.size)));
    } else if (b.kind === "code") {
      const box = v_flex().flex_none().mt(2).rounded(6).bg(NIGHT_MD.codeBg)
        .border_1().border_color(NIGHT.border).overflow_hidden()
        .when(Boolean(b.lang), (e) => e.child(div().px(10).pt(6).text_size(10).text_color(NIGHT.faint).child(b.lang)));
      box.child(v_flex().flex_none().px(10).py(8)
        .children(b.lines.map((ln) => div().font_family(monoFont()).text_size(12.5).line_height("19px")
          .text_color(NIGHT_MD.codeFg).child(ln.length ? ln : " "))));
      out.push(box);
    } else if (b.kind === "quote") {
      out.push(mdPara(b.text, key, 15, "24px").mt(2).py(4).pl(10)
        .bg(NIGHT_MD.quoteBg).border_l(2).border_color(NIGHT_MD.quoteBar));
    } else if (b.kind === "list") {
      const list = v_flex().flex_none().gap(1);
      b.items.forEach((it, j) => {
        const done = it.task === true;
        list.child(h_flex().flex_none().items_start().gap(7).pl(8 + it.depth * 16)
          .child(div().flex_none().min_w(14).text_size(15).line_height("24px")
            .text_color(done ? NIGHT_MD.done : NIGHT_MD.marker)
            .child(it.task === null ? it.marker : done ? "✓" : "○"))
          .child(mdPara(it.text, `${key}-${j}`, 15, "24px").flex_1().min_w(0)));
      });
      out.push(list);
    } else if (b.kind === "hr") {
      out.push(div().flex_none().mt(2).h(1).bg(NIGHT_MD.hr));
    } else out.push(mdPara(b.text, key, 15, "24px"));
  });
  if (truncated) out.push(div().flex_none().mt(2).text_size(12).text_color(NIGHT.faint)
    .child("… truncated — the rest of this file is not shown"));
  return out;
}

// A whole document: the title, then the blocks; padded so the text never
// touches the pane's edges (the padding scrolls with the content), blocks
// spaced on a common rhythm. A complete change's title is green.
function mdView(text, title, prefix = "md", titleColor = NIGHT_MD.h[0]) {
  const out = [];
  if (title) out.push(mdTitle(title, `${prefix}title`, titleColor));
  out.push(...mdBody(text, prefix));
  return v_flex().flex_none().p(14).gap(6).children(out);
}

// One worktree's listing. The own and every linked worktree run the same
// command in parallel, so this is the single place its output is parsed and
// its failure is classified. `{ none: true }` is "No OpenSpec changes
// directory found" — a worktree without OpenSpec, not an error. Dot-prefixed
// folders are scratch or backup, not changes: the CLI lists them as entries
// (verified), so drop them here, before storing.
async function readList(root, on) {
  let list;
  try { list = await exec("openspec", ["list", "--json"], { cwd: root, on }); }
  catch { return { error: "openspec is not installed" }; }
  if (list.code !== 0) {
    const text = (list.stderr || list.stdout || `openspec list failed (${list.code})`).trim();
    if (/No OpenSpec changes directory/i.test(text)) return { none: true };
    return { error: text.split("\n")[0] };
  }
  let parsed;
  try { parsed = JSON.parse(list.stdout); } catch { return { error: "Unexpected output from openspec list" }; }
  return {
    changes: (parsed.changes ?? []).filter((c) => !(c.name ?? "").startsWith(".")).map((c) => ({
      name: c.name, done: c.completedTasks ?? 0, total: c.totalTasks ?? 0,
      at: c.lastModified ? Date.parse(c.lastModified) : null, status: c.status ?? "",
    })),
  };
}

export default class OpenSpec extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.at = 0; // the right-click menu's keyboard spot
    // The right-click menu popup: no list, no polls, no folder watch.
    if (typeof props()?.menuFor === "string") { this.handle.focus(); return; }
    // The toolbar Commands popup: same renderer, repo-level items, no name.
    if (props()?.commandsFor) { this.handle.focus(); return; }
    // The change viewer pane (pane.split {mod, props:{file,...}}): reads the
    // change's artifacts from its props — no list, no location(), nothing that
    // follows focus, so a pane saved with its tab works on its own after a
    // restart. `file` is the anchor: the change's directory is everything up
    // to its last slash.
    if (typeof props()?.file === "string") {
      this.file = props().file;
      this.dir = this.file.replace(/[^/]*$/, ""); // ends in "/"
      this.change = typeof props()?.change === "string" ? props().change
        : (this.file.split("/").filter(Boolean).at(-2) ?? "Proposal");
      this.machine = props()?.on ?? null;
      this.tab = "proposal";
      this.tabsAvailable = ["proposal"];
      this.docs = { proposal: blankDoc(), design: blankDoc(), tasks: blankDoc() };
      this.specs = { items: [], error: null };
      this.specsLoading = false;
      this.tasksText = null; // the compare-and-swap snapshot of tasks.md
      this.toggling = false;
      this.toggleToken = 0;
      this.generation = 0;
      this.viewerId = uid();
      this.seenSeq = null; // the last retarget token this copy handled
      this.refreshTask = null;
      this.closed = false;
      saveViewer(this.viewerId, { file: this.file, root: repoOf(this.dir), on: this.machine });
      this.loadArtifacts(cx);
      this.armRefresh(cx);
      cx.spawn(async (cx) => {
        for (;;) {
          let command;
          try { command = await nextCommand(); }
          catch { return; }
          try { if (command === "view") this.followView(cx); }
          catch { /* one bad wake must not end retargeting for this copy */ }
        }
      });
      return;
    }
    // The archive-failure offer: a modal dialog with no list, no polls and no
    // folder watch. An overlay does not take focus on its own, so the view
    // focuses itself and Esc reaches its key handler. `knownAgents` lands in
    // `this.agents`; while it is pending (or when it rejects) the list reads
    // empty and the button copies the command instead.
    if (props()?.archiveFailed && typeof props().archiveFailed === "object") {
      const offer = props().archiveFailed;
      this.failed = { panel: offer.panel, name: offer.name, detail: offer.detail, root: offer.root,
        on: offer.on ?? null, space: offer.space ?? null, seq: offer.seq };
      this.overlay = typeof props()?.overlay === "string" ? props().overlay : null;
      this.dispatched = false;
      this.agents = null;
      cx.spawn(async () => {
        try { this.agents = await knownAgents({ on: this.failed.on }); }
        catch { this.agents = []; }
      });
      this.handle.focus();
      return;
    }
    this.changes = []; this.sections = []; this.ownNone = false; this.ownHasChanges = false;
    this.tasks = []; this.tasksText = null; this.open = null; this.toggling = null;
    this.openRoot = null; this.openName = null;
    this.root = null; this.on = null; this.watched = null;
    this.error = null; this.loading = false;
    this.busy = null; this.confirming = null; this.confirmUntil = 0;
    // The fold-out's "Mark all N?" arm, kept apart from the archive chip's
    // confirmation so arming one never withdraws the other. It is spent at
    // every point the task state, the open change or the file changes:
    // refresh's context-change reset, pick(), refresh's change-leaves-list
    // sweep, toggle()'s settlement, loadTasks (only when the freshly read text
    // differs), and markAll's own start.
    this.marking = null; this.markUntil = 0;
    this.handoffBusy = false; // one hand-off at a time across every command source; cleared only in handoff's finally, never on a folder switch
    this.handoffKind = null;  // "bulk" spins the toolbar button; a row command does not
    this.panelId = uid(); // names this copy in the row menu's open request
    this.viewToken = 0;   // invalidates an earlier request's acknowledgement wait
    this.handledOpen = null;
    this.handledHandoff = null; // the last hand-off request this copy ran
    this.closed = false;
    this.sort = localStorage.getItem("sort") ?? "recent";
    if (!SORTS.some((s) => s.id === this.sort)) this.sort = "recent";
    this.filter = "";
    this.input = InputState.new({ placeholder: "Filter by name" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); cx.notify(); });
    this.input.on("focus", (_e, cx) => { this.typing = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.typing = false; cx.notify(); });
    this.refresh(cx);
    cx.timer.every(15000, (cx) => this.refresh(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        let command;
        try { command = await nextCommand(); }
        catch { return; }
        try {
          if (command === "open") this.acceptOpen(cx);
          else if (command === "archive-ai") this.acceptArchiveFailed();
          else if (command === "command") this.acceptHandoff(cx);
        }
        catch { /* one bad wake must not end menu handling for this copy */ }
      }
    });
  }

  // Live updates between polls: one folder watch per rendered worktree. The
  // watched set is keyed by its sorted roots, so when a refresh adds, drops or
  // changes a worktree's rows the old loops stop at their next wake and new
  // ones start. watchFolder is local-only, so skip remote spaces. A worktree
  // with no changes is not watched (the poll covers it).
  watch(roots, cx) {
    if (this.on) return;
    const list = [...new Set(roots.filter(Boolean))].sort();
    const watched = list.join("\n");
    if (this.watched === watched) return;
    this.watched = watched;
    for (const root of list) {
      cx.spawn(async (cx) => {
        try {
          while (this.watched === watched) {
            await watchFolder(`${root}/openspec/changes`);
            if (this.watched === watched) this.refresh(cx);
          }
        } catch { if (this.watched === watched) this.watched = null; }
      });
    }
  }

  refresh(cx) {
    if (this.loading) return;
    const { cwd, on } = location(), context = key();
    if (context !== this.context) {
      this.context = context; this.root = null; this.on = null; this.watched = null;
      this.changes = []; this.sections = []; this.ownNone = false; this.ownHasChanges = false;
      this.tasks = []; this.tasksText = null; this.open = null;
      this.openRoot = null; this.openName = null; this.error = null;
      this.confirming = null; this.confirmUntil = 0;
      this.marking = null; this.markUntil = 0;
    }
    if (!cwd) { this.root = null; return; }
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        // The root anchors discovery, the tasks.md reads and the watches, so
        // it is resolved first. Discovery is read-only: the panel never
        // creates, removes, prunes or locks a worktree.
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on });
        const root = top.code === 0 ? top.stdout.trim() : cwd;
        if (key() !== context) return;
        this.root = root;
        this.on = on;
        // A git failure means no repository: no linked sections, and the panel
        // is exactly its old single-root self.
        let worktrees = [];
        try {
          const wt = await exec("git", ["worktree", "list", "--porcelain"], { cwd: root, on });
          if (wt.code === 0) worktrees = parseWorktrees(wt.stdout);
        } catch { /* no git: one root only */ }
        if (key() !== context) return;
        const own = worktrees.find((w) => w.path === root) ?? null;
        const linked = worktrees
          .filter((w) => w.path !== root && !w.bare && !w.prunable)
          .sort((a, b) => worktreeLabel(a).localeCompare(worktreeLabel(b)));
        // The own listing is part of the same parallel batch as the linked
        // ones, so one refresh costs roughly the slowest worktree.
        const reads = await Promise.all([root, ...linked.map((w) => w.path)].map((r) => readList(r, on)));
        if (key() !== context) return;
        const ownRead = reads[0];
        // Any other own failure would fail in every linked worktree too, so it
        // is the panel's own error and linked worktrees are not used.
        if (ownRead.error) { this.stale(ownRead.error); return; }
        const row = (c, at, wt) => ({ ...c, root: at, wt, key: `${at}\u0000${c.name}` });
        const ownWt = wtId(root);
        const sections = [{
          root, label: own ? worktreeLabel(own) : root, own: true, wt: ownWt,
          changes: (ownRead.changes ?? []).map((c) => row(c, root, ownWt)), error: null,
        }];
        linked.forEach((w, i) => {
          const read = reads[i + 1];
          if (read.none) return; // not initialised: no section, no error
          const wt = wtId(w.path);
          if (read.error) {
            sections.push({ root: w.path, label: worktreeLabel(w), own: false, wt, changes: [], error: read.error });
            return;
          }
          if (!read.changes.length) return; // succeeded and empty: hidden
          sections.push({ root: w.path, label: worktreeLabel(w), own: false, wt,
            changes: read.changes.map((c) => row(c, w.path, wt)), error: null });
        });
        const ownHasChanges = sections[0].changes.length > 0;
        // One row per name (D4): a completed change merges into a stacked
        // branch and both keep a copy, while the main worktree keeps a stale
        // one, so every copy would repeat the name and the stale 0/N copy
        // would read as no progress. Keep the best copy in its own section.
        dedupeSections(sections);
        this.sections = sections;
        this.changes = sections.flatMap((s) => s.changes);
        this.ownHasChanges = ownHasChanges;
        this.ownNone = Boolean(ownRead.none);
        this.error = null;
        // A row that left its worktree's list takes any key naming it with it:
        // no stale open row, confirmation, mark-all arm, spinner or toggle.
        const keys = new Set(this.changes.map((c) => c.key));
        if (this.open && !keys.has(this.open)) {
          this.open = null; this.openRoot = null; this.openName = null;
          this.tasks = []; this.tasksText = null;
        }
        if (this.confirming && !keys.has(this.confirming)) this.confirming = null;
        if (this.marking && !keys.has(this.marking)) this.marking = null;
        if (this.busy && !keys.has(this.busy)) this.busy = null;
        if (this.toggling && !keys.has(this.toggling)) this.toggling = null;
        const open = this.open ? this.changes.find((c) => c.key === this.open) : null;
        if (open) await this.loadTasks(open, context);
        if (key() !== context) return;
        // One watch per worktree that actually has rows; an error or empty
        // section is left to the poll.
        this.watch(sections.filter((s) => s.changes.length > 0).map((s) => s.root), cx);
      } catch (e) {
        if (key() === context) {
          this.changes = []; this.sections = []; this.ownNone = false; this.ownHasChanges = false;
          this.tasks = []; this.tasksText = null; this.open = null;
          this.openRoot = null; this.openName = null; this.error = String(e);
        }
      }
      finally { this.loading = false; cx.notify(); }
    });
  }

  // Reset to an empty, explained panel (no repo, no openspec, a failed run).
  stale(text) {
    this.root = null; this.changes = []; this.sections = []; this.ownNone = false; this.ownHasChanges = false;
    this.tasks = []; this.tasksText = null; this.open = null;
    this.openRoot = null; this.openName = null; this.error = text;
  }

  // The row menu's View change: the popup asked this panel (by id) to act,
  // because the popup's cx ends when the menu closes. Only the named copy
  // handles the request; a second panel for the same repository ignores it.
  acceptOpen(cx) {
    if (this.closed) return;
    const req = openRequests()[this.panelId];
    if (!req || req.panel !== this.panelId || req.seq === this.handledOpen) return;
    this.handledOpen = req.seq;
    this.requestViewer(req.name, cx, { root: req.root ?? null, on: req.on ?? null, openIfNone: true });
  }

  // A row or Commands popup asked this panel copy to hand off a command,
  // because the popup's cx ends when the menu closes. Only the named copy
  // acts, and only once per request.
  acceptHandoff(cx) {
    if (this.closed) return;
    const req = openHandoffs()[this.panelId];
    if (!req || req.panel !== this.panelId || req.seq === this.handledHandoff) return;
    this.handledHandoff = req.seq;
    this.handoff(cx, req);
  }

  // The failure toast's action: this copy opens the offer it recorded. A press
  // while the dialog is up replaces it rather than stacking a second modal; a
  // record already dismissed or dispatched is gone, so nothing opens.
  acceptArchiveFailed() {
    if (this.closed) return;
    const offer = failedOffers()[this.panelId];
    if (!offer || offer.panel !== this.panelId) return;
    openFailureDialog(offer);
  }

  // Ask an open viewer for this repository and machine to show `name`, trying
  // the newest one first. Every candidate is asked, even one already naming
  // the file: a live viewer acks the same-change request without moving, and
  // a stale entry cannot pass itself off as a viewer. One that does not
  // acknowledge within VIEW_ACK_MS is skipped for a cooldown and the next is
  // tried; a menu request opens a pane when no viewer is left, a row click
  // never opens one. The token makes a newer click retire an earlier wait, so
  // a stale timer cannot open a pane.
  requestViewer(name, cx, { root, on, openIfNone }) {
    if (!root || this.closed) return;
    const file = `${root}/openspec/changes/${name}/proposal.md`;
    const candidates = matchingViewers(root, on);
    const token = ++this.viewToken;
    const step = (i, cx) => {
      if (token !== this.viewToken || this.closed) return;
      const candidate = candidates[i];
      if (!candidate) {
        if (openIfNone) run("pane.split", { direction: "right", mod: "openspec",
          props: { file, change: name, on: on ?? null } });
        return;
      }
      const [id] = candidate;
      const seq = uid();
      // One queue per viewer, holding any requests still being delivered: two
      // panels can ask the same viewer at once, and both must be answered.
      const all = liveViews();
      const queue = { ...(all[id] ?? {}), [seq]: { id, seq, at: Date.now(), file, change: name, on: on ?? null } };
      const keys = Object.keys(queue);
      for (const k of keys.slice(0, Math.max(0, keys.length - 10))) delete queue[k];
      setShared(VIEWS, { ...all, [id]: queue });
      run("openspec.view");
      cx.timer.after(VIEW_ACK_MS, (cx) => {
        if (acknowledged(seq, id)) { clearQuiet(id); return; }
        // A click can retire this wait, and a closing panel's timer can be
        // cancelled: take the request back before either early return, so a
        // copy that wakes later cannot switch for an abandoned click.
        withdrawView(id, seq);
        if (token !== this.viewToken || this.closed) return;
        markQuiet(id);
        step(i + 1, cx);
      });
    };
    step(0, cx);
  }

  async loadTasks(c, context) {
    if (!c?.root) return;
    const text = await readTextFile(`${c.root}/openspec/changes/${c.name}/tasks.md`, { on: this.on });
    if (key() !== context || this.open !== c.key) return;
    // A re-read that brings a different file withdraws the mark-all arm; an
    // unchanged re-read (an unrelated change's edit waking the watch) does not.
    if (this.marking && text !== this.tasksText) this.marking = null;
    this.tasks = text === null ? null : taskRows(text);
    this.tasksText = text;
  }

  // The viewer's refresh: local panes watch the change's own folder
  // (watchFolder recurses on macOS/Windows, so spec deltas are covered);
  // remote panes and a watch that can't arm fall back to the 15-second poll,
  // like the panel's own remote rule. The task is kept so a switch to another
  // change can cancel it; the loop also exits when its dir is no longer ours.
  armRefresh(cx) {
    this.stopRefresh();
    const dir = this.dir, at = dir.replace(/\/$/, "") || "/";
    if (this.machine) {
      this.refreshTask = cx.timer.every(15000, (cx) => { if (this.dir === dir) this.loadArtifacts(cx); });
      return;
    }
    this.refreshTask = cx.spawn(async (cx) => {
      try {
        while (this.dir === dir) {
          await watchFolder(at);
          if (this.dir !== dir) return;
          await this.loadArtifacts(cx);
        }
      } catch {
        if (this.dir === dir) this.refreshTask = cx.timer.every(15000, (cx) => { if (this.dir === dir) this.loadArtifacts(cx); });
      }
    });
  }

  stopRefresh() {
    this.refreshTask?.cancel();
    this.refreshTask = null;
  }

  // The viewer's `view` command: read every request queued for this copy,
  // acknowledge each before switching so the panel knows this copy answered,
  // and ignore a token already handled or a request addressed to another
  // copy. The last request in the slot is the one the copy lands on.
  followView(cx) {
    if (this.closed) return;
    const all = mapOf(VIEWS);
    const slot = all[this.viewerId];
    if (!slot || typeof slot !== "object") return;
    const now = Date.now();
    const valid = (r) => r && r.id === this.viewerId && typeof r.file === "string" && r.file;
    const fresh = Object.values(slot).filter((r) =>
      valid(r) && r.seq !== this.seenSeq && typeof r.at === "number" && now - r.at < VIEW_ACK_MS);
    // Drop expired, already-handled and malformed entries even when nothing
    // fresh is left, so an abandoned click cannot stay in the persisted queue.
    if (fresh.length !== Object.keys(slot).length) {
      const left = Object.fromEntries(Object.entries(slot).filter(([, r]) => fresh.includes(r)));
      const next = { ...all };
      if (Object.keys(left).length) next[this.viewerId] = left;
      else delete next[this.viewerId];
      setShared(VIEWS, next);
    }
    if (!fresh.length) return;
    for (const r of fresh) acknowledge(r.seq, this.viewerId);
    clearQuiet(this.viewerId);
    const req = fresh[fresh.length - 1];
    this.seenSeq = req.seq;
    if (req.file === this.file) return; // already showing it
    this.switchTo(req, cx);
  }

  // Show another change in this pane. The saved props stay the original
  // anchor; the old change's state is cleared, its reads invalidated and its
  // watch cancelled, then the new change is read and watched in place.
  switchTo(req, cx) {
    if (this.closed) return;
    this.generation++;
    this.file = req.file;
    this.dir = this.file.replace(/[^/]*$/, "");
    this.change = typeof req.change === "string" && req.change ? req.change
      : (this.file.split("/").filter(Boolean).at(-2) ?? "Proposal");
    this.machine = req.on ?? null;
    this.docs = { proposal: blankDoc(), design: blankDoc(), tasks: blankDoc() };
    this.specs = { items: [], error: null };
    this.specsLoading = false;
    this.tasksText = null;
    this.toggling = false;
    this.toggleToken++; // a tick in flight for the old change cannot land here
    this.tabsAvailable = ["proposal"];
    this.tab = "proposal";
    saveViewer(this.viewerId, { file: this.file, root: repoOf(this.dir), on: this.machine });
    this.armRefresh(cx);
    this.loadArtifacts(cx);
    cx.notify();
  }

  // The copy's one final call: a closing viewer must leave the registry, and
  // the request slots it owned go too, or the next View change would wait on
  // a copy that is gone.
  close(_cx) {
    this.closed = true;
    // Insurance, and the host-close path: when the host closes the dialog
    // itself (d.ts 22556 lets Esc close the top dialog before the key event
    // reaches the view), its record still goes — but only while this copy is
    // the dialog DIALOG names, so a replacement (the toast action, a newer
    // failure) never loses the record it just opened with. forgetFailed's seq
    // check keeps a straggler from dropping a newer failure's record either.
    if (this.failed && this.overlay && shared(DIALOG) === this.overlay) {
      forgetFailed(this.failed.panel, this.failed.seq);
    }
    if (this.viewerId) {
      this.stopRefresh();
      forgetViewer(this.viewerId);
      clearQuiet(this.viewerId);
      const all = mapOf(VIEWS);
      if (this.viewerId in all) {
        const next = { ...all };
        delete next[this.viewerId];
        setShared(VIEWS, next);
      }
    }
    if (this.panelId) {
      const all = openRequests();
      if (this.panelId in all) {
        const next = { ...all };
        delete next[this.panelId];
        setShared(OPENS, next);
      }
    }
  }

  // One artifact file, probe and read in one call: null = absent.
  async readDoc(name) {
    try { return { text: await readTextFile(`${this.dir}${name}`, { on: this.machine }), error: null }; }
    catch (e) { return { text: undefined, error: String(e) }; }
  }

  // The change's delta specs: `find` lists each capability's spec.md, local
  // and remote alike (readdir has no granted read root for an arbitrary
  // repository); sorted by capability, de-duplicated. A missing specs folder
  // is simply no specs; any other failure is a note.
  async listSpecs() {
    const specsDir = `${this.dir}specs`, on = this.machine;
    let found;
    try { found = await exec("find", [specsDir, "-name", "spec.md"], { on }); }
    catch (e) { return { items: [], error: String(e) }; }
    if (found.code !== 0) {
      const why = (found.stderr || found.stdout || `find failed (${found.code})`).trim();
      if (/No such file|does not exist|not found/i.test(why)) return { items: [], error: null };
      return { items: [], error: why.split("\n")[0] };
    }
    const seen = new Set(), caps = [];
    for (const path of found.stdout.split("\n").map((l) => l.trim()).filter(Boolean)) {
      const rel = path.startsWith(specsDir) ? path.slice(specsDir.length).replace(/^\/+/, "") : path;
      const parts = rel.split("/");
      // Only specs/<capability>/spec.md is a capability delta; a stray
      // specs/spec.md or a deeper file is not one. A dot-named capability
      // (e.g. specs/.backup/spec.md) is scratch, not a delta, so skip it too.
      if (parts.length !== 2 || !parts[0] || parts[1] !== "spec.md" || parts[0].startsWith(".")) continue;
      const cap = parts[0];
      if (!seen.has(cap)) { seen.add(cap); caps.push({ cap, path }); }
    }
    caps.sort((a, b) => a.cap.localeCompare(b.cap));
    const items = [];
    for (const c of caps) {
      try {
        const text = await readTextFile(c.path, { on });
        if (text !== null) items.push({ cap: c.cap, path: c.path, text, error: null });
      } catch (e) { items.push({ cap: c.cap, path: c.path, text: undefined, error: String(e) }); }
    }
    return { items, error: null };
  }

  // One discovery pass: read the three single files and list the specs, then
  // decide the tab set from what is there. Proposal is always the anchor; a
  // file that failed to read keeps its tab so the error can be shown.
  async discover() {
    const [proposal, design, tasks, specs] = await Promise.all([
      this.readDoc("proposal.md"), this.readDoc("design.md"), this.readDoc("tasks.md"), this.listSpecs(),
    ]);
    const tabs = ["proposal"];
    if (design.text !== null) tabs.push("design");
    if (tasks.text !== null) tabs.push("tasks");
    if (specs.items.length > 0 || specs.error) tabs.push("specs");
    return { docs: { proposal, design, tasks }, specs, tabs };
  }

  // Re-run discovery and adopt the result, unless the pane's file changed or a
  // newer read started meanwhile. While a task write is in flight the tasks
  // document keeps its optimistic flip.
  async loadArtifacts(cx) {
    const file = this.file, gen = ++this.generation;
    let next;
    try { next = await this.discover(); }
    catch (e) {
      if (this.file === file && gen === this.generation) {
        this.docs.proposal = { text: undefined, error: String(e) };
        cx.notify();
      }
      return;
    }
    if (this.file !== file || gen !== this.generation) return;
    if (this.toggling) next.docs.tasks = this.docs.tasks;
    this.docs = next.docs;
    this.specs = next.specs;
    this.specsLoading = false;
    this.tabsAvailable = next.tabs;
    if (!this.toggling) this.tasksText = next.docs.tasks.text ?? null;
    if (!this.tabsAvailable.includes(this.tab)) this.tab = "proposal";
    cx.notify();
  }

  // A tab click: select it at once, then read just that artifact — the other
  // tabs are not read eagerly.
  select(id, cx) {
    if (this.tab === id) return;
    this.tab = id;
    cx.notify();
    const file = this.file, gen = ++this.generation;
    if (id === "specs") {
      this.specsLoading = true;
      cx.notify();
      cx.spawn(async (cx) => {
        const specs = await this.listSpecs();
        this.specsLoading = false;
        if (this.file !== file || gen !== this.generation) { cx.notify(); return; }
        this.specs = specs;
        if (!specs.items.length && !specs.error) {
          this.tabsAvailable = this.tabsAvailable.filter((t) => t !== "specs");
          if (this.tab === "specs") this.tab = "proposal";
        }
        cx.notify();
      });
      return;
    }
    cx.spawn(async (cx) => {
      const doc = await this.readDoc(`${id}.md`);
      if (this.file !== file || gen !== this.generation) return;
      this.docs[id] = doc;
      if (id === "tasks" && !this.toggling) this.tasksText = doc.text ?? null;
      if (doc.text === null) {
        this.tabsAvailable = this.tabsAvailable.filter((t) => t !== id);
        if (this.tab === id) this.tab = "proposal";
      }
      cx.notify();
    });
  }

  // A task click in the viewer, with the panel's semantics: optimistic flip,
  // one write at a time, compare-and-swap on the viewer's own snapshot, one
  // re-read and retry when the snapshot is stale, a toast when it still
  // cannot land. Local panes only — writeTextFile takes no `on`.
  toggleTask(row, cx) {
    if (this.machine || this.toggling || typeof row.line !== "number") return;
    const snapshot = this.docs.tasks.text;
    if (typeof snapshot !== "string") return;
    const path = `${this.dir}tasks.md`, line = row.line, task = row.text, to = !row.done;
    const optimistic = toggled(snapshot, line, task, to);
    if (optimistic === null) {
      notify({ title: "Task not updated", body: "the task changed under the click", level: "error" });
      return;
    }
    this.tasksText = snapshot;
    this.docs.tasks.text = optimistic;
    this.toggling = true;
    const file = this.file, token = ++this.toggleToken;
    cx.notify();
    cx.spawn(async (cx) => {
      let body = snapshot, settled = null, why = "";
      try {
        let next = toggled(body, line, task, to);
        if (next !== null) {
          try { await writeTextFile(path, next, body); settled = next; }
          catch { next = null; } // stale snapshot: fall through to a re-read
        }
        if (settled === null) {
          body = await readTextFile(path);
          if (body === null) why = "tasks.md is gone";
          else {
            next = toggled(body, line, task, to);
            if (next === null) { why = "the task changed under the click"; settled = body; }
            else { await writeTextFile(path, next, body); settled = next; }
          }
        }
      } catch (e) { why = String(e); if (settled === null) settled = body; }
      // The pane may have switched changes while the write was in flight: the
      // write stays with the change it was clicked in, and its result only
      // lands here when this tab still belongs to that change.
      const mine = this.file === file && this.toggleToken === token;
      if (mine && typeof settled === "string") {
        this.tasksText = settled;
        this.docs.tasks.text = settled;
        this.docs.tasks.error = null;
      }
      if (why) notify({ title: "Task not updated", body: why, level: "error" });
      if (mine) {
        this.toggling = false;
        await this.loadArtifacts(cx); // adopt the file's real state either way
        cx.notify();
      }
    });
  }

  pick(c, cx) {
    const opening = this.open !== c.key;
    this.open = opening ? c.key : null;
    this.openRoot = opening ? c.root : null;
    this.openName = opening ? c.name : null;
    this.tasks = [];
    this.tasksText = null;
    this.confirming = null;
    this.marking = null; // a row switch spends the mark-all arm
    // Opening a row also shows it in the open viewer (same repository and
    // machine); folding a row away leaves the viewer where it is.
    if (opening && c.root) this.requestViewer(c.name, cx, { root: c.root, on: this.on, openIfNone: false });
    const context = this.context;
    if (this.open) cx.spawn(async (cx) => {
      try { await this.loadTasks(c, context); }
      catch { if (key() === context && this.open === c.key) this.tasks = null; }
      cx.notify();
    });
    cx.notify();
  }

  // Second click of the "Archive?" chip: run openspec archive <name> --yes
  // (exec has no TTY, so prompts must be skipped), then report by toast.
  archive(c, cx) {
    if (this.busy || !c?.root) return;
    const { on } = location(), context = key();
    const name = c.name, root = c.root, ckey = c.key;
    const space = spaces().find((s) => s.active)?.id ?? null;
    this.busy = ckey; this.confirming = null;
    cx.spawn(async (cx) => {
      let ok = false, detail = "";
      try {
        const r = await exec("openspec", ["archive", name, "--yes"], { cwd: root, on });
        ok = r.code === 0;
        detail = ok ? `openspec archive ${name}` : exitDetail(r);
      } catch (e) { detail = thrownDetail(e); }
      // Report first, then refresh: a throwing refresh (or a released view)
      // must not swallow the report or leave the panel busy.
      this.busy = null;
      if (!ok) {
        const offer = { panel: this.panelId, name, detail, root, on: on ?? null, space, seq: uid(), at: Date.now() };
        setShared(FAILED, { ...failedOffers(), [this.panelId]: offer });
        notify({ title: "Archive failed", body: detail, level: "error", action: { name: "openspec.archive-ai" } });
        openFailureDialog(offer);
      } else {
        notify({ title: "Change archived", body: detail, level: "success" });
      }
      let same = false;
      try { same = key() === context; }
      catch { /* a released view cannot read its context; the report already stands */ }
      if (same) {
        if (this.open === ckey) {
          this.open = null; this.openRoot = null; this.openName = null; this.tasks = [];
        }
        try { this.refresh(cx); } catch { /* the view may be gone; the report already stands */ }
      }
      try { cx.notify(); } catch { /* a released view cannot repaint */ }
    });
    cx.notify();
  }

  // The write a task click makes, shared by local and remote spaces. Locally
  // it is writeTextFile's compare-and-swap against the snapshot — the same
  // call, the same exceptions, unchanged. On a remote machine it is herdr-core
  // running there (exec's `on` routes the whole process to the machine) and
  // its exact-text edit: one checkbox line's exact bytes as `--old` and the
  // flipped line as `--new`, then a re-read whose same line must hold the
  // flipped text. The values ride in the `=` form (`--old=<line>`): every task
  // line begins with `- [ ]`, and clap reads a dash-leading value after a
  // separate `--old` as a flag — the live "unexpected argument '-'" toast;
  // `=` passes it verbatim (probed green). Not the app's `herdr` CLI (no
  // `file` subcommand — its usage error was the first live tick) and not
  // `--on` (herdr-core's local machine registry is empty, so it cannot route
  // from here); running on the machine needs no registry, and the row's root
  // is a valid cwd there. A pair that changes nothing means the file already holds
  // the asked state, so it is accepted as it stands, as the local write would
  // be.
  // Returns the settled text to show; throws when it cannot land or verify.
  async writeFlip(root, path, body, next, line, task, to) {
    if (!this.on) { await writeTextFile(path, next, body); return next; }
    const pair = flipPair(body, line, next);
    if (pair === null) throw "the task changed under the click";
    if (pair.old === pair.neu) return body;
    const r = await exec("herdr-core", ["file", "edit", path, `--old=${pair.old}`, `--new=${pair.neu}`], { cwd: root, on: this.on });
    if (r.code !== 0) throw exitDetail(r);
    const reread = await readTextFile(path, { on: this.on });
    if (reread === null) throw "tasks.md is gone";
    if (reread.split("\n")[line] !== next.split("\n")[line]) throw "the write did not land as asked";
    return reread;
  }

  // The write a mark-all makes: every open checkbox ticked in one shot.
  // Locally it is the same whole-file compare-and-swap a single tick uses
  // (writeFlip's local branch, against the snapshot loadTasks read); on a
  // remote machine it is ONE `herdr-core file edit` carrying a `--old`/`--new`
  // pair for every ticked line — the CLI's `--help` says "(--old X --new Y,
  // repeatable) … all or none", so one command carries the whole change and
  // either every pair applies or the file is untouched. Each old line is
  // pre-checked unique (flipPairs), and the re-read must hold every changed
  // line's ticked text. Returns the settled text to show; throws when it
  // cannot land or verify.
  async writeFlips(root, path, body, next) {
    if (!this.on) { await writeTextFile(path, next, body); return next; }
    const pairs = flipPairs(body, next);
    if (!pairs.length) return body;
    const r = await exec("herdr-core", ["file", "edit", path,
      ...pairs.flatMap((p) => [`--old=${p.old}`, `--new=${p.neu}`])], { cwd: root, on: this.on });
    if (r.code !== 0) throw exitDetail(r);
    const reread = await readTextFile(path, { on: this.on });
    if (reread === null) throw "tasks.md is gone";
    const now = reread.split("\n"), want = next.split("\n");
    if (now.length !== want.length || pairs.some((p) => now[p.line] !== want[p.line])) throw "the write did not land as asked";
    return reread;
  }

  // A task click: flip that checkbox line in the change's tasks.md — the
  // file is the truth, and the watch brings the new counts back. Optimistic
  // (the row flips at once), one at a time, in every space: locally the
  // write is compare-and-swap on the snapshot loadTasks read; on a remote
  // machine it is the CLI's exact-text edit, read–edit–verify (writeFlip). A
  // rejection (an agent edited first) re-reads and tries once more, and
  // anything that still fails shows the file's real state and toasts.
  toggle(row, c, cx) {
    if (!c?.root || this.toggling || typeof row.line !== "number") return;
    const path = `${c.root}/openspec/changes/${c.name}/tasks.md`;
    const line = row.line, task = row.text, to = !row.done, context = key(), ckey = c.key;
    row.done = to; this.toggling = ckey; cx.notify();
    cx.spawn(async (cx) => {
      let body = this.tasksText, settled = null, why = "";
      try {
        let next = body === null ? null : toggled(body, line, task, to);
        if (next !== null) {
          try { settled = await this.writeFlip(c.root, path, body, next, line, task, to); }
          catch { next = null; } // stale snapshot: fall through to a re-read
        }
        if (settled === null) {
          body = await readTextFile(path, { on: this.on });
          if (body === null) why = "tasks.md is gone";
          else {
            next = toggled(body, line, task, to);
            if (next === null) { why = "the task changed under the click"; settled = body; }
            else { settled = await this.writeFlip(c.root, path, body, next, line, task, to); }
          }
        }
      } catch (e) { why = String(e); if (settled === null) settled = body; }
      if (key() === context && this.open === ckey && settled !== null) {
        this.tasksText = settled; this.tasks = taskRows(settled);
      }
      this.toggling = null;
      this.marking = null; // a tick changed the task state, so N changed with it
      if (why) notify({ title: "Task not updated", body: why, level: "error" });
      if (key() === context) this.refresh(cx);
      cx.notify();
    });
  }

  // Mark every open task in the change's tasks.md done, in one write. The same
  // scaffolding as a single toggle (toggle): optimistic — every open row
  // flips at once, the rows past the 120-row display cap included — one at a
  // time, one attempt plus one re-read and retry, and the file's truth on
  // screen after any failure. Locally the write is a whole-file
  // compare-and-swap on the snapshot loadTasks read; on a remote machine it is
  // one all-or-none `herdr-core file edit` (writeFlips). The label's arm
  // (`marking`/`markUntil`) is spent here, so it never survives its own write.
  markAll(c, cx) {
    if (!c?.root || this.toggling || this.open !== c.key || typeof this.tasksText !== "string") return;
    const ckey = c.key;
    this.marking = null;
    if (Array.isArray(this.tasks)) for (const r of this.tasks) if (!r.section && !r.done) r.done = true;
    this.toggling = ckey;
    const path = `${c.root}/openspec/changes/${c.name}/tasks.md`;
    const context = key();
    cx.notify();
    cx.spawn(async (cx) => {
      let body = this.tasksText, settled = null, why = "";
      try {
        try { settled = await this.writeFlips(c.root, path, body, markedAll(body)); }
        catch { settled = null; } // stale snapshot: fall through to a re-read
        if (settled === null) {
          body = await readTextFile(path, { on: this.on });
          if (body === null) why = "tasks.md is gone";
          else settled = await this.writeFlips(c.root, path, body, markedAll(body));
        }
      } catch (e) { why = String(e); if (settled === null) settled = body; }
      if (key() === context && this.open === ckey && settled !== null) {
        this.tasksText = settled; this.tasks = taskRows(settled);
      }
      this.toggling = null;
      if (why) notify({ title: "Tasks not updated", body: why, level: "error" });
      if (key() === context) this.refresh(cx);
      cx.notify();
    });
  }

  // A task row: ✓ done / ○ open, wrapping to the entry's whole text. Done
  // tasks read green when their change is complete; rows click to tick
  // (toggle) in any space. A section heading is one line, truncated.
  taskLine(row, t, c, complete) {
    const { section, done, full, line } = row;
    const wt = c.wt;
    if (section) {
      return div().id(`os-sec-${wt}-${section}`).h(20).flex_none().flex().items_center().px(8).truncate()
        .text_size(10).font_semibold().text_color(t.dim).child(section);
    }
    return h_flex().id(`os-task-${wt}-${line}`).min_h(18).flex_none().px(8).gap(7).items_start()
      .child(div().w(11).flex_none().text_size(11).line_height("18px")
        .text_color(done ? green(t) : t.dim).child(done ? "✓" : "○"))
      .child(div().flex_1().min_w(0).text_size(11).line_height("18px")
        .text_color(done ? (complete ? green(t) : t.dim) : t.foreground).child(full || " "))
      .cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => this.toggle(row, c, cx));
  }

  row(c, t) {
    const open = this.open === c.key, complete = c.total > 0 && c.done >= c.total;
    const confirming = this.confirming === c.key && Date.now() < this.confirmUntil;
    const state = stateOf(c), remaining = c.total - c.done;
    const chip = (label, color) => div().px(5).rounded(4).border_1().border_color(t.border).text_size(10).text_color(color).flex_none().child(label);
    const barColor = state === "complete" ? green(t) : state === "nearly" ? t.accent : t.working;
    return v_flex().flex_none()
      .child(h_flex().id(`chg-${c.wt}-${c.name}`).h(38).flex_none().px(8).gap(8).items_center().rounded(7).cursor_pointer()
        .when(open, (e) => e.bg(t.selected)).hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.pick(c, cx))
        .on_mouse_down("right", (e, cx) => {
          cx.stop_propagation();
          this.openRowMenu(c, e.position, cx);
        })
        .child(div().flex_1().min_w(0).truncate().font_semibold().text_color(complete ? green(t) : t.foreground).child(c.name))
        .when(c.total > 0, (e) => e.child(div().text_size(11).text_color(complete ? green(t) : t.muted).child(`${c.done}/${c.total}`)))
        .when(state === "complete", (e) => e.child(chip("✓ complete", green(t))))
        .when(state === "nearly", (e) => e.child(chip(`${remaining} left`, t.accent)))
        .when(state === "unstarted", (e) => e.child(chip("unstarted", t.muted)))
        .when(state === "draft", (e) => e.child(chip("no tasks", t.dim)))
        .when(state === "progress" && Boolean(c.status) && c.status !== "in-progress", (e) => e.child(chip(c.status, t.muted)))
        .when(Boolean(ago(c.at)), (e) => e.child(div().w(64).text_right().text_size(11).text_color(t.dim).flex_none().truncate().child(ago(c.at))))
        .when(this.busy === c.key, (e) => e.child(svg("mods/workspace-chrome/spinner.svg").size(13).flex_none().text_color(t.dim).spin(900)))
        .when(showArchive(c, this), (e) => e.child(confirming
          ? h_flex().id(`arch-${c.wt}-${c.name}`).h(22).px(7).flex_none().items_center().rounded(5).bg(`${t.ansi1}22`).text_color(t.ansi1).text_size(10).cursor_pointer()
            .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
            .on_click((_e, cx) => this.archive(c, cx)).child("Archive?")
          : div().id(`arch-${c.wt}-${c.name}`).size(22).flex_none().flex().items_center().justify_center().rounded(5)
            .text_color(complete ? t.muted : t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
            .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.confirming = c.key; this.confirmUntil = Date.now() + 6000; cx.notify(); })
            .child(svg("mods/openspec/archive.svg").size(13)))))
      .when(c.total > 0, (e) => e.child(h_flex().h(3).mx(8).mt(3).mb(2).rounded(2).bg(t.raised).overflow_hidden()
        .child(div().h_full().rounded(2).bg(barColor).w(`${Math.round(100 * c.done / c.total)}%`))))
      .when(open, (e) => e.child(v_flex().flex_none().pl(16).pb(4)
        .when(this.tasks === null, (el) => el.child(div().px(8).py(3).text_size(11).text_color(t.dim).child("No tasks.md")))
        .when(Array.isArray(this.tasks), (el) => {
          const rows = this.tasks.slice(0, 120);
          // The mark-all bar: right-aligned above the rows, counting every
          // open checkbox in the file (past the cap too). A first press arms
          // the label for ~6 s, a second inside that window writes; while any
          // task write is in flight it is a spinner and presses are ignored.
          // The optimistic flip empties openCount before the write settles,
          // so the bar also stays up while this change's write is in flight —
          // otherwise the spinner would never be rendered.
          const openCount = this.tasks.filter((r) => !r.section && !r.done).length;
          const armed = this.marking === c.key && Date.now() < this.markUntil;
          const inFlight = this.toggling === c.key;
          return el
            .when(openCount > 0 || this.toggling === c.key, (el2) => el2.child(h_flex().w_full().h(18).flex_none().px(8).items_center().justify_end()
              .when(inFlight, (bar) => bar.child(div().id(`mark-${c.wt}-${c.name}`).flex().items_center()
                .child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.dim).spin(900))))
              .when(!inFlight && armed, (bar) => bar.child(div().id(`mark-${c.wt}-${c.name}`).h(18).px(6).flex().flex_none().items_center().rounded(4)
                .bg(`${t.ansi1}22`).text_color(t.ansi1).text_size(10).cursor_pointer()
                .on_click((_e, cx) => this.markAll(c, cx)).child(`Mark all ${openCount}?`)))
              .when(!inFlight && !armed, (bar) => bar.child(div().id(`mark-${c.wt}-${c.name}`).h(18).px(6).flex().flex_none().items_center().rounded(4)
                .text_color(t.dim).text_size(10).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
                .on_click((_e, cx) => { this.marking = c.key; this.markUntil = Date.now() + 6000; cx.notify(); })
                .child(`Mark all ${openCount} done`)))))
            .children(rows.map((r) => this.taskLine(r, t, c, complete)))
            .when(this.tasks.length > 120, (el2) => el2.child(div().px(8).py(2).text_size(10).text_color(t.dim)
              .child(`+ ${this.tasks.length - 120} more in tasks.md`)))
            .when(!this.tasks.length, (el2) => el2.child(div().px(8).py(3).text_size(11).text_color(t.dim).child("No tasks yet")));
        })));
  }

  // One section's rows. The state sort groups rows inside the section, so each
  // section carries its own state headers and the worktree header stays above
  // them. The id carries the worktree id for the same reason row ids do.
  sectionRows(rows, t) {
    if (this.sort !== "state") return rows.map((c) => this.row(c, t));
    let last = null;
    return rows.flatMap((c) => {
      const st = stateOf(c);
      if (st === last) return [this.row(c, t)];
      last = st;
      const meta = STATES.find((s) => s.id === st), count = rows.filter((r) => stateOf(r) === st).length;
      return [div().id(`os-group-${c.wt}-${st}`).h(22).flex_none().flex().items_center().px(8).gap(6).truncate()
        .text_size(10).font_semibold().text_color(st === "complete" ? green(t) : t[meta.color]).child(meta.label)
        .child(div().text_color(t.dim).child(String(count))), this.row(c, t)];
    });
  }

  // A worktree section header: the branch label (or `detached: <folder>`), the
  // panel's own section marked, and the section's visible change count and
  // done/total tasks. An error section's body carries its message instead, so
  // its header shows no counts.
  sectionHead(s, t) {
    const rows = s.rows ?? [];
    const done = rows.reduce((n, c) => n + c.done, 0), total = rows.reduce((n, c) => n + c.total, 0);
    return h_flex().id(`os-wt-${s.wt}`).h(22).flex_none().flex().items_center().px(8).gap(6).truncate()
      .text_size(10).font_semibold().text_color(t.accent)
      .child(div().flex_none().child(`⎇ ${s.label}`))
      .when(s.own, (e) => e.child(div().flex_none().text_color(t.dim).child("· this worktree")))
      .child(div().flex_1())
      .when(!s.error, (e) => e.child(div().flex_none().text_color(t.dim)
        .child(`${rows.length} change${rows.length === 1 ? "" : "s"}${total > 0 ? ` · ${done}/${total}` : ""}`)));
  }

  // The archive-failure dialog: a small Tokyo Night card naming the change and
  // the error, offering an agent hand-off. It is modal (a click beside it does
  // nothing) and takes the keyboard itself so Esc can consume the offer.
  failureView() {
    const name = this.failed.name;
    return v_flex().id("openspec-archive-failed").w_full().p(16).gap(10)
      .bg(NIGHT.bg).border_1().border_color(NIGHT.border).rounded(10)
      .text_color(NIGHT.fg).text_size(13)
      .track_focus(this.handle)
      .on_key_down((e, _cx) => {
        if (e.key !== "escape") return;
        this.dismiss();
      })
      .child(div().text_size(15).font_semibold().text_color(NIGHT_MD.h[0]).child("Archive failed"))
      .child(div().text_size(12).line_height("18px").text_color(NIGHT.error).child(this.failed.detail || "the archive did not finish"))
      .child(div().text_size(12.5).line_height("18px").text_color(NIGHT.muted).child(`Archive ${name} using AI?`))
      .child(h_flex().justify_end().gap(8)
        .child(div().id("openspec-archive-ai").h(28).px(12).flex().items_center().rounded(6).cursor_pointer()
          .bg(NIGHT.accent).text_color(NIGHT.bg).text_size(12).font_semibold()
          .hover((s) => s.bg(NIGHT_MD.link))
          .on_click((_e, cx) => this.archiveWithAI(cx))
          .child("Archive using AI"))
        .child(div().id("openspec-archive-dismiss").h(28).px(12).flex().items_center().rounded(6).cursor_pointer()
          .border_1().border_color(NIGHT.border).text_color(NIGHT.muted).text_size(12)
          .hover((s) => s.bg(NIGHT.bgAlt).text_color(NIGHT.fg))
          .on_click((_e, _cx) => this.dismiss())
          .child("Dismiss")));
  }

  // Dismiss/Esc: the offer is spent, so its record goes before the dialog.
  dismiss() {
    forgetFailed(this.failed.panel, this.failed.seq);
    closeOverlay(props().overlay);
  }

  // The clipboard fallback: the command plus a toast saying where it went.
  copyCommand(cx) {
    cx.write_to_clipboard(`/opsx-archive ${this.failed.name}`);
    notify({ title: "Copied — paste it into your agent", level: "info" });
  }

  // Archive using AI: start an installed agent on the change, or copy the
  // command when there is none (or the list is still loading or unreadable).
  // The host calls run while this view is alive; the record goes after them,
  // then the dialog closes, so a throw cannot leave a spent button over no
  // offer. A second rapid press is refused by `dispatched`.
  archiveWithAI(cx) {
    if (this.dispatched) return;
    this.dispatched = true;
    const agent = Array.isArray(this.agents) ? this.agents.find((a) => a.installed) : null;
    try {
      if (agent) run("tab.new", { space: this.failed.space, folder: this.failed.root, argv: agent.run, task: `/opsx-archive ${this.failed.name}` });
      else this.copyCommand(cx);
    } catch {
      try { this.copyCommand(cx); }
      catch {
        // Nothing left to offer — the tab and the clipboard both failed — but
        // the person must still learn the command before the offer goes.
        try { notify({ title: "Could not hand off the archive", body: `Run by hand: /opsx-archive ${this.failed.name}`, level: "error" }); }
        catch { /* even the toast is unreachable; nothing can report */ }
      }
    }
    forgetFailed(this.failed.panel, this.failed.seq);
    closeOverlay(props().overlay);
  }

  // The shared hand-off every command source uses: hand the command text to
  // the person's selected agent by typing it into that agent's terminal
  // (herdr-core send, on its machine), then a new tab in the captured
  // repository with the selected agent's program (or the first installed),
  // then the clipboard. One hand-off at a time across every source; the
  // toasts report the hand-off, never a finished command. The caller supplies
  // the toast titles so Bulk archive keeps its exact wording. Runs against the
  // repository, machine and space captured when the action was picked, not the
  // live ones, because the panel may switch folders while a menu is open.
  handoff(cx, { command, kind, sent, opened, failed, root, on, space }) {
    if (this.handoffBusy || !root) return;
    this.handoffBusy = true;
    this.handoffKind = kind;
    const context = key();
    cx.notify();
    cx.spawn(async (cx) => {
      const clipboard = () => {
        cx.write_to_clipboard(command);
        notify({ title: "Copied — paste it into your agent", level: "info" });
      };
      try {
        const selected = selectedAgent();
        if (selected && sameRepo(selected, root, on)) {
          try {
            const r = await exec("herdr-core", ["send", selected.local, command], { on: selected.machine });
            if (r.code !== 0) throw exitDetail(r);
            notify({ title: sent, body: selected.name, level: "success" });
            return;
          } catch { /* the terminal is gone or the machine unreachable: new tab */ }
        }
        try {
          let list = [];
          try { list = await knownAgents({ on }); } catch { /* unreadable list: no agent to start */ }
          const agent = list.find((a) => a.installed && selected?.programKey && a.key === selected.programKey) ?? list.find((a) => a.installed);
          if (agent) {
            run("tab.new", { space, folder: root, argv: agent.run, task: command });
            notify({ title: opened, body: agent.name, level: "success" });
          } else clipboard();
        } catch { clipboard(); }
      } catch {
        // The tab and the clipboard both failed — the command must not be lost.
        try { notify({ title: failed, body: `Run by hand: ${command}`, level: "error" }); }
        catch { /* even the toast is unreachable; nothing can report */ }
      } finally {
        this.handoffBusy = false;
        this.handoffKind = null;
        try { if (key() === context) cx.notify(); } catch { /* a released view cannot repaint */ }
      }
    });
  }

  // Bulk archive: hand /opsx-bulk-archive to the person's selected agent by
  // typing it into that agent's terminal (herdr-core send, on its machine).
  // The panel chooses no changes and runs no archive command — the command's
  // own workflow prompts for the selection, validates, resolves conflicts,
  // syncs the specs and archives; the folder watch and the 15-second poll
  // bring the result back. Fallbacks in order: a new tab in this repository
  // with the selected agent's program (or the first installed), then the
  // clipboard. One hand-off at a time; the toasts report the hand-off, never
  // a finished archive.
  bulkArchive(cx) {
    if (this.handoffBusy || !this.root) return;
    const root = this.root, on = this.on;
    const space = spaces().find((s) => s.active)?.id ?? null;
    this.handoff(cx, {
      command: BULK, kind: "bulk",
      sent: "Bulk archive sent", opened: "Bulk archive opened", failed: "Could not hand off the bulk archive",
      root, on, space,
    });
  }

  // The row's right-click: read the change's status (bounded), then open the
  // popup where the click happened with only the items that can apply. A
  // failed or slow read shows the full static set, and the popup opens after
  // the read so items neither appear nor vanish under the pointer.
  openRowMenu(c, pos, cx) {
    const root = c.root, on = this.on;
    const space = spaces().find((s) => s.active)?.id ?? null;
    const geo = pos && typeof pos.x === "number" && typeof pos.y === "number" ? { at: { x: pos.x, y: pos.y } } : {};
    const open = (items, height) => openOverlay({ mod: "openspec", kind: "popup", ...geo, width: 200, height,
      props: { menuFor: c.name, root, on, space, panel: this.panelId, items } });
    if (!root) {
      const { items, height } = rowMenuItems(null, c);
      open(items, height);
      return;
    }
    cx.spawn(async (cx) => {
      let status = null;
      try {
        const slow = new Promise((resolve) => cx.timer.after(1500, () => resolve(null)));
        const r = await Promise.race([exec("openspec", ["status", "--change", c.name, "--json"], { cwd: root, on }), slow]);
        if (r && r.code === 0) {
          const parsed = JSON.parse(r.stdout);
          const artifacts = Array.isArray(parsed?.artifacts) ? parsed.artifacts : [];
          const done = (id) => artifacts.some((a) => a?.id === id && a?.status === "done");
          status = { complete: parsed?.isComplete === true, tasks: done("tasks"), specs: done("specs") };
        }
      } catch { status = null; }
      const { items, height } = rowMenuItems(status, c);
      open(items, height);
    });
  }

  // The toolbar Commands menu: a repo-level table with no status read, so it
  // opens at once at the overlay's default pointer anchor.
  openCommands(cx) {
    const items = COMMANDS.map((c, i) => ({ i, label: c.label }));
    const height = 10 + 31 * items.length;
    openOverlay({ mod: "openspec", kind: "popup", width: 200, height,
      props: { commandsFor: true, root: this.root, on: this.on,
        space: spaces().find((s) => s.active)?.id ?? null, panel: this.panelId, items } });
  }

  // The row/Commands popup: the visible items over the list. Esc and a click
  // beside it close it (the host does both); ↑/↓ wrap over the non-divider
  // items and Enter picks. The panel decides what is visible; this never
  // evaluates a predicate.
  menuView(t) {
    const rowMenu = typeof props().menuFor === "string";
    const name = rowMenu ? props().menuFor : null;
    const table = rowMenu ? MENU : COMMANDS;
    const fallback = table.map((it, i) => it.divider ? { div: true } : { i, label: it.label });
    const items = Array.isArray(props().items) && props().items.length ? props().items : fallback;
    const pickable = items.map((it, n) => it.div ? -1 : n).filter((n) => n >= 0);
    if (!pickable.length) return v_flex().id("openspec-menu");
    if (this.at < 0 || this.at >= pickable.length) this.at = 0;
    const highlight = pickable[this.at];
    const choose = (n, cx) => {
      const entry = items[pickable[n]], it = entry && table[entry.i];
      if (!it || typeof it.run !== "function") { closeOverlay(props().overlay); return; }
      const at = { root: props().root ?? null, on: props().on ?? null, space: props().space ?? null, panel: props().panel ?? null };
      it.run(name, cx, at); // while the popup (and its cx) is still alive
      closeOverlay(props().overlay);
    };
    return v_flex().id("openspec-menu").track_focus(this.handle).w_full().min_h(0).p(5).bg(t.popover).text_size(12.8)
      .on_key_down((e, cx) => {
        if (e.key === "down") this.at = (this.at + 1) % pickable.length;
        else if (e.key === "up") this.at = (this.at + pickable.length - 1) % pickable.length;
        else if (e.key === "enter") choose(this.at, cx);
        else if (e.key === "escape") closeOverlay(props().overlay);
        else return;
        cx.notify();
      })
      .children(items.map((it, n) => it.div
        ? div().h(9).mx(6).border_t(1).border_color(t.border)
        : h_flex().id(`os-mi-${it.i}`).h(31).px(8).rounded(7).items_center()
          .text_color(t.foreground)
          .when(n === highlight, (el) => el.bg(t.selected))
          .hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => choose(pickable.indexOf(n), cx))
          .child(div().flex_1().child(it.label))));
  }

  clearFilter(cx) {
    this.filter = "";
    this.input.set_value("");
    this.typing = false;
    this.handle.focus();
    cx.notify();
  }

  // A change is complete when tasks.md has at least one task row and every
  // row is done; a change with no task rows is not complete. Recomputed from
  // the task text each render so the last tick turns the page green at once.
  isComplete() {
    const text = this.docs.tasks.text;
    if (typeof text !== "string" || !text.length) return false;
    const rows = taskRows(text).filter((r) => typeof r.line === "number");
    return rows.length > 0 && rows.every((r) => r.done);
  }

  // The change viewer: a tab bar for the artifacts the change has, the
  // selected tab's body, and the machine-prefixed change directory. Every
  // surface is drawn from the built-in Tokyo Night palette (the owner's
  // Obsidian theme), fixed whatever the app theme is. A complete change reads
  // green — title, selected tab, a chip in the bar and its checklist.
  changeView() {
    const where = `${this.machine ? `${this.machine}: ` : ""}${this.dir.replace(/\/$/, "") || this.dir}`;
    const complete = this.isComplete();
    return v_flex().id("openspec-viewer").size_full().min_h(0).rounded(10).overflow_hidden().bg(NIGHT.bg)
      .border_1().border_color(NIGHT.border).text_color(NIGHT.fg).text_size(13)
      .child(this.tabBar(complete))
      .child(v_flex().flex_1().min_h(0).overflow_y_scrollbar()
        .when(this.tab === "tasks", (e) => e.child(this.tasksView(complete)))
        .when(this.tab === "specs", (e) => e.child(this.specsView(complete)))
        .when(this.tab === "proposal" || this.tab === "design", (e) => e.child(this.docView(this.tab, complete))))
      .when(Boolean(where), (e) => e.child(h_flex().flex_none().h(26).px(12).items_center().bg(NIGHT.bgAlt).border_t(1).border_color(NIGHT.border)
        .child(div().flex_1().min_w(0).truncate().text_size(10).text_color(NIGHT.faint).child(where))));
  }

  // The tab bar replaces the old header: one Tab per artifact the change has,
  // selected state in, click out. Tabs/Tab carry semantics only, so the mod
  // draws the colours — selected body text with the magenta underline,
  // unselected muted and brightening on hover. A complete change takes the
  // green done colour throughout and shows a ✓ complete chip at the right.
  tabBar(complete) {
    const n = this.tabsAvailable.length, accent = complete ? NIGHT_MD.done : NIGHT.accent;
    return h_flex().h(42).flex_none().px(10).gap(2).items_center().bg(NIGHT.bgAlt).border_b(1).border_color(NIGHT.border)
      .child(Tabs.new("openspec-tabs").h_full().flex_none().flex().items_center().gap(2)
        .children(this.tabsAvailable.map((id, i) => {
          const on = this.tab === id;
          return Tab.new(`openspec-tab-${id}`).h_full().flex_none().flex().items_center().px(12)
            .text_size(12.5).font_medium()
            .text_color(on ? (complete ? NIGHT_MD.done : NIGHT.fg) : NIGHT.muted)
            .border_b(2).border_color(on ? accent : NIGHT.bgAlt)
            .hover((s) => s.text_color(complete ? NIGHT_MD.done : NIGHT.fg))
            .selected(on)
            .set_position(i + 1, n)
            .on_click((_e, cx) => this.select(id, cx))
            .child(id);
        })))
      .child(div().flex_1())
      .when(complete, (e) => e.child(div().px(6).py(1).rounded(4).border_1().border_color(NIGHT_MD.done)
        .text_size(10).text_color(NIGHT_MD.done).flex_none().child("✓ complete")));
  }

  // A document tab: the change's name leads as the H1-style title, then the
  // artifact through the mod's own markdown renderer. Per-artifact states
  // explain loading, absent, empty and failed reads.
  docView(id, complete) {
    const doc = this.docs[id], name = `${id}.md`;
    if (doc.error) return div().p(14).text_color(NIGHT.error).child(doc.error);
    if (doc.text === undefined) return div().p(14).text_color(NIGHT.faint)
      .child(id === "proposal" ? "Loading proposal…" : `Loading ${name}…`);
    if (doc.text === null) return div().p(14).text_color(NIGHT.faint)
      .child(id === "proposal" ? "No proposal.md — this change has none" : `${name} is not here`);
    if (doc.text === "") return div().p(14).text_color(NIGHT.faint).child(`${name} is empty`);
    return mdView(doc.text, this.change, "md", complete ? NIGHT_MD.done : NIGHT_MD.h[0]);
  }

  // The specs tab: one scroll, each capability's spec.md under a heading of
  // its name, the change's name as the title once at the top.
  specsView(complete) {
    if (this.specsLoading) return div().p(14).text_color(NIGHT.faint).child("Loading specs…");
    if (this.specs.error) return div().p(14).text_color(NIGHT.error)
      .child(`Specs could not be listed: ${this.specs.error}`);
    if (!this.specs.items.length) return div().p(14).text_color(NIGHT.faint).child("No specs in this change");
    const out = this.change ? [mdTitle(this.change, "mdtitle", complete ? NIGHT_MD.done : NIGHT_MD.h[0])] : [];
    this.specs.items.forEach((it, i) => {
      out.push(h_flex().flex_none().mt(i ? 14 : 8).pb(4).border_b(1).border_color(NIGHT.border)
        .child(div().text_size(MD_HEAD[1].size).line_height(MD_HEAD[1].lh).font_bold().text_color(NIGHT.fg).child(it.cap)));
      if (it.error) out.push(div().pt(4).text_color(NIGHT.error).child(it.error));
      else if (it.text === undefined) out.push(div().pt(4).text_color(NIGHT.faint).child(`Loading ${it.cap}/spec.md…`));
      else if (it.text === null) out.push(div().pt(4).text_color(NIGHT.faint).child(`${it.cap}/spec.md is not here`));
      else if (it.text === "") out.push(div().pt(4).text_color(NIGHT.faint).child(`${it.cap}/spec.md is empty`));
      else out.push(...mdBody(it.text, `spec${i}-`));
    });
    return v_flex().flex_none().p(14).gap(4).children(out);
  }

  // The tasks tab is a themed checklist, not markdown: section headings in
  // the muted colour, ✓ green for done, ○ faint for open, every task's text
  // in full (no truncation, no row cap — this is the page, not a list row).
  tasksView(complete) {
    const doc = this.docs.tasks;
    if (doc.error) return div().p(14).text_color(NIGHT.error).child(doc.error);
    if (doc.text === undefined) return div().p(14).text_color(NIGHT.faint).child("Loading tasks.md…");
    if (doc.text === null) return div().p(14).text_color(NIGHT.faint).child("tasks.md is not here");
    if (doc.text === "") return div().p(14).text_color(NIGHT.faint).child("tasks.md is empty");
    const rows = taskRows(doc.text);
    if (!rows.length) return div().p(14).text_color(NIGHT.faint).child("No tasks yet");
    return v_flex().flex_none().p(14).gap(2)
      .children(rows.map((r, i) => r.section
        ? div().mt(i ? 12 : 0).mb(3).text_size(11).font_semibold().text_color(NIGHT.muted).child(r.section)
        : this.taskRowView(r, complete)));
  }

  // One checklist row. Local panes click to tick; remote panes render the
  // same row with no click handler (writeTextFile takes no `on`). A complete
  // change reads green all through, like the panel's row.
  taskRowView(row, complete) {
    const el = h_flex().id(`openspec-task-${row.line}`).flex_none().items_start().gap(8).px(6).py(2).rounded(4)
      .child(div().flex_none().w(14).text_size(14).line_height("20px")
        .text_color(row.done ? NIGHT_MD.done : NIGHT.faint).child(row.done ? "✓" : "○"))
      .child(div().flex_1().min_w(0).text_size(13).line_height("20px")
        .text_color(complete ? NIGHT_MD.done : NIGHT.fg).child(row.full || " "));
    if (!this.machine) {
      el.cursor_pointer().hover((s) => s.bg(NIGHT.bgAlt)).on_click((_e, cx) => this.toggleTask(row, cx));
    }
    return el;
  }

  render(cx) {
    const t = theme();
    if (typeof props()?.menuFor === "string" || props()?.commandsFor) return this.menuView(t);
    if (typeof props()?.file === "string") return this.changeView();
    if (props()?.archiveFailed && typeof props().archiveFailed === "object") return this.failureView();
    if (key() !== this.context) this.refresh(cx);
    const sections = visibleSections(this);
    const rows = sections.flatMap((s) => s.rows);
    const done = rows.reduce((n, c) => n + c.done, 0), total = rows.reduce((n, c) => n + c.total, 0);
    const filtering = Boolean((this.filter || "").trim());
    const where = this.root ? `${this.on ? `${this.on}: ` : ""}${this.root}` : null;
    // Headers (and the divider between sections) only when a linked worktree
    // renders. With one worktree the list is exactly its old self.
    const showHeads = sections.some((s) => !s.own);
    const ownHasChanges = this.ownHasChanges;
    const body = showHeads
      ? sections.flatMap((s, i) => [
        ...(i > 0 ? [div().h(1).mx(6).my(3).flex_none().bg(t.border)] : []),
        this.sectionHead(s, t),
        ...(s.error
          ? [div().px(8).py(3).text_size(11).text_color(t.dim).child(s.error)]
          : this.sectionRows(s.rows, t)),
      ])
      : this.sectionRows(rows, t);
    return v_flex().id("openspec").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background)
      .border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (e.key === "escape" && this.typing) { this.clearFilter(cx); cx.stop_propagation(); }
      })
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("OpenSpec"))
        .child(div().px(5).py(1).rounded(4).border_1().border_color(t.border).text_size(10).text_color(t.muted)
          .child(filtering && this.changes.length ? `${rows.length}/${this.changes.length}` : `${rows.length} change${rows.length === 1 ? "" : "s"}`))
        .when(total > 0, (e) => e.child(div().px(5).py(1).rounded(4).border_1().border_color(t.border).text_size(10).text_color(t.muted)
          .child(`${done}/${total} tasks`)))
        .child(div().flex_1())
        .child(div().id("openspec-refresh").px(6).rounded(6).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => this.refresh(cx)).text_color(t.dim).text_size(13).child("↻"))
        .when(Boolean(props()?.overlay), (e) => e.child(div().id("openspec-close").px(6).rounded(6).cursor_pointer()
          .hover((s) => s.bg(t.hover)).text_color(t.dim).text_size(13)
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click((_e, cx) => closeOverlay(props().overlay)).child("×"))))
      .child(h_flex().h(30).flex_none().px(10).gap(6).items_center().border_b(1).border_color(t.border)
        .child(div().id("openspec-filter").flex_1().min_w(0).h(24).px(8).flex().items_center().rounded(7)
          .border_1().border_color(this.typing ? t.accent : t.border).cursor_text()
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .child(Input.new(this.input).h_full().text_size(12).text_color(t.foreground)))
        .when(filtering, (e) => e.child(div().id("openspec-clear").size(22).flex_none().flex().items_center().justify_center().rounded(5)
          .text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click((_e, cx) => this.clearFilter(cx)).child("×")))
        .when(this.root, (e) => e.child(h_flex().id("openspec-commands").h(24).px(8).flex_none().flex().items_center().rounded(7).border_1().border_color(t.border)
          .text_size(11).text_color(t.muted).cursor_pointer()
          .hover((s) => s.text_color(t.foreground))
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click((_e, cx) => this.openCommands(cx))
          .child(div().min_w(0).truncate().child("Commands ▾"))))
        .when(ownHasChanges, (e) => e.child(h_flex().id("openspec-bulk-archive").h(24).px(8).gap(5).flex_none().flex().items_center().rounded(7).border_1().border_color(t.border)
          .text_size(11).text_color(t.muted).cursor_pointer()
          .hover((s) => s.text_color(t.foreground))
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click((_e, cx) => this.bulkArchive(cx))
          .child(this.handoffBusy && this.handoffKind === "bulk"
            ? svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.dim).spin(900)
            : svg("mods/openspec/archive.svg").size(12).flex_none())
          .child(div().min_w(0).truncate().child("Bulk archive"))))
        .child(div().id("openspec-sort").h(24).px(8).flex_none().flex().items_center().rounded(7).border_1().border_color(t.border)
          .text_size(11).text_color(t.muted).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click((_e, cx) => {
            this.sort = SORTS[(SORTS.findIndex((s) => s.id === this.sort) + 1) % SORTS.length].id;
            localStorage.setItem("sort", this.sort);
            cx.notify();
          })
          .child(`↕ ${SORTS.find((s) => s.id === this.sort)?.label ?? "recent"}`)))
      .child(v_flex().id("openspec-list").flex_1().min_h(0).overflow_y_scrollbar().p(6).gap(2)
        .children(body)
        .when(!sections.length, (e) => e.child(div().p(8).text_color(t.dim)
          .child(filtering && this.changes.length ? `No changes match “${this.filter.trim()}”`
            : this.error || (this.loading || !this.context ? "Loading changes…"
              : !this.root ? "No folder"
                : this.ownNone && !this.changes.length ? "No OpenSpec here — run `openspec init`"
                  : "No active changes")))))
      .when(Boolean(where), (e) => e.child(h_flex().flex_none().h(26).px(12).items_center().border_t(1).border_color(t.border)
        .child(div().flex_1().min_w(0).truncate().text_size(10).text_color(t.dim).child(where))));
  }
}
