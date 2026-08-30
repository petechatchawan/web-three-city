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

## Snapshot versioning and migration policy

`TerrainStateSnapshotV1` is the only supported Terrain snapshot format in Terrain Engine v1. Unsupported versions are rejected; there is no implicit fallback, silent clamp, best-effort decode, or seed-based regeneration.

Snapshot version is independent from Terrain generation profile version. Changing generation algorithms does not invalidate canonical saved elevations. A snapshot version changes only when the persisted Terrain schema or its semantic interpretation changes.

### Current pre-release policy

```text
Read:  TerrainStateSnapshotV1 only
Write: TerrainStateSnapshotV1 only
Unknown snapshotVersion: reject
Migration implementation: none required yet
```

The first shipped save format becomes user data. From that point onward, introducing `TerrainStateSnapshotV2` requires an explicit migration tranche before the application starts writing V2 saves.

### Rule for introducing a new snapshot version

Before a new version can become the write format, all of the following are required:

1. A frozen V2 contract describing every schema and semantic difference from V1.
2. A deterministic, presentation-free `V1 -> V2` migration path for every still-supported prior version.
3. Golden migration fixtures covering representative, boundary, mutated, minimum-elevation, and maximum-elevation snapshots.
4. Validation after migration using the target-version validator before any TerrainSystem is published.
5. Deep-equal or explicitly documented semantic equivalence checks for canonical elevation authority and surface queries.
6. A rollback/recovery decision for migration failure; failure must preserve the original persisted save unchanged.
7. City-save envelope coordination so outer save versioning and Terrain snapshot versioning cannot disagree silently.

### Migration execution contract

Migration must be a pure snapshot-to-snapshot transformation:

```text
persisted bytes
  -> decode old snapshot
  -> validate old snapshot
  -> migrate in memory
  -> validate new snapshot
  -> restore TerrainSystem
  -> optional later atomic persistence of upgraded save
```

Migration must never:

```text
regenerate Terrain from seed
query Three.js presentation state
partially overwrite the persisted source before validation succeeds
silently discard unknown canonical data
clamp invalid elevation into range
advance Terrain revision as a side effect
```

If migration fails at any step, loading fails with a typed incompatibility/invalid-data result and the original persisted save remains untouched.

### Compatibility matrix

| Persisted Terrain snapshot | Terrain Engine v1 behavior |
| --- | --- |
| V1 | validate and restore |
| V2+ | reject until an explicit migrator is shipped |
| missing/invalid version | reject as invalid/incompatible |

This policy deliberately separates **format compatibility** from **generator compatibility**: canonical saved Terrain state remains authority, while generation fingerprints continue to serve regression/provenance diagnostics only.

## Failure

Invalid snapshot returns typed construction rejection and publishes no partial TerrainSystem.
