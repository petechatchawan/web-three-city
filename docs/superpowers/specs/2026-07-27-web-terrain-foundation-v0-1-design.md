# Web Terrain Foundation v0.1 — Design Specification

- **Status:** Proposed for owner review
- **Date:** 2026-07-27
- **Repository:** `petechatchawan/web-three-city`
- **Milestone:** 1 of the browser-native 3D city-builder roadmap
- **Primary target:** Mobile-first browser game with desktop support

## 1. Purpose

This specification defines the first implementation milestone for Web Three City: a deterministic, chunked, browser-native 3D terrain foundation implemented in TypeScript and presented with Three.js.

The long-term product direction is a city-building game with the accessibility and tile-oriented interaction of TheoTown, rendered as a true 3D world. The terrain model is not copied from `lo-th/3d.city`; it uses the shared corner-height lattice and terrain topology previously designed for the Unity city-builder project.

This milestone proves the world model, terrain topology, renderer boundary, chunk seams, camera, and picking before water, terraforming, roads, zoning, buildings, or simulation are added.

## 2. Design Principles

1. **World data is authoritative.** Three.js meshes are disposable derived presentation.
2. **Core logic is platform-independent.** Terrain rules, generation, topology, serialization, and validation must not import Three.js or browser APIs.
3. **Determinism is mandatory.** The same configuration, seed, and generator version must produce byte-identical terrain data.
4. **Mobile is a first-class target.** Rendering, controls, memory usage, and diagnostics must account for constrained devices.
5. **Correctness precedes visual polish.** Topology, seams, normals, and picking are validated before complex materials or post-processing.
6. **Incremental updates are designed in now.** Milestone 1 must establish dirty-region and dirty-chunk contracts needed by later terraforming.
7. **Implementation is original.** No production source code, assets, or Micropolis-derived simulation code from `lo-th/3d.city` are copied.

## 3. Adopted Ideas from `3d.city`

The project may adopt general engineering techniques demonstrated by `3d.city`:

- separate rendering from expensive simulation work;
- use Web Workers when ongoing simulation or generation becomes expensive;
- use typed arrays for dense map data;
- use chunked rendering and partial rebuilds;
- use instancing for repeated visual elements;
- provide explicit quality tiers for mobile and desktop;
- keep WebGL2 as a compatibility baseline and treat WebGPU as an enhancement.

These are architectural techniques, not copied implementations.

## 4. Milestone Scope

### 4.1 Included

- world and coordinate contracts;
- shared corner-height lattice;
- deterministic Coastal Generator v1;
- Unity-compatible height-aware diagonal policy;
- terrain shape and topology resolution;
- chunked terrain meshing;
- canonical seam-safe normals;
- outer diorama skirt;
- Three.js WebGL2 presentation;
- orthographic isometric camera;
- desktop and mobile camera controls;
- cell and nearest-vertex picking;
- terrain snapshot serialization;
- dirty-region and dirty-chunk calculation;
- Coastal, Shape Atlas, Chunk Seam, Boundary Skirt, and Picking fixtures;
- unit, geometry, browser, and golden tests;
- non-blocking performance baselines.

### 4.2 Excluded

- water rendering and shoreline geometry;
- hydrology;
- Raise, Lower, Flatten, brush previews, and Undo;
- roads;
- zones and building growth;
- utilities and connectivity;
- traffic, economy, population, and demand;
- simulation Web Worker;
- WebGPU renderer;
- final art assets, texture splatting, weather, and post-processing.

## 5. Locked World Configuration

```ts
export const WORLD_CONFIG = {
  mapWidth: 128,
  mapHeight: 128,
  chunkSize: 16,

  cellSize: 1.0,
  heightStep: 0.5,

  minHeightLevel: 0,
  maxHeightLevel: 4,
  seaLevel: 1,

  dioramaBaseY: -1.5,
} as const;
```

Derived values:

- cells: `128 × 128`;
- lattice vertices: `129 × 129`;
- chunks: `8 × 8`;
- cells per chunk: `16 × 16`;
- presentation vertices per chunk surface: `17 × 17`;
- surface triangles per chunk: `512`;
- full terrain surface triangles: `32,768`;
- world surface height range: `0.0–2.0`;
- future water plane height: `0.5`.

## 6. Coordinate Contract

World axes:

```text
+X = east
+Z = south
+Y = up
```

Grid ranges:

- cell coordinates: `x = 0..127`, `z = 0..127`;
- lattice coordinates: `x = 0..128`, `z = 0..128`.

Data indexing is row-major:

```ts
cellIndex = z * mapWidth + x;
vertexIndex = z * (mapWidth + 1) + x;
```

World conversion centers the map around the scene origin:

```ts
worldX = (gridX - mapWidth / 2) * cellSize;
worldZ = (gridZ - mapHeight / 2) * cellSize;
worldY = heightLevel * heightStep;
```

Core packages use numeric values and plain immutable records. They must not expose `THREE.Vector2`, `THREE.Vector3`, `Raycaster`, `Object3D`, or DOM event types.

## 7. Authoritative Terrain Model

```ts
export interface TerrainMap {
  readonly width: number;
  readonly height: number;
  readonly heightLevels: Uint8Array;
  readonly seed: number;
  readonly generatorVersion: 'coastal-v1';
  readonly generationAttempt: number;
  readonly revision: number;
}
```

`heightLevels.length` must equal:

```ts
(width + 1) * (height + 1)
```

The renderer never mutates `TerrainMap`. A terrain mutation in a later milestone must produce a validated new revision or a controlled mutable transaction hidden behind terrain-core interfaces.

Presentation flow:

```text
TerrainMap
  → validated TerrainSnapshot
  → topology and canonical normals
  → chunk mesh data
  → THREE.BufferGeometry
```

## 8. Terrain Invariants

The terrain system must enforce these invariants:

1. Every height is an integer in `0..4`.
2. Cardinally adjacent lattice vertices differ by at most one level.
3. Shared lattice vertices have one authoritative value.
4. No internal vertical terrain faces are generated.
5. Every cell resolves to exactly two non-degenerate surface triangles.
6. Triangle winding is consistently counter-clockwise when viewed from above.
7. Topology is deterministic and independent of chunk boundaries.
8. Duplicate presentation vertices at chunk seams have identical positions and canonical normals.
9. Vertical faces are allowed only at the outer diorama boundary.
10. Terrain surface normals and skirt normals remain intentionally separate.

## 9. Diagonal and Topology Policy

The web implementation uses the same normative terrain topology rules accepted for the Unity Terrain Architecture Lab:

- height-aware diagonal selection;
- explicit equal-pair handling;
- deterministic equal-delta tie handling;
- no checkerboard parity fallback;
- no chunk-local decision that can change a cell's diagonal;
- no renderer-specific topology rule.

The detailed diagonal resolver must be expressed as a pure function over four corner heights and covered by fixtures for:

- flat cells;
- cardinal ramps;
- diagonal ridges;
- diagonal valleys;
- basins;
- staircase transitions;
- saddle or twist cases;
- equal-pair cases;
- equal-delta ties;
- identical shapes straddling a chunk seam.

The implementation plan must recover the exact accepted Unity decision table from the Unity project documentation or fixtures before coding the resolver. If the source fixture is unavailable, implementation is blocked rather than replaced with a guessed rule.

## 10. Coastal Generator v1

### 10.1 Identity

```text
generatorVersion = coastal-v1
```

The default map has a broad connected landmass with the coastline on the south side of world coordinates. Camera rotation does not alter world orientation.

### 10.2 Generation Targets

A valid generated map must satisfy:

- vertices at or below sea level produce approximately `18–22%` water-designated area;
- the largest connected landmass contains at least `72%` of map cells;
- at least `30%` of all cells are flat and suitable for later construction;
- at least one contiguous flat buildable region is `24 × 24` cells or larger;
- level-4 terrain occupies no more than `12%` of cells;
- the coastline crosses multiple chunk boundaries;
- no isolated single-cell spike exists;
- no isolated single-cell pit exists;
- every cardinal neighbor delta is at most one.

Target level distribution is approximately:

| Level | Intended role | Target |
|---:|---|---:|
| 0 | lower seabed | 6% |
| 1 | shallow/coastal seabed | 14% |
| 2 | coastal plain and primary city land | 45% |
| 3 | inland terrain | 25% |
| 4 | hilltops | 10% |

The distribution is descriptive. Invariants and coverage targets are authoritative.

### 10.3 Generator Pipeline

```text
seed
  → deterministic 32-bit PRNG
  → broad south-distance coastline field
  → low-frequency lateral displacement
  → broad bay and small peninsula masks
  → inland elevation field
  → buildable plateau anchors
  → quantization to levels 0..4
  → constraint-aware propagation
  → local feature cleanup
  → invariant and coverage validation
  → TerrainMap
```

The generator must not use `Math.random()`.

A deterministic 32-bit PRNG such as `xoshiro128**` or an equivalently specified algorithm is acceptable. The exact algorithm becomes part of `coastal-v1` and cannot change without a generator version increment.

### 10.4 Buildable Plateaus

The generator creates at least:

- one primary plateau near the coast;
- one broad central plateau;
- one secondary plateau to either the east or west.

Plateaus connect through gently sloped corridors suitable for future road placement. The generator must avoid one-cell shoreline noise and excessive micro-islands.

### 10.5 Failure Policy

```ts
export type TerrainGenerationErrorCode =
  | 'invalid-config'
  | 'constraint-unsatisfied'
  | 'insufficient-landmass'
  | 'insufficient-buildable-area'
  | 'invalid-height-range';
```

Generation may perform at most 16 deterministic candidate attempts. Each candidate is derived from the original seed and attempt index. Failure returns a typed error; invalid terrain is never returned silently.

The default application seed is curated and locked by a golden test.

## 11. Chunk Architecture

Chunk coordinates are zero-based:

```ts
export interface ChunkCoordinate {
  readonly x: number;
  readonly z: number;
}
```

A surface chunk owns `16 × 16` cells and emits duplicated boundary vertices for simple independent GPU buffers. Duplicated presentation vertices still derive positions and normals from canonical world lattice data.

```ts
export interface TerrainChunkMeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint16Array;
  readonly bounds: ChunkBounds;
}
```

The mesher must not depend on Three.js. `terrain-three` adapts this data into `THREE.BufferGeometry`.

## 12. Canonical Seam-Safe Normals

Per-chunk calls to `BufferGeometry.computeVertexNormals()` are prohibited for production terrain because independently accumulated seam vertices may diverge.

The locked normal strategy is canonical lattice accumulation:

1. resolve cell topology from authoritative heights;
2. compute each triangle's unnormalized face contribution;
3. accumulate contributions into canonical lattice vertices;
4. normalize once per canonical lattice vertex;
5. copy the same canonical normal into every chunk-local duplicate.

Dirty rebuilds recalculate normals for the affected vertex region plus a one-cell halo. The invalidation resolver includes every chunk whose positions or copied canonical normals may change.

Seam tests compare duplicate position and normal values within an explicitly defined floating-point epsilon.

## 13. Outer Diorama Skirt

The outer skirt is a separate presentation surface and is not terrain topology.

Requirements:

- generated only on north, east, south, and west world boundaries;
- extends from each outer terrain edge to `Y = -1.5`;
- never generated between chunks;
- uses hard normals;
- does not share normal accumulation with the terrain surface;
- has deterministic edge ownership to prevent duplicate faces at chunk corners;
- can be destroyed and rebuilt idempotently;
- exposes a stable boundary contract for the later water-wall milestone.

## 14. Terrain Material v0.1

Milestone 1 uses a deliberately simple presentation:

- `THREE.MeshStandardMaterial`;
- vertex colors;
- one directional light;
- ambient or hemisphere fill light;
- optional diagnostic wireframe overlay.

Color intent:

- levels 0–1: seabed diagnostic tones;
- level 2: coastal grass;
- level 3: inland grass;
- level 4: hill tone;
- modest slope-based value adjustment is allowed if it does not hide topology.

Excluded from v0.1:

- texture splatting;
- texture atlases;
- triplanar mapping;
- normal maps;
- weather and seasons;
- post-processing;
- final art direction.

## 15. Renderer Boundary

WebGL2 is the required baseline through `THREE.WebGLRenderer`.

```ts
export interface TerrainPresentation {
  mount(): void;
  load(snapshot: TerrainSnapshot): void;
  rebuild(chunks: readonly ChunkCoordinate[]): void;
  dispose(): void;
}
```

The concrete Three.js adapter owns scene objects and GPU resource disposal. It must remove replaced geometries and materials without leaking WebGL resources.

WebGPU support is deferred until WebGL2 visual correctness and performance baselines are accepted.

## 16. Camera and Input Contract

Projection and initial orientation:

- orthographic camera;
- initial yaw: `45°`;
- initial pitch: `55°`;
- rotation occurs in `90°` increments;
- camera target begins at world origin.

Required camera operations:

- pan;
- zoom;
- rotate left and right;
- reset;
- focus a world coordinate;
- respond to viewport resize;
- clamp to map bounds;
- apply restrained edge resistance and inertia.

Desktop defaults:

- left click: select or inspect;
- middle or right drag: pan;
- mouse wheel: zoom;
- `Q` and `E`: rotate;
- `Home`: reset.

Mobile defaults for the terrain viewer:

- one-finger drag: pan;
- pinch: zoom;
- two-finger twist or explicit UI buttons: rotate;
- tap: select a cell.

Future Terraform input changes one-finger behavior to tool interaction while reserving two fingers for camera gestures. Gesture arbitration therefore belongs in `camera-input`, not in a terrain tool.

## 17. Picking Contract

Picking uses ray intersection against current terrain chunk meshes, followed by renderer-independent world-to-grid conversion.

```ts
export interface TerrainPickResult {
  readonly cellX: number;
  readonly cellZ: number;
  readonly localU: number;
  readonly localV: number;
  readonly nearestVertexX: number;
  readonly nearestVertexZ: number;
  readonly worldPoint: Readonly<{
    x: number;
    y: number;
    z: number;
  }>;
}
```

The cell is not inferred from mesh names or chunk object identity. The nearest lattice corner is derived from `localU` and `localV`.

Picking must remain correct after:

- every camera rotation;
- zoom and pan;
- viewport resize;
- chunk rebuild;
- either legal diagonal orientation.

## 18. Dirty Region Foundation

Milestone 1 establishes invalidation contracts even though interactive terraforming is deferred.

```ts
export interface TerrainDirtyRegion {
  readonly minVertexX: number;
  readonly minVertexZ: number;
  readonly maxVertexX: number;
  readonly maxVertexZ: number;
}
```

Invalidation steps:

1. clamp and validate the changed lattice region;
2. determine affected cells;
3. determine chunks owning those cells;
4. expand for canonical normal halo dependencies;
5. return a unique deterministic chunk list;
6. rebuild only affected chunk mesh data and bounds.

A single local mutation must not trigger a full-map rebuild by default.

## 19. Serialization Contract

```ts
export interface TerrainSaveV1 {
  readonly schemaVersion: 1;
  readonly generatorVersion: 'coastal-v1';
  readonly width: 128;
  readonly height: 128;
  readonly seed: number;
  readonly generationAttempt: number;
  readonly revision: number;
  readonly heightLevels: string;
}
```

`heightLevels` uses a documented compact Base64 representation in v1.

The save stores both provenance and the full lattice. Loading restores the authoritative lattice and does not regenerate the terrain from the seed. This protects saves from future generator changes.

## 20. Repository Structure

The project uses a pnpm workspace:

```text
web-three-city/
├─ apps/
│  ├─ game/
│  └─ terrain-lab/
├─ packages/
│  ├─ world-core/
│  ├─ terrain-core/
│  ├─ terrain-generator/
│  ├─ terrain-three/
│  ├─ camera-input/
│  └─ shared-testkit/
├─ docs/
│  ├─ architecture/
│  ├─ adr/
│  └─ superpowers/
│     ├─ specs/
│     └─ plans/
└─ tooling/
```

Responsibilities:

### `world-core`

- coordinates and indexing;
- world configuration;
- immutable metadata;
- serialization primitives.

### `terrain-core`

- height lattice;
- invariants;
- cell topology and diagonal policy;
- canonical normals;
- dirty-region and dirty-chunk calculation.

### `terrain-generator`

- seeded PRNG;
- Coastal Generator v1;
- generation constraints and statistics;
- generation validation.

### `terrain-three`

- `TerrainChunkMeshData` to `BufferGeometry` adaptation;
- chunk scene lifecycle;
- terrain materials;
- outer skirt presentation;
- GPU resource disposal.

### `camera-input`

- orthographic camera rig;
- pointer and gesture normalization;
- camera bounds and inertia;
- terrain picking adapter.

### `shared-testkit`

- deterministic fixtures;
- lattice and mesh assertions;
- hashes and golden-test helpers.

### `apps/terrain-lab`

- Coastal fixture;
- Shape Atlas fixture;
- Chunk Seam fixture;
- Boundary Skirt fixture;
- Picking fixture;
- wireframe and topology diagnostics;
- performance measurements.

### `apps/game`

Initially a minimal shell that mounts the accepted Coastal terrain. It does not contain gameplay systems in Milestone 1.

## 21. Fixtures and Diagnostics

Required fixtures:

1. **CoastalFixture** — curated default map and generator statistics.
2. **ShapeAtlasFixture** — every normative terrain topology case.
3. **ChunkSeamFixture** — features intentionally crossing chunk boundaries.
4. **BoundarySkirtFixture** — all four edges and corner ownership.
5. **PickingFixture** — known cells and vertices under all four rotations.

Diagnostics must expose:

- chunk boundaries;
- cell grid;
- triangle diagonals;
- surface normals;
- lattice height labels;
- selected cell and selected vertex;
- generator statistics;
- frame timing and mesh rebuild timing.

Diagnostics are development-only and must be removable from production bundles through normal build-time dead-code elimination or app separation.

## 22. Testing Strategy

### 22.1 Unit Tests

- coordinate and index conversion;
- world centering conversion;
- lattice bounds;
- height range validation;
- cardinal neighbor delta validation;
- diagonal resolver decision table;
- deterministic PRNG output;
- deterministic generation;
- landmass and buildable-area statistics;
- serialization round trip;
- dirty-region to chunk resolution.

### 22.2 Geometry Tests

- expected vertex and triangle counts;
- valid index ranges;
- consistent winding;
- no degenerate triangles;
- no internal vertical faces;
- seam positions match;
- seam normals match within epsilon;
- skirt appears only at world boundaries;
- no duplicate skirt faces;
- repeated skirt rebuild is idempotent.

### 22.3 Golden Tests

For each curated seed, store:

- generator version;
- seed and selected attempt;
- lattice hash;
- terrain statistics;
- topology or chunk mesh hashes where stable.

A change to an accepted golden result requires an explicit specification or generator-version decision. Snapshot updates alone are not sufficient justification.

### 22.4 Browser Tests

Playwright verifies:

- application boot;
- Coastal terrain visibility;
- no uncaught browser errors;
- camera pan, zoom, rotate, and reset;
- cell picking after all four rotations;
- viewport resize;
- chunk rebuild presentation;
- WebGL context recovery where automation permits;
- deterministic screenshots for fixtures within documented tolerances.

## 23. Error Handling

Core operations return typed results or throw package-specific invariant errors only at programmer-contract boundaries.

Errors must include stable codes and relevant coordinates or configuration values. User-facing applications translate them into concise messages without exposing stack traces.

The renderer must handle:

- WebGL initialization failure;
- missing WebGL2 support;
- context loss and restoration;
- failed chunk geometry upload;
- disposed presentation usage;
- invalid snapshot rejection before scene mutation.

A partial failed load must not leave a mixture of old and new terrain chunks in the visible scene.

## 24. Performance Baseline Policy

Milestone 1 records performance but does not enforce hard CI budgets until measurements are stable across representative environments.

Initial targets:

| Operation | Initial target |
|---|---:|
| Coastal generation | `< 100 ms` on reference desktop |
| Full terrain meshing | `< 150 ms` on reference desktop |
| Initial GPU upload | `< 100 ms` on reference desktop |
| Single dirty-chunk rebuild | `< 8 ms` average on reference desktop |
| Desktop rendering | `60 FPS` target |
| Supported mobile rendering | `30 FPS` minimum target |

Measurements record device, browser, renderer, warm-up policy, sample count, median, and percentile values. CI reports results without blocking merges until a later budget-lock decision.

Generation remains on the main thread in Milestone 1 unless measurements show an unacceptable startup stall. The architecture must keep generation independent enough to move into a Worker later without changing terrain semantics.

## 25. Quality Tiers

Milestone 1 exposes a small policy surface:

### Low

- WebGL2;
- device pixel ratio capped at `1`;
- no real-time shadows;
- simplified diagnostics disabled by default.

### Medium

- device pixel ratio capped at `1.5`;
- limited directional shadow if stable;
- standard terrain material.

### High

- device pixel ratio capped at `2`;
- improved shadow quality;
- still uses the same terrain geometry and semantics.

Quality tiers must not change topology, picking, save data, or simulation-relevant world state.

## 26. Security and Robustness

- loaded terrain saves are schema-validated before allocation and decoding;
- dimensions and encoded lengths are checked before constructing typed arrays;
- no dynamic code execution is used;
- debug query parameters are parsed through an allowlist;
- corrupted terrain data returns a typed load error;
- package boundaries prevent browser/UI code from entering terrain-core.

## 27. Milestone Acceptance Criteria

Web Terrain Foundation v0.1 is complete only when all conditions are met:

1. A `128 × 128` Coastal map is generated deterministically from the curated seed.
2. The generated map passes all height, slope, landmass, and buildability constraints.
3. No internal vertical cliff face exists.
4. The recovered Unity topology fixtures and web fixtures produce matching diagonal decisions.
5. All 64 chunks render without positional seams.
6. Canonical normals are continuous across every chunk seam.
7. The outer skirt exists only at the world boundary and rebuilds idempotently.
8. Camera controls work on desktop and touch-capable browsers.
9. Picking identifies the correct cell and nearest vertex after all four camera rotations.
10. Dirty-region resolution rebuilds only affected chunks and required normal-halo neighbors.
11. Terrain serialization round-trips to byte-identical lattice data.
12. Unit, geometry, golden, and browser tests pass.
13. Coastal and Shape Atlas fixture screenshots receive human visual approval.
14. Performance baselines are recorded with reproducible methodology.
15. Production source and assets contain no copied code or content from `lo-th/3d.city` or Micropolis-derived projects.

## 28. Roadmap After Milestone 1

1. **Water & Shoreline Foundation v0.1**
2. **TheoTown-style Terraform v0.1**
3. **Road Network Foundation v0.1**
4. **Zones & Building Growth v0.1**
5. **Utilities & Connectivity v0.1**
6. **City Simulation Worker v0.1**
7. **Economy, Population & Demand v0.1**
8. **Content Pipeline & Game UI**
9. **WebGPU and Advanced Presentation**

## 29. Implementation Authorization Gate

Approval of this design authorizes creation of a detailed TDD implementation plan only. Production implementation begins after the implementation plan is written, reviewed, and explicitly authorized.
