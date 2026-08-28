# Terrain System Design

- **Status:** REVIEW DRAFT — NOT FROZEN
- **Date:** 2026-08-29
- **Owner:** `systems/terrain`
- **Depends on:** Phase 1 World/Map/Terrain Design, World System Design, World Spatial Contract, ADR-001, A3–A10

## 1. Purpose

Terrain is the bounded gameplay authority for ground elevation and the deterministic geometric surface derived from that elevation field.

It owns:

```text
TerrainState
LogicalElevation
logical Terrain chunk storage
TerrainRevision
Terrain queries
fixed surface topology semantics
deterministic generation
atomic Terrain mutation
TerrainChangeSet
Terrain snapshot meaning
Terrain-owned Three.js presentation projection
```

It does not own Map/Region progress, placement policy, Terraform product behavior, Hydrology/Water, or save encoding.

## 2. Package justification

Terrain is independently meaningful, stateful, queryable, mutable, testable without browser startup, and has a distinct canonical authority from World. It therefore qualifies as `systems/terrain` under A3.

Terrain presentation remains inside this owner because use of Three.js alone does not justify a separate package.

## 3. Canonical authority

Canonical Terrain is:

```text
World-owned VertexCoord
        ↓
Terrain-owned LogicalElevation<int32>
```

The authoritative state is logically partitioned by World logical Chunks, but chunk partitioning does not create independent seam truths.

One valid VertexCoord has exactly one canonical elevation in exactly one owner Chunk.

## 4. World dependency decision

Phase 1 chooses the strict A5-compatible layering model:

```text
Terrain contracts/application
        ↓ may import
@web-three-city/world root read surface

Terrain domain internals
        X do not import World package code
```

This preserves both requirements:

1. World remains the single public owner of `CellCoord`, `VertexCoord`, `ChunkCoord`, `MapDefinition` and topology semantics.
2. Terrain domain remains independent of another system's application/read service implementation.

### 4.1 Public contract use

Terrain public contracts may reference deliberately public immutable World value types such as `VertexCoord`, `CellCoord`, and `ChunkCoord` where those coordinates are semantically the same World locations.

Terrain does not re-export those values merely for convenience.

### 4.2 Application mapping

Terrain application validates/resolves World public values through `WorldSpatialRead`, then maps them into owner-local internal storage indices/keys before invoking pure Terrain domain operations.

Internal storage indices are implementation details, not competing public coordinate concepts.

### 4.3 Forbidden coupling

Terrain domain/application must never import:

```text
World application internals
World composition surface
World commands (none exist in Phase 1)
World private stores/entities
```

## 5. Internal responsibility mapping

Expected A5 mapping once implementation is approved:

```text
domain/
  elevation/state/revision invariants
  internal chunk ownership storage
  surface integer/fixed-point calculations
  mutation state transitions

application/
  public query implementations
  World coordinate/topology resolution
  generation/materialization use cases
  mutation command handling
  snapshot capture

contracts/
  Terrain read DTOs/results
  mutation command/result/rejections
  generation preparation/result contracts
  snapshot DTOs

presentation/three/
  render-sector geometry/material lifecycle
  raycast candidate projection
  localized rebuild

composition/
  system factory
  app-only Three.js projection factory
```

Only folders with real code are created.

## 6. Public surfaces

### Root `.`

Read/observe only:

```text
LogicalElevation value contract
TerrainRevision
Terrain availability/status DTOs
vertex/cell/surface Query capability
slope/triangle read facts
Terrain snapshot DTOs when required by future persistence consumer
```

No mutation entrypoint or Three.js object is exposed here.

### `./commands`

Owns atomic Terrain mutation request/result/rejection contracts and the mutation entrypoint.

### `./composition`

App-only construction surface for creating the Terrain system from explicit MapDefinition/World read dependencies and for creating system-owned Three.js presentation projection.

Three.js types may appear only on a deliberately presentation-specific composition contract if unavoidable; they must never leak to `.` or `./commands`.

## 7. Partial-state capability

Terrain Core may represent a subset of loaded logical Chunks. This is an authority-availability state, not a streaming implementation commitment.

Production Phase 1 new-city completion requires all 256 logical Chunks loaded.

Queries requiring unloaded authority return typed unavailable outcomes. They never synthesize default elevation.

## 8. Surface ownership

The geometric ground truth is exactly:

```text
canonical elevations
+
fixed NW→SE cell triangulation
```

There is no separate bilinear, GPU, Mesh, collider, or raycast-defined continuous surface.

Surface queries and presentation use the same fixed topology.

## 9. Generation ownership

Terrain owns the deterministic algorithm and immutable prepared `ProductionTerrainField`.

World owns MapDefinition and accepted seed catalog. Terrain validates profile/seed inputs and generates exactly once for the caller-selected accepted seed.

Generation never changes seed silently.

## 10. Mutation ownership

Terrain mutation is a single-authority ADR-001 Command. Terrain validates the entire request before canonical commit.

A successful actual change increments TerrainRevision exactly once regardless of edit count.

A valid no-op succeeds without revision advancement.

## 11. Change reporting

`TerrainChangeSet` is owner data produced after successful canonical mutation. It is not an Integration Event and does not require caller publication.

It reports exact revision transition plus deterministic changed Vertex/Cell/logical-Chunk facts suitable for derived presentation synchronization.

Phase 1 does not create a runtime event bus solely to transport this change set.

## 12. Presentation ownership

Terrain owns its concept-specific Three.js projection under `presentation/three`.

The app composition root attaches/disposes that projection in the product scene. App presentation assembly does not acquire Terrain authority.

## 13. Snapshot ownership

Terrain snapshots describe canonical authority/provenance:

```text
MapDefinition linkage
generation profile/version
selected seed
TerrainRevision
loaded/full status
chunk snapshots
owned elevations in canonical order
```

No Mesh, normal, material, render-sector buffer, or raycast acceleration structure belongs in canonical snapshots.

## 14. Expected failure classes

Expected invalid conditions use typed outcomes/rejections, including:

```text
unsupported profile/version
unaccepted seed
invalid/out-of-bounds World coordinate
unloaded owner Chunk
invalid elevation
conflicting duplicate edit
invalid snapshot/materialization input
```

Programming invariant violations and infrastructure/WebGL failures remain separate classes.

## 15. Testing boundary

Terrain domain/application/generation/mutation/surface behavior is proven without browser startup.

Cross-package integration verifies the World root dependency through public surfaces only.

Three.js projection has focused pure builder tests plus targeted browser tests only for real browser/WebGL behavior.

## 16. Explicit deferrals

```text
Terraform interaction semantics
Road/Building policy
Hydrology/Water
concrete persistence format
runtime event delivery
scheduler/ECS
large-world streaming lifecycle
GPU optimization/BVH strategy
```

## 17. Binding invariants

```text
Terrain owns elevation; World owns coordinates/topology.
Terrain domain does not import World package code.
Terrain contracts/application may use World root public values/read capability.
There is one canonical elevation per valid VertexCoord.
Mesh/GPU state never becomes authority.
Surface queries and rendering use one fixed topology.
Mutation is atomic and single-authority.
Generation is deterministic from explicit MapDefinition/profile/seed.
Partial state never fabricates unavailable authority.
Snapshots contain canonical authority, not reconstructed presentation.
```
