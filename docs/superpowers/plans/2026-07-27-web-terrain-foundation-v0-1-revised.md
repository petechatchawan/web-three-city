# Web Terrain Foundation v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the accepted deterministic, chunked, mobile-first browser terrain foundation for Web Three City, using the Unity shared-vertex terrain rules and a Three.js WebGL2 presentation.

**Architecture:** Pure TypeScript packages own world coordinates, terrain state, deterministic generation, topology, meshing, canonical normals, serialization, and invalidation. Three.js is confined to presentation and interaction adapters; `TerrainMap` is authoritative and scene objects are replaceable derived state. The milestone finishes with Coastal, Shape Atlas, Chunk Seam, Boundary Skirt, and Picking fixtures, automated gates, performance evidence, and owner visual review.

**Tech Stack:** Node.js 22+, pnpm 10, TypeScript strict mode, Vite, Three.js WebGL2, Vitest, Playwright, ESLint flat config, Prettier, GitHub Actions.

## Global Constraints

- Approved specification: `docs/superpowers/specs/2026-07-27-web-terrain-foundation-v0-1-design.md`.
- Owner approval date: `2026-07-27`.
- Normative Unity topology source: `petechatchawan/cityBuilder@19b29e32cb24ed7535fc08aafbd6a7ffe6b1daeb`, `docs/terrain/terrain-architecture-lab-implementation-packet-v0.1.md`.
- Manually transcribe only accepted rules and authored fixture data from the user's Unity project. Do not copy Unity production source, generated assets, class structure, or scene files.
- Do not copy production source, assets, or Micropolis-derived code from `lo-th/3d.city`.
- Map: `128 × 128` cells; height lattice: `129 × 129`; chunks: `8 × 8`; each chunk: `16 × 16` cells.
- `CELL_SIZE = 1.0`, `HEIGHT_STEP = 0.5`, height levels `0..4`, `SEA_LEVEL = 1`, `DIORAMA_BASE_Y = -1.5`.
- Axes: `+X east`, `+Z south`, `+Y up`; arrays are row-major.
- Core packages must not import Three.js, DOM APIs, browser event types, Vite APIs, or application UI code.
- Each cell emits exactly two upward-wound, non-degenerate top triangles.
- Interior vertical faces are forbidden. Vertical terrain geometry is allowed only at the outer diorama boundary.
- Accepted diagonal rule: select the sole equal opposite-corner pair; otherwise select the smaller absolute endpoint delta; equal deltas select `SW-NE`; checkerboard/parity selection is forbidden everywhere.
- Duplicate presentation vertices at chunk seams must receive identical canonical positions and normals.
- WebGL2 is required. WebGPU, Water, Hydrology, Terraform, Roads, Zones, Buildings, economy, and simulation are excluded.
- Generation, topology, meshing, serialization, fixture data, and ordered outputs must be deterministic.
- Every implementation task follows RED → verify RED → minimal GREEN → focused regression → commit.
- The implementation PR stays Draft and must not be merged until automated gates and human visual review pass.

---

## Repository File Map

```text
.github/workflows/ci.yml
.gitignore
.prettierignore
.prettierrc.json
eslint.config.js
package.json
playwright.config.ts
pnpm-workspace.yaml
tsconfig.base.json
vitest.workspace.ts

apps/game/
  index.html
  package.json
  src/main.ts
  src/style.css
  vite.config.ts

apps/terrain-lab/
  index.html
  package.json
  src/bootstrap.ts
  src/fixture-registry.ts
  src/lab-controller.ts
  src/main.ts
  src/style.css
  src/ui/debug-panel.ts
  src/ui/fixture-menu.ts
  vite.config.ts

packages/world-core/
  package.json
  src/config.ts
  src/coordinates.ts
  src/errors.ts
  src/index.ts
  src/result.ts
  test/config.test.ts
  test/coordinates.test.ts

packages/terrain-core/
  package.json
  src/canonical-normals.ts
  src/chunk-mesher.ts
  src/chunking.ts
  src/dirty-region.ts
  src/height-lattice.ts
  src/index.ts
  src/mesh-data.ts
  src/outer-skirt-mesher.ts
  src/serialization.ts
  src/shape-classifier.ts
  src/terrain-map.ts
  src/topology.ts
  src/validation.ts
  test/*.test.ts

packages/terrain-generator/
  package.json
  src/coastal-config.ts
  src/coastal-fields.ts
  src/coastal-generator.ts
  src/constraint-projection.ts
  src/index.ts
  src/prng.ts
  src/statistics.ts
  test/*.test.ts

packages/terrain-three/
  package.json
  src/chunk-geometry-adapter.ts
  src/index.ts
  src/material-factory.ts
  src/outer-skirt-presentation.ts
  src/terrain-presentation.ts
  src/webgl-capability.ts
  test/*.test.ts

packages/camera-input/
  package.json
  src/gesture-controller.ts
  src/index.ts
  src/orthographic-camera-rig.ts
  src/terrain-picker.ts
  test/*.test.ts

packages/shared-testkit/
  package.json
  src/fixtures/chunk-seam.ts
  src/fixtures/coastal.ts
  src/fixtures/shape-atlas.ts
  src/fixtures/topology-cases.ts
  src/hash.ts
  src/index.ts
  src/mesh-assertions.ts
  test/*.test.ts

browser-tests/game.spec.ts
browser-tests/terrain-lab.spec.ts
docs/architecture/unity-terrain-topology-provenance.md
docs/evidence/web-terrain-foundation-v0-1.md
```

---

### Task 1: Scaffold the strict pnpm workspace and prove package boundaries

**Files:**
- Create: root configuration files
- Create: every app/package `package.json`
- Create: `packages/world-core/test/config.test.ts`
- Create: `packages/world-core/src/config.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: none
- Produces: workspace scripts `build`, `typecheck`, `lint`, `format:check`, `test`, `test:coverage`, `test:browser`, `check`; package namespace `@web-three-city/*`

- [ ] **Step 1: Create workspace manifests before installing dependencies**

Root `package.json`:

```json
{
  "name": "web-three-city",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "build": "pnpm -r --if-present build",
    "typecheck": "pnpm -r --if-present typecheck",
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "test": "vitest run --workspace vitest.workspace.ts",
    "test:coverage": "vitest run --coverage --workspace vitest.workspace.ts",
    "test:browser": "playwright test",
    "check": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

Each library package uses `type: module`, exports `./src/index.ts` during development, and defines `test`, `typecheck`, and `build` scripts. Apps depend on packages through `workspace:*`.

- [ ] **Step 2: Install and lock tooling**

```bash
corepack enable
corepack use pnpm@10
pnpm add -Dw typescript vite vitest @vitest/coverage-v8 eslint @eslint/js typescript-eslint prettier @playwright/test happy-dom
pnpm --filter @web-three-city/terrain-three add three
pnpm --filter @web-three-city/camera-input add three
pnpm --filter @web-three-city/game add three
pnpm --filter @web-three-city/terrain-lab add three
```

Commit the generated `pnpm-lock.yaml`; all subsequent CI installs use `--frozen-lockfile`.

- [ ] **Step 3: Configure strict TypeScript and boundary linting**

`tsconfig.base.json` must enable:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "useUnknownInCatchVariables": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true
  }
}
```

ESLint must reject imports of `three`, DOM globals, `apps/*`, and `terrain-three` from `world-core`, `terrain-core`, and `terrain-generator`.

- [ ] **Step 4: Write the first failing test**

```ts
// packages/world-core/test/config.test.ts
import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '../src/config.js';

describe('WORLD_CONFIG', () => {
  it('locks the accepted world constants', () => {
    expect(WORLD_CONFIG).toEqual({
      mapWidth: 128,
      mapHeight: 128,
      chunkSize: 16,
      cellSize: 1,
      heightStep: 0.5,
      minHeightLevel: 0,
      maxHeightLevel: 4,
      seaLevel: 1,
      dioramaBaseY: -1.5,
    });
  });
});
```

- [ ] **Step 5: Run the test and verify RED**

```bash
pnpm --filter @web-three-city/world-core test -- config.test.ts
```

Expected: FAIL because `src/config.ts` does not exist.

- [ ] **Step 6: Add the minimal accepted config**

```ts
export const WORLD_CONFIG = Object.freeze({
  mapWidth: 128,
  mapHeight: 128,
  chunkSize: 16,
  cellSize: 1,
  heightStep: 0.5,
  minHeightLevel: 0,
  maxHeightLevel: 4,
  seaLevel: 1,
  dioramaBaseY: -1.5,
});

export type WorldConfig = Readonly<typeof WORLD_CONFIG>;
```

- [ ] **Step 7: Verify workspace foundations**

```bash
pnpm --filter @web-three-city/world-core test -- config.test.ts
pnpm format:check
pnpm lint
pnpm typecheck
```

Expected: all exit `0`.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "chore: scaffold strict web terrain workspace"
```

---

### Task 2: Implement world coordinates, indexing, bounds, and typed errors

**Files:**
- Create: `packages/world-core/src/coordinates.ts`
- Create: `packages/world-core/src/errors.ts`
- Create: `packages/world-core/src/result.ts`
- Create: `packages/world-core/src/index.ts`
- Create: `packages/world-core/test/coordinates.test.ts`

**Interfaces:**
- Consumes: `WorldConfig`
- Produces: `CellCoord`, `GridVertexCoord`, `WorldPoint`, `cellIndex`, `vertexIndex`, `vertexToWorld`, `worldToCell`, `WorldContractError`, `Result<T, E>`

- [ ] **Step 1: Write RED coordinate tests**

```ts
it('uses row-major indexing', () => {
  expect(cellIndex({ x: 3, z: 2 }, WORLD_CONFIG)).toBe(259);
  expect(vertexIndex({ x: 3, z: 2 }, WORLD_CONFIG)).toBe(261);
});

it('centers lattice vertex 64,64 at the scene origin', () => {
  expect(vertexToWorld({ x: 64, z: 64 }, 2, WORLD_CONFIG)).toEqual({
    x: 0,
    y: 1,
    z: 0,
  });
});

it('rejects points outside the map instead of silently clamping', () => {
  expect(() => worldToCell({ x: -65, y: 0, z: 0 }, WORLD_CONFIG)).toThrowError(
    expect.objectContaining({ code: 'world:outside-map' }),
  );
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/world-core test -- coordinates.test.ts
```

Expected: FAIL with missing exports.

- [ ] **Step 3: Implement immutable numeric contracts**

```ts
export interface CellCoord { readonly x: number; readonly z: number }
export interface GridVertexCoord { readonly x: number; readonly z: number }
export interface WorldPoint { readonly x: number; readonly y: number; readonly z: number }

export function cellIndex(coord: CellCoord, config: WorldConfig): number {
  assertCellCoord(coord, config);
  return coord.z * config.mapWidth + coord.x;
}

export function vertexIndex(coord: GridVertexCoord, config: WorldConfig): number {
  assertGridVertexCoord(coord, config);
  return coord.z * (config.mapWidth + 1) + coord.x;
}

export function vertexToWorld(
  coord: GridVertexCoord,
  heightLevel: number,
  config: WorldConfig,
): WorldPoint {
  assertGridVertexCoord(coord, config);
  return {
    x: (coord.x - config.mapWidth / 2) * config.cellSize,
    y: heightLevel * config.heightStep,
    z: (coord.z - config.mapHeight / 2) * config.cellSize,
  };
}
```

`worldToCell` normalizes X/Z, floors them, validates `0..127`, and throws `WorldContractError` outside the map.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @web-three-city/world-core test
pnpm --filter @web-three-city/world-core typecheck
git add packages/world-core
git commit -m "feat(world): add coordinate and indexing contracts"
```

---

### Task 3: Implement authoritative terrain state, validation, and save round-trip

**Files:**
- Create: `packages/terrain-core/src/height-lattice.ts`
- Create: `packages/terrain-core/src/terrain-map.ts`
- Create: `packages/terrain-core/src/validation.ts`
- Create: `packages/terrain-core/src/serialization.ts`
- Create: `packages/terrain-core/src/index.ts`
- Create: focused tests

**Interfaces:**
- Consumes: world configuration and lattice indexing
- Produces: `HeightLattice`, `TerrainMap`, `TerrainSnapshot`, `createTerrainMap`, `validateTerrainMap`, `encodeTerrainSaveV1`, `decodeTerrainSaveV1`

- [ ] **Step 1: Write RED state tests**

```ts
it('stores exactly one value per shared lattice vertex', () => {
  const lattice = HeightLattice.filled(WORLD_CONFIG, 2);
  expect(lattice.length).toBe(129 * 129);
  expect(lattice.get({ x: 128, z: 128 })).toBe(2);
});

it('uses copy-on-write mutation', () => {
  const before = HeightLattice.filled(WORLD_CONFIG, 2);
  const after = before.withHeight({ x: 8, z: 8 }, 3);
  expect(before.get({ x: 8, z: 8 })).toBe(2);
  expect(after.get({ x: 8, z: 8 })).toBe(3);
});

it('round-trips byte-identical lattice data', () => {
  const map = createTerrainMap({
    config: WORLD_CONFIG,
    seed: 1464156977,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 0,
    heightLevels: new Uint8Array(129 * 129).fill(2),
  });
  const decoded = decodeTerrainSaveV1(encodeTerrainSaveV1(map));
  expect(decoded.ok).toBe(true);
  if (decoded.ok) expect(decoded.value.heightLevels).toEqual(map.heightLevels);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-core test -- height-lattice.test.ts validation.test.ts serialization.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `HeightLattice`**

The constructor remains private. `from` validates exact length and copies bytes. `withHeight` validates integer range `0..4`, copies once, changes one index, and returns a new instance. `toUint8Array()` always returns a copy.

- [ ] **Step 4: Implement full validation**

Stable issue codes:

```ts
export type TerrainValidationIssueCode =
  | 'terrain:invalid-lattice-length'
  | 'terrain:invalid-height-range'
  | 'terrain:non-integer-height'
  | 'terrain:neighbor-delta-exceeded';
```

Scan east and south lattice neighbors exactly once. Reject any cardinal delta greater than `1`.

- [ ] **Step 5: Implement defensive serialization**

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

Validate schema, dimensions, integer metadata, Base64 syntax, and decoded byte length before constructing typed state. Load the full lattice; never regenerate from seed.

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-core test -- height-lattice.test.ts validation.test.ts serialization.test.ts
pnpm --filter @web-three-city/terrain-core typecheck
git add packages/terrain-core
git commit -m "feat(terrain): add authoritative lattice and save contracts"
```

---

### Task 4: Lock Unity topology provenance, diagonal selection, and Shape Atlas classification

**Files:**
- Create: `docs/architecture/unity-terrain-topology-provenance.md`
- Create: `packages/terrain-core/src/topology.ts`
- Create: `packages/terrain-core/src/shape-classifier.ts`
- Create: `packages/shared-testkit/src/fixtures/topology-cases.ts`
- Create: `packages/shared-testkit/src/fixtures/shape-atlas.ts`
- Create: focused tests

**Interfaces:**
- Consumes: exact accepted Unity document at commit `19b29e32...`
- Produces: `TerrainCorners`, `TerrainDiagonal`, `selectTerrainDiagonal`, `CELL_TRIANGLES`, `TerrainShape`, `classifyTerrainShape`, fixtures F-01 through F-12

- [ ] **Step 1: Record exact provenance before source code**

The provenance document must contain:

```text
Corner order: [NW, NE, SW, SE]
Pair A: SW-NE
Pair B: NW-SE
Sole equal pair: select it
Both or neither equal: select smaller absolute endpoint delta
Equal deltas: select SW-NE
Superseded: checkerboard/parity selection
```

State explicitly that rules and fixture values were manually transcribed and no Unity source code or asset was copied.

- [ ] **Step 2: Write RED diagonal tests**

```ts
const CASES = [
  [{ nw: 0, ne: 1, sw: 1, se: 2 }, 'sw-ne'],
  [{ nw: 2, ne: 1, sw: 0, se: 2 }, 'nw-se'],
  [{ nw: 1, ne: 0, sw: 0, se: 1 }, 'sw-ne'],
  [{ nw: 0, ne: 1, sw: 1, se: 0 }, 'sw-ne'],
  [{ nw: 0, ne: 4, sw: 1, se: 2 }, 'nw-se'],
  [{ nw: 0, ne: 3, sw: 1, se: 2 }, 'sw-ne'],
] as const;

it.each(CASES)('selects the accepted diagonal', (corners, expected) => {
  expect(selectTerrainDiagonal(corners)).toBe(expected);
});
```

- [ ] **Step 3: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-core test -- topology.test.ts shape-classifier.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement the selector exactly**

```ts
export type TerrainDiagonal = 'sw-ne' | 'nw-se';

export function selectTerrainDiagonal(c: TerrainCorners): TerrainDiagonal {
  const swNeEqual = c.sw === c.ne;
  const nwSeEqual = c.nw === c.se;
  if (swNeEqual !== nwSeEqual) return swNeEqual ? 'sw-ne' : 'nw-se';

  const swNeDelta = Math.abs(c.sw - c.ne);
  const nwSeDelta = Math.abs(c.nw - c.se);
  if (swNeDelta < nwSeDelta) return 'sw-ne';
  if (nwSeDelta < swNeDelta) return 'nw-se';
  return 'sw-ne';
}

export const CELL_TRIANGLES = {
  'sw-ne': [['sw', 'se', 'ne'], ['sw', 'ne', 'nw']],
  'nw-se': [['sw', 'se', 'nw'], ['se', 'ne', 'nw']],
} as const;
```

- [ ] **Step 5: Implement normalized shape classification**

Subtract the minimum corner before classification. Lock these signatures:

```ts
const SIGNATURE_TO_SHAPE = new Map<string, TerrainShape>([
  ['0,0,0,0', 'flat'],
  ['1,1,0,0', 'ramp-north'],
  ['0,0,1,1', 'ramp-south'],
  ['0,1,0,1', 'ramp-east'],
  ['1,0,1,0', 'ramp-west'],
  ['1,0,0,0', 'single-corner-high-nw'],
  ['0,1,0,0', 'single-corner-high-ne'],
  ['0,0,1,0', 'single-corner-high-sw'],
  ['0,0,0,1', 'single-corner-high-se'],
  ['0,1,1,1', 'single-corner-low-nw'],
  ['1,0,1,1', 'single-corner-low-ne'],
  ['1,1,0,1', 'single-corner-low-sw'],
  ['1,1,1,0', 'single-corner-low-se'],
  ['1,0,0,1', 'diagonal-ridge'],
  ['0,1,1,0', 'diagonal-valley'],
]);
```

Normalized range greater than `1` returns `severe-delta`; any unmatched legal range-1 signature returns `saddle-or-twist`.

- [ ] **Step 6: Add twelve authored fixtures**

Create deterministic F-01 Flat, F-02 Single Raised Vertex, F-03 Single Lowered Vertex translated to non-negative levels, F-04 Cardinal Ramp Band, F-05 Raised Plateau, F-06 Diagonal Ridge, F-07 Diagonal Valley, F-08 Basin, F-09 Staircase, F-10 Saddle/Twist, F-11 Chunk Seam, and F-12 Map Boundary Skirt. Each fixture contains an exact `8 × 8` `Uint8Array`, expected notable shapes, expected notable diagonals, and provenance metadata. Random fixture creation is prohibited.

- [ ] **Step 7: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-core test -- topology.test.ts shape-classifier.test.ts
pnpm --filter @web-three-city/shared-testkit test
git add docs/architecture packages/terrain-core packages/shared-testkit
git commit -m "feat(terrain): lock Unity topology and shape atlas"
```

---

### Task 5: Implement an exact cross-runtime PRNG

**Files:**
- Create: `packages/terrain-generator/src/prng.ts`
- Create: `packages/terrain-generator/test/prng.test.ts`

**Interfaces:**
- Consumes: integer seed
- Produces: `Xoshiro128StarStar.fromSeed`, `nextUint32`, `nextFloat`, `mix32`

- [ ] **Step 1: Write the fixed golden-vector test**

The seed expander is four sequential SplitMix32 calls. One SplitMix32 call is exactly:

```ts
state = (state + 0x9e3779b9) >>> 0;
let z = state;
z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
value = (z ^ (z >>> 15)) >>> 0;
```

For seed `1464156977`, the four initial xoshiro states are:

```ts
[255867800, 3128131530, 524467404, 294713318]
```

The first ten `nextUint32()` outputs must be:

```ts
[
  649806818,
  73000058,
  692524748,
  1076210427,
  405454374,
  760682335,
  4239989478,
  2908641902,
  2471686944,
  4189602194,
]
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-generator test -- prng.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement unsigned xoshiro128\*\***

```ts
function rotl(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

nextUint32(): number {
  const result = Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
  const t = (this.s1 << 9) >>> 0;
  this.s2 ^= this.s0;
  this.s3 ^= this.s1;
  this.s1 ^= this.s2;
  this.s0 ^= this.s3;
  this.s2 ^= t;
  this.s3 = rotl(this.s3, 11);
  this.s0 >>>= 0;
  this.s1 >>>= 0;
  this.s2 >>>= 0;
  this.s3 >>>= 0;
  return result;
}
```

`nextFloat()` returns `nextUint32() / 0x1_0000_0000`. Seed `0` is legal because SplitMix32 expands it into non-zero state.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-generator test -- prng.test.ts
git add packages/terrain-generator
git commit -m "feat(generator): add deterministic xoshiro prng"
```

---

### Task 6: Implement terrain statistics and Constraint-Aware Coastal Generator v1

**Files:**
- Create: all `packages/terrain-generator/src/*` except `prng.ts`
- Create: generator/statistics tests
- Create: `packages/shared-testkit/src/fixtures/coastal.ts`

**Interfaces:**
- Consumes: PRNG, `HeightLattice`, validation, shape/topology rules
- Produces: `TerrainStatistics`, `calculateTerrainStatistics`, `generateCoastalTerrain`, curated seed fixture

- [ ] **Step 1: Lock statistic definitions in RED tests**

Definitions:

- fully dry cell: all four corners `> seaLevel`;
- fully water-designated cell: all four corners `<= seaLevel`;
- shoreline cell: neither fully dry nor fully water-designated;
- flat buildable cell: all four corners equal and `> seaLevel`;
- landmass: cardinally connected fully dry cells;
- largest buildable square: largest axis-aligned square of flat buildable cells;
- level-4 plateau cell: all four corners equal `4`;
- isolated spike/pit: interior lattice vertex with all eight neighbors exactly one lower/higher.

- [ ] **Step 2: Write RED Coastal acceptance tests**

```ts
it('is byte-deterministic for the curated seed', () => {
  const a = generateCoastalTerrain({ seed: 1464156977, config: WORLD_CONFIG });
  const b = generateCoastalTerrain({ seed: 1464156977, config: WORLD_CONFIG });
  expect(a.ok).toBe(true);
  expect(b.ok).toBe(true);
  if (a.ok && b.ok) expect(a.value.heightLevels).toEqual(b.value.heightLevels);
});

it('meets every locked generation constraint', () => {
  const result = generateCoastalTerrain({ seed: 1464156977, config: WORLD_CONFIG });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const s = calculateTerrainStatistics(result.value, WORLD_CONFIG);
  expect(s.fullyWaterRatio).toBeGreaterThanOrEqual(0.18);
  expect(s.fullyWaterRatio).toBeLessThanOrEqual(0.22);
  expect(s.largestLandmassRatio).toBeGreaterThanOrEqual(0.72);
  expect(s.flatBuildableRatio).toBeGreaterThanOrEqual(0.30);
  expect(s.largestBuildableSquare).toBeGreaterThanOrEqual(24);
  expect(s.level4PlateauRatio).toBeLessThanOrEqual(0.12);
  expect(s.isolatedSpikeCount).toBe(0);
  expect(s.isolatedPitCount).toBe(0);
  expect(s.maxCardinalVertexDelta).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 3: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-generator test -- statistics.test.ts coastal-generator.test.ts constraint-projection.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement the v1 coastline field**

Locked base parameters:

```ts
export const COASTAL_V1 = Object.freeze({
  generatorVersion: 'coastal-v1' as const,
  maxAttempts: 16,
  baseCoastZ: 102,
  coastAmplitudeA: 7,
  coastAmplitudeB: 4,
  primaryPlateau: { centerX: 64, centerZ: 74, radiusX: 28, radiusZ: 20, level: 2 },
  centralPlateau: { centerX: 62, centerZ: 46, radiusX: 24, radiusZ: 18, level: 2 },
  secondaryPlateau: { centerX: 96, centerZ: 58, radiusX: 16, radiusZ: 14, level: 3 },
});
```

For each attempt, derive two phases from the PRNG and calculate:

```ts
coastZ(x) = round(
  102
  + 7 * sin((2 * PI * x) / 128 + phaseA)
  + 4 * sin((6 * PI * x) / 128 + phaseB)
  - 6 * gaussian(x, 40, 16)
  + 4 * gaussian(x, 92, 12)
);
```

Initial vertex levels by signed distance `d = coastZ(x) - z`:

```text
d < -8        → 0
d = -8..0     → 1
d = 1..22     → 2
d = 23..54    → 3
d > 54        → 4
```

Plateau ellipses override their interiors to their configured level and use a six-vertex smooth transition band. No per-vertex white noise is allowed.

- [ ] **Step 5: Implement deterministic constraint projection**

Repeatedly scan horizontal and vertical lattice edges. When a delta exceeds `1`, move only the higher endpoint down to `lower + 1`. Continue until a full pass makes no changes. Cap passes at `2 * (latticeWidth + latticeHeight)` and return `constraint-unsatisfied` if still changing. Remove isolated spikes/pits, then project once more.

- [ ] **Step 6: Implement candidate selection and typed errors**

```ts
export type TerrainGenerationErrorCode =
  | 'invalid-config'
  | 'constraint-unsatisfied'
  | 'insufficient-landmass'
  | 'insufficient-buildable-area'
  | 'invalid-height-range';
```

Attempt seed is:

```ts
mix32(seed ^ Math.imul(attempt + 1, 0x9e3779b9))
```

Return the first valid candidate and persist `generationAttempt`. Invalid terrain is never returned silently.

- [ ] **Step 7: Lock the curated SHA-256 hash**

Hash raw `heightLevels` bytes. Run generation in two fresh Node processes and require the same hash before committing it in `packages/shared-testkit/src/fixtures/coastal.ts`. A future hash change requires explicit generator-version or specification approval.

- [ ] **Step 8: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-generator test
pnpm --filter @web-three-city/shared-testkit test
git add packages/terrain-generator packages/shared-testkit
git commit -m "feat(generator): add constraint-aware coastal terrain v1"
```

---

### Task 7: Implement chunks and dirty-region invalidation

**Files:**
- Create: `packages/terrain-core/src/chunking.ts`
- Create: `packages/terrain-core/src/dirty-region.ts`
- Create: focused tests

**Interfaces:**
- Consumes: world configuration and coordinate contracts
- Produces: `ChunkCoord`, `ChunkCellBounds`, `allChunkCoords`, `chunkForCell`, `resolveDirtyChunks`

- [ ] **Step 1: Write RED tests**

```ts
it('enumerates exactly 64 chunks in row-major order', () => {
  const chunks = allChunkCoords(WORLD_CONFIG);
  expect(chunks).toHaveLength(64);
  expect(chunks[0]).toEqual({ x: 0, z: 0 });
  expect(chunks[63]).toEqual({ x: 7, z: 7 });
});

it('includes both chunks for a seam vertex change', () => {
  expect(resolveDirtyChunks({
    minVertexX: 16,
    minVertexZ: 8,
    maxVertexX: 16,
    maxVertexZ: 8,
  }, WORLD_CONFIG)).toEqual([{ x: 0, z: 0 }, { x: 1, z: 0 }]);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-core test -- chunking.test.ts dirty-region.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement ownership and normal halo**

Chunk `(x,z)` owns cells `[x*16, x*16+15] × [z*16, z*16+15]`. Expand changed lattice bounds by one vertex, clamp to `0..128`, convert affected cells to chunks, deduplicate by `z * 8 + x`, and return row-major sorted coordinates.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-core test -- chunking.test.ts dirty-region.test.ts
git add packages/terrain-core
git commit -m "feat(terrain): add chunk and dirty-region contracts"
```

---

### Task 8: Implement deterministic top-surface meshing and canonical normals

**Files:**
- Create: `packages/terrain-core/src/mesh-data.ts`
- Create: `packages/terrain-core/src/chunk-mesher.ts`
- Create: `packages/terrain-core/src/canonical-normals.ts`
- Create: corresponding tests
- Create: `packages/shared-testkit/src/mesh-assertions.ts`

**Interfaces:**
- Consumes: `TerrainSnapshot`, accepted topology, chunk bounds
- Produces: `TerrainChunkMeshData`, `CanonicalNormalField`, `buildCanonicalNormals`, `buildTerrainChunkMesh`

- [ ] **Step 1: Write RED geometry tests**

For every `16 × 16` chunk:

```ts
expect(mesh.positions.length / 3).toBe(17 * 17);
expect(mesh.indices.length).toBe(16 * 16 * 6);
expect(mesh.indices.length / 3).toBe(512);
expectNoDegenerateTriangles(mesh);
expectAllTrianglesUpward(mesh);
```

Assert known F-06/F-07 ties use `SW-NE`; a sole-equal `NW-SE` cell uses the `NW-SE` order.

- [ ] **Step 2: Write RED seam-normal tests**

Build F-11 as adjacent chunks. For every duplicated logical seam vertex, assert position equality and normal equality within `1e-6`.

- [ ] **Step 3: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-core test -- chunk-mesher.test.ts canonical-normals.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement canonical global normal accumulation**

Allocate a `Float64Array` of `latticeVertexCount * 3`. For each cell, select the accepted diagonal, calculate its two unnormalized face vectors, add each vector to its three canonical lattice vertices, then normalize into `Float32Array`. Zero-length accumulation throws `terrain:zero-normal`.

- [ ] **Step 5: Implement chunk meshing**

```ts
export interface TerrainChunkMeshData {
  readonly chunk: ChunkCoord;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint16Array;
  readonly bounds: Readonly<{ min: WorldPoint; max: WorldPoint }>;
}
```

Create `17 × 17` local vertices in row-major order, copy canonical normals by global lattice index, and emit exactly six indices per cell from `CELL_TRIANGLES`. Never emit an interior wall. Never call Three.js `computeVertexNormals()`.

- [ ] **Step 6: Add ordered byte-hash tests**

Repeated builds of the same snapshot/chunk must produce identical position, normal, color, and index bytes.

- [ ] **Step 7: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-core test -- chunk-mesher.test.ts canonical-normals.test.ts
pnpm --filter @web-three-city/shared-testkit test
git add packages/terrain-core packages/shared-testkit
git commit -m "feat(terrain): add chunk meshing and seam-safe normals"
```

---

### Task 9: Implement the separate outer diorama skirt

**Files:**
- Create: `packages/terrain-core/src/outer-skirt-mesher.ts`
- Create: `packages/terrain-core/test/outer-skirt-mesher.test.ts`

**Interfaces:**
- Consumes: terrain perimeter and `dioramaBaseY`
- Produces: `OuterSkirtMeshData`, `buildOuterSkirtMesh`

- [ ] **Step 1: Write RED boundary tests**

Assert `128` segments per side and `512` total, no interior segment, top positions exactly match perimeter terrain positions, bottom Y equals `-1.5`, winding faces outward, hard normals are separate, and repeated builds are byte-identical.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-core test -- outer-skirt-mesher.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement deterministic side ownership**

Emit sides in order `north`, `east`, `south`, `west`. Each side owns its 128 segments and duplicates corner vertices intentionally for hard normals. Emit four vertices and two triangles per segment. Do not emit a bottom cap in v0.1.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-core test -- outer-skirt-mesher.test.ts
git add packages/terrain-core
git commit -m "feat(terrain): add outer diorama skirt geometry"
```

---

### Task 10: Adapt pure mesh data into leak-safe Three.js presentation

**Files:**
- Create: all `packages/terrain-three/src/*`
- Create: all `packages/terrain-three/test/*`

**Interfaces:**
- Consumes: chunk and skirt mesh data
- Produces: `createChunkGeometry`, `TerrainPresentation`, `OuterSkirtPresentation`, `createTerrainMaterial`, `detectWebGL2`

- [ ] **Step 1: Write RED adapter/lifecycle tests**

Using happy-dom and disposable-resource spies, assert typed arrays are installed without semantic conversion, indices remain `Uint16Array`, replaced geometry is disposed exactly once, staged load failure leaves the old group visible, and repeated `dispose()` is safe.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-three test
```

Expected: FAIL.

- [ ] **Step 3: Implement geometry adaptation**

```ts
export function createChunkGeometry(data: TerrainChunkMeshData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
```

Do not call `computeVertexNormals()`.

- [ ] **Step 4: Implement atomic publication**

`load(snapshot)` creates all 64 chunk meshes plus skirt in a staging group. Publish only after all succeed, then dispose the old group. `rebuild(chunks)` builds all replacements first and swaps only requested chunks after all succeed.

- [ ] **Step 5: Implement simple materials and WebGL2 failure**

Terrain material: `MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 })`. Skirt material is separate and uses hard normals. `detectWebGL2` returns a typed unsupported result instead of throwing.

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-three test
pnpm --filter @web-three-city/terrain-three typecheck
git add packages/terrain-three
git commit -m "feat(three): add atomic terrain presentation"
```

---

### Task 11: Implement orthographic camera, gestures, and terrain picking

**Files:**
- Create: all `packages/camera-input/src/*`
- Create: all `packages/camera-input/test/*`

**Interfaces:**
- Consumes: Three.js camera/raycaster and world coordinate conversion
- Produces: `OrthographicCameraRig`, `GestureController`, `TerrainPickResult`, `pickTerrain`

- [ ] **Step 1: Write RED camera tests**

Assert initial yaw `45°`, pitch `55°`, rotations are exact `90°` increments, four rotations return to initial state, zoom clamps, reset restores defaults, and target remains within map bounds with restrained edge resistance.

- [ ] **Step 2: Write RED gesture tests**

Desktop: right/middle drag pans, wheel zooms, `Q/E` rotates, `Home` resets, left click is selection intent. Mobile viewer: one-finger drag pans, tap selects, pinch zooms, two-finger twist rotates, cancellation clears state without a tap.

- [ ] **Step 3: Write RED picking tests**

For both legal diagonals and all four camera rotations, assert exact cell, local U/V, nearest vertex, and world point. Replace chunk meshes and repeat to prove no mesh-name dependency.

- [ ] **Step 4: Run and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test
```

Expected: FAIL.

- [ ] **Step 5: Implement serializable camera state**

```ts
export interface CameraState {
  readonly targetX: number;
  readonly targetZ: number;
  readonly yawQuarterTurns: 0 | 1 | 2 | 3;
  readonly pitchDegrees: 55;
  readonly zoom: number;
}
```

Camera state is independent from DOM events. Gesture controller normalizes Pointer Events into semantic frames and owns pointer capture/arbitration.

- [ ] **Step 6: Implement world-derived picking**

```ts
export interface TerrainPickResult {
  readonly cellX: number;
  readonly cellZ: number;
  readonly localU: number;
  readonly localV: number;
  readonly nearestVertexX: number;
  readonly nearestVertexZ: number;
  readonly worldPoint: Readonly<{ x: number; y: number; z: number }>;
}
```

Raycast visible chunk meshes, use the nearest hit, convert world X/Z to grid coordinates, and derive nearest corner from U/V. Do not use mesh names or chunk `userData` to determine the cell.

- [ ] **Step 7: Verify and commit**

```bash
pnpm --filter @web-three-city/camera-input test
pnpm --filter @web-three-city/camera-input typecheck
git add packages/camera-input
git commit -m "feat(input): add camera gestures and terrain picking"
```

---

### Task 12: Build Terrain Lab and the minimal game shell

**Files:**
- Create: all `apps/terrain-lab/*`
- Create: all `apps/game/*`
- Create: both browser test files

**Interfaces:**
- Consumes: generator, fixtures, presentation, camera, picker, serialization
- Produces: deterministic diagnostic app and minimal Coastal product shell

- [ ] **Step 1: Write RED browser boot tests**

```ts
import { expect, test } from '@playwright/test';

test('boots CoastalFixture without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/terrain-lab/?fixture=coastal');
  await expect(page.getByTestId('fixture-name')).toHaveText('CoastalFixture');
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
```

Game tests cover boot, WebGL2 unsupported message, camera actions, save/reload, resize, and context restoration.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm build
pnpm test:browser
```

Expected: FAIL because apps are absent.

- [ ] **Step 3: Implement exact Terrain Lab fixture registry**

```ts
export type FixtureId =
  | 'coastal'
  | 'shape-atlas'
  | 'chunk-seam'
  | 'boundary-skirt'
  | 'picking';
```

Unknown fixture values fall back to `coastal` and show a non-fatal diagnostic. Add toggles for chunks, grid, diagonals, normals, height labels, selected cell/vertex, generator statistics, FPS, full-build duration, and dirty-rebuild duration.

- [ ] **Step 4: Implement the minimal game shell**

Mount curated Coastal terrain only. No gameplay tools. Quality policy:

```ts
export const QUALITY_TIERS = {
  low: { maxPixelRatio: 1, shadows: false },
  medium: { maxPixelRatio: 1.5, shadows: true },
  high: { maxPixelRatio: 2, shadows: true },
} as const;
```

Quality changes must not alter geometry, topology, picking, or save bytes.

- [ ] **Step 5: Implement save/load and context restoration**

Use localStorage key `web-three-city:terrain-save:v1`. The encoded full lattice is approximately 22 KB, within the milestone's bounded payload. On `webglcontextlost`, prevent default, pause rendering, retain the authoritative snapshot, and show status. On restoration, rebuild renderer resources and atomically reload the retained snapshot.

- [ ] **Step 6: Verify and commit**

```bash
pnpm build
pnpm test:browser
git add apps browser-tests
git commit -m "feat(app): add terrain lab and coastal game shell"
```

---

### Task 13: Add CI, exact-head evidence, performance reporting, and visual-review package

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/evidence/web-terrain-foundation-v0-1.md`
- Modify: `README.md`
- Modify: Draft PR body

**Interfaces:**
- Consumes: all completed implementation
- Produces: reproducible CI, artifacts, exact evidence, visual-review package

- [ ] **Step 1: Add CI jobs**

Jobs:

1. `quality`: `pnpm install --frozen-lockfile`, format, lint, typecheck;
2. `unit`: unit, geometry, golden, and coverage tests;
3. `build`: both Vite apps and dist artifacts;
4. `browser`: Chromium Playwright suite and report/screenshots;
5. `provenance`: scan production directories only for copied `3d.city`, Micropolis, or Unity source headers; documentation references are allowed.

Use PR-branch concurrency cancellation.

- [ ] **Step 2: Add non-blocking performance evidence**

Terrain Lab records:

```ts
interface PerformanceEvidence {
  readonly userAgent: string;
  readonly renderer: string;
  readonly sampleCount: number;
  readonly coastalGenerationMs: number;
  readonly fullMeshingMs: number;
  readonly gpuUploadMs: number;
  readonly dirtyChunkMedianMs: number;
  readonly dirtyChunkP95Ms: number;
  readonly averageFps: number;
}
```

Warm up before measurement. Report targets without failing v0.1 CI.

- [ ] **Step 3: Run the complete clean-checkout gate**

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build
pnpm test:browser
git diff --check
git status --short
```

All commands must exit `0`; no pass may be inferred from static inspection.

- [ ] **Step 4: Capture required screenshots from one exact head**

```text
coastal-overview.png
shape-atlas-overview.png
ramp-north.png
ramp-south.png
ramp-east.png
ramp-west.png
single-corner-high.png
single-corner-low.png
raised-plateau.png
basin.png
staircase.png
diagonal-ridge.png
diagonal-valley.png
saddle-twist.png
chunk-seam-closeup.png
outer-boundary-skirt.png
picking-four-rotations.png
```

- [ ] **Step 5: Record exact evidence**

Evidence document includes exact base/head SHA, Node/pnpm versions, lockfile hash, test counts, fixture hashes, geometry counts, browser versions, performance values, screenshot SHA-256 hashes, warnings, and `NOT RUN — device unavailable` when physical mobile evidence is unavailable.

- [ ] **Step 6: Re-run full verification after evidence changes**

```bash
pnpm check
pnpm test:coverage
pnpm test:browser
git diff --check
```

Expected: all exit `0`.

- [ ] **Step 7: Commit and update the Draft PR**

```bash
git add .github README.md docs/evidence package.json pnpm-lock.yaml
git commit -m "ci: verify Web Terrain Foundation v0.1"
```

PR body must include exact SHA evidence, topology provenance, no-copy declaration, changed-file boundary, curated seed/attempt/hash, automated results with exact counts, performance data, screenshot links/hashes, known limitations, explicit exclusions, merge status `not performed`, and human visual approval `pending`.

---

## Final Acceptance Checklist

- [ ] Curated Coastal terrain is deterministic and passes every generation constraint.
- [ ] Exact Unity diagonal rules are documented with commit-level provenance and covered by tests.
- [ ] Checkerboard/parity topology does not exist in production or diagnostics.
- [ ] Every cell emits exactly two upward, non-degenerate triangles.
- [ ] All 64 chunks have matching seam positions and canonical normals.
- [ ] Outer skirt exists only on the world perimeter and rebuilds deterministically.
- [ ] Desktop and touch camera behavior passes automated tests.
- [ ] Picking identifies the correct cell and nearest vertex under all four rotations and both diagonals.
- [ ] Dirty invalidation rebuilds only affected chunks plus canonical-normal dependencies.
- [ ] Save/load restores byte-identical height data and never regenerates from seed.
- [ ] WebGL2 unsupported and context-restoration paths preserve authoritative state.
- [ ] Format, lint, typecheck, unit, geometry, golden, build, and browser gates pass from a clean checkout.
- [ ] Exact-head evidence and screenshot hashes are recorded.
- [ ] Human visual approval passes before merge.
- [ ] Water, Hydrology, Terraform, Roads, Zones, Buildings, economy, simulation, and WebGPU remain excluded.
