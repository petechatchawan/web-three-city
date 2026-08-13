# Legacy `game-ui.ts` Mount Retirement — Verification / Closure Record

**Date:** 2026-08-10
**Status:** Implementation complete; automated verification in progress

## Delivered behavior

- The `.city-ui` shell is the only mounted UI surface; `renderGameCanvas`
  mounts only the WebGL canvas via the slim `GameBootstrapHost` contract.
- Undo (`tool-context-undo`), transient status (`tool-context-status`), the
  calendar, and building lifecycle counts live in the shell.
- RCI + Economy panel HUD mounts removed; metrics verified in the City /
  Population-RCI / Economy dialogs.
- Every browser spec drives the shell; no legacy locator remains.
- Terraform rejection status restored through `onTerraformReject`.
- Dead legacy CSS and panel-HUD mount code removed.
- `clickGameMenuAction` falls back to a forced click if the Game Menu
  button cannot stabilize under heavy parallel load (swiftshader CPU
  contention), removing a rare load-induced flake.

## `pnpm verify:full` status (acceptance boundary)

`pnpm verify:full` (frozen-lockfile install → verify → playwright install →
full browser suite → clean-worktree gate) was run on this working tree:
install, verify, playwright install, and the browser suite all pass; the
browser run was 128/129 on first attempt (one load-induced flake, since
hardened and re-verified 129/129 in a full single run) and 129/129 after.
The final `tooling/verify-clean-worktree.mjs` gate requires a completely
clean tree, so it cannot pass while the retirement work itself is
uncommitted — per the closure plan, that gate runs on the exact head after
the work is committed/merged.

## Automated inventory

- Game Vitest: 75 files / 306 tests passing (`pnpm --filter @web-three-city/game test`).
- Game + browser-test typecheck passing (`tsc --noEmit`).
- Browser Playwright: 26 specs / 129 tests. Full single-run local result
  (`npx playwright test --reporter=list`, `retries: 0`, `workers: 2`, no
  timeout or filter changes): **129 passed / 129 in 10m 0s** (exit 0). The
  pass/fail set matches the earlier chunked runs exactly (38 + 42 + 15 +
  33 + 1), with the single formerly-failing hash test now green — the
  suite is fully green end to end.
- `pnpm verify` passes on the exact working tree (format:check, lint,
  typecheck, provenance:check, test:deployment 54/54, workspace tests,
  build).

## Resolved: stale Water geometry hash (root cause)

- `water.@water.spec.ts` — "Water geometry bytes and hash are deterministic"
  was failing: it expected `geometrySha256: 'a9d773…'` but computed
  `95ae89…`. Root cause: commit `0cee923` ("theme: light palette, sky,
  transparent renderer", 2026-08-09) intentionally brightened the water
  surface/shoreline/wall color constants in `water-core`
  (`water-chunk-mesher.ts`, `water-wall-mesher.ts`). The spec's hash covers
  the mesher color arrays, so the hash changed — the commit updated the
  water-core unit tests but missed the browser spec's `geometrySha256`
  expectation (introduced earlier at `48919fb` against the old palette). All
  count assertions (6440 sea triangles, 188 shoreline segments, 754710
  geometry bytes) were unaffected.
- Fix: the spec expectation was updated to the current deterministic value
  `95ae8947b844f08081314736c46cfbbb48348d1134c589411919102e3c5a0e60`
  (one-line change; no geometry/source change). Full water spec file:
  **8/8 passed**; full suite now **129/129**.

## Manual Acceptance script

1. Open the exact verified Game candidate at 1440×900.
2. Confirm only the canvas + `.city-ui` shell are mounted: no legacy dock,
   panel, or sidebar anywhere in the DOM.
3. Select tools from the bottom nav + subtool tray; place Road/Zone/Terrain;
   confirm the tool context sheet shows name/state/message, metric chips, and
   the Undo button.
4. Build, then Undo from the context sheet; confirm status transitions
   ("Road built" → Undo → "Road undone") and that the state resets from
   "Applying change" to "Ready".
5. Trigger a blocked Terraform stamp on a building/zone/road support cell and
   confirm the matching status ("Terraform blocked by building" etc.).
6. Open City → Economy → Taxation; change and apply a tax rate; confirm
   Treasury/Net refresh live in the dialog and in the HUD.
7. In Navigate mode, inspect a Building, Road, Zone, and Terrain cell and
   confirm deterministic priority and player-safe content.
8. Repeat layout smoke at 390×844 and 844×390; confirm no overflow and no
   hidden required control.

## Acceptance boundary

`pnpm verify` passes on this working tree. This record does not declare the
milestone CLOSED / PASS until the owner completes Manual Acceptance of the
verified candidate and, per the closure plan, runs `pnpm verify:full` on the
exact head.
