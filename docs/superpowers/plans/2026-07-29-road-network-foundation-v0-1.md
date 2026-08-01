# Road Network Foundation v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an authoritative, persistent, renderable Road system with Build/Bulldoze interaction, automatic cardinal connectivity, Flat and aligned one-level Ramp placement, Road-owned dirty chunks, world save migration, one-level world Undo, and full Terraform-over-Road rejection.

**Architecture:** Add pure `road-core` and presentation-only `road-three` packages. Terrain exposes one read-only cell-surface query; Water dryness is adapted by Game composition. The Game owns cross-system tool selection, Road/Terraform arbitration, atomic world replacement, the tagged Undo slot, and the `WorldSaveV1` envelope.

**Tech Stack:** TypeScript 6, pnpm 10.13.1 workspaces, Vitest 4, Three.js 0.185.1, Vite 8, Playwright 1.61.1, GitHub Actions, SonarQube Cloud, Vercel Build Output API v3.

## Global Constraints

- Baseline: `master@2707d40b3a0dfd563c8b183a8422fa1c013e5bf1`.
- Node.js must remain `>=22.0.0`; package manager remains `pnpm@10.13.1`.
- `terrain-core` and `water-core` must not import Road packages or Road vocabulary.
- `road-core` must remain pure TypeScript with no Three.js, DOM, browser-input, or Game imports.
- `road-three` owns presentation only and must not own or mutate authoritative Road state.
- Supported Terrain is limited to Flat and exact one-level `ramp-north`, `ramp-south`, `ramp-east`, or `ramp-west`.
- A Ramp Road must have exactly the two connections aligned with its slope axis; isolated pieces, end caps, corners, T-junctions, four-way intersections, and perpendicular straights are invalid on Ramps.
- Any positive-area Water fragment makes a cell invalid for Road placement; zero-area shoreline contact is allowed.
- Build and Bulldoze are deterministic, all-or-nothing transactions committed once on pointer-up.
- Road mutations must not rebuild Water.
- A Terraform plan touching at least one occupied Road cell must be rejected as one complete transaction, with no Terrain mutation, Water rebuild, or Undo entry.
- Save writes `WorldSaveV1`; load accepts both `WorldSaveV1` and legacy top-level `TerrainSaveV1`.
- One visible one-level Undo slot follows the latest successful Terraform or Road mutation; Redo and multi-level history are excluded.
- No traffic, pathfinding, vehicles, zoning, economy, bridges, tunnels, one-way Roads, lanes, diagonal/curved Roads, auto-grading, multiple Road types, WebGPU, or final art.
- Every task follows RED → GREEN → focused verification → commit. Do not batch unrelated refactors.

---

## File Structure

### New `road-core` package

- `packages/road-core/package.json` — workspace package metadata and scripts.
- `packages/road-core/tsconfig.json` — strict test/source compilation.
- `packages/road-core/tsconfig.build.json` — declaration/build configuration.
- `packages/road-core/vitest.config.ts` — package-local Vitest configuration.
- `packages/road-core/src/contracts.ts` — Road definitions, masks, inputs, plans, receipts, errors, and placement-environment interfaces.
- `packages/road-core/src/road-snapshot.ts` — immutable Road snapshot construction and occupancy queries.
- `packages/road-core/src/connectivity.ts` — deterministic cardinal-neighbor and connection-mask derivation.
- `packages/road-core/src/road-mutation.ts` — Build/Bulldoze planning, validation, dirty chunks, stale fencing, and commit.
- `packages/road-core/src/serialization.ts` — `RoadSaveV1` codec.
- `packages/road-core/src/index.ts` — public API only.
- `packages/road-core/test/*.test.ts` — state, connectivity, mutation, dirty-chunk, and serialization contracts.

### New `road-three` package

- `packages/road-three/package.json`, `tsconfig*.json`, `vitest.config.ts` — package setup mirroring `terrain-three`/`water-three`.
- `packages/road-three/src/road-mesh-data.ts` — renderer-neutral Road geometry data types and metrics.
- `packages/road-three/src/road-geometry.ts` — deterministic geometry for Flat and Ramp topology variants.
- `packages/road-three/src/geometry-adapter.ts` — typed-array to Three.js conversion and validation.
- `packages/road-three/src/material-factory.ts` — committed/valid-preview/invalid-preview materials.
- `packages/road-three/src/road-chunk-presentation.ts` — atomic per-chunk committed presentation.
- `packages/road-three/src/road-preview-presentation.ts` — separate transient preview root.
- `packages/road-three/src/index.ts` — public API only.
- `packages/road-three/test/*.test.ts` — deterministic geometry and lifecycle tests.

### Existing package/application changes

- `packages/terrain-core/src/terrain-cell-surface.ts` — read-only Terrain cell profile query.
- `packages/terrain-core/src/index.ts` and tests — export and verify that query.
- `apps/game/src/game-tool-mode.ts` — application union for Terrain and Road tools.
- `apps/game/src/road-stroke-controller.ts` — Road pointer-stroke state machine independent of camera binding.
- `apps/game/src/world-undo.ts` — tagged one-level world Undo slot.
- `apps/game/src/world-save.ts` — `WorldSaveV1` envelope and atomic decode staging.
- `apps/game/src/game-input.ts` — route the primary-pointer delegate to Terraform or Roads.
- `apps/game/src/game-ui.ts`, `apps/game/src/style.css` — Build/Bulldoze controls and shared Undo state.
- `apps/game/src/game-bootstrap.ts` — compose Road state/presentation, mutation, Terraform guard, Undo, Save/Load, diagnostics, restoration, and disposal.
- `apps/game/src/interaction-evidence.ts` — Road evidence contract.
- `apps/game/package.json`, `pnpm-lock.yaml` — Road package dependencies.
- `apps/terrain-lab/src/fixture-registry.ts`, `apps/terrain-lab/src/bootstrap.ts`, `apps/terrain-lab/package.json` — Road fixtures and presentation evidence.
- `browser-tests/road.spec.ts`, `browser-tests/road-visual-evidence.spec.ts` — Road functional and visual acceptance.
- `browser-tests/terraform.spec.ts`, `browser-tests/game.spec.ts`, `browser-tests/helpers/interaction.ts` — cross-system guard, save/load, and interaction helpers.
- `docs/evidence/road-network-foundation-v0-1.md` — exact-head evidence record created only in the final task.

---

### Task 1: Read-only Terrain Cell Surface Contract

**Files:**
- Create: `packages/terrain-core/src/terrain-cell-surface.ts`
- Modify: `packages/terrain-core/src/index.ts`
- Test: `packages/terrain-core/test/terrain-cell-surface.test.ts`

**Interfaces:**
- Consumes: `TerrainSnapshot`, `TerrainCorners`, `TerrainShape`, `classifyTerrainShape()`, `CellCoord`, `WorldConfig`, and `vertexIndex()`.
- Produces:

```ts
export type TerrainSlopeAxis = 'north-south' | 'east-west' | null;

export interface TerrainCellSurfaceProfile {
  readonly cell: CellCoord;
  readonly corners: TerrainCorners;
  readonly shape: TerrainShape;
  readonly minimumLevel: number;
  readonly maximumLevel: number;
  readonly slopeAxis: TerrainSlopeAxis;
}

export function terrainCellSurfaceProfile(
  terrain: TerrainSnapshot,
  cell: CellCoord,
  config: WorldConfig,
): TerrainCellSurfaceProfile;
```

- [ ] **Step 1: Write the failing surface-profile tests**

Create tests that construct small valid snapshots with the repository `WORLD_CONFIG`, then assert:

```ts
expect(terrainCellSurfaceProfile(flat, { x: 4, z: 7 }, WORLD_CONFIG)).toMatchObject({
  shape: 'flat',
  minimumLevel: 2,
  maximumLevel: 2,
  slopeAxis: null,
});

expect(terrainCellSurfaceProfile(rampNorth, { x: 4, z: 7 }, WORLD_CONFIG)).toMatchObject({
  shape: 'ramp-north',
  minimumLevel: 1,
  maximumLevel: 2,
  slopeAxis: 'north-south',
});

expect(() => terrainCellSurfaceProfile(flat, { x: -1, z: 0 }, WORLD_CONFIG)).toThrow(
  'terrain-cell-surface:invalid-cell',
);
```

Also verify returned `cell` and `corners` are copied and cannot mutate the snapshot.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter @web-three-city/terrain-core test -- terrain-cell-surface.test.ts
```

Expected: FAIL because `terrainCellSurfaceProfile` and its exported types do not exist.

- [ ] **Step 3: Implement the minimal query**

Read the four lattice levels at NW/NE/SW/SE, call `classifyTerrainShape()`, calculate min/max, and map only the four Ramp shapes to their axis. Throw `RangeError('terrain-cell-surface:invalid-cell')` for non-integer or out-of-bounds cells. Return a frozen profile with frozen nested objects.

- [ ] **Step 4: Export the API and verify GREEN**

Add named exports from `packages/terrain-core/src/index.ts`, then run:

```bash
pnpm --filter @web-three-city/terrain-core test -- terrain-cell-surface.test.ts
pnpm --filter @web-three-city/terrain-core typecheck
```

Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/terrain-core/src/terrain-cell-surface.ts packages/terrain-core/src/index.ts packages/terrain-core/test/terrain-cell-surface.test.ts
git commit -m "feat: expose read-only terrain cell surfaces"
```

---

### Task 2: `road-core` Package and Immutable Road State

**Files:**
- Create: `packages/road-core/package.json`
- Create: `packages/road-core/tsconfig.json`
- Create: `packages/road-core/tsconfig.build.json`
- Create: `packages/road-core/vitest.config.ts`
- Create: `packages/road-core/src/contracts.ts`
- Create: `packages/road-core/src/road-snapshot.ts`
- Create: `packages/road-core/src/index.ts`
- Test: `packages/road-core/test/road-snapshot.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `CellCoord`, `ChunkCoord`, `WorldConfig`, `TerrainCellSurfaceProfile`.
- Produces:

```ts
export const EMPTY_ROAD_CODE = 0 as const;
export const BASIC_ROAD_CODE = 1 as const;
export type RoadDefinitionId = 'basic-road';
export type RoadDefinitionCode = 0 | 1;
export type RoadOperation = 'build' | 'bulldoze';
export type RoadConnectionMask = number;

export interface RoadDefinition {
  readonly id: 'basic-road';
  readonly code: 1;
  readonly width: number;
  readonly surfaceOffset: number;
}

export interface RoadSnapshot {
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  readonly definitionCodes: Uint8Array;
}

export function createEmptyRoadSnapshot(config: WorldConfig): RoadSnapshot;
export function createRoadSnapshot(input: {
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  readonly definitionCodes: Uint8Array;
}, config: WorldConfig): RoadSnapshot;
export function roadDefinitionCodeAt(snapshot: RoadSnapshot, cell: CellCoord): RoadDefinitionCode;
export function roadOccupiedAt(snapshot: RoadSnapshot, cell: CellCoord): boolean;
export function occupiedRoadCellCount(snapshot: RoadSnapshot): number;
```

- [ ] **Step 1: Scaffold the package and write failing immutability tests**

Mirror script/config structure from `terrain-core`. Add tests asserting:

```ts
const source = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
source[5] = BASIC_ROAD_CODE;
const snapshot = createRoadSnapshot({
  width: WORLD_CONFIG.mapWidth,
  height: WORLD_CONFIG.mapHeight,
  revision: 3,
  definitionCodes: source,
}, WORLD_CONFIG);
source[5] = EMPTY_ROAD_CODE;
expect(roadDefinitionCodeAt(snapshot, { x: 5, z: 0 })).toBe(BASIC_ROAD_CODE);

const exposed = snapshot.definitionCodes;
exposed[5] = EMPTY_ROAD_CODE;
expect(roadDefinitionCodeAt(snapshot, { x: 5, z: 0 })).toBe(BASIC_ROAD_CODE);
```

Implement `RoadSnapshot` so the public `definitionCodes` getter returns a copy; do not expose the internal buffer.

- [ ] **Step 2: Run the package test and verify RED**

```bash
pnpm install --lockfile-only
pnpm --filter @web-three-city/road-core test -- road-snapshot.test.ts
```

Expected: initial package resolution or missing-symbol failure.

- [ ] **Step 3: Implement contracts and state validation**

Validate exact map dimensions, exact byte length, non-negative integer revision, and codes restricted to `0` or `1`. Use `RangeError` codes:

```text
road-snapshot:invalid-dimensions
road-snapshot:invalid-revision
road-snapshot:invalid-byte-length
road-snapshot:unknown-definition-code
road-snapshot:invalid-cell
```

Store a private copied buffer inside the frozen snapshot implementation and return defensive copies from the public property.

- [ ] **Step 4: Verify GREEN and package boundaries**

```bash
pnpm --filter @web-three-city/road-core test -- road-snapshot.test.ts
pnpm --filter @web-three-city/road-core typecheck
pnpm --filter @web-three-city/road-core build
```

Expected: all PASS and emitted declarations contain no Three.js or DOM references.

- [ ] **Step 5: Commit**

```bash
git add packages/road-core pnpm-lock.yaml
git commit -m "feat: add immutable road state"
```

---

### Task 3: Deterministic Connectivity, Placement Policy, Mutation Planning, and Dirty Chunks

**Files:**
- Modify: `packages/road-core/src/contracts.ts`
- Create: `packages/road-core/src/connectivity.ts`
- Create: `packages/road-core/src/road-mutation.ts`
- Modify: `packages/road-core/src/index.ts`
- Test: `packages/road-core/test/connectivity.test.ts`
- Test: `packages/road-core/test/road-mutation.test.ts`

**Interfaces:**
- Consumes: Task 1 surface profile and Task 2 Road state.
- Produces:

```ts
export const ROAD_NORTH = 1 << 0;
export const ROAD_EAST = 1 << 1;
export const ROAD_SOUTH = 1 << 2;
export const ROAD_WEST = 1 << 3;

export interface RoadPlacementEnvironment {
  readonly terrainRevision: number;
  readonly waterSourceTerrainRevision: number;
  surfaceAt(cell: CellCoord): TerrainCellSurfaceProfile;
  isDry(cell: CellCoord): boolean;
}

export type RoadInvalidReason =
  | 'road:invalid-state'
  | 'road:invalid-cell'
  | 'road:incoherent-world-revision'
  | 'road:no-change'
  | 'road:unsupported-terrain'
  | 'road:wet-cell'
  | 'road:invalid-ramp-topology';

export interface RoadStrokeInput {
  readonly operation: RoadOperation;
  readonly definitionId: 'basic-road';
  readonly cells: readonly CellCoord[];
}

export interface RoadMutationPlan {
  readonly operation: RoadOperation;
  readonly baseRoadRevision: number;
  readonly baseTerrainRevision: number;
  readonly baseWaterSourceTerrainRevision: number;
  readonly requestedCells: readonly CellCoord[];
  readonly addedCells: readonly CellCoord[];
  readonly removedCells: readonly CellCoord[];
  readonly topologyChangedCells: readonly CellCoord[];
  readonly proposedDefinitionCodes: Uint8Array;
  readonly dirtyChunks: readonly ChunkCoord[];
  readonly valid: boolean;
  readonly invalidReason: RoadInvalidReason | null;
}

export interface RoadMutationReceipt {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly addedCellCount: number;
  readonly removedCellCount: number;
  readonly topologyChangedCellCount: number;
  readonly dirtyChunks: readonly ChunkCoord[];
}

export function roadConnectionMaskAt(
  snapshot: RoadSnapshot,
  cell: CellCoord,
  environment: RoadPlacementEnvironment,
  config: WorldConfig,
): RoadConnectionMask;

export function planRoadMutation(
  roads: RoadSnapshot,
  input: RoadStrokeInput,
  environment: RoadPlacementEnvironment,
  config: WorldConfig,
): RoadMutationPlan;

export function commitRoadMutation(
  roads: RoadSnapshot,
  plan: RoadMutationPlan,
  environment: RoadPlacementEnvironment,
  config: WorldConfig,
): { readonly snapshot: RoadSnapshot; readonly receipt: RoadMutationReceipt };
```

- [ ] **Step 1: Write failing connectivity tests**

Use a deterministic fake environment and assert exact masks for isolated, end, straight, corner, T, and four-way Flat configurations. Assert mask derivation uses final occupancy and is independent of requested-cell ordering.

For example:

```ts
expect(roadConnectionMaskAt(cross, center, flatEnvironment, WORLD_CONFIG)).toBe(
  ROAD_NORTH | ROAD_EAST | ROAD_SOUTH | ROAD_WEST,
);
```

- [ ] **Step 2: Write failing Ramp and transaction tests**

Cover:

```ts
expect(planRoadMutation(empty, buildRampWithAlignedNeighbors, rampEnvironment, WORLD_CONFIG).valid)
  .toBe(true);
expect(planRoadMutation(empty, buildIsolatedRamp, rampEnvironment, WORLD_CONFIG).invalidReason)
  .toBe('road:invalid-ramp-topology');
expect(planRoadMutation(empty, buildWetFlat, wetEnvironment, WORLD_CONFIG).invalidReason)
  .toBe('road:wet-cell');
```

Also assert Bulldoze that would leave a neighboring Ramp as an end cap rejects the entire transaction and leaves the input snapshot byte-identical.

- [ ] **Step 3: Run focused tests and verify RED**

```bash
pnpm --filter @web-three-city/road-core test -- connectivity.test.ts road-mutation.test.ts
```

Expected: FAIL because planner/connectivity APIs do not exist.

- [ ] **Step 4: Implement non-iterative connectivity and final-state validation**

Implementation order must be:

```text
copy final occupancy
→ calculate raw cardinal occupancy mask for every affected occupied cell and its N/E/S/W neighbors
→ validate each cell's Terrain/Water policy and final mask
→ derive topologyChangedCells by comparing before/after masks
→ derive owning and cross-boundary dirty chunks
```

Do not recursively suppress connections to make an invalid Ramp valid. A Road cell participates in adjacency when occupied; the resulting final mask either passes or rejects the transaction.

- [ ] **Step 5: Implement stale fencing and typed commit errors**

Add `RoadContractError` with codes:

```text
road:invalid-plan
road:stale-road-plan
road:stale-terrain-plan
road:stale-water-plan
road:invalid-proposed-state
```

Commit must compare current Road, Terrain, and Water-source revisions with the plan, verify changed counts against the proposed buffer, increment Road revision exactly once, and return frozen receipt arrays sorted by `z`, then `x`.

- [ ] **Step 6: Verify GREEN including chunk boundaries**

```bash
pnpm --filter @web-three-city/road-core test
pnpm --filter @web-three-city/road-core typecheck
```

Expected: all Road tests PASS, including a connection across `x=15/16` invalidating both Road chunks.

- [ ] **Step 7: Commit**

```bash
git add packages/road-core/src packages/road-core/test
git commit -m "feat: plan and commit road mutations"
```

---

### Task 4: Road Serialization and Atomic World Save Migration

**Files:**
- Create: `packages/road-core/src/serialization.ts`
- Modify: `packages/road-core/src/index.ts`
- Test: `packages/road-core/test/serialization.test.ts`
- Create: `apps/game/src/world-save.ts`
- Test: `apps/game/src/world-save.test.ts`
- Modify: `apps/game/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `TerrainSaveV1`, Terrain decoder/encoder, `RoadSnapshot`, Road placement environment, and Water derivation.
- Produces:

```ts
export interface RoadSaveV1 {
  readonly schemaVersion: 1;
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  readonly definitionCodes: string;
}

export function encodeRoadSaveV1(roads: RoadSnapshot): RoadSaveV1;
export function decodeRoadSaveV1(input: unknown, config: WorldConfig): Result<RoadSnapshot, RoadSaveError>;

export interface WorldSaveV1 {
  readonly kind: 'world-save';
  readonly schemaVersion: 1;
  readonly terrain: TerrainSaveV1;
  readonly roads: RoadSaveV1;
}

export interface DecodedWorldState {
  readonly terrain: TerrainSnapshot;
  readonly water: WaterSnapshot;
  readonly roads: RoadSnapshot;
  readonly roadEnvironment: RoadPlacementEnvironment;
}

export function encodeWorldSaveV1(terrain: TerrainSnapshot, roads: RoadSnapshot): WorldSaveV1;
export function decodeWorldSave(
  input: unknown,
  config: WorldConfig,
): Result<DecodedWorldState, WorldSaveError>;
```

- [ ] **Step 1: Write failing Road codec tests**

Test byte-identical round trip, malformed Base64, wrong dimensions, wrong byte length, invalid revision, and unknown definition code. Assert derived topology is not serialized.

- [ ] **Step 2: Write failing world migration tests**

Assert a legacy `TerrainSaveV1` decodes to an empty Road snapshot at revision `0`. Assert a `WorldSaveV1` containing a Road on wet or unsupported Terrain returns an error and does not expose partial decoded state.

- [ ] **Step 3: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/road-core test -- serialization.test.ts
pnpm --filter @web-three-city/game typecheck
```

Expected: missing codec/world-save symbols.

- [ ] **Step 4: Implement strict Road codec**

Reuse the repository's validated Base64 pattern from Terrain serialization, but keep the code in `road-core`; do not import private Terrain serializer helpers. Define stable `RoadSaveErrorCode` values for schema, dimensions, metadata, Base64, byte length, and Road validation failures.

- [ ] **Step 5: Implement staged world decode**

`decodeWorldSave()` must:

```text
detect world envelope or legacy Terrain save
→ decode Terrain
→ derive Water
→ decode Roads or create empty Roads
→ create coherent placement environment
→ validate every occupied Road cell and all final Ramp masks
→ return one frozen staged world value
```

Do not mutate Game state inside the decoder.

- [ ] **Step 6: Verify GREEN**

```bash
pnpm --filter @web-three-city/road-core test
pnpm --filter @web-three-city/game typecheck
pnpm test:deployment
```

Expected: PASS; deployment composer contracts remain unchanged.

- [ ] **Step 7: Commit**

```bash
git add packages/road-core/src/serialization.ts packages/road-core/src/index.ts packages/road-core/test/serialization.test.ts apps/game/src/world-save.ts apps/game/src/world-save.test.ts apps/game/package.json pnpm-lock.yaml
git commit -m "feat: persist roads in world saves"
```

---

### Task 5: Deterministic Road Geometry

**Files:**
- Create: `packages/road-three/package.json`
- Create: `packages/road-three/tsconfig.json`
- Create: `packages/road-three/tsconfig.build.json`
- Create: `packages/road-three/vitest.config.ts`
- Create: `packages/road-three/src/road-mesh-data.ts`
- Create: `packages/road-three/src/road-geometry.ts`
- Create: `packages/road-three/src/index.ts`
- Test: `packages/road-three/test/road-geometry.test.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `RoadCellView`, Road masks, `TerrainCellSurfaceProfile`, `RoadDefinition`, `WorldConfig`.
- Produces:

```ts
export interface RoadMeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
  readonly triangleCount: number;
  readonly estimatedGeometryBytes: number;
}

export function buildRoadCellMesh(
  view: RoadCellView,
  config: WorldConfig,
): RoadMeshData;

export function mergeRoadCellMeshes(cells: readonly RoadMeshData[]): RoadMeshData;
```

- [ ] **Step 1: Scaffold `road-three` and write failing shape tests**

Create one golden test per supported Flat shape and Ramp axis. Each test must assert finite arrays, valid indices, triangle count, bounds inside the cell, and a stable SHA-256 over geometry bytes.

- [ ] **Step 2: Add edge-port alignment tests**

For adjacent compatible pieces, compare the exact boundary vertices on the shared edge. Flat straight-to-corner and Flat-to-Ramp transitions must use identical shared-edge coordinates plus the same fixed surface offset.

- [ ] **Step 3: Run tests and verify RED**

```bash
pnpm install --lockfile-only
pnpm --filter @web-three-city/road-three test -- road-geometry.test.ts
```

Expected: missing geometry functions.

- [ ] **Step 4: Implement minimal procedural geometry**

Use deterministic rectangles/polygons centered in the cell:

- isolated and end-cap shapes terminate inside the cell;
- straights expose two ports;
- corners expose two perpendicular ports;
- T/four-way shapes union their arms without overlapping coplanar duplicate faces;
- Ramp straights derive all Y values from authoritative Terrain corners plus `surfaceOffset`.

No bevels, lane markings, textures, external models, curves, or decorative shoulders.

- [ ] **Step 5: Verify GREEN and deterministic hashes**

```bash
pnpm --filter @web-three-city/road-three test -- road-geometry.test.ts
pnpm --filter @web-three-city/road-three typecheck
pnpm --filter @web-three-city/road-three build
```

Expected: all PASS and rerunning produces identical hashes.

- [ ] **Step 6: Commit**

```bash
git add packages/road-three pnpm-lock.yaml
git commit -m "feat: build deterministic road geometry"
```

---

### Task 6: Road Chunk and Preview Presentation

**Files:**
- Create: `packages/road-three/src/geometry-adapter.ts`
- Create: `packages/road-three/src/material-factory.ts`
- Create: `packages/road-three/src/road-chunk-presentation.ts`
- Create: `packages/road-three/src/road-preview-presentation.ts`
- Modify: `packages/road-three/src/index.ts`
- Test: `packages/road-three/test/geometry-adapter.test.ts`
- Test: `packages/road-three/test/road-chunk-presentation.test.ts`
- Test: `packages/road-three/test/road-preview-presentation.test.ts`

**Interfaces:**
- Consumes: Task 5 mesh data and Task 3 Road snapshots/views/dirty chunks.
- Produces:

```ts
export interface RoadPresentationSource {
  buildChunk(
    roads: RoadSnapshot,
    environment: RoadPlacementEnvironment,
    chunk: ChunkCoord,
  ): RoadMeshData;
}

export class RoadChunkPresentation {
  constructor(scene: THREE.Scene, source: RoadPresentationSource, config: WorldConfig);
  loadAll(roads: RoadSnapshot, environment: RoadPlacementEnvironment): void;
  rebuildDirty(
    roads: RoadSnapshot,
    environment: RoadPlacementEnvironment,
    chunks: readonly ChunkCoord[],
  ): void;
  getChunkObject(chunk: ChunkCoord): THREE.Object3D;
  dispose(): void;
}

export class RoadPreviewPresentation {
  constructor(scene: THREE.Scene, source: RoadPresentationSource, config: WorldConfig);
  show(plan: RoadMutationPlan, environment: RoadPlacementEnvironment): void;
  clear(): void;
  dispose(): void;
}
```

- [ ] **Step 1: Write failing geometry-adapter tests**

Assert invalid indices, non-finite positions, mismatched normals/colors, and out-of-range bounds throw stable `road-three:*` errors. Assert valid mesh data creates a `THREE.BufferGeometry` with matching counts.

- [ ] **Step 2: Write failing atomic chunk replacement tests**

Load a known snapshot, capture the old chunk object, force source failure for one dirty rebuild, and assert the old object remains attached and undisposed. Then allow a successful rebuild and assert replacement occurs before old disposal.

- [ ] **Step 3: Write failing Preview lifecycle tests**

Assert Preview uses a different root/material from committed Roads and clears on `clear()`/`dispose()`. Valid and invalid plans must have visibly distinct material state without mutating committed objects.

- [ ] **Step 4: Run focused tests and verify RED**

```bash
pnpm --filter @web-three-city/road-three test -- geometry-adapter.test.ts road-chunk-presentation.test.ts road-preview-presentation.test.ts
```

- [ ] **Step 5: Implement adapters and atomic presentation**

Build replacements off-scene, validate geometry, attach replacement, then dispose old objects. `rebuildDirty()` must deduplicate and sort chunks by `z`, then `x`. Presentation must never write to Road snapshots.

- [ ] **Step 6: Verify GREEN**

```bash
pnpm --filter @web-three-city/road-three test
pnpm --filter @web-three-city/road-three typecheck
```

- [ ] **Step 7: Commit**

```bash
git add packages/road-three/src packages/road-three/test
git commit -m "feat: present committed and preview roads"
```

---

### Task 7: Game Road Tools, Pointer Sessions, and UI

**Files:**
- Create: `apps/game/src/game-tool-mode.ts`
- Create: `apps/game/src/road-stroke-controller.ts`
- Test: `apps/game/src/road-stroke-controller.test.ts`
- Modify: `apps/game/src/game-input.ts`
- Modify: `apps/game/src/game-ui.ts`
- Modify: `apps/game/src/style.css`
- Modify: `apps/game/package.json`
- Modify: `pnpm-lock.yaml`
- Test: `browser-tests/helpers/interaction.ts`

**Interfaces:**
- Consumes: existing `PrimaryPointerToolDelegate`, terrain picking, Terraform stroke planner, Road planner, Road Preview.
- Produces:

```ts
export type GameToolMode = WorldToolMode | 'road-build' | 'road-bulldoze';

export interface RoadInputState {
  readonly mode: 'road-build' | 'road-bulldoze' | null;
  readonly strokeActive: boolean;
  readonly previewValid: boolean | null;
  readonly previewCellCount: number;
}

export interface RoadStrokeController {
  begin(pointerId: number, cell: CellCoord): boolean;
  move(pointerId: number, cell: CellCoord): void;
  end(pointerId: number, cell: CellCoord): RoadMutationPlan | null;
  cancel(pointerId: number): void;
  cancelAll(): void;
  getState(): RoadInputState;
}
```

`GameInput` changes to:

```ts
setToolMode(mode: GameToolMode): void;
getRoadState(): RoadInputState;
```

- [ ] **Step 1: Write failing Road stroke-controller tests**

Cover tap, drag supercover, deduplication, final-state replan, no-op, cancellation, and second-touch `cancelAll()`. Assert the controller snapshots Road/environment state at pointer-down and commits exactly one final plan on pointer-up.

- [ ] **Step 2: Run controller tests and verify RED**

```bash
pnpm --filter @web-three-city/game typecheck
pnpm exec vitest run apps/game/src/road-stroke-controller.test.ts
```

Expected: missing controller/module errors.

- [ ] **Step 3: Implement the controller and integrate one primary-pointer delegate**

Keep camera-input ownership unchanged. `game-input.ts` chooses behavior by `GameToolMode`:

- `navigate`: camera/tap selection;
- `raise|lower|flatten`: existing Terraform controller path;
- `road-build|road-bulldoze`: new Road controller path.

Tool changes must clear active sessions and both previews. Road drag reuses `rasterizeTerraformCellLine()` only as a generic deterministic cardinal supercover implementation; do not move it or add Road concepts to `terrain-core`.

- [ ] **Step 4: Add UI controls**

Add `Build Road` and `Bulldoze Road` buttons to the existing tool dock. Road modes hide/disable Terraform brush-size controls because Road v0.1 has no brush sizes. Active tool state must be reflected through the same selected-button semantics used by Terraform.

- [ ] **Step 5: Verify focused Game behavior**

```bash
pnpm --filter @web-three-city/game typecheck
pnpm lint
pnpm format:check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/game/src/game-tool-mode.ts apps/game/src/road-stroke-controller.ts apps/game/src/road-stroke-controller.test.ts apps/game/src/game-input.ts apps/game/src/game-ui.ts apps/game/src/style.css apps/game/package.json browser-tests/helpers/interaction.ts pnpm-lock.yaml
git commit -m "feat: add road build and bulldoze tools"
```

---

### Task 8: Game Composition, Terraform Guard, Tagged Undo, and Atomic Save/Load

**Files:**
- Create: `apps/game/src/world-undo.ts`
- Test: `apps/game/src/world-undo.test.ts`
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `apps/game/src/interaction-evidence.ts`
- Test: `browser-tests/terraform.spec.ts`
- Test: `browser-tests/game.spec.ts`

**Interfaces:**
- Consumes: all prior Road APIs and existing Terrain/Water presentation.
- Produces:

```ts
export type WorldUndoEntry =
  | { readonly kind: 'terraform'; readonly terrain: TerrainSnapshot }
  | { readonly kind: 'road'; readonly roads: RoadSnapshot };

export class WorldUndoStore {
  get available(): boolean;
  get kind(): WorldUndoEntry['kind'] | null;
  replace(entry: WorldUndoEntry): void;
  consume(): WorldUndoEntry | null;
  clear(): void;
}
```

Game evidence adds:

```ts
interface RoadInteractionEvidence {
  readonly committedRoadRevision: number;
  readonly occupiedCellCount: number;
  readonly previewValid: boolean | null;
  readonly previewCellCount: number;
  readonly commitCount: number;
  readonly bulldozeCount: number;
  readonly undoCount: number;
  readonly lastDirtyChunkCount: number;
  readonly chunkRebuildCount: number;
  readonly terrainRevision: number;
  readonly waterSourceTerrainRevision: number;
  readonly undoKind: 'terraform' | 'road' | null;
}
```

- [ ] **Step 1: Write failing tagged Undo tests**

Assert replacement semantics, single consumption, defensive frozen snapshots, clearing on load, and that failed/no-op operations do not replace an existing entry.

- [ ] **Step 2: Run Undo tests and verify RED**

```bash
pnpm exec vitest run apps/game/src/world-undo.test.ts
```

- [ ] **Step 3: Compose Road state and presentation at boot**

In `game-bootstrap.ts`:

- create empty Road snapshot;
- construct coherent `RoadPlacementEnvironment` from current Terrain/Water;
- create committed and Preview Road presentations;
- load all Road chunks after Terrain/Water;
- pass current Road/environment getters and Road commit callback to Game input.

- [ ] **Step 4: Implement Road mutation and rollback**

For a valid Road plan:

```text
commit Road snapshot
→ build dirty Road chunk replacements
→ atomically publish new Road snapshot/environment
→ replace world Undo with pre-commit Road snapshot
→ update diagnostics and status
```

If presentation rebuild fails, restore the prior Road presentation and keep authoritative state/Undo unchanged. Do not derive or reload Water.

- [ ] **Step 5: Implement Terraform-over-Road guard before commit**

Before `commitTerraformPlan()`, test every `plan.affectedCells` with `roadOccupiedAt()`. When occupied:

- do not call `commitTerraformPlan()`;
- display invalid preview/status `Terraform blocked by road`;
- preserve existing Undo;
- leave Terrain/Water/Road revisions and Water rebuild count unchanged.

The integration reason remains `terraform:road-occupied`; do not add it to `terrain-core` contracts.

- [ ] **Step 6: Replace Terrain-only Undo with `WorldUndoStore`**

- Terraform commit stores the pre-commit Terrain snapshot.
- Road Build/Bulldoze stores the pre-commit Road snapshot.
- Road Undo rebuilds only dirty Road chunks and does not touch Water.
- Terraform Undo uses existing world replacement and performs exactly one Water update.
- Load clears the slot.

- [ ] **Step 7: Replace Save/Load with world envelope and atomic replacement**

Change `SAVE_KEY` to `web-three-city:world-save:v1`, but on load check the new key first and then the legacy `web-three-city:terrain-save:v1` key. Use `decodeWorldSave()` to stage Terrain/Water/Roads, then replace all presentations atomically. Any failure restores the previous complete world.

- [ ] **Step 8: Add RED browser assertions for cross-system contracts**

Add tests that:

```ts
expect(afterBlockedTerraform.terrainRevision).toBe(before.terrainRevision);
expect(afterBlockedTerraform.waterRebuildCount).toBe(before.waterRebuildCount);
expect(afterBlockedTerraform.committedRoadRevision).toBe(before.committedRoadRevision);
expect(afterRoadBuild.waterSourceTerrainRevision).toBe(before.waterSourceTerrainRevision);
```

Also verify Road Build → Undo and Terraform → Undo follow latest mutation kind.

- [ ] **Step 9: Verify GREEN**

```bash
pnpm exec vitest run apps/game/src/world-undo.test.ts apps/game/src/world-save.test.ts
pnpm --filter @web-three-city/game typecheck
pnpm test
pnpm build
```

Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/game/src/world-undo.ts apps/game/src/world-undo.test.ts apps/game/src/game-bootstrap.ts apps/game/src/interaction-evidence.ts browser-tests/terraform.spec.ts browser-tests/game.spec.ts
git commit -m "feat: compose roads with world mutation contracts"
```

---

### Task 9: Terrain Lab Road Fixtures and Diagnostic Coverage

**Files:**
- Modify: `apps/terrain-lab/package.json`
- Modify: `apps/terrain-lab/src/fixture-registry.ts`
- Modify: `apps/terrain-lab/src/bootstrap.ts`
- Modify: `apps/terrain-lab/src/style.css`
- Modify: `apps/terrain-lab/tsconfig.json`
- Modify: `pnpm-lock.yaml`
- Test: `browser-tests/terrain-lab.spec.ts`
- Test: `browser-tests/road.spec.ts`

**Interfaces:**
- Consumes: Road core/Three packages and existing Terrain Lab fixture-selection pattern.
- Produces fixture identifiers:

```text
road-isolated
road-end-north
road-end-east
road-end-south
road-end-west
road-straight-ns
road-straight-ew
road-corner-ne
road-corner-es
road-corner-sw
road-corner-wn
road-t-north
road-t-east
road-t-south
road-t-west
road-four-way
road-ramp-north-up
road-ramp-north-down
road-ramp-east-up
road-ramp-east-down
road-invalid-ramp-perpendicular
road-invalid-ramp-junction
road-invalid-wet
road-chunk-boundary
```

- [ ] **Step 1: Add failing Terrain Lab registry tests/browser checks**

Assert every fixture ID appears once, loads deterministically, reports expected validity/topology, and keeps existing Terrain/Water fixtures available.

- [ ] **Step 2: Run Terrain Lab browser test and verify RED**

```bash
pnpm --filter @web-three-city/terrain-lab build
pnpm exec playwright test browser-tests/terrain-lab.spec.ts --project=chromium
```

Expected: missing Road fixtures.

- [ ] **Step 3: Implement fixture data and Road presentation composition**

Reuse the existing Terrain Lab app. Do not create a third application. Each fixture must construct explicit Terrain heights, derive Water, construct Roads, validate placement, then render committed/invalid Preview state with diagnostics.

- [ ] **Step 4: Add functional Road browser coverage**

In `browser-tests/road.spec.ts`, cover Flat shapes, aligned Ramp construction, invalid Ramp topology, wet rejection, cross-chunk connectivity, and Bulldoze topology updates using diagnostic evidence rather than pixel-only assertions.

- [ ] **Step 5: Verify GREEN**

```bash
pnpm --filter @web-three-city/terrain-lab typecheck
pnpm --filter @web-three-city/terrain-lab build
pnpm exec playwright test browser-tests/terrain-lab.spec.ts browser-tests/road.spec.ts --project=chromium
```

- [ ] **Step 6: Commit**

```bash
git add apps/terrain-lab browser-tests/terrain-lab.spec.ts browser-tests/road.spec.ts pnpm-lock.yaml
git commit -m "test: add road terrain lab fixtures"
```

---

### Task 10: Full Browser Acceptance, Visual Evidence, Documentation, and Final Gates

**Files:**
- Create: `browser-tests/road-visual-evidence.spec.ts`
- Modify: `browser-tests/interaction.spec.ts`
- Modify: `browser-tests/game.spec.ts`
- Modify: `browser-tests/terraform.spec.ts`
- Create: `docs/evidence/road-network-foundation-v0-1.md`
- Modify: `docs/superpowers/specs/2026-07-29-road-network-foundation-v0-1-approval.md`
- Modify: PR #10 body/status after implementation begins; do not merge without owner authorization.

**Interfaces:**
- Consumes: complete implementation and existing CI/Vercel workflow.
- Produces: exact-head automated evidence, screenshot inventory, performance observations, and owner-review handoff.

- [ ] **Step 1: Write complete browser acceptance before final polish**

Required Playwright scenarios:

1. desktop tap and drag Build;
2. desktop tap and drag Bulldoze;
3. mobile primary-touch Build/Bulldoze;
4. second-touch takeover cancels Road commit;
5. Flat straight, corner, T, and four-way topology;
6. aligned Ramp construction in both axes/directions;
7. invalid perpendicular/junction Ramp rejection;
8. wet-cell rejection;
9. chunk-boundary connectivity and dirty rebuild;
10. Terraform brush touching one Road cell rejects the full transaction;
11. Road mutation leaves Water revision/rebuild count unchanged;
12. latest-world-mutation Undo behavior;
13. WorldSaveV1 save/reload;
14. legacy Terrain-only save migration;
15. WebGL context restoration restores committed Roads and clears Preview;
16. Game `/` and Terrain Lab `/terrain-lab/` deployable routes.

- [ ] **Step 2: Run full Chromium and verify failures are implementation-specific**

```bash
pnpm exec playwright test --project=chromium
```

Expected before fixes: only newly added Road acceptance may fail. Existing Terrain, Water, Terraform, camera, and deployment tests must remain passing.

- [ ] **Step 3: Fix only observed failures and rerun focused tests**

For each failure, record the exact failing assertion and make the smallest production change. Re-run the specific spec until green before returning to the full suite.

- [ ] **Step 4: Capture deterministic visual evidence**

`road-visual-evidence.spec.ts` must capture desktop and mobile images for:

- Flat straight/corner/T/four-way;
- aligned Ramp Road;
- valid Build Preview;
- invalid Ramp Preview;
- Bulldoze topology update;
- cross-chunk Road connection;
- Terraform-over-Road invalid Preview;
- restored save after reload.

Record viewport, exact head, Road/Terrain/Water revisions, occupied-cell count, geometry bytes, dirty chunks, and screenshot SHA-256 in the evidence document.

- [ ] **Step 5: Run repository-wide verification**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm provenance:check
pnpm test:coverage
pnpm test:deployment
pnpm build
pnpm compose:vercel
pnpm test:browser
```

Expected: every command exits `0`. Confirm `.vercel/output/config.json` remains version `3`, Game exists at `.vercel/output/static/index.html`, and Terrain Lab exists at `.vercel/output/static/terrain-lab/index.html`.

- [ ] **Step 6: Review package boundaries and source provenance**

Run searches confirming:

```bash
! grep -R "@web-three-city/road" packages/terrain-core packages/water-core
! grep -R "from 'three'\|from \"three\"\|document\.\|window\." packages/road-core/src
```

Expected: both commands succeed. Confirm no third-party Road assets or copied production code were introduced.

- [ ] **Step 7: Write exact-head evidence and update approval status**

Populate `docs/evidence/road-network-foundation-v0-1.md` with actual test counts, run IDs, geometry hashes, screenshot hashes, performance observations, and known exclusions. Do not write projected values.

Update the approval record to distinguish:

```text
Specification: approved
TDD plan: approved or pending owner review
Implementation: complete or in progress
Owner visual review: pending until Preview is tested
Merge authorization: pending unless explicitly granted
```

- [ ] **Step 8: Commit final evidence descendant**

```bash
git add browser-tests docs/evidence/road-network-foundation-v0-1.md docs/superpowers/specs/2026-07-29-road-network-foundation-v0-1-approval.md
git commit -m "test: verify Road Network Foundation v0.1"
```

- [ ] **Step 9: Push, wait for exact-head CI/Sonar, then request protected Preview**

Verify all four CI jobs and SonarQube Quality Gate on the exact branch head. Apply `preview-ready` only after exact-head CI succeeds. Confirm the Preview comment reports the same head SHA and exact CI run.

- [ ] **Step 10: Owner acceptance and merge gate**

Do not mark Ready or merge until the owner verifies the specification checklist on the protected Preview and explicitly authorizes merge. Merge with squash and `expected_head_sha` fencing only after all gates are green.

---

## Plan Self-Review Record

### Specification coverage

- Authoritative Road state and definition boundary: Tasks 2–3.
- Flat/Ramp placement, Water dryness, topology, transaction atomicity, stale fencing: Tasks 1–3.
- Road SaveV1, WorldSaveV1, legacy migration, atomic load: Task 4 and Task 8.
- Deterministic procedural rendering, atomic dirty chunks, Preview separation: Tasks 5–6.
- Build/Bulldoze pointer behavior and mobile gesture takeover: Task 7 and Task 10.
- Terraform-over-Road full rejection and Water invariants: Task 8 and Task 10.
- One-level tagged world Undo: Task 8.
- Terrain Lab fixtures, diagnostics, browser evidence, Vercel/Sonar/owner gates: Tasks 9–10.
- Explicit exclusions remain absent from implementation tasks.

### Placeholder scan

The plan contains no `TBD`, `TODO`, “implement later,” or undefined neighboring interfaces. All production symbols consumed by later tasks are introduced in an earlier task.

### Type consistency

The plan consistently uses `TerrainCellSurfaceProfile`, `RoadPlacementEnvironment`, `RoadSnapshot`, `RoadMutationPlan`, `RoadMutationReceipt`, `GameToolMode`, `RoadInputState`, `WorldUndoStore`, `RoadSaveV1`, and `WorldSaveV1` with one spelling and ownership boundary each.
