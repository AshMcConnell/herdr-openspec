// OpenSpec panel for the Herdr desktop app: the active space's OpenSpec
// changes, like `openspec list`, but always current. Watches openspec/changes/
// so a ticked task or a new change shows up at once (local spaces only; remote
// spaces fall back to a 15-second poll). Click a change to fold out its task
// list from tasks.md; the box button archives it (openspec archive --yes).
//
// Lives at ~/.config/herdr-app/mods/openspec/.
// https://github.com/AshMcConnell/herdr-openspec — MIT license.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { spaces, panes, focused, exec, readTextFile, watchFolder, theme, props, closeOverlay, notify } from "herdr";

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

// tasks.md -> flat rows: {section} headings and {done, text} checkboxes.
// Continuation lines of a wrapped task are dropped: a panel wants one line each.
function taskRows(text) {
  const rows = [];
  for (const line of (text ?? "").split("\n")) {
    const head = /^#{1,6}\s+(.+)/.exec(line);
    if (head) { rows.push({ section: head[1].trim() }); continue; }
    const box = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)/.exec(line);
    if (box) rows.push({ done: box[1].toLowerCase() === "x", text: box[2].trim() });
  }
  return rows;
}

// The archive button sits on every row (completed ones a touch brighter);
// hidden while another archive is running.
const showArchive = (c, self) => !self.busy || self.busy === c.name;

export default class OpenSpec extends View {
  init(_props, cx) {
    this.changes = []; this.tasks = []; this.open = null;
    this.root = null; this.on = null; this.watched = null;
    this.error = null; this.loading = false;
    this.busy = null; this.confirming = null; this.confirmUntil = 0;
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
      this.changes = []; this.tasks = []; this.open = null; this.error = null;
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
        if (this.open && !this.changes.some((c) => c.name === this.open)) { this.open = null; this.tasks = []; }
        if (this.open) await this.loadTasks(this.open, context);
        this.watch(this.root, cx);
      } catch (e) { if (key() === context) { this.changes = []; this.tasks = []; this.open = null; this.error = String(e); } }
      finally { this.loading = false; cx.notify(); }
    });
  }

  // Reset to an empty, explained panel (no repo, no openspec, a failed run).
  stale(text) { this.root = null; this.changes = []; this.tasks = []; this.open = null; this.error = text; }

  async loadTasks(name, context) {
    const root = this.root, on = this.on;
    if (!root) return;
    const text = await readTextFile(`${root}/openspec/changes/${name}/tasks.md`, { on });
    if (key() !== context || this.open !== name) return;
    this.tasks = text === null ? null : taskRows(text);
  }

  pick(name, cx) {
    this.open = this.open === name ? null : name;
    this.tasks = [];
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

  taskLine({ section, done, text }, t) {
    if (section) return div().id(`os-sec-${section}`).h(20).flex_none().flex().items_center().px(8).truncate()
      .text_size(10).font_semibold().text_color(t.dim).child(section);
    return h_flex().id(`os-task-${text.slice(0, 40)}`).h(18).flex_none().px(8).gap(7).items_center()
      .child(div().w(11).flex_none().text_size(11).text_color(done ? t.done : t.dim).child(done ? "✓" : "○"))
      .child(div().flex_1().min_w(0).truncate().text_size(11).text_color(done ? t.dim : t.foreground).child(text || " "));
  }

  row(c, t) {
    const open = this.open === c.name, complete = c.total > 0 && c.done >= c.total;
    const confirming = this.confirming === c.name && Date.now() < this.confirmUntil;
    return v_flex().flex_none()
      .child(h_flex().id(`chg-${c.name}`).h(38).flex_none().px(8).gap(8).items_center().rounded(7).cursor_pointer()
        .when(open, (e) => e.bg(t.selected)).hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.pick(c.name, cx))
        .child(div().flex_1().min_w(0).truncate().font_semibold().child(c.name))
        .when(c.total > 0, (e) => e.child(div().text_size(11).text_color(complete ? t.done : t.muted).child(`${c.done}/${c.total}`)))
        .when(Boolean(c.status) && c.status !== "in-progress",
          (e) => e.child(div().px(5).rounded(4).border_1().border_color(t.border).text_size(10).text_color(complete ? t.done : t.muted).child(c.status)))
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
        .child(div().h_full().rounded(2).bg(complete ? t.done : t.accent).w(`${Math.round(100 * c.done / c.total)}%`))))
      .when(open, (e) => e.child(v_flex().flex_none().pl(16).pb(4)
        .when(this.tasks === null, (el) => el.child(div().px(8).py(3).text_size(11).text_color(t.dim).child("No tasks.md")))
        .when(Array.isArray(this.tasks), (el) => {
          const rows = this.tasks.slice(0, 120);
          return el.children(rows.map((r) => this.taskLine(r, t)))
            .when(this.tasks.length > 120, (el2) => el2.child(div().px(8).py(2).text_size(10).text_color(t.dim)
              .child(`+ ${this.tasks.length - 120} more in tasks.md`)))
            .when(!this.tasks.length, (el2) => el2.child(div().px(8).py(3).text_size(11).text_color(t.dim).child("No tasks yet")));
        })));
  }

  render(cx) {
    if (key() !== this.context) this.refresh(cx);
    const t = theme();
    const done = this.changes.reduce((n, c) => n + c.done, 0), total = this.changes.reduce((n, c) => n + c.total, 0);
    const where = this.root ? `${this.on ? `${this.on}: ` : ""}${this.root}` : null;
    return v_flex().id("openspec").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background)
      .border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("OpenSpec"))
        .child(div().px(5).py(1).rounded(4).border_1().border_color(t.border).text_size(10).text_color(t.muted)
          .child(`${this.changes.length} change${this.changes.length === 1 ? "" : "s"}`))
        .when(total > 0, (e) => e.child(div().px(5).py(1).rounded(4).border_1().border_color(t.border).text_size(10).text_color(t.muted)
          .child(`${done}/${total} tasks`)))
        .child(div().flex_1())
        .child(div().id("openspec-refresh").px(6).rounded(6).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => this.refresh(cx)).text_color(t.dim).text_size(13).child("↻"))
        .when(Boolean(props()?.overlay), (e) => e.child(div().id("openspec-close").px(6).rounded(6).cursor_pointer()
          .hover((s) => s.bg(t.hover)).text_color(t.dim).text_size(13)
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click((_e, cx) => closeOverlay(props().overlay)).child("×"))))
      .child(v_flex().id("openspec-list").flex_1().min_h(0).overflow_y_scrollbar().p(6).gap(2)
        .children(this.changes.map((c) => this.row(c, t)))
        .when(!this.changes.length, (e) => e.child(div().p(8).text_color(t.dim)
          .child(this.error || (this.loading || !this.context ? "Loading changes…" : this.root ? "No active changes" : "No folder")))))
      .when(Boolean(where), (e) => e.child(h_flex().flex_none().h(26).px(12).items_center().border_t(1).border_color(t.border)
        .child(div().flex_1().min_w(0).truncate().text_size(10).text_color(t.dim).child(where))));
  }
}
