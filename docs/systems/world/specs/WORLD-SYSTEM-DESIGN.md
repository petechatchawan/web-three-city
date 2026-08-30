# World System Design

- **Status:** FROZEN — OWNER APPROVED 2026-08-29
- **Date:** 2026-08-29
- **Owner:** `systems/world`
- **Depends on:** Phase 1 World/Map/Terrain Design, Product Architecture, ADR-001, A3–A10

## 1. Purpose

World is the bounded gameplay authority for the logical playable-space model. It owns Map configuration, city-specific map state, grid coordinates/topology, Regions, and starting-region provenance.

World answers:

```text
What map is this?
Where is a Cell/Vertex/Chunk?
Which logical Chunk owns a location?
Which Region owns a Cell?
Which Regions are adjacent?
Which Region was selected when this city was created?
Which Regions are currently unlocked?
```

World does not answer Terrain or placement-policy questions.

## 2. Package justification

`systems/world` satisfies A3 package creation because it has one coherent ownership boundary, stable public values needed by multiple future consumers, independently testable invariants, and no honest existing owner in Foundation or `apps/game`.

There is no `systems/map`. Map is a first-class World domain concept.

There is no Phase 1 `foundation/spatial`; current spatial vocabulary remains World/gameplay semantic vocabulary.

## 3. Canonical authority

### 3.1 `MapDefinition`

Immutable configuration describing one map definition/profile:

```text
MapDefinitionId
profileId
profileVersion
widthCells
heightCells
cellSizeMeters
logicalChunkSizeCells
Region definitions
starting candidate definitions
terrain generation profile identity
accepted production seed catalog
```

Changing any binding configuration requires a different definition/version. A running city never silently mutates its `MapDefinition`.

### 3.2 `MapState`

Mutable-in-principle city/save-specific authority:

```text
MapDefinitionId
StartingRegionId
UnlockedRegionIds
```

Phase 1 construction invariant:

```text
UnlockedRegionIds = { StartingRegionId }
```

The representation supports multiple unlocked Regions for later expansion, but Phase 1 exposes no runtime Region-unlock Command.

### 3.3 `GridTopology`

Pure deterministic authority for World discrete spatial mathematics. It owns all Cell/Vertex/Chunk incidence and boundary formulas. Consumers may call public read capabilities but must not reimplement competing formulas.

### 3.4 Region geometry

Region membership geometry is immutable MapDefinition content. Region adjacency is derived from geometry and is not persisted/authored as a second truth.

## 4. Stable public value types

The World root read surface may deliberately expose immutable value/DTO types required by Terrain and future systems:

```text
MapDefinitionId
RegionId
CellCoord
VertexCoord
ChunkCoord
CellRect
MapExtent
RegionSummary
StartingCandidate
WorldSpatialRead
MapStateSnapshot
```

These values remain World-owned even when imported by another system.

Public values are plain serializable data/opaque value contracts and must not expose mutable domain collections or implementation stores.

## 5. Public surface design

### `.` — read/observe

May expose:

```text
stable World value types
MapDefinition read view
MapState read view
WorldSpatialRead query capability
Region membership/adjacency queries
snapshot capture read capability
```

Must not expose mutation services.

### `./composition`

May expose an app-only factory for validating a MapDefinition and constructing the World read capability/initial MapState from explicit input.

### `./commands`

Absent in Phase 1. Creating it later requires a real approved World mutation use case.

## 6. Dependency policy

World domain/application has no dependency on Terrain.

World may depend on approved generic Foundation contracts only when actually required. Phase 1 does not justify a new Foundation spatial package.

Forbidden:

```text
Three.js
DOM/window/document
Terrain package
Roads/Zoning/Buildings
persistence implementation
runtime scheduler
service locator/global registry
```

## 7. Terrain consumption rule

Phase 1 approves:

```text
systems/terrain -> @web-three-city/world
```

as a read-only A6 exception.

World does not import Terrain back, so the direct Query graph remains acyclic.

World public coordinates/topology are the one cross-system spatial vocabulary. Terrain must not redefine public competing `TerrainCellCoord`/`TerrainVertexCoord` concepts solely to avoid this edge.

## 8. Domain purity

World domain owns coordinates, topology invariants, Region geometry validation, and MapState invariants. It remains browser/Three.js independent.

World public read contracts may expose stable owner value types originating from domain semantics, but mutable entities/stores stay private.

## 9. Construction semantics

New-city composition supplies:

```text
validated MapDefinition
selected eligible StartingRegionId
```

World constructs initial state:

```text
StartingRegionId = selected Region
UnlockedRegionIds = canonical singleton(selected Region)
```

World does not determine Terrain suitability. Selection eligibility is established from Terrain generation evaluation before state construction.

## 10. Snapshot semantics

World snapshot is canonical state transfer data, not storage bytes:

```text
mapDefinitionId
mapProfileId
mapProfileVersion
startingRegionId
unlockedRegionIds[]
```

`unlockedRegionIds` uses canonical RegionId order defined by MapDefinition, not insertion order.

Snapshot capture does not mutate state.

## 11. Expected failure model

Construction/validation uses the same stable semantic vocabulary as the binding Map/Region and spatial contracts:

```text
WORLD_MAP_DEFINITION_INVALID
WORLD_REGION_UNKNOWN
WORLD_REGION_GEOMETRY_INVALID
WORLD_REGION_PARTITION_INCOMPLETE
WORLD_REGION_PARTITION_OVERLAP
WORLD_STARTING_CANDIDATE_INVALID
WORLD_STARTING_REGION_NOT_ELIGIBLE
WORLD_COORD_OUT_OF_BOUNDS
```

A more specific binding contract owns the exact conditions and diagnostic detail for each code. The system design does not define competing aliases for the same failure.

Exact API result shapes are finalized during implementation planning under ADR-001 typed-result conventions; expected invalid input is never represented only by incidental exception strings.

## 12. Testing boundary

Focused tests prove coordinates, topology, MapDefinition validation, Region partition invariants, MapState invariants, and canonical snapshot ordering.

Package contract tests prove root exports and composition surface behavior.

Cross-package integration tests prove Terrain consumes only World public read contracts.

No browser test is required for World semantic correctness.

## 13. Explicit deferrals

Deferred beyond Phase 1:

```text
Region purchase/unlock gameplay Command
Region pricing/economy
map editor/import/export
procedural Region generation
large-world streaming policy
persistence encoding
simulation scheduling
```

## 14. Binding invariants

```text
World owns Map, Grid, Regions, and public spatial vocabulary.
MapDefinition is immutable.
MapState never contains Terrain elevations.
GridTopology is the sole owner of discrete grid formulas.
Region adjacency is derived from geometry.
World never imports Terrain.
Terrain may read World root only through the reviewed acyclic edge.
No World command surface exists without a real runtime mutation use case.
World snapshots describe authority; persistence only serializes them later.
World domain is independent of Three.js/browser APIs.
```
