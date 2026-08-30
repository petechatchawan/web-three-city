# Terrain System

- **Status:** PRODUCTION CLOSED — 2026-08-30
- **Date:** 2026-08-30
- **Closed code baseline:** `master@19fb9e6e9999ecb69cba0ad51ada3e0685c48b51`
- **Owner:** `systems/terrain`
- **Phase:** Phase 1 — World / Map / Terrain
- **Umbrella:** `docs/architecture/PHASE-1-WORLD-MAP-TERRAIN-DESIGN.md`

Terrain Engine v1 production responsibilities are closed. Its binding contracts remain frozen; downstream gameplay systems consume Terrain through its public surfaces and do not reopen Terrain ownership by adding product semantics.

## Purpose

Terrain owns the canonical ground elevation state, deterministic generated terrain field, triangulated surface semantics, geometric queries, atomic mutation foundation, logical revision/change reporting, snapshot semantics, and the system-owned Three.js projection of that authority.

Terrain does not own Map/Region state, Roads/buildings placement policy, Terraform product semantics, economy, Hydrology/Water, or persistence encoding.

## Canonical authority

```text
VertexCoord (World-owned spatial value)
        ↓
LogicalElevation<int32>
        ↓
TerrainState
        ↓
fixed NW→SE surface semantics
        ↓
derived presentation
```

`THREE.Mesh`, `BufferGeometry`, render-sector buffers, materials, normals, and raycast hit Y are never Terrain authority.

## Production baseline

```text
513 × 513 Terrain vertices
256 logical Terrain Chunks aligned to World logical chunks
1 LogicalElevation = 0.25m
fixed NW→SE diagonal
Q16 sub-cell sampling
balanced-temperate-generation / 2
Seed64 = explicit canonical 64-bit hexadecimal input
golden regression seed 0x5EED5EED5EED5EED
8 × 8 Three.js render sectors
```

## Public surfaces

Implemented package surfaces:

```text
@web-three-city/terrain
  read/observe queries and value contracts

@web-three-city/terrain/commands
  atomic Terrain mutation

@web-three-city/terrain/composition
  app-only construction and Three.js presentation wiring
```

## Approved dependency

Terrain has one reviewed direct system read edge:

```text
systems/terrain -> @web-three-city/world
```

Terrain contracts/application may use stable World public values/read capabilities. Terrain domain internals must not import World application/services or any World private path.

## Binding specifications

- `specs/TERRAIN-SYSTEM-DESIGN.md`
- `specs/TERRAIN-AUTHORITY-CONTRACT.md`
- `specs/TERRAIN-SURFACE-CONTRACT.md`
- `specs/TERRAIN-GENERATION-CONTRACT.md`
- `specs/TERRAIN-MUTATION-CONTRACT.md`
- `specs/TERRAIN-PRESENTATION-CONTRACT.md`
- `specs/TERRAIN-SNAPSHOT-AND-RESTORE-CONTRACT.md`
- `specs/TERRAIN-DEBUG-VISUALIZATION-CONTRACT.md`

## Snapshot ownership

Terrain owns semantic snapshots of its canonical state and provenance. A later persistence layer serializes those snapshots but never owns Terrain meaning.

## Verification evidence

- `verification/TERRAIN-ENGINE-V1-PRODUCTION-CLOSURE.md`
- `verification/TERRAIN-PRODUCT-INTEGRATION-V1.md`

## Verification boundary

Domain/application/generation/surface/mutation correctness is browser-independent. Three.js projection builders should be tested below browser level where practical. Browser tests are reserved for actual WebGL scene/raycast/resource-lifecycle behavior.

## Explicit non-goals

```text
Terraform UI/product policy
Road/building buildability policy
Hydrology/Water
concrete save bytes
runtime scheduler/ECS
authority derived from Mesh/GPU state
```
