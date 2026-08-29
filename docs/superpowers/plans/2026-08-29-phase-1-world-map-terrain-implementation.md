# Phase 1 World, Map, and Terrain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the frozen Phase 1 World/Map/Terrain authority as two new system packages, prove every semantic contract with RED/GREEN tests, project Terrain through Three.js without giving presentation authority, and finish with one production new-city vertical slice.

**Architecture:** `systems/world` owns MapDefinition, MapState, public spatial vocabulary, GridTopology, Regions, and starting-region provenance. `systems/terrain` owns canonical vertex elevation, exact fixed-triangle surface semantics, deterministic generation, atomic mutation, snapshots, and its Three.js projection; Terrain may read only the World root surface through the approved acyclic system edge. `apps/game` performs explicit new-city construction from a caller-selected accepted seed and starting Region; no orchestration package, event bus, persistence adapter, Terraform tool, `systems/map`, or `foundation/spatial` is introduced.

**Tech Stack:** Node.js 22.18.0, pnpm 10.15.1, TypeScript 5.9.2, Vitest 3.2.4, Three.js 0.179.1 / `@types/three` 0.179.0, Vite 7.1.3, Playwright 1.55.0, existing repository architecture checker.

**Spec:** `docs/architecture/PHASE-1-WORLD-MAP-TERRAIN-DESIGN.md` plus the frozen World/Terrain binding specifications under `docs/systems/world/specs/` and `docs/systems/terrain/specs/`.

**Plan Status:** APPROVED FOR EXECUTION — OWNER AUTHORIZED 2026-08-29

## Global Constraints

- The Phase 1 umbrella and all World/Terrain binding docs are **FROZEN — OWNER APPROVED 2026-08-29**. Implementation must conform to them; do not silently edit a frozen vector or algorithm to make a test pass.
- Historical/pre-reset gameplay code, tests, snapshots, package boundaries, save schemas, browser scenarios, and tooling topology are not implementation input. Implement from the current frozen requirements only.
- Create exactly two gameplay system packages in this phase: `systems/world` as `@web-three-city/world` and `systems/terrain` as `@web-three-city/terrain`.
- Do not create `systems/map`, `foundation/spatial`, `orchestration/*`, a runtime event bus, a persistence package, Terraform, Roads, Zoning, Buildings, Hydrology/Water, ECS, scheduler, or simulation time.
- World exports only `.` and `./composition` in Phase 1. There is no World `./commands` surface.
- Terrain exports exactly `.`, `./commands`, and `./composition`.
- The only production system-to-system edge in Phase 1 is `@web-three-city/terrain -> @web-three-city/world` root read surface. Add it to `architecture.policy.json` with the frozen Terrain system-design reference before the first production Terrain import.
- Terrain domain files under `systems/terrain/src/domain/` must not import `@web-three-city/world`, Three.js, browser globals, contracts, application, presentation, or composition layers.
- World domain files must not import Terrain, Three.js, browser globals, persistence, runtime/scheduler code, or future gameplay systems.
- `package.json#exports` is authoritative. No deep cross-package imports and no relative filesystem reach-through.
- Creating a workspace package or changing production/dev dependencies must refresh `pnpm-lock.yaml` before RED/GREEN verification using exactly `pnpm install --ignore-scripts` followed by `pnpm rebuild esbuild`; the lockfile change is committed with the task. Export-only manifest edits do not require lockfile churn.
- Production Map: 512×512 Cells, 8m per Cell, 32×32 Cells per logical Chunk, 16×16 logical Chunks, 513×513 Terrain Vertices, 20 Regions, four starting candidates.
- Region X boundaries: `[0, 102, 205, 307, 410, 512]`; Z boundaries: `[0, 128, 256, 384, 512]`; IDs `R00`…`R19` row-major south-to-north, west-to-east.
- Starting candidates/anchors are exact: `R06 -> (153,191)`, `R08 -> (358,191)`, `R11 -> (153,319)`, `R13 -> (358,319)`.
- Shared Vertex ownership is the frozen south-west rule. No Terrain-owned alternative seam formula is allowed.
- `1 LogicalElevation = 0.25m`; product domain is `[-4096,4096]`; generator profile envelope is `[32,288]`.
- Fixed cell topology is NW→SE. Semantic diagonal tie is `u + v <= 65536 -> SW_TRIANGLE`.
- Generator identity is `balanced-temperate-generation / 2`, accepted seed is `0x5EED5EED5EED5EED`, and production full-field fingerprint is `0xF2FA29BFD2AEB069`.
- Fingerprint mismatch under profile version 2 means implementation is wrong. Fix code; do not alter the frozen fingerprint/profile to obtain GREEN.
- Every generator acceptance test must inspect the full 513×513 field for the `[32,288]` envelope, not only sample coordinates.
- Starting-candidate RED/GREEN tests assert exact metrics and eligibility flags, not merely that all four candidates return `eligible=true`.
- Terrain mutation validates the entire request before writes; duplicates reject before canonical sorting/other validation; actual mutation advances revision exactly once; valid no-op does not advance revision.
- Mesh, BufferGeometry, render sectors, raycast Y, normals, materials, and GPU state are derived presentation only.
- Use browser tests only where WebGL/Raycaster/browser lifecycle is intrinsically required. Domain, topology, generation, mutation, surface, and most projection-builder tests remain Vitest.
- Every production behavior task follows RED → confirm expected failure → minimal GREEN → focused regression → architecture check as applicable → commit.
- Each delivery P1-A through P1-G is a separate reviewable PR from a clean exact `master` after the preceding delivery is merged. Do not begin P1-A until PR #106 containing this frozen authority and approved plan is merged.
- If execution reveals a contradiction in a frozen contract, stop that task and reopen the owning spec explicitly with owner approval. Never repair a contradiction through undocumented implementation behavior.

---

## Planned File Structure

```text
systems/world/
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ domain/
│  │  ├─ coordinates.ts
│  │  ├─ grid-topology.ts
│  │  ├─ region-geometry.ts
│  │  ├─ map-definition.ts
│  │  └─ map-state.ts
│  ├─ contracts/
│  │  └─ world-read.ts
│  ├─ application/
│  │  ├─ prepare-world-definition.ts
│  │  ├─ world-spatial-read.ts
│  │  └─ create-map-state.ts
│  ├─ composition/
│  │  └─ create-world.ts
│  ├─ index.ts
│  └─ composition.ts
└─ tests/
   ├─ public-surface.test.ts
   ├─ spatial.test.ts
   ├─ map-region.test.ts
   └─ composition.test.ts

systems/terrain/
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ domain/
│  │  ├─ elevation.ts
│  │  ├─ terrain-state.ts
│  │  ├─ surface.ts
│  │  ├─ generation/
│  │  │  ├─ splitmix64.ts
│  │  │  ├─ value-noise.ts
│  │  │  ├─ production-field.ts
│  │  │  └─ fingerprint.ts
│  │  └─ mutation/
│  │     └─ commit-edits.ts
│  ├─ contracts/
│  │  ├─ terrain-read.ts
│  │  ├─ generation.ts
│  │  ├─ mutation.ts
│  │  └─ snapshot.ts
│  ├─ application/
│  │  ├─ world-index.ts
│  │  ├─ terrain-read.ts
│  │  ├─ materialize-terrain.ts
│  │  ├─ prepare-production-terrain.ts
│  │  ├─ evaluate-starting-candidates.ts
│  │  ├─ apply-terrain-edits.ts
│  │  └─ capture-terrain-snapshot.ts
│  ├─ presentation/three/
│  │  ├─ render-sector.ts
│  │  ├─ build-sector-geometry.ts
│  │  ├─ presentation-normal.ts
│  │  ├─ dirty-sectors.ts
│  │  ├─ semantic-pick.ts
│  │  └─ terrain-projection.ts
│  ├─ composition/
│  │  └─ create-terrain.ts
│  ├─ index.ts
│  ├─ commands.ts
│  └─ composition.ts
└─ tests/
   ├─ public-surface.test.ts
   ├─ authority.test.ts
   ├─ surface.test.ts
   ├─ generation-primitives.test.ts
   ├─ generation-production.test.ts
   ├─ suitability.test.ts
   ├─ mutation.test.ts
   ├─ render-sector.test.ts
   ├─ dirty-sectors.test.ts
   └─ snapshot.test.ts

apps/game/
├─ package.json                         # add World/Terrain workspace deps
└─ src/
   ├─ bootstrap/main.ts                 # explicit seed + starting Region input
   ├─ composition/create-game.ts        # new-city composition sequence
   └─ presentation/create-scene.ts      # expose scene/camera/render lifecycle to composition

tests/browser/
├─ bootstrap.spec.ts                    # preserve minimal shell smoke
└─ terrain-phase-1.spec.ts              # targeted WebGL/pick/disposal vertical slice

architecture.policy.json               # approve Terrain -> World root read edge
```

The file map is intentionally narrow. Do not create ports/adapters/testkit/orchestration packages or speculative abstractions during Phase 1.

---

## Canonical Interface Ledger

These shapes are execution authorities for names referenced across tasks. Internal implementations may use private helpers, but task-to-task contracts keep these names and semantics unless a frozen spec is explicitly reopened.

World public values and results:

```ts
export interface CellCoord { readonly x: number; readonly z: number }
export interface VertexCoord { readonly x: number; readonly z: number }
export interface ChunkCoord { readonly x: number; readonly z: number }
export interface WorldXZ { readonly x: number; readonly z: number }
export interface CellRect {
  readonly xStartInclusive: number;
  readonly zStartInclusive: number;
  readonly xEndExclusive: number;
  readonly zEndExclusive: number;
}
export interface CellWorldBounds {
  readonly xMinInclusive: number;
  readonly zMinInclusive: number;
  readonly xMaxExclusive: number;
  readonly zMaxExclusive: number;
}
export type RegionId = string;
export type MapDefinitionId = string;
export interface StartingCandidate {
  readonly regionId: RegionId;
  readonly anchor: CellCoord;
}

export type WorldErrorCode =
  | "WORLD_MAP_DEFINITION_INVALID"
  | "WORLD_REGION_UNKNOWN"
  | "WORLD_REGION_GEOMETRY_INVALID"
  | "WORLD_REGION_PARTITION_INCOMPLETE"
  | "WORLD_REGION_PARTITION_OVERLAP"
  | "WORLD_STARTING_CANDIDATE_INVALID"
  | "WORLD_STARTING_REGION_NOT_ELIGIBLE"
  | "WORLD_SEED_NOT_ACCEPTED"
  | "WORLD_COORD_OUT_OF_BOUNDS";

export type WorldReadResult<T> =
  | { readonly status: "success"; readonly value: T }
  | { readonly status: "rejected"; readonly code: WorldErrorCode };

export interface WorldSpatialRead {
  cellToChunk(cell: CellCoord): WorldReadResult<{
    readonly chunk: ChunkCoord;
    readonly local: CellCoord;
  }>;
  ownerChunk(vertex: VertexCoord): WorldReadResult<ChunkCoord>;
  incidentCells(vertex: VertexCoord): WorldReadResult<readonly CellCoord[]>;
  touchingChunks(vertex: VertexCoord): WorldReadResult<readonly ChunkCoord[]>;
  cardinalNeighbors(cell: CellCoord): WorldReadResult<readonly CellCoord[]>;
  intersectingChunks(rect: CellRect): WorldReadResult<readonly ChunkCoord[]>;
  worldPositionToCell(position: WorldXZ): WorldReadResult<CellCoord>;
  cellBounds(cell: CellCoord): WorldReadResult<CellWorldBounds>;
  regionAtCell(cell: CellCoord): WorldReadResult<RegionId>;
  adjacentRegions(region: RegionId): WorldReadResult<readonly RegionId[]>;
}

export type WorldConstructionResult<T> =
  | { readonly status: "success"; readonly value: T }
  | {
      readonly status: "rejected";
      readonly code: WorldErrorCode;
      readonly detail?: Readonly<Record<string, unknown>>;
    };

export interface MapDefinitionRead {
  readonly mapDefinitionId: "web-three-city-production";
  readonly profileId: "production-v1";
  readonly profileVersion: 1;
  readonly widthCells: 512;
  readonly heightCells: 512;
  readonly cellSizeMeters: 8;
  readonly logicalChunkSizeCells: 32;
  readonly terrainGenerationProfileId: "balanced-temperate-generation";
  readonly terrainGenerationProfileVersion: 2;
  readonly regionIds: readonly RegionId[];
  readonly startingCandidates: readonly StartingCandidate[];
  readonly acceptedTerrainSeeds: readonly string[];
}

export interface PreparedWorldDefinition {
  readonly mapDefinition: MapDefinitionRead;
  readonly spatial: WorldSpatialRead;
}

export interface CreateInitialWorldInput {
  readonly prepared: PreparedWorldDefinition;
  readonly selectedStartingRegionId: RegionId;
  readonly eligibleStartingRegionIds: readonly RegionId[];
}

export interface MapStateRead {
  readonly mapDefinitionId: MapDefinitionId;
  readonly startingRegionId: RegionId;
  readonly unlockedRegionIds: readonly RegionId[];
}

export interface MapStateSnapshot {
  readonly mapDefinitionId: MapDefinitionId;
  readonly mapProfileId: "production-v1";
  readonly mapProfileVersion: 1;
  readonly startingRegionId: RegionId;
  readonly unlockedRegionIds: readonly RegionId[];
}

export interface WorldSystem {
  readonly definition: PreparedWorldDefinition;
  readonly spatial: WorldSpatialRead;
  readonly mapState: MapStateRead;
  captureSnapshot(): MapStateSnapshot;
}
```

Terrain public/read contracts:

```ts
export type LogicalElevation = number & {
  readonly __logicalElevationBrand: "LogicalElevation";
};
export type TerrainElevationResult =
  | { readonly status: "success"; readonly value: LogicalElevation }
  | {
      readonly status: "rejected";
      readonly code: "TERRAIN_ELEVATION_INVALID" | "TERRAIN_ELEVATION_OUT_OF_RANGE";
    };
export type TerrainRevision = number;
export type TerrainCompleteness = "partial" | "full";
export type TerrainTriangle = "SW_TRIANGLE" | "NE_TRIANGLE";

export type TerrainQueryResult<T> =
  | { readonly status: "success"; readonly value: T }
  | {
      readonly status: "out-of-bounds";
      readonly code: "TERRAIN_QUERY_OUT_OF_BOUNDS";
    }
  | {
      readonly status: "unavailable";
      readonly code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE";
      readonly chunk: ChunkCoord;
    };

export interface CellSurfaceRead {
  readonly cell: CellCoord;
  readonly sw: LogicalElevation;
  readonly se: LogicalElevation;
  readonly nw: LogicalElevation;
  readonly ne: LogicalElevation;
  readonly revision: TerrainRevision;
}

export interface SurfaceSampleRead {
  readonly triangle: TerrainTriangle;
  readonly heightQ16: number;
  readonly riseX: number;
  readonly riseZ: number;
  readonly runUnits: 32;
  readonly revision: TerrainRevision;
}

export type TerrainStartingReason =
  | "TERRAIN_START_UNAVAILABLE"
  | "TERRAIN_START_CELL_RELIEF_EXCEEDED"
  | "TERRAIN_START_PATCH_RELIEF_EXCEEDED"
  | "TERRAIN_START_ANCHOR_RELIEF_EXCEEDED";

export interface StartingCandidateEvaluation {
  readonly regionId: RegionId;
  readonly eligible: boolean;
  readonly patchElevationRange: number;
  readonly maxCellCornerRange: number;
  readonly anchorCellCornerRange: number;
  readonly reasons: readonly TerrainStartingReason[];
}

export type TerrainGenerationRejectionCode =
  | "TERRAIN_GENERATION_PROFILE_UNSUPPORTED"
  | "TERRAIN_GENERATION_SEED_INVALID"
  | "TERRAIN_GENERATION_SEED_NOT_ACCEPTED"
  | "TERRAIN_GENERATION_OUTPUT_OUT_OF_RANGE"
  | "TERRAIN_GENERATION_FINGERPRINT_MISMATCH"
  | "TERRAIN_GENERATION_NO_ELIGIBLE_START";

export type TerrainMutationRejectionCode =
  | "TERRAIN_MUTATION_DUPLICATE_VERTEX"
  | "TERRAIN_MUTATION_VERTEX_OUT_OF_BOUNDS"
  | "TERRAIN_MUTATION_CHUNK_UNAVAILABLE"
  | "TERRAIN_MUTATION_ELEVATION_INVALID"
  | "TERRAIN_MUTATION_ELEVATION_OUT_OF_RANGE";

export interface TerrainVertexEdit {
  readonly vertex: VertexCoord;
  readonly elevation: LogicalElevation;
}
export interface ApplyTerrainEdits {
  readonly edits: readonly TerrainVertexEdit[];
}
export interface TerrainChangeSet {
  readonly previousRevision: TerrainRevision;
  readonly newRevision: TerrainRevision;
  readonly changedVertices: readonly VertexCoord[];
  readonly affectedCells: readonly CellCoord[];
  readonly touchingLogicalChunks: readonly ChunkCoord[];
}
export interface TerrainMutationReceipt {
  readonly changed: boolean;
  readonly previousRevision: TerrainRevision;
  readonly newRevision: TerrainRevision;
  readonly changeSet: TerrainChangeSet;
}
export interface TerrainMutationRejection {
  readonly code: TerrainMutationRejectionCode;
  readonly message: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface TerrainChunkSnapshot {
  readonly chunk: ChunkCoord;
  readonly ownedElevations: readonly {
    readonly vertex: VertexCoord;
    readonly elevation: LogicalElevation;
  }[];
}
export interface TerrainStateSnapshot {
  readonly mapDefinitionId: string;
  readonly generationProfileId: "balanced-temperate-generation";
  readonly generationProfileVersion: 2;
  readonly selectedSeed64: string;
  readonly revision: TerrainRevision;
  readonly completeness: TerrainCompleteness;
  readonly chunks: readonly TerrainChunkSnapshot[];
}

export interface TerrainAuthorityRead {
  revision(): TerrainRevision;
  completeness(): TerrainCompleteness;
  elevationAt(vertex: VertexCoord): TerrainQueryResult<LogicalElevation>;
  cellSurface(cell: CellCoord): TerrainQueryResult<CellSurfaceRead>;
  sampleSurface(
    cell: CellCoord,
    uQ16: number,
    vQ16: number,
  ): TerrainQueryResult<SurfaceSampleRead>;
}

export interface TerrainRead extends TerrainAuthorityRead {
  captureSnapshot(): TerrainStateSnapshot;
}
```

Terrain construction/mutation contracts used across later deliveries:

```ts
export interface TerrainFieldSource {
  readonly vertexWidth: number;
  readonly vertexHeight: number;
  elevationAt(x: number, z: number): number;
}

export type TerrainConstructionResult<T> =
  | { readonly status: "success"; readonly value: T }
  | {
      readonly status: "rejected";
      readonly reason:
        | "invalid-source-dimensions"
        | "invalid-elevation"
        | "world-topology-rejected";
      readonly detail?: Readonly<Record<string, unknown>>;
    };

export interface PreparedProductionTerrain {
  readonly field: TerrainFieldSource;
  readonly seed64: string;
  readonly fingerprint: "0xF2FA29BFD2AEB069";
  readonly candidateEvaluations: readonly StartingCandidateEvaluation[];
}

export type TerrainPreparationResult =
  | { readonly status: "success"; readonly value: PreparedProductionTerrain }
  | {
      readonly status: "rejected";
      readonly code: TerrainGenerationRejectionCode;
      readonly detail?: Readonly<Record<string, unknown>>;
    };

export interface TerrainAuthoritySystem {
  readonly read: TerrainAuthorityRead;
}

export interface TerrainCommands {
  applyEdits(command: ApplyTerrainEdits): CommandResult<
    TerrainMutationReceipt,
    TerrainMutationRejection
  >;
}

export interface TerrainSystem extends TerrainAuthoritySystem {
  readonly commands: TerrainCommands;
}
```

`CommandResult` is the existing `@web-three-city/foundation-contracts` primitive and is introduced as a Terrain production dependency only in P1-E when the real command consumer exists. `PreparedProductionTerrain.field` is a read-only construction payload exported only through Terrain `./composition`, never Terrain root; app composition passes the same prepared object back to `createTerrainSystem` without regenerating or treating the field as a second authority.

Public surface entry files follow one mechanical rule required by the current architecture checker: an exported declaration must not expose or directly reference an identifier imported from `application/`, `composition/`, `presentation/`, `ports/`, `internal/`, or `adapters/`. When a public `./composition` entry delegates to package internals, use a non-exported local trampoline so the exported signature contains only approved contract/domain values:

```ts
import { createWorldInternal } from "./composition/create-world";
import type { WorldConstructionResult, WorldSystem } from "./contracts/world-read";

function constructWorld(/* approved contract args */): WorldConstructionResult<WorldSystem> {
  return createWorldInternal(/* args */);
}

export function createInitialWorldSystem(/* approved contract args */): WorldConstructionResult<WorldSystem> {
  return constructWorld(/* args */);
}
```

This is an encapsulation boundary, not a workaround for cross-package visibility: app consumers still import only the deliberate package export, and internal modules remain unexported.

---

# P1-A — World / Map / Grid / Region Contracts + System

## Task 1: Create the World package boundary and public read contracts

**Files:**
- Create: `systems/world/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `systems/world/tsconfig.json`
- Create: `systems/world/src/domain/coordinates.ts`
- Create: `systems/world/src/contracts/world-read.ts`
- Create: `systems/world/src/index.ts`
- Create: `systems/world/tests/public-surface.test.ts`

**Interfaces:**
- Produces immutable public values: `CellCoord`, `VertexCoord`, `ChunkCoord`, `CellRect`, `WorldXZ`, `CellWorldBounds`, `RegionId`, `MapDefinitionId`, `StartingCandidate`.
- Produces `WorldReadResult<T>` and `WorldSpatialRead` contracts used by every later World task and by Terrain.
- World root remains read-only. Construction is reachable only through `./composition`.

- [ ] **Step 1: Create package metadata and write the failing public-surface test**

Use this package contract:

```json
{
  "name": "@web-three-city/world",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "typescript": "5.9.2",
    "vitest": "3.2.4"
  }
}
```

Refresh the workspace importer before running the RED test:

```bash
pnpm install --ignore-scripts
pnpm rebuild esbuild
```

`tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["vitest/globals"] },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

Start `tests/public-surface.test.ts` with imports that do not exist yet:

```ts
import { describe, expect, it } from "vitest";
import type {
  CellCoord,
  ChunkCoord,
  VertexCoord,
  WorldSpatialRead,
} from "../src/index";

describe("World public read surface", () => {
  it("defines World-owned coordinates without a command surface", () => {
    const cell: CellCoord = { x: 0, z: 0 };
    const vertex: VertexCoord = { x: 512, z: 512 };
    const chunk: ChunkCoord = { x: 15, z: 15 };
    const read: WorldSpatialRead | undefined = undefined;

    expect({ cell, vertex, chunk, read }).toBeDefined();
  });
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm --filter @web-three-city/world exec vitest run tests/public-surface.test.ts
```

Expected: FAIL because `src/index.ts`/public contracts are not implemented.

- [ ] **Step 3: Implement the minimal immutable contract types**

`coordinates.ts` owns coordinate/value structures. `world-read.ts` defines:

```ts
export type WorldErrorCode =
  | "WORLD_MAP_DEFINITION_INVALID"
  | "WORLD_REGION_UNKNOWN"
  | "WORLD_REGION_GEOMETRY_INVALID"
  | "WORLD_REGION_PARTITION_INCOMPLETE"
  | "WORLD_REGION_PARTITION_OVERLAP"
  | "WORLD_STARTING_CANDIDATE_INVALID"
  | "WORLD_STARTING_REGION_NOT_ELIGIBLE"
  | "WORLD_SEED_NOT_ACCEPTED"
  | "WORLD_COORD_OUT_OF_BOUNDS";

export type WorldReadResult<T> =
  | { readonly status: "success"; readonly value: T }
  | { readonly status: "rejected"; readonly code: WorldErrorCode };

export interface WorldSpatialRead {
  cellToChunk(cell: CellCoord): WorldReadResult<{
    readonly chunk: ChunkCoord;
    readonly local: CellCoord;
  }>;
  ownerChunk(vertex: VertexCoord): WorldReadResult<ChunkCoord>;
  incidentCells(vertex: VertexCoord): WorldReadResult<readonly CellCoord[]>;
  touchingChunks(vertex: VertexCoord): WorldReadResult<readonly ChunkCoord[]>;
  cardinalNeighbors(cell: CellCoord): WorldReadResult<readonly CellCoord[]>;
  intersectingChunks(rect: CellRect): WorldReadResult<readonly ChunkCoord[]>;
  worldPositionToCell(position: WorldXZ): WorldReadResult<CellCoord>;
  cellBounds(cell: CellCoord): WorldReadResult<CellWorldBounds>;
  regionAtCell(cell: CellCoord): WorldReadResult<RegionId>;
  adjacentRegions(region: RegionId): WorldReadResult<readonly RegionId[]>;
}
```

`src/index.ts` may export domain value types and `contracts/world-read.ts`; it must not export anything from `application/` or `composition/`.

- [ ] **Step 4: Run GREEN and architecture verification**

```bash
pnpm --filter @web-three-city/world test
pnpm --filter @web-three-city/world typecheck
pnpm architecture:check
```

Expected: PASS, and no `ARCH-EXPORT-002` / `ARCH-CONTRACT-001` violation.

- [ ] **Step 5: Commit**

```bash
git add systems/world
git commit -m "feat(world): establish public spatial contracts"
```

## Task 2: Implement GridTopology with exhaustive seam/boundary verification

**Files:**
- Create: `systems/world/src/domain/grid-topology.ts`
- Create: `systems/world/src/application/world-spatial-read.ts`
- Modify: `systems/world/src/contracts/world-read.ts`
- Test: `systems/world/tests/spatial.test.ts`

**Interfaces:**
- Consumes the World-owned coordinate contracts from Task 1.
- Produces the sole implementation of Cell/Vertex/Chunk formulas and the spatial portion of `WorldSpatialRead`.

- [ ] **Step 1: Write RED tests for constants, bounds, seam ownership, incidence, neighbor order, rectangles, and world-position half-open mapping**

Include the frozen seam vectors and exhaustive seam loops:

```ts
const seamCases = [
  [{ x: 0, z: 0 }, { x: 0, z: 0 }],
  [{ x: 32, z: 1 }, { x: 0, z: 0 }],
  [{ x: 33, z: 1 }, { x: 1, z: 0 }],
  [{ x: 32, z: 32 }, { x: 0, z: 0 }],
  [{ x: 64, z: 32 }, { x: 1, z: 0 }],
  [{ x: 512, z: 512 }, { x: 15, z: 15 }],
] as const;

for (let k = 1; k <= 15; k += 1) {
  const seam = k * 32;
  expect(topology.ownerChunk({ x: seam, z: 1 })).toEqual({
    status: "success",
    value: { x: k - 1, z: 0 },
  });
  expect(topology.ownerChunk({ x: 1, z: seam })).toEqual({
    status: "success",
    value: { x: 0, z: k - 1 },
  });
  expect(topology.ownerChunk({ x: seam, z: seam })).toEqual({
    status: "success",
    value: { x: k - 1, z: k - 1 },
  });
}
```

Also assert:

```ts
expect(topology.worldPositionToCell({ x: 0, z: 0 })).toMatchObject({
  status: "success",
  value: { x: 0, z: 0 },
});
expect(topology.worldPositionToCell({ x: 4096, z: 0 })).toMatchObject({
  status: "rejected",
  code: "WORLD_COORD_OUT_OF_BOUNDS",
});
expect(topology.incidentCells({ x: 32, z: 32 })).toMatchObject({
  status: "success",
  value: [
    { x: 31, z: 31 },
    { x: 32, z: 31 },
    { x: 31, z: 32 },
    { x: 32, z: 32 },
  ],
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/world exec vitest run tests/spatial.test.ts
```

Expected: FAIL because GridTopology is absent.

- [ ] **Step 3: Implement the frozen formulas exactly**

The owner-axis implementation must be structurally equivalent to:

```ts
function ownerAxis(vertexAxis: number): number {
  return vertexAxis === 0
    ? 0
    : Math.min(Math.floor((vertexAxis - 1) / 32), 15);
}
```

Validate integer/bounds before formulas; never clamp invalid caller coordinates. Sort unordered coordinate sets by `z`, then `x`. Preserve cardinal neighbor order `North, East, South, West` after removing out-of-bounds entries.

- [ ] **Step 4: Add an exhaustive 513×513 ownership property test**

For every valid Vertex, assert exactly one owner, owner in `[0,15]²`, and owner appears in `touchingChunks(vertex)`. This test is intentionally exhaustive because 263,169 vertices are small enough for deterministic CI verification.

- [ ] **Step 5: Run GREEN**

```bash
pnpm --filter @web-three-city/world exec vitest run tests/spatial.test.ts
pnpm --filter @web-three-city/world typecheck
pnpm architecture:check
```

- [ ] **Step 6: Commit**

```bash
git add systems/world/src/domain/grid-topology.ts systems/world/src/application/world-spatial-read.ts systems/world/tests/spatial.test.ts
git commit -m "feat(world): implement canonical grid topology"
```

## Task 3: Implement production MapDefinition, Region partition, candidates, and derived adjacency

**Files:**
- Create: `systems/world/src/domain/region-geometry.ts`
- Create: `systems/world/src/domain/map-definition.ts`
- Create: `systems/world/src/application/prepare-world-definition.ts`
- Modify: `systems/world/src/application/world-spatial-read.ts`
- Modify: `systems/world/src/contracts/world-read.ts`
- Test: `systems/world/tests/map-region.test.ts`

**Interfaces:**
- Produces `PreparedWorldDefinition` internally and a public immutable `MapDefinitionRead`/candidate view.
- `prepareProductionWorldDefinition()` is exposed from World `./composition` in Task 4.
- Terrain P1-D consumes only public World read values/capabilities, not MapDefinition internals.

- [ ] **Step 1: Write RED tests for exact production content**

Assert:

```ts
expect(definition.mapDefinitionId).toBe("web-three-city-production");
expect(definition.profileId).toBe("production-v1");
expect(definition.profileVersion).toBe(1);
expect(definition.regionIds).toEqual(
  Array.from({ length: 20 }, (_, index) => `R${index.toString().padStart(2, "0")}`),
);
expect(definition.acceptedTerrainSeeds).toEqual(["0x5EED5EED5EED5EED"]);
expect(definition.startingCandidates).toEqual([
  { regionId: "R06", anchor: { x: 153, z: 191 } },
  { regionId: "R08", anchor: { x: 358, z: 191 } },
  { regionId: "R11", anchor: { x: 153, z: 319 } },
  { regionId: "R13", anchor: { x: 358, z: 319 } },
]);
```

Add the owner-requested non-uniform X-width coverage assertion. Expected Region cell counts by row are exactly:

```ts
const expectedRowCounts = [13056, 13184, 13056, 13184, 13056];
expect(regionCellCounts).toEqual([
  ...expectedRowCounts,
  ...expectedRowCounts,
  ...expectedRowCounts,
  ...expectedRowCounts,
]);
expect(regionCellCounts.reduce((a, b) => a + b, 0)).toBe(512 * 512);
```

Also assert every Cell has exactly one Region, no overlap/gap, all Regions are cardinally connected, every 9×9 candidate patch remains inside its Region, and derived adjacency is symmetric/irreflexive. Exact sample adjacency:

```ts
expect(spatial.adjacentRegions("R00")).toMatchObject({
  status: "success",
  value: ["R01", "R05"],
});
expect(spatial.adjacentRegions("R06")).toMatchObject({
  status: "success",
  value: ["R01", "R05", "R07", "R11"],
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/world exec vitest run tests/map-region.test.ts
```

Expected: FAIL because production MapDefinition/Region geometry is absent.

- [ ] **Step 3: Implement immutable production-v1 MapDefinition content**

Store the exact X/Z boundary arrays and construct normalized horizontal Region runs deterministically. This is fixed production content, not a generic procedural Region generator. Derive adjacency from cardinal cell edges; do not author a neighbor table.

- [ ] **Step 4: Validate definition invariants before exposing a prepared definition**

Reject with the frozen vocabulary (`WORLD_MAP_DEFINITION_INVALID`, `WORLD_REGION_GEOMETRY_INVALID`, `WORLD_REGION_PARTITION_INCOMPLETE`, `WORLD_REGION_PARTITION_OVERLAP`, `WORLD_STARTING_CANDIDATE_INVALID`) and immutable diagnostic detail. Do not introduce aliases.

- [ ] **Step 5: Run GREEN**

```bash
pnpm --filter @web-three-city/world exec vitest run tests/map-region.test.ts
pnpm --filter @web-three-city/world test
pnpm architecture:check
```

- [ ] **Step 6: Commit**

```bash
git add systems/world/src systems/world/tests/map-region.test.ts
git commit -m "feat(world): define production map and regions"
```

## Task 4: Construct MapState, snapshots, and the World composition surface

**Files:**
- Create: `systems/world/src/domain/map-state.ts`
- Create: `systems/world/src/application/create-map-state.ts`
- Create: `systems/world/src/composition/create-world.ts`
- Create: `systems/world/src/composition.ts`
- Modify: `systems/world/package.json`
- Modify: `systems/world/src/contracts/world-read.ts`
- Modify: `systems/world/src/index.ts`
- Test: `systems/world/tests/composition.test.ts`

**Interfaces:**

World composition exposes exactly:

```ts
export function prepareProductionWorldDefinition(): WorldConstructionResult<PreparedWorldDefinition>;

export function createInitialWorldSystem(
  input: CreateInitialWorldInput,
): WorldConstructionResult<WorldSystem>;
```

`PreparedWorldDefinition` exposes read-only `mapDefinition` and `spatial` capability required before MapState exists. `WorldSystem` exposes root read capability and `captureSnapshot()`; it does not expose Region mutation.

- [ ] **Step 1: Write RED tests for explicit starting selection and snapshot ordering**

Assert successful `R06` construction when eligible, exact singleton unlocked state, rejection of unknown/non-candidate/ineligible selections, and snapshot:

```ts
expect(world.captureSnapshot()).toEqual({
  mapDefinitionId: "web-three-city-production",
  mapProfileId: "production-v1",
  mapProfileVersion: 1,
  startingRegionId: "R06",
  unlockedRegionIds: ["R06"],
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/world exec vitest run tests/composition.test.ts
```

- [ ] **Step 3: Implement MapState construction without Terrain logic**

World only verifies that the selected Region exists, is a starting candidate, and appears in the caller-provided eligible set. It does not recalculate Terrain suitability.

Keep internal composition behind a non-exported trampoline in `src/composition.ts`:

```ts
function constructInitialWorld(input: CreateInitialWorldInput): WorldConstructionResult<WorldSystem> {
  return createWorldInternal(input);
}

export function createInitialWorldSystem(
  input: CreateInitialWorldInput,
): WorldConstructionResult<WorldSystem> {
  return constructInitialWorld(input);
}
```

The exported signature uses only approved World contract/domain values; the internal composition identifier is not leaked by the exported declaration.

- [ ] **Step 4: Prove package boundaries**

Add test/import assertions that `@web-three-city/world` exposes read types only, `@web-three-city/world/composition` exposes construction, and `package.json` has no `./commands` export.

- [ ] **Step 5: Run the P1-A release gate**

```bash
pnpm --filter @web-three-city/world test
pnpm --filter @web-three-city/world typecheck
pnpm format:check
pnpm lint
pnpm architecture:check
pnpm test
```

No browser test is required for World semantics.

- [ ] **Step 6: Commit and open P1-A review**

```bash
git add systems/world
git commit -m "feat(world): complete Phase 1 World authority"
```

P1-A acceptance requires exact Region cell-count coverage, full seam/boundary tests, zero architecture violations, and no Terrain package yet.

---

# P1-B — Terrain Authority + Logical Chunk Storage + Queries

## Task 5: Establish Terrain package surfaces and approve the Terrain → World read edge

**Files:**
- Create: `systems/terrain/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `systems/terrain/tsconfig.json`
- Create: `systems/terrain/src/domain/elevation.ts`
- Create: `systems/terrain/src/contracts/terrain-read.ts`
- Create: `systems/terrain/src/index.ts`
- Modify: `architecture.policy.json`
- Test: `systems/terrain/tests/public-surface.test.ts`

**Interfaces:**
- Produces branded/validated `LogicalElevation`, `TerrainRevision`, `TerrainCompleteness`, and `TerrainQueryResult<T>`.
- Public query contracts may use `CellCoord`, `VertexCoord`, and `ChunkCoord` imported from `@web-three-city/world` root.
- Domain `elevation.ts` contains no World import.

- [ ] **Step 1: Create package metadata and a RED public-surface test**

Use exports/dependencies:

```json
{
  "name": "@web-three-city/terrain",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@web-three-city/world": "workspace:*"
  },
  "devDependencies": {
    "typescript": "5.9.2",
    "vitest": "3.2.4"
  }
}
```

RED test imports root/read contracts and asserts product elevation parsing rejects fractional/out-of-range values.

Refresh the new workspace importer before RED:

```bash
pnpm install --ignore-scripts
pnpm rebuild esbuild
```

- [ ] **Step 2: Add the architecture-policy approval before production Terrain imports World**

`architecture.policy.json` must contain exactly this approved read edge:

```json
{
  "from": "@web-three-city/terrain",
  "to": "@web-three-city/world",
  "reference": "docs/systems/terrain/specs/TERRAIN-SYSTEM-DESIGN.md § 4"
}
```

Do not add same-layer or command/composition exceptions.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/public-surface.test.ts
```

Expected: FAIL because Terrain contracts/domain values are absent.

- [ ] **Step 4: Implement validated value contracts and query result shape**

Use a branded logical elevation produced only by an explicit parser:

```ts
export type TerrainQueryResult<T> =
  | { readonly status: "success"; readonly value: T }
  | { readonly status: "out-of-bounds"; readonly code: "TERRAIN_QUERY_OUT_OF_BOUNDS" }
  | {
      readonly status: "unavailable";
      readonly code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE";
      readonly chunk: ChunkCoord;
    };
```

The parser accepts integer values in `[-4096,4096]`; it does not clamp.

Implement the boundary check explicitly:

```ts
export function parseLogicalElevation(value: number): TerrainElevationResult {
  if (!Number.isInteger(value)) {
    return { status: "rejected", code: "TERRAIN_ELEVATION_INVALID" };
  }
  if (value < -4096 || value > 4096) {
    return { status: "rejected", code: "TERRAIN_ELEVATION_OUT_OF_RANGE" };
  }
  return { status: "success", value: value as LogicalElevation };
}
```

- [ ] **Step 5: Run GREEN plus architecture checks**

```bash
pnpm --filter @web-three-city/terrain test
pnpm --filter @web-three-city/terrain typecheck
pnpm architecture:check
```

Expected: the approved root read edge passes; Terrain importing World `./composition` or `./commands` would still fail.

- [ ] **Step 6: Commit**

```bash
git add systems/terrain architecture.policy.json
git commit -m "feat(terrain): establish authority contracts"
```

## Task 6: Implement owner-only chunk storage, full/partial availability, materialization, and elevation queries

**Files:**
- Create: `systems/terrain/src/domain/terrain-state.ts`
- Create: `systems/terrain/src/application/world-index.ts`
- Create: `systems/terrain/src/application/terrain-read.ts`
- Create: `systems/terrain/src/application/materialize-terrain.ts`
- Create: `systems/terrain/src/composition/create-terrain.ts`
- Create: `systems/terrain/src/composition.ts`
- Modify: `systems/terrain/package.json`
- Modify: `systems/terrain/src/contracts/terrain-read.ts`
- Test: `systems/terrain/tests/authority.test.ts`

**Interfaces:**
- Application resolves World coordinates/owners through `WorldSpatialRead` and maps them to private numeric storage keys.
- Domain state stores `chunkKey -> vertexKey -> LogicalElevation`; domain never knows World package types.
- Composition accepts a validated field source and provenance so P1-D can plug the exact prepared production field into the same materialization path.

Composition materialization input:

```ts
export interface TerrainFieldSource {
  readonly vertexWidth: number;
  readonly vertexHeight: number;
  elevationAt(x: number, z: number): number;
}
```

P1-B `./composition` exposes the read-authority factory:

```ts
export function createTerrainAuthoritySystem(input: {
  readonly world: WorldSpatialRead;
  readonly mapDefinitionId: string;
  readonly generationProfileId: string;
  readonly generationProfileVersion: number;
  readonly selectedSeed64: string;
  readonly source: TerrainFieldSource;
}): TerrainConstructionResult<TerrainAuthoritySystem>;
```

`TerrainConstructionResult<T>` uses the exact ledger union above. `invalid-source-dimensions` covers any source shape other than 513×513 for the production path; `invalid-elevation` covers failed logical-elevation parsing; `world-topology-rejected` covers an unexpected World owner-resolution rejection. No partial state escapes.

- [ ] **Step 1: Write RED authority tests**

Cover: initial revision `0`, full state has all 256 chunks, every valid Vertex stored exactly once in the World-defined owner Chunk, outer/seam ownership, product elevation bounds, 0.25m conversion, partial-state unavailable result, and out-of-bounds distinct from unavailable.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/authority.test.ts
```

- [ ] **Step 3: Implement private storage indexing and TerrainState**

`world-index.ts` may map already-validated World values to private numeric IDs; it must not reimplement owner/seam/incidence formulas. Owner resolution always comes from `WorldSpatialRead.ownerChunk(vertex)`.

Use primitive private keys below the application boundary so Terrain domain never imports World types:

```ts
export interface CanonicalVertexRecord {
  readonly chunkKey: number;
  readonly vertexKey: number;
  readonly elevation: LogicalElevation;
}

export function toVertexKey(vertex: VertexCoord, vertexWidth: number): number {
  return vertex.z * vertexWidth + vertex.x;
}

export function toChunkKey(chunk: ChunkCoord): number {
  return chunk.z * 16 + chunk.x;
}

// domain/terrain-state.ts receives number keys only.
export type TerrainChunkStore = ReadonlyMap<number, ReadonlyMap<number, LogicalElevation>>;
```

- [ ] **Step 4: Implement validate-all materialization**

Visit global vertices in canonical order `z=0..512`, then `x=0..512`, validate every elevation first, route each to exactly one World owner Chunk, and expose a full state only after all values validate. A failed production materialization must not expose a half-built state.

The implementation shape is a staged transaction:

```ts
const staged: CanonicalVertexRecord[] = [];
for (let z = 0; z < source.vertexHeight; z += 1) {
  for (let x = 0; x < source.vertexWidth; x += 1) {
    const elevation = parseLogicalElevation(source.elevationAt(x, z));
    if (elevation.status === "rejected") return elevation;
    const vertex = { x, z };
    const owner = world.ownerChunk(vertex);
    if (owner.status !== "success") return { status: "rejected", reason: "world-topology-rejected", detail: { code: owner.code } };
    staged.push({
      chunkKey: toChunkKey(owner.value),
      vertexKey: toVertexKey(vertex, source.vertexWidth),
      elevation: elevation.value,
    });
  }
}
// Construct and publish TerrainState exactly once from the complete staged array here.
```

No write to the live TerrainState occurs inside the validation loop.

- [ ] **Step 5: Add partial-state query proof below composition**

Construct an internal state with one owner Chunk absent and assert a valid Vertex in that Chunk returns:

```ts
{
  status: "unavailable",
  code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE",
  chunk: expectedOwner,
}
```

No zero/null/mesh fallback.

- [ ] **Step 6: Run P1-B gate**

```bash
pnpm --filter @web-three-city/terrain test
pnpm --filter @web-three-city/terrain typecheck
pnpm architecture:check
pnpm test
```

- [ ] **Step 7: Commit and review P1-B**

```bash
git add systems/terrain architecture.policy.json
git commit -m "feat(terrain): implement canonical chunk authority"
```

---

# P1-C — Exact Terrain Surface / Fixed Triangulation / Q16 Geometry

## Task 7: Implement the single semantic Terrain surface evaluator

**Files:**
- Create: `systems/terrain/src/domain/surface.ts`
- Modify: `systems/terrain/src/contracts/terrain-read.ts`
- Modify: `systems/terrain/src/application/terrain-read.ts`
- Modify: `systems/terrain/src/index.ts`
- Test: `systems/terrain/tests/surface.test.ts`

**Interfaces:**

Domain evaluator consumes no World type:

```ts
interface CellCorners {
  readonly sw: LogicalElevation;
  readonly se: LogicalElevation;
  readonly nw: LogicalElevation;
  readonly ne: LogicalElevation;
}

interface SurfaceSample {
  readonly triangle: TerrainTriangle;
  readonly heightQ16: number;
  readonly riseX: number;
  readonly riseZ: number;
  readonly runUnits: 32;
}

function evaluateSurface(
  corners: CellCorners,
  uQ16: number,
  vQ16: number,
): SurfaceSample;
```

Public application query accepts World `CellCoord` plus Q16 coordinates and returns semantic triangle, exact `heightQ16`, exact rises, `runUnits=32`, and revision.

- [ ] **Step 1: Write RED fixed-triangle/tie/height tests**

Use `Q=65536` and corners `SW=0, SE=8, NW=4, NE=20`. Assert:

```ts
expect(sample(0, 0)).toMatchObject({ triangle: "SW_TRIANGLE", heightQ16: 0 });
expect(sample(32768, 32768)).toMatchObject({
  triangle: "SW_TRIANGLE",
  heightQ16: 6 * 65536,
});
expect(sample(49152, 49152)).toMatchObject({
  triangle: "NE_TRIANGLE",
  heightQ16: 13 * 65536,
});
expect(triangleAt(32768, 32767)).toBe("SW_TRIANGLE");
expect(triangleAt(32768, 32768)).toBe("SW_TRIANGLE");
expect(triangleAt(32768, 32769)).toBe("NE_TRIANGLE");
```

Test multiple exact diagonal points and prove both triangle formulas return identical height there.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/surface.test.ts
```

- [ ] **Step 3: Implement exact integer barycentric equations**

Implement the frozen formulas directly. Do not use bilinear interpolation or floating epsilon:

```ts
const Q = 65536;
export function evaluateSurface(c: CellCorners, u: number, v: number): SurfaceSample {
  if (u + v <= Q) {
    return {
      triangle: "SW_TRIANGLE",
      heightQ16: c.sw * (Q - u - v) + c.se * u + c.nw * v,
      riseX: c.se - c.sw,
      riseZ: c.nw - c.sw,
      runUnits: 32,
    };
  }
  return {
    triangle: "NE_TRIANGLE",
    heightQ16: c.nw * (Q - u) + c.se * (Q - v) + c.ne * (u + v - Q),
    riseX: c.ne - c.nw,
    riseZ: c.ne - c.se,
    runUnits: 32,
  };
}
```

Exact slope facts:

```text
SW: riseX = SE-SW, riseZ = NW-SW
NE: riseX = NE-NW, riseZ = NE-SE
runUnits = 32
```

- [ ] **Step 4: Add cross-Cell continuity and unavailable-corner tests**

Adjacent Cells sharing an edge must return exactly equal Q16 height for the shared semantic location. If any required corner authority is unavailable, the whole surface query returns typed unavailable.

- [ ] **Step 5: Run P1-C gate**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/surface.test.ts
pnpm --filter @web-three-city/terrain test
pnpm architecture:check
```

- [ ] **Step 6: Commit and review P1-C**

```bash
git add systems/terrain/src systems/terrain/tests/surface.test.ts
git commit -m "feat(terrain): define exact triangulated surface"
```

---

# P1-D — Deterministic Generation + New-City Preparation

## Task 8: Implement and RED/GREEN the exact integer generator primitives

**Files:**
- Create: `systems/terrain/src/domain/generation/splitmix64.ts`
- Create: `systems/terrain/src/domain/generation/value-noise.ts`
- Test: `systems/terrain/tests/generation-primitives.test.ts`

**Interfaces:**
- Pure domain functions; no World, Three.js, browser, clock, `Math.random`, Promise-order, or GPU input.
- Seed arithmetic uses `bigint` modulo `2^64`; hash arithmetic uses unsigned 32-bit and `Math.imul` exactly as frozen.

- [ ] **Step 1: Write RED SplitMix64/hash/fade/lerp tests**

Layer seeds for `0x5EED5EED5EED5EED` must be exactly:

```ts
[0xB6E4D3F7, 0x598B0C68, 0x2B21BFCF, 0x8EACDFE9, 0x9EF86EE7]
```

Add explicit hash vectors:

```text
hash32(0xB6E4D3F7, 0, 0)   = 0x1B2DD25D -> value -25811
hash32(0xB6E4D3F7, 1, 0)   = 0xF0005DAE -> value  28672
hash32(0xB6E4D3F7, 0, 1)   = 0x98D95BA6 -> value   6361
hash32(0x598B0C68, 2, 3)   = 0xE64D68DD -> value  26189
hash32(0x9EF86EE7, 64, 64) = 0xA940873B -> value  10560
```

Signed truncation/fade vectors must include negative deltas:

```text
fadeQ16(0)     = 0
fadeQ16(16384) = 10240
fadeQ16(32768) = 32768
fadeQ16(49152) = 55296
fadeQ16(65536) = 65536

lerpInt(10,-10,32768)   = 0
lerpInt(-10,10,32768)   = 0
lerpInt(100,0,21845)    = 67
lerpInt(0,-100,21845)   = -33
lerpInt(-100,0,21845)   = -67
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/generation-primitives.test.ts
```

- [ ] **Step 3: Implement minimal exact integer primitives**

Use `BigInt.asUintN(64, value)` or an equivalent explicit `2^64-1` mask for SplitMix64. Use `>>> 0` and `Math.imul` for hash32. Implement a named `truncTowardZeroDivision` helper; do not rely on accidental coercion.

Core signed/Q16 helpers are explicit:

```ts
export function truncTowardZeroDivision(n: number, d: number): number {
  return Math.trunc(n / d);
}

export function fadeQ16(t: number): number {
  const q = 65536;
  const t2 = Math.floor((t * t) / q);
  return Math.floor((t2 * (3 * q - 2 * t)) / q);
}

export function lerpInt(a: number, b: number, t: number): number {
  return a + truncTowardZeroDivision((b - a) * t, 65536);
}
```

- [ ] **Step 4: Run GREEN repeatedly**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/generation-primitives.test.ts
```

Run at least twice to prove no ambient/random input leaks into primitive outputs.

- [ ] **Step 5: Commit**

```bash
git add systems/terrain/src/domain/generation systems/terrain/tests/generation-primitives.test.ts
git commit -m "feat(terrain): implement deterministic generation primitives"
```

## Task 9: Generate the full production field and enforce the frozen fingerprint

**Files:**
- Create: `systems/terrain/src/domain/generation/production-field.ts`
- Create: `systems/terrain/src/domain/generation/fingerprint.ts`
- Test: `systems/terrain/tests/generation-production.test.ts`

**Interfaces:**
- Produces immutable `ProductionTerrainField` with explicit `vertexWidth`, `vertexHeight`, and read-only `elevationAt(x,z)`.
- Fingerprint consumes canonical dimensions + signed int32 little-endian elevations in global `(z,x)` order.

- [ ] **Step 1: Write RED sample, full-envelope, repeatability, and fingerprint tests**

Assert the frozen samples:

```text
(0,0)       91
(256,256)  213
(512,512)  222
(153,191)  164
(358,191)  177
(153,319)  154
(358,319)  134
```

The critical owner-review assertion scans every value:

```ts
let min = Number.POSITIVE_INFINITY;
let max = Number.NEGATIVE_INFINITY;
for (let z = 0; z <= 512; z += 1) {
  for (let x = 0; x <= 512; x += 1) {
    const elevation = field.elevationAt(x, z);
    min = Math.min(min, elevation);
    max = Math.max(max, elevation);
    expect(elevation).toBeGreaterThanOrEqual(32);
    expect(elevation).toBeLessThanOrEqual(288);
  }
}
```

Assert exact fingerprint string `0xF2FA29BFD2AEB069` and exact equality of two independently generated fields for the same seed.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/generation-production.test.ts
```

Expected: FAIL until the full algorithm and byte stream are exact.

- [ ] **Step 3: Implement the five-octave production generator**

Use periods/amplitudes exactly `[(128,64),(64,32),(32,16),(16,8),(8,4)]`, `BASE_ELEVATION=160`, and `truncTowardZero(weighted/32768)`. No smoothing or clamping after generation.

The full-field loop remains canonical even if later optimized:

```ts
const OCTAVES = [[128, 64], [64, 32], [32, 16], [16, 8], [8, 4]] as const;
for (let z = 0; z <= 512; z += 1) {
  for (let x = 0; x <= 512; x += 1) {
    let weighted = 0;
    for (let i = 0; i < OCTAVES.length; i += 1) {
      const [period, amplitude] = OCTAVES[i];
      weighted += valueNoise(layerSeeds[i], x, z, period) * amplitude;
    }
    values[z * 513 + x] = 160 + truncTowardZeroDivision(weighted, 32768);
  }
}
```

- [ ] **Step 4: Implement 64-bit FNV-1a byte serialization exactly**

Hash byte order:

```text
u32 LE 513
u32 LE 513
for z 0..512, x 0..512:
  int32 two's-complement LE elevation
```

Do not include seed/profile/config bytes.

Encode each signed elevation through a four-byte little-endian buffer/view before feeding FNV-1a; do not hash decimal strings:

```ts
view.setUint32(0, 513, true);
view.setUint32(4, 513, true);
for (let z = 0; z <= 512; z += 1) {
  for (let x = 0; x <= 512; x += 1) {
    valueView.setInt32(0, field.elevationAt(x, z), true);
    for (const byte of valueBytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  }
}
```

- [ ] **Step 5: Keep the fingerprint as implementation authority**

If samples pass but fingerprint fails, inspect ordering/arithmetic/serialization and fix implementation. Do not change `generationProfileVersion` or frozen fingerprint in this PR.

- [ ] **Step 6: Run GREEN**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/generation-production.test.ts
```

Expected: all 263,169 values inside envelope and fingerprint exactly `0xF2FA29BFD2AEB069`.

- [ ] **Step 7: Commit**

```bash
git add systems/terrain/src/domain/generation systems/terrain/tests/generation-production.test.ts
git commit -m "feat(terrain): generate frozen production heightfield"
```

## Task 10: Evaluate exact starting suitability and prepare new-city Terrain once

**Files:**
- Create: `systems/terrain/src/contracts/generation.ts`
- Create: `systems/terrain/src/application/evaluate-starting-candidates.ts`
- Create: `systems/terrain/src/application/prepare-production-terrain.ts`
- Modify: `systems/terrain/src/composition/create-terrain.ts`
- Modify: `systems/terrain/src/composition.ts`
- Test: `systems/terrain/tests/suitability.test.ts`

**Interfaces:**

```ts
export interface StartingCandidateEvaluation {
  readonly regionId: RegionId;
  readonly eligible: boolean;
  readonly patchElevationRange: number;
  readonly maxCellCornerRange: number;
  readonly anchorCellCornerRange: number;
  readonly reasons: readonly TerrainStartingReason[];
}
```

`prepareProductionTerrain()` accepts prepared World read/config + explicit selected Seed64 and returns one opaque prepared field plus fingerprint/evaluation facts. `createTerrainAuthoritySystem()` in P1-B consumes an explicit validated field source. P1-E extends construction to the final `TerrainSystem` with commands; P1-D preparation supplies the exact production field and no construction path regenerates it.

- [ ] **Step 1: Write RED exact candidate-vector tests**

Assert the complete contract table:

```ts
expect(evaluations).toEqual([
  { regionId: "R06", eligible: true, patchElevationRange: 8,  maxCellCornerRange: 2, anchorCellCornerRange: 1, reasons: [] },
  { regionId: "R08", eligible: true, patchElevationRange: 11, maxCellCornerRange: 3, anchorCellCornerRange: 2, reasons: [] },
  { regionId: "R11", eligible: true, patchElevationRange: 6,  maxCellCornerRange: 2, anchorCellCornerRange: 1, reasons: [] },
  { regionId: "R13", eligible: true, patchElevationRange: 20, maxCellCornerRange: 4, anchorCellCornerRange: 2, reasons: [] },
]);
```

Add synthetic failures that prove fixed reason ordering:

```text
TERRAIN_START_UNAVAILABLE
TERRAIN_START_CELL_RELIEF_EXCEEDED
TERRAIN_START_PATCH_RELIEF_EXCEEDED
TERRAIN_START_ANCHOR_RELIEF_EXCEEDED
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/suitability.test.ts
```

- [ ] **Step 3: Implement the exact 9×9 / 10×10 formula**

For each anchor, inspect Cells `ax-4..ax+4`, `az-4..az+4`; each Cell corner range must be `<=8`; all 10×10 vertices range `<=24`; anchor Cell corner range `<=4`. Use generated integer elevation facts only.

Accumulate metrics in one deterministic pass and derive reasons in the frozen order:

```ts
const reasons: TerrainStartingReason[] = [];
if (unavailable) reasons.push("TERRAIN_START_UNAVAILABLE");
if (maxCellCornerRange > 8) reasons.push("TERRAIN_START_CELL_RELIEF_EXCEEDED");
if (patchElevationRange > 24) reasons.push("TERRAIN_START_PATCH_RELIEF_EXCEEDED");
if (anchorCellCornerRange > 4) reasons.push("TERRAIN_START_ANCHOR_RELIEF_EXCEEDED");
return {
  regionId: candidate.regionId,
  eligible: reasons.length === 0,
  patchElevationRange,
  maxCellCornerRange,
  anchorCellCornerRange,
  reasons,
};
```

- [ ] **Step 4: Implement one-shot production preparation and rejection semantics**

Validate profile, Seed64 syntax, accepted-seed membership, full envelope, fingerprint, and at least one eligible candidate. Use the frozen codes:

```text
TERRAIN_GENERATION_PROFILE_UNSUPPORTED
TERRAIN_GENERATION_SEED_INVALID
TERRAIN_GENERATION_SEED_NOT_ACCEPTED
TERRAIN_GENERATION_OUTPUT_OUT_OF_RANGE
TERRAIN_GENERATION_FINGERPRINT_MISMATCH
TERRAIN_GENERATION_NO_ELIGIBLE_START
```

There is no retry loop or seed substitution.

The preparation control flow is linear and contains no retry edge:

```text
validate profile id/version
-> validate Seed64 syntax
-> validate accepted-seed catalog membership
-> generate exactly one ProductionTerrainField
-> validate every one of the 263,169 elevations against [32,288]
-> validate fingerprint 0xF2FA29BFD2AEB069
-> evaluate R06, R08, R11, R13 in canonical order
-> reject when no candidate is eligible
-> return that exact field + fingerprint + evaluations
```

- [ ] **Step 5: Add a no-seed-mining test**

Inject/spy the generator seam at application level and prove a request invokes generation exactly once. A rejected fingerprint/candidate evaluation does not invoke a second seed.

- [ ] **Step 6: Run P1-D gate**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/generation-primitives.test.ts tests/generation-production.test.ts tests/suitability.test.ts
pnpm --filter @web-three-city/terrain test
pnpm architecture:check
```

- [ ] **Step 7: Commit and review P1-D**

```bash
git add systems/terrain/src systems/terrain/tests
git commit -m "feat(terrain): prepare deterministic new-city terrain"
```

---

# P1-E — Atomic Terrain Mutation + Revision / Change Reporting

## Task 11: Implement the Terrain command surface and atomic edit transaction

**Files:**
- Create: `systems/terrain/src/contracts/mutation.ts`
- Create: `systems/terrain/src/domain/mutation/commit-edits.ts`
- Create: `systems/terrain/src/application/apply-terrain-edits.ts`
- Create: `systems/terrain/src/commands.ts`
- Modify: `systems/terrain/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `systems/terrain/src/composition/create-terrain.ts`
- Test: `systems/terrain/tests/mutation.test.ts`

**Interfaces:**

```ts
export interface TerrainVertexEdit {
  readonly vertex: VertexCoord;
  readonly elevation: LogicalElevation;
}

export interface ApplyTerrainEdits {
  readonly edits: readonly TerrainVertexEdit[];
}

export interface TerrainChangeSet {
  readonly previousRevision: number;
  readonly newRevision: number;
  readonly changedVertices: readonly VertexCoord[];
  readonly affectedCells: readonly CellCoord[];
  readonly touchingLogicalChunks: readonly ChunkCoord[];
}

export interface TerrainMutationReceipt {
  readonly changed: boolean;
  readonly previousRevision: number;
  readonly newRevision: number;
  readonly changeSet: TerrainChangeSet;
}
```

At this task, add `@web-three-city/foundation-contracts: workspace:*` to Terrain production dependencies and add the `./commands` package export. Use `CommandResult<TerrainMutationReceipt, TerrainMutationRejection>` from that Foundation package.

Refresh dependency links/lockfile before RED:

```bash
pnpm install --ignore-scripts
pnpm rebuild esbuild
```

- [ ] **Step 1: Write RED validation-order and atomicity tests**

Cover every frozen rejection code and prove state equality before/after rejection. Duplicate detection must win even if the duplicated coordinate would fail a later validation class.

Use seam vertex `(32,32)` to assert deterministic derived facts after one real edit:

```ts
expect(receipt.changeSet.affectedCells).toEqual([
  { x: 31, z: 31 },
  { x: 32, z: 31 },
  { x: 31, z: 32 },
  { x: 32, z: 32 },
]);
expect(receipt.changeSet.touchingLogicalChunks).toEqual([
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: 0, z: 1 },
  { x: 1, z: 1 },
]);
```

- [ ] **Step 2: Write RED no-op/revision tests**

Assert empty and same-value lists succeed with `changed=false` and unchanged revision. One edit and 100 edits each advance revision exactly once.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/mutation.test.ts
```

- [ ] **Step 4: Implement fixed validation sequence**

The application layer owns World-coordinate validation/normalization and maps valid edits to primitive domain keys before commit; `domain/mutation/commit-edits.ts` never imports World:

```ts
interface CanonicalElevationUpdate {
  readonly vertexKey: number;
  readonly elevation: LogicalElevation;
}

interface TerrainStateMutationCore {
  withAtomicUpdates(
    updates: readonly CanonicalElevationUpdate[],
  ): TerrainStateMutationCore;
}

function commitCanonicalUpdates(
  state: TerrainStateMutationCore,
  updates: readonly CanonicalElevationUpdate[],
): TerrainStateMutationCore {
  return state.withAtomicUpdates(updates);
}
```

Sequence must be:

```text
duplicate detection
-> canonical sort (z,x)
-> bounds
-> owner Chunk availability
-> elevation integer/product bounds
-> same-value filtering
-> one atomic commit
-> revision +1 once
-> deterministic ChangeSet
```

Duplicate identification itself is based on coordinate identity; after duplicates are ruled out, all remaining validation uses canonical `(z,x)` order so caller order has no semantic effect.

- [ ] **Step 5: Prove command result is not an Integration Event**

`TerrainChangeSet`/receipt is returned to the direct caller. Do not import/create an event bus or require publication.

- [ ] **Step 6: Run P1-E gate**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/mutation.test.ts
pnpm --filter @web-three-city/terrain test
pnpm --filter @web-three-city/terrain typecheck
pnpm architecture:check
```

- [ ] **Step 7: Commit and review P1-E**

```bash
git add systems/terrain/src systems/terrain/tests/mutation.test.ts
git commit -m "feat(terrain): add atomic mutation transaction"
```

---

# P1-F — Three.js Render Sectors + Semantic Picking

## Task 12: Build deterministic render-sector geometry, normals, and dirty-sector mapping below browser level

**Files:**
- Create: `systems/terrain/src/presentation/three/render-sector.ts`
- Create: `systems/terrain/src/presentation/three/build-sector-geometry.ts`
- Create: `systems/terrain/src/presentation/three/presentation-normal.ts`
- Create: `systems/terrain/src/presentation/three/dirty-sectors.ts`
- Modify: `systems/terrain/package.json`
- Modify: `pnpm-lock.yaml`
- Test: `systems/terrain/tests/render-sector.test.ts`
- Test: `systems/terrain/tests/dirty-sectors.test.ts`

**Interfaces:**
- Presentation-owned `RenderSectorCoord` is private to `presentation/three`; never exported from Terrain root.
- Each sector: 64×64 Cells, 65×65 presentation vertices, 4,225 vertices, 8,192 triangles, 24,576 triangle indices.
- Position projection: `x*8`, `elevation*0.25`, `z*8`.

Before RED, add `three: 0.179.1` to Terrain production dependencies and `@types/three: 0.179.0` to Terrain devDependencies; this is the first task with a real Three.js consumer. Add no other dependency.

Refresh dependency links/lockfile:

```bash
pnpm install --ignore-scripts
pnpm rebuild esbuild
```

- [ ] **Step 1: Write RED sector topology tests**

For Sector `(0,0)`, first Cell indices must preserve semantic topology:

```ts
expect(firstSixIndices).toEqual([0, 1, 65, 65, 1, 66]);
expect(positionCount).toBe(65 * 65);
expect(indexCount).toBe(8192 * 3);
```

Build adjacent sectors and assert duplicate boundary positions for the same World Vertex are numerically equal.

- [ ] **Step 2: Write RED cross-sector normal tests**

Choose a non-flat field and a World Vertex on the x=64 sector seam. Build its normal from both neighboring sector contexts and assert equivalent normalized vector components. The computation must include semantic incident triangles across the sector boundary.

- [ ] **Step 3: Write RED dirty-sector tests**

Given a `TerrainChangeSet`, expand each affected Cell by the valid one-Cell Moore neighborhood, then map to sectors by 64×64 presentation topology. Assert a mutation far from a sector edge dirties one sector and a mutation at a sector corner dirties only the adjacent required sectors, not all 64.

- [ ] **Step 4: Run RED**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/render-sector.test.ts tests/dirty-sectors.test.ts
```

- [ ] **Step 5: Implement builders without WebGLRenderer**

Using Three.js `BufferGeometry`/attributes in Node is acceptable; do not create a renderer in these unit tests. Normals are derived floating presentation values; gameplay slope never reads them.

The builder emits the frozen diagonal explicitly:

```ts
for (let z = 0; z < 64; z += 1) {
  for (let x = 0; x < 64; x += 1) {
    const sw = z * 65 + x;
    const se = sw + 1;
    const nw = sw + 65;
    const ne = nw + 1;
    indices.push(sw, se, nw, nw, se, ne);
  }
}
```

Normal accumulation queries the global semantic incident triangles for each World Vertex before normalization; it never averages only the local sector copy.

- [ ] **Step 6: Run GREEN**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/render-sector.test.ts tests/dirty-sectors.test.ts
pnpm architecture:check
```

- [ ] **Step 7: Commit**

```bash
git add systems/terrain/src/presentation/three systems/terrain/tests/render-sector.test.ts systems/terrain/tests/dirty-sectors.test.ts
git commit -m "feat(terrain): build render sector projection"
```

## Task 13: Implement projection lifecycle and Raycaster → semantic-query picking

**Files:**
- Create: `systems/terrain/src/presentation/three/semantic-pick.ts`
- Create: `systems/terrain/src/presentation/three/terrain-projection.ts`
- Modify: `systems/terrain/src/composition/create-terrain.ts`
- Modify: `systems/terrain/src/composition.ts`
- Modify: `apps/game/src/presentation/create-scene.ts`
- Test: `tests/browser/terrain-phase-1.spec.ts`

**Interfaces:**

Terrain `./composition` exposes a presentation-specific factory such as:

```ts
export interface TerrainThreeProjection {
  readonly root: THREE.Group;
  rebuild(changeSet: TerrainChangeSet): void;
  dispose(): void;
}
```

Semantic pick helper consumes Raycaster candidate X/Z and re-queries World + Terrain; candidate Y is not used as semantic height.

- [ ] **Step 1: Write a RED browser test for real WebGL terrain visibility**

Boot a full prepared Terrain and assert the viewport has WebGL available, Terrain projection attaches 64 sector meshes, and no `pageerror` occurs. Expose only test-safe DOM dataset/count diagnostics from app composition if needed; do not export Three internals from system root.

- [ ] **Step 2: Write RED semantic-pick browser coverage**

Use a real `THREE.Raycaster` against a sector mesh, capture candidate X/Z, route through World `worldPositionToCell`, local Q16 conversion, and Terrain surface query. Assert returned triangle/height comes from semantic query output. Direct Raycaster Y must not be returned as the authoritative height field.

- [ ] **Step 3: Implement exact pick conversion**

For a World-resolved Cell:

```text
u = clamp(round(localX / 8 * 65536), 0, 65535)
v = clamp(round(localZ / 8 * 65536), 0, 65535)
```

Out-of-bounds candidates remain out-of-bounds; never clamp into the nearest Cell.

The pick helper uses candidate X/Z only:

```ts
const cellResult = world.worldPositionToCell({ x: hit.point.x, z: hit.point.z });
if (cellResult.status !== "success") return cellResult;
const bounds = world.cellBounds(cellResult.value);
if (bounds.status !== "success") return bounds;
const uQ16 = Math.max(0, Math.min(65535, Math.round(((hit.point.x - bounds.value.xMinInclusive) / 8) * 65536)));
const vQ16 = Math.max(0, Math.min(65535, Math.round(((hit.point.z - bounds.value.zMinInclusive) / 8) * 65536)));
return terrain.sampleSurface(cellResult.value, uQ16, vQ16);
```

`hit.point.y` is intentionally absent from the semantic return calculation.

- [ ] **Step 4: Implement projection lifecycle**

Initial attach requires full Terrain. Build 64 sectors. `rebuild(changeSet)` replaces only deterministic dirty sectors and disposes replaced geometry/material resources. `dispose()` is idempotent and disposes all owned resources.

Use one owned `THREE.Group` plus one `Map<string, THREE.Mesh>`. Task 12 defines the package-private projection helpers consumed here:

```ts
function renderSectorKey(coord: RenderSectorCoord): string;
function buildRenderSectorGeometry(coord: RenderSectorCoord): THREE.BufferGeometry;
function computeDirtyRenderSectors(
  changeSet: TerrainChangeSet,
): readonly RenderSectorCoord[];
```

`rebuild(changeSet)` visits `computeDirtyRenderSectors(changeSet)` in canonical `(z,x)` order, disposes and replaces only those meshes, and preserves every unaffected sector. `dispose()` detaches/disposes every owned mesh exactly once, clears the map, and is idempotent.

- [ ] **Step 5: Modify app scene wrapper only as required for composition**

`createScene` may expose app-internal `scene`, `camera`, and `render()`/`requestRender()` lifecycle so the app can attach the Terrain projection. Increase camera far-plane/position to cover the 4096m map; this remains app presentation and never changes World coordinates.

- [ ] **Step 6: Run targeted browser GREEN**

```bash
pnpm exec playwright test tests/browser/terrain-phase-1.spec.ts --project=chromium
```

Expected: visibility, real Raycaster semantic-pick flow, localized refresh, disposal, and zero uncaught page errors pass.

- [ ] **Step 7: Run P1-F gate and commit**

```bash
pnpm --filter @web-three-city/terrain test
pnpm typecheck
pnpm architecture:check
pnpm exec playwright test tests/browser/terrain-phase-1.spec.ts --project=chromium
git add systems/terrain apps/game/src/presentation/create-scene.ts tests/browser/terrain-phase-1.spec.ts
git commit -m "feat(terrain): integrate Three.js terrain projection"
```

---

# P1-G — Snapshot Contracts + Full New-City Vertical Slice

## Task 14: Finalize Terrain semantic snapshots and canonical ordering

**Files:**
- Create: `systems/terrain/src/contracts/snapshot.ts`
- Create: `systems/terrain/src/application/capture-terrain-snapshot.ts`
- Modify: `systems/terrain/src/index.ts`
- Test: `systems/terrain/tests/snapshot.test.ts`

**Interfaces:**

```ts
export interface TerrainStateSnapshot {
  readonly mapDefinitionId: string;
  readonly generationProfileId: "balanced-temperate-generation";
  readonly generationProfileVersion: 2;
  readonly selectedSeed64: string;
  readonly revision: number;
  readonly completeness: "partial" | "full";
  readonly chunks: readonly TerrainChunkSnapshot[];
}
```

Chunk order is `(z,x)` ascending; owned elevations are canonical owner-window `(z,x)` order. No Mesh, normals, material, sectors, renderer, raycast acceleration, or GPU state appears in snapshots.

- [ ] **Step 1: Write RED snapshot-order and authority-only tests**

Assert full state has 256 ordered chunks, every canonical Vertex appears exactly once across owner windows, reconstruction in global `(z,x)` order equals the source field, revision starts at 0 and reflects one later mutation, and JSON keys contain no presentation data.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/snapshot.test.ts
```

- [ ] **Step 3: Implement snapshot capture as a pure read**

Snapshot capture must not increment revision or rebuild presentation. It serializes semantic data only; no concrete file/IndexedDB encoding is introduced.

Capture from canonical owner storage only:

```text
TerrainStateSnapshot field order:
mapDefinitionId
generationProfileId = balanced-temperate-generation
generationProfileVersion = 2
selectedSeed64
revision
completeness
chunks ordered by ChunkCoord (z,x)
  -> chunkCoord
  -> owned elevations ordered by owner-window VertexCoord (z,x)
```

Implement `captureTerrainSnapshot(state)` directly from private Terrain authority and explicit sorted copies; never depend on Map insertion order.

- [ ] **Step 4: Run GREEN and commit**

```bash
pnpm --filter @web-three-city/terrain exec vitest run tests/snapshot.test.ts
pnpm architecture:check
git add systems/terrain/src systems/terrain/tests/snapshot.test.ts
git commit -m "feat(terrain): capture canonical terrain snapshots"
```

## Task 15: Compose the exact new-city path in `apps/game` and run the Phase 1 release gate

**Files:**
- Modify: `apps/game/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/game/src/bootstrap/main.ts`
- Modify: `apps/game/src/composition/create-game.ts`
- Modify: `apps/game/src/presentation/create-scene.ts`
- Modify: `tests/browser/bootstrap.spec.ts`
- Modify/Test: `tests/browser/terrain-phase-1.spec.ts`

**Interfaces:**
- App depends on `@web-three-city/world` and `@web-three-city/terrain` through declared workspace dependencies.
- App bootstrap supplies explicit new-city input; system packages do not invent defaults.

Explicit production bootstrap request for Phase 1:

```ts
const newCityRequest = {
  seed64: "0x5EED5EED5EED5EED",
  startingRegionId: "R06",
} as const;
```

Canonical composition sequence:

```text
prepareProductionWorldDefinition
-> prepareProductionTerrain(seed exactly once)
-> inspect exact candidate evaluations
-> verify caller-selected R06 is eligible
-> createInitialWorldSystem
-> create full TerrainSystem from the exact prepared field
-> create Terrain Three.js projection
-> attach projection root to app scene
-> render
```

- [ ] **Step 1: Write RED app-composition/browser expectations before wiring production systems**

Extend browser assertions to require:

```text
data-bootstrap="ready"
data-world-map="web-three-city-production"
data-starting-region="R06"
data-terrain-seed="0x5EED5EED5EED5EED"
data-terrain-fingerprint="0xF2FA29BFD2AEB069"
data-terrain-revision="0"
data-terrain-completeness="full"
data-terrain-sectors="64"
```

These are diagnostics for acceptance, not gameplay authority.

- [ ] **Step 2: Run RED**

```bash
pnpm exec playwright test tests/browser/bootstrap.spec.ts tests/browser/terrain-phase-1.spec.ts --project=chromium
```

Expected: FAIL because app composition does not yet construct World/Terrain.

- [ ] **Step 3: Add declared app workspace dependencies and wire the explicit new-city sequence**

`apps/game/package.json` adds:

```json
"@web-three-city/world": "workspace:*",
"@web-three-city/terrain": "workspace:*"
```

Do not import system private files. App may use both composition surfaces; systems may not use each other's composition surfaces.

After editing app dependencies, refresh the lockfile before RED/GREEN reruns:

```bash
pnpm install --ignore-scripts
pnpm rebuild esbuild
```

Wire only exported surfaces:

```ts
const worldPreparation = prepareProductionWorldDefinition();
if (worldPreparation.status === "rejected") return worldPreparation;

const terrainPreparation = prepareProductionTerrain({
  world: worldPreparation.value,
  seed64: request.seed64,
});
if (terrainPreparation.status === "rejected") return terrainPreparation;

const evaluations = terrainPreparation.value.candidateEvaluations;
const selected = evaluations.find(
  (evaluation) => evaluation.regionId === request.startingRegionId,
);
if (selected === undefined || !selected.eligible) {
  return { status: "rejected", code: "WORLD_STARTING_REGION_NOT_ELIGIBLE" };
}
const eligibleStartingRegionIds = evaluations
  .filter((evaluation) => evaluation.eligible)
  .map((evaluation) => evaluation.regionId);

const world = createInitialWorldSystem({
  prepared: worldPreparation.value,
  selectedStartingRegionId: request.startingRegionId,
  eligibleStartingRegionIds,
});
```

Every rejected result is handled before reading `.value`; no fallback seed/Region is substituted.

- [ ] **Step 4: Preserve WebGL-unavailable behavior without fabricating authority**

World/Terrain semantic construction may succeed even if WebGL presentation is unavailable. UI status may report presentation unavailability, but must not mutate/replace World or Terrain state.

- [ ] **Step 5: Run package-focused regression first**

```bash
pnpm --filter @web-three-city/world test
pnpm --filter @web-three-city/terrain test
pnpm typecheck
pnpm architecture:check
```

Expected: all semantic suites pass with zero architecture violations.

- [ ] **Step 6: Run targeted browser verification**

```bash
pnpm exec playwright test tests/browser/bootstrap.spec.ts tests/browser/terrain-phase-1.spec.ts --project=chromium
```

Expected: both bootstrap and Terrain vertical-slice journeys pass with zero page errors.

- [ ] **Step 7: Run the exact full repository release gate**

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm architecture:check
pnpm build
pnpm test:browser
pnpm verify
```

CI must additionally prove exact HEAD and clean worktree under the repository workflow. SonarQube Cloud Quality Gate must be PASS if the repository integration is active for the PR.

- [ ] **Step 8: Perform final Phase 1 contract audit before merge**

Verify explicitly:

```text
no systems/map
no foundation/spatial
no orchestration package
no World command export
Terrain -> World root is the only system read exception
no Terrain domain import of World/Three/browser
263,169 generated elevations all inside [32,288]
fingerprint = 0xF2FA29BFD2AEB069
R06 metrics = 8/2/1 eligible
R08 metrics = 11/3/2 eligible
R11 metrics = 6/2/1 eligible
R13 metrics = 20/4/2 eligible
all 256 Terrain chunks materialized
all 64 render sectors built
mesh/raycast remains derived
World/Terrain snapshots contain no presentation state
```

- [ ] **Step 9: Commit and review P1-G**

```bash
git add apps/game systems/world systems/terrain architecture.policy.json tests/browser
git commit -m "feat: complete Phase 1 world terrain vertical slice"
```

Do not start Terraform/Roads or another gameplay phase until P1-G exact-head verification is green and the Phase 1 implementation PR is merged.

---

## Required RED Evidence by Delivery

| Delivery | Required first failing authority |
| --- | --- |
| P1-A | World exports/topology/map-region tests fail before implementation |
| P1-B | Terrain public authority/chunk availability tests fail before implementation |
| P1-C | fixed triangle/tie/Q16 surface tests fail before evaluator |
| P1-D | SplitMix/hash/Q16 vectors, then production fingerprint/candidate vectors fail before generator |
| P1-E | mutation validation/revision/atomicity tests fail before command path |
| P1-F | sector topology/normal/dirty mapping and targeted browser projection tests fail before presentation |
| P1-G | snapshot ordering and app new-city vertical-slice tests fail before final wiring |

RED commits/runs must be retained as PR evidence. A failure caused only by syntax/tooling setup is not sufficient RED evidence once the package shell exists; the relevant behavioral assertion must be observed failing for the intended missing behavior.

## Required GREEN Evidence by Delivery

Each delivery records in its PR body:

```text
exact branch HEAD SHA
focused Vitest command + result count
package typecheck result
architecture:check result
browser command/result only when required
full repository gate for P1-G
clean-worktree result
Sonar Quality Gate result when available
```

Do not claim a milestone complete from a prior SHA after changing production/test files. Re-run exact-head verification.

## Plan Self-Review Checklist

This plan intentionally covers every frozen Phase 1 implementation obligation:

- World package ownership and only `.` + `./composition`
- exact 512×512 / 32×32 / 16×16 spatial model
- normative south-west Vertex ownership + exhaustive seams/corners
- exact production Region partition, cell-count coverage, adjacency, candidates/anchors
- explicit accepted seed catalog and no fallback selection
- Terrain package root/commands/composition surfaces + approved World root edge
- Terrain domain isolation from World package code
- owner-only canonical Vertex storage, full/partial authority, revision 0
- exact NW→SE/Q16 surface with frozen diagonal tie and rational slope facts
- SplitMix64/hash/fade/signed truncation exact vectors
- all 263,169 generator values checked against `[32,288]`
- frozen production field fingerprint
- exact four starting-candidate metrics and reason ordering
- generate-once/no-seed-mining behavior
- atomic mutation validation order, no-op semantics, single revision increment, deterministic ChangeSet
- 64 Three.js render sectors, fixed topology, cross-sector normals, localized dirty rebuild
- Raycaster as candidate only + semantic World/Terrain re-query
- World/Terrain semantic snapshots with no presentation authority
- explicit app new-city construction without orchestration
- targeted browser verification plus final full repository gate

No production persistence encoding, runtime event bus, Terraform policy, Roads, Zoning, Buildings, Hydrology/Water, scheduler/ECS, `systems/map`, or `foundation/spatial` is included.
