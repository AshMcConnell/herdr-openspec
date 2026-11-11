## Context

The panel reads each worktree's `openspec list --json` and shows one row per
change name (the most complete copy, then the freshest). A worktree cut before
a change was archived keeps that change's old folder: `openspec list` there
reports it active, while the panel's own worktree has moved its copy into
`openspec/changes/archive/`. The linked section then carries a stale copy of
finished work (16 such copies in the owner's `godot` repository) beside real
unmerged work.

The archive folder is the record: `openspec/changes/archive/<date>-<name>`.
Its names are not active changes, but they say what the own worktree has
finished.

## Goals / Non-Goals

**Goals:**

- Hide a linked worktree's active copy when the panel's own worktree has
  archived that name.
- Leave the own worktree's active changes and every uniquely active name
  alone.
- Add one read-only command per refresh and no new state.

**Non-Goals:**

- Reading other worktrees' archives; the own worktree is the record.
- Hiding a name that is only archived in a feature branch.
- Changing active change names, paths or commands.

## Decisions

### D1. Read the own worktree's archive once per refresh

Run `find <own-root>/openspec/changes/archive -mindepth 1 -maxdepth 1 -type d`
on the panel's machine, in the same parallel batch as the listings. Map each
folder to a change name by removing a leading `YYYY-MM-DD-`; a folder without
the prefix keeps its name. A missing directory, a failed command or a thrown
read yields an empty set: nothing is hidden and no error surfaces. The archive
is read once per refresh, never per render.

Why only the own worktree: the panel's own worktree is the integration branch
the person is reading, and its archive says what that branch has merged. A
name archived only in a feature branch is not merged on the own branch; if the
own branch still lists it active, it is real work there.

### D2. Hide before the one-row choice

After the sections are built and before duplicate names are resolved (the
one-row rule), drop every non-own row whose name is in the archive set. The
suppressed copy never becomes a candidate, so it cannot win the one-row choice
or be counted in a section header; a uniquely active name still renders its
own section row. The own section's rows are never filtered by its own archive:
if a name is both active and archived there, the active folder is the truth.

### D3. No error state

A hidden copy is not a failure. An unreadable or missing archive leaves the
panel exactly as it was before this change; the listings themselves decide
the empty and error states.

## Risks / Trade-offs

- **Re-created names** — a worktree that deliberately re-creates a name the
  own worktree archived is hidden while its branch still holds it. The new
  work should use a new name; the 15-second poll does not change the result
  because the archive match is stable.
- **Stale archive** — a folder left under `archive/` with no matching merge
  would hide a live name in another worktree. Archive is the record the panel
  trusts; an owner can rename or remove the folder.
- **One extra read** — one `find` per refresh in the own worktree, alongside
  the existing `git` and `openspec` calls; negligible, and only reads names.

## Migration Plan

No data migration. Implement in `mods/openspec/main.js`, sync the snapshot to
`~/.config/herdr-app/mods/openspec/` and reload the panel (AGENTS.md).
Rolling back is reverting the change; the panel reads the same folders and
runs one fewer command.
