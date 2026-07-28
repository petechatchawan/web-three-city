# Web Water & Shoreline Foundation v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic south-edge-connected ocean, topology-exact shoreline, shallow/deep Water presentation, and diorama Water wall without changing Terrain authority, save schema, or camera interaction.

**Architecture:** `water-core` is pure TypeScript and owns clipping, connectivity, immutable Water snapshots, chunk mesh data, shoreline ribbons, and the south Water wall. `water-three` owns BufferGeometry adapters, one shared material set, the full 64-chunk presentation source, atomic scene-root replacement, and disposal. `apps/game` derives and replaces complete Water state only on boot, valid Terrain load, and context restoration; Terrain Lab reuses deterministic fixtures.

**Tech Stack:** Node.js 22+, pnpm 10.13.1, TypeScript 6 strict mode, Three.js 0.185.1 WebGL2, Vitest 4.1.10, Playwright 1.61.1, Vite 8.1.5, GitHub Actions.

## Global Constraints

- Approved specification: `docs/superpowers/specs/2026-07-28-water-shoreline-foundation-v0-1-design.md`.
- Owner specification approval date: `2026-07-28`.
- Base commit: `master@8e4b002e547b456cf678aa325f78662121316e6e`.
- Delivery profile: single developer / low maintenance.
- Map `128 × 128`; chunk `16 × 16`; cell size `1.0`; height step `0.5`; sea level `1`; logical Water Y `0.5`; diorama base Y `-1.5`.
- Presentation offsets: Water `+0.010`, shoreline `+0.013`, existing Grid `+0.015`, existing Selection `+0.020` world units.
- The only ocean source is positive-length wet contact on the south map boundary.
- Water uses `selectTerrainDiagonal()` and `CELL_TRIANGLES`; never choose a second topology or classify from cell centers.
- Corner-only contact is disconnected. Enclosed low basins remain unrendered. A positive-width south-connected channel renders the basin.
- Water remains derived. Do not modify `TerrainSaveV1` or persist Water bytes.
- v0.1 performs complete derivation and complete atomic presentation replacement. Do not add chunk signatures, dirty scheduling, or partial Water rebuild.
- Water is always visible; do not add Water UI.
- Water meshes are not Terrain raycast targets.
- Use `Uint16Array` indices per Water chunk.
- No per-frame Water derivation, geometry rebuild, or Water allocation.
- Do not add lakes, hydrology, rivers, rainfall, flooding, waves, foam animation, reflection, refraction, Water physics, boats, Terraform UI, WebGPU, or final art.
- Every task follows RED → verify RED → minimal GREEN → focused regression → commit.
- Implementation uses a dedicated Draft PR. Merge requires exact-head verification and owner visual approval.

---

## Planned File Map

```text
packages/water-core/
  package.json
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
  src/errors.ts
  src/policy.ts
  src/wet-fragment.ts
  src/water-snapshot.ts
  src/mesh-data.ts
  src/water-chunk-mesher.ts
  src/water-wall-mesher.ts
  src/index.ts
  test/wet-fragment.test.ts
  test/water-snapshot.test.ts
  test/water-chunk-mesher.test.ts
  test/water-wall-mesher.test.ts

packages/water-three/
  package.json
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
  src/geometry-adapter.ts
  src/material-factory.ts
  src/core-water-source.ts
  src/water-presentation.ts
  src/index.ts
  test/geometry-adapter.test.ts
  test/core-water-source.test.ts
  test/water-presentation.test.ts

packages/shared-testkit/
  src/fixtures/water-cases.ts
  src/index.ts
  test/water-fixtures.test.ts

apps/terrain-lab/src/fixture-registry.ts
apps/terrain-lab/src/bootstrap.ts
apps/game/src/game-bootstrap.ts
apps/game/src/interaction-evidence.ts
browser-tests/terrain-lab.spec.ts
browser-tests/game.spec.ts
browser-tests/water.spec.ts
browser-tests/visual-evidence.spec.ts
docs/evidence/water-shoreline-foundation-v0-1.md
```

---

### Task 1: Exact wet-fragment clipping

**Files:**
- Create: `packages/water-core/package.json`
- Create: `packages/water-core/tsconfig.json`
- Create: `packages/water-core/tsconfig.build.json`
- Create: `packages/water-core/vitest.config.ts`
- Create: `packages/water-core/src/errors.ts`
- Create: `packages/water-core/src/policy.ts`
- Create: `packages/water-core/src/wet-fragment.ts`
- Create: `packages/water-core/src/index.ts`
- Create: `packages/water-core/test/wet-fragment.test.ts`

**Interfaces:**
- Consumes: `TerrainCorner`, `WorldConfig`.
- Produces: `OCEAN_POLICY_V1`, `WaterError`, `TriangleVertex`, `WetInterval`, `WetFragment`, `wetIntervalForEdge()`, `clipTriangleToSea()`.

- [ ] **Step 1: Create package metadata and failing tests**

```json
{
  "name": "@web-three-city/water-core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": "./src/index.ts",
  "dependencies": {
    "@web-three-city/world-core": "workspace:*",
    "@web-three-city/terrain-core": "workspace:*"
  },
  "scripts": {
    "test": "vitest run --passWithNoTests",
    "test:coverage": "vitest run --coverage --passWithNoTests",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "build": "tsc -p tsconfig.build.json"
  }
}
```

```ts
import { describe, expect, it } from 'vitest';
import { clipTriangleToSea, wetIntervalForEdge } from '../src/index.js';

describe('wetIntervalForEdge', () => {
  it.each([
    [0, 0, { start: 0, end: 1 }],
    [2, 2, null],
    [0, 2, { start: 0, end: 0.5 }],
    [2, 0, { start: 0.5, end: 1 }],
    [1, 2, { start: 0, end: 0 }],
  ] as const)('clips edge levels %s → %s', (a, b, expected) => {
    expect(wetIntervalForEdge(a, b, 1)).toEqual(expected);
  });
});

it('creates a deterministic positive-area quad', () => {
  const fragment = clipTriangleToSea(
    [
      { x: 0, z: 1, level: 0 },
      { x: 1, z: 1, level: 2 },
      { x: 1, z: 0, level: 0 },
    ],
    1,
  );
  expect(fragment?.vertices).toEqual([
    { x: 0, z: 1, terrainLevel: 0 },
    { x: 0.5, z: 1, terrainLevel: 1 },
    { x: 1, z: 0.5, terrainLevel: 1 },
    { x: 1, z: 0, terrainLevel: 0 },
  ]);
  expect(fragment?.area).toBeCloseTo(0.375, 8);
});

it('drops point-only sea contact', () => {
  expect(
    clipTriangleToSea(
      [
        { x: 0, z: 0, level: 1 },
        { x: 1, z: 0, level: 2 },
        { x: 0, z: 1, level: 2 },
      ],
      1,
    ),
  ).toBeNull();
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm install --frozen-lockfile
pnpm --filter @web-three-city/water-core test -- wet-fragment.test.ts
```

Expected: FAIL because Water exports and clipping functions do not exist.

- [ ] **Step 3: Implement policy and typed errors**

```ts
export const OCEAN_POLICY_V1 = Object.freeze({
  version: 'south-edge-sea-v1' as const,
  sourceBoundary: 'south' as const,
});

export type WaterErrorCode =
  | 'water:invalid-terrain-dimensions'
  | 'water:invalid-height-lattice'
  | 'water:invalid-terrain-revision'
  | 'water:invalid-sea-level'
  | 'water:terrain-revision-mismatch'
  | 'water:not-loaded'
  | 'water:disposed';

export interface WaterError {
  readonly code: WaterErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}
```

- [ ] **Step 4: Implement exact clipping**

```ts
export interface TriangleVertex {
  readonly x: number;
  readonly z: number;
  readonly level: number;
}
export interface WetVertex {
  readonly x: number;
  readonly z: number;
  readonly terrainLevel: number;
}
export interface WetInterval {
  readonly start: number;
  readonly end: number;
}
export interface WetFragment {
  readonly vertices: readonly WetVertex[];
  readonly area: number;
}
```

`wetIntervalForEdge()` returns `[0,1]` for two wet endpoints, `null` for two dry endpoints, and one interpolated interval for a crossing. `clipTriangleToSea()` uses Sutherland–Hodgman clipping against `level <= seaLevel`, preserves input winding, interpolates `x/z/terrainLevel`, removes adjacent duplicate points, computes polygon area, and returns `null` when area is at most `1e-9`.

- [ ] **Step 5: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/water-core test -- wet-fragment.test.ts
pnpm --filter @web-three-city/water-core typecheck
pnpm --filter @web-three-city/water-core build
pnpm lint
git add packages/water-core pnpm-lock.yaml
git commit -m "feat(water): add exact wet-fragment clipping"
```

---

### Task 2: South-edge connectivity and WaterSnapshot

**Files:**
- Create: `packages/shared-testkit/src/fixtures/water-cases.ts`
- Modify: `packages/shared-testkit/src/index.ts`
- Create: `packages/shared-testkit/test/water-fixtures.test.ts`
- Create: `packages/water-core/src/water-snapshot.ts`
- Modify: `packages/water-core/src/index.ts`
- Create: `packages/water-core/test/water-snapshot.test.ts`

**Interfaces:**
- Consumes: `TerrainSnapshot`, `WorldConfig`, `CELL_TRIANGLES`, `selectTerrainDiagonal()`, Task 1 clipping.
- Produces: `WaterFixtureName`, `createWaterFixture()`, `WaterSnapshot`, `triangleIndexFor()`, `deriveWaterSnapshot()`.

- [ ] **Step 1: Add deterministic fixtures**

```ts
export type WaterFixtureName =
  | 'water-straight-coast'
  | 'water-diagonal-sw-ne'
  | 'water-diagonal-nw-se'
  | 'water-bay'
  | 'water-peninsula'
  | 'water-chunk-seam'
  | 'water-enclosed-basin'
  | 'water-open-channel'
  | 'water-corner-contact'
  | 'water-south-wall';

export interface WaterFixture {
  readonly name: WaterFixtureName;
  readonly terrain: TerrainSnapshot;
  readonly expectedSeaTriangleCount: number;
  readonly expectedEnclosedWetTriangleCount: number;
}

export function createWaterFixture(name: WaterFixtureName): WaterFixture;
export const WATER_FIXTURE_NAMES: readonly WaterFixtureName[];
```

Build fixtures from a level-2 lattice using stable seeds `7001..7010`, `generationAttempt: 0`, and `revision: 1`. Set exact level-0/1 regions for each named shape. Fixture tests assert dimensions, lattice length, stable metadata, and byte equality across repeated construction.

- [ ] **Step 2: Write failing snapshot tests**

```ts
import { createWaterFixture } from '@web-three-city/shared-testkit';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { deriveWaterSnapshot } from '../src/index.js';

describe('deriveWaterSnapshot', () => {
  it('leaves an enclosed basin unrendered', () => {
    const fixture = createWaterFixture('water-enclosed-basin');
    const result = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.seaTriangleCount).toBe(0);
    expect(result.value.enclosedWetTriangleCount).toBeGreaterThan(0);
  });

  it('connects the same basin through a positive-width channel', () => {
    const fixture = createWaterFixture('water-open-channel');
    const result = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.seaTriangleCount).toBeGreaterThan(0);
  });

  it('keeps corner-only contact disconnected', () => {
    const fixture = createWaterFixture('water-corner-contact');
    const result = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.enclosedWetTriangleCount).toBeGreaterThan(0);
  });
});
```

Add tests for straight coast, both diagonal fixtures, byte determinism, wrong dimensions, wrong lattice length, negative revision, and invalid sea level.

- [ ] **Step 3: Verify RED**

```bash
pnpm --filter @web-three-city/shared-testkit test -- water-fixtures.test.ts
pnpm --filter @web-three-city/water-core test -- water-snapshot.test.ts
```

Expected: FAIL because fixtures and WaterSnapshot derivation do not exist.

- [ ] **Step 4: Implement snapshot contract**

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

export function triangleIndexFor(
  cellX: number,
  cellZ: number,
  localTriangleIndex: 0 | 1,
  mapWidth: number,
): number {
  return ((cellZ * mapWidth + cellX) * 2) + localTriangleIndex;
}
```

- [ ] **Step 5: Implement deterministic graph derivation**

For cells in z-major/x-major order, use the canonical diagonal and triangle array order. Register positive-length wet intervals by canonical undirected lattice-edge key. Connect fragments only when intervals overlap by more than `1e-9`. Seed positive-length south-boundary contacts, breadth-first search neighbors in ascending triangle-index order, and set one mask byte per reachable canonical triangle. Count unreachable positive-area wet triangles as enclosed. Count unique connected-sea boundaries excluding the south boundary as shoreline segments.

```ts
export function deriveWaterSnapshot(
  terrain: TerrainSnapshot,
  config: WorldConfig,
): Result<WaterSnapshot, WaterError>;
```

- [ ] **Step 6: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/shared-testkit test -- water-fixtures.test.ts
pnpm --filter @web-three-city/water-core test -- water-snapshot.test.ts
pnpm --filter @web-three-city/water-core test:coverage
pnpm --filter @web-three-city/water-core typecheck
git add packages/shared-testkit packages/water-core
git commit -m "feat(water): derive deterministic south-edge sea"
```

---

### Task 3: Surface, shoreline, and south-wall mesh data

**Files:**
- Create: `packages/water-core/src/mesh-data.ts`
- Create: `packages/water-core/src/water-chunk-mesher.ts`
- Create: `packages/water-core/src/water-wall-mesher.ts`
- Modify: `packages/water-core/src/index.ts`
- Create: `packages/water-core/test/water-chunk-mesher.test.ts`
- Create: `packages/water-core/test/water-wall-mesher.test.ts`

**Interfaces:**
- Consumes: `TerrainSnapshot`, `WaterSnapshot`, `ChunkCoord`, `WorldConfig`.
- Produces: `WaterChunkMeshData`, `WaterWallMeshData`, `buildWaterChunkMesh()`, `buildWaterWallMesh()`.

- [ ] **Step 1: Write failing geometry tests**

```ts
it('builds finite upward-facing Uint16 geometry', () => {
  const fixture = createWaterFixture('water-chunk-seam');
  const water = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
  expect(water.ok).toBe(true);
  if (!water.ok) return;
  const mesh = buildWaterChunkMesh(
    fixture.terrain,
    water.value,
    { x: 3, z: 6 },
    WORLD_CONFIG,
  );
  expect(mesh.surfaceIndices).toBeInstanceOf(Uint16Array);
  expect([...mesh.surfacePositions].every(Number.isFinite)).toBe(true);
  expect(mesh.surfaceTriangleCount).toBe(mesh.surfaceIndices.length / 3);
  for (let index = 1; index < mesh.surfaceNormals.length; index += 3) {
    expect(mesh.surfaceNormals[index]).toBe(1);
  }
});

it('rejects stale Water', () => {
  const fixture = createWaterFixture('water-bay');
  const water = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
  expect(water.ok).toBe(true);
  if (!water.ok) return;
  expect(() =>
    buildWaterChunkMesh(
      { ...fixture.terrain, revision: 2 },
      water.value,
      { x: 0, z: 0 },
      WORLD_CONFIG,
    ),
  ).toThrowError(expect.objectContaining({ code: 'water:terrain-revision-mismatch' }));
});
```

Add exact adjacent-chunk seam comparison, upward winding, index range, no duplicate shoreline key, no zero-area triangle, level-1 shallow color, level-0 deep color, and `65_535` vertex-capacity tests.

- [ ] **Step 2: Write failing wall tests**

```ts
it('builds only connected south intervals to the diorama base', () => {
  const fixture = createWaterFixture('water-south-wall');
  const water = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
  expect(water.ok).toBe(true);
  if (!water.ok) return;
  const wall = buildWaterWallMesh(fixture.terrain, water.value, WORLD_CONFIG);
  expect(wall.segmentCount).toBeGreaterThan(0);
  expect(wall.bounds.min.y).toBe(WORLD_CONFIG.dioramaBaseY);
  expect(wall.bounds.max.y).toBeCloseTo(0.51, 8);
});
```

Add an assertion that south-boundary land produces no wall segment.

- [ ] **Step 3: Verify RED**

```bash
pnpm --filter @web-three-city/water-core test -- water-chunk-mesher.test.ts water-wall-mesher.test.ts
```

Expected: FAIL because mesh contracts and builders do not exist.

- [ ] **Step 4: Implement mesh contracts**

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

export interface WaterWallMeshData {
  readonly sourceTerrainRevision: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint16Array;
  readonly segmentCount: number;
  readonly bounds: MeshBounds;
}
```

- [ ] **Step 5: Implement chunk surface and shoreline**

For each sea-marked triangle owned by the chunk, rerun exact clipping, place surface vertices at `seaLevel * heightStep + 0.010`, emit `[0,1,0]` normals, and color by `depthLevels = seaLevel - terrainLevel`. Interpolate shallow `[0.36,0.76,0.86]` to deep `[0.06,0.28,0.55]` over clamped depth `0..1`. Triangulate quads `[0,1,2, 0,2,3]` with upward winding.

Build each unique non-south shoreline interval into a `0.35 * cellSize` triangle ribbon at Water Y `+0.013`. Quantize endpoint keys to `1e-9`, assign ownership to the canonical lower triangle index, and clip output to that owning cell's chunk.

Reject non-finite values, out-of-range indices, zero-area output, stale revision, and more than `65_535` vertices.

- [ ] **Step 6: Implement south Water wall**

Merge adjacent collinear connected south-boundary intervals. Emit one quad per merged interval at south world Z `+0.010`, top Y `seaLevel * heightStep + 0.010`, bottom Y `dioramaBaseY`, normal `[0,0,1]`, lighter top colors, and darker base colors. Emit no other boundary wall.

- [ ] **Step 7: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/water-core test -- water-chunk-mesher.test.ts water-wall-mesher.test.ts
pnpm --filter @web-three-city/water-core test:coverage
pnpm --filter @web-three-city/water-core typecheck
pnpm --filter @web-three-city/water-core build
git add packages/water-core
git commit -m "feat(water): build shoreline and Water meshes"
```

---

### Task 4: Atomic Three.js Water presentation

**Files:**
- Create: `packages/water-three/package.json`
- Create: `packages/water-three/tsconfig.json`
- Create: `packages/water-three/tsconfig.build.json`
- Create: `packages/water-three/vitest.config.ts`
- Create: `packages/water-three/src/geometry-adapter.ts`
- Create: `packages/water-three/src/material-factory.ts`
- Create: `packages/water-three/src/core-water-source.ts`
- Create: `packages/water-three/src/water-presentation.ts`
- Create: `packages/water-three/src/index.ts`
- Create: `packages/water-three/test/geometry-adapter.test.ts`
- Create: `packages/water-three/test/core-water-source.test.ts`
- Create: `packages/water-three/test/water-presentation.test.ts`

**Interfaces:**
- Consumes: Task 3 mesh data, `allChunkCoords()`, Three.js `Scene`.
- Produces: geometry adapters, `WaterMaterials`, `createCoreWaterPresentationSource()`, `WaterPresentationSource`, `WaterPresentation`.

- [ ] **Step 1: Create package metadata and failing adapter tests**

```json
{
  "name": "@web-three-city/water-three",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": "./src/index.ts",
  "dependencies": {
    "@web-three-city/world-core": "workspace:*",
    "@web-three-city/terrain-core": "workspace:*",
    "@web-three-city/water-core": "workspace:*",
    "three": "0.185.1"
  },
  "scripts": {
    "test": "vitest run --passWithNoTests",
    "test:coverage": "vitest run --coverage --passWithNoTests",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "build": "tsc -p tsconfig.build.json"
  }
}
```

```ts
it('maps Water typed arrays into BufferGeometry', () => {
  const geometry = createWaterSurfaceGeometry(sampleChunk);
  expect(geometry.getAttribute('position').array).toBe(sampleChunk.surfacePositions);
  expect(geometry.getAttribute('normal').array).toBe(sampleChunk.surfaceNormals);
  expect(geometry.getAttribute('color').array).toBe(sampleChunk.surfaceColors);
  expect(geometry.getIndex()?.array).toBe(sampleChunk.surfaceIndices);
});
```

- [ ] **Step 2: Write failing source and lifecycle tests**

```ts
it('builds all 64 Water chunks and one wall', () => {
  const source = createCoreWaterPresentationSource(WORLD_CONFIG);
  const build = source.buildAll(terrain, water);
  expect(build.chunks).toHaveLength(64);
  expect(build.wall.sourceTerrainRevision).toBe(terrain.revision);
});

it('atomically replaces one root and disposes previous geometry', () => {
  const scene = new THREE.Scene();
  const presentation = new WaterPresentation(scene, source, WORLD_CONFIG);
  presentation.load(terrainA, waterA);
  const firstRoot = presentation.object3d;
  const firstGeometry = (firstRoot.children[0] as THREE.Mesh).geometry;
  const disposeSpy = vi.spyOn(firstGeometry, 'dispose');
  presentation.load(terrainB, waterB);
  expect(scene.children.filter((node) => node.name === 'water-presentation-root')).toHaveLength(1);
  expect(disposeSpy).toHaveBeenCalledOnce();
});
```

Add tests for failed staging preserving the previous root, staged geometry disposal, object names, render orders `4/5/6`, one shared material set, revision mismatch, repeated load, and idempotent disposal.

- [ ] **Step 3: Verify RED**

```bash
pnpm install --frozen-lockfile
pnpm --filter @web-three-city/water-three test
```

Expected: FAIL because package exports and presentation do not exist.

- [ ] **Step 4: Implement adapters, materials, and full source**

```ts
export interface WaterPresentationBuild {
  readonly chunks: readonly WaterChunkMeshData[];
  readonly wall: WaterWallMeshData;
}
export interface WaterPresentationSource {
  buildAll(terrain: TerrainSnapshot, water: WaterSnapshot): WaterPresentationBuild;
}
export function createCoreWaterPresentationSource(
  config: WorldConfig,
): WaterPresentationSource;
```

`createCoreWaterPresentationSource()` maps `allChunkCoords(config)` through `buildWaterChunkMesh()` in canonical chunk order and calls `buildWaterWallMesh()` exactly once.

Use one shared material set:

```ts
surface: { transparent: true, opacity: 0.78, depthTest: true, depthWrite: false, vertexColors: true, side: THREE.DoubleSide }
shoreline: { transparent: true, opacity: 0.82, depthTest: true, depthWrite: false, vertexColors: true, side: THREE.DoubleSide }
wall: { transparent: false, depthTest: true, depthWrite: true, vertexColors: true, side: THREE.DoubleSide }
```

- [ ] **Step 5: Implement atomic WaterPresentation**

```ts
export class WaterPresentation {
  constructor(scene: THREE.Scene, source: WaterPresentationSource, config: WorldConfig);
  get object3d(): THREE.Group;
  load(terrain: TerrainSnapshot, water: WaterSnapshot): void;
  dispose(): void;
}
```

Build a detached staged root named `water-presentation-root`; add non-empty surface meshes named `water-surface-chunk:x:z`, non-empty shoreline meshes named `water-shoreline-chunk:x:z`, and a non-empty `water-wall`. Swap only after every adapter succeeds. Dispose staged geometry on failure, previous geometry after success, and materials exactly once on `dispose()`. Do not expose partial rebuild.

- [ ] **Step 6: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/water-three test
pnpm --filter @web-three-city/water-three test:coverage
pnpm --filter @web-three-city/water-three typecheck
pnpm --filter @web-three-city/water-three build
git add packages/water-three pnpm-lock.yaml
git commit -m "feat(water): add atomic Three.js presentation"
```

---

### Task 5: Terrain Lab Water fixtures

**Files:**
- Modify: `apps/terrain-lab/package.json`
- Modify: `apps/terrain-lab/src/fixture-registry.ts`
- Modify: `apps/terrain-lab/src/bootstrap.ts`
- Modify: `browser-tests/terrain-lab.spec.ts`

**Interfaces:**
- Consumes: shared Water fixtures, `deriveWaterSnapshot()`, `createCoreWaterPresentationSource()`, `WaterPresentation`.
- Produces: ten query-selectable Water fixtures and read-only fixture evidence.

- [ ] **Step 1: Write failing browser fixture tests**

```ts
for (const fixture of WATER_FIXTURE_NAMES) {
  test(`renders ${fixture}`, async ({ page }) => {
    await page.goto(`/?fixture=${fixture}`);
    await expect(page.locator('[data-testid="fixture-name"]')).toHaveText(fixture);
    await expect(page.locator('[data-testid="water-status"]')).toHaveText('Ready');
  });
}
```

Add assertions that enclosed basin reports zero sea triangles and a positive enclosed count; open channel reports positive sea triangles; every fixture reports exactly one Water root.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @web-three-city/terrain-lab build
pnpm exec playwright test browser-tests/terrain-lab.spec.ts --project=chromium
```

Expected: FAIL because Water fixtures and evidence are not registered.

- [ ] **Step 3: Integrate existing Terrain Lab**

Add dependencies on `water-core` and `water-three`. Resolve Water fixtures through `createWaterFixture()`, then load Terrain → Water → Grid. Publish:

```ts
interface TerrainLabWaterEvidence {
  readonly fixture: WaterFixtureName;
  readonly sourceTerrainRevision: number;
  readonly seaTriangleCount: number;
  readonly enclosedWetTriangleCount: number;
  readonly shorelineSegmentCount: number;
  readonly waterRootCount: number;
}
```

Dispose Selection → Grid → Water → Terrain → Renderer. Do not create a Water Lab app or Water toggle.

- [ ] **Step 4: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/terrain-lab typecheck
pnpm --filter @web-three-city/terrain-lab build
pnpm exec playwright test browser-tests/terrain-lab.spec.ts --project=chromium
git add apps/terrain-lab browser-tests/terrain-lab.spec.ts pnpm-lock.yaml
git commit -m "feat(water): add Terrain Lab Water fixtures"
```

---

### Task 6: Game lifecycle composition

**Files:**
- Modify: `apps/game/package.json`
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `apps/game/src/interaction-evidence.ts`
- Modify: `browser-tests/game.spec.ts`

**Interfaces:**
- Consumes: Water derivation and presentation, existing Terrain/Grid/Selection/Input lifecycle.
- Produces: Water-enabled Game and deterministic read-only Water evidence.

- [ ] **Step 1: Write failing Game tests**

```ts
test('boots Coastal Water with one root', async ({ page }) => {
  await page.goto('/');
  const evidence = await page.evaluate(() => window.__WEB_THREE_CITY_INTERACTION__?.snapshot());
  expect(evidence?.water?.waterRootCount).toBe(1);
  expect(evidence?.water?.seaTriangleCount).toBeGreaterThan(0);
});

test('save and load reproduce identical Water evidence', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => window.__WEB_THREE_CITY_INTERACTION__?.snapshot().water);
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('button', { name: 'Load' }).click();
  const after = await page.evaluate(() => window.__WEB_THREE_CITY_INTERACTION__?.snapshot().water);
  expect(after).toEqual(before);
});
```

Add underwater Terrain selection, Grid visibility, Reset root count, and context-restoration root count tests.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @web-three-city/game build
pnpm exec playwright test browser-tests/game.spec.ts --project=chromium
```

Expected: FAIL because Game evidence and scene contain no Water.

- [ ] **Step 3: Compose boot and valid Terrain load**

Boot:

```ts
let snapshot = generated.value;
let waterSnapshot = unwrapWater(deriveWaterSnapshot(snapshot, WORLD_CONFIG));
const water = new WaterPresentation(
  scene,
  createCoreWaterPresentationSource(WORLD_CONFIG),
  WORLD_CONFIG,
);
terrain.load(snapshot);
water.load(snapshot, waterSnapshot);
grid.load(snapshot);
```

Valid Terrain load:

1. decode Terrain;
2. derive `nextWater` before changing visible roots;
3. pause rendering with `replacingWorld = true`;
4. load Terrain → Water → Grid;
5. rebuild Selection;
6. refresh Terrain raycast objects;
7. assign current Terrain and Water snapshots;
8. resume rendering in `finally`.

Derivation failure preserves the previous world and reports `Invalid save`. Water meshes never enter `terrainObjects`.

- [ ] **Step 4: Compose restoration, disposal, and evidence**

Restoration order: Terrain → Water → Grid → Selection → Terrain raycast refresh.

Disposal order: Input → Selection → Grid → Water → Terrain → Renderer.

```ts
interface WaterInteractionEvidence {
  readonly sourceTerrainRevision: number;
  readonly seaTriangleCount: number;
  readonly enclosedWetTriangleCount: number;
  readonly shorelineSegmentCount: number;
  readonly surfaceTriangleCount: number;
  readonly shorelineTriangleCount: number;
  readonly wallSegmentCount: number;
  readonly estimatedGeometryBytes: number;
  readonly waterRootCount: number;
}
```

Evidence is read-only and contains no mutation callbacks.

- [ ] **Step 5: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/game typecheck
pnpm --filter @web-three-city/game build
pnpm exec playwright test browser-tests/game.spec.ts browser-tests/interaction.spec.ts --project=chromium
git add apps/game browser-tests/game.spec.ts pnpm-lock.yaml
git commit -m "feat(water): integrate Water into Game lifecycle"
```

---

### Task 7: Browser acceptance and deterministic evidence

**Files:**
- Create: `browser-tests/water.spec.ts`
- Modify: `browser-tests/helpers/interaction.ts`
- Modify: `browser-tests/visual-evidence.spec.ts`
- Create: `docs/evidence/water-shoreline-foundation-v0-1.md`

**Interfaces:**
- Consumes: Game/Terrain Lab Water evidence.
- Produces: acceptance tests, ten screenshots, trace, JSON metrics, geometry hash, evidence record.

- [ ] **Step 1: Add Water acceptance tests**

```ts
test('underwater selection and Grid remain readable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Grid' }).click();
  await clickTerrainCell(page, { x: 64, z: 116 });
  const evidence = await page.evaluate(() => window.__WEB_THREE_CITY_INTERACTION__?.snapshot());
  expect(evidence?.gridVisible).toBe(true);
  expect(evidence?.selectedCell).toEqual({ x: 64, z: 116 });
  expect(evidence?.water?.waterRootCount).toBe(1);
});
```

Also test desktop/mobile framing, pan/zoom/yaw/pitch/reset regression, save/load equality, context restore, enclosed basin dry, open channel wet, chunk seam fixture, and south wall.

- [ ] **Step 2: Capture exact visual artifacts**

```text
water-game-desktop.png
water-game-mobile.png
water-grid-selection.png
water-straight-coast.png
water-bay.png
water-peninsula.png
water-chunk-seam.png
water-enclosed-basin.png
water-open-channel.png
water-south-wall.png
```

Store screenshots, passing trace, and JSON under `test-results/water-shoreline-foundation-v0-1/` for the existing CI artifact upload.

- [ ] **Step 3: Record hashes and timing observations**

Use `performance.now()` around derivation and presentation load. Compute SHA-256 over ordered Water typed arrays. Record:

```ts
interface WaterPerformanceEvidence {
  readonly derivationDurationMs: number;
  readonly presentationDurationMs: number;
  readonly seaTriangleCount: number;
  readonly enclosedWetTriangleCount: number;
  readonly surfaceTriangleCount: number;
  readonly shorelineTriangleCount: number;
  readonly wallSegmentCount: number;
  readonly estimatedGeometryBytes: number;
  readonly geometrySha256: string;
  readonly rootsBeforeRestore: number;
  readonly rootsAfterRestore: number;
}
```

Assert finite non-negative durations, deterministic counts/hash, and both root counts equal `1`; do not create timing budgets.

- [ ] **Step 4: Run evidence suite and write evidence document**

```bash
pnpm exec playwright test \
  browser-tests/water.spec.ts \
  browser-tests/visual-evidence.spec.ts \
  --project=chromium --trace=on
```

Document exact implementation SHA, CI run ID, browser test count, artifact ID/digest, mask/geometry hashes, counts, timings, screenshot inventory, visual self-review, and owner visual approval pending.

- [ ] **Step 5: Commit**

```bash
git add browser-tests docs/evidence/water-shoreline-foundation-v0-1.md
git commit -m "test(water): add browser acceptance and evidence"
```

---

### Task 8: Final verification and review handoff

**Files:**
- Modify only real defects found in Tasks 1–7 files.
- Finalize: `docs/evidence/water-shoreline-foundation-v0-1.md`.
- Update PR description/checklist without adding scope.

**Interfaces:**
- Consumes: complete milestone.
- Produces: exact-head green verification and owner visual-review handoff.

- [ ] **Step 1: Run focused and full gates**

```bash
pnpm --filter @web-three-city/water-core test:coverage
pnpm --filter @web-three-city/water-three test:coverage
pnpm --filter @web-three-city/water-core typecheck
pnpm --filter @web-three-city/water-three typecheck
pnpm --filter @web-three-city/terrain-lab build
pnpm --filter @web-three-city/game build
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm provenance:check
pnpm test:coverage
pnpm build
pnpm test:browser
```

Expected: every command PASS on the exact implementation head.

- [ ] **Step 2: Run scope and boundary audits**

```bash
rg -n "from ['\"]three['\"]|document\.|window\." packages/water-core
rg -n "Water|water" packages/terrain-core packages/terrain-generator
rg -n "TerrainSaveV2|WaterSave|water.*localStorage|localStorage.*water" .
rg -n "chunkSignature|dirtyWater|reflection|refraction|buoyancy|WebGPU" \
  packages/water-core packages/water-three apps/game apps/terrain-lab
```

Expected: no Three.js/DOM in `water-core`; no Water dependency from Terrain; no Water save schema; no deferred subsystem implementation.

- [ ] **Step 3: Review changed-file boundary**

Allow only Water packages, shared fixtures, Terrain Lab integration, Game integration, browser tests/evidence, and required lockfile/config changes. Reject unrelated camera, Terrain topology, generator, save, UI-feature, or renderer refactors.

- [ ] **Step 4: Push and require exact-head CI**

```bash
git status --short
git diff --check
git push
```

Require these four jobs to pass:

```text
Quality and provenance
Unit, geometry, and golden tests
Build all packages and applications
Chromium smoke, interaction, and visual evidence
```

- [ ] **Step 5: Update PR to Ready for Review**

Record exact base/head SHAs, Tasks 1–8 complete, CI run number/ID, unit and browser counts, artifact ID/digest, deterministic hashes/counts/timings, open review-thread count, owner visual approval pending, and automatic merge not authorized.

- [ ] **Step 6: Verify a documentation-only descendant when created**

```bash
git add docs/evidence/water-shoreline-foundation-v0-1.md
git commit -m "docs(water): finalize Water acceptance evidence"
git push
```

Require the full four-job CI suite again on that descendant before requesting visual approval.

---

## Completion Definition

The milestone is complete only when all eight tasks are checked, exact-head CI passes all four jobs, deterministic screenshots/counts/hashes/timing observations are recorded, south-edge-connected sea renders, enclosed basins remain dry, shoreline has no visible chunk seams, the Water wall reaches the diorama base without overshoot, Grid and Selection remain readable through Water, save/load and context restoration leave one Water root, and the repository owner approves the visual result before merge.