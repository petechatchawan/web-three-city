# Web Terrain Foundation v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, chunked, mobile-first browser terrain foundation for Web Three City using the accepted Unity shared-vertex topology and a Three.js WebGL2 presentation.

**Architecture:** Platform-independent TypeScript packages own world coordinates, terrain state, generation, topology, normals, serialization, and invalidation. Three.js is isolated in presentation and interaction adapters; `TerrainMap` remains authoritative and GPU meshes remain disposable derived state. Implementation proceeds through strict TDD gates and produces Coastal, Shape Atlas, Chunk Seam, Boundary Skirt, and Picking fixtures before Water or Terraform begins.

**Tech Stack:** TypeScript strict mode, pnpm workspace, Vite, Three.js WebGL2, Vitest, Playwright, ESLint flat config, Prettier, GitHub Actions.

## Global Constraints

- Approved specification: `docs/superpowers/specs/2026-07-27-web-terrain-foundation-v0-1-design.md`.
- Normative Unity topology provenance: `petechatchawan/cityBuilder@19b29e32cb24ed7535fc08aafbd6a7ffe6b1daeb`, file `docs/terrain/terrain-architecture-lab-implementation-packet-v0.1.md`.
- Only topology rules and authored test data may be transcribed from the user's Unity project; do not copy Unity production source, generated assets, or implementation structure.
- Do not copy production source, assets, or Micropolis-derived code from `lo-th/3d.city`.
- Map size is exactly `128 × 128` cells with a `129 × 129` shared height lattice.
- Chunk size is exactly `16 × 16` cells, producing `8 × 8` chunks.
- `CELL_SIZE = 1.0`, `HEIGHT_STEP = 0.5`, height levels `0..4`, `SEA_LEVEL = 1`, and `DIORAMA_BASE_Y = -1.5`.
- World axes are `+X east`, `+Z south`, `+Y up`; cell and lattice arrays are row-major.
- Core packages must not import Three.js, DOM APIs, browser events, or Vite APIs.
- Every cell emits exactly two upward-wound, non-degenerate top triangles.
- Interior vertical faces are forbidden; vertical geometry is permitted only for the outer diorama skirt.
- Exact accepted diagonal rule: select the sole equal opposite-corner pair; otherwise select the smaller absolute endpoint delta; ties select `SW-NE`; checkerboard parity is forbidden.
- Duplicate chunk-edge presentation vertices must receive identical canonical positions and normals.
- WebGL2 is required; WebGPU, Water, Terraform, Roads, Zones, Buildings, and simulation are excluded.
- Generation, topology, meshing, serialization, and fixture outputs must be deterministic.
- Every production change follows RED → GREEN → focused regression → commit.
- Do not merge the implementation PR; human visual approval remains an explicit final gate.

---

## Planned File Map

```text
.github/workflows/ci.yml
.eslintignore
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
  src/chunking.ts
  src/dirty-region.ts
  src/height-lattice.ts
  src/index.ts
  src/mesh-data.ts
  src/serialization.ts
  src/shape-classifier.ts
  src/terrain-map.ts
  src/topology.ts
  src/validation.ts
  test/canonical-normals.test.ts
  test/chunking.test.ts
  test/dirty-region.test.ts
  test/height-lattice.test.ts
  test/serialization.test.ts
  test/shape-classifier.test.ts
  test/topology.test.ts
  test/validation.test.ts

packages/terrain-generator/
  package.json
  src/coastal-config.ts
  src/coastal-fields.ts
  src/coastal-generator.ts
  src/constraint-projection.ts
  src/index.ts
  src/prng.ts
  src/statistics.ts
  test/coastal-generator.test.ts
  test/constraint-projection.test.ts
  test/prng.test.ts
  test/statistics.test.ts

packages/terrain-three/
  package.json
  src/chunk-geometry-adapter.ts
  src/index.ts
  src/material-factory.ts
  src/outer-skirt-presentation.ts
  src/terrain-presentation.ts
  src/webgl-capability.ts
  test/chunk-geometry-adapter.test.ts
  test/outer-skirt-presentation.test.ts
  test/terrain-presentation.test.ts

packages/camera-input/
  package.json
  src/gesture-controller.ts
  src/index.ts
  src/orthographic-camera-rig.ts
  src/terrain-picker.ts
  test/gesture-controller.test.ts
  test/orthographic-camera-rig.test.ts
  test/terrain-picker.test.ts

packages/shared-testkit/
  package.json
  src/fixtures/chunk-seam.ts
  src/fixtures/coastal.ts
  src/fixtures/shape-atlas.ts
  src/fixtures/topology-cases.ts
  src/hash.ts
  src/index.ts
  src/mesh-assertions.ts
  test/fixtures.test.ts
  test/hash.test.ts

browser-tests/
  game.spec.ts
  terrain-lab.spec.ts

docs/architecture/
  unity-terrain-topology-provenance.md

docs/evidence/
  web-terrain-foundation-v0-1.md
```

---

### Task 1: Establish the workspace, strict quality gates, and package boundaries

**Files:**
- Create: root configuration files listed in the Planned File Map
- Create: every package/app `package.json`
- Create: `packages/world-core/test/config.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: none
- Produces: workspace scripts `build`, `typecheck`, `lint`, `format:check`, `test`, `test:coverage`, `test:browser`; package aliases under `@web-three-city/*`

- [ ] **Step 1: Create a failing workspace smoke test**

```ts
// packages/world-core/test/config.test.ts
import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '../src/config.js';

describe('WORLD_CONFIG', () => {
  it('locks the accepted world dimensions', () => {
    expect(WORLD_CONFIG).toMatchObject({
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

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
corepack enable
corepack use pnpm@10
pnpm install
pnpm --filter @web-three-city/world-core test -- config.test.ts
```

Expected: FAIL because workspace manifests and `src/config.ts` do not exist.

- [ ] **Step 3: Create the workspace manifests and strict compiler configuration**

Root `package.json` must contain these scripts:

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

Install dependencies through pnpm so exact versions are locked in `pnpm-lock.yaml`:

```bash
pnpm add -Dw typescript vite vitest @vitest/coverage-v8 eslint @eslint/js typescript-eslint prettier @playwright/test happy-dom
pnpm --filter @web-three-city/terrain-three add three
pnpm --filter @web-three-city/camera-input add three
pnpm --filter @web-three-city/game add three
pnpm --filter @web-three-city/terrain-lab add three
```

- [ ] **Step 4: Add the minimal accepted config export**

```ts
// packages/world-core/src/config.ts
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

- [ ] **Step 5: Run the focused test and complete workspace verification**

```bash
pnpm --filter @web-three-city/world-core test -- config.test.ts
pnpm format:check
pnpm lint
pnpm typecheck
```

Expected: focused test PASS; formatting, lint, and typecheck exit `0`.

- [ ] **Step 6: Commit**

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
- Consumes: `WorldConfig`, `WORLD_CONFIG`
- Produces: `CellCoord`, `GridVertexCoord`, `WorldPoint`, `cellIndex`, `vertexIndex`, `cellToWorldOrigin`, `vertexToWorld`, `worldToCell`, `WorldContractError`, `Result<T, E>`

- [ ] **Step 1: Write failing coordinate tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  cellIndex,
  vertexIndex,
  vertexToWorld,
  worldToCell,
} from '../src/coordinates.js';
import { WORLD_CONFIG } from '../src/config.js';

describe('world coordinates', () => {
  it('uses row-major cell and lattice indexing', () => {
    expect(cellIndex({ x: 3, z: 2 }, WORLD_CONFIG)).toBe(259);
    expect(vertexIndex({ x: 3, z: 2 }, WORLD_CONFIG)).toBe(261);
  });

  it('centers the lattice around the scene origin', () => {
    expect(vertexToWorld({ x: 64, z: 64 }, 2, WORLD_CONFIG)).toEqual({
      x: 0,
      y: 1,
      z: 0,
    });
  });

  it('maps a world point into the containing cell', () => {
    expect(worldToCell({ x: -63.25, y: 0, z: -62.75 }, WORLD_CONFIG)).toEqual({
      x: 0,
      z: 1,
    });
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/world-core test -- coordinates.test.ts
```

Expected: FAIL with missing coordinate exports.

- [ ] **Step 3: Implement immutable numeric contracts and explicit bounds assertions**

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

`worldToCell` must floor normalized X/Z, clamp neither silently nor implicitly, and throw `WorldContractError('world:outside-map', details)` when outside.

- [ ] **Step 4: Run focused and package tests**

```bash
pnpm --filter @web-three-city/world-core test
pnpm --filter @web-three-city/world-core typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/world-core
git commit -m "feat(world): add coordinate and indexing contracts"
```

---

### Task 3: Implement authoritative height lattice, terrain snapshots, validation, and serialization

**Files:**
- Create: `packages/terrain-core/src/height-lattice.ts`
- Create: `packages/terrain-core/src/terrain-map.ts`
- Create: `packages/terrain-core/src/validation.ts`
- Create: `packages/terrain-core/src/serialization.ts`
- Create: `packages/terrain-core/src/index.ts`
- Create: corresponding tests

**Interfaces:**
- Consumes: `WorldConfig`, coordinate indexing
- Produces: `HeightLattice`, `TerrainMap`, `TerrainSnapshot`, `createTerrainMap`, `validateTerrainMap`, `encodeTerrainSaveV1`, `decodeTerrainSaveV1`

- [ ] **Step 1: Write failing lattice and serialization tests**

```ts
it('stores one authoritative value per shared grid vertex', () => {
  const lattice = HeightLattice.filled(WORLD_CONFIG, 2);
  const changed = lattice.withHeight({ x: 8, z: 8 }, 3);
  expect(lattice.get({ x: 8, z: 8 })).toBe(2);
  expect(changed.get({ x: 8, z: 8 })).toBe(3);
  expect(changed.length).toBe(129 * 129);
});

it('round-trips byte-identical terrain lattice data', () => {
  const map = createTerrainMap({
    config: WORLD_CONFIG,
    seed: 1464156977,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 0,
    heightLevels: new Uint8Array(129 * 129).fill(2),
  });
  const restored = decodeTerrainSaveV1(encodeTerrainSaveV1(map));
  expect(restored.heightLevels).toEqual(map.heightLevels);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-core test -- height-lattice.test.ts serialization.test.ts
```

Expected: FAIL because terrain core contracts do not exist.

- [ ] **Step 3: Implement copy-on-write lattice and immutable snapshots**

```ts
export class HeightLattice {
  readonly #levels: Uint8Array;

  private constructor(
    readonly width: number,
    readonly height: number,
    levels: Uint8Array,
  ) {
    this.#levels = levels;
  }

  static from(config: WorldConfig, levels: Uint8Array): HeightLattice {
    const expected = (config.mapWidth + 1) * (config.mapHeight + 1);
    if (levels.length !== expected) {
      throw new TerrainInvariantError('terrain:invalid-lattice-length', {
        expected,
        actual: levels.length,
      });
    }
    return new HeightLattice(config.mapWidth + 1, config.mapHeight + 1, levels.slice());
  }

  get(coord: GridVertexCoord): number {
    return this.#levels[coord.z * this.width + coord.x]!;
  }

  toUint8Array(): Uint8Array {
    return this.#levels.slice();
  }
}
```

`withHeight` must return a new lattice, validate integer range `0..4`, and leave the original unchanged.

- [ ] **Step 4: Implement full-map validation**

Validation must return stable issue codes for:

```ts
export type TerrainValidationIssueCode =
  | 'terrain:invalid-height-range'
  | 'terrain:non-integer-height'
  | 'terrain:neighbor-delta-exceeded'
  | 'terrain:invalid-lattice-length';
```

Cardinal adjacency must be scanned exactly once: east and south neighbors only.

- [ ] **Step 5: Implement save schema validation before allocation**

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

Decode Base64 only after checking schema version, fixed dimensions, integer metadata, and encoded byte length. Invalid input returns `Result.err` with stable code; it must not partially construct a `TerrainMap`.

- [ ] **Step 6: Verify focused and boundary tests**

```bash
pnpm --filter @web-three-city/terrain-core test -- height-lattice.test.ts validation.test.ts serialization.test.ts
pnpm --filter @web-three-city/terrain-core typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/terrain-core
git commit -m "feat(terrain): add authoritative lattice and snapshot contracts"
```

---

### Task 4: Transcribe and lock the accepted Unity diagonal and Shape Atlas contracts

**Files:**
- Create: `docs/architecture/unity-terrain-topology-provenance.md`
- Create: `packages/terrain-core/src/topology.ts`
- Create: `packages/terrain-core/src/shape-classifier.ts`
- Create: `packages/shared-testkit/src/fixtures/topology-cases.ts`
- Create: `packages/shared-testkit/src/fixtures/shape-atlas.ts`
- Create: focused tests

**Interfaces:**
- Consumes: exact Unity rules at `cityBuilder@19b29e32...`
- Produces: `TerrainCorners`, `TerrainDiagonal`, `selectTerrainDiagonal`, `cellTriangleCornerOrder`, `TerrainShape`, `classifyTerrainShape`, authored Shape Atlas fixtures

- [ ] **Step 1: Record provenance before code**

`docs/architecture/unity-terrain-topology-provenance.md` must record:

```text
Source repository: petechatchawan/cityBuilder
Source commit: 19b29e32cb24ed7535fc08aafbd6a7ffe6b1daeb
Source document: docs/terrain/terrain-architecture-lab-implementation-packet-v0.1.md
Corner order: [NW, NE, SW, SE]
Pair A: SW-NE
Pair B: NW-SE
Rule 1: sole equal pair wins
Rule 2: otherwise smaller absolute endpoint delta wins
Rule 3: equal delta ties select SW-NE
Superseded behavior: checkerboard/parity selection
```

Also state that rules and fixture values were manually transcribed and no Unity production source was copied.

- [ ] **Step 2: Write RED tests for every decision branch**

```ts
it.each([
  [{ nw: 0, ne: 1, sw: 1, se: 2 }, 'sw-ne'], // SW === NE only
  [{ nw: 2, ne: 1, sw: 0, se: 2 }, 'nw-se'], // NW === SE only
  [{ nw: 1, ne: 0, sw: 0, se: 1 }, 'sw-ne'], // both equal: ridge
  [{ nw: 0, ne: 1, sw: 1, se: 0 }, 'sw-ne'], // both equal: valley
  [{ nw: 0, ne: 3, sw: 1, se: 2 }, 'nw-se'], // neither equal, NW-SE delta 2 vs SW-NE delta 2? replace below
  [{ nw: 0, ne: 3, sw: 1, se: 2 }, 'sw-ne'], // equal delta tie
  [{ nw: 0, ne: 4, sw: 1, se: 2 }, 'nw-se'], // delta 3 vs 2
] as const)('selects the accepted diagonal for %o', (corners, expected) => {
  expect(selectTerrainDiagonal(corners)).toBe(expected);
});
```

Remove the explanatory duplicate tie row before commit; the final table must contain one unambiguous case per branch:

```ts
const CASES = [
  [{ nw: 0, ne: 1, sw: 1, se: 2 }, 'sw-ne'],
  [{ nw: 2, ne: 1, sw: 0, se: 2 }, 'nw-se'],
  [{ nw: 1, ne: 0, sw: 0, se: 1 }, 'sw-ne'],
  [{ nw: 0, ne: 1, sw: 1, se: 0 }, 'sw-ne'],
  [{ nw: 0, ne: 4, sw: 1, se: 2 }, 'nw-se'],
  [{ nw: 0, ne: 3, sw: 1, se: 2 }, 'sw-ne'],
] as const;
```

- [ ] **Step 3: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-core test -- topology.test.ts shape-classifier.test.ts
```

Expected: FAIL with missing functions.

- [ ] **Step 4: Implement the pure selector exactly**

```ts
export type TerrainDiagonal = 'sw-ne' | 'nw-se';

export interface TerrainCorners {
  readonly nw: number;
  readonly ne: number;
  readonly sw: number;
  readonly se: number;
}

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
```

Triangle corner orders are locked:

```ts
export const CELL_TRIANGLES = {
  'sw-ne': [['sw', 'se', 'ne'], ['sw', 'ne', 'nw']],
  'nw-se': [['sw', 'se', 'nw'], ['se', 'ne', 'nw']],
} as const;
```

- [ ] **Step 5: Implement normalized shape classification**

Normalize by subtracting the minimum corner. Cover `Flat`, four cardinal ramps, four single-corner-high, four single-corner-low, `DiagonalRidge`, `DiagonalValley`, `SaddleOrTwist`, and `SevereDelta`.

Exact core signatures:

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

Any normalized range greater than `1` is `severe-delta`; unmatched legal range-1 signatures are `saddle-or-twist`.

- [ ] **Step 6: Add authored deterministic fixture matrices**

Create twelve named fixtures `F-01` through `F-12` matching the Unity packet: Flat, Single Raised Vertex, Single Lowered Vertex translated into legal non-negative levels, Cardinal Ramp Band, Raised Plateau, Diagonal Ridge, Diagonal Valley, Basin, Staircase, Saddle/Twist, Chunk Seam, Map Boundary Skirt.

Each fixture exports its exact `8 × 8` `Uint8Array`, expected notable cell classifications, expected notable diagonals, and provenance metadata. Random fixture generation is forbidden.

- [ ] **Step 7: Verify topology and fixture tests**

```bash
pnpm --filter @web-three-city/terrain-core test -- topology.test.ts shape-classifier.test.ts
pnpm --filter @web-three-city/shared-testkit test -- fixtures.test.ts
```

Expected: PASS and no checkerboard/parity helper exists.

- [ ] **Step 8: Commit**

```bash
git add docs/architecture packages/terrain-core packages/shared-testkit
git commit -m "feat(terrain): lock accepted Unity topology and shape atlas"
```

---

### Task 5: Implement deterministic PRNG and terrain statistics

**Files:**
- Create: `packages/terrain-generator/src/prng.ts`
- Create: `packages/terrain-generator/src/statistics.ts`
- Create: corresponding tests

**Interfaces:**
- Consumes: `TerrainMap`, topology corners
- Produces: `Xoshiro128StarStar`, `TerrainStatistics`, `calculateTerrainStatistics`, `largestConnectedLandmass`, `largestBuildableSquare`

- [ ] **Step 1: Write fixed-vector PRNG tests**

Use a fixed seed expansion and commit the first ten `nextUint32()` outputs as a golden vector. The test must compare exact integers, not ranges.

```ts
it('produces an exact cross-runtime sequence', () => {
  const rng = Xoshiro128StarStar.fromSeed(1464156977);
  expect(Array.from({ length: 10 }, () => rng.nextUint32())).toEqual([
    1544367791, 3976742798, 2380487215, 3346359911, 3777658990,
    1960031329, 306815070, 1890271220, 1786176477, 3933223737,
  ]);
});
```

Before implementation commit, verify this vector against an independent tiny reference script included in the test file comments. If the specified xoshiro variant produces a different sequence, update the vector and reference script together before GREEN; never alter only the expected array.

- [ ] **Step 2: Write RED statistics tests**

Definitions are locked:

- dry land cell: all four corners are strictly greater than `seaLevel`;
- fully water-designated cell: all four corners are less than or equal to `seaLevel`;
- shoreline cell: neither fully dry nor fully water-designated;
- flat buildable cell: all four corners equal and strictly greater than `seaLevel`;
- landmass adjacency: cardinal cells only;
- largest buildable square: largest axis-aligned square of flat buildable cells;
- isolated spike/pit: an interior lattice vertex whose eight neighbors are all exactly one lower/higher.

- [ ] **Step 3: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-generator test -- prng.test.ts statistics.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement PRNG with explicit unsigned 32-bit operations**

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
  return result;
}
```

Seed expansion must use a documented SplitMix32 function and reject no integer seed, including `0`.

- [ ] **Step 5: Implement O(n) or O(n log n) statistics**

Use iterative flood fill, not recursion. Use dynamic programming for `largestBuildableSquare`. Return stable integer counts plus ratios derived from total cell count.

- [ ] **Step 6: Verify**

```bash
pnpm --filter @web-three-city/terrain-generator test -- prng.test.ts statistics.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/terrain-generator
git commit -m "feat(generator): add deterministic prng and terrain statistics"
```

---

### Task 6: Implement Constraint-Aware Coastal Generator v1

**Files:**
- Create: `packages/terrain-generator/src/coastal-config.ts`
- Create: `packages/terrain-generator/src/coastal-fields.ts`
- Create: `packages/terrain-generator/src/constraint-projection.ts`
- Create: `packages/terrain-generator/src/coastal-generator.ts`
- Create: `packages/terrain-generator/src/index.ts`
- Create: corresponding tests
- Create: `packages/shared-testkit/src/fixtures/coastal.ts`

**Interfaces:**
- Consumes: `Xoshiro128StarStar`, `HeightLattice`, statistics, terrain validation
- Produces: `generateCoastalTerrain`, `CoastalGeneratorConfig`, `TerrainGenerationError`, curated seed `1464156977`

- [ ] **Step 1: Write RED generator acceptance tests**

```ts
it('generates byte-identical terrain for the curated seed', () => {
  const a = generateCoastalTerrain({ seed: 1464156977, config: WORLD_CONFIG });
  const b = generateCoastalTerrain({ seed: 1464156977, config: WORLD_CONFIG });
  expect(a.ok).toBe(true);
  expect(b.ok).toBe(true);
  if (a.ok && b.ok) expect(a.value.heightLevels).toEqual(b.value.heightLevels);
});

it('satisfies the locked coastal constraints', () => {
  const result = generateCoastalTerrain({ seed: 1464156977, config: WORLD_CONFIG });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const s = calculateTerrainStatistics(result.value, WORLD_CONFIG);
  expect(s.fullyWaterRatio).toBeGreaterThanOrEqual(0.18);
  expect(s.fullyWaterRatio).toBeLessThanOrEqual(0.22);
  expect(s.largestLandmassRatio).toBeGreaterThanOrEqual(0.72);
  expect(s.flatBuildableRatio).toBeGreaterThanOrEqual(0.30);
  expect(s.largestBuildableSquare).toBeGreaterThanOrEqual(24);
  expect(s.levelCounts[4] / (128 * 128)).toBeLessThanOrEqual(0.12);
  expect(s.isolatedSpikeCount).toBe(0);
  expect(s.isolatedPitCount).toBe(0);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-generator test -- coastal-generator.test.ts constraint-projection.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement deterministic field construction**

Use these locked v1 constants:

```ts
export const COASTAL_V1 = Object.freeze({
  generatorVersion: 'coastal-v1' as const,
  maxAttempts: 16,
  baseCoastZ: 102,
  coastAmplitudeA: 7,
  coastAmplitudeB: 4,
  coastFrequencyA: 1,
  coastFrequencyB: 3,
  primaryPlateau: { centerX: 64, centerZ: 74, radiusX: 28, radiusZ: 20, level: 2 },
  centralPlateau: { centerX: 62, centerZ: 46, radiusX: 24, radiusZ: 18, level: 2 },
  secondaryPlateau: { centerX: 96, centerZ: 58, radiusX: 16, radiusZ: 14, level: 3 },
});
```

The coastline field combines south-distance gradient, two low-frequency sine components with PRNG-derived phases, one broad bay mask, and one small peninsula mask. Do not use per-vertex white noise.

- [ ] **Step 4: Implement constraint projection**

Projection repeatedly scans north/south/east/west edges and reduces only the higher endpoint until every cardinal delta is `<= 1`. Cap at `2 * (width + height)` passes and return `constraint-unsatisfied` if a pass still changes data after the cap.

After projection, remove isolated spikes/pits by replacing the center with the common eight-neighbor level, then re-run projection.

- [ ] **Step 5: Implement deterministic candidate attempts and typed failure**

```ts
export type TerrainGenerationErrorCode =
  | 'invalid-config'
  | 'constraint-unsatisfied'
  | 'insufficient-landmass'
  | 'insufficient-buildable-area'
  | 'invalid-height-range';
```

Attempt seed is `mix32(seed ^ Math.imul(attempt + 1, 0x9e3779b9))`. The first valid candidate wins. The returned map stores the chosen attempt index.

- [ ] **Step 6: Lock the curated golden hash**

Use SHA-256 over raw `heightLevels` bytes. Generate once from GREEN code, independently rerun in a fresh Node process, and commit the exact hash in `packages/shared-testkit/src/fixtures/coastal.ts`. A changed hash requires generator-version or specification approval.

- [ ] **Step 7: Verify**

```bash
pnpm --filter @web-three-city/terrain-generator test
pnpm --filter @web-three-city/shared-testkit test -- fixtures.test.ts hash.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/terrain-generator packages/shared-testkit
git commit -m "feat(generator): add constraint-aware coastal terrain v1"
```

---

### Task 7: Implement chunk ownership and dirty-region invalidation

**Files:**
- Create: `packages/terrain-core/src/chunking.ts`
- Create: `packages/terrain-core/src/dirty-region.ts`
- Create: corresponding tests

**Interfaces:**
- Consumes: world config, cell/lattice coordinates
- Produces: `ChunkCoord`, `ChunkCellBounds`, `allChunkCoords`, `chunkForCell`, `resolveDirtyChunks`

- [ ] **Step 1: Write RED chunk tests**

```ts
it('creates exactly 64 deterministic chunk coordinates', () => {
  expect(allChunkCoords(WORLD_CONFIG)).toHaveLength(64);
  expect(allChunkCoords(WORLD_CONFIG)[0]).toEqual({ x: 0, z: 0 });
  expect(allChunkCoords(WORLD_CONFIG)[63]).toEqual({ x: 7, z: 7 });
});

it('includes normal-halo neighbors at a chunk seam', () => {
  expect(resolveDirtyChunks({
    minVertexX: 16,
    minVertexZ: 8,
    maxVertexX: 16,
    maxVertexZ: 8,
  }, WORLD_CONFIG)).toEqual([
    { x: 0, z: 0 },
    { x: 1, z: 0 },
  ]);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-core test -- chunking.test.ts dirty-region.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement deterministic ownership**

Chunk owns cells `[chunkX*16, chunkX*16+15] × [chunkZ*16, chunkZ*16+15]`. Lattice boundary vertices are read by both adjacent chunks but owned by neither as mutable presentation state.

- [ ] **Step 4: Implement dirty expansion**

Expand changed vertex bounds by one lattice vertex in each direction, clamp to `0..128`, convert affected cells to chunks, deduplicate by numeric key `z * 8 + x`, and return row-major sorted coordinates.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-core test -- chunking.test.ts dirty-region.test.ts
git add packages/terrain-core
git commit -m "feat(terrain): add chunk and dirty-region contracts"
```

---

### Task 8: Implement deterministic top-surface chunk meshing

**Files:**
- Create: `packages/terrain-core/src/mesh-data.ts`
- Create: `packages/terrain-core/src/chunk-mesher.ts`
- Create: `packages/terrain-core/test/chunk-mesher.test.ts`
- Create: `packages/shared-testkit/src/mesh-assertions.ts`

**Interfaces:**
- Consumes: `TerrainSnapshot`, `ChunkCoord`, topology selector, world conversion
- Produces: `TerrainChunkMeshData`, `buildTerrainChunkMesh`, mesh assertions

- [ ] **Step 1: Write RED geometry tests**

For a `16 × 16` chunk assert:

```ts
expect(mesh.positions.length / 3).toBe(17 * 17);
expect(mesh.indices.length).toBe(16 * 16 * 6);
expect(mesh.indices.length / 3).toBe(512);
expectNoDegenerateTriangles(mesh);
expectAllTrianglesUpward(mesh);
expect(mesh.verticalFaceCount).toBeUndefined();
```

Also assert a known ridge cell uses the exact `SW-NE` index order and a known sole-equal `NW-SE` case uses the other order.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-core test -- chunk-mesher.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement one vertex per local lattice point**

Create `17 × 17` local vertices in row-major order. Positions derive only from authoritative global lattice coordinates. Emit exactly six indices per cell using `CELL_TRIANGLES`.

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

Initialize normals to zero; Task 9 supplies canonical values. Colors derive deterministically from height and slope and must not affect topology.

- [ ] **Step 4: Add ordered mesh hash tests**

Hash positions and indices separately. The same snapshot and chunk must produce identical bytes on repeated calls.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-core test -- chunk-mesher.test.ts
git add packages/terrain-core packages/shared-testkit
git commit -m "feat(terrain): add deterministic chunk surface mesher"
```

---

### Task 9: Implement canonical global incident-triangle normals

**Files:**
- Create: `packages/terrain-core/src/canonical-normals.ts`
- Create: `packages/terrain-core/test/canonical-normals.test.ts`
- Modify: `packages/terrain-core/src/chunk-mesher.ts`

**Interfaces:**
- Consumes: authoritative snapshot and accepted topology
- Produces: `CanonicalNormalField`, `buildCanonicalNormals`, `copyChunkNormals`

- [ ] **Step 1: Write RED seam-normal tests**

Build the F-11 Chunk Seam fixture as two neighboring chunks. For all duplicated logical seam vertices assert position equality and normal component equality within `1e-6`.

Also mutate one seam-adjacent vertex in a legal test snapshot and assert dirty chunk resolution includes every chunk whose copied normal changes.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-core test -- canonical-normals.test.ts
```

Expected: FAIL or zero normals.

- [ ] **Step 3: Implement canonical accumulation**

Allocate one `Float64Array` of length `latticeVertexCount * 3` for accumulation. For every cell:

1. select accepted diagonal;
2. build its two global triangles;
3. calculate unnormalized cross product;
4. add the face vector to all three canonical lattice vertices.

Normalize into a `Float32Array`; reject zero-length accumulated normals as `terrain:zero-normal`.

- [ ] **Step 4: Copy canonical normals into chunk duplicates**

Chunk meshing reads the canonical field by global lattice index. Do not call Three.js `computeVertexNormals()` for production terrain.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-core test -- canonical-normals.test.ts chunk-mesher.test.ts
git add packages/terrain-core
git commit -m "feat(terrain): add seam-safe canonical normals"
```

---

### Task 10: Implement the outer diorama skirt as separate geometry

**Files:**
- Create: `packages/terrain-core/src/outer-skirt-mesher.ts`
- Create: `packages/terrain-core/test/outer-skirt-mesher.test.ts`
- Modify: `packages/terrain-core/src/index.ts`

**Interfaces:**
- Consumes: terrain perimeter and `dioramaBaseY`
- Produces: `OuterSkirtMeshData`, `buildOuterSkirtMesh`

- [ ] **Step 1: Write RED boundary-only tests**

Assert:

- exactly `128` segments per side and `512` total perimeter segments;
- no interior edge is emitted;
- top coordinates exactly match terrain perimeter world positions;
- bottom Y is exactly `-1.5`;
- winding faces outward;
- hard normals are not shared with top-surface normals;
- repeated calls produce byte-identical buffers.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-core test -- outer-skirt-mesher.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement deterministic side ownership**

Emit sides in order `north`, `east`, `south`, `west`; each side owns its segments and duplicates corner vertices intentionally for hard normals. Emit four vertices and two triangles per segment. Do not emit a bottom cap in v0.1.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-core test -- outer-skirt-mesher.test.ts
git add packages/terrain-core
git commit -m "feat(terrain): add outer diorama skirt geometry"
```

---

### Task 11: Adapt pure mesh data into leak-safe Three.js presentation

**Files:**
- Create: all `packages/terrain-three/src/*`
- Create: all `packages/terrain-three/test/*`

**Interfaces:**
- Consumes: `TerrainChunkMeshData`, `OuterSkirtMeshData`
- Produces: `createChunkGeometry`, `TerrainPresentation`, `OuterSkirtPresentation`, `createTerrainMaterial`, `detectWebGL2`

- [ ] **Step 1: Write RED adapter and lifecycle tests**

Using happy-dom and test doubles around disposable Three.js resources, assert attributes use the original typed arrays, index type is `Uint16BufferAttribute`, replacement disposes old geometry, and `dispose()` is idempotent.

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

- [ ] **Step 4: Implement staged full load and atomic publication**

`TerrainPresentation.load(snapshot)` builds all 64 new meshes in a staging `THREE.Group`. Publish only after every geometry succeeds; then swap groups and dispose the old group. A failed load leaves the old visible group untouched.

`rebuild(chunks)` builds all replacement geometries first, then swaps only the requested chunk meshes.

- [ ] **Step 5: Implement materials and capability failure**

Use `MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 })`. Terrain and skirt use distinct materials. `detectWebGL2` returns a typed unsupported result instead of crashing.

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-three test
pnpm --filter @web-three-city/terrain-three typecheck
git add packages/terrain-three
git commit -m "feat(three): add leak-safe terrain presentation"
```

---

### Task 12: Implement orthographic camera, bounds, and normalized gestures

**Files:**
- Create: `packages/camera-input/src/orthographic-camera-rig.ts`
- Create: `packages/camera-input/src/gesture-controller.ts`
- Create: corresponding tests

**Interfaces:**
- Consumes: Three.js camera and canvas-like pointer target
- Produces: `OrthographicCameraRig`, `CameraState`, `GestureController`, `GestureFrame`

- [ ] **Step 1: Write RED camera-state tests**

Assert initial yaw `45°`, pitch `55°`, rotation increments exactly `90°`, four rotations return to the initial orientation, zoom clamps, reset restores defaults, and target remains inside map bounds with restrained edge resistance.

- [ ] **Step 2: Write RED gesture arbitration tests**

Desktop: right/middle drag pans, wheel zooms, `Q/E` rotates, `Home` resets, left click remains selection intent.

Mobile terrain viewer: one-finger drag pans, tap selects, pinch zooms, two-finger twist rotates. Pointer cancellation clears state without emitting a tap.

- [ ] **Step 3: Run and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- orthographic-camera-rig.test.ts gesture-controller.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement camera as explicit state plus application**

```ts
export interface CameraState {
  readonly targetX: number;
  readonly targetZ: number;
  readonly yawQuarterTurns: 0 | 1 | 2 | 3;
  readonly pitchDegrees: 55;
  readonly zoom: number;
}
```

The rig owns conversion from state to Three.js camera transform. Keep state serializable and independent from DOM events.

- [ ] **Step 5: Implement Pointer Events normalization**

Use pointer IDs and captured pointers. Gesture controller emits semantic frames; it must not import terrain-core or mutate camera directly.

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @web-three-city/camera-input test -- orthographic-camera-rig.test.ts gesture-controller.test.ts
git add packages/camera-input
git commit -m "feat(input): add mobile-first orthographic camera controls"
```

---

### Task 13: Implement terrain picking independent of mesh names

**Files:**
- Create: `packages/camera-input/src/terrain-picker.ts`
- Create: `packages/camera-input/test/terrain-picker.test.ts`
- Modify: `packages/camera-input/src/index.ts`

**Interfaces:**
- Consumes: Three.js `Raycaster`, terrain chunk objects, world coordinate conversion
- Produces: `TerrainPickResult`, `pickTerrain`

- [ ] **Step 1: Write RED picking tests**

Create a small deterministic two-triangle cell for both legal diagonals. For known hit points assert cell, local U/V, nearest vertex, and world point. Repeat under four camera quarter turns and after replacing the chunk mesh object.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- terrain-picker.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement world-derived picking**

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

Raycast current chunk meshes, take nearest visible intersection, calculate grid-space coordinates from the world point, and derive nearest corner using `localU < 0.5` and `localV < 0.5`. Do not inspect mesh names or chunk userData to determine the cell.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @web-three-city/camera-input test -- terrain-picker.test.ts
git add packages/camera-input
git commit -m "feat(input): add renderer-independent terrain picking"
```

---

### Task 14: Build Terrain Lab fixtures and diagnostics

**Files:**
- Create: all `apps/terrain-lab/*`
- Modify: shared fixture exports as required

**Interfaces:**
- Consumes: generator, fixtures, terrain presentation, camera, picker
- Produces: browser Terrain Lab with deterministic fixture selection and diagnostics

- [ ] **Step 1: Create a failing browser boot test**

```ts
// browser-tests/terrain-lab.spec.ts
import { expect, test } from '@playwright/test';

test('boots the Coastal fixture without browser errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/terrain-lab/?fixture=coastal');
  await expect(page.getByTestId('fixture-name')).toHaveText('CoastalFixture');
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-lab build
pnpm test:browser -- terrain-lab.spec.ts
```

Expected: FAIL because app does not exist.

- [ ] **Step 3: Implement fixture registry**

Registry IDs are exactly:

```ts
export type FixtureId =
  | 'coastal'
  | 'shape-atlas'
  | 'chunk-seam'
  | 'boundary-skirt'
  | 'picking';
```

Unknown query values fall back to `coastal` and show a non-fatal diagnostic message.

- [ ] **Step 4: Implement diagnostics**

Add development toggles for chunk boundaries, cell grid, selected diagonals, canonical normals, lattice height labels, selected cell/vertex, generator statistics, FPS, full build duration, and dirty rebuild duration.

Diagnostics read derived data and never mutate `TerrainMap`.

- [ ] **Step 5: Implement fixed lighting and camera**

Use one directional light, one hemisphere light, neutral scene background, orthographic camera defaults from Task 12, no post-processing, and no shadows in Low quality.

- [ ] **Step 6: Verify all fixture routes**

```bash
pnpm --filter @web-three-city/terrain-lab build
pnpm test:browser -- terrain-lab.spec.ts
```

Expected: all five routes boot without uncaught errors.

- [ ] **Step 7: Commit**

```bash
git add apps/terrain-lab browser-tests/terrain-lab.spec.ts packages/shared-testkit
git commit -m "feat(lab): add deterministic terrain fixtures and diagnostics"
```

---

### Task 15: Build the minimal game shell, quality tiers, context recovery, and terrain save/load

**Files:**
- Create: all `apps/game/*`
- Create: `browser-tests/game.spec.ts`
- Modify: `packages/terrain-three/src/terrain-presentation.ts`

**Interfaces:**
- Consumes: curated Coastal fixture, presentation, camera, serialization
- Produces: minimal product shell showing Coastal terrain; Low/Medium/High policy; local save/load; context recovery

- [ ] **Step 1: Write RED game-shell browser tests**

Assert app boot, WebGL2 failure message, quality tier selection, camera controls, save then reload of byte-identical terrain, viewport resize, and `webglcontextlost`/`webglcontextrestored` recovery.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/game build
pnpm test:browser -- game.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement exact quality policy**

```ts
export const QUALITY_TIERS = {
  low: { maxPixelRatio: 1, shadows: false },
  medium: { maxPixelRatio: 1.5, shadows: true },
  high: { maxPixelRatio: 2, shadows: true },
} as const;
```

Quality changes may alter presentation only, never geometry, topology, picking, or save data.

- [ ] **Step 4: Implement persistence**

Use localStorage only for Milestone 1 terrain snapshot because the payload is under its documented size limit. Key: `web-three-city:terrain-save:v1`. Save the full lattice plus provenance and restore without regeneration.

- [ ] **Step 5: Implement context loss handling**

On loss, prevent default, pause rendering, keep authoritative snapshot, and show status. On restoration, recreate renderer resources and reload the current snapshot atomically.

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @web-three-city/game build
pnpm test:browser -- game.spec.ts
git add apps/game browser-tests/game.spec.ts packages/terrain-three
git commit -m "feat(game): add coastal terrain shell and recovery"
```

---

### Task 16: Add CI, performance evidence, complete verification, and prepare visual review

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/evidence/web-terrain-foundation-v0-1.md`
- Modify: `README.md`
- Modify: PR body

**Interfaces:**
- Consumes: all previous tasks
- Produces: reproducible CI and exact-head acceptance evidence

- [ ] **Step 1: Add GitHub Actions matrix**

Workflow jobs:

1. `quality`: install frozen lockfile, format, lint, typecheck;
2. `unit`: unit/geometry/golden tests with coverage artifact;
3. `build`: build both apps and upload dist artifacts;
4. `browser`: install Chromium, run Playwright, upload reports/screenshots;
5. `provenance`: fail if forbidden strings or vendored source paths indicate copied `3d.city`, Micropolis, or Unity production source.

Use `pnpm install --frozen-lockfile` and concurrency cancellation by PR branch.

- [ ] **Step 2: Add a non-blocking performance recorder**

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

Run warm-up before samples. Report metrics; do not fail CI on target deviations in v0.1.

- [ ] **Step 3: Run the complete local gate from a clean checkout**

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

Expected:

- all commands exit `0`;
- no failed tests;
- both apps build;
- browser suite passes;
- `git diff --check` prints nothing;
- `git status --short` contains only intended evidence updates before their commit.

- [ ] **Step 4: Record exact evidence without inventing PASS values**

`docs/evidence/web-terrain-foundation-v0-1.md` must contain exact base SHA, head SHA, Node/pnpm versions, package lock hash, test counts, fixture hashes, triangle/vertex counts, browser names, performance measurements, warnings, screenshot file hashes, and `NOT RUN` for unavailable mobile-device evidence.

Required screenshots:

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

- [ ] **Step 5: Re-run the complete gate after evidence changes**

```bash
pnpm check
pnpm test:coverage
pnpm test:browser
git diff --check
```

Expected: all exit `0`.

- [ ] **Step 6: Commit verification infrastructure and evidence**

```bash
git add .github README.md docs/evidence package.json pnpm-lock.yaml
git commit -m "ci: verify Web Terrain Foundation v0.1"
```

- [ ] **Step 7: Update the Draft PR for owner visual review**

PR body must include:

- exact base/head SHA;
- task/commit summary;
- Unity topology provenance and no-copy declaration;
- changed-file boundary;
- generator seed, attempt, and golden hash;
- all automated gate outputs with exact counts;
- browser and performance evidence;
- screenshot links/hashes;
- known limitations;
- explicit exclusions: Water, Terraform, Roads, Zones, Buildings, simulation, WebGPU;
- merge status: not performed;
- human visual approval: pending.

---

## Final Acceptance Checklist

- [ ] Curated `128 × 128` Coastal terrain is deterministic and satisfies every generation constraint.
- [ ] The exact Unity diagonal decision table is transcribed with provenance and covered by tests.
- [ ] No checkerboard/parity topology path exists.
- [ ] Every cell emits exactly two non-degenerate upward triangles.
- [ ] All 64 chunks have identical seam positions and normals.
- [ ] Outer skirt exists only at the world perimeter.
- [ ] Desktop and touch camera controls pass automated tests.
- [ ] Picking passes under all four camera rotations and both legal diagonals.
- [ ] Dirty-region resolution rebuilds only affected chunks plus normal dependencies.
- [ ] Terrain save/load round-trips byte-identical lattice data.
- [ ] WebGL2 context failure and restoration are handled without corrupting authoritative state.
- [ ] Unit, geometry, golden, build, and browser gates pass from a clean checkout.
- [ ] Exact-head evidence and screenshot hashes are recorded.
- [ ] Human visual approval is obtained before merge.
- [ ] No Water, Terraform, Road, Zone, Building, simulation, or WebGPU scope is included.
