# City UI

**Status:** Approved design — not implemented

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
