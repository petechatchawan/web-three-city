# World System

- **Status:** FROZEN — OWNER APPROVED 2026-08-29
- **Date:** 2026-08-29
- **Owner:** `systems/world`
- **Phase:** Phase 1 — World / Map / Terrain
- **Umbrella:** `docs/architecture/PHASE-1-WORLD-MAP-TERRAIN-DESIGN.md`

## Purpose

World owns the logical playable-space authority used by Phase 1. It defines what the map is, how discrete locations are addressed, how logical chunks are derived, how Regions partition the map, and which Region is the permanent starting provenance of a city.

World does not own Terrain elevation, rendered geometry, camera state, Roads, zoning, buildings, economy, or Terraform policy.

## Canonical authority

```text
MapDefinition      immutable world/map configuration
MapState           city-specific World state
GridTopology       sole authority for discrete grid mathematics
Region geometry    immutable map partition
Region adjacency   derived from Region geometry
```

Authority direction:

```text
MapDefinition
      ↓
GridTopology
      ↓
World read contracts
      ↓
Terrain and later consumers
```

## Phase 1 production baseline

```text
512 × 512 gameplay cells
8m × 8m per cell
4096m × 4096m playable extent
32 × 32 cells per logical chunk
16 × 16 logical chunks
20 Regions
4 starting candidates
```

## Public surfaces

Expected Phase 1 package surfaces after implementation approval:

```text
@web-three-city/world
  read/observe values and queries

@web-three-city/world/composition
  app-only construction
```

No `./commands` surface is justified in Phase 1. Region purchase/unlock gameplay is deferred. Initial `MapState` is constructed from explicit new-city input.

## External dependencies

World has no production dependency on Terrain.

World must not depend on Three.js, DOM/browser APIs, persistence implementations, runtime scheduler, or future gameplay systems.

## Snapshot ownership

World owns the semantic snapshot of:

```text
MapDefinition identity/version
StartingRegionId
UnlockedRegionIds in canonical order
```

A future persistence adapter serializes this snapshot; persistence never becomes World authority.

## Binding specifications

- `specs/WORLD-SYSTEM-DESIGN.md`
- `specs/WORLD-SPATIAL-CONTRACT.md`
- `specs/MAP-AND-REGION-CONTRACT.md`
- `specs/WORLD-SNAPSHOT-RESTORE-CONTRACT.md`

## Verification boundary

World correctness is primarily proven without browser/WebGL through focused and package contract tests. Required cross-package verification proves the approved Terrain → World read edge through public exports only.

## Explicit non-goals

```text
Terrain elevation/slope
Three.js presentation
Region economy/purchase rules
Terraform
save encoding
streaming scheduler
ECS
simulation time
```
