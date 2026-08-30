# Terrain Snapshot and Restore Contract

- **Status:** FROZEN — OWNER APPROVED 2026-08-30
- **Owner:** `systems/terrain`

## Purpose

Define the semantic, presentation-free Terrain snapshot and the only supported reconstruction path for an existing city.

## Snapshot

```text
snapshotVersion = 1
mapDefinitionId
generationProfileId
generationProfileVersion
selectedSeed64
fingerprint
revision
completeness
chunks[] canonical (z,x)
  chunk
  elevations[] owner-window Vertex order (z,x)
```

Each canonical Terrain Vertex is serialized exactly once by its owner logical chunk. Snapshot capture uses explicit canonical sorting, never Map insertion order.

## Forbidden persisted data

```text
Three.js objects
render sectors
normal buffers
materials
dirty flags
camera/debug/UI state
Raycaster data
```

## Restore

`restoreTerrainSystem()` is exposed through Terrain `./composition` only. It validates the complete snapshot before publishing a system.

Required validation:

```text
snapshotVersion supported
mapDefinitionId matches active World definition
generation profile identity/version supported
Seed64 canonical/valid
fingerprint format valid
revision non-negative integer
chunk coordinates valid and unique
chunk count/completeness coherent
owner-window elevation counts exact
all elevations valid LogicalElevation
no missing or duplicate canonical Vertex
```

For a saved city, canonical elevations in the snapshot are authority. Restore does not regenerate from seed and compare every value before accepting; seed/fingerprint remain provenance and diagnostics. Generator regression is verified separately.

## Round trip

For a full Terrain:

```text
snapshot -> restore -> snapshot
```

must be deep-equal in canonical order. Semantic surface queries before snapshot and after restore must match for representative and mutation-affected Cells.

## Revision

Restore preserves saved revision exactly. It does not increment revision. A later real mutation advances from that revision normally.

## Failure

Invalid snapshot returns typed construction rejection and publishes no partial TerrainSystem.
