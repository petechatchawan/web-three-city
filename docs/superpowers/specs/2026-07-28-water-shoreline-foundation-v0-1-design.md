# Web Water & Shoreline Foundation v0.1 — Design Specification

- Status: **Accepted on 2026-07-28**
- Decision owner: repository owner
- Delivery profile: **single-developer / low-maintenance**
- Base commit: `8e4b002e547b456cf678aa325f78662121316e6e`
- Depends on:
  - Web Terrain Foundation v0.1
  - Prototype Interaction Completion v0.1

## 1. Purpose

Deliver the first deterministic ocean and shoreline system for Web Three City.

The milestone must make the existing Coastal terrain read visually as a coastal world while preserving the current pure TypeScript domain boundary, chunked Three.js presentation, mobile-first rendering budget, save/load behavior, camera interaction, Terrain grid, and cell selection.

This is a foundation milestone, not a general hydrology system.

## 2. Single-developer scope policy

The implementation is intentionally smaller than the maximum future architecture.

The following decisions are locked to reduce ongoing maintenance:

1. Add only two packages:
   - `packages/water-core`
   - `packages/water-three`
2. Reuse `apps/terrain-lab`; do not create a separate Water Lab application.
3. Derive the complete Water snapshot from the complete Terrain snapshot.
4. Rebuild the complete Water presentation when Terrain is loaded or replaced.
5. Keep chunk-local geometry, but defer incremental dirty-chunk scheduling and chunk signatures.
6. Keep Water fully derived; do not change `TerrainSaveV1`.
7. Support one canonical ocean source policy only: the south map boundary.
8. Defer lakes, rivers, flood simulation, reflection, refraction, animated waves, and water physics.

A later Terraform milestone may initially trigger a full Water rebuild. Incremental Water invalidation is allowed only after profiling proves it is necessary.

## 3. Architecture

Dependency direction:

```text
world-core
   ↓
terrain-core
   ↓
water-core
   ↓
water-three
   ↓
apps/game + apps/terrain-lab
```

Rules:

- `water-core` is pure TypeScript.
- `water-core` must not import Three.js, DOM APIs, browser APIs, or application code.
- `water-three` owns Three.js materials, geometry adapters, lifecycle, render order, and disposal.
- Terrain remains authoritative for height and topology.
- Terrain does not import or reference Water.
- Water reads a `TerrainSnapshot` and records the Terrain revision from which it was derived.
- The Game application composes Terrain, Water, Grid, Selection, and Camera.

## 4. Canonical world constants

The existing world contract remains authoritative:

```text
map                    128 × 128 cells
chunk                   16 × 16 cells
cell size                1.0 world unit
height step              0.5 world unit
sea level                1 height level
logical water Y          0.5 world unit
diorama base Y          -1.5 world units
```

Presentation offsets:

```text
water surface offset     +0.010
shoreline band offset    +0.013
Terrain grid offset      +0.015  (existing)
selection offset         +0.020  (existing)
```

Therefore the rendered Water surface is at world Y `0.51` while logical classification remains at height level `1`.

Presentation offsets must never affect connectivity, depth, save data, hashing, or test fixtures.

## 5. Ocean ownership

Water v0.1 supports one body type: **edge-connected sea**.

The only canonical ocean source is the south map boundary:

```ts
const OCEAN_POLICY_V1 = {
  version: 'south-edge-sea-v1',
  sourceBoundary: 'south',
} as const;
```

A wet fragment is part of the sea only when it is connected to a wet fragment with non-zero contact on the south boundary.

Connectivity rules:

- Shared wet edge interval with positive length: connected.
- Contact at one point only: not connected.
- Diagonal corner contact: not connected.
- Low Terrain touching north, east, or west boundary: not an ocean source.
- Enclosed depressions: not rendered as water.
- A real open channel from the south sea into a depression: connected and rendered.

This policy matches the current Coastal generator, whose water-facing region is on the south side of the map.

## 6. Terrain topology authority

Water must use the exact Terrain topology contract:

- `selectTerrainDiagonal()` chooses the canonical cell diagonal.
- `CELL_TRIANGLES` defines the two canonical Terrain triangles in the cell.
- Water may not choose a separate diagonal.
- Water may not classify from cell center height.
- Water may not use a screen-space mask or texture-derived coastline.

Each map cell contributes two canonical Terrain triangles. For Water indexing, the triangle order is the order already defined by `CELL_TRIANGLES[diagonal]`.

Canonical triangle index:

```text
triangleIndex = ((cellZ × mapWidth) + cellX) × 2 + localTriangleIndex
```

## 7. Wet fragment derivation

For each canonical Terrain triangle:

1. Read its three Terrain corner levels.
2. Clip the triangle against the logical plane `heightLevel <= seaLevel`.
3. Discard fragments with zero or near-zero area.
4. Preserve deterministic vertex order.
5. Record wet intervals on the original triangle edges for connectivity.

Possible clipped results:

```text
0 vertices / zero area   dry
3 vertices               triangle fragment
4 vertices               quad fragment, triangulated deterministically
```

Intersection parameter on an edge:

```ts
t = (seaLevel - levelA) / (levelB - levelA)
```

The calculation must use Terrain height levels, not presentation Y values.

The resulting Water surface vertices use a constant rendered Y of `logicalWaterY + waterSurfaceOffset`.

## 8. Sea connectivity derivation

`water-core` builds a graph of positive-area wet fragments.

Two fragments are adjacent only when their wet intervals overlap with positive length on the same canonical Terrain edge.

The derivation then:

```text
all wet fragments
→ seed fragments with positive-length south-boundary contact
→ deterministic flood fill
→ mark reachable fragments as sea
→ leave unreachable fragments enclosed and unrendered
```

Determinism requirements:

- Iterate cells in z-major, then x-major order.
- Iterate local triangles in canonical array order.
- Visit graph neighbors in ascending triangle index order.
- Identical Terrain input must produce byte-identical Water masks and stable counts.

## 9. Water domain model

```ts
export interface WaterSnapshot {
  readonly schemaVersion: 1;
  readonly policyVersion: 'south-edge-sea-v1';
  readonly width: number;
  readonly height: number;
  readonly seaLevel: number;
  readonly sourceTerrainRevision: number;
  readonly sourceTerrainSeed: number;
  readonly seaTriangleMask: Uint8Array;
  readonly seaTriangleCount: number;
  readonly enclosedWetTriangleCount: number;
  readonly shorelineSegmentCount: number;
}
```

`seaTriangleMask` contains one byte per canonical Terrain triangle:

```text
0 = not sea
1 = connected sea
```

The snapshot does not duplicate Terrain heights, clipped vertices, Three.js geometry, material data, or save data.

Public derivation:

```ts
export function deriveWaterSnapshot(
  terrain: TerrainSnapshot,
  config: WorldConfig,
): Result<WaterSnapshot, WaterError>;
```

Validation requirements:

- Terrain dimensions match the world configuration.
- Height lattice length is correct.
- Terrain revision is a non-negative integer.
- Sea level is inside the configured Terrain level range.

Typed error codes:

```text
water:invalid-terrain-dimensions
water:invalid-height-lattice
water:invalid-terrain-revision
water:invalid-sea-level
water:terrain-revision-mismatch
water:disposed
water:not-loaded
```

## 10. Water surface classification

Rendered sea geometry carries continuous depth information.

For each Water vertex:

```text
depthLevels = seaLevel - interpolatedTerrainHeightLevel
```

Depth labels:

```text
shallow shelf  depthLevels = 0 on level-1 Terrain covered by Water
transition     0 < depthLevels < 1
 deep          depthLevels >= 1 on level-0 Terrain
```

Shoreline is not a depth category. It is the geometric boundary of connected sea and is emitted separately as a ribbon.

The current Coastal terrain therefore renders level-1 shelf areas as shallow water and level-0 areas as deep water.

Vertex colors interpolate between shallow and deep colors. No depth texture, distance field, second render pass, or animated shader is required in v0.1.

## 11. Shoreline definition

A canonical shoreline segment is a positive-length boundary of connected sea where the adjacent side is dry or non-sea.

The south map boundary is excluded from shoreline output because it is the ocean exit boundary.

Shoreline segments must be:

- deterministic;
- unique;
- free of zero-length segments;
- exact across chunk seams;
- derived from clipped Terrain edges;
- independent of camera and renderer state.

Presentation uses a narrow triangle ribbon, not WebGL line width.

Locked ribbon width:

```text
0.35 × cellSize
```

The ribbon is clipped to its owning Water chunk and rendered slightly above the Water surface.

## 12. Chunk-local mesh ownership

Water geometry uses the existing 16 × 16 Terrain chunk partition.

A Water fragment belongs to the chunk of its owning Terrain cell.

Each `WaterChunkMeshData` may contain:

- Water surface positions;
- upward normals;
- vertex colors;
- surface indices;
- shoreline ribbon positions and indices;
- counts and bounds;
- source Terrain revision.

```ts
export interface WaterChunkMeshData {
  readonly chunk: ChunkCoord;
  readonly sourceTerrainRevision: number;
  readonly surfacePositions: Float32Array;
  readonly surfaceNormals: Float32Array;
  readonly surfaceColors: Float32Array;
  readonly surfaceIndices: Uint16Array;
  readonly shorelinePositions: Float32Array;
  readonly shorelineColors: Float32Array;
  readonly shorelineIndices: Uint16Array;
  readonly surfaceTriangleCount: number;
  readonly shorelineTriangleCount: number;
  readonly bounds: MeshBounds;
}
```

Mesh build contract:

```ts
export function buildWaterChunkMesh(
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  chunk: ChunkCoord,
  config: WorldConfig,
): WaterChunkMeshData;
```

The builder must reject Terrain/Water revision mismatch.

All chunk indices must fit in `Uint16Array`.

## 13. Diorama Water wall

Connected sea intervals on the south map boundary produce a vertical Water wall.

Wall coordinates:

```text
top Y       logicalWaterY + waterSurfaceOffset
bottom Y    dioramaBaseY
boundary Z  south world boundary + 0.01 outward offset
```

Rules:

- Build wall only for connected sea intervals.
- Do not build wall behind south-boundary land.
- Merge adjacent collinear intervals when safe.
- Do not create walls on north, east, or west boundaries.
- The Water wall must not extend above the Water surface.
- The Water wall must fully cover the Terrain skirt where the sea exits the diorama.
- The Water wall is opaque to prevent the earth skirt showing through.

The Terrain outer skirt remains unchanged.

## 14. Three.js presentation

`water-three` owns:

- BufferGeometry adapters;
- shared Water materials;
- one `WaterPresentation` lifecycle owner;
- atomic full load;
- context restoration;
- idempotent disposal.

```ts
export interface WaterPresentationBuild {
  readonly chunks: readonly WaterChunkMeshData[];
  readonly wall: WaterWallMeshData;
}

export interface WaterPresentationSource {
  buildAll(
    terrain: TerrainSnapshot,
    water: WaterSnapshot,
  ): WaterPresentationBuild;
}
```

`WaterPresentation.load()` stages a complete replacement root before swapping it into the scene.

v0.1 intentionally does not expose partial `rebuild(chunks)`.

Object names:

```text
water-presentation-root
water-surface-chunk:<x>:<z>
water-shoreline-chunk:<x>:<z>
water-wall
```

Render order:

```text
Terrain           0
Water wall        4
Water surface     5
Shoreline ribbon  6
Terrain grid     10
Cell selection   20–21
```

Water surface material:

```text
transparent       true
opacity           0.78
depthTest         true
depthWrite        false
vertexColors      true
```

Water wall material:

```text
transparent       false
depthTest         true
depthWrite        true
vertexColors      true
```

Water meshes are not included in Terrain raycast targets. Underwater clicks continue to select the Terrain cell beneath Water.

## 15. Game composition

Boot order:

```text
generate Terrain
→ derive WaterSnapshot
→ load Terrain
→ load Water
→ load Grid
→ initialize Selection and Camera/Input
```

Terrain load:

```text
decode TerrainSaveV1
→ validate Terrain
→ derive next WaterSnapshot
→ pause rendering during replacement
→ load Terrain
→ load Water
→ reload Grid
→ rebuild Selection
→ refresh Terrain raycast objects
→ resume rendering
```

Context restoration:

```text
reload Terrain
→ reload Water
→ reload Grid
→ rebuild Selection
→ refresh Terrain raycast objects
```

Disposal order:

```text
input
selection
grid
water
terrain
renderer
```

Water is always visible. No Water UI control is added.

## 16. Save/load

`TerrainSaveV1` remains unchanged.

Water is derived from:

- Terrain height lattice;
- Terrain revision;
- Terrain seed;
- world sea level;
- fixed ocean policy version.

No Water bytes are written to Local Storage.

Loading the same Terrain save must reproduce the same Water mask, counts, and geometry hash.

## 17. Terrain Lab fixtures

Extend `apps/terrain-lab` with:

1. `water-straight-coast`
2. `water-diagonal-sw-ne`
3. `water-diagonal-nw-se`
4. `water-bay`
5. `water-peninsula`
6. `water-chunk-seam`
7. `water-enclosed-basin`
8. `water-open-channel`
9. `water-corner-contact`
10. `water-south-wall`

Fixtures must be deterministic and usable by both unit tests and browser evidence.

## 18. Verification

### water-core

- south-edge connectivity;
- enclosed basin remains unrendered;
- open channel connects a basin;
- corner-only contact remains disconnected;
- both Terrain diagonal policies;
- level-1 shallow shelf;
- level-0 deep area;
- partial clipping;
- deterministic mask and counts;
- invalid Terrain validation.

### Geometry

- no NaN or Infinity;
- indices in range;
- upward winding;
- exact chunk-seam positions;
- no duplicate shoreline segments;
- no zero-area output;
- `Uint16` capacity;
- revision mismatch rejection;
- Water wall reaches the base;
- no wall behind land.

### water-three

- atomic Water-root replacement;
- one root after repeated loads;
- previous geometry disposed after a successful swap;
- staged geometry disposed after a failed load;
- idempotent disposal;
- shared materials disposed once;
- context restoration creates no duplicate roots.

### Browser

- Coastal Game renders Water;
- desktop and mobile framing remain correct;
- camera gestures and reset do not regress;
- Grid remains readable through Water;
- Selection remains readable through Water;
- underwater click selects Terrain;
- save/load restores identical Water evidence;
- context restoration leaves one Water root;
- screenshots cover coast, bay, peninsula, seam, enclosed basin, and wall.

## 19. Mobile and performance policy

Structural gates:

- at most 64 Water chunks;
- no per-frame Water geometry rebuild;
- no per-frame Water allocation;
- no reflection or refraction pass;
- no screen-space mask;
- one shared material set;
- `Uint16Array` chunk indices;
- derivation only on boot, Terrain replacement, future Terraform commit, or context restoration;
- the animation loop performs only the existing scene render.

Evidence records:

- derivation duration;
- presentation duration;
- sea triangle count;
- enclosed wet triangle count;
- surface triangle count;
- shoreline triangle count;
- wall segment count;
- estimated geometry bytes;
- scene root counts before and after restoration.

Timing is baseline evidence, not a hard CI budget in v0.1.

## 20. Explicit exclusions

- lakes and basin ownership;
- rivers and rainfall;
- flooding and fluid simulation;
- animated waves or foam;
- reflection and refraction;
- Water physics, buoyancy, and boats;
- Terraform UI;
- incremental Water dirty-chunk scheduling;
- Water save schema;
- WebGPU;
- final art.

## 21. Acceptance gates

The milestone is complete only when:

1. quality, provenance, typecheck, unit, geometry, build, and Chromium suites pass on the exact head;
2. the Coastal map renders south-edge-connected sea;
3. enclosed basins remain dry;
4. shoreline follows Terrain topology without visible chunk seams;
5. the Water wall reaches the diorama base without overshoot;
6. Grid and Selection remain readable through Water;
7. save/load and context restoration leave one valid Water root;
8. evidence includes deterministic screenshots, counts, hashes, and timing observations;
9. the owner approves the visual result before merge.

## 22. Deferred Terraform integration

The first Terraform integration may use:

```text
commit Terrain mutation
→ derive complete WaterSnapshot
→ atomically replace complete WaterPresentation
```

Only measured performance evidence may justify later chunk signatures, global-connectivity diffing, and partial replacement.