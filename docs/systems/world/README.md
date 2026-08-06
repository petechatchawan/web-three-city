# World System

**Status:** Implemented — final stacked verification pending  
**Primary ownership:** `packages/world-core`, `apps/game/src/world-save.ts`, `game-world-state.ts`, and `game-world-tick.ts`  
**Persistence:** versioned `world-save` envelope through `WorldSaveV5`

## Purpose

Provide shared world configuration, coordinates, result contracts, cross-system Save composition, and the application boundary that keeps Terrain, Water, Roads, Zones, Buildings, Simulation, and RCI coherent.

## Does Not Own

- Domain rules inside Terrain, Roads, Zones, Buildings, Simulation, or RCI.
- Three.js presentation, tool state, pointer state, or undo history.
- Citizen, housing, Employment, migration, or Demand policy.

## Current Capabilities

- Canonical map configuration and coordinate contracts.
- Shared `Result` and contract-error patterns.
- `WorldSaveV1` through `WorldSaveV5` decode and deterministic migration.
- Cross-domain environment reconstruction after load.
- Fail-closed validation of Roads, Zones, Buildings, Simulation, and RCI references.
- `GameWorldStateStore` atomically owns the currently published Simulation, Building, and RCI snapshots.
- `planGameWorldTick` stages Building Growth, Simulation advancement, RCI reconciliation, validation, and receipts before one world revision is published.
- Invalid or stale staged work leaves the committed world unchanged.

## Ownership and State

Each domain owns its snapshot. `apps/game` owns composition, migration order, atomic publication, and the handoff to renderers/HUD. Water, occupancy maps, indexes, projections, and policy objects remain derived.

## Main Workflows

### World tick

1. Read one committed `GameWorldState`.
2. Plan Building Growth using the current RCI policy.
3. Stage Simulation and Building snapshots.
4. Plan RCI against the exact before/after Building and Simulation revisions.
5. Validate the complete staged state.
6. Replace the store once with the next world revision.
7. Update Building presentation and RCI HUD from committed snapshots only.

### Save/load

1. Decode Terrain and derive Water.
2. Decode Roads, Zones, Buildings, and Simulation in dependency order.
3. Rebuild placement environments and derived occupancy.
4. Decode `RciSaveV1` for V5, or deterministically migrate V1–V4 from decoded Simulation and active Building inventory.
5. Reject the complete load if any domain or cross-domain invariant fails.
6. Replace the complete application world and synchronize the atomic state store.

## Integrations

```mermaid
flowchart LR
  Terrain --> WorldSaveV5
  Roads --> WorldSaveV5
  Zoning --> WorldSaveV5
  Buildings --> GameWorldTick
  Simulation --> GameWorldTick
  RCI --> GameWorldTick
  GameWorldTick --> StateStore[GameWorldStateStore]
  StateStore --> WorldSaveV5
  StateStore --> Presentation
```

## Persistence

- `WorldSaveV1`: Terrain + Roads
- `WorldSaveV2`: adds Zones
- `WorldSaveV3`: adds Buildings V1
- `WorldSaveV4`: Buildings V2 + Simulation V1
- `WorldSaveV5`: adds RCI V1

Legacy migration preserves existing authority and derives empty RCI inventory from active Buildings without inventing Citizens, Households, occupancy, or Employment history.

## Invariants and Failure Behavior

- Save decode and world-tick publication are all-or-nothing.
- Domain revisions in a staged plan describe one coherent world transition.
- Derived Water revision matches Terrain.
- Persisted occupied cells remain valid against reconstructed environments.
- RCI evaluated ticks and references validate against decoded Building/Simulation authority.
- State replacement requires the expected world revision and exactly one next revision.
- Background ticks do not mutate active tools, previews, pointer sessions, or undo history.

## Extension Points

A new persisted system extends the world envelope with an explicit schema version, deterministic migration, decoded-state field, validation, atomic tick composition where applicable, system documentation, and compatibility tests.

## Current Limitations

The atomic store currently composes Simulation, Buildings, and RCI because those domains participate in background ticks. Terrain, Roads, Zones, and Water continue through their existing explicit world transactions and complete-world replacement boundary.

## Handoff Checklist

- Core contracts: `packages/world-core/src/index.ts`
- Save: `apps/game/src/world-save.ts`, `world-save-legacy.ts`
- Atomic state: `apps/game/src/game-world-state.ts`
- Tick orchestration: `apps/game/src/game-world-tick.ts`
- Related systems: [Terrain](../terrain/README.md), [Water](../water/README.md), [Roads](../roads/README.md), [Zoning](../zoning/README.md), [Buildings](../buildings/README.md), [Simulation Time](../simulation-time/README.md), [RCI](../rci/README.md)
