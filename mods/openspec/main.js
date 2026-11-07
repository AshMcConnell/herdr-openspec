// OpenSpec panel for the Herdr desktop app: the active space's OpenSpec
// changes, like `openspec list`, but always current. Watches openspec/changes/
// so a ticked task or a new change shows up at once (local spaces only; remote
// spaces fall back to a 15-second poll). Click a change to fold out its task
// list from tasks.md; click a task to tick or untick it in the file itself
// (local only); right-click it for a small menu (Copy name; View proposal
// opens the change's proposal.md beside the work, drawn in Tokyo Night — the
// owner's Obsidian theme — by the mod's own markdown renderer, since the
// TextView component styles itself from the app theme and reads flat); the
// box button archives it (openspec archive --yes).
//
// Lives at ~/.config/herdr-app/mods/openspec/.
// https://github.com/AshMcConnell/herdr-openspec — MIT license.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { spaces, panes, focused, exec, readTextFile, writeTextFile, watchFolder, theme, props, openOverlay, closeOverlay, notify, run, settings } from "herdr";

// Where we are: a `folder` prop if the layout or pane.split gave one, else the
// focused pane's live folder, else any pane with one in the active space (any
// tab — this mod's own pane has none), else the space's. `on` is the machine
// that folder lives on (null: this one).
function location() {
  const pinned = typeof props()?.folder === "string" ? props().folder : null;
  const space = spaces().find((s) => s.active), f = focused();
  const all = panes(), tabs = new Set((space?.tabs ?? []).map((c) => c.id));
  const pane = f?.pane ? all.find((p) => p.pane === f.pane && p.cwd) : null;
  const any = all.find((p) => tabs.has(p.tab) && p.cwd);
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pinned || pane?.cwd || any?.cwd || f?.cwd || space?.folder || null, on };
}
const key = () => JSON.stringify(location());

const ago = (at) => {
  if (!at) return "";
  const d = Math.max(0, Date.now() - at);
  return d < 60000 ? "just now" : d < 3600000 ? `${Math.max(1, Math.round(d / 60000))}m ago`
    : d < 86400000 ? `${Math.round(d / 3600000)}h ago` : d < 86400000 * 60 ? `${Math.round(d / 86400000)}d ago`
    : `${Math.round(d / (86400000 * 30))}mo ago`;
};

// tasks.md -> flat rows: {section} headings and {done, line, text} checkbox
// rows. Continuation lines of a wrapped task are dropped: a panel wants one
// line each. Each checkbox remembers its line in the file — the click that
// ticks it rewrites exactly that line.
function taskRows(text) {
  const rows = [];
  (text ?? "").split("\n").forEach((line, i) => {
    const head = /^#{1,6}\s+(.+)/.exec(line);
    if (head) { rows.push({ section: head[1].trim() }); return; }
    const box = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)/.exec(line);
    if (box) rows.push({ done: box[1].toLowerCase() === "x", line: i, text: box[2].trim() });
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

// The archive button sits on every row (completed ones a touch brighter);
// hidden while another archive is running.
const showArchive = (c, self) => !self.busy || self.busy === c.name;

// The row's right-click menu: what each item does with the change's name.
// More items append here; the popup renders them in order. Items take
// (name, cx, at) where `at` is { root, on }: the repository root and machine
// the panel had resolved when the menu opened (null when it found none).
const MENU = [
  { label: "Copy name", run: (name, cx) => {
    cx.write_to_clipboard(name);
    notify({ title: "Name copied", body: name, level: "success" });
  } },
  { label: "View proposal", run: (name, cx, at) => {
    if (!at?.root) { notify({ title: "No repository yet", body: "The panel is still finding this folder", level: "error" }); return; }
    run("pane.split", { direction: "right", mod: "openspec",
      props: { file: `${at.root}/openspec/changes/${name}/proposal.md`, change: name, on: at.on ?? null } });
  } },
];

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

const STATES = [
  { id: "complete", label: "✓ Complete", chip: "✓ complete", color: "done" },
  { id: "nearly", label: "Nearly done", chip: null, color: "working" },
  { id: "progress", label: "In progress", chip: null, color: "muted" },
  { id: "unstarted", label: "Unstarted", chip: "unstarted", color: "muted" },
  { id: "draft", label: "No tasks", chip: "no tasks", color: "dim" },
];

// Tokyo Night (dark) — the owner's Obsidian theme, as constants (the mod must
// not read a vault's CSS or depend on Obsidian paths). Proposal viewer only;
// the change list keeps the app theme.
const NIGHT = {
  bg: "#1a1b26",    // --background-primary
  bgAlt: "#16161e", // --background-secondary (header/footer chrome)
  border: "#292e42",// --background-modifier-border
  fg: "#c0caf5",    // --text-normal
  muted: "#a9b1d6", // --text-muted (the proposal.md chip)
  faint: "#565f89", // --text-faint (footer path, loading/absent/empty states)
  error: "#db4b4b", // --text-error (read failure)
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
  quoteBar: "#565f89",// Obsidian's default --blockquote-border-color: var(--text-faint) — the theme sets only the background
  quoteBg: "#16161e", // --blockquote-background-color: var(--bg_dark)
  hr: "#292e42",      // Obsidian's default --hr-color: var(--background-modifier-border)
  marker: "#565f89",  // Obsidian's default --list-marker-color: var(--text-faint)
  done: "#9ece6a",    // --checkbox-color: var(--green) (a checked task box)
};

function stateOf(c) {
  if (c.total > 0 && c.done >= c.total) return "complete";
  if (c.total === 0) return "draft";
  if (c.done === 0) return "unstarted";
  if (c.total - c.done <= 2) return "nearly";
  return "progress";
}

// The visible list: the filter (name substring, case-insensitive) applied,
// then the chosen sort. openspec's order is already recent-first; "state"
// sorts by the order of STATES, keeping it inside each group.
function visible(self) {
  const q = (self.filter || "").trim().toLowerCase();
  let rows = q ? self.changes.filter((c) => c.name.toLowerCase().includes(q)) : self.changes;
  if (self.sort === "name") rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
  else if (self.sort === "done") rows = [...rows].sort((a, b) =>
    (b.total ? b.done / b.total : -1) - (a.total ? a.done / a.total : -1) || b.total - a.total);
  else if (self.sort === "state") rows = [...rows].sort((a, b) =>
    STATES.findIndex((s) => s.id === stateOf(a)) - STATES.findIndex((s) => s.id === stateOf(b)));
  return rows;
}

// ---- The proposal body renderer ------------------------------------------
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

// Block cap for a pathological file; proposals are a few KB.
const MAX_MD_BLOCKS = 2000;

// Heading text sizes on the 15px reading size. The theme leaves sizes to
// Obsidian's defaults, which are tuned for a full editor window. This ladder
// is steeper than that: every step is at least 1px so the hierarchy reads at
// a glance (an earlier 1–2px-per-step ladder rendered same-looking headers).
// The pane's title (the change's name) takes MD_HEAD[0] too, so a body `#`
// matches it — deliberate: `#` is rare in proposals and the title should
// lead. h6 at 14px sits just under body size; its magenta does the rest.
const MD_HEAD = [
  { size: 24, lh: "32px" }, { size: 20, lh: "27px" }, { size: 17.5, lh: "24px" },
  { size: 16, lh: "22px" }, { size: 15, lh: "21px" }, { size: 14, lh: "20px" },
];

// proposal.md -> { blocks, truncated }. Blocks are {kind:"h",level,text},
// {kind:"p",text}, {kind:"code",lang,lines}, {kind:"quote",text},
// {kind:"list",items:[{marker,depth,task,text}]} (task: null, or the checkbox
// state), {kind:"hr"}.
function mdBlocks(text) {
  const lines = text.split("\n"), blocks = [];
  let para = null, truncated = false;
  const flush = () => { if (para) { blocks.push({ kind: "p", text: para }); para = null; } };
  for (let i = 0; i < lines.length; i++) {
    if (blocks.length >= MAX_MD_BLOCKS) { truncated = true; break; }
    const line = lines[i];
    if (/^\s*$/.test(line)) { flush(); continue; }
    const fence = /^\s*(`{3,}|~{3,})\s*(\S*)\s*$/.exec(line);
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

// The whole document: the change's name as a title in the exact H1 style (a
// kebab-case name, not a `#` line — the document below renders as-is either
// way), then the blocks; padded so the text never touches the pane's edges
// (the padding scrolls with the content), blocks spaced on a common rhythm.
function mdView(text, title) {
  const { blocks, truncated } = mdBlocks(text);
  const out = [];
  if (title) out.push(h_flex().flex_wrap().items_baseline().flex_none().text_size(MD_HEAD[0].size)
    .line_height(MD_HEAD[0].lh).text_color(NIGHT_MD.h[0]).font_bold()
    .children(mdRuns(mdInline(title), "mdtitle", MD_HEAD[0].size)));
  blocks.forEach((b, i) => {
    const key = `md${i}`;
    if (b.kind === "h") {
      const head = MD_HEAD[b.level - 1];
      out.push(h_flex().flex_wrap().items_baseline().flex_none().text_size(head.size)
        .line_height(head.lh).text_color(NIGHT_MD.h[b.level - 1]).font_bold()
        .when(i > 0, (e) => e.mt(6))
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
    .child("… truncated — the rest of proposal.md is not shown"));
  return v_flex().flex_none().p(14).gap(6).children(out);
}

export default class OpenSpec extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.at = 0; // the right-click menu's keyboard spot
    // The right-click menu popup: no list, no polls, no folder watch.
    if (typeof props()?.menuFor === "string") { this.handle.focus(); return; }
    // The proposal viewer pane (pane.split {mod, props:{file,...}}): reads one
    // file from its props — no list, no location(), nothing that follows focus,
    // so a pane saved with its tab works on its own after a restart.
    if (typeof props()?.file === "string") {
      this.file = props().file;
      this.change = typeof props()?.change === "string" ? props().change
        : (this.file.split("/").filter(Boolean).at(-2) ?? "Proposal");
      this.machine = props()?.on ?? null;
      this.text = undefined; // undefined = loading, null = no proposal.md, string = read
      this.error = null;
      this.load(cx);
      if (this.machine) cx.timer.every(15000, (cx) => this.load(cx));
      else this.watchProposal(cx);
      return;
    }
    this.changes = []; this.tasks = []; this.tasksText = null; this.open = null; this.toggling = null;
    this.root = null; this.on = null; this.watched = null;
    this.error = null; this.loading = false;
    this.busy = null; this.confirming = null; this.confirmUntil = 0;
    this.sort = localStorage.getItem("sort") ?? "recent";
    if (!SORTS.some((s) => s.id === this.sort)) this.sort = "recent";
    this.filter = "";
    this.input = InputState.new({ placeholder: "Filter by name" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); cx.notify(); });
    this.input.on("focus", (_e, cx) => { this.typing = true; cx.notify(); });
    this.input.on("blur", (_e, cx) => { this.typing = false; cx.notify(); });
    this.refresh(cx);
    cx.timer.every(15000, (cx) => this.refresh(cx));
  }

  // Live updates between polls. watchFolder is local-only, so skip remote spaces.
  watch(root, cx) {
    if (this.on || this.watched === root) return;
    this.watched = root;
    cx.spawn(async (cx) => {
      try {
        while (this.watched === root) {
          await watchFolder(`${root}/openspec/changes`);
          if (this.watched === root) this.refresh(cx);
        }
      } catch { this.watched = null; }
    });
  }

  refresh(cx) {
    if (this.loading) return;
    const { cwd, on } = location(), context = key();
    if (context !== this.context) {
      this.context = context; this.root = null; this.on = null; this.watched = null;
      this.changes = []; this.tasks = []; this.tasksText = null; this.open = null; this.error = null;
      this.confirming = null; this.confirmUntil = 0;
    }
    if (!cwd) { this.root = null; return; }
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        let list;
        try {
          list = await exec("openspec", ["list", "--json"], { cwd, on });
        } catch {
          if (key() === context) { this.stale("openspec is not installed"); }
          return;
        }
        if (key() !== context) return;
        if (list.code !== 0) {
          const text = (list.stderr || list.stdout || `openspec list failed (${list.code})`).trim();
          this.stale(/No OpenSpec changes directory/i.test(text) ? "No OpenSpec here — run `openspec init`" : text.split("\n")[0]);
          return;
        }
        let parsed;
        try { parsed = JSON.parse(list.stdout); } catch { this.stale("Unexpected output from openspec list"); return; }
        if (key() !== context) return;
        this.changes = (parsed.changes ?? []).map((c) => ({
          name: c.name, done: c.completedTasks ?? 0, total: c.totalTasks ?? 0,
          at: c.lastModified ? Date.parse(c.lastModified) : null, status: c.status ?? "",
        }));
        this.error = null;
        if (this.confirming && !this.changes.some((c) => c.name === this.confirming)) this.confirming = null;
        // The repo root anchors the folder watch and tasks.md reads.
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on });
        this.root = top.code === 0 ? top.stdout.trim() : cwd;
        this.on = on;
        if (this.open && !this.changes.some((c) => c.name === this.open)) { this.open = null; this.tasks = []; this.tasksText = null; }
        if (this.open) await this.loadTasks(this.open, context);
        this.watch(this.root, cx);
      } catch (e) { if (key() === context) { this.changes = []; this.tasks = []; this.tasksText = null; this.open = null; this.error = String(e); } }
      finally { this.loading = false; cx.notify(); }
    });
  }

  // Reset to an empty, explained panel (no repo, no openspec, a failed run).
  stale(text) { this.root = null; this.changes = []; this.tasks = []; this.tasksText = null; this.open = null; this.error = text; }

  async loadTasks(name, context) {
    const root = this.root, on = this.on;
    if (!root) return;
    const text = await readTextFile(`${root}/openspec/changes/${name}/tasks.md`, { on });
    if (key() !== context || this.open !== name) return;
    this.tasks = text === null ? null : taskRows(text);
    this.tasksText = text;
  }

  // The viewer's refresh: local panes watch the change's own folder
  // (watchFolder is local-only); remote panes and a watch that can't arm
  // fall back to the 15-second poll, like the panel's own remote rule.
  watchProposal(cx) {
    const dir = this.file.replace(/[^/]*$/, "");
    cx.spawn(async (cx) => {
      try { for (;;) { await watchFolder(dir); await this.load(cx); } }
      catch { cx.timer.every(15000, (cx) => this.load(cx)); }
    });
  }

  async load(cx) {
    const file = this.file;
    try {
      const text = await readTextFile(file, { on: this.machine });
      if (this.file !== file) return;
      this.text = text; this.error = null;   // null = absent
    } catch (e) { if (this.file === file) this.error = String(e); }
    cx.notify();
  }

  pick(name, cx) {
    this.open = this.open === name ? null : name;
    this.tasks = [];
    this.tasksText = null;
    this.confirming = null;
    const context = this.context;
    if (this.open) cx.spawn(async (cx) => {
      try { await this.loadTasks(this.open, context); }
      catch { if (key() === context && this.open === name) this.tasks = null; }
      cx.notify();
    });
    cx.notify();
  }

  // Second click of the "Archive?" chip: run openspec archive <name> --yes
  // (exec has no TTY, so prompts must be skipped), then report by toast.
  archive(name, cx) {
    if (this.busy || !this.root) return;
    const { cwd, on } = location(), context = key();
    if (!cwd) return;
    this.busy = name; this.confirming = null;
    cx.spawn(async (cx) => {
      let ok = false, detail = "";
      try {
        const r = await exec("openspec", ["archive", name, "--yes"], { cwd, on });
        ok = r.code === 0;
        detail = ok ? `openspec archive ${name}` : ((r.stderr || r.stdout || `exit ${r.code}`).trim().split("\n").pop() ?? "").slice(0, 300);
      } catch (e) { detail = String(e); }
      if (key() === context) {
        if (this.open === name) { this.open = null; this.tasks = []; }
        this.refresh(cx);
      }
      this.busy = null;
      notify({ title: ok ? "Change archived" : "Archive failed", body: detail, level: ok ? "success" : "error" });
      cx.notify();
    });
    cx.notify();
  }

  // A task click: flip that checkbox line in the change's tasks.md — the
  // file is the truth, and the watch brings the new counts back. Optimistic
  // (the row flips at once), one at a time, local spaces only: writeTextFile
  // takes no `on`. The write is compare-and-swap on the snapshot loadTasks
  // read; a rejection (an agent edited first) re-reads and tries once more,
  // and anything that still fails shows the file's real state and toasts.
  toggle(row, name, cx) {
    if (this.on || !this.root || this.toggling || typeof row.line !== "number") return;
    const path = `${this.root}/openspec/changes/${name}/tasks.md`;
    const line = row.line, task = row.text, to = !row.done, context = key();
    row.done = to; this.toggling = name; cx.notify();
    cx.spawn(async (cx) => {
      let body = this.tasksText, settled = null, why = "";
      try {
        let next = body === null ? null : toggled(body, line, task, to);
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
      if (key() === context && this.open === name && settled !== null) {
        this.tasksText = settled; this.tasks = taskRows(settled);
      }
      this.toggling = null;
      if (why) notify({ title: "Task not updated", body: why, level: "error" });
      if (key() === context) this.refresh(cx);
      cx.notify();
    });
  }

  // A task row: ✓ done / ○ open. Hovering shows the full text (rows and
  // section headings truncate); done tasks read green when their change is
  // complete; local rows click to tick (toggle).
  taskLine(row, t, name, complete) {
    const { section, done, text, line } = row;
    if (section) return div().id(`os-sec-${section}`).h(20).flex_none().flex().items_center().px(8).truncate()
      .text_size(10).font_semibold().text_color(t.dim)
      .when(Boolean(section), (e) => e.tooltip(section)).child(section);
    return h_flex().id(`os-task-${line}`).h(18).flex_none().px(8).gap(7).items_center()
      .child(div().w(11).flex_none().text_size(11).text_color(done ? t.done : t.dim).child(done ? "✓" : "○"))
      .child(div().flex_1().min_w(0).truncate().text_size(11)
        .text_color(done ? (complete ? t.done : t.dim) : t.foreground).child(text || " "))
      .when(Boolean(text), (e) => e.tooltip(text))
      .when(!this.on, (e) => e.cursor_pointer().hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => this.toggle(row, name, cx)));
  }

  row(c, t) {
    const open = this.open === c.name, complete = c.total > 0 && c.done >= c.total;
    const confirming = this.confirming === c.name && Date.now() < this.confirmUntil;
    const state = stateOf(c), remaining = c.total - c.done;
    const chip = (label, color) => div().px(5).rounded(4).border_1().border_color(t.border).text_size(10).text_color(color).flex_none().child(label);
    const barColor = state === "complete" ? t.done : state === "nearly" ? t.working : t.accent;
    return v_flex().flex_none()
      .child(h_flex().id(`chg-${c.name}`).h(38).flex_none().px(8).gap(8).items_center().rounded(7).cursor_pointer()
        .when(open, (e) => e.bg(t.selected)).hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.pick(c.name, cx))
        .on_mouse_down("right", (_e, cx) => {
          cx.stop_propagation();
          openOverlay({ mod: "openspec", kind: "popup", width: 200, height: 240, props: { menuFor: c.name, root: this.root, on: this.on } });
        })
        .child(div().flex_1().min_w(0).truncate().font_semibold().text_color(complete ? t.done : t.foreground).child(c.name))
        .when(c.total > 0, (e) => e.child(div().text_size(11).text_color(complete ? t.done : t.muted).child(`${c.done}/${c.total}`)))
        .when(state === "complete", (e) => e.child(chip("✓ complete", t.done)))
        .when(state === "nearly", (e) => e.child(chip(`${remaining} left`, t.working)))
        .when(state === "unstarted", (e) => e.child(chip("unstarted", t.muted)))
        .when(state === "draft", (e) => e.child(chip("no tasks", t.dim)))
        .when(state === "progress" && Boolean(c.status) && c.status !== "in-progress", (e) => e.child(chip(c.status, t.muted)))
        .when(Boolean(ago(c.at)), (e) => e.child(div().w(64).text_right().text_size(11).text_color(t.dim).flex_none().truncate().child(ago(c.at))))
        .when(this.busy === c.name, (e) => e.child(svg("mods/workspace-chrome/spinner.svg").size(13).flex_none().text_color(t.dim).spin(900)))
        .when(showArchive(c, this), (e) => e.child(confirming
          ? h_flex().id(`arch-${c.name}`).h(22).px(7).flex_none().items_center().rounded(5).bg(`${t.ansi1}22`).text_color(t.ansi1).text_size(10).cursor_pointer()
            .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
            .on_click((_e, cx) => this.archive(c.name, cx)).child("Archive?")
          : div().id(`arch-${c.name}`).size(22).flex_none().flex().items_center().justify_center().rounded(5)
            .text_color(complete ? t.muted : t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
            .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); this.confirming = c.name; this.confirmUntil = Date.now() + 6000; cx.notify(); })
            .child(svg("mods/openspec/archive.svg").size(13)))))
      .when(c.total > 0, (e) => e.child(h_flex().h(3).mx(8).mt(3).mb(2).rounded(2).bg(t.raised).overflow_hidden()
        .child(div().h_full().rounded(2).bg(barColor).w(`${Math.round(100 * c.done / c.total)}%`))))
      .when(open, (e) => e.child(v_flex().flex_none().pl(16).pb(4)
        .when(this.tasks === null, (el) => el.child(div().px(8).py(3).text_size(11).text_color(t.dim).child("No tasks.md")))
        .when(Array.isArray(this.tasks), (el) => {
          const rows = this.tasks.slice(0, 120);
          return el.children(rows.map((r) => this.taskLine(r, t, c.name, complete)))
            .when(this.tasks.length > 120, (el2) => el2.child(div().px(8).py(2).text_size(10).text_color(t.dim)
              .child(`+ ${this.tasks.length - 120} more in tasks.md`)))
            .when(!this.tasks.length, (el2) => el2.child(div().px(8).py(3).text_size(11).text_color(t.dim).child("No tasks yet")));
        })));
  }

  // The right-click popup on a row: MENU's items over the list. Esc and a
  // click beside it close it (the host does both); ↑/↓/Enter pick.
  menuView(t) {
    const name = props().menuFor;
    const choose = (i, cx) => {
      const it = MENU[i];
      if (!it) return;
      it.run(name, cx, { root: props().root ?? null, on: props().on ?? null }); // while the popup (and its cx) is still alive
      closeOverlay(props().overlay);
    };
    return v_flex().id("openspec-menu").track_focus(this.handle).w_full().min_h(0).p(5).bg(t.popover).text_size(12.8)
      .on_key_down((e, cx) => {
        if (e.key === "down") this.at = (this.at + 1) % MENU.length;
        else if (e.key === "up") this.at = (this.at + MENU.length - 1) % MENU.length;
        else if (e.key === "enter") choose(this.at, cx);
        else if (e.key === "escape") closeOverlay(props().overlay);
        else return;
        cx.notify();
      })
      .children(MENU.map((it, i) => h_flex().id(`os-mi-${i}`).h(31).px(8).rounded(7).items_center()
        .text_color(t.foreground)
        .when(i === this.at, (el) => el.bg(t.selected))
        .hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => choose(i, cx))
        .child(div().flex_1().child(it.label))));
  }

  clearFilter(cx) {
    this.filter = "";
    this.input.set_value("");
    this.typing = false;
    this.handle.focus();
    cx.notify();
  }

  // The viewer pane: a slim bar carrying the proposal.md chip over the file
  // drawn by the mod's own markdown renderer (mdView above) — the change's
  // name leads the body as an H1-style title, and headings, links, code,
  // quotes and the text itself all take their colours from the built-in
  // Tokyo Night palette (the owner's Obsidian theme), fixed whatever the app
  // theme is. The document is padded inside its scroll container and is not
  // text-selectable (that was the TextView's doing); the machine-prefixed
  // path sits in a footer.
  proposalView() {
    const where = `${this.machine ? `${this.machine}: ` : ""}${this.file}`;
    return v_flex().id("openspec-proposal").size_full().min_h(0).rounded(10).overflow_hidden().bg(NIGHT.bg)
      .border_1().border_color(NIGHT.border).text_color(NIGHT.fg).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().bg(NIGHT.bgAlt).border_b(1).border_color(NIGHT.border)
        .child(div().flex_1())
        .child(div().px(5).py(1).rounded(4).border_1().border_color(NIGHT.border).text_size(10).text_color(NIGHT.muted).flex_none().child("proposal.md")))
      .child(v_flex().flex_1().min_h(0).overflow_y_scrollbar()
        .when(this.error, (e) => e.child(div().p(10).text_color(NIGHT.error).child(this.error)))
        .when(!this.error && this.text === undefined, (e) => e.child(div().p(10).text_color(NIGHT.faint).child("Loading proposal…")))
        .when(!this.error && this.text === null, (e) => e.child(div().p(10).text_color(NIGHT.faint).child("No proposal.md — this change has none")))
        .when(!this.error && this.text === "", (e) => e.child(div().p(10).text_color(NIGHT.faint).child("proposal.md is empty")))
        .when(!this.error && typeof this.text === "string" && this.text.length > 0, (e) =>
          e.child(mdView(this.text, this.change))))
      .when(Boolean(this.file), (e) => e.child(h_flex().flex_none().h(26).px(12).items_center().bg(NIGHT.bgAlt).border_t(1).border_color(NIGHT.border)
        .child(div().flex_1().min_w(0).truncate().text_size(10).text_color(NIGHT.faint).child(where))));
  }

  render(cx) {
    const t = theme();
    if (typeof props()?.menuFor === "string") return this.menuView(t);
    if (typeof props()?.file === "string") return this.proposalView();
    if (key() !== this.context) this.refresh(cx);
    const rows = visible(this);
    const done = rows.reduce((n, c) => n + c.done, 0), total = rows.reduce((n, c) => n + c.total, 0);
    const filtering = Boolean((this.filter || "").trim());
    const where = this.root ? `${this.on ? `${this.on}: ` : ""}${this.root}` : null;
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
        .children((this.sort === "state" ? (() => { let last = null; return rows.map((c) => {
          const st = stateOf(c);
          if (st === last) return this.row(c, t);
          last = st;
          const meta = STATES.find((s) => s.id === st), count = rows.filter((r) => stateOf(r) === st).length;
          return [div().id(`os-group-${st}`).h(22).flex_none().flex().items_center().px(8).gap(6).truncate()
            .text_size(10).font_semibold().text_color(t[meta.color]).child(meta.label).child(div().text_color(t.dim).child(String(count))), this.row(c, t)];
        }); })() : rows.map((c) => this.row(c, t))).flat())
        .when(!rows.length, (e) => e.child(div().p(8).text_color(t.dim)
          .child(filtering && this.changes.length ? `No changes match “${this.filter.trim()}”`
            : this.error || (this.loading || !this.context ? "Loading changes…" : this.root ? "No active changes" : "No folder")))))
      .when(Boolean(where), (e) => e.child(h_flex().flex_none().h(26).px(12).items_center().border_t(1).border_color(t.border)
        .child(div().flex_1().min_w(0).truncate().text_size(10).text_color(t.dim).child(where))));
  }
}
