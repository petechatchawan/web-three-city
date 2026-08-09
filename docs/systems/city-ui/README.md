# City UI

**Status:** Implementation complete — automated verification candidate preparation; Manual Acceptance pending

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
- Persistent surfaces are limited to compact HUD, bottom build dock, simulation controls, and small top-level actions.
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

Do not create fake tabs or placeholder systems for capabilities that do not yet exist.

## Initial inspect targets

- Building
- Road
- Zone
- Terrain

Selection priority in Navigate mode is deterministic: Building → Road → Zone → Terrain. Inspect content is read-only unless an existing typed application command already owns the requested action.

## Persistence

City UI owns no authoritative persisted game state. Ephemeral dialog/navigation state is session-only. Save/Load continues to persist only owning game systems.

## Current milestone

- [City UI Foundation v0.1 specification](specs/2026-08-09-city-ui-foundation-v0-1.md)
- [ADR: mobile-first dialog-based presentation](adrs/2026-08-09-mobile-first-dialog-based-presentation.md)
- [ADR: light theme + mobile-first uniform shell](adrs/2026-08-09-light-theme-mobile-first-uniform-shell.md)
- [TDD implementation plan](tdd/2026-08-09-city-ui-foundation-v0-1.md)

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
- Legacy `.panel`, `.tool-context`, `.undo-button` use the light treatment while
  awaiting shell-driven replacement.

## Implemented behavior

- Internal lifecycle and viewport classification contracts cover the landscape-mobile, portrait, and desktop acceptance sizes.
- A compact awareness HUD projects Population, Treasury, current Net, R/C/I direction, and GameTime without continuous live-region announcements.
- Top actions and existing Paused/1×/2×/4×/Step intents use semantic touch-safe buttons.
- `DialogHost` enforces one primary dialog, internal LIFO Back, root Close, Escape close, focus restoration, and world-input blocking without gameplay or simulation commands.

### Build tool migration

- Bottom categories expose Terrain, Roads, Zones, and Buildings through typed `GameRuntime` tool ports.
- Terraform brush sizes use the existing controller contract.
- The contextual tool surface is non-modal and does not carry the world-input-block attribute, so unobscured world placement remains available.
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
- v0.1 exposes only the existing canonical grid and zoning visualization. Player projections exclude raw IDs, revisions, fingerprints, and debug state.

### Final shell and compatibility

- The legacy `.game-hud` no longer produces a layout box or permanent sidebar; the City UI shell owns HUD, top actions, simulation controls, and the bottom build dock.
- Game Menu is a real primary dialog for Save, Load, camera rotation/reset, Grid, and Quality commands through typed runtime ports.
- The retained legacy adapter is limited to the existing authoritative contextual tool projection, Undo, and bounded test/status projections while those presenters remain application-owned.
- Game framing uses no sidebar inset and permits a larger portrait orthographic fit without changing the camera package defaults.
- Browser acceptance covers 844×390, 932×430, 390×844, 430×932, 1280×720, and 1440×900 with no document overflow and 44 CSS px minimum visible City UI targets.
