# Light Theme + Mobile-First Uniform Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> Design authority: `docs/superpowers/specs/2026-08-09-light-theme-mobile-first-shell-design.md` (approved). This plan executes Milestones 1-6 of that design; the plan introduces ONE extra work item the design implied but did not enumerate: the **committed tool projection feed** into the new context sheet (see Task M3).

**Goal:** Convert the city-ui presentation from dark to a single **light theme** and restructure the player shell into a **mobile-first, breakpoint-uniform** layout: bottom navigation bar, slide-up subtool tray, floating collapsible context sheet, and management panels presented as 90vh bottom sheets. Rendering colors (terrain, water, buildings, zone overlays, sky) become bright daytime values. Dark theme removed; no `isMobile` branching; no Save schema change.

**Architecture:** Committed tool projection flow today ends in the legacy DOM only. `bindGameToolEvents` (`game-tool-events.ts:47`) dispatches on the canvas; `bindGameToolHud` (`game-tool-hud-binding.ts:37`) consumes those events and writes to legacy `[data-testid="tool-context-state"]` / `tool-context-message` / metric elements. The new `.city-ui` shell's `contextual-tool-surface.ts:24` `update()` is invoked ONLY from `mountPlayerShell` `buildDock` selection with a static `Ready` projection (`player-shell.ts:39-57`) — it never receives committed state. To fulfill design §7.3 (context card shows *committed* projection), M3 adds a bridge: a small adapter that subscribes to the same `bindGameToolEvents(canvas)` stream, folds details into `ContextualToolProjection` via a shared pure reducer (reusing `game-tool-hud-binding.ts` label helpers `roadPreviewStateLabel`/`zonePreviewStateLabel` and `messageForGameReason`), and calls the context sheet's `update()`. The legacy `bindGameToolHud` binding and its DOM stays untouched and green.

**Tech Stack:** TypeScript 6, Vite 8, Vitest 4, Happy DOM, Playwright 1.61, pnpm 10.

## Global Constraints

- **Presentation-only.** Tool authority, simulation loop, camera/grid/quality, Save V6, undo, inspect semantics, and deterministic mesh geometry unchanged (colors only).
- **Legacy `renderGameUi(root)` DOM and its bindings stay intact**: `#game-canvas` (owns WebGL), `data-action="tool-*"` mutation buttons via `bindGameKeyboardShortcuts`, `[data-testid="tool-context-state"]` targets via `bindGameToolHud`, `primary-tool-surface`, `game-status`. All legacy unit tests remain green: `game-ui.test.ts`, `game-tool-hud-binding.test.ts`, `game-tool-hud-building.test.ts`, `game-secondary-controls.test.ts`, `game-tool-recovery.test.ts`, `zoning-tool-ui.test.ts`.
- New-shell collaborations keep `player-shell.test.ts` and `city-ui-runtime.test.ts` green; existing contracts (`PlayerShell`, `PlayerShellCallbacks`, `ContextualToolProjection`, `GameHudProjection`, `DialogHost`) retain their public shape.
- `build-dock.ts` is REMOVED (design §7.1); tool definitions live in `subtool-tray.ts`; `simulation-controls.ts` gets a compact variant mounted on the bottom bar.
- No `isMobile` prop / matched-media branch anywhere; layout uniform at all breakpoints.
- Dialog presentation converts from centered modal to bottom sheet at EVERY size; `isMobile` not added.
- Living docs + ADR updated in the same PR (`docs/systems/city-ui/`).
- Deterministic ordering and Save compatibility preserved; no temp/debug artifacts.

---

### Milestone 1 — Light theme: tokens, sky, tile colors, transparent renderer

**Files:**
- Modify: `apps/game/src/ui/foundation/tokens.css`
- Modify: `apps/game/src/style.css`, `apps/game/src/ui/city-ui.css`
- Modify: `apps/game/src/game-bootstrap.ts` (renderer at ~449-456, scene/background at ~458-464)
- Modify: `packages/terrain-core/src/chunk-mesher.ts` (`colorForLevel`, lines 9-12), `packages/terrain-core/src/outer-skirt-mesher.ts:80`
- Modify: `packages/water-core/src/water-chunk-mesher.ts:24-26`, `packages/water-core/src/water-wall-mesher.ts:11-12`
- Modify: `packages/building-three/src/material-factory.ts`
- Modify: `packages/zone-three/src/material-factory.ts:28-37`
- Verify: `packages/road-three`, `packages/terrain-three` preview contrast
- Update: `docs/systems/city-ui/README.md` + new ADR `docs/systems/city-ui/adrs/2026-08-09-light-theme-mobile-first-uniform-shell.md`

**Interfaces:**
- Consumes: existing `tokens.css` token names (new values per design §4: surface `rgba(255 255 255 / 0.88)`, raised `#ffffff`, text `#1a2236`, muted `#4a5878`, accent `#2563eb`, danger `#dc2626`, zone tokens `#16a34a`/`#2563eb`/`#d97706`; keep gap/radius/target/safe-area/font/outline/reduced-motion).
- Produces: `THREE.WebGLRenderer({ ..., alpha: true })` (`game-bootstrap.ts:449-452`); `renderer.setClearColor(0, 0)`; `scene.background = null`; CSS sky gradient on body/`.app-shell` (light-blue → near-white → subtle-green + radial sun glow + horizon haze).

**Tests (RED→GREEN):**
- [x] **Step 1: Color-token regression (fails on old dark values).** In a new `apps/game/src/ui/token-light-theme.test.ts`: make a hidden div, read `getComputedStyle`, assert `--city-ui-text` resolves to the light navy `#1a2236` (not `#f5f8fa`) and accent is `#2563eb`.
- [x] **Step 2: Renderer option regression.** In the bootstrap test, assert the created renderer was constructed with `alpha: true` (spy on `WebGLRenderer` constructor options); and `scene.background` is `null` after init.
- [x] **Step 3: Replace the design-token table values in `tokens.css`** (keep names), frosted-glass `background-filter: blur(...)` for `surface`, `surface-raised`.
- [x] **Step 4: `style.css`/`city-ui.css` legacy surface color → light sky; every hard-coded `rgb(16 28 37…)` / `#f5f8fa` wall touched in customer-visible `.panel`, `.tool-context`, `.undo-button` updated or removed where the new shell supersedes it. `.city-tool-context` stays `display:none` (activated in M3).
- [x] **Step 5: Sky gradient (body + `.app-shell`) per design §5** — vertical blue→white→green, radial sun glow upper-right, horizon haze; render tunnel.
- [x] **Step 6: Terrain/water/building/zone material constants** per design §6 table; verify no geometry/opacity change; update owning-unit snapshot expectations for any color assertions.
- [x] **Step 7: Owner/consumer tests.** `pnpm --filter @web-three-city/terrain-core test`, `water-core`, `building-three`, `zone-three`; then `pnpm --filter @web-three-city/game test`; `pnpm --filter @web-three-city/game typecheck`.
- [x] **Step 8: ** Commit `theme: light palette, sky, transparent renderer (bright daytime assets)` — atomic (`0cee923`).

### Task M2 — Bottom nav + subtool tray (uniform mobile shell primitive)

**Files (per design §7):**
- Add: `apps/game/src/ui/shell/bottom-nav.ts` + `bottom-nav.test.ts`
- Add: `apps/game/src/ui/shell/subtool-tray.ts` + `subtool-tray.test.ts`
- Add: `apps/game/src/ui/shell/brush-stepper.ts` + test (terraform 1×1/3×3/5×5 pills)
- Delete: `apps/game/src/ui/shell/build-dock.ts` + its test
- Modify: `apps/game/src/ui/shell/player-shell.ts`; `apps/game/src/ui/shell/simulation-controls.ts` (compact variant); `apps/game/src/ui/city-ui-runtime.ts` (selectTool wiring unchanged)

**Interfaces:**
- Consumes: `selectTool(mode: GameToolMode)`, `setTerraformBrush`, `createButton` component, existing per-category tool lists (terrain raise/lower/flatten; road-build/road-bulldoze; zone-res/comm/ind/zone-remove; building-bulldoze).
- Produces: `BottomNav` (5 tabs: Navigate, Terrain, Roads, Zones, Buildings; `aria-pressed`=selected; callback `(category) → void`), `SubToolTray` (`onSelectTool(mode)`, `onActivateTray`, closes on navigate; content = tray per category), `BrushSelector` (`onBrush(size)`).
- Public. `PlayerShell` composes: `bottomNav.onSelect` routes `'terrain'` → tray open + `selectTool('navigate')`? (See decision in M3: category selection both opens tray AND passes through `selectTool` so committed context still shows Ready→Preview; Navigate closes tray).

**Tests (RED→GREEN):**
- [x] **Step 1: Checkbox regression.** `bottom-nav.test.ts`: renders 5 rail buttons; selecting `zones` fires `onSelect('zones')`.
- [x] **Step 2: `subtool-tray.test.ts`:** mounting tray with active category `terrain` renders Raise/Lower/Flatten + brush controls; clicking a subtool fires `onSelectTool('terraform-raise')`; selecting `navigate` empties/collapses the tray.
- [x] **Step 3: BUG-Truncated tray vs RND:** a shielded `build-dock.test.ts`-equivalent ensures no category is missing (each of 5 non-navigate modes reachable exactly once from rail+tray).
- [x] **Step 4: Implement** the three new components with `createButton` + tiles style in `city-ui.css` (rail: `#ffffff` bottom bar, target-size, safe-area; tray: white card sliding with dark `#1a2236` pills).
- [x] **Step 5: Rewire `player-shell`:** replace `mountBuildDock` with `BottomNav` + `SubToolTray` + `BrushViewTry` ; keep `callbacks.selectTool`/`setTerraformBrush` and **keep a one-line default `navigate` projection so the context sheet still renders on boot** (PS `player-shell.ts:39-45` behavior preserved in the new composition).
- [x] **Step 6: Remove `build-dock.ts` + test; update `player-ui.test.ts`/custom-shell consumers.**
- [x] **Step 7: Green + `pnpm --filter @web-three-city/game test` `typecheck`; commit `shell: bottom nav + subtool tray, retire build-dock`.**

---

### Task M3 — RE-ACTIVATE side sheet as collapsible committed-projection card

**Files:**
- Modify: `apps/game/src/ui/city-ui.css` (activate `.city-tool-context` grid; collapse mode)
- Add: `apps/game/src/ui/shell/tool-context-sheet.ts` + `tool-context-sheet.test.ts`
- Add: `apps/game/src/game-tool-context-bridge.ts` + test (translator domain)
- Modify: `apps/game/src/ui/shell/player-shell.ts`; `apps/game/src/main.ts` (feed window), `docs/systems/city-ui/README.md`

**Interfaces:**
- Consumes: `ContextualToolProjection`, `bindGameToolEvents(detail)`, `roadPreviewStateLabel`, `zonePreviewStateLabel`, `messageForGameReason`.
- Produces: pure `translateToolEvent(detail): ContextualToolProjection | null`; `contextToolSheet.update(projection)` renders name/state/message + numeric metrics chips (requested/effective + `Affordable|Unaffordable` + Undo) + collapse `button[aria-expanded]`.
- **A bridge subscribes `bindGameToolEvents(canvas, ..., signal)` in the NEW shell AND folds each committed `GAME_TOOL_EVENT` detail through `translateToolEvent` into fresh ones a `toolContextSheet.update()`. The existing `bindGameToolHud(root, canvas, signal)` legacy binding in `main.ts:235` remains untouched — both consume the same theoretical stream from distinct windows.**

- [x] **Step 1: RED regression.** new `tool-context-sheet.test.ts`: sheet tool collapse toggle (`[data-testid="tool-context-toggle"]`) hidden→visible transitions; `game-tool-context-bridge.test.ts`: feed `terraform-state` accepted → projection has `state 'Valid preview'`, feed `transaction-state committing` → `'Applying change'`; feed `reason terraform:no-change` → `'No change'`.
- [x] **Step 2: Implement `translateToolEvent` pure reducer** covering the 4 event types, reusing label/message helpers (mirroring `game-tool-hud-binding.ts:100-210` switch semantics WITHOUT DOM side effects).
- [x] **Step 3: Implement `mountToolContextSheet`** (floating card above bottom nav; collapsible via toggle; metrics chips; `undoAvailable` pill).
- [x] **Step 4: ACTIVATE `.city-tool-context` presentation** — now the CSS rule `display:none` is replaced by the card component's own layout/`hidden` attribute, and the sheet is always mounted in `player-shell` (per design §7.3: white card floating above bottom nav, collapsible).
- [x] **Step 5: Feed wiring in new shell.** player-shell owns the sheet; runtime hook wires sheet: `player-shell` adds a `toolContextSheet` expose no API change required; main adds **second** binding group `game-tool-context-bridge` fed from the same canvas into the shell's sheet.
- [x] **Step 6: Double-write dedupe is NOT required** — the sheet overlays; ensure no z-fight/scroll with legacy `.tool-context` (legacy currently visible but only in old layout; acceptable overlap while both chromeless).
- [x] **Step 7: Green: legacy `game-tool-hud-binding.test.ts` + new sheet/bridge tests + `city-ui-runtime.test.ts` passing; `pnpm --filter @web-three-city/game test && typecheck`.

---

### Task M4 — All HUD chips tappable → panels

**Files:**
- Modify: `apps/game/src/ui/shell/game-hud.ts` + `game-hud.test.ts`
- Modify: `apps/game/src/ui/city-ui-runtime.ts` (new callbacks)
- Modify: `apps/game/src/ui/shell/player-shell.ts` (port: `onSelectMetric`)

**Interfaces:**
- Consumes: `GameHudProjection`, `DialogHost`, `systemDialogs` (`openCity()`, `openEconomyTaxation()`, info views).
- Produces: chips get `role=button` + `data-metric` + `aria-label`; tapping dispatches `onSelectMetric(metric)` → runtime maps: population/treasury/net → `systemDialogs.openCity()`; RCI demand → open city/RCI-behavior panel; game-time → simulation time info view; tap on open chip or × closes by `dialogHost.close()`.

- [ ] **Step 1: RED.** `game-hud.test.ts` fails: chip element is `role=button`, clicking triggers configured `onSelectMetric('population')`.
- [ ] **Step 2: Implement chips.** Keep distinct `data-metric` keys (population, treasury, net, demand, time), translucent white on top gradient scrim, hover/active state.
- [ ] **Step 3: Wire `onSelectMetric` in `mountCityUi`**: metric→dialog map; tapping opened = dialogHost open if not already, then `close()` on second tap.
- [ ] **Step 4: `player-shell` passes `GameHudCallbacks`; `player-ui.test.ts` updated for new foot tap behavior.**
- [ ] **Step 5: Green `game` test + typecheck.**

---

### Task M5 — Management panel as 90vh bottom sheet (uniform across breakpoints)

**Files:**
- Modify: `apps/game/src/ui/dialog/dialog-host.ts` + `dialog-host.test.ts`
- Modify: `apps/game/src/ui/city-ui.css` (remove `.city-dialog` center-modal styles; add sheet presenter)
- Modify: renderers of City/Economy/Zoning/RCI/Roads/Game Menu/Info Views/inspect to accept sheet container (registry/`content` layers unchanged)

**Interfaces:**
- Consumes: `DialogHost.open(route…)`, `close`, `activeRoute`, `data-block-avoid`, `describer`, aria-modal.
- Produces: `DialogHost` presents as bottom sheet: slide-up from bottom, `height: clamp(60vh, 90vh, …)`, cap width `max-width: 640px` on wide, handle bar grab, backdrop blur + tap-to-close, clear ×.

- [ ] **Step 1: RED.** `dialog-host.test.ts` adds a viewport-agnostic check: `sheet.style.height > '90vh'` never true (maxed height at 90vh); center-modal class gone.
- [ ] **Step 2: Sheet CSS presentation** with handle bar, blur backdrop, close button; remove center-modal default.
- [ ] **Step 3: Keep all system dialogs + info views + inspect content working in the sheet presenter (no `isMobile` prop; uniformly at all breakpoints).**
- [ ] **Step 4: Green `pnpm --filter @web-three-city/game test` + typecheck; update `city-system-dialogs.test.ts` if it asserts center-dialog CSS.**

---

### M6 — Closure: browser regression, docs/ADR, verify

- [ ] **Step 1: Browser tagged subsets** — `@smoke @terrain @water @road @zoning @building @interaction @visual` affected fast feedback during development; full unfiltered Chromium project at `pnpm verify:full` for closure.
- [ ] **Step 2: ADR `docs/systems/city-ui/black-ui.md` → new ADR** name registered in registry; update `docs/systems/city-ui/README.md` theme + shell + dialog presentation and the new-shell content about context sheet.
- [ ] **Step 3: Repo verification**: root/workspace/tooling changes → `pnpm test:deployment` + required Level 3 `pnpm verify`; Level 4 `pnpm verify:full` at finalization; record exact-head SHA/run IDs and evidence counts in PR body.
- [ ] **Step 4: Confirm DoD checklist below and mark plan complete.**

---

## Definition of Done
- Light theme active (`--city-ui-text #1a2236`, accent `#2563eb`, surfaces white/translucent); only legacy chromie documented as awaiting cleanup; dark-only CSS removed.
- Bottom nav (5 tabs Navigate/Terrain/Roads/Zones/Buildings) + subtool tray + terrain brush live and selectable; `build-dock.ts` deleted; no test regressions.
- Context sheet re-activated: collapsible card above bottom bar shows **committed** tool projection (validity/rejection/message/effective cells/affordability/Undo) via the new `tool-context-sheet` + `game-tool-context-bridge`; legacy `bindGameToolHud` untouched.
- HUD chips tappable → dialogs; RCI/time also gate.
- All dialogs are bottom sheets at every size (80-90vh, handle, backdrop, ×).
- Sky gradient behind transparent WebGL clear; tile-types/water-roofs render correctly over transparent clear.
- Determinism: color edits only; Save V6 unchanged; legacy `renderGameUi` + all unit regressions green.
- ADR + `docs/systems/city-ui/README.md` updated in same PR.
- No temp exports / debug logs; full `pnpm verify:full` green at exact SHA with evidence recorded.