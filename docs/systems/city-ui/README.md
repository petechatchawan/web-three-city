# City UI

**Status:** Live single shell — the `.city-ui` shell is the only mounted UI surface; the legacy `game-ui.ts` dock/panel mount is retired, and every browser spec drives the shell

## Purpose

City UI is the player-facing presentation layer for the city-builder runtime. It keeps the 3D world visually dominant, exposes compact always-on status, opens management information in dialogs, and provides deterministic inspect surfaces for world entities.

City UI does **not** own simulation, Economy, RCI, World, Building, Road, Zoning, Terrain, Save/Load, or tool authority. It consumes immutable presentation projections and sends typed application commands.

## Ownership

- Runtime composition: `apps/game`
- Presentation code target: `apps/game/src/ui/`
- Technology: Vanilla TypeScript + native DOM/CSS; no React/Vue/Svelte runtime
- World rendering remains Three.js-owned
- Domain packages remain framework/browser independent

## Primary contracts

- Mobile-first and landscape-first gameplay; portrait is supported as a secondary layout.
- The world remains the primary screen. No permanent gameplay sidebar.
- Persistent surfaces are limited to compact HUD, bottom navigation (5 tabs) + subtool tray, simulation controls, and small top-level actions.
- A single primary `DialogHost` presents system or inspect dialogs with one active primary dialog and an internal navigation stack.
- System/inspect dialogs block world pointer input behind them but **do not pause simulation** or change the active simulation speed.
- Opening/closing a dialog must not mutate domain state, clear Undo history, or change the selected build tool.
- Tool controls use a single contextual non-modal tool surface so world placement remains interactive.
- Default Navigate mode supports world inspection. Active build tools keep ownership of world taps.
- Player inspect and Developer inspect are separate projections and presentation surfaces.
- Information Views use a registry so overlays can be added without coupling UI to system internals.

## Initial system surfaces

- City Overview
- Economy: Overview, Taxation
- Population / RCI: current aggregate information only
- Zoning: current demand/development information only
- Roads: current network information only
- Traffic: current flow, queue, and congestion information only

Do not create fake tabs or placeholder systems for capabilities that do not yet exist.

## Initial inspect targets

- Building
- Road
- Zone
- Terrain
- Citizen / Vehicle (read-only Traffic-linked inspect)

Selection priority in Navigate mode is deterministic: Building → Road → Zone → Terrain. Citizen/Vehicle inspect is resolved from committed Traffic presentation projections and is read-only unless an existing typed application command already owns the requested action.

## Persistence

City UI owns no authoritative persisted game state. Ephemeral dialog/navigation state is session-only. Save/Load continues to persist only owning game systems.

## Current milestone

- [Legacy `game-ui.ts` mount retirement design](https://github.com/web-three-city/web-three-city/blob/main/docs/superpowers/specs/2026-08-10-legacy-game-ui-mount-retirement-design.md)
- [City UI Foundation v0.1 specification](specs/2026-08-09-city-ui-foundation-v0-1.md)
- [ADR: mobile-first dialog-based presentation](adrs/2026-08-09-mobile-first-dialog-based-presentation.md)
- [ADR: light theme + mobile-first uniform shell](adrs/2026-08-09-light-theme-mobile-first-uniform-shell.md)
- [ADR: legacy `game-ui.ts` mount retirement](adrs/2026-08-10-legacy-game-ui-mount-retirement.md)
- [TDD implementation plan — foundation](tdd/2026-08-09-city-ui-foundation-v0-1.md)
- [TDD implementation plan — legacy retirement](tdd/2026-08-10-legacy-game-ui-mount-retirement.md)

## Architecture after legacy retirement

The game mounts exactly two presentation layers into `#app`:

1. `renderGameCanvas(root)` (`apps/game/src/game-ui.ts`) — the bootstrap adapter.
   It creates the full-bleed `<canvas id="game-canvas">` inside `.app-shell` and
   exposes the slim `GameBootstrapHost` contract: `canvas`, `measureViewport`,
   the `setStatus` / `setUndoAvailable` feeds, and the `onStatus` /
   `onUndoAvailable` subscriptions. It renders no panels, docks, buttons, or
   tool surfaces.
2. `mountCityUi(root, ports)` (`apps/game/src/ui/city-ui-runtime.ts`) — the
   `.city-ui` shell. It owns the HUD, top actions, simulation controls, bottom
   navigation + subtool tray, tool context sheet, and all dialogs.

`bootstrapGame(host)` (`apps/game/src/game-bootstrap.ts`) consumes only the host
contract. `main.ts` is the composition root: it wires the host to the shell
(status/undo feeds land on the tool context sheet), routes keyboard shortcuts
to the shell tray with a runtime fallback, and subscribes committed-world
publications into `cityUi.update`.

### Retired legacy mounts

The following legacy surfaces are removed from the runtime and from `main.ts`:

- The legacy dock/panel (`game-ui.ts` `renderGameUi`, tool buttons, brush
  selector, camera/quality/grid reflectors, undo button, tool context).
- `game-time-ui.ts` (`mountGameTimeUi`) — calendar and building lifecycle counts
  now live in `game-hud.ts` (`data-metric="gameTime"` / `construction` /
  `active` / `total`); simulation speed lives in `simulation-controls.ts`.
- `game-tool-hud-binding.ts` and `game-secondary-controls.ts` — their tool
  state/metrics projection folded into `game-tool-context-bridge.ts`, which
  feeds the shell `tool-context-sheet`.
- The RCI and Economy panel HUD mounts (`mountRciHud`,
  `mountEconomyBudgetHud`) — superseded by the City Overview / Population-RCI /
  Economy dialogs; only their model/projection functions
  (`createRciHudModel`, `createEconomyViewProjection`) remain, consumed by the
  dialogs.
- `growth-time.css` and the legacy `.panel`-scoped rules in `style.css`;
  `style.css` now holds only the structural base (fonts, app-shell sky, canvas).

### Shell tool context

`tool-context-sheet.ts` exposes `tool-context-name`, `tool-context-state`,
`tool-context-message`, `tool-context-status`, `tool-context-undo`,
`tool-context-requested`, and `tool-context-effective`. The Undo button is
enabled through the bootstrap undo-available signal and invokes the runtime
undo port. The transient status line consumes the bootstrap status feed and
resets an in-flight "Applying change"/"Undoing" state when a completion status
arrives.

## Theme and sky

- Single light theme only; no dark theme and no toggle. Token source of truth is
  `apps/game/src/ui/foundation/tokens.css` (`--city-ui-*`): surface translucent
  white, raised `#ffffff`, text `#1a2236`, muted `#4a5878`, accent `#2563eb`,
  danger `#dc2626`, zone tokens `#16a34a`/`#2563eb`/`#d97706`.
- The WebGL renderer clears transparent (`alpha: true`, `setClearColor(0, 0)`,
  `scene.background = null`); `body`/`.app-shell` paint the CSS sky (blue →
  near-white → subtle green + radial sun glow + horizon haze).
- World assets use bright daytime constants (terrain, water, building,
  zone overlays); geometry and opacity are unchanged.

## Implemented behavior

- Internal lifecycle and viewport classification contracts cover the landscape-mobile, portrait, and desktop acceptance sizes.
- A compact awareness HUD projects Population, Treasury, current Net, R/C/I direction, GameTime, and building lifecycle counts. Metric chips are touch-safe buttons: tap opens the matching system dialog (`city-overview` / `population-rci` / `simulation-time`); re-tap closes it.
- Top actions and existing Paused/1×/2×/4×/Step intents use semantic touch-safe buttons.
- `DialogHost` enforces one primary dialog, internal LIFO Back, root Close, Escape close, focus restoration, and world-input blocking without gameplay or simulation commands. Primary dialogs present as 90vh bottom sheets (max-width 40rem, grab-handle bar, blurred backdrop, close ×, backdrop tap-to-close) at every breakpoint; no center-modal presentation.

### Build tool migration

- Bottom categories expose Terrain, Roads, Zones, and Buildings through typed `GameRuntime` tool ports.
- Terraform brush sizes use the existing controller contract.
- The committed tool projection folds through `game-tool-context-bridge.ts` (pure `translateToolEvent` + `bindGameToolContext`) into the `tool-context-sheet` presenter.
- The context sheet is non-modal and does not carry the world-input-block attribute, so unobscured world placement remains available. Its header shows the powered-on tool name and status while its body shows command message, metric/affordability chips, and Undo state; a toggle collapses and expands the body without changing tool state.
- Category expansion and dialog lifecycle do not synthesize Navigate or cancel the active tool.

### City systems

- The City registry exposes only City Overview, Economy, Population / RCI, Zoning, and Roads.
- Economy provides Overview and Taxation routes backed by the existing immutable projection and typed tax-policy command.
- Open dialog content reprojects from each committed-world publication while simulation continues.
- Population, housing, employment, demand, zone counts, and Road cell totals are derived from current owning snapshots; no future-system tabs or new domain state are introduced.

### World inspect and information views

- Navigate-mode world selection resolves Building, Road, Zone, then Terrain and opens a player-facing Inspect dialog.
- Inspect content is reprojected from the latest committed world. A target removed after opening renders `Unavailable` instead of stale values.
- Active build tools retain world-input ownership; inspect does not switch tools or intercept placement.
- The information-view registry enforces one active view and deterministic activate, replace, and deactivate lifecycle.
- Traffic Information View and Citizen/Vehicle Inspect consume committed Mobility/Traffic projections, preserve modal background-input blocking, and do not reset active tools or simulation controls.
- v0.1 exposes only the existing canonical grid and zoning visualization. Player projections exclude raw IDs, revisions, fingerprints, and debug state.

### Browser acceptance

- Every browser spec drives the `.city-ui` shell: `nav-*` tabs + `data-toolMode`
  tray tools, `tool-context-*` testids, `data-metric` HUD chips, and the dialog
  surfaces. No spec references legacy testids, `data-*` attributes, a11y names,
  or legacy CSS classes (`#game-canvas` is retained for pointer/screenshot use).
- Browser acceptance covers 844×390, 932×430, 390×844, 430×932, 1280×720, and
  1440×900 with no document overflow and 44 CSS px minimum visible City UI
  targets.
