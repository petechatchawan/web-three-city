# Light Theme + Mobile-First Uniform Shell — Design

Date: 2026-08-09
Status: Approved (design sections), pending spec review

## 1. Goal

Rework the city-ui presentation from dark to a single light theme and restructure the player shell into a mobile-first, breakpoint-uniform layout: bottom navigation bar, slide-up subtool tray, floating collapsible context sheet, and management panels presented as 90vh bottom sheets. Rendering colors (terrain, water, buildings, zone overlays, sky) become bright daytime values. No dark theme, no isMobile branching, no Save schema change.

## 2. Decisions (from brainstorming)

1. **Light only** — one theme; dark presentation removed.
2. **Uniform mobile layout at all breakpoints** — the bottom-nav shell is the only shell.
3. **Bottom sheet for all management panels at all sizes** — `isMobile` prop is NOT introduced.
4. **5 bottom-nav tabs** = Navigate + Terrain/Roads/Zones/Buildings.
5. **Tile colors edited directly in `*-core`/`*-three` constants** (no palette injection / no public API change).
6. **All HUD chips are tappable** and open their related management panel.

## 3. Non-Goals

- No dark/light toggle, no theme switching mechanism.
- No `isMobile` matched-media or prop.
- No change to tool authority, simulation loop, Save V6 schema, or deterministic mesh geometry (colors only).
- No new UI framework runtime.

## 4. Color System

`apps/game/src/ui/foundation/tokens.css` — replace the dark palette:

| Token | Old | New |
| --- | --- | --- |
| `--city-ui-surface` | rgb(16 28 37 / 92%) | rgba(255 255 255 / 0.88) frosted glass |
| `--city-ui-surface-raised` | rgb(28 44 55 / 96%) | #ffffff |
| `--city-ui-text` | #f5f8fa | #1a2236 (navy) |
| `--city-ui-muted` | #b8c6ce | #4a5878 (slate) |
| `--city-ui-accent` | #63d5b4 | #2563eb (strategic blue) |
| `--city-ui-danger` | #ffb3a7 | #dc2626 |
| `--city-ui-zone-residential` | — | #16a34a |
| `--city-ui-zone-commercial` | — | #2563eb |
| `--city-ui-zone-industrial` | — | #d97706 |

Keep: `--city-ui-gap`, `--city-ui-radius`, `--city-ui-target` (44px), safe-area insets, font tokens (`--city-ui-font-sans`, `--city-ui-font-mono`), focus-visible outline, reduced-motion block. Frosted glass surfaces get `backdrop-filter: blur(...)`.

`apps/game/src/style.css` and `apps/game/src/ui/city-ui.css`: update body/global surface color to the light sky/panel values; legacy `.panel`, `.tool-context`, and `.undo-button` presentation that is still visible receives the same light treatment or is removed where superseded by the new shell.

## 5. World Background (sky)

`apps/game/src/game-bootstrap.ts:456-459` renderer setup:
- Renderer created with `alpha: true`.
- `scene.background` removed; `renderer.setClearColor(0, 0)` (transparent).
- Canvas shows through to a CSS sky painted on the page background.

CSS sky (body or `.app-shell` background):
- Vertical gradient: light blue (top) → near-white (mid) → subtle green (bottom horizon).
- Sun glow: `radial-gradient` highlight in an upper region.
- Horizon haze: soft horizontal linear-gradient overlay at the horizon.

Presentation-only; no shader work. Verify water/tile sorting and opacity still render correctly over the transparent clear color.

## 6. Tile and Material Colors (bright daytime)

Edit constants in place; geometry/save/domain behavior unchanged.

| File | Constant | Change |
| --- | --- | --- |
| `packages/terrain-core/src/chunk-mesher.ts` `colorForLevel` (line 9-12) | muted dark-green ramp | brighter grass ramp (saturated midday green; still height-leveled) |
| `packages/terrain-core/src/outer-skirt-mesher.ts:80` | `0.31, 0.22, 0.13` | lighter earth/sand value |
| `packages/water-core/src/water-chunk-mesher.ts:24-26` | SHALLOW `0.36,0.76,0.86`, DEEP `0.06,0.28,0.55`, SHORELINE `0.68,0.9,0.92` | clearer light blue (clear water) |
| `packages/water-core/src/water-wall-mesher.ts:11-12` | TOP `0.12,0.45,0.65`, BASE `0.02,0.12,0.25` | lighter blue wall |
| `packages/building-three/src/material-factory.ts` | residential `0xe9c98f`, commercial `0x8db6d9`, industrial `0xb2a58c`, roof `0x9e5f4b`, accent `0x40566b` | clearer/saturated building colors |
| `packages/zone-three/src/material-factory.ts:28-37` | overlay `0x55c878`,`0x4d8fe8`,`0xe4c34f`, previews | residential `#16a34a`, commercial `#2563eb`, industrial `#d97706`, brighter preview/valid/invalid |
| `packages/road-three` | — | verify road color contrasts on light ground; adjust if needed |
| `packages/terrain-three` selected-cell/terraform preview | — | verify contrast on light theme |

Domain determinism: colors are not persisted and do not affect simulation. World-load validation and Save compatibility unchanged. Update owning-plan/test expectations for any color assertions.

## 7. Shell Restructure — uniform mobile layout

### 7.1 Bottom nav — new `apps/game/src/ui/shell/bottom-nav.ts`
- Solid `#ffffff` bar pinned to bottom, above safe-area.
- 5 tabs: Navigate, Terrain, Roads, Zones, Buildings.
- Compact simulation controls on the right of the bar (Paused/1×/2×/4×/Step).
- Selecting a non-Navigate tab opens the subtool tray; selecting Navigate closes it and switches to navigate mode.
- Replacement: `shell/build-dock.ts` (category bar + flat palette) is removed; its tool definitions move into the tray.

### 7.2 Subtool tray — new `apps/game/src/ui/shell/subtool-tray.ts`
- Dark pills (`#1a2236`) on a white card, sliding up from the bottom when a category tab is selected.
- Per-category content = the existing tool list (Raise/Lower/Flatten + brush for terrain; road-build/road-bulldoze; zone-residential/commercial/industrial/zone-remove; building-bulldoze), emitting the same `GameToolMode` callbacks.
- Terraform brush (1×1/3×3/5×5) lives in the terrain tray.
- Reuses `createButton` component; same `selectTool`/`setTerraformBrush` wiring.

### 7.3 Context sheet — re-activate `.city-tool-context`
- Currently `display: none` in `city-ui.css` (legacy cleanup placeholder); now the committed tool projection is presented as a collapsible white card floating above the bottom nav.
- Collapse/expand toggle; content = committed tool projection (quote, validity, rejection, affordability, active tool, Undo) via `ContextualToolProjection`.
- Resumable: expanded by default when a non-modify tool is active; manual collapse is presentation-only (not persisted).

### 7.4 Top HUD chips — `game-hud.ts`
- Chips: white translucent on a subtle top gradient fade scrim for legibility.
- All chips tappable → open related panel through new callbacks in `city-ui-runtime`:
  - Population / Treasury / Net → City panel (`systemDialogs.openCity()`).
  - RCI demand → City/RCI panel.
  - Game time → simulation time information view.
- Tapping the open chip again or the sheet × closes.

## 8. Management Panel — bottom sheet

`apps/game/src/ui/dialog/dialog-host.ts` presentation changes from centered modal to bottom sheet:
- Slide-up from bottom, `height: 90vh`, max-width capped on wide screens.
- Handle bar at top (grab affordance), backdrop blur dim, tap-backdrop closes, clear × button.
- Uniform at all sizes (`isMobile` not needed; no prop added).
- Center-dialog CSS removed; all system dialogs (City, Economy, Zoning, RCI, Roads, Game Menu, Info Views, inspect) render through the sheet presenter. Content/registry layers unchanged.

## 9. Unchanged Behavior

- Simulation speed, step, tool selection/preview/validation, save/load, camera, grid, quality, undo, inspect — same semantics; presentation only.
- Dialog/sheet/tray state remains presentation-only; never enters Save V6.
- Zone colors are derived/overlay presentation; zone codes and save values unchanged.

## 10. Architecture & Files

New:
- `apps/game/src/ui/shell/bottom-nav.ts` (+ test)
- `apps/game/src/ui/shell/subtool-tray.ts` (+ test)

Modified:
- `apps/game/src/ui/shell/player-shell.ts` — compose bottom-nav + tray + context sheet.
- `apps/game/src/ui/shell/build-dock.ts` — removed; content folded into tray.
- `apps/game/src/ui/shell/simulation-controls.ts` — compact variant (right of bar).
- `apps/game/src/ui/shell/game-hud.ts` — tappable chips + new callbacks.
- `apps/game/src/ui/dialog/dialog-host.ts` (+ test) — if bottom-sheet presenter.
- `apps/game/src/ui/city-ui-runtime.ts` — chip → panel callbacks.
- `apps/game/src/ui/foundation/tokens.css`, `apps/game/src/ui/city-ui.css`, `apps/game/src/style.css`.
- `apps/game/src/game-bootstrap.ts` — transparent renderer + sky.
- Core/theme color constants above (terrain-core, water-core, building-three, zone-three, road-three, ter-three previews).

## 11. Testing Strategy

- Unit: bottom-nav, subtool-tray, dialog-host bottom-sheet presenter, HUD chip click wiring, tokens color smoke.
- Owner/consumer: `apps/game` tests + typecheck; Level 2: `game` and affected `*-three` consumers.
- Browser: ownership tags `@smoke` `@terrain` `@water` `@road` `@zoning` `@building` `@rci` `@interaction` `@visual`; run affected subsets during development; full unfiltered project at `pnpm verify:full` for closure.
- Determinism: color edits must not change mesh geometry/normals; Save-compat suite stays green.

## 12. Documentation

- `docs/systems/city-ui/README.md` — update presentation/theme section.
- New ADR: `docs/systems/city-ui/adrs/2026-08-09-light-theme-mobile-first-uniform-shell.md` — records single light theme + uniform breakpoint-less shell + bottom-sheet-only management, replacing the dark dialog-centered presentation.
- Update the city-ui TDD/verification docs for the new shell.

## 13. Milestones

1. Theme/colors: tokens.css light, sky gradient, tile colors, game bootstrap transparent renderer, doc updates.
2. Shell: bottom-nav + subtool-tray + simulation controls compact; remove build-dock; player-shell wiring.
3. Context sheet re-activation + collapsible behavior.
4. HUD chips tappable + panel callbacks.
5. Management panel bottom-sheet presenter; remove centered-dialog CSS.
6. Closure: responsive/browser regression, docs/ADR, `pnpm verify`, final `pnpm verify:full`.