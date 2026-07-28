# Web Water & Shoreline Foundation v0.1 — Design Specification

- Status: **Proposed for owner review**
- Delivery profile: **single developer / low maintenance**
- Base commit: `8e4b002e547b456cf678aa325f78662121316e6e`
- Depends on:
  - Web Terrain Foundation v0.1
  - Prototype Interaction Completion v0.1

## 1. Purpose

Deliver the first deterministic ocean and shoreline system for Web Three City.

The milestone must make the existing Coastal terrain read as a coastal world while preserving the current pure TypeScript domain boundary, chunked Three.js presentation, mobile-first budget, save/load behavior, camera controls, Terrain grid, and cell selection.

This is not a general hydrology milestone.

## 2. Single-developer scope

The implementation is intentionally smaller than the maximum future architecture.

Locked simplifications:

1. Add only:
   - `packages/water-core`
   - `packages/water-three`
2. Extend `apps/terrain-lab`; do not create a Water Lab application.
3. Derive Water from the complete Terrain snapshot.
4. Rebuild the complete Water presentation when Terrain is replaced.
5. Keep chunk-local geometry, but defer dirty-chunk scheduling and chunk signatures.
6. Keep Water derived; do not change `TerrainSaveV1`.
7. Support only one ocean policy: south-edge-connected sea.
8. Defer lakes, rivers, flooding, reflections, refraction, waves, and physics.

A later Terraform milestone may initially trigger a complete Water rebuild. Incremental invalidation is allowed only after profiling proves it is needed.

## 3. Architecture

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
- `water-core` must not import Three.js, DOM, browser, or application APIs.
- `water-three` owns Three.js materials, adapters, lifecycle, and disposal.
- Terrain remains authoritative for heights and topology.
- Terrain does not import or reference Water.
- Water records the Terrain revision and seed from which it was derived.
- The Game application composes Terrain, Water, Grid, Selection, and Camera.

## 4. Canonical constants

The existing world contract remains authoritative:

```text
map                     128 × 128 cells
chunk                    16 × 16 cells
cell size                 1.0 world unit
height step               0.5 world unit
sea level                 1 height level
logical water Y           0.5 world unit
diorama base Y           -1.5 world units
```

Presentation-only offsets:

```text
Water surface            +0.010
Shoreline ribbon         +0.013
Terrain grid             +0.015  existing
Cell selection           +0.020  existing
```

The rendered Water surface is therefore at world Y `0.51`.

Offsets must not affect connectivity, depth, save data, hashes, or fixtures.

## 5. Ocean ownership

Water v0.1 supports one body type: **edge-connected sea**.

```ts
export const OCEAN_POLICY_V1 = Object.freeze({
  version: 'south-edge-sea-v1' as const,
  sourceBoundary: 'south' as const,
});
```

A wet Terrain fragment belongs to the sea only when it connects to a wet fragment with positive-length contact on the south map boundary.

Connectivity rules:

- Shared wet edge interval with positive length: connected.
- Point-only contact: not connected.
- Diagonal corner contact: not connected.
- North, east, and west boundaries are not ocean sources.
- Enclosed depressions remain unrendered.
- A real open channel from the south sea connects an inland depression.

This matches the existing Coastal generator, whose ocean-facing region is on the south side.

## 6. Terrain topology authority

Water uses the exact Terrain topology contract:

- `selectTerrainDiagonal()` chooses the cell diagonal.
- `CELL_TRIANGLES` defines both canonical triangles.
- Water may not choose a separate diagonal.
- Water may not classify from cell-center height.
- Water may not use a screen-space or texture-derived coastline.

Canonical Water triangle index:

```text
triangleIndex = ((cellZ × mapWidth) + cellX) × 2 + localTriangleIndex
```

`localTriangleIndex` follows the order in `CELL_TRIANGLES[diagonal]`.

## 7. Wet-fragment clipping

For each canonical Terrain triangle:

1. Read its three corner height levels.
2. Clip against `heightLevel <= seaLevel`.
3. Discard zero-area fragments.
4. Preserve deterministic winding.
5. Record wet intervals on all triangle edges, including the internal cell diagonal.

Possible results:

```text
no positive area   dry
3 vertices         triangle fragment
4 vertices         quad fragment, triangulated deterministically
```

Edge intersection:

```ts
t = (seaLevel - levelA) / (levelB - levelA);
```

The calculation uses logical height levels. Rendered surface vertices use constant Y `logicalWaterY + 0.010`.

Coplanar level-1 triangles have positive area and remain valid shallow Water fragments.

## 8. Sea connectivity

`water-core` builds a graph of positive-area wet fragments.

Two fragments are adjacent only when their wet intervals overlap with positive length on the same canonical Terrain edge.

Derivation:

```text
wet fragments
→ seed positive-length south-boundary contacts
→ deterministic flood fill
→ reachable fragments become sea
→ unreachable fragments remain enclosed and unrendered
```

Determinism:

- iterate cells z-major then x-major;
- iterate local triangles in canonical order;
- visit graph neighbors by ascending triangle index;
- identical Terrain produces byte-identical masks and stable counts.

## 9. Water domain contract

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
0 = not connected sea
1 = connected sea
```

The snapshot does not duplicate Terrain heights, clipped vertices, Three.js geometry, materials, or save data.

```ts
export function deriveWaterSnapshot(
  terrain: TerrainSnapshot,
  config: WorldConfig,
): Result<WaterSnapshot, WaterDerivationError>;
```

Derivation error codes:

```text
water:invalid-terrain-dimensions
water:invalid-height-lattice
water:invalid-terrain-revision
water:invalid-sea-level
```

## 10. Depth and shoreline semantics

Shoreline and depth are separate concepts.

**Shoreline** is the geometric boundary where connected sea meets dry or non-sea Terrain.

**Depth** controls Water color:

```text
depthLevels = seaLevel - interpolatedTerrainHeightLevel

shallow      0.0 <= depthLevels <= 0.5
transition   0.5 <  depthLevels <  1.0
deep         depthLevels >= 1.0
```

Consequences:

- Terrain level `1` is a shallow shelf even though its logical depth is `0`.
- Terrain level `0` is deep Water.
- A shoreline ribbon may cross a shallow fragment.
- Shoreline is not inferred from color or depth alone.

Vertex colors interpolate from light cyan-blue to darker blue. No depth texture, distance field, animation, or extra render pass is required.

## 11. Canonical shoreline

A shoreline segment is a positive-length boundary of connected sea whose adjacent side is dry or non-sea.

The south map boundary is excluded because it is the ocean exit.

Requirements:

- deterministic;
- unique;
- no zero-length segments;
- exact across chunk seams;
- derived from clipped Terrain geometry;
- independent of camera and renderer state.

Presentation uses a triangle ribbon rather than WebGL line width.

```text
ribbon width = 0.35 × cellSize
```

The ribbon is assigned to the chunk of its owning Terrain cell and rendered at Water Y `+0.013`.

## 12. Chunk-local geometry

Water uses the existing 16 × 16 Terrain chunk partition.

A fragment belongs to the chunk of its owning Terrain cell.

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

```ts
export function buildWaterChunkMesh(
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  chunk: ChunkCoord,
  config: WorldConfig,
): WaterChunkMeshData;
```

The builder must reject Terrain/Water revision or dimension mismatch.

Geometry rules:

- upward normals `[0, 1, 0]`;
- deterministic indices;
- exact shared seam positions;
- no NaN, Infinity, or zero-area triangles;
- indices fit `Uint16Array`.

Mesh error codes:

```text
water:terrain-revision-mismatch
water:snapshot-dimension-mismatch
water:mesh-capacity-exceeded
```

## 13. Diorama Water wall

Connected sea intervals on the south map boundary create a vertical Water wall.

```text
top Y       logicalWaterY + 0.010
bottom Y    dioramaBaseY
boundary Z  south world boundary + 0.010 outward
```

Rules:

- build only for connected sea intervals;
- no wall behind south-boundary land;
- merge adjacent collinear intervals when safe;
- no walls on north, east, or west boundaries;
- no Water-wall overshoot above the surface;
- fully cover the Terrain skirt where the sea exits the diorama;
- use an opaque material so earth does not show through.

The Terrain outer skirt remains unchanged.

## 14. Three.js presentation

`water-three` owns:

- BufferGeometry adapters;
- one shared Water material set;
- one `WaterPresentation` lifecycle owner;
- atomic replacement of its own presentation root;
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

`WaterPresentation.load()` stages the new Water root before replacing the previous Water root.

v0.1 does not expose partial `rebuild(chunks)`.

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

Surface material:

```text
transparent       true
opacity           0.78
depthTest         true
depthWrite        false
vertexColors      true
```

Wall material:

```text
transparent       false
depthTest         true
depthWrite        true
vertexColors      true
```

Water meshes never join Terrain raycast targets. Underwater clicks continue to select Terrain.

Presentation error codes:

```text
water-presentation:not-loaded
water-presentation:disposed
water-presentation:invalid-build
```

## 15. Game composition

Boot:

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
