# Legacy `game-ui.ts` Mount Retirement + Browser Spec Rewrite — Design

Date: 2026-08-10
Status: Design — pending spec review

Follow-on to `2026-08-09-light-theme-mobile-first-shell-design.md`, which is
Approved for the shell/theme/presentation work. This document covers the
remaining legacy-retirement scope that the shell design intentionally left in
place: the `game-ui.ts` mount, everything it still owns, and the browser-spec
rewrite that lets the new `.city-ui` shell become the only UI surface.

## 1. Goal

Remove the legacy `apps/game/src/game-ui.ts` renderer as a mounted UI surface.
Replace it with a slim bootstrap adapter that owns only what the new shell
cannot yet own (the WebGL canvas), historic remaining bindings, and rewrite
every browser spec that locates legacy DOM so the test suite drives the pure
new `.city-ui` shell. Closure is a state in which the legacy `GameUi` interface
no longer exists as a live contract and no browser spec references legacy
testids, `data-*` attributes, a11y names, or legacy CSS classes.

## 2. Background and Current State (verified on head)

The new shell (`apps/game/src/ui/shell/*`, mounted by `mountCityUi` via
`apps/game/src/ui/city-ui-runtime.ts`) is now the primary presentation layer:

- `bottom-nav.ts` — tabs with testids `nav-navigate`, `nav-terrain`,
  `nav-roads`, `nav-zones`, `nav-buildings`; emits category via `data-navCategory`
  and `aria-pressed`.
- `subtool-tray.ts` — testid `subtool-tray`, `hidden` until a category tab is
  selected; tools carry `data-toolMode` (terrain Raise/Lower/Flatten; roads
  Build Road/Bulldoze Road; zones Residential/Commercial/Industrial/Remove
  Zone; buildings Bulldoze Building).
- `brush-stepper.ts` — `aria-label` "Brush N × N", `data-brushSize`,
  `aria-pressed`.
- `tool-context-sheet.ts` — testids `tool-context-name`, `tool-context-state`,
  `tool-context-toggle`, `tool-context-content`; presents projection
  mode/name/state/message/requestedCells/effectiveCells/affordability.
- `game-hud.ts` — metric chips `data-metric` population/treasury/net/demand/
  gameTime; chip buttons open the related management panels.
- `simulation-controls.ts` — Paused/1×/2×/4×/Step buttons (a11y labels).
- `top-actions.ts` — Information Views / City / Game Menu.

`CityUiPorts` in `city-ui-runtime.ts` already surfaces: `setSpeed`, `step`,
`selectTool`, `setTerraformBrush`, `submitTaxPolicy`, `setInformationView`,
`saveWorld`, `loadWorld`, `rotateLeft`, `rotateRight`, `resetCamera`,
`toggleGrid`, `setQuality`, `rciRegistries`.

The management dialogs in `apps/game/src/ui/systems/city-system-dialogs.ts`
(`openCity`, `openEconomyTaxation`, `openPopulationRci`,
`openSimulationTime`) reuse `createEconomyViewProjection` and
`createRciHudModel` and are a verified superset of the legacy panel HUDs:

- City overview: population, households, housing, employment, treasury, net,
  game time.
- Economy overview: income, expenses, net, current/previous period,
  residential/commercial/industrial revenue, road maintenance, player actions.
- Taxation: the same selects and button as the legacy budget HUD — testids
  `tax-residential`, `tax-commercial`, `tax-industrial`, `apply-tax-policy` are
  preserved in the new dialog.
- Population-RCI: residential/commercial/industrial demand split.
- Zoning: zone counts. Roads: road-cell count.
- Simulation time: calendar + tick.

The legacy `mountRciHud` and `mountEconomyBudgetHud` (which mount into
`ui.panel` with testids `rci-*` / `economy-*` metrics) are therefore redundant:
their data is fully rendered by the dialogs. The legacy `rci-*` / `economy-*`
metric testids will be removed with the legacy panel.

Legacy still owns, by verified inspection:

1. The WebGL canvas — `renderGameUi` creates `<canvas id="game-canvas">`;
   `bootstrapGame` needs a canvas host for the renderer.
2. `game-time-ui.ts` (`mountGameTimeUi`) — mounts into the legacy
   `.game-hud` / `.secondary-controls` DOM: game status, building counts
   (construction/active/total), `game-calendar`.
3. Undo — the legacy `undo-button`; the new `tool-context-sheet` shows an
   undo-availability pill but exposes no clickable undo action.
4. Status text — `ui.setStatus` (transient messages such as save results and
   transaction errors); the shell has no status surface.
5. Tool/tool-mode mirroring on the legacy dock (superseded by the shell's
   `data-toolMode` tray buttons).
6. `measureViewport`, grid/quality/brush reflectors, camera buttons
   (superseded by `CityUiPorts` + Game Menu).

`bootstrapGame` (`apps/game/src/game-bootstrap.ts`, ~2265 lines) consumes the
multi-member `GameUi` contract (~30 members). `main.ts` imports `renderGameUi`,
`bootstrapGame`, `bindGameKeyboardShortcuts`, `createGameTimePresentation`,
`mountGameTimeUi`, `createSimulationRuntime`, tool-hud/tool-context bindings,
`expandGameSecondaryControls`, `undoTransaction`, `mountCityUi`.

Browser-test failures on this branch have two verified root causes:

1. The legacy mount is hidden (`[hidden]`) while the new shell trays stay
   `hidden` until their category is opened — `getByRole(..., { pressed })`
   drives against stale clipped page state.
2. `game-ui.test.ts` asserts the legacy surface directly, and a
   `primary-world-tools` testid was deleted this branch.

## 3. Decisions (from brainstorming)

1. **Full retirement, not coexistence.** The legacy `game-ui.ts` mount is
   removed from `main.ts`. There is no dual-mount transitional mode; the shell
   is the only UI.
2. **New slim adapter.** `bootstrapGame`'s `GameUi` dependency is replaced by a
   narrow bootstrap contract that owns only the canvas and the bindings that
   must live outside the shell (see §5).
3. **All browser specs rewritten to the new shell.** Any spec locating legacy
   DOM is updated in the same effort; none remain referencing legacy
   testids/`data-*`/a11y names/classes.
4. **RCI + economy panel HUDs removed.** `mountRciHud` / `mountEconomyBudgetHud`
   are not migrated; their metrics live in `openCity` `/ openPopulationRci` /
   `openEconomyTaxation` dialogs.
5. **Undo gets a real shell surface.** A clickable Undo action is added next to
   the existing undo-availability presentation in the tool context sheet.
6. **Status text gets a shell home.** A transient status line is added to the
   context sheet (or a Game Menu status line), consuming the legacy
   `setStatus` feed.
7. **Approach: incremental retirement (Approach A).** Land the legacy removal
   behind sequenced commits so each step is individually verifiable (see §9).
8. **Branch context.** This lands inside the current "light theme + mobile-first
   uniform shell" branch after the shell/theme plan, not on a separate branch.

## 4. Non-Goals

- No Save schema change, no domain/core behavior change, no simulation change.
- No `isMobile` branching (inherited from shell design).
- No undo/redo semantic change — only its shell presentation.
- No re-theming of the legacy dock: it is removed, not polished.
- No new UI framework runtime.
- Browser-signal/camera/grid/quality semantics unchanged.

## 5. Design

### 5.1 Slim bootstrap contract (replaces `GameUi`)

`bootstrapGame` is refactored to accept a narrow contract (name TBD at plan
time, candidate `GameBootstrapHost`) with only:

- `readonly canvas: HTMLCanvasElement` — the WebGL/Canvas host, created by the
  adapter with `id="game-canvas"` and kept for renderer/resize/keyboard
  targeting.
- Callbacks the shell cannot express yet, if any remain after step-by-step
  deferral (see §9). The goal is for every such callback to find a shell home
  and for the contract to shrink to just `canvas` at closure.

The full member-by-member mapping (`ui.setStatus` → status line, `ui.setUndoAvailable` →
context-sheet undo state, `ui.setToolMode`/`setBrushSize` → tray, `ui.measureViewport` →
viewport observer, buttons → Game Menu / ports, `renderToolPresentation` → dropped in
favor of shell tool context) is enumerated as an explicit table at plan time in the
owning plan's Runtime Contract appendix; the table is the acceptance checklist for
"nothing lost".

### 5.2 What moves, and where

| Legacy-owned item | New home |
| --- | --- |
| WebGL canvas (`game-canvas`) | Adapter-owned full-bleed canvas; `id` retained for keyboard/resize users |
| `mountGameTimeUi` (status, building counts, calendar) | Rebuilt inside the shell: calendar + building counts in `game-hud.ts`; status → context-sheet status line |
| Undo button | Tool context sheet — clickable Undo button beside the undo-availability pill |
| `rci-hud` / `economy-budget-hud` panels | Removed; superseded by dialogs (§2) |
| Grid / quality / brush / camera CDATA | Existing `CityUiPorts` + Game Menu entries |
| Legacy tool-context assertions in specs | Rewritten to `tool-context-*` testids |

### 5.3 Tool context sheet gains Undo + status

`tool-context-sheet.ts` adds:

- An Undo button owned by the player shell, enabled via the existing
  undo-available signal, wired to `undoTransaction` through `CityUiPorts`
  (testid `tool-context-undo`).
- A transient status line fed by the bootstrap status callback when no tool
  projection is active (testid `tool-context-status`).

### 5.4 `main.ts` rewiring

- `renderGameUi` removed; legacy mount call sites deleted.
- `mountGameTimeUi`/`createGameTimePresentation` moved to a shell-facing
  constructor wired to `game-hud.ts`.
- `bindGameToolHud`, `bindGameToolContext`, `expandGameSecondaryControls`
  re-pointed at shell elements (they already consume `tool-context-*` where
  the shell mirrors legacy testids; remaining `secondary-controls` references
  dropped).
- `bindGameKeyboardShortcuts`, `undoTransaction` unchanged in semantics.

### 5.5 Game status / setStatus feed

The bootstrap status callback has no legacy DOM. A small status adapter writes
into the context-sheet status line; the adapter is removed once the context
sheet owns status natively.

## 6. Browser Spec Rewrite Matrix

Every spec touching legacy DOM is rewritten to drive the new shell. The full
spec→locator inventory is enumerated at plan time (the owning plan adds a
complete matrix); known classes today:

- `getByRole(..., { pressed })` loops over hidden legacy dock buttons → drive
  `bottom-nav` tabs (`nav-*`) then the matching tray tool (`data-toolMode`).
- `game-ui.test.ts` → replaced by shell-surface coverage (bottom-nav, tray,
  context sheet, HUD chips, simulation controls) using the new testids.
- `primary-world-tools`-style deleted/hidden testids → tray-based locators.
- `rci-population` / `economy-treasury`-style metric reads → assert chip values
  (`data-metric`) and/or dialog rows by their accessibility names.
- `tax-residential` / `tax-commercial` / `tax-industrial` / `apply-tax-policy`
  → **unchanged**; the new dialogs reuse these exact testids.
- Legacy class selectors (`.panel`, `.tool-context`, `.undo-button`,
  `.secondary-controls`, `.game-hud`, `.primary-tool-surface`) → shell
  testids/roles; none remain.

## 7. Ownership, Level 2, and Verification

- Owner: `apps/game` (shell, bootstrap, dialogs, main wiring; unit + typecheck).
- Level 2 consumers: `game`; no core/three package contract changes (colors in
  the shell plan are the only *-three touch and are already covered by the
  approved shell design). `city-system-dialogs.ts` reuse keeps RCI/economy
  three via `apps/game` only.
- Browser: affected ownership tags `@smoke @terrain @water @road @zoning
  @building @rci @interaction @visual` during development; full unfiltered
  project authority at closure.
- Determinism: no domain change; Save-compat suite stays green.
- Tooling note: repository bash/montage tooling is currently degraded on this
  machine (prefer native read/grep and the `pnpm --filter` test/typecheck loops;
  run browser subsets only when needed).

## 8. Documentation

- `docs/systems/city-ui/README.md` — update to a single-shell architecture;
  note the bootstrap adapter and removal of the legacy panel mount.
- New ADR: `docs/systems/city-ui/adrs/2026-08-10-legacy-game-ui-mount-retirement.md`
  — records full legacy retirement, the slim adapter owning only transport/
  canvas, RCI+economy dialog supersession, and the spec-rewrite mandate.
- Update the city-ui TDD/verification docs for the rewritten spec surface.

## 9. Milestones (Approach A — incremental retirement)

Each step keeps the suite green (rewriting specs in the same step where the
surface it depends on is removed):

1. **Adapter + canvas.** Introduce the slim bootstrap contract; `GameUi`
   shrinks to canvas + remaining bindings. No observable change.
2. **Game-time/status/undo into the shell.** `game-hud.ts` gains calendar +
   building counts; context sheet gains Undo + status; legacy mounts removed.
3. **Bindings rewired.** Tool-hud/tool-context/keyboard/secondary-controls
   re-pointed at shell elements; legacy dock removal of remaining
   `setToolMode`/`setBrushSize`/button mirrors.
4. **Browser-spec rewrite.** Full matrix applied; `game-ui.test.ts`
   superseded; no legacy locator remains.
5. **Docs + closure.** README/ADR/TDD updates; `pnpm verify`; final
   `pnpm verify:full` as gym ownership evidence.

## 10. Open Questions (resolve at plan time, not blocking this design)

- Exact per-member `GameUi` → host mapping table (§5.1) and any callback with
  no shell home discovered while enumerating.
- Whether the canvas id `game-canvas` additionally serves Playwright
  screenshots (kept regardless; cheap).
- Exact list of browser specs whose locators must change (full inventory in the
  owning plan's matrix).
- New testids for Undo/status (`tool-context-undo` / `tool-context-status`
  proposed) confirmed against existing shell conventions during the plan.

## 11. Definition of Done

- No `GameUi` interface member remains consulted by `apps/game` runtime;
  `game-ui.ts` removed or reduced to the transport adapter.
- No browser spec references a legacy testid/`data-*`/a11y/class locator.
- RCI + economy panel HUD code removed; metrics verified in dialogs.
- Calendar, building counts, status, and Undo visibly function from the shell.
- README + ADR + city-ui TDD/verification docs current.
- `pnpm verify` passes; full browser authority passes at closure.