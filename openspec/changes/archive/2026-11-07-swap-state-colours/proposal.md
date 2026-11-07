# Proposal: Swap the two state colours

## Why

Nearly done and in progress wear the wrong colours. "Nearly done" (at most 2
tasks left) reads yellow — the working colour — while "in progress" reads
blue — the accent. Blue sits next to green, so a nearly finished change
should read blue and an in-progress one should read yellow: the eye should
see "almost done" as almost green, not as still working.

## What Changes

- **Progress bar colour** (`change-state` delta): a nearly-done bar takes
  the accent colour and an in-progress bar takes the working colour (the two
  are swapped); complete stays the done colour.
- **State chips** (`change-state` delta): the nearly-done `N left` chip is
  accent-coloured rather than working-coloured. The complete chip stays
  green.
- **The change list** (`mods/openspec/main.js`): the three colour picks swap
  to match — the bar, the `N left` chip, and the "Nearly done" group header.
  README's chip wording follows ("blue" rather than "amber").

## Impact

- `mods/openspec/main.js` and README.md; no new programs, no network.
- Only the change list is touched; the change viewer keeps its fixed Tokyo
  Night palette.
- The "In progress" group header stays muted grey, as it is today.
