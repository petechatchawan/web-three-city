# Map and Region Contract

- **Status:** FROZEN — OWNER APPROVED 2026-08-29
- **Date:** 2026-08-29
- **Owner:** `systems/world`
- **Depends on:** World System Design, World Spatial Contract, Phase 1 World/Map/Terrain Design

## 1. MapDefinition identity

The initial production MapDefinition is identified by:

```text
mapDefinitionId = web-three-city-production
profileId       = production-v1
profileVersion  = 1
```

Identity/version are explicit values, not hashes of runtime objects.

## 2. Production MapDefinition constants

```text
widthCells             = 512
heightCells            = 512
cellSizeMeters         = 8
logicalChunkSizeCells  = 32
regionCount            = 20
startingCandidateCount = 4
terrainGenerationProfileId      = balanced-temperate-generation
terrainGenerationProfileVersion = 2
```

The accepted production seed catalog is part of immutable MapDefinition/profile content, not scattered hard-coded caller logic.

Initial catalog:

```text
0x5EED5EED5EED5EED
```

A catalog entry is a fixed-width 16-hex-digit unsigned Seed64 string after `0x`.

## 3. Region representation

Canonical Region geometry is Cell ownership encoded as normalized horizontal runs:

```text
RegionCellRun {
  z: integer
  xStartInclusive: integer
  xEndExclusive: integer
}
```

Canonical run order:

```text
z ascending
then xStartInclusive ascending
```

Adjacent/overlapping runs on the same `z` within one Region are normalized into one maximal run before the MapDefinition is accepted.

Rendered polygons/borders are derived and never Region authority.

## 4. Production Region partition

Phase 1 production-v1 uses a deterministic `5 × 4` macro-region partition. The representation remains run-based so later approved MapDefinitions may use irregular Regions without changing World ownership.

X boundaries in Cell-edge coordinates:

```text
[0, 102, 205, 307, 410, 512]
```

Z boundaries:

```text
[0, 128, 256, 384, 512]
```

Region IDs are row-major from south to north, west to east:

```text
R00 R01 R02 R03 R04   z=[0,128)
R05 R06 R07 R08 R09   z=[128,256)
R10 R11 R12 R13 R14   z=[256,384)
R15 R16 R17 R18 R19   z=[384,512)
```

For Region column `rx` and row `rz`:

```text
RegionId = R{rz*5+rx as two digits}
X range  = [X_BOUNDARY[rx], X_BOUNDARY[rx+1])
Z range  = [Z_BOUNDARY[rz], Z_BOUNDARY[rz+1])
```

This exact partition is Phase 1 production content, not a general requirement that all future maps be rectangular Regions.

## 5. Region invariants

A valid MapDefinition must prove:

```text
exactly 20 unique RegionIds
every valid Cell belongs to exactly one Region
no Region cells outside MapExtent
no overlap
no uncovered Cell
each Region is cardinally connected
canonical run normalization/order
```

MapDefinition construction fails explicitly if any invariant is violated.

## 6. Region membership query

`regionAtCell(cell)` returns exactly one RegionId for every valid Cell.

Out-of-bounds Cell input produces an explicit out-of-bounds result, not a synthetic Region.

Membership is derived from canonical Region geometry.

## 7. Region adjacency

Adjacency is derived from shared cardinal Cell edges.

Normative definition:

```text
A adjacent B
iff
exists Cell a in A and Cell b in B
such that ManhattanDistance(a,b) == 1
```

Properties:

```text
irreflexive: A is not adjacent to A
symmetric:   A adjacent B => B adjacent A
diagonal-only contact does not count
```

Adjacency lists are returned in canonical MapDefinition RegionId order.

No neighbor list is persisted/authored as independent authority.

## 8. Starting candidates

Production-v1 starting candidate Regions are:

```text
R06
R08
R11
R13
```

Their StartAnchorCells are:

```text
R06 -> CellCoord(153,191)
R08 -> CellCoord(358,191)
R11 -> CellCoord(153,319)
R13 -> CellCoord(358,319)
```

Each anchor lies inside its Region and is at least four Cells from its Region boundary so the Phase 1 9×9 Terrain suitability patch is wholly contained by the candidate Region.

The candidate list order above is canonical.

## 9. Candidate ownership separation

World owns:

```text
which Regions are candidates
candidate order
StartAnchorCell
candidate Region membership
```

Terrain generation owns deterministic suitability evaluation from generated Terrain facts.

World does not inspect Three.js geometry or duplicate Terrain slope logic to determine eligibility.

## 10. Starting Region selection

Before `MapState` construction the caller receives the deterministic eligible candidate set from Terrain generation preparation.

A valid selected starting Region must:

```text
exist in MapDefinition
be one of the four starting candidates
be present in the eligible candidate set for the exact prepared Terrain field
```

Invalid selection is explicit failure. The app must not silently replace it with another Region.

## 11. MapState construction

Initial World state is:

```text
MapState {
  mapDefinitionId
  startingRegionId = selectedStartingRegionId
  unlockedRegionIds = [selectedStartingRegionId]
}
```

`StartingRegionId` is permanent provenance and remains present even when more Regions are unlocked later.

Phase 1 does not expose runtime unlock mutation.

## 12. MapState invariants

```text
StartingRegionId exists in MapDefinition
StartingRegionId is a starting candidate
StartingRegionId is present in UnlockedRegionIds
UnlockedRegionIds contains no duplicates
UnlockedRegionIds contains only known Regions
UnlockedRegionIds uses canonical Region order in snapshots/read DTOs
```

## 13. Snapshot contract

World semantic snapshot:

```text
MapStateSnapshot {
  mapDefinitionId
  mapProfileId
  mapProfileVersion
  startingRegionId
  unlockedRegionIds[]
}
```

The snapshot does not duplicate Region geometry because geometry is immutable MapDefinition content addressed by identity/version.

If future persistence requires self-contained map-definition data, that is a separate persistence/portability decision; it does not change current World authority.

## 14. Accepted seed catalog semantics

The catalog is immutable versioned MapDefinition content.

Phase 1 rules:

```text
caller must select a listed seed
no random default selection inside Terrain
no fallback scanning/mining
no silent substitution
```

Catalog membership is not proof of current Terrain bytes by itself; Terrain generation verification also checks the profile-specific output fingerprint and candidate eligibility vector.

## 15. Error semantics

Expected invalid conditions include stable semantic codes such as:

```text
WORLD_MAP_DEFINITION_INVALID
WORLD_REGION_UNKNOWN
WORLD_REGION_GEOMETRY_INVALID
WORLD_REGION_PARTITION_INCOMPLETE
WORLD_REGION_PARTITION_OVERLAP
WORLD_STARTING_CANDIDATE_INVALID
WORLD_STARTING_REGION_NOT_ELIGIBLE
WORLD_SEED_NOT_ACCEPTED
```

Exact TypeScript contract shape follows ADR-001 typed-result conventions where mutation/construction exposes expected rejection.

## 16. Tests

Required package tests include:

```text
all 512×512 Cells have exactly one Region
Region count and IDs exact
production boundaries exact
all Regions cardinally connected
adjacency symmetric/irreflexive and geometry-derived
candidate IDs/order exact
anchor coordinates exact and inside candidate Regions
9×9 anchor patch remains inside Region
initial MapState invariants
snapshot canonical Region ordering
accepted seed catalog exact
```

## 17. Explicit deferrals

```text
Region purchase price
runtime Region unlock command
expansion UI
alternate MapDefinitions
procedural Region partition generation
map workshop/import/export
```

## 18. Binding invariants

```text
MapDefinition is immutable and versioned.
Production-v1 has exactly 20 Regions and 4 starting candidates.
Region geometry is Cell-based authority.
Adjacency is derived, never authored separately.
StartingRegionId is permanent city provenance.
Accepted seeds are versioned MapDefinition content.
Selection never silently falls back to another seed or Region.
```
