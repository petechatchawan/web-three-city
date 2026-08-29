# Terrain Authority Contract

- **Status:** FROZEN — OWNER APPROVED 2026-08-29
- **Date:** 2026-08-29
- **Owner:** `systems/terrain`
- **Depends on:** Terrain System Design, World Spatial Contract

## 1. Canonical state

For every valid World `VertexCoord`, Terrain may own exactly one canonical signed integer `LogicalElevation` when the owning logical Chunk is loaded.

```text
VertexCoord -> LogicalElevation
```

There is no second mutable seam value and no mesh-authoritative elevation.

## 2. Logical elevation unit

```text
1 LogicalElevation = 250,000 micrometers = 0.25 meters
```

Logical elevation must be an integer.

Presentation conversion:

```text
meters = elevation * 0.25
```

Presentation float conversion is downstream and never used to reconstruct canonical state.

## 3. Production elevation domain

Phase 1 canonical product bounds are:

```text
MIN_LOGICAL_ELEVATION = -4096  // -1024m
MAX_LOGICAL_ELEVATION =  4096  // +1024m
```

Although storage uses signed Int32, values outside the product bounds are invalid canonical Terrain values.

Mutation rejects out-of-range values rather than clamping silently.

The `balanced-temperate-generation/2` generator is further constrained to:

```text
32 <= generatedElevation <= 288
```

which corresponds to 8m–72m and leaves substantially more than the future Terraform reference of ±8 logical units (±2m) before either product bound.

## 4. Logical chunk partition

Terrain uses the World `16 × 16` logical Chunk topology. Each Terrain Chunk stores only vertices for which World `GridTopology.ownerChunk(vertex)` equals that Chunk.

A seam vertex is therefore stored in exactly one Chunk.

Non-owner Chunks may need derived presentation copies, but must never maintain mutable canonical seam copies.

## 5. Owner-window semantics

For each loaded Chunk, its storage window is the deterministic ordered set of valid VertexCoords owned by that Chunk under the World south-west rule.

Canonical within-Chunk ordering:

```text
z ascending
then x ascending
```

Storage layout may optimize this ordering later, but snapshot/fingerprint iteration must reproduce the canonical coordinate order explicitly rather than depend on object insertion order.

## 6. TerrainState completeness

TerrainState exposes authority availability separately from elevation values.

Conceptual statuses:

```text
partial   one or more logical Chunks unavailable
full      all 256 logical Chunks available
```

Production new-city acceptance requires `full`.

## 7. Query outcomes for unavailable authority

A query for valid coordinates whose owner Chunk is not loaded returns an explicit unavailable result, e.g. semantically:

```text
{ status: "unavailable", reason: "chunk-not-loaded", chunk: ChunkCoord }
```

It must not:

```text
return zero elevation
return null/undefined without semantic reason
clamp to nearby loaded data
read presentation geometry as fallback
throw a generic exception for expected unloaded state
```

Out-of-bounds and unavailable are distinct outcomes.

## 8. TerrainRevision

`TerrainRevision` is a monotonically increasing non-negative logical sequence number owned by Terrain.

Initial materialized Terrain begins at:

```text
revision = 0
```

Rules:

```text
actual successful canonical mutation -> revision + 1
valid no-op mutation                -> unchanged
rejected mutation                   -> unchanged
query                               -> unchanged
presentation rebuild                -> unchanged
snapshot capture                    -> unchanged
```

Phase 1 does not require revision wraparound behavior because product execution must reject/stop before an unsafe integer representation limit is reached; implementation uses a representation that preserves exact integer sequencing for the supported lifecycle.

## 9. Canonical Terrain snapshot

Snapshot semantics are chunked but authority remains global:

```text
TerrainStateSnapshot
  mapDefinitionId
  generationProfileId
  generationProfileVersion
  selectedSeed64
  revision
  completeness
  chunks[]
```

Each `TerrainChunkSnapshot` contains:

```text
chunkCoord
ownedElevations in canonical owner-window order
```

Chunk order is canonical `(z,x)` ascending.

No derived presentation data is serialized as canonical Terrain authority.

## 10. Materialization contract

A prepared immutable generated field is materialized by visiting every valid VertexCoord in canonical global order:

```text
z = 0..512
  x = 0..512
```

Each value is routed to exactly one owner Chunk using World topology.

Materialization validates the complete field before exposing a production full TerrainState. A failed materialization does not expose a half-constructed production state.

## 11. Canonical global iteration order

Whenever the system needs a stable full-field order for fingerprinting, verification, or semantic snapshot reconstruction:

```text
for z = 0..512
  for x = 0..512
    VertexCoord(x,z)
```

This order is independent of chunk storage order and render-sector order.

## 12. Derived state

The following are derived from canonical elevation and may be cached but never persisted as competing authority:

```text
cell triangle planes
sub-cell heights
slope/grade facts
normals
render-sector geometry
raycast acceleration data
dirty-sector sets
```

Caches must be invalidated from TerrainRevision/ChangeSet or reconstructed safely.

## 13. Authority invariants

```text
Every loaded valid Vertex has one LogicalElevation.
Every valid Vertex has one World-defined owner Chunk.
Only the owner Chunk stores canonical elevation.
LogicalElevation is integer and inside [-4096,4096].
One unit is exactly 0.25m.
TerrainRevision changes only on actual canonical mutation.
Full production state contains authority for all 256 logical Chunks.
Unloaded state is explicit and never fabricated.
Snapshots/fingerprints iterate canonical coordinates, not container insertion order.
Mesh/normals/materials/raycast values are derived only.
```

## 14. Tests

Required focused tests include:

```text
unique owner storage across every seam
product elevation bounds
meters conversion vectors
full vs partial availability
out-of-bounds vs unavailable distinction
initial revision 0
revision unchanged by queries/no-op
canonical global iteration order
chunk snapshot ordering
no presentation type in authority contracts
```
