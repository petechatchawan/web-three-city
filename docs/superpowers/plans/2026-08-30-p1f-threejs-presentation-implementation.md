# P1-F Three.js Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a maintainable, deterministic Three.js projection of canonical Terrain using 64 render sectors, seam-safe normals, localized revision-safe rebuilds, explicit GPU resource ownership, and Raycaster-to-semantic Terrain picking without allowing presentation state to become gameplay authority.

**Architecture:** Use a functional-core / imperative-shell design. Topology, invalidation, sector-snapshot construction, geometry-array generation, normal calculation, and semantic coordinate conversion are small deterministic functions over explicit inputs. Three.js object allocation, mutable sector registry state, scene attachment, replacement, and disposal are isolated to resource/projection boundaries implemented as factory functions and closure-owned state rather than application classes.

**Tech Stack:** Node.js 22.18.0, pnpm 10.15.1, TypeScript 5.9.2, Vitest 3.2.4, Three.js 0.179.1, `@types/three` 0.179.0, Vite 7.1.3, Playwright 1.55.0, existing repository architecture checker.

**Spec:** `docs/superpowers/specs/2026-08-30-p1f-threejs-presentation-design.md`, constrained by frozen `docs/systems/terrain/specs/TERRAIN-PRESENTATION-CONTRACT.md`, `TERRAIN-SURFACE-CONTRACT.md`, `TERRAIN-MUTATION-CONTRACT.md`, and `TERRAIN-SYSTEM-DESIGN.md`.

## Global Constraints

- P1-A through P1-E are merged authority. Start implementation from the exact clean `master` after this design/plan documentation is merged.
- Create the implementation branch `feat/phase-1f-threejs-presentation` from that exact `master`; do not implement on the docs branch or directly on `master`.
- Preserve package ownership: `systems/terrain` owns Terrain-specific Three.js projection; do not create a separate terrain-render package.
- Terrain root `.` remains read-only and contains no Three.js types. Terrain `./commands` remains mutation-only and contains no Three.js types. Three.js-specific public types may appear only through Terrain `./composition`.
- `systems/terrain/src/domain/**` and `systems/terrain/src/application/**` must not import `three` or browser globals.
- P1-F-owned application code uses factory functions, pure transforms, immutable records, and closure-owned lifecycle state. Do not introduce an application-owned `class` hierarchy. Three.js constructors are library objects and are allowed at the imperative shell.
- No mutable module-level singleton state. All projection/registry/resource state is instance-local and owned by one factory-created projection.
- No scattered business/presentation magic numbers. `RENDER_SECTOR_CELLS = 64` has one owner in render-sector topology. Map width/height and `cellSizeMeters` come from `MapDefinitionRead`. Vertical conversion uses `logicalElevationToMeters()`. Q16 conversion uses `Q16_ONE` and derives the pick maximum as `Q16_ONE - 1`.
- Secondary values are derived: sector-axis counts, total sector count, sector vertex-axis count, vertex count, cell count, triangle count, and index count must not be independently authored constants that can drift.
- World owns Cell/Vertex/Chunk topology. Presentation may call `WorldSpatialRead`; it must not copy canonical World owner/seam formulas into production code.
- Terrain owns exact fixed cell triangulation. Add one internal Terrain-domain corner-order constant and reuse it from geometry and presentation-normal code rather than duplicating the triangle corner order.
- One full sector is 64×64 Cells, 65×65 visible presentation vertices, 4,225 visible vertices, 8,192 triangles, and 24,576 indices. Tests assert these exact vectors; production code derives them.
- Position projection uses map-provided `cellSizeMeters` for X/Z and Terrain-owned `logicalElevationToMeters()` for Y. No production presentation file repeats `8` or `0.25` as conversion literals.
- Geometry/normal construction reads Terrain through one coherent `SectorSurfaceSnapshot` per sector. Geometry and normal code do not independently re-query Terrain elevation for each face.
- A sector snapshot includes the visible 65×65 vertex window and a clipped one-vertex halo. Interior maximum read footprint is 67×67 canonical vertices.
- Sector snapshot construction verifies Terrain revision before and after the read pass. Mixed-revision snapshots fail loudly and are never published.
- Presentation normals use all semantic incident triangles for the World Vertex, including across sector boundaries. Do not use sector-local `BufferGeometry.computeVertexNormals()` as Terrain normal authority.
- Flat Terrain presentation normal must be upward `(0,1,0)` within floating tolerance. Face normals are oriented upward before accumulation.
- Initial projection requires `terrain.completeness() === "full"` and builds exactly 64 sector resources for production-v1.
- Localized rebuild uses `TerrainChangeSet.affectedCells`, one-Cell Moore expansion, deterministic de-duplication, and canonical `(z,x)` sector order. Do not rebuild all 64 sectors for a normal localized edit.
- Projection tracks `projectedRevision`. `rebuild(changeSet)` requires `changeSet.previousRevision === projectedRevision` and `changeSet.newRevision === terrain.revision()` before any live resource replacement.
- Rebuild stages all replacement resources first. If any staged build fails, dispose staged replacements and leave the currently attached registry/root unchanged. Only after all replacements build successfully may the live projection swap resources.
- Canonical Terrain mutation remains committed even if presentation rebuild fails. Presentation never rolls back Terrain state.
- Use exactly one shared Terrain material per projection. Localized rebuild disposes replaced geometry/resource only; it does not recreate/dispose the shared material.
- Resource ownership/disposal is explicit and idempotent at the projection boundary. GPU-backed Three.js geometries/materials are disposed when no longer used, consistent with Three.js lifecycle guidance.
- Raycaster identifies only a candidate. Semantic Cell/triangle/height/slope comes from World + Terrain queries. `intersection.point.y` must never be used as authoritative Terrain height.
- Q16 pick conversion derives Cell width/depth from `WorldSpatialRead.cellBounds()` and uses `Q16_ONE`; never repeat an 8m divisor in picking code.
- P1-F does not add LOD, streaming, workers, async rebuild queues, BVH, WebGPU abstractions, render graph, cache eviction, sub-buffer mutation, Terraform policy, persistence, or an event bus.
- P1-F browser verification uses a dedicated Vite test page/harness. Production `apps/game/src/bootstrap/main.ts` and `createGame()` remain free of World/Terrain production composition until P1-G.
- Any World/Terrain app package references required only by the P1-F browser harness are app dev/test dependencies during P1-F. P1-G later promotes them to production dependencies when real new-city composition is wired.
- Every production behavior follows RED → confirm intended failure → minimal GREEN → focused regression → architecture/typecheck → commit.
- Do not modify frozen specs to make implementation pass. If a genuine frozen-contract contradiction is found, stop the implementation task and reopen the owning decision explicitly.

---

## Planned File Structure

```text
systems/terrain/
├─ package.json                              # add three / @types/three at first real Three consumer
├─ src/
│  ├─ domain/
│  │  └─ surface.ts                         # add single internal semantic triangle-corner order
│  ├─ contracts/
│  │  └─ terrain-three.ts                   # composition-only Three projection/pick contracts
│  ├─ presentation/three/
│  │  ├─ topology/
│  │  │  ├─ render-sector.ts                # pure layout/mapping/order/key functions
│  │  │  └─ dirty-sectors.ts                # pure ChangeSet -> dirty sector list
│  │  ├─ geometry/
│  │  │  ├─ read-sector-surface.ts          # bounded Terrain read -> coherent snapshot
│  │  │  ├─ presentation-normal.ts          # semantic incident triangles -> upward normal
│  │  │  └─ build-sector-geometry.ts        # pure typed arrays + thin BufferGeometry adapter
│  │  ├─ picking/
│  │  │  └─ semantic-pick.ts                # Raycaster candidate -> World/Terrain semantic result
│  │  ├─ resources/
│  │  │  ├─ terrain-material.ts             # one shared material factory
│  │  │  └─ sector-resource.ts              # Mesh/geometry ownership + idempotent resource dispose
│  │  └─ projection/
│  │     ├─ sector-registry.ts               # closure-owned coord -> resource bookkeeping
│  │     └─ terrain-projection.ts            # thin lifecycle/revision/rebuild orchestrator
│  ├─ composition/
│  │  └─ create-terrain.ts                   # internal projection constructor trampoline target
│  └─ composition.ts                         # public app-only createTerrainThreeProjection
├─ tests/
│  ├─ helpers/
│  │  └─ presentation-fixture.ts             # full grid/test MapDefinition/Terrain read helpers
│  ├─ render-sector.test.ts
│  ├─ dirty-sectors.test.ts
│  ├─ sector-surface.test.ts
│  ├─ presentation-normal.test.ts
│  ├─ semantic-pick.test.ts
│  └─ terrain-projection.test.ts

apps/game/
├─ package.json                              # test/dev World+Terrain deps only for P1-F harness
├─ terrain-phase-1.html                      # test-only Vite entry
├─ src/
│  └─ presentation/create-scene.ts           # discriminated Scene capability; renderer stays private
└─ tests/
   └─ terrain-phase-1-harness.ts              # real WebGL projection/Raycaster acceptance harness

tests/browser/
└─ terrain-phase-1.spec.ts

pnpm-lock.yaml
```

Do not add barrels under `presentation/three`; direct internal imports make ownership/dependency cycles visible. Do not add generic `ports`, `services`, `managers`, or `utils` folders.

---

## Canonical P1-F Internal Interface Ledger

These names are the implementation-plan authority. Later tasks consume them exactly unless execution uncovers a frozen contradiction.

```ts
// presentation/three/topology/render-sector.ts
export const RENDER_SECTOR_CELLS = 64 as const;

export interface RenderSectorCoord {
  readonly x: number;
  readonly z: number;
}

export interface RenderSectorLayout {
  readonly widthCells: number;
  readonly heightCells: number;
  readonly cellSizeMeters: number;
  readonly cellsPerSector: typeof RENDER_SECTOR_CELLS;
  readonly sectorCountX: number;
  readonly sectorCountZ: number;
  readonly totalSectors: number;
  readonly vertexAxisCount: number;
}

export function createRenderSectorLayout(
  mapDefinition: Pick<
    MapDefinitionRead,
    "widthCells" | "heightCells" | "cellSizeMeters"
  >,
): RenderSectorLayout;

export function allRenderSectorCoords(
  layout: RenderSectorLayout,
): readonly RenderSectorCoord[];

export function renderSectorForCell(
  layout: RenderSectorLayout,
  cell: CellCoord,
): RenderSectorCoord | undefined;

export function renderSectorCellBounds(
  layout: RenderSectorLayout,
  sector: RenderSectorCoord,
): CellRect;

export function renderSectorKey(coord: RenderSectorCoord): string;
export function compareRenderSectorCoord(
  left: RenderSectorCoord,
  right: RenderSectorCoord,
): number;
```

```ts
// domain/surface.ts — internal canonical topology token, not root export
export type TerrainCellCorner = "sw" | "se" | "nw" | "ne";

export const TERRAIN_CELL_TRIANGLE_CORNERS = {
  SW_TRIANGLE: ["sw", "se", "nw"],
  NE_TRIANGLE: ["nw", "se", "ne"],
} as const satisfies Readonly<
  Record<TerrainTriangle, readonly [TerrainCellCorner, TerrainCellCorner, TerrainCellCorner]>
>;
```

```ts
// geometry/read-sector-surface.ts
export interface VertexBounds {
  readonly xStartInclusive: number;
  readonly zStartInclusive: number;
  readonly xEndInclusive: number;
  readonly zEndInclusive: number;
}

export interface SectorSurfaceSnapshot {
  readonly sector: RenderSectorCoord;
  readonly revision: TerrainRevision;
  readonly visibleVertices: VertexBounds;
  readonly haloVertices: VertexBounds;
  elevationAt(vertex: VertexCoord): LogicalElevation;
}

export function readSectorSurface(input: {
  readonly layout: RenderSectorLayout;
  readonly sector: RenderSectorCoord;
  readonly terrain: TerrainAuthorityRead;
}): SectorSurfaceSnapshot;
```

```ts
// geometry/presentation-normal.ts
export interface PresentationNormal {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function computePresentationNormal(input: {
  readonly snapshot: SectorSurfaceSnapshot;
  readonly world: WorldSpatialRead;
  readonly vertex: VertexCoord;
  readonly cellSizeMeters: number;
}): PresentationNormal;
```

```ts
// geometry/build-sector-geometry.ts
export interface SectorGeometryData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint16Array;
}

export function buildSectorGeometryData(input: {
  readonly layout: RenderSectorLayout;
  readonly sector: RenderSectorCoord;
  readonly snapshot: SectorSurfaceSnapshot;
  readonly world: WorldSpatialRead;
}): SectorGeometryData;

export function createSectorBufferGeometry(
  data: SectorGeometryData,
): BufferGeometry;
```

```ts
// picking/semantic-pick.ts
export interface TerrainRaycastCandidate {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function resolveSemanticTerrainCandidate(input: {
  readonly candidate: TerrainRaycastCandidate;
  readonly world: WorldSpatialRead;
  readonly terrain: TerrainAuthorityRead;
}): TerrainSemanticPickResult;

export function pickSemanticTerrain(input: {
  readonly raycaster: Raycaster;
  readonly root: Group;
  readonly world: WorldSpatialRead;
  readonly terrain: TerrainAuthorityRead;
}): TerrainSemanticPickResult;
```

```ts
// contracts/terrain-three.ts — exported only from ./composition
export interface TerrainSemanticPick {
  readonly cell: CellCoord;
  readonly triangle: TerrainTriangle;
  readonly heightQ16: number;
  readonly riseX: number;
  readonly riseZ: number;
  readonly revision: TerrainRevision;
}

export type TerrainSemanticPickResult =
  | { readonly status: "hit"; readonly value: TerrainSemanticPick }
  | {
      readonly status: "miss";
      readonly reason: "NO_TERRAIN_INTERSECTION" | "WORLD_POSITION_OUT_OF_BOUNDS";
    }
  | {
      readonly status: "unavailable";
      readonly code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE";
      readonly chunk: ChunkCoord;
    };

export interface TerrainThreeProjection {
  readonly root: Group;
  rebuild(changeSet: TerrainChangeSet): void;
  pick(raycaster: Raycaster): TerrainSemanticPickResult;
  dispose(): void;
}

export interface CreateTerrainThreeProjectionInput {
  readonly mapDefinition: Pick<
    MapDefinitionRead,
    "widthCells" | "heightCells" | "cellSizeMeters"
  >;
  readonly world: WorldSpatialRead;
  readonly terrain: TerrainAuthorityRead;
}

export type TerrainThreeProjectionConstructionResult =
  | { readonly status: "success"; readonly value: TerrainThreeProjection }
  | {
      readonly status: "rejected";
      readonly code: "TERRAIN_PRESENTATION_TERRAIN_INCOMPLETE";
    };
```

```ts
// resources/sector-resource.ts
export interface SectorResource {
  readonly coord: RenderSectorCoord;
  readonly geometry: BufferGeometry;
  readonly mesh: Mesh;
  dispose(): void;
}

export function createSectorResource(input: {
  readonly coord: RenderSectorCoord;
  readonly geometry: BufferGeometry;
  readonly material: Material;
}): SectorResource;
```

```ts
// projection/sector-registry.ts
export interface SectorRegistry {
  size(): number;
  get(coord: RenderSectorCoord): SectorResource | undefined;
  insert(resource: SectorResource): void;
  replace(resource: SectorResource): SectorResource;
  values(): readonly SectorResource[];
  clear(): readonly SectorResource[];
}

export function createSectorRegistry(): SectorRegistry;
```

---

# Task 1: Establish pure render-sector topology and one canonical triangle-corner order

**Files:**
- Create: `systems/terrain/src/presentation/three/topology/render-sector.ts`
- Modify: `systems/terrain/src/domain/surface.ts`
- Test: `systems/terrain/tests/render-sector.test.ts`
- Modify/Test: `systems/terrain/tests/surface.test.ts`

**Interfaces:**
- Consumes `MapDefinitionRead`, `CellCoord`, `CellRect` from `@web-three-city/world` root and existing `TerrainTriangle` from Terrain domain.
- Produces `RENDER_SECTOR_CELLS`, `RenderSectorCoord`, `RenderSectorLayout`, canonical sector enumeration/mapping functions, and `TERRAIN_CELL_TRIANGLE_CORNERS` used by all later geometry/normal code.
- No Three.js dependency is introduced in this task.

- [ ] **Step 1: Write RED tests for layout derivation and sector mapping**

Create `render-sector.test.ts` with exact production vectors and derivation assertions:

```ts
const layout = createRenderSectorLayout(TEST_MAP_DEFINITION);

expect(layout).toEqual({
  widthCells: 512,
  heightCells: 512,
  cellSizeMeters: 8,
  cellsPerSector: 64,
  sectorCountX: 8,
  sectorCountZ: 8,
  totalSectors: 64,
  vertexAxisCount: 65,
});
expect(allRenderSectorCoords(layout)).toHaveLength(64);
expect(allRenderSectorCoords(layout)[0]).toEqual({ x: 0, z: 0 });
expect(allRenderSectorCoords(layout)[63]).toEqual({ x: 7, z: 7 });
```

Add seam/boundary mappings:

```ts
expect(renderSectorForCell(layout, { x: 63, z: 63 })).toEqual({ x: 0, z: 0 });
expect(renderSectorForCell(layout, { x: 64, z: 63 })).toEqual({ x: 1, z: 0 });
expect(renderSectorForCell(layout, { x: 63, z: 64 })).toEqual({ x: 0, z: 1 });
expect(renderSectorForCell(layout, { x: 64, z: 64 })).toEqual({ x: 1, z: 1 });
expect(renderSectorForCell(layout, { x: 511, z: 511 })).toEqual({ x: 7, z: 7 });
expect(renderSectorForCell(layout, { x: 512, z: 0 })).toBeUndefined();
expect(renderSectorForCell(layout, { x: -1, z: 0 })).toBeUndefined();
```

Assert exhaustive coverage with no gaps/overlaps by enumerating all 512×512 Cells and counting exactly one sector mapping per Cell.

- [ ] **Step 2: Write RED test for one canonical triangle-corner order**

Extend `surface.test.ts` or `render-sector.test.ts`:

```ts
expect(TERRAIN_CELL_TRIANGLE_CORNERS).toEqual({
  SW_TRIANGLE: ["sw", "se", "nw"],
  NE_TRIANGLE: ["nw", "se", "ne"],
});
```

This prevents geometry indices and normal incident-triangle logic from each re-authoring the diagonal.

- [ ] **Step 3: Run RED and confirm behavioral failure**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/render-sector.test.ts tests/surface.test.ts
```

Expected: FAIL because render-sector topology exports and `TERRAIN_CELL_TRIANGLE_CORNERS` do not exist. A syntax/setup failure is not sufficient; fix setup until assertions fail for missing behavior.

- [ ] **Step 4: Implement the minimal pure layout functions**

`render-sector.ts` must centralize only the presentation-owned 64-Cell partition:

```ts
export const RENDER_SECTOR_CELLS = 64 as const;

export function createRenderSectorLayout(mapDefinition: Pick<MapDefinitionRead, "widthCells" | "heightCells" | "cellSizeMeters">): RenderSectorLayout {
  if (
    mapDefinition.widthCells % RENDER_SECTOR_CELLS !== 0 ||
    mapDefinition.heightCells % RENDER_SECTOR_CELLS !== 0
  ) {
    throw new Error("Render-sector layout requires map dimensions divisible by RENDER_SECTOR_CELLS.");
  }

  const sectorCountX = mapDefinition.widthCells / RENDER_SECTOR_CELLS;
  const sectorCountZ = mapDefinition.heightCells / RENDER_SECTOR_CELLS;

  return Object.freeze({
    widthCells: mapDefinition.widthCells,
    heightCells: mapDefinition.heightCells,
    cellSizeMeters: mapDefinition.cellSizeMeters,
    cellsPerSector: RENDER_SECTOR_CELLS,
    sectorCountX,
    sectorCountZ,
    totalSectors: sectorCountX * sectorCountZ,
    vertexAxisCount: RENDER_SECTOR_CELLS + 1,
  });
}
```

`allRenderSectorCoords()` returns frozen/plain readonly coordinate records in `(z,x)` order. `renderSectorForCell()` validates integer/range and returns `undefined` rather than clamping. `renderSectorCellBounds()` derives bounds from `cellsPerSector`; it never repeats `64`.

- [ ] **Step 5: Implement the canonical triangle-corner token in `domain/surface.ts`**

Add the exact ledger constant without changing `evaluateSurface()` semantics. Do not export this through Terrain root; presentation imports the internal domain module because it is same-owner code.

- [ ] **Step 6: Run GREEN and focused architecture regression**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/render-sector.test.ts tests/surface.test.ts
pnpm --filter @web-three-city/terrain typecheck
pnpm architecture:check
```

Expected: PASS and architecture remains zero violations.

- [ ] **Step 7: Commit**

```bash
git add systems/terrain/src/domain/surface.ts systems/terrain/src/presentation/three/topology/render-sector.ts systems/terrain/tests/render-sector.test.ts systems/terrain/tests/surface.test.ts
git commit -m "feat(terrain): define render sector topology"
```

---

# Task 2: Implement pure localized dirty-sector invalidation

**Files:**
- Create: `systems/terrain/src/presentation/three/topology/dirty-sectors.ts`
- Test: `systems/terrain/tests/dirty-sectors.test.ts`

**Interfaces:**
- Consumes `RenderSectorLayout`, `RenderSectorCoord`, `renderSectorForCell`, canonical comparator/key, and `TerrainChangeSet`.
- Produces `computeDirtyRenderSectors(layout, changeSet): readonly RenderSectorCoord[]`.
- This module must not import `three` and must not inspect `changedVertices` to invent new World incidence; `affectedCells` is the authoritative invalidation seed.

- [ ] **Step 1: Write RED interior/locality test**

```ts
const changeSet = changeSetWithAffectedCells([{ x: 130, z: 130 }]);
expect(computeDirtyRenderSectors(layout, changeSet)).toEqual([
  { x: 2, z: 2 },
]);
```

The one-Cell Moore expansion stays within sector `(2,2)`.

- [ ] **Step 2: Write RED seam/corner expansion tests**

Use affected Cell `(63,63)` so expansion reaches both render-sector seams:

```ts
expect(computeDirtyRenderSectors(
  layout,
  changeSetWithAffectedCells([{ x: 63, z: 63 }]),
)).toEqual([
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: 1, z: 1 },
]);
```

Also cover `(63,100)` for two horizontal sectors, `(100,63)` for two vertical sectors, duplicate affected Cells, and map corner `(0,0)` clipping.

- [ ] **Step 3: Write RED canonical-order and no-global-fallback test**

Supply affected Cells in reverse/random caller order. Assert identical sorted result and `result.length < layout.totalSectors` for localized vectors.

- [ ] **Step 4: Run RED**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/dirty-sectors.test.ts
```

Expected: FAIL because `dirty-sectors.ts` is absent.

- [ ] **Step 5: Implement one-Cell Moore expansion as a pure function**

Use one named offset tuple:

```ts
const MOORE_OFFSETS = [-1, 0, 1] as const;
```

For each `affectedCell`, derive candidate neighbors, pass them through `renderSectorForCell(layout, candidate)` for range clipping, de-duplicate via `renderSectorKey`, then sort once with `compareRenderSectorCoord`. Do not hardcode sector-axis limits.

- [ ] **Step 6: Run GREEN and prove module isolation**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/dirty-sectors.test.ts
pnpm --filter @web-three-city/terrain typecheck
pnpm architecture:check
```

Additionally inspect the module and confirm it imports no `three`, DOM, Terrain application internals, or app code.

- [ ] **Step 7: Commit**

```bash
git add systems/terrain/src/presentation/three/topology/dirty-sectors.ts systems/terrain/tests/dirty-sectors.test.ts
git commit -m "feat(terrain): localize render sector invalidation"
```

---

# Task 3: Capture one coherent Terrain surface snapshot per render sector

**Files:**
- Create: `systems/terrain/src/presentation/three/geometry/read-sector-surface.ts`
- Create: `systems/terrain/tests/sector-surface.test.ts`
- Create/Modify: `systems/terrain/tests/helpers/presentation-fixture.ts`

**Interfaces:**
- Consumes `RenderSectorLayout`, `RenderSectorCoord`, `renderSectorCellBounds`, `TerrainAuthorityRead`, `VertexCoord`, and `LogicalElevation`.
- Produces `SectorSurfaceSnapshot` with visible/halo bounds, one captured `TerrainRevision`, and an immutable `elevationAt(vertex)` capability.
- This task still adds no Three.js dependency.

- [ ] **Step 1: Build a reusable presentation test fixture without importing World composition**

`presentation-fixture.ts` defines `TEST_MAP_DEFINITION` using the existing frozen World values and a deterministic `createPresentationWorldSpatialRead()` capability implementing only the public grid reads needed by presentation tests. Because Terrain tests previously triggered architecture enforcement when importing World `./composition`, tests must consume the World root contract only.

Provide a functional Terrain read helper:

```ts
export function createFunctionalTerrainRead(
  elevation: (x: number, z: number) => number,
  revision = 0,
): TerrainAuthorityRead;
```

The helper implements `elevationAt`, `cellSurface`, and `sampleSurface` from deterministic test data and returns `completeness() === "full"` unless a test explicitly overrides it. Reuse `evaluateSurface()` for sample semantics rather than duplicating Q16 formulas in the fixture.

- [ ] **Step 2: Write RED visible-window and halo tests**

For sector `(1,1)`:

```ts
const snapshot = readSectorSurface({ layout, sector: { x: 1, z: 1 }, terrain });
expect(snapshot.visibleVertices).toEqual({
  xStartInclusive: 64,
  zStartInclusive: 64,
  xEndInclusive: 128,
  zEndInclusive: 128,
});
expect(snapshot.haloVertices).toEqual({
  xStartInclusive: 63,
  zStartInclusive: 63,
  xEndInclusive: 129,
  zEndInclusive: 129,
});
```

Assert exactly `67 * 67` elevation reads for an interior sector and no repeated Terrain reads for the same halo Vertex.

- [ ] **Step 3: Write RED map-edge clipping tests**

For `(0,0)`, halo begins at zero and ends at visible max + 1. For `(7,7)`, halo clips to map vertex maximum 512. Assert out-of-snapshot `snapshot.elevationAt()` throws rather than fabricating/clamping data.

- [ ] **Step 4: Write RED coherent-revision failure test**

Use a Terrain read fixture whose `revision()` changes between the pre-read and post-read calls. Assert `readSectorSurface()` throws a deterministic invariant error and returns no snapshot.

Also make one required elevation return `unavailable` and assert construction fails before publishing a snapshot.

- [ ] **Step 5: Run RED**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/sector-surface.test.ts
```

Expected: FAIL because snapshot implementation is absent.

- [ ] **Step 6: Implement bounded one-pass snapshot capture**

Calculate visible vertex bounds from `renderSectorCellBounds()`. Derive halo bounds by subtracting/adding one and clipping against `layout.widthCells` / `layout.heightCells`, which are the maximum valid Vertex coordinates.

Capture `beforeRevision`, visit halo Vertices once in canonical `(z,x)` order, place integer elevations in an internal `Int32Array`, then capture `afterRevision`. If revisions differ, throw. Do not expose the typed array; return an `elevationAt()` closure that translates valid captured World coordinates to the private offset.

No Three.js object or Vector allocation is needed.

- [ ] **Step 7: Run GREEN and regression**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/sector-surface.test.ts
pnpm --filter @web-three-city/terrain typecheck
pnpm architecture:check
```

- [ ] **Step 8: Commit**

```bash
git add systems/terrain/src/presentation/three/geometry/read-sector-surface.ts systems/terrain/tests/sector-surface.test.ts systems/terrain/tests/helpers/presentation-fixture.ts
git commit -m "feat(terrain): capture coherent sector surface snapshots"
```

---

# Task 4: Build deterministic BufferGeometry and seam-safe global presentation normals

**Files:**
- Modify: `systems/terrain/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `systems/terrain/src/presentation/three/geometry/presentation-normal.ts`
- Create: `systems/terrain/src/presentation/three/geometry/build-sector-geometry.ts`
- Modify/Test: `systems/terrain/tests/render-sector.test.ts`
- Create/Test: `systems/terrain/tests/presentation-normal.test.ts`

**Interfaces:**
- Adds `three: 0.179.1` to Terrain production dependencies and `@types/three: 0.179.0` to Terrain devDependencies. Add no other dependency.
- Consumes `SectorSurfaceSnapshot`, `WorldSpatialRead`, `RenderSectorLayout`, canonical `TERRAIN_CELL_TRIANGLE_CORNERS`, and Terrain-owned `logicalElevationToMeters()`.
- Produces pure `SectorGeometryData`, pure `computePresentationNormal()`, and thin `createSectorBufferGeometry()`.

- [ ] **Step 1: Add Three.js dependencies and refresh workspace links before RED**

Edit `systems/terrain/package.json`:

```json
"dependencies": {
  "@web-three-city/foundation-contracts": "workspace:*",
  "@web-three-city/world": "workspace:*",
  "three": "0.179.1"
},
"devDependencies": {
  "@types/three": "0.179.0",
  "typescript": "5.9.2",
  "vitest": "3.2.4"
}
```

Then run exactly:

```bash
pnpm install --ignore-scripts
pnpm rebuild esbuild
```

Commit the resulting lockfile only with this task.

- [ ] **Step 2: Write RED geometry-array tests before implementation**

For a flat/known field and sector `(0,0)` assert derived counts:

```ts
const data = buildSectorGeometryData({ layout, sector, snapshot, world });
expect(data.positions.length).toBe(65 * 65 * 3);
expect(data.normals.length).toBe(65 * 65 * 3);
expect(data.indices.length).toBe(8192 * 3);
expect([...data.indices.slice(0, 6)]).toEqual([0, 1, 65, 65, 1, 66]);
```

These numeric vectors live in tests as acceptance facts; production code derives them from layout and canonical corner tokens.

- [ ] **Step 3: Write RED position-projection/no-magic-scale test**

Use `TEST_MAP_DEFINITION.cellSizeMeters` and a known elevation. Assert position X/Z derives from the map definition and Y equals `logicalElevationToMeters(elevation)`. Include an adjacent sector seam Vertex and assert duplicated position triples are numerically identical.

- [ ] **Step 4: Write RED flat/interior/edge/corner normal tests**

Flat field:

```ts
expectNormalClose(
  computePresentationNormal({ snapshot, world, vertex: { x: 10, z: 10 }, cellSizeMeters: TEST_MAP_DEFINITION.cellSizeMeters }),
  { x: 0, y: 1, z: 0 },
);
```

Also cover world corner `(0,0)`, world edge, and an interior Vertex so incident semantic triangle filtering is correct.

- [ ] **Step 5: Write RED cross-sector seam-normal test**

Use a non-flat deterministic field and World Vertex `{ x: 64, z: 96 }`. Capture sector snapshots from both sides and calculate the normal from each snapshot. Assert component-wise equivalence and approximately unit length.

The fixture must be chosen so a sector-local-only normal algorithm would differ, proving the test catches the prohibited shortcut.

- [ ] **Step 6: Run RED**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/render-sector.test.ts tests/presentation-normal.test.ts
```

Expected: FAIL because geometry/normal functions do not exist.

- [ ] **Step 7: Implement `computePresentationNormal()` without `Vector3` allocations in the vertex loop**

For each valid incident Cell returned by `world.incidentCells(vertex)`, construct the four Cell corner coordinates, iterate `TERRAIN_CELL_TRIANGLE_CORNERS`, and include only triangles containing the requested World Vertex. Fetch elevations from `SectorSurfaceSnapshot`, convert Y through `logicalElevationToMeters()`, and calculate numeric cross products.

Orient each non-zero face normal upward before accumulation:

```ts
if (ny < 0) {
  nx = -nx;
  ny = -ny;
  nz = -nz;
}
```

Normalize once after all incident faces. If accumulated length is zero, throw an invariant error instead of returning NaN/default data.

- [ ] **Step 8: Implement pure typed geometry arrays**

Allocate exact arrays from derived values:

```ts
const vertexAxis = layout.vertexAxisCount;
const vertexCount = vertexAxis * vertexAxis;
const cellCount = layout.cellsPerSector * layout.cellsPerSector;
const triangleCount = cellCount * 2;
const indexCount = triangleCount * 3;

const positions = new Float32Array(vertexCount * 3);
const normals = new Float32Array(vertexCount * 3);
const indices = new Uint16Array(indexCount);
```

Loop visible vertices in `(z,x)` order. X/Z use `layout.cellSizeMeters`; Y uses `logicalElevationToMeters(snapshot.elevationAt(vertex))`. Normals come only from `computePresentationNormal()`.

Generate per-Cell indices from `TERRAIN_CELL_TRIANGLE_CORNERS` via a local corner-index lookup so triangle order has one canonical semantic owner. Do not call `computeVertexNormals()`.

- [ ] **Step 9: Implement the thin Three.js adapter**

`createSectorBufferGeometry(data)` allocates one `BufferGeometry`, attaches `BufferAttribute`s for positions/normals, attaches the `Uint16Array` index, then calls `computeBoundingBox()` and `computeBoundingSphere()` once. It contains no Terrain/World queries.

- [ ] **Step 10: Run GREEN and package regression**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/render-sector.test.ts tests/presentation-normal.test.ts
pnpm --filter @web-three-city/terrain test
pnpm --filter @web-three-city/terrain typecheck
pnpm architecture:check
```

Expected: existing semantic tests remain GREEN and architecture has zero violations.

- [ ] **Step 11: Commit**

```bash
git add systems/terrain/package.json pnpm-lock.yaml systems/terrain/src/presentation/three/geometry systems/terrain/tests/render-sector.test.ts systems/terrain/tests/presentation-normal.test.ts
git commit -m "feat(terrain): build deterministic sector geometry"
```

---
# Task 5: Implement semantic picking as candidate detection plus authoritative re-query

**Files:**
- Create: `systems/terrain/src/contracts/terrain-three.ts`
- Create: `systems/terrain/src/presentation/three/picking/semantic-pick.ts`
- Create: `systems/terrain/tests/semantic-pick.test.ts`

**Interfaces:**
- Consumes Three.js `Raycaster`/`Group`, `WorldSpatialRead`, `TerrainAuthorityRead`, `Q16_ONE`, and the composition-only `TerrainSemanticPickResult` contract.
- Produces `resolveSemanticTerrainCandidate()` for deterministic candidate-to-semantic conversion and `pickSemanticTerrain()` for the thin Raycaster adapter.
- The semantic result contains no Mesh, Vector3, face, UV, sector coordinate, or raw Raycaster Y.

- [ ] **Step 1: Write RED candidate-Y independence test**

Resolve two candidates with identical X/Z but radically different Y:

```ts
const low = resolveSemanticTerrainCandidate({
  candidate: { x: 4, y: -10_000, z: 4 },
  world,
  terrain,
});
const high = resolveSemanticTerrainCandidate({
  candidate: { x: 4, y: 10_000, z: 4 },
  world,
  terrain,
});
expect(high).toEqual(low);
```

Assert the hit value equals the actual `terrain.sampleSurface()` result for the resolved Cell/Q16 coordinate.

- [ ] **Step 2: Write RED half-open Cell and Q16 conversion tests**

Use `world.cellBounds()` as the only meter-to-local authority. Assert a point in the center maps to `Q16_ONE / 2`. Assert a point exactly on an east boundary resolves through `worldPositionToCell()` to the adjacent Cell with local `uQ16 = 0`, rather than being clamped into the previous Cell.

Use `Q16_ONE - 1` as the upper local pick limit; do not author `65535` separately in production code.

- [ ] **Step 3: Write RED miss/unavailable tests**

Cover:

```text
no Raycaster intersection -> { status: "miss", reason: "NO_TERRAIN_INTERSECTION" }
World X/Z out of bounds -> { status: "miss", reason: "WORLD_POSITION_OUT_OF_BOUNDS" }
Terrain sample unavailable -> { status: "unavailable", code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE", chunk }
```

A World `cellBounds()` rejection after successful `worldPositionToCell()` and Terrain out-of-bounds after a valid Cell are programming invariants and should throw rather than be silently reclassified.

- [ ] **Step 4: Write RED real Raycaster test without WebGLRenderer**

Create one actual Three.js Mesh from `createSectorBufferGeometry()`, add it to a Group, update matrices, construct a Raycaster from above, and assert `pickSemanticTerrain()` returns a semantic hit. This proves the adapter uses actual Three intersection behavior while remaining browser-independent.

- [ ] **Step 5: Run RED**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/semantic-pick.test.ts
```

Expected: FAIL because the contracts/helper are absent.

- [ ] **Step 6: Implement composition-only semantic pick contracts**

Create `contracts/terrain-three.ts` with `TerrainSemanticPick` and `TerrainSemanticPickResult` from the interface ledger. Do not export it from Terrain root or `./commands`.

- [ ] **Step 7: Implement pure candidate conversion**

`resolveSemanticTerrainCandidate()` performs:

```text
candidate X/Z
-> world.worldPositionToCell
-> world.cellBounds
-> derive localX/localZ
-> derive cellWidth/cellDepth from bounds
-> round(local / span * Q16_ONE)
-> clamp only to [0, Q16_ONE - 1]
-> terrain.sampleSurface
-> semantic result
```

The function receives `candidate.y` only because the Raycaster candidate is a 3D point; it never reads that property.

- [ ] **Step 8: Implement the thin Raycaster adapter**

`pickSemanticTerrain()` calls:

```ts
const [intersection] = input.raycaster.intersectObject(input.root, true);
```

Return `NO_TERRAIN_INTERSECTION` when absent. Otherwise create a plain candidate from `intersection.point.x/y/z` and delegate to `resolveSemanticTerrainCandidate()`. No geometry math belongs here.

- [ ] **Step 9: Run GREEN and regression**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/semantic-pick.test.ts
pnpm --filter @web-three-city/terrain typecheck
pnpm architecture:check
```

- [ ] **Step 10: Commit**

```bash
git add systems/terrain/src/contracts/terrain-three.ts systems/terrain/src/presentation/three/picking/semantic-pick.ts systems/terrain/tests/semantic-pick.test.ts
git commit -m "feat(terrain): resolve semantic terrain picks"
```

---

# Task 6: Implement explicit shared material, sector resource, and functional registry ownership

**Files:**
- Create: `systems/terrain/src/presentation/three/resources/terrain-material.ts`
- Create: `systems/terrain/src/presentation/three/resources/sector-resource.ts`
- Create: `systems/terrain/src/presentation/three/projection/sector-registry.ts`
- Create/Modify: `systems/terrain/tests/terrain-projection.test.ts`

**Interfaces:**
- Consumes Three.js `MeshBasicMaterial`, `DoubleSide`, `Mesh`, `BufferGeometry`, `Material`, and render-sector key/order helpers.
- Produces `createTerrainMaterial()`, `createSectorResource()`, and `createSectorRegistry()`.
- Resource/registry modules do not read Terrain or World and do not calculate dirty sets.

- [ ] **Step 1: Write RED shared-material/resource ownership tests**

Create one material and two sector resources. Assert both meshes reference the exact same material object and each resource owns a different geometry.

Use Three.js `dispose` event listeners:

```ts
let geometryDisposeCount = 0;
geometry.addEventListener("dispose", () => { geometryDisposeCount += 1; });
resource.dispose();
resource.dispose();
expect(geometryDisposeCount).toBe(1);
```

Assert resource disposal does not dispose the shared material.

- [ ] **Step 2: Write RED registry behavior tests**

```ts
const registry = createSectorRegistry();
registry.insert(resource00);
registry.insert(resource10);
expect(registry.values().map(({ coord }) => coord)).toEqual([
  { x: 0, z: 0 },
  { x: 1, z: 0 },
]);
expect(registry.replace(replacement00)).toBe(resource00);
expect(registry.get({ x: 0, z: 0 })).toBe(replacement00);
expect(registry.clear()).toEqual([replacement00, resource10]);
expect(registry.size()).toBe(0);
```

Duplicate `insert()` and `replace()` of a missing key must throw deterministic invariant errors. Registry never disposes resources itself.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/terrain-projection.test.ts
```

Expected: FAIL because resource/registry factories are absent.

- [ ] **Step 4: Implement one shared Terrain material factory**

Keep visual configuration centralized in `terrain-material.ts`:

```ts
const PHASE_1_TERRAIN_COLOR = 0x6f8f63;

export function createTerrainMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: PHASE_1_TERRAIN_COLOR,
    side: DoubleSide,
  });
}
```

`DoubleSide` is a Phase-1 presentation choice that makes the fixed semantic triangle winding visible/raycastable from either side without changing semantic topology. It is not gameplay authority. Do not create a material per sector.

- [ ] **Step 5: Implement idempotent sector-resource factory using closure state**

`createSectorResource()` constructs one Mesh, assigns a deterministic presentation name derived from `renderSectorKey(coord)`, and returns a record whose `dispose()` closure tracks its own disposed flag and disposes only its owned geometry exactly once. It does not remove itself from a Group and does not dispose the shared material.

- [ ] **Step 6: Implement registry as a closure over a private Map**

No class. Key resources using `renderSectorKey`. `values()` and `clear()` return canonical `(z,x)` sorted copies rather than relying on Map insertion order. `replace()` swaps only the requested key and returns the superseded resource without disposing it.

- [ ] **Step 7: Run GREEN**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/terrain-projection.test.ts
pnpm --filter @web-three-city/terrain typecheck
pnpm architecture:check
```

- [ ] **Step 8: Commit**

```bash
git add systems/terrain/src/presentation/three/resources systems/terrain/src/presentation/three/projection/sector-registry.ts systems/terrain/tests/terrain-projection.test.ts
git commit -m "feat(terrain): own projection sector resources"
```

---

# Task 7: Implement the revision-safe staged TerrainThreeProjection lifecycle

**Files:**
- Modify: `systems/terrain/src/contracts/terrain-three.ts`
- Create: `systems/terrain/src/presentation/three/projection/terrain-projection.ts`
- Modify: `systems/terrain/src/composition/create-terrain.ts`
- Modify: `systems/terrain/src/composition.ts`
- Modify/Test: `systems/terrain/tests/terrain-projection.test.ts`
- Modify/Test: `systems/terrain/tests/public-surface.test.ts`

**Interfaces:**
- Consumes all prior P1-F pure/resource modules plus `CreateTerrainThreeProjectionInput`.
- Produces final `TerrainThreeProjection`, `TerrainThreeProjectionConstructionResult`, internal `createTerrainThreeProjectionInternal()`, and public `createTerrainThreeProjection()` from Terrain `./composition` only.
- `terrain-projection.ts` is an orchestrator only. It must not contain sector mapping, triangle-index math, Q16 math, normal cross products, or resource-disposal implementation details.

- [ ] **Step 1: Write RED incomplete-authority construction test**

Pass `terrain.completeness() === "partial"` and assert:

```ts
expect(createTerrainThreeProjectionInternal(input)).toEqual({
  status: "rejected",
  code: "TERRAIN_PRESENTATION_TERRAIN_INCOMPLETE",
});
```

No Group/material/geometry should be published.

- [ ] **Step 2: Write RED full initial-build test**

With full deterministic test Terrain:

```ts
const result = createTerrainThreeProjectionInternal(input);
expect(result.status).toBe("success");
if (result.status !== "success") return;
expect(result.value.root.children).toHaveLength(64);
expect(new Set(result.value.root.children.map((mesh) => (mesh as Mesh).material)).size).toBe(1);
```

Capture the material and representative sector Mesh identities for later lifecycle assertions. Add a fixture whose Terrain revision changes after an early sector snapshot and assert initial construction fails/cleans up rather than publishing a projection containing sectors from mixed revisions.

- [ ] **Step 3: Write RED localized replacement/identity test**

Use a real `TerrainChangeSet` vector whose affected Cells remain inside one render sector. Capture all root child identities before rebuild, call `projection.rebuild(changeSet)`, and assert exactly the dirty sector resource identity changed while unaffected sector Mesh objects remain identical.

Attach a `dispose` listener to the replaced geometry and assert exactly one disposal. Assert the shared material emits zero dispose events during rebuild.

- [ ] **Step 4: Write RED staged-rebuild rollback test**

Use a toggled test Terrain read that succeeds for initial construction but fails one elevation query while rebuilding the second of multiple dirty sectors. Before calling rebuild, capture all live Mesh identities and disposal counts.

Expected behavior:

```text
rebuild throws
all old registry/root Mesh identities remain installed
no old geometry was disposed
any newly staged replacement geometry was disposed
projected revision remains unchanged
```

This is the strong exception-safety proof for presentation replacement.

- [ ] **Step 5: Write RED revision-continuity tests**

Assert rebuild rejects/throws before resource mutation when:

```text
changeSet.previousRevision !== projectedRevision
changeSet.newRevision !== terrain.revision()
a staged SectorSurfaceSnapshot revision !== changeSet.newRevision
Terrain revision changes again between staging and live swap
```

Also assert a malformed revision-advancing change set with zero dirty sectors fails loudly; only a true no-op where `previousRevision === newRevision === projectedRevision` may return without replacement.

Then prove a failed presentation rebuild can be retried with the same `TerrainChangeSet` after the transient presentation read problem is removed, because canonical Terrain remains at `newRevision` while projection remains at `previousRevision`.

- [ ] **Step 6: Write RED disposal/use-after-dispose tests**

Call `projection.dispose()` twice. Assert:

```text
all 64 geometries disposed exactly once
shared material disposed exactly once
root has zero children / detached from parent when attached
second dispose does nothing
```

`rebuild()` and `pick()` after disposal are programming errors and must throw rather than silently operate on released resources.

- [ ] **Step 7: Run RED**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/terrain-projection.test.ts tests/public-surface.test.ts
```

Expected: FAIL because the projection constructor/public composition surface is incomplete.

- [ ] **Step 8: Implement one private sector-build pipeline function**

Inside `terrain-projection.ts`, keep the orchestration readable with a local function equivalent to:

```ts
function buildSectorResource(
  coord: RenderSectorCoord,
  expectedRevision: TerrainRevision,
  context: ProjectionBuildContext,
): SectorResource {
  const snapshot = readSectorSurface({
    layout: context.layout,
    sector: coord,
    terrain: context.terrain,
  });
  if (snapshot.revision !== expectedRevision) {
    throw new Error("Terrain projection sector snapshot revision mismatch.");
  }
  const data = buildSectorGeometryData({
    layout: context.layout,
    sector: coord,
    snapshot,
    world: context.world,
  });
  return createSectorResource({
    coord,
    geometry: createSectorBufferGeometry(data),
    material: context.material,
  });
}
```

This function composes existing responsibilities; it does not duplicate their formulas.

- [ ] **Step 9: Implement initial projection construction with cleanup on failure**

Create layout from `mapDefinition`, capture `projectedRevision = terrain.revision()`, create Group/material/registry, and build `allRenderSectorCoords(layout)` in canonical order with `expectedRevision = projectedRevision`. Every sector snapshot must match that initial revision. After all 64 resources are built, re-read `terrain.revision()` and require it still equals `projectedRevision` before publishing the projection.

If any initial build or final revision check throws, remove/dispose every already-created sector resource and dispose the shared material before rethrowing. No leaked GPU-backed resources and no mixed-revision initial projection.

- [ ] **Step 10: Implement staged localized rebuild transaction**

Algorithm:

```text
assert projection not disposed
assert changeSet.previousRevision === projectedRevision
assert changeSet.newRevision === terrain.revision()
dirty = computeDirtyRenderSectors(layout, changeSet)
if dirty empty and previousRevision === newRevision -> return
if dirty empty and revision advanced -> throw invariant error
stage every replacement resource with expectedRevision = changeSet.newRevision without touching registry/root
if staging throws -> dispose all staged; rethrow
re-read terrain.revision() and require it still equals changeSet.newRevision
for each staged replacement in canonical order:
  old = registry.replace(replacement)
  root.remove(old.mesh)
  root.add(replacement.mesh)
  old.dispose()
projectedRevision = changeSet.newRevision
```

No fallback full rebuild is allowed.

- [ ] **Step 11: Implement `pick()` as a delegate and idempotent projection disposal**

`pick(raycaster)` only invokes `pickSemanticTerrain({ raycaster, root, world, terrain })` after disposed-state validation.

`dispose()` obtains canonical `registry.clear()` resources, removes and disposes each, removes root from its parent if present, disposes the shared material once, and sets the closure `disposed = true`.

- [ ] **Step 12: Expose through the architecture-safe composition trampoline**

`contracts/terrain-three.ts` owns the public signature. `src/composition.ts` must follow the existing private-trampoline pattern so an exported declaration never directly exposes an identifier imported from `presentation/` or internal `composition/` code:

```ts
function constructTerrainThreeProjection(
  input: CreateTerrainThreeProjectionInput,
): TerrainThreeProjectionConstructionResult {
  return createTerrainThreeProjectionInternal(input);
}

export function createTerrainThreeProjection(
  input: CreateTerrainThreeProjectionInput,
): TerrainThreeProjectionConstructionResult {
  return constructTerrainThreeProjection(input);
}
```

Export `CreateTerrainThreeProjectionInput`, `TerrainThreeProjection`, `TerrainThreeProjectionConstructionResult`, and semantic pick result types only from `./composition`, never root/commands.

- [ ] **Step 13: Run GREEN and P1-F package gate**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/terrain-projection.test.ts tests/public-surface.test.ts
pnpm --filter @web-three-city/terrain test
pnpm --filter @web-three-city/terrain typecheck
pnpm architecture:check
```

Expected: zero architecture violations, 64-sector initial projection, localized staged rebuild, revision protection, and idempotent cleanup all GREEN.

- [ ] **Step 14: Commit**

```bash
git add systems/terrain/src/contracts/terrain-three.ts systems/terrain/src/presentation/three/projection/terrain-projection.ts systems/terrain/src/composition systems/terrain/src/composition.ts systems/terrain/tests/terrain-projection.test.ts systems/terrain/tests/public-surface.test.ts
git commit -m "feat(terrain): orchestrate Three.js terrain projection"
```

---

# Task 8: Integrate a real WebGL/Raycaster browser harness without advancing P1-G production composition

**Files:**
- Modify: `apps/game/package.json`
- Modify: `apps/game/tsconfig.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/game/src/presentation/create-scene.ts`
- Create: `apps/game/terrain-phase-1.html`
- Create: `apps/game/tests/terrain-phase-1-harness.ts`
- Create: `tests/browser/terrain-phase-1.spec.ts`
- Preserve: `apps/game/src/bootstrap/main.ts`
- Preserve production behavior: `apps/game/src/composition/create-game.ts` does not construct World/Terrain yet.

**Interfaces:**
- `createScene()` becomes a discriminated capability so available WebGL exposes Scene/Camera/render while unavailable WebGL cannot accidentally expose undefined Three objects.
- The dedicated test harness imports real World/Terrain composition surfaces only from its test-only entry, constructs a real production field using the accepted seed catalog, creates the real Terrain projection, attaches it, renders it, performs a real Raycaster pick, and exposes deterministic DOM diagnostics.

- [ ] **Step 1: Add test/dev World and Terrain dependencies to the app and refresh the lockfile**

During P1-F only, add:

```json
"devDependencies": {
  "@types/three": "0.179.0",
  "@web-three-city/terrain": "workspace:*",
  "@web-three-city/world": "workspace:*",
  "typescript": "5.9.2",
  "vite": "7.1.3"
}
```

Keep `three: 0.179.1` as the existing app production dependency. Run:

```bash
pnpm install --ignore-scripts
pnpm rebuild esbuild
```

P1-G later moves World/Terrain into `dependencies` when the production bootstrap genuinely imports them. Update `apps/game/tsconfig.json` to include both `src/**/*.ts` and `tests/**/*.ts` so the harness remains typechecked while the architecture analyzer still classifies it as `package-test` by path.

- [ ] **Step 2: Write RED scene-capability type/runtime tests through browser behavior**

Before modifying `create-scene.ts`, create `terrain-phase-1.spec.ts` and navigate to `/terrain-phase-1.html`. Assert expected diagnostics that do not exist yet:

```ts
await expect(page.locator("#terrain-phase-1")).toHaveAttribute("data-presentation", "ready");
await expect(page.locator("#terrain-phase-1")).toHaveAttribute("data-terrain-sectors", "64");
await expect(page.locator("#terrain-phase-1")).toHaveAttribute("data-terrain-revision", "0");
await expect(page.locator("#terrain-phase-1")).toHaveAttribute("data-pick-status", "hit");
```

Capture `pageerror` from the beginning.

- [ ] **Step 3: Run browser RED**

```bash
pnpm exec playwright test tests/browser/terrain-phase-1.spec.ts --project=chromium
```

Expected: FAIL because the test page/harness does not exist.

- [ ] **Step 4: Refine `createScene()` as a functional discriminated union**

Use an options record rather than map-specific literals inside the Scene factory:

```ts
export interface SceneCameraConfig {
  readonly fovDegrees: number;
  readonly nearMeters: number;
  readonly farMeters: number;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

export type ScenePresentation =
  | {
      readonly available: true;
      readonly scene: Scene;
      readonly camera: PerspectiveCamera;
      render(): void;
      dispose(): void;
    }
  | {
      readonly available: false;
      render(): void;
      dispose(): void;
    };
```

`createScene(host, options?)` owns Renderer/ResizeObserver and never exports Renderer. Existing `createGame()` continues using the default config and existing bootstrap smoke remains GREEN.

- [ ] **Step 5: Create the dedicated Vite test page**

`apps/game/terrain-phase-1.html` contains only a root element and test-harness module entry. It is not referenced by `index.html` or production bootstrap.

- [ ] **Step 6: Implement test harness using real exported system surfaces and derived configuration**

Harness flow:

```text
prepareProductionWorldDefinition()
-> obtain accepted seed from mapDefinition.acceptedTerrainSeeds[0]
-> prepareProductionTerrain({ world: prepared, seed64: acceptedSeed })
-> createTerrainSystem() from the exact prepared field
-> derive map physical span from mapDefinition width/height * cellSizeMeters
-> createScene() with named overview-camera factors
-> createTerrainThreeProjection({ mapDefinition, world: prepared.spatial, terrain: terrain.read })
-> scene.add(projection.root)
-> scene.render()
-> Raycaster from viewport center -> projection.pick(raycaster)
-> write deterministic DOM dataset diagnostics
```

Do not hardcode production seed in harness logic; read the accepted seed catalog. Do not construct MapState/starting Region; that remains P1-G.

Overview camera literals live as named test-harness constants (for example FOV/far-span multipliers), while world center/span derives from MapDefinition. The harness may use `Raycaster.setFromCamera({ x: 0, y: 0 }, scene.camera)` for deterministic center picking.

- [ ] **Step 7: Add test-only localized mutation control**

Create a button with `data-testid="terrain-rebuild"`. Its handler derives a center Vertex from map dimensions, reads its canonical elevation, parses `current + 1` through the Terrain elevation parser, calls `terrain.commands.applyEdits()`, then on successful actual change calls `projection.rebuild(result.value.changeSet)` and `scene.render()`.

Update DOM diagnostics to revision `1`. This proves the browser path observes canonical-commit-first / presentation-rebuild-second ordering without an event bus.

- [ ] **Step 8: Add disposal lifecycle to harness**

On `pagehide`, call projection disposal before scene disposal. The handler must be once-only/idempotent safe. No production app global is introduced.

- [ ] **Step 9: Complete Playwright acceptance assertions**

Browser test must prove:

```text
WebGL available on test environment
64 real sector meshes attached
real center Raycaster semantic pick is a hit
pick diagnostics include semantic Cell/triangle/revision
clicking rebuild advances Terrain revision to 1 with no pageerror
navigation/disposal produces no uncaught page error
existing tests/browser/bootstrap.spec.ts still passes
```

Do not make browser tests the proof for triangle indices, normal seams, dirty mapping, or resource identity; those remain Vitest responsibilities.

- [ ] **Step 10: Run targeted browser GREEN and app regression**

```bash
pnpm exec playwright test tests/browser/bootstrap.spec.ts tests/browser/terrain-phase-1.spec.ts --project=chromium
pnpm --filter @web-three-city/app-game typecheck
pnpm architecture:check
```

- [ ] **Step 11: Commit**

```bash
git add apps/game/package.json apps/game/tsconfig.json pnpm-lock.yaml apps/game/src/presentation/create-scene.ts apps/game/terrain-phase-1.html apps/game/tests/terrain-phase-1-harness.ts tests/browser/terrain-phase-1.spec.ts
git commit -m "feat(terrain): verify WebGL terrain presentation"
```

---

# Task 9: Run the P1-F release gate, architecture audit, PR, CI, and Sonar evidence

**Files:**
- No new behavior is expected in this task.
- Modify only P1-F files if verification exposes a real defect; any fix follows a new RED/GREEN cycle and gets its own commit.

**Interfaces:**
- Consumes the complete P1-F branch.
- Produces exact-head verification evidence suitable for PR review/merge.

- [ ] **Step 1: Run focused P1-F suites on the exact current HEAD**

```bash
pnpm --filter @web-three-city/terrain exec vitest run \
  tests/render-sector.test.ts \
  tests/dirty-sectors.test.ts \
  tests/sector-surface.test.ts \
  tests/presentation-normal.test.ts \
  tests/semantic-pick.test.ts \
  tests/terrain-projection.test.ts
```

Record exact test count and zero failures.

- [ ] **Step 2: Run complete Terrain regression and static gates**

```bash
pnpm --filter @web-three-city/terrain test
pnpm --filter @web-three-city/terrain typecheck
pnpm --filter @web-three-city/app-game typecheck
pnpm architecture:check
```

Architecture must remain zero violations.

- [ ] **Step 3: Run presentation boundary audit**

Verify explicitly:

```text
no `three` import under systems/terrain/src/domain
no `three` import under systems/terrain/src/application
no `three` import from systems/terrain/src/index.ts
no `three` import from systems/terrain/src/commands.ts
no P1-F-owned `class` declaration under systems/terrain/src/presentation/three
RenderSectorCoord is not exported by Terrain root/commands
apps/game/src/bootstrap/main.ts does not import World/Terrain
apps/game/src/composition/create-game.ts does not import World/Terrain
```

Use `rg`/`grep` evidence; do not add suppression rules.

- [ ] **Step 4: Run targeted browser acceptance on exact HEAD**

```bash
pnpm exec playwright test tests/browser/bootstrap.spec.ts tests/browser/terrain-phase-1.spec.ts --project=chromium
```

Expected: both browser journeys pass with zero uncaught page errors.

- [ ] **Step 5: Run full repository verification on pinned runtime**

```bash
source ~/.nvm/nvm.sh
nvm use 22.18.0
pnpm verify
```

This must pass format, lint, typecheck, all tests, architecture, build, and full browser suite on the exact branch HEAD.

- [ ] **Step 6: Verify exact P1-F acceptance facts**

Record evidence for:

```text
production layout = 8×8 / 64 sectors
full sector = 65×65 = 4,225 vertices
full sector = 8,192 fixed-diagonal triangles / 24,576 indices
first indices = [0,1,65,65,1,66]
shared seam position equality
shared seam normal equality
flat normal = +Y
localized interior edit does not rebuild all sectors
corner/seam edit dirties only required adjacent sectors
unaffected Mesh identity survives rebuild
old geometry disposed exactly once
shared material not disposed on localized rebuild
staged rebuild failure leaves live projection unchanged
revision-gap rebuild rejected before swap
projection disposal idempotent
real browser Raycaster -> semantic Terrain hit
raw Raycaster Y irrelevant to semantic result
```

- [ ] **Step 7: Verify clean worktree and exact SHA**

```bash
git rev-parse HEAD
git status --short --branch
```

Working tree must be clean before push/PR evidence is claimed.

- [ ] **Step 8: Push branch and create one P1-F PR**

```bash
git push -u origin feat/phase-1f-threejs-presentation
```

Create PR to `master` titled:

```text
feat(terrain): add Three.js terrain presentation
```

PR body must include exact HEAD SHA, focused test count, Terrain/app typecheck, architecture result, targeted browser result, full `pnpm verify`, resource/revision invariants, and note that P1-G production World/Terrain app composition remains deferred.

- [ ] **Step 9: Inspect CI and Sonar on the exact PR head**

Required engineering evidence:

```text
CI verify = SUCCESS
SonarCloud Quality Gate = SUCCESS
Sonar open/confirmed PR issues API = 0, when the API is available/authoritative
```

Treat unrelated non-required preview deployment status separately; do not hide it, but do not conflate it with repository gates unless repository protection/rules require it.

- [ ] **Step 10: Merge only after exact-head gates are green, then run post-merge verification**

After integration approval, merge using the repository's established merge-commit method. Sync local `master` to the merge SHA and run:

```bash
source ~/.nvm/nvm.sh
nvm use 22.18.0
pnpm install --frozen-lockfile --ignore-scripts
pnpm rebuild esbuild
pnpm verify
```

Then confirm:

```text
master HEAD == origin/master == GitHub merge commit
clean worktree
post-merge GitHub verify = SUCCESS
post-merge Sonar Quality Gate = SUCCESS
```

Only then mark P1-F CLOSED and advance to P1-G snapshot/new-city vertical slice.

---

## Required RED Evidence by Task

| Task | Required first failing authority |
| --- | --- |
| 1 | render-sector layout/mapping and canonical triangle-corner token absent |
| 2 | dirty-sector Moore expansion/locality behavior absent |
| 3 | coherent halo snapshot and revision guard absent |
| 4 | typed sector geometry/global seam-normal behavior absent |
| 5 | candidate-Y-independent semantic pick behavior absent |
| 6 | explicit resource/registry ownership behavior absent |
| 7 | 64-sector lifecycle, staged rebuild, revision guard, composition surface absent |
| 8 | real WebGL/Raycaster test page/harness absent |

RED caused only by syntax, dependency setup, or missing test configuration does not count once the shell exists; observe the intended behavioral assertion fail.

## Required GREEN Evidence by Commit

Each task commit records or can reproduce:

```text
focused Vitest/browser command
exact pass count
package typecheck where applicable
architecture:check after new dependency/public boundary changes
no unrelated files
```

P1-F final evidence additionally requires full `pnpm verify`, exact SHA, clean worktree, PR CI, and Sonar.

## Functional / DX / Maintainability Review Checklist

Before final PR, review these explicitly:

1. **Functional core:** topology, dirty mapping, geometry data, normal math, and semantic candidate conversion are deterministic functions over explicit inputs.
2. **Imperative shell:** only Three resource creation, registry mutation, scene replacement, and disposal mutate local objects/state.
3. **No application classes:** no new `class` declaration in P1-F-owned code; factories/closures own lifecycle.
4. **No module singletons:** material/registry/projection state is instance-local.
5. **Single-source constants:** 64 exists at the render-sector owner; 8m comes from MapDefinition; 0.25m from Terrain elevation owner; 65536 from Q16 owner.
6. **Derived counts:** 65, sector counts, vertex/cell/triangle/index counts are calculated, not independently configured.
7. **Semantic topology single owner:** geometry and normals reuse `TERRAIN_CELL_TRIANGLE_CORNERS`.
8. **Bounded canonical reads:** one Terrain elevation read per required snapshot Vertex; no per-face repeated canonical query amplification.
9. **Revision coherence:** each sector snapshot is one revision; projection rebuild is contiguous and retry-safe.
10. **Strong replacement safety:** all replacements stage before live swap; failure preserves old live projection and disposes staged resources.
11. **Explicit GPU lifecycle:** replaced geometry and projection-wide shared material have tested dispose ownership.
12. **Narrow public DX:** app consumers need only `createTerrainThreeProjection(input)` and the returned `root/rebuild/pick/dispose`; they do not know registry/sector internals.
13. **Typed expected failure:** incomplete Terrain construction is a discriminated rejection; programming invariants fail loudly.
14. **No authority leak:** Mesh, BufferGeometry, normals, Raycaster Y, and sector IDs never enter canonical Terrain state/snapshots/commands.
15. **P1-G boundary preserved:** production app bootstrap still has no World/Terrain construction in P1-F.

## Final P1-F Deliverable

When complete, the dependency/flow should be mechanically understandable as:

```text
World MapDefinition + WorldSpatialRead       TerrainAuthorityRead
              │                                      │
              └──────────────┬───────────────────────┘
                             ▼
                    RenderSectorLayout
                             │
             ┌───────────────┴─────────────────┐
             ▼                                 ▼
     SectorSurfaceSnapshot              DirtySectorResolver
             │                                 ▲
             ▼                                 │
  pure geometry + global normals        TerrainChangeSet
             │
             ▼
       BufferGeometry
             │
             ▼
       SectorResource
             │
             ▼
        SectorRegistry
             │
             ▼
   TerrainThreeProjection
      │       │       │
      │       │       └── dispose
      │       └────────── pick -> World/Terrain semantic re-query
      └────────────────── rebuild -> staged localized replacement
```

Destroying and recreating every Three.js object from the same World/Terrain reads must leave semantic game state unchanged. That remains the final authority test for P1-F.
