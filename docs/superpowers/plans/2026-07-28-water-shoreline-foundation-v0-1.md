# Web Water & Shoreline Foundation v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic south-edge-connected ocean, topology-exact shoreline, shallow/deep Water presentation, and diorama Water wall without changing Terrain authority, save schema, or camera interaction.

**Architecture:** `water-core` is a pure TypeScript derivation and meshing package that consumes `TerrainSnapshot` plus `WorldConfig`. `water-three` adapts immutable Water mesh data into one atomic Three.js presentation root. `apps/game` derives and replaces the complete Water state on boot, Terrain load, and WebGL context restoration; `apps/terrain-lab` reuses deterministic Water fixtures for visual inspection.

**Tech Stack:** Node.js 22+, pnpm 10.13.1, TypeScript 6 strict mode, Three.js 0.185.1 WebGL2, Vitest 4.1.10, Playwright 1.61.1, Vite 8.1.5, GitHub Actions.

## Global Constraints

- Approved specification: `docs/superpowers/specs/2026-07-28-water-shoreline-foundation-v0-1-design.md`.
- Owner specification approval date: `2026-07-28`.
- Base commit: `master@8e4b002e547b456cf678aa325f78662121316e6e`.
- Delivery profile: single developer / low maintenance.
- Map is `128 × 128`; chunk size is `16 × 16`; cell size is `1.0`; height step is `0.5`; sea level is height level `1`; logical Water Y is `0.5`; diorama base Y is `-1.5`.
- Presentation offsets are Water `+0.010`, shoreline `+0.013`, existing Grid `+0.015`, and existing Selection `+0.020` world units.
- The only ocean source is positive-length wet contact on the south map boundary.
- Water uses `selectTerrainDiagonal()` and `CELL_TRIANGLES`; it never chooses a separate diagonal or classifies from cell centers.
- Corner-only contact is disconnected. Enclosed low basins remain unrendered. A positive-width channel to the south ocean connects the basin.
- Water remains derived. Do not modify `TerrainSaveV1` or write Water bytes to Local Storage.
- Full Water derivation and full atomic Water presentation replacement are the v0.1 policy. Do not add chunk signatures, dirty scheduling, or partial presentation rebuild.
- Water is always visible. Do not add a Water toggle or Water-specific UI.
- Water meshes are excluded from Terrain raycast targets so underwater clicks still select Terrain.
- Use `Uint16Array` indices for every chunk-local surface and shoreline geometry.
- The animation loop must not derive, rebuild, or allocate Water geometry.
- Do not add lakes, basin hydrology, rivers, rainfall, flooding, waves, foam animation, reflection, refraction, Water physics, boats, Terraform UI, WebGPU, or final art.
- Every production task follows RED → verify RED → minimal GREEN → focused regression → commit.
- Use a dedicated implementation branch and Draft PR. Merge requires exact-head automated verification and owner visual approval.

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
  src/water-presentation.ts
  src/index.ts
  test/geometry-adapter.test.ts
  test/water-presentation.test.ts

packages/shared-testkit/
  src/fixtures/water-cases.ts
  src/index.ts
  test/water-fixtures.test.ts

apps/terrain-lab/src/
  fixture-registry.ts
  bootstrap.ts

apps/game/src/
  game-bootstrap.ts
  interaction-evidence.ts

browser-tests/
  helpers/interaction.ts
  game.spec.ts
  water.spec.ts
  visual-evidence.spec.ts

docs/evidence/water-shoreline-foundation-v0-1.md
```

---

### Task 1: Package boundary and exact wet-fragment clipping

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
- Consumes: `TerrainCorner`, `TerrainCorners`, `WorldConfig`.
- Produces: `OCEAN_POLICY_V1`, `WaterError`, `WaterErrorCode`, `TriangleVertex`, `WetInterval`, `WetFragment`, `wetIntervalForEdge()`, `clipTriangleToSea()`.

- [ ] **Step 1: Create package metadata and failing clipping tests**

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

describe('clipTriangleToSea', () => {
  it('creates a deterministic quad when two vertices are wet', () => {
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
    expect(fragment?.area).toBeCloseTo(0.75, 8);
  });

  it('drops zero-area contact at the sea plane', () => {
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
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm install --frozen-lockfile
pnpm --filter @web-three-city/water-core test -- wet-fragment.test.ts
```

Expected: FAIL because `@web-three-city/water-core` exports and clipping functions do not exist.

- [ ] **Step 3: Implement stable policy and typed errors**

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

- [ ] **Step 4: Implement exact edge intervals and Sutherland–Hodgman clipping**

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

export function wetIntervalForEdge(
  levelA: number,
  levelB: number,
  seaLevel: number,
): WetInterval | null {
  const aWet = levelA <= seaLevel;
  const bWet = levelB <= seaLevel;
  if (aWet && bWet) return { start: 0, end: 1 };
  if (!aWet && !bWet) return null;
  const t = (seaLevel - levelA) / (levelB - levelA);
  return aWet ? { start: 0, end: t } : { start: t, end: 1 };
}
```

`clipTriangleToSea()` must preserve input winding, interpolate `x`, `z`, and `terrainLevel`, remove adjacent duplicate vertices, compute signed polygon area, and return `null` when `Math.abs(area) <= 1e-9`.

- [ ] **Step 5: Verify GREEN and package boundaries**

```bash
pnpm --filter @web-three-city/water-core test -- wet-fragment.test.ts
pnpm --filter @web-three-city/water-core typecheck
pnpm --filter @web-three-city/water-core build
pnpm lint
```

Expected: all commands PASS; `water-core` has no Three.js or DOM import.

- [ ] **Step 6: Commit**

```bash
git add packages/water-core pnpm-lock.yaml
git commit -m "feat(water): add exact wet-fragment clipping"
```

---

### Task 2: Deterministic south-edge sea connectivity and WaterSnapshot

**Files:**
- Create: `packages/shared-testkit/src/fixtures/water-cases.ts`
- Modify: `packages/shared-testkit/src/index.ts`
- Create: `packages/shared-testkit/test/water-fixtures.test.ts`
- Create: `packages/water-core/src/water-snapshot.ts`
- Modify: `packages/water-core/src/index.ts`
- Create: `packages/water-core/test/water-snapshot.test.ts`

**Interfaces:**
- Consumes: `TerrainSnapshot`, `WorldConfig`, `CELL_TRIANGLES`, `selectTerrainDiagonal()`, Task 1 clipping functions.
- Produces: `WaterSnapshot`, `deriveWaterSnapshot()`, `triangleIndexFor()`, deterministic shared Water Terrain fixtures.

- [ ] **Step 1: Add deterministic shared fixture builders**

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

Build each fixture from a level-2 lattice and set exact rectangular/diagonal level-0 and level-1 regions. Use `createTerrainMap()` with stable seeds `7001..7010`, `generationAttempt: 0`, and `revision: 1`.

- [ ] **Step 2: Write failing connectivity tests**

```ts
import { createWaterFixture } from '@web-three-city/shared-testkit';
import { describe, expect, it } from 'vitest';
import { deriveWaterSnapshot } from '../src/index.js';
import { WORLD_CONFIG } from '@web-three-city/world-core';

describe('deriveWaterSnapshot', () => {
  it.each([
    ['water-straight-coast', true],
    ['water-enclosed-basin', false],
    ['water-open-channel', true],
    ['water-corner-contact', false],
  ] as const)('%s applies exact south-edge connectivity', (name, hasSea) => {
    const fixture = createWaterFixture(name);
    const result = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.seaTriangleCount > 0).toBe(hasSea);
    expect(result.value.enclosedWetTriangleCount).toBe(
      fixture.expectedEnclosedWetTriangleCount,
    );
  });

  it('is byte deterministic', () => {
    const fixture = createWaterFixture('water-bay');
    const first = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
    const second = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
    expect(first).toEqual(second);
  });
});
```

Add validation tests for wrong dimensions, wrong lattice length, negative revision, and sea level outside `[minHeightLevel, maxHeightLevel]`.

- [ ] **Step 3: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/shared-testkit test -- water-fixtures.test.ts
pnpm --filter @web-three-city/water-core test -- water-snapshot.test.ts
```

Expected: FAIL because fixtures and `deriveWaterSnapshot()` do not exist.

- [ ] **Step 4: Implement WaterSnapshot contract**

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

- [ ] **Step 5: Implement canonical graph derivation**

For every cell in z-major then x-major order:

1. read `nw/ne/sw/se` levels;
2. call `selectTerrainDiagonal()`;
3. iterate `CELL_TRIANGLES[diagonal]` in array order;
4. create positive-area wet fragments;
5. register wet intervals against canonical undirected lattice-edge keys;
6. connect fragments only when two intervals on the same edge overlap by more than `1e-9`;
7. seed fragments whose south-boundary interval has positive length;
8. breadth-first search neighbors in ascending triangle-index order;
9. set one byte per canonical triangle to `1` only for reachable sea fragments.

```ts
export function deriveWaterSnapshot(
  terrain: TerrainSnapshot,
  config: WorldConfig,
): Result<WaterSnapshot, WaterError>;
```

`shorelineSegmentCount` is the count of unique connected-sea boundary intervals excluding the south map boundary. Geometry coordinates are not stored in the snapshot.

- [ ] **Step 6: Verify GREEN and determinism**

```bash
pnpm --filter @web-three-city/shared-testkit test -- water-fixtures.test.ts
pnpm --filter @web-three-city/water-core test -- water-snapshot.test.ts
pnpm --filter @web-three-city/water-core test:coverage
pnpm --filter @web-three-city/water-core typecheck
```

Expected: all tests PASS for straight coast, both diagonals, basin, open channel, corner contact, and deterministic bytes.

- [ ] **Step 7: Commit**

```bash
git add packages/shared-testkit packages/water-core
git commit -m "feat(water): derive deterministic south-edge sea"
```

---

### Task 3: Chunk-local Water surface, shoreline ribbon, and diorama wall meshes

**Files:**
- Create: `packages/water-core/src/mesh-data.ts`
- Create: `packages/water-core/src/water-chunk-mesher.ts`
- Create: `packages/water-core/src/water-wall-mesher.ts`
- Modify: `packages/water-core/src/index.ts`
- Create: `packages/water-core/test/water-chunk-mesher.test.ts`
- Create: `packages/water-core/test/water-wall-mesher.test.ts`

**Interfaces:**
- Consumes: `TerrainSnapshot`, `WaterSnapshot`, `ChunkCoord`, `WorldConfig`, Task 1 clipping, Task 2 sea mask.
- Produces: `WaterChunkMeshData`, `WaterWallMeshData`, `buildWaterChunkMesh()`, `buildWaterWallMesh()`.

- [ ] **Step 1: Write failing chunk geometry tests**

```ts
import { createWaterFixture } from '@web-three-city/shared-testkit';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  buildWaterChunkMesh,
  deriveWaterSnapshot,
} from '../src/index.js';

it('builds finite upward-facing Uint16 surface geometry', () => {
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

it('rejects a stale Water snapshot', () => {
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

Add seam tests that compare sorted boundary vertices from adjacent chunks exactly, shoreline-key uniqueness tests, zero-area rejection tests, index-range tests, and the level-1 shallow color versus level-0 deep color test.

- [ ] **Step 2: Write failing Water-wall tests**

```ts
it('builds only connected south-boundary wall intervals to the base', () => {
  const fixture = createWaterFixture('water-south-wall');
  const water = deriveWaterSnapshot(fixture.terrain, WORLD_CONFIG);
  expect(water.ok).toBe(true);
  if (!water.ok) return;
  const wall = buildWaterWallMesh(fixture.terrain, water.value, WORLD_CONFIG);
  expect(wall.segmentCount).toBeGreaterThan(0);
  expect(wall.bounds.min.y).toBe(WORLD_CONFIG.dioramaBaseY);
  expect(wall.bounds.max.y).toBeCloseTo(0.51, 8);
  expect([...wall.positions].every(Number.isFinite)).toBe(true);
});
```

Add a fixture assertion that south-boundary land creates no wall segment.

- [ ] **Step 3: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/water-core test -- water-chunk-mesher.test.ts water-wall-mesher.test.ts
```

Expected: FAIL because mesh contracts and builders do not exist.

- [ ] **Step 4: Implement immutable mesh contracts**

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

- [ ] **Step 5: Implement Water surface and color generation**

For each sea-marked canonical triangle owned by the requested chunk:

- rerun exact clipping from Task 1;
- place every surface vertex at `seaLevel * heightStep + 0.010`;
- emit upward normals `[0, 1, 0]`;
- compute `depthLevels = seaLevel - terrainLevel`;
- interpolate shallow color `[0.36, 0.76, 0.86]` to deep color `[0.06, 0.28, 0.55]` using `clamp(depthLevels, 0, 1)`;
- triangulate a clipped quad as `[0,1,2, 0,2,3]` while preserving upward winding.

Build each unique non-south shoreline segment into a `0.35 * cellSize` ribbon at Water Y `+0.013`. Clip ribbon output to the owning cell's chunk and deduplicate using a canonical endpoint key with coordinates quantized to `1e-9`.

Before returning, reject vertex counts above `65_535`, non-finite values, out-of-range indices, and zero-area triangles.

- [ ] **Step 6: Implement south Water wall**

Merge adjacent collinear connected sea intervals on the south boundary. Emit one quad per merged interval:

```text
top Y    = seaLevel * heightStep + 0.010
bottom Y = dioramaBaseY
z        = south boundary world Z + 0.010
normal   = [0, 0, 1]
```

Use lighter top vertex colors and darker base vertex colors. Never emit north/east/west walls or wall behind south-boundary land.

- [ ] **Step 7: Verify GREEN and geometry invariants**

```bash
pnpm --filter @web-three-city/water-core test -- water-chunk-mesher.test.ts water-wall-mesher.test.ts
pnpm --filter @web-three-city/water-core test:coverage
pnpm --filter @web-three-city/water-core typecheck
pnpm --filter @web-three-city/water-core build
```

Expected: all geometry, seam, revision, capacity, and wall tests PASS.

- [ ] **Step 8: Commit**

```bash
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
- Create: `packages/water-three/src/water-presentation.ts`
- Create: `packages/water-three/src/index.ts`
- Create: `packages/water-three/test/geometry-adapter.test.ts`
- Create: `packages/water-three/test/water-presentation.test.ts`

**Interfaces:**
- Consumes: Task 3 mesh data, Three.js `Scene`, `TerrainSnapshot`, `WaterSnapshot`, `WorldConfig`.
- Produces: `createWaterSurfaceGeometry()`, `createShorelineGeometry()`, `createWaterWallGeometry()`, `createWaterMaterials()`, `WaterPresentationSource`, `WaterPresentation`.

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
it('maps typed arrays without copying semantic values', () => {
  const geometry = createWaterSurfaceGeometry(sampleChunk);
  expect(geometry.getAttribute('position').array).toBe(sampleChunk.surfacePositions);
  expect(geometry.getAttribute('normal').array).toBe(sampleChunk.surfaceNormals);
  expect(geometry.getAttribute('color').array).toBe(sampleChunk.surfaceColors);
  expect(geometry.getIndex()?.array).toBe(sampleChunk.surfaceIndices);
});
```

- [ ] **Step 2: Write failing presentation lifecycle tests**

```ts
it('atomically replaces one Water root and disposes previous geometry', () => {
  const scene = new THREE.Scene();
  const source = createStubSource();
  const presentation = new WaterPresentation(scene, source, WORLD_CONFIG);
  presentation.load(terrainA, waterA);
  const firstRoot = presentation.object3d;
  const firstGeometry = (firstRoot.children[0] as THREE.Mesh).geometry;
  presentation.load(terrainB, waterB);
  expect(scene.children.filter((child) => child.name === 'water-presentation-root')).toHaveLength(1);
  expect(firstGeometry.getAttribute('position')).toBeUndefined();
});

it('keeps the previous root when staging fails', () => {
  const scene = new THREE.Scene();
  const source = createFailingSecondBuildSource();
  const presentation = new WaterPresentation(scene, source, WORLD_CONFIG);
  presentation.load(terrainA, waterA);
  const firstRoot = presentation.object3d;
  expect(() => presentation.load(terrainB, waterB)).toThrow('test:staged-build-failure');
  expect(presentation.object3d).toBe(firstRoot);
});
```

Add tests for one shared material set, exact object names/render orders, revision mismatch, repeated load, staged-geometry disposal, and idempotent `dispose()`.

- [ ] **Step 3: Run tests and verify RED**

```bash
pnpm install --frozen-lockfile
pnpm --filter @web-three-city/water-three test
```

Expected: FAIL because package exports and Water presentation do not exist.

- [ ] **Step 4: Implement geometry adapters and shared materials**

```ts
export interface WaterMaterials {
  readonly surface: THREE.MeshBasicMaterial;
  readonly shoreline: THREE.MeshBasicMaterial;
  readonly wall: THREE.MeshBasicMaterial;
  dispose(): void;
}
```

Material policy:

```ts
surface: {
  transparent: true,
  opacity: 0.78,
  depthTest: true,
  depthWrite: false,
  vertexColors: true,
  side: THREE.DoubleSide,
}
shoreline: {
  transparent: true,
  opacity: 0.82,
  depthTest: true,
  depthWrite: false,
  vertexColors: true,
  side: THREE.DoubleSide,
}
wall: {
  transparent: false,
  depthTest: true,
  depthWrite: true,
  vertexColors: true,
  side: THREE.DoubleSide,
}
```

- [ ] **Step 5: Implement atomic WaterPresentation**

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

export class WaterPresentation {
  constructor(
    scene: THREE.Scene,
    source: WaterPresentationSource,
    config: WorldConfig,
  );
  get object3d(): THREE.Group;
  load(terrain: TerrainSnapshot, water: WaterSnapshot): void;
  dispose(): void;
}
```

`load()` must build a detached staged root, add surface and shoreline meshes per non-empty chunk, add Water wall when non-empty, assign render orders `4/5/6`, then swap roots only after all adapters succeed. Dispose staged geometry on failure and previous geometry after successful swap. Do not expose `rebuild(chunks)`.

- [ ] **Step 6: Verify GREEN**

```bash
pnpm --filter @web-three-city/water-three test
pnpm --filter @web-three-city/water-three test:coverage
pnpm --filter @web-three-city/water-three typecheck
pnpm --filter @web-three-city/water-three build
```

Expected: adapter and lifecycle suites PASS with exactly one Water root.

- [ ] **Step 7: Commit**

```bash
git add packages/water-three pnpm-lock.yaml
git commit -m "feat(water): add atomic Three.js presentation"
```

---

### Task 5: Terrain Lab Water fixtures and visual inspection surface

**Files:**
- Modify: `apps/terrain-lab/package.json`
- Modify: `apps/terrain-lab/src/fixture-registry.ts`
- Modify: `apps/terrain-lab/src/bootstrap.ts`
- Modify: `apps/terrain-lab/src/style.css`
- Modify: `browser-tests/terrain-lab.spec.ts`

**Interfaces:**
- Consumes: shared Water fixtures, `deriveWaterSnapshot()`, `WaterPresentation`.
- Produces: ten query-selectable Water fixtures rendered in existing Terrain Lab and read-only fixture evidence.

- [ ] **Step 1: Write failing fixture-registry and browser tests**

```ts
for (const fixture of [
  'water-straight-coast',
  'water-diagonal-sw-ne',
  'water-diagonal-nw-se',
  'water-bay',
  'water-peninsula',
  'water-chunk-seam',
  'water-enclosed-basin',
  'water-open-channel',
  'water-corner-contact',
  'water-south-wall',
]) {
  test(`renders ${fixture}`, async ({ page }) => {
    await page.goto(`/?fixture=${fixture}`);
    await expect(page.locator('[data-testid="fixture-name"]')).toHaveText(fixture);
    await expect(page.locator('[data-testid="water-status"]')).toHaveText('Ready');
  });
}
```

Add a browser assertion that `water-enclosed-basin` reports `seaTriangleCount: 0` and a positive enclosed count, while `water-open-channel` reports a positive sea count.

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/terrain-lab build
pnpm exec playwright test browser-tests/terrain-lab.spec.ts --project=chromium
```

Expected: FAIL because Water fixture names and Water evidence are not registered.

- [ ] **Step 3: Integrate Water into Terrain Lab**

Add `@web-three-city/water-core` and `@web-three-city/water-three` dependencies. Resolve fixture Terrain through `createWaterFixture()`, derive Water, load Terrain then Water then Grid, and dispose in order `selection → grid → water → terrain → renderer`.

Publish read-only evidence:

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

Do not add a new app, route framework, or Water toggle.

- [ ] **Step 4: Verify GREEN and capture fixture screenshots locally or in CI**

```bash
pnpm --filter @web-three-city/terrain-lab typecheck
pnpm --filter @web-three-city/terrain-lab build
pnpm exec playwright test browser-tests/terrain-lab.spec.ts --project=chromium
```

Expected: all existing Terrain Lab tests and ten Water fixture tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/terrain-lab browser-tests/terrain-lab.spec.ts pnpm-lock.yaml
git commit -m "feat(water): add Terrain Lab Water fixtures"
```

---

### Task 6: Game boot, load, restoration, and disposal composition

**Files:**
- Modify: `apps/game/package.json`
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `apps/game/src/interaction-evidence.ts`
- Modify: `browser-tests/game.spec.ts`

**Interfaces:**
- Consumes: `deriveWaterSnapshot()`, `WaterPresentation`, existing Terrain/Grid/Selection/Input lifecycle.
- Produces: Water-enabled Game, deterministic Water evidence, unchanged Terrain save schema and interaction behavior.

- [ ] **Step 1: Write failing Game acceptance tests**

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

Add assertions that underwater click still updates selected Terrain cell, Grid remains visible when enabled, Reset preserves Water root count, and context restoration returns to one Water root.

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/game build
pnpm exec playwright test browser-tests/game.spec.ts --project=chromium
```

Expected: FAIL because Game evidence contains no Water and scene has no Water root.

- [ ] **Step 3: Compose boot lifecycle**

Boot sequence:

```ts
const generated = generateCoastalTerrain(...);
let snapshot = generated.value;
let waterSnapshot = unwrapWater(deriveWaterSnapshot(snapshot, WORLD_CONFIG));
terrain.load(snapshot);
water.load(snapshot, waterSnapshot);
grid.load(snapshot);
```

Create one `WaterPresentation` with a source that builds all 64 chunk meshes plus the south wall. Keep Water out of `terrainObjects` used by `pickTerrain()`.

- [ ] **Step 4: Compose Terrain load atomically at application level**

On valid `TerrainSaveV1` load:

1. derive `nextWater` before changing visible roots;
2. set `replacingWorld = true` so the render loop skips one replacement section;
3. load Terrain;
4. load Water;
5. load Grid;
6. rebuild Selection;
7. refresh Terrain raycast objects;
8. assign `snapshot` and `waterSnapshot`;
9. clear `replacingWorld` in `finally`.

If derivation fails, show `Invalid save` and preserve the previous visible world.

- [ ] **Step 5: Compose context restoration and disposal**

Context restoration order:

```text
terrain.load(snapshot)
water.load(snapshot, waterSnapshot)
grid.load(snapshot)
rebuildSelection(...)
input.refreshTerrainObjects()
```

Disposal order:

```text
input → selection → grid → water → terrain → renderer
```

- [ ] **Step 6: Extend read-only interaction evidence**

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

Evidence is read-only and may count scene roots and typed-array byte lengths. It must not expose mutation functions.

- [ ] **Step 7: Verify GREEN and interaction regression**

```bash
pnpm --filter @web-three-city/game typecheck
pnpm --filter @web-three-city/game build
pnpm exec playwright test browser-tests/game.spec.ts browser-tests/interaction.spec.ts --project=chromium
```

Expected: Water tests and existing camera/selection/grid interaction tests PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/game browser-tests/game.spec.ts pnpm-lock.yaml
git commit -m "feat(water): integrate Water into the Game lifecycle"
```

---

### Task 7: Browser visual evidence and performance observations

**Files:**
- Create: `browser-tests/water.spec.ts`
- Modify: `browser-tests/helpers/interaction.ts`
- Modify: `browser-tests/visual-evidence.spec.ts`
- Create: `docs/evidence/water-shoreline-foundation-v0-1.md`

**Interfaces:**
- Consumes: Game and Terrain Lab Water evidence.
- Produces: deterministic screenshots, geometry hashes, timing observations, trace, and exact acceptance record.

- [ ] **Step 1: Write browser Water scenarios**

```ts
test.describe('Water and Shoreline Foundation', () => {
  test('desktop and mobile keep the complete coast framed', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expectWorldInsideUsableViewport(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectWorldInsideUsableViewport(page);
  });

  test('underwater selection and Grid remain readable', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Grid' }).click();
    await clickTerrainCell(page, { x: 64, z: 116 });
    const evidence = await page.evaluate(() => window.__WEB_THREE_CITY_INTERACTION__?.snapshot());
    expect(evidence?.gridVisible).toBe(true);
    expect(evidence?.selectedCell).toEqual({ x: 64, z: 116 });
    expect(evidence?.water?.waterRootCount).toBe(1);
  });
});
```

Include context loss/restore, save/load equality, camera pan/zoom/yaw/pitch/reset regression, enclosed-basin dry evidence, open-channel wet evidence, and south-wall evidence.

- [ ] **Step 2: Add deterministic screenshot sequence**

Capture named PNG files:

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

Enable Playwright trace for the passing Game interaction sequence and store screenshots/trace under `test-results/water-shoreline-foundation-v0-1/` so the existing CI artifact upload includes them.

- [ ] **Step 3: Record deterministic geometry hashes and timings**

Inside browser evidence, use `performance.now()` around Water derivation and presentation load only. Compute SHA-256 over ordered Water typed arrays using the existing shared-testkit hash helper or browser `crypto.subtle`.

Write JSON evidence containing:

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

Timings are observations, not assertions. Assert deterministic counts, hash format, finite non-negative durations, and root counts exactly `1`.

- [ ] **Step 4: Run browser evidence suite**

```bash
pnpm exec playwright test \
  browser-tests/water.spec.ts \
  browser-tests/visual-evidence.spec.ts \
  --project=chromium --trace=on
```

Expected: all Water browser tests PASS and ten screenshots plus trace plus JSON evidence exist.

- [ ] **Step 5: Write evidence document**

Record:

- exact implementation head SHA;
- CI run ID and job conclusions;
- browser test count;
- artifact ID and SHA-256 digest;
- Water mask and geometry hashes;
- deterministic counts;
- observed derivation/presentation timings;
- screenshot inventory;
- visual self-review findings;
- explicit statement that owner visual approval remains pending.

- [ ] **Step 6: Commit**

```bash
git add browser-tests docs/evidence/water-shoreline-foundation-v0-1.md
git commit -m "test(water): add browser acceptance and evidence"
```

---

### Task 8: Final scope audit, exact-head verification, and review handoff

**Files:**
- Modify only when verification finds a real defect in files already listed by Tasks 1–7.
- Finalize: `docs/evidence/water-shoreline-foundation-v0-1.md`.
- Update: PR description/checklist; do not add implementation scope.

**Interfaces:**
- Consumes: complete milestone.
- Produces: exact-head green verification and owner visual-review handoff.

- [ ] **Step 1: Run focused package gates**

```bash
pnpm --filter @web-three-city/water-core test:coverage
pnpm --filter @web-three-city/water-three test:coverage
pnpm --filter @web-three-city/water-core typecheck
pnpm --filter @web-three-city/water-three typecheck
pnpm --filter @web-three-city/terrain-lab build
pnpm --filter @web-three-city/game build
```

Expected: every command PASS.

- [ ] **Step 2: Run full repository verification**

```bash
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

- [ ] **Step 3: Run structural scope audit**

```bash
rg -n "lake|river|rain|flood|reflection|refraction|wave|buoyancy|WebGPU|chunkSignature|dirtyWater" \
  packages/water-core packages/water-three apps/game apps/terrain-lab
rg -n "from ['\"]three['\"]|document\.|window\." packages/water-core
rg -n "Water|water" packages/terrain-core packages/terrain-generator
```

Expected:

- first command returns only explicit exclusions, test names, or no matches; no deferred production subsystem exists;
- second command returns no matches;
- third command returns no matches, preserving Terrain → Water dependency direction.

- [ ] **Step 4: Verify save and scene ownership**

```bash
rg -n "TerrainSaveV2|WaterSave|water.*localStorage|localStorage.*water" .
rg -n "water-presentation-root" packages/water-three apps/game apps/terrain-lab browser-tests
```

Expected: no Water save schema or Water Local Storage bytes; Water root name appears only in presentation, composition diagnostics, and tests.

- [ ] **Step 5: Review exact PR diff**

Confirm the changed-file list contains only:

- `water-core`;
- `water-three`;
- shared Water fixtures;
- Terrain Lab integration;
- Game integration;
- browser tests/evidence;
- required workspace lockfile/config changes.

Reject unrelated camera, Terrain topology, generator, save-schema, UI-feature, or rendering refactors.

- [ ] **Step 6: Push final head and verify GitHub Actions**

```bash
git status --short
git diff --check
git push
```

Wait for the exact-head CI run. Require all four jobs to pass:

```text
Quality and provenance
Unit, geometry, and golden tests
Build all packages and applications
Chromium smoke, interaction, and visual evidence
```

- [ ] **Step 7: Update PR to Ready for Review**

PR description must include:

- specification and plan accepted;
- Tasks 1–8 checked;
- exact base/head SHAs;
- CI run number and ID;
- Water test count;
- browser test count;
- artifact ID/digest;
- deterministic hashes/counts/timing observations;
- open review-thread count;
- owner visual approval pending;
- automatic merge not authorized.

- [ ] **Step 8: Commit documentation-only final descendant when needed**

```bash
git add docs/evidence/water-shoreline-foundation-v0-1.md
git commit -m "docs(water): finalize Water acceptance evidence"
git push
```

If this creates a documentation-only descendant, require the full CI suite to pass on that descendant before requesting owner visual approval.

---

## Completion Definition

Implementation is complete only when all eight tasks are checked, exact-head CI passes all four jobs, deterministic screenshots/counts/hashes/timing observations are recorded, Water remains derived and south-edge-connected, enclosed basins remain dry, shoreline has no visible chunk seams, the south Water wall reaches the diorama base without overshoot, Grid and Selection remain readable through Water, save/load and context restoration leave one Water root, and the repository owner approves the visual result before merge.