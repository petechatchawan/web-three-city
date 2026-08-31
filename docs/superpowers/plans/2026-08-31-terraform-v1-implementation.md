# Terraform v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build production Terraform v1 with Raise, Lower, reference-level Flatten, 1×1/3×3/5×5 Gameplay Cell brushes, revision-safe transient Undo, exact Terrain-conforming gameplay overlay, mouse/touch interaction, save/load acceptance, performance baselines, and production closure without reopening Terrain Engine v1.

**Architecture:** `systems/terraform` reads only World and Terrain root surfaces and produces immutable Terraform plans plus Terraform-owned presentation contracts. It never imports Terrain commands/composition. `apps/game` executes validated plans through `TerrainCommands.applyEdits()`, rebuilds Terrain presentation from the Terrain receipt, maps `TerrainChangeSet.touchingLogicalChunks` into Terraform-owned invalidation, and updates transient Undo/UI state. `CitySaveV1` remains unchanged.

**Tech Stack:** Node 22.18.0, pnpm 10.15.1, TypeScript 5.9.2, Three.js 0.179.1, Vitest 3.2.4, Playwright 1.55.0, Vite 7.1.3.

**Spec:** `docs/systems/terraform/specs/TERRAFORM-V1-PRODUCT-SPEC.md`

## Global Constraints

- Terrain Engine v1 remains Production Closed; do not modify Terrain authority, snapshot schema, generation, triangulation, or mutation semantics.
- Gameplay Cell is exactly 8m × 8m on the current production map.
- `LogicalElevation` remains 0.25m per level with Terrain-owned range `-4096..4096`.
- Operations are exactly `raise`, `lower`, `flatten`.
- Brushes are exactly `1 | 3 | 5` Gameplay Cells.
- Strengths are Fine = 1 level = 0.25m, Normal = 4 levels = 1m, Strong = 16 levels = 4m; Normal is default.
- Flatten target is always a canonical `LogicalElevation` from the nearest semantic-picked cell corner. Reference sampling must be in-world, unlocked, and Terrain-readable.
- Footprints are all-or-nothing at World and unlocked-region boundaries; no clipping and no partial commit.
- `systems/terraform` may import `@web-three-city/world` and `@web-three-city/terrain` root surfaces only. It must not import `@web-three-city/terrain/commands` or `@web-three-city/terrain/composition`.
- `TerrainChangeSet` remains Terrain-owned. `apps/game` maps it to Terraform-owned invalidation containing only `touchingLogicalChunks`.
- One valid changed action creates at most one Terrain command, one Terrain revision increment, and one Undo entry.
- Revision check and Terrain command execution are synchronous with no `await` between them.
- Undo is transient, capped at 100 entries, supports multiple sequential Undo operations, invalidates on external Terrain revision change, and is not persisted.
- Redo is out of scope.
- Camera gestures always win over Terraform commit; Terraform never continuously mutates while dragging.
- Terraform Grid Overlay is gameplay presentation separate from Terrain Debug Grid.
- `CitySaveV1` remains unchanged; edited Terrain persists through `terrainSnapshot`.
- Performance work records baselines first; no threshold is invented before evidence and explicit adoption.
- Every implementation milestone ends with focused tests plus `pnpm verify` before merge.

---

## Delivery Sequence

Use separate milestone branches from verified `master` after the previous milestone merges:

```text
TF1 Pure Terraform Core
  ↓
TF2 Live Terrain Mutation + Undo Integration
  ↓
TF3 Terraform Three.js Presentation
  ↓
TF4 Mouse + Touch Interaction
  ↓
TF5 Production UI + Live Composition
  ↓
TF6 Persistence + Browser E2E
  ↓
TF7 Hardening + Production Closure
```

---

## File Map

### New system package

```text
systems/terraform/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── composition.ts
│   ├── contracts/
│   │   ├── terraform-types.ts
│   │   └── terraform-three.ts
│   ├── domain/
│   │   ├── brush-footprint.ts
│   │   ├── flatten-reference.ts
│   │   └── strength.ts
│   ├── application/
│   │   ├── plan-terraform.ts
│   │   └── undo-history.ts
│   └── presentation/three/
│       ├── build-grid-chunk-geometry.ts
│       ├── overlay-config.ts
│       └── terraform-three-overlay.ts
└── tests/
    ├── brush-footprint.test.ts
    ├── flatten-reference.test.ts
    ├── plan-terraform.test.ts
    ├── undo-history.test.ts
    ├── presentation-three.test.ts
    └── public-surface.test.ts
```

### Integration/app files

```text
orchestration/city-session/src/contracts/city-session.ts
orchestration/city-session/tests/lifecycle.test.ts
apps/game/src/composition/systems/terrain-lifecycle-adapter.ts
apps/game/src/composition/terraform/create-terraform-runtime.ts
apps/game/src/composition/terraform/terraform-pointer-session.ts
apps/game/src/composition/create-live-city-experience.ts
apps/game/src/presentation/input/create-city-input-controller.ts
apps/game/src/ui/create-terraform-toolbar.ts
apps/game/src/ui/screens/create-game-screen.ts
apps/game/src/style.css
apps/game/tests/lifecycle-adapters.test.ts
apps/game/tests/terraform-runtime.test.ts
apps/game/tests/terraform-pointer-session.test.ts
apps/game/tests/terraform-toolbar.test.ts
```

### Browser/release files

```text
tests/browser/terraform.spec.ts
tests/browser/terraform-persistence.spec.ts
tests/browser/terraform-performance.spec.ts
tests/browser/terraform-lifecycle-soak.spec.ts
apps/game/tests/terraform-performance-baseline.test.ts
.github/workflows/terraform-hardening.yml
docs/systems/terraform/README.md
docs/systems/terraform/verification/TERRAFORM-V1-PRODUCTION-CLOSURE.md
```

---

# TF1 — Pure Terraform Core

## Task 1: Scaffold the Terraform package and architecture policy

**Files:**
- Create: `systems/terraform/package.json`
- Create: `systems/terraform/tsconfig.json`
- Create: `systems/terraform/src/index.ts`
- Create: `systems/terraform/src/composition.ts`
- Create: `systems/terraform/tests/public-surface.test.ts`
- Modify: `architecture.policy.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: World/Terrain root read surfaces only.
- Produces: `@web-three-city/terraform` and `@web-three-city/terraform/composition`.

- [ ] **Step 1: Add architecture policy edges**

Add exactly:

```json
{
  "from": "@web-three-city/terraform",
  "to": "@web-three-city/world",
  "reference": "docs/systems/terraform/specs/TERRAFORM-V1-PRODUCT-SPEC.md § 3"
},
{
  "from": "@web-three-city/terraform",
  "to": "@web-three-city/terrain",
  "reference": "docs/systems/terraform/specs/TERRAFORM-V1-PRODUCT-SPEC.md § 3"
}
```

- [ ] **Step 2: Create package metadata**

`package.json`:

```json
{
  "name": "@web-three-city/terraform",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./composition": "./src/composition.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "@web-three-city/terrain": "workspace:*",
    "@web-three-city/world": "workspace:*",
    "three": "0.179.1"
  },
  "devDependencies": {
    "@types/three": "0.179.0",
    "typescript": "5.9.2",
    "vitest": "3.2.4"
  }
}
```

`tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["vitest/globals"] },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Write public-surface smoke test**

```ts
import { describe, expect, it } from "vitest";
import * as terraform from "@web-three-city/terraform";
import * as composition from "@web-three-city/terraform/composition";

describe("terraform package", () => {
  it("exposes explicit root and composition surfaces", () => {
    expect(terraform).toBeDefined();
    expect(composition).toBeDefined();
  });
});
```

- [ ] **Step 4: Add explicit empty exports and refresh lockfile**

```ts
// src/index.ts
export {};
```

```ts
// src/composition.ts
export {};
```

Run:

```bash
pnpm install --lockfile-only
pnpm --filter @web-three-city/terraform typecheck
pnpm --filter @web-three-city/terraform test
pnpm architecture:check
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add systems/terraform architecture.policy.json pnpm-lock.yaml
git commit -m "feat(terraform): scaffold system boundary"
```

## Task 2: Implement frozen types, strengths, and brush mapping

**Files:**
- Create: `systems/terraform/src/contracts/terraform-types.ts`
- Create: `systems/terraform/src/domain/strength.ts`
- Create: `systems/terraform/src/domain/brush-footprint.ts`
- Create: `systems/terraform/tests/brush-footprint.test.ts`
- Modify: `systems/terraform/src/index.ts`

**Produces:**

```ts
TerraformOperation
TerraformBrushSize
TerraformStrength
TerraformInvalidReason
TerraformVertexMutation
TerraformPlan
TerraformPreview
strengthLevels()
buildBrushFootprint()
```

- [ ] **Step 1: Write RED tests**

```ts
it.each([
  [1, 1, 4],
  [3, 9, 16],
  [5, 25, 36],
] as const)("maps %i brush to cells/vertices", (size, cells, vertices) => {
  const result = buildBrushFootprint({ x: 100, z: 100 }, size);
  expect(result.cells).toHaveLength(cells);
  expect(result.vertices).toHaveLength(vertices);
});

it("locks strength levels", () => {
  expect(strengthLevels("fine")).toBe(1);
  expect(strengthLevels("normal")).toBe(4);
  expect(strengthLevels("strong")).toBe(16);
});
```

Run:

```bash
pnpm --filter @web-three-city/terraform test -- brush-footprint.test.ts
```

Expected: RED because implementation is absent.

- [ ] **Step 2: Add binding contract types**

```ts
import type { CellCoord, VertexCoord } from "@web-three-city/world";
import type { LogicalElevation, TerrainRevision } from "@web-three-city/terrain";

export type TerraformOperation = "raise" | "lower" | "flatten";
export type TerraformBrushSize = 1 | 3 | 5;
export type TerraformStrength = "fine" | "normal" | "strong";
export type TerraformInvalidReason =
  | "OUT_OF_WORLD"
  | "LOCKED_REGION"
  | "TERRAIN_UNAVAILABLE"
  | "ELEVATION_LIMIT"
  | "FLATTEN_TARGET_NOT_SELECTED"
  | "STALE_TERRAIN_REVISION";

export interface TerraformVertexMutation {
  readonly vertex: VertexCoord;
  readonly previousElevation: LogicalElevation;
  readonly desiredElevation: LogicalElevation;
}

export interface TerraformPlan {
  readonly operation: TerraformOperation;
  readonly targetCell: CellCoord;
  readonly footprintCells: readonly CellCoord[];
  readonly influenceCells: readonly CellCoord[];
  readonly edits: readonly TerraformVertexMutation[];
  readonly expectedTerrainRevision: TerrainRevision;
}
```

Add the spec-defined valid/invalid `TerraformPreview` union in the same file.

- [ ] **Step 3: Implement strength mapping and footprint builder**

`strength.ts`:

```ts
export function strengthLevels(strength: TerraformStrength): 1 | 4 | 16 {
  switch (strength) {
    case "fine": return 1;
    case "normal": return 4;
    case "strong": return 16;
  }
}
```

`brush-footprint.ts` builds inclusive cell bounds and surrounding vertex bounds exactly as the frozen spec states. Return frozen arrays sorted by `z`, then `x`.

- [ ] **Step 4: Export and verify GREEN**

```bash
pnpm --filter @web-three-city/terraform test -- brush-footprint.test.ts
pnpm --filter @web-three-city/terraform typecheck
```

- [ ] **Step 5: Commit**

```bash
git add systems/terraform
git commit -m "feat(terraform): define brush and strength semantics"
```

## Task 3: Implement Raise/Lower planner validation and influence cells

**Files:**
- Create: `systems/terraform/src/application/plan-terraform.ts`
- Create: `systems/terraform/tests/plan-terraform.test.ts`
- Modify: `systems/terraform/src/index.ts`

**Consumes:** `MapDefinitionRead`, `MapStateRead`, `WorldSpatialRead`, `TerrainAuthorityRead`.

**Produces:** `planTerraform(input): TerraformPreview`.

- [ ] **Step 1: Write valid Raise test**

For target `(10,10)`, 1×1, Normal, current elevations all `20`, Terrain revision `7`:

```ts
expect(preview.status).toBe("valid");
if (preview.status === "valid") {
  expect(preview.plan.edits).toHaveLength(4);
  expect(preview.plan.edits.every((edit) => edit.desiredElevation === 24)).toBe(true);
  expect(preview.plan.expectedTerrainRevision).toBe(7);
  expect(preview.plan.influenceCells).not.toContainEqual({ x: 10, z: 10 });
}
```

- [ ] **Step 2: Write rejection tests**

Test exactly:

```text
5×5 centered at (0,0) -> OUT_OF_WORLD
one selected cell in locked region -> LOCKED_REGION
one required vertex unavailable -> TERRAIN_UNAVAILABLE
Strong Raise from 4090 -> ELEVATION_LIMIT
Strong Lower from -4090 -> ELEVATION_LIMIT
```

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/terraform test -- plan-terraform.test.ts
```

- [ ] **Step 4: Implement planner in this strict order**

```text
capture Terrain revision
build footprint
validate explicit World bounds
validate every cell region is unlocked
read every required vertex elevation
resolve desired elevation
validate using parseLogicalElevation
remove unchanged edits
derive influence cells from incidentCells(changed vertex)
return frozen deterministic result
```

Raise/Lower calculation:

```ts
const sign = input.operation === "lower" ? -1 : 1;
const parsed = parseLogicalElevation(current + sign * strengthLevels(input.strength));
if (parsed.status !== "success") return invalid("ELEVATION_LIMIT");
```

- [ ] **Step 5: Sort influence deterministically**

De-duplicate via `${x}:${z}`, remove primary cells, sort by `z` then `x`.

- [ ] **Step 6: Verify**

```bash
pnpm --filter @web-three-city/terraform test -- plan-terraform.test.ts
pnpm --filter @web-three-city/terraform typecheck
pnpm architecture:check
```

- [ ] **Step 7: Commit**

```bash
git add systems/terraform
git commit -m "feat(terraform): plan raise and lower edits"
```

## Task 4: Implement canonical Flatten reference and Flatten planning

**Files:**
- Create: `systems/terraform/src/domain/flatten-reference.ts`
- Create: `systems/terraform/tests/flatten-reference.test.ts`
- Modify: `systems/terraform/src/application/plan-terraform.ts`
- Modify: `systems/terraform/tests/plan-terraform.test.ts`
- Modify: `systems/terraform/src/index.ts`

- [ ] **Step 1: Write nearest-corner tests**

```ts
expect(resolveCorner({ cell: { x: 5, z: 7 }, uQ16: 0, vQ16: 0 })).toEqual({ x: 5, z: 7 });
expect(resolveCorner({ cell: { x: 5, z: 7 }, uQ16: 65535, vQ16: 0 })).toEqual({ x: 6, z: 7 });
expect(resolveCorner({ cell: { x: 5, z: 7 }, uQ16: 0, vQ16: 65535 })).toEqual({ x: 5, z: 8 });
expect(resolveCorner({ cell: { x: 5, z: 7 }, uQ16: 32768, vQ16: 32768 })).toEqual({ x: 6, z: 8 });
```

Add rejection cases for locked reference cell and unavailable selected vertex.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/terraform test -- flatten-reference.test.ts
```

- [ ] **Step 3: Implement reference resolver**

Input includes semantic pick cell/uQ16/vQ16, World/map state, and Terrain read. Validate picked cell unlocked before reading its chosen corner elevation. Return exact `LogicalElevation` only.

- [ ] **Step 4: Add Flatten planner tests**

```text
no flattenTarget -> FLATTEN_TARGET_NOT_SELECTED
flattenTarget 31 -> all changed vertices desired 31
already flat at 31 -> valid plan with zero edits
Fine/Normal/Strong selection does not change Flatten output
```

- [ ] **Step 5: Implement Flatten branch and verify**

```bash
pnpm --filter @web-three-city/terraform test
pnpm --filter @web-three-city/terraform typecheck
```

- [ ] **Step 6: Commit**

```bash
git add systems/terraform
git commit -m "feat(terraform): add reference-level flatten"
```

## Task 5: Implement revision-safe 100-entry Undo history

**Files:**
- Create: `systems/terraform/src/application/undo-history.ts`
- Create: `systems/terraform/tests/undo-history.test.ts`
- Modify: `systems/terraform/src/index.ts`

- [ ] **Step 1: Write RED tests**

Cover:

```text
changed commit pushes one inverse entry
zero-edit/no-change pushes none
101 entries retain newest 100
external revision mismatch clears history
A 100->101, B 101->102, Undo B 102->103, then Undo A is still allowed at 103
```

- [ ] **Step 2: Implement API**

```ts
export interface TerraformUndoEntry {
  readonly inverseEdits: readonly {
    readonly vertex: VertexCoord;
    readonly elevation: LogicalElevation;
  }[];
}

export interface TerraformUndoHistory {
  depth(): number;
  expectedTerrainRevision(): TerrainRevision;
  recordCommit(plan: TerraformPlan, newRevision: TerrainRevision): void;
  peekUndo(currentRevision: TerrainRevision): TerraformUndoEntry | undefined;
  recordUndo(newRevision: TerrainRevision): void;
  synchronizeExternalRevision(currentRevision: TerrainRevision): void;
  clear(): void;
}
```

`recordCommit()` derives inverse edits from `plan.edits[].previousElevation`.

`peekUndo()` clears history and synchronizes expected revision when current revision differs.

`recordUndo()` pops one entry and sets expected revision to the new Terrain revision.

- [ ] **Step 3: Verify TF1**

```bash
pnpm --filter @web-three-city/terraform test
pnpm --filter @web-three-city/terraform typecheck
pnpm architecture:check
pnpm verify
```

- [ ] **Step 4: Commit and merge TF1**

```bash
git add systems/terraform
git commit -m "feat(terraform): add revision-safe undo history"
```

---

# TF2 — Live Terrain Mutation + Undo Integration

## Task 6: Expose typed Terrain commands through Live City session

**Files:**
- Modify: `orchestration/city-session/src/contracts/city-session.ts`
- Modify: `apps/game/src/composition/systems/terrain-lifecycle-adapter.ts`
- Modify: `orchestration/city-session/tests/lifecycle.test.ts`
- Modify: `apps/game/tests/lifecycle-adapters.test.ts`

- [ ] **Step 1: Write failing adapter assertion**

```ts
expect(result.status).toBe("success");
if (result.status === "success") {
  expect(typeof result.value.commands.applyEdits).toBe("function");
}
```

- [ ] **Step 2: Extend session contract**

```ts
import type { TerrainCommands } from "@web-three-city/terrain/commands";

export interface TerrainSessionHandle {
  readonly read: TerrainAuthorityRead;
  readonly commands: TerrainCommands;
  readonly opaque: unknown;
  captureSnapshot(): TerrainStateSnapshotV1;
}
```

Do not change `CitySaveV1`.

- [ ] **Step 3: Adapt TerrainSystem**

```ts
value: Object.freeze({
  read: system.read,
  commands: system.commands,
  opaque: system,
  captureSnapshot: () => system.captureSnapshot(),
})
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter @web-three-city/orchestration-city-session test
pnpm --filter @web-three-city/app-game test -- lifecycle-adapters.test.ts
pnpm architecture:check
```

- [ ] **Step 5: Commit**

```bash
git add orchestration/city-session apps/game/src/composition/systems/terrain-lifecycle-adapter.ts apps/game/tests/lifecycle-adapters.test.ts
git commit -m "feat(city-session): expose live terrain commands"
```

## Task 7: Add app Terraform executor and Undo execution

**Files:**
- Modify: `apps/game/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/game/src/composition/terraform/create-terraform-runtime.ts`
- Create: `apps/game/tests/terraform-runtime.test.ts`

**Produces:** synchronous `commit(plan)` and `undo()`.

- [ ] **Step 1: Add app dependency and refresh lockfile**

```json
"@web-three-city/terraform": "workspace:*"
```

```bash
pnpm install --lockfile-only
```

- [ ] **Step 2: Write stale-plan RED test**

```ts
const result = runtime.commit(planAtRevision100);
expect(result).toEqual({ status: "rejected", reason: "STALE_TERRAIN_REVISION" });
expect(commands.applyEdits).not.toHaveBeenCalled();
```

- [ ] **Step 3: Write changed-commit fan-out test**

After `commands.applyEdits()` returns `{ status: "success", value: receipt }`, assert:

```ts
expect(commands.applyEdits).toHaveBeenCalledTimes(1);
expect(projection.rebuild).toHaveBeenCalledWith(receipt.changeSet);
expect(debugOverlay.rebuild).toHaveBeenCalledWith(receipt.changeSet);
expect(terraformOverlay.rebuild).toHaveBeenCalledWith({
  touchingLogicalChunks: receipt.changeSet.touchingLogicalChunks,
});
expect(undo.depth()).toBe(1);
```

- [ ] **Step 4: Implement synchronous commit**

```ts
const current = terrain.read.revision();
if (current !== plan.expectedTerrainRevision) {
  undo.synchronizeExternalRevision(current);
  return { status: "rejected", reason: "STALE_TERRAIN_REVISION" } as const;
}
if (plan.edits.length === 0) return { status: "noop" } as const;
const commandResult = terrain.commands.applyEdits({
  edits: plan.edits.map((edit) => ({
    vertex: edit.vertex,
    elevation: edit.desiredElevation,
  })),
});
```

Handle `commandResult.status === "rejected"` without modifying Undo/presentation.

For success with `changed=true`, rebuild projection/debug and pass only `touchingLogicalChunks` to Terraform overlay; then record Undo.

- [ ] **Step 5: Implement Undo**

```ts
const current = terrain.read.revision();
const entry = undo.peekUndo(current);
if (entry === undefined) return { status: "unavailable" } as const;
const commandResult = terrain.commands.applyEdits({ edits: entry.inverseEdits });
```

On successful changed receipt, rebuild all presentation consumers, call `undo.recordUndo(receipt.newRevision)`, and return success.

- [ ] **Step 6: Verify sequential Undo and external invalidation**

```bash
pnpm --filter @web-three-city/app-game test -- terraform-runtime.test.ts
pnpm verify
```

- [ ] **Step 7: Commit and merge TF2**

```bash
git add apps/game orchestration/city-session pnpm-lock.yaml
git commit -m "feat(terraform): execute terrain edits with undo"
```

---

# TF3 — Terraform Three.js Presentation

## Task 8: Define Terraform-owned invalidation and exact grid geometry

**Files:**
- Create: `systems/terraform/src/contracts/terraform-three.ts`
- Create: `systems/terraform/src/presentation/three/overlay-config.ts`
- Create: `systems/terraform/src/presentation/three/build-grid-chunk-geometry.ts`
- Create: `systems/terraform/tests/presentation-three.test.ts`
- Modify: `systems/terraform/src/composition.ts`

- [ ] **Step 1: Define local invalidation contract**

```ts
import type { ChunkCoord } from "@web-three-city/world";
import type { Group } from "three";

export interface TerraformTerrainInvalidation {
  readonly touchingLogicalChunks: readonly ChunkCoord[];
}

export interface TerraformThreeOverlay {
  readonly root: Group;
  setActive(active: boolean): void;
  setPreview(preview: TerraformPreview | undefined): void;
  rebuild(invalidation: TerraformTerrainInvalidation): void;
  dispose(): void;
}
```

Do not import any type from `@web-three-city/terrain/commands`.

- [ ] **Step 2: Write one-cell geometry RED test**

Given one unlocked cell with known four canonical elevations, assert emitted Y coordinates equal `logicalElevationToMeters()` plus configured surface offset.

- [ ] **Step 3: Write filtering test**

Given cells from unlocked and locked regions in one logical chunk, assert gameplay grid geometry is emitted only for editable cells.

- [ ] **Step 4: Implement unique cell-edge line segments**

Build from Terrain root `elevationAt(vertex)` only. De-duplicate identical shared edges inside the chunk. Do not inspect Terrain Three mesh objects.

- [ ] **Step 5: Verify architecture**

```bash
pnpm --filter @web-three-city/terraform test -- presentation-three.test.ts
pnpm --filter @web-three-city/terraform typecheck
pnpm architecture:check
```

- [ ] **Step 6: Commit**

```bash
git add systems/terraform
git commit -m "feat(terraform): build terrain-conforming grid geometry"
```

## Task 9: Implement overlay state/highlights and localized rebuild

**Files:**
- Create: `systems/terraform/src/presentation/three/terraform-three-overlay.ts`
- Modify: `systems/terraform/src/composition.ts`
- Modify: `systems/terraform/tests/presentation-three.test.ts`

- [ ] **Step 1: Write state tests**

Assert:

```text
inactive hides root
active shows root
valid preview renders primary + influence states
invalid preview renders active invalid state
flatten target renders reference marker
clearing preview disposes/reuses transient geometry without leaking objects
```

- [ ] **Step 2: Write localized rebuild test**

Call:

```ts
overlay.rebuild({ touchingLogicalChunks: [{ x: 1, z: 1 }, { x: 2, z: 1 }] });
```

Assert only those currently materialized chunk geometries are rebuilt.

- [ ] **Step 3: Implement bounded shared materials**

Use one shared material per semantic layer, not per cell.

- [ ] **Step 4: Implement idempotent `dispose()`**

Dispose owned geometries/materials exactly once, detach roots, clear maps; second call does not throw.

- [ ] **Step 5: Verify TF3**

```bash
pnpm --filter @web-three-city/terraform test
pnpm --filter @web-three-city/terraform typecheck
pnpm architecture:check
pnpm verify
```

- [ ] **Step 6: Commit and merge**

```bash
git add systems/terraform
git commit -m "feat(terraform): add gameplay grid overlay"
```

---

# TF4 — Mouse + Touch Interaction

## Task 10: Forward normalized pointer lifecycle from the existing City Input owner

**Files:**
- Modify: `apps/game/src/presentation/input/create-city-input-controller.ts`
- Modify: `apps/game/tests/gesture-recognizer.test.ts`
- Modify: `apps/game/tests/camera-input-motion.test.ts`

- [ ] **Step 1: Add forwarding RED test**

Attach a fake `CityToolPointerSink` and assert each DOM `down/move/up/cancel` produces exactly one normalized event with id/type/button/x/y preserved.

- [ ] **Step 2: Add camera-precedence regression**

For primary movement >9 px then release:

```ts
expect(onTap).not.toHaveBeenCalled();
expect(camera.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "pan" }));
```

- [ ] **Step 3: Extend controller input**

```ts
export interface CityToolPointerSink {
  onPointerEvent(event: NormalizedPointerEvent): void;
}
```

Add optional `toolPointerSink`. Each DOM handler creates one normalized event, forwards it, then passes the same object into the existing gesture reducer.

Do not add a second viewport listener stack.

- [ ] **Step 4: Verify**

```bash
pnpm --filter @web-three-city/app-game test -- gesture-recognizer.test.ts camera-input-motion.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/game/src/presentation/input apps/game/tests
git commit -m "feat(input): expose normalized tool pointer stream"
```

## Task 11: Implement Terraform pointer preview/cancel state

**Files:**
- Create: `apps/game/src/composition/terraform/terraform-pointer-session.ts`
- Create: `apps/game/tests/terraform-pointer-session.test.ts`

- [ ] **Step 1: Write mouse RED tests**

Cover:

```text
mouse move with no active pointer -> hover preview callback
left down -> transient preview callback
movement <=9px -> candidate remains
movement >9px -> clear preview/cancel candidate
right button -> never starts Terraform candidate
```

- [ ] **Step 2: Write touch takeover RED tests**

Cover:

```text
first touch -> candidate preview
second touch down -> candidate cleared immediately
pointer session itself never commits Terrain
```

- [ ] **Step 3: Implement pure pointer session**

The session owns no DOM listeners and no Terrain commands. It only calls:

```ts
onPreviewClientPoint(x, y)
onClearPreview()
```

Use the same 9 px threshold value supplied from City Input config.

- [ ] **Step 4: Verify TF4**

```bash
pnpm --filter @web-three-city/app-game test -- terraform-pointer-session.test.ts
pnpm verify
```

- [ ] **Step 5: Commit and merge**

```bash
git add apps/game/src/composition/terraform apps/game/tests/terraform-pointer-session.test.ts
git commit -m "feat(terraform): add pointer preview lifecycle"
```

---

# TF5 — Production UI + Live Composition

## Task 12: Build explicit Terraform entry and mobile-first toolbar

**Files:**
- Create: `apps/game/src/ui/create-terraform-toolbar.ts`
- Create: `apps/game/tests/terraform-toolbar.test.ts`
- Modify: `apps/game/src/ui/screens/create-game-screen.ts`
- Modify: `apps/game/src/style.css`

- [ ] **Step 1: Write defaults RED test**

Assert on open:

```text
Raise selected
1×1 selected
Normal 1m selected
Flatten target empty
Undo disabled
```

- [ ] **Step 2: Add explicit `Terraform` entry control**

Add a native button to the game tool/HUD area. Clicking opens the tray. `Close` returns to camera-only mode.

- [ ] **Step 3: Implement required controls**

```text
Raise / Lower / Flatten
1×1 / 3×3 / 5×5
Fine 0.25m / Normal 1m / Strong 4m
Flatten target readout
Repick Level
Undo
Close
```

Disable strength controls while Flatten is active.

- [ ] **Step 4: Add accessibility/mobile constraints**

Use native buttons, `aria-pressed`, `aria-live`, minimum 44 CSS px touch height, safe-area-aware bottom spacing, and wrapping on narrow widths.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @web-three-city/app-game test -- terraform-toolbar.test.ts
pnpm --filter @web-three-city/app-game typecheck
```

```bash
git add apps/game/src/ui apps/game/src/style.css apps/game/tests/terraform-toolbar.test.ts
git commit -m "feat(terraform): add production tool controls"
```

## Task 13: Wire complete Terraform gameplay into `createLiveCityExperience`

**Files:**
- Modify: `apps/game/src/composition/create-live-city-experience.ts`
- Modify: `apps/game/src/composition/terraform/create-terraform-runtime.ts`
- Modify: `apps/game/src/ui/screens/create-game-screen.ts`
- Modify: `apps/game/tests/live-city-harness.ts`
- Modify: `apps/game/tests/terraform-runtime.test.ts`

- [ ] **Step 1: Construct Terraform overlay after Terrain projection/debug**

```ts
const terraformOverlay = createTerraformThreeOverlay({
  mapDefinition: map,
  world: input.session.world.spatial,
  mapState: input.session.world.mapState,
  terrain: input.session.terrain.read,
});
scene.scene.add(projection.root, overlay.root, terraformOverlay.root);
terraformOverlay.setActive(false);
```

- [ ] **Step 2: Preview from existing semantic picker only**

```text
picker.pickClientPoint(x,y)
-> semantic CellCoord/uQ16/vQ16
-> plan/reference logic
-> terraformOverlay.setPreview(...)
-> toolbar status
-> render
```

No second raycast authority is introduced.

- [ ] **Step 3: Implement first Flatten reference tap**

When operation is Flatten and target undefined:

```text
semantic pick
-> resolveFlattenReference
-> set canonical target
-> no Terrain command
-> refresh preview/UI
```

- [ ] **Step 4: Recompute on commit tap**

For Raise/Lower or Flatten with target, recompute a fresh plan from the tap semantic pick; never execute an old hover plan object blindly.

- [ ] **Step 5: Connect normalized pointer sink**

Use Terraform pointer session for hover/transient preview/cancel. Existing `onTap` remains the sole commit path.

- [ ] **Step 6: Wire Undo/Close**

Undo calls runtime `undo()`, refreshes preview/status, then render. Close clears preview and Flatten target, hides overlay, but retains same-live-session Undo history.

- [ ] **Step 7: Add stable diagnostics for E2E**

Maintain:

```text
data-terraform-active
 data-terraform-operation
 data-terraform-brush
 data-terraform-strength
 data-terraform-preview
 data-terraform-undo-depth
 data-terrain-revision
```

Do not expose mutation functions on `window`.

- [ ] **Step 8: Dispose all Terraform resources**

Dispose pointer session/runtime/overlay and clear transient UI state before Terrain presentation disposal. Repeated dispose remains safe.

- [ ] **Step 9: Verify TF5**

```bash
pnpm --filter @web-three-city/app-game test
pnpm verify
```

- [ ] **Step 10: Commit and merge**

```bash
git add apps/game
git commit -m "feat(terraform): integrate live gameplay loop"
```

---

# TF6 — Persistence + Browser E2E

## Task 14: Browser E2E for mouse/touch semantics

**Files:**
- Create: `tests/browser/terraform.spec.ts`
- Modify if required: `apps/game/tests/live-city-harness.ts`

- [ ] **Step 1: Bootstrap deterministic live city**

Use the established fixed-seed browser flow and wait for `data-live-runtime="ready"`.

- [ ] **Step 2: Test mouse commit**

```text
open Terraform
Raise / 1×1 / Normal
hover known Terrain hit
record Terrain revision
click
expect revision +1
expect undo depth 1
```

- [ ] **Step 3: Test mouse navigation never commits**

Primary drag >9 px changes camera target but not Terrain revision. Right drag changes azimuth but not revision. Wheel changes distance but not revision.

- [ ] **Step 4: Test touch semantics**

Single touch tap commits exactly once. A second touch appearing before release cancels Terraform candidate; multi-touch movement changes camera state and does not increment Terrain revision.

- [ ] **Step 5: Run focused E2E**

```bash
pnpm exec playwright test tests/browser/terraform.spec.ts --workers=1
```

- [ ] **Step 6: Commit**

```bash
git add tests/browser/terraform.spec.ts apps/game/tests/live-city-harness.ts
git commit -m "test(terraform): cover browser interaction semantics"
```

## Task 15: Prove save/exit/load persistence with unchanged CitySaveV1

**Files:**
- Create: `tests/browser/terraform-persistence.spec.ts`
- Modify if required: `apps/game/tests/city-persistence-harness.ts`

- [ ] **Step 1: Capture canonical target elevations before edit**

Use existing test harness access to live/persisted Terrain state; do not add a Terraform snapshot.

- [ ] **Step 2: Edit and Save**

Perform a deterministic Terraform edit, record post-edit canonical elevations/revision, and require Save success.

- [ ] **Step 3: Exit and Load same city**

Assert loaded canonical elevations equal post-edit values and differ from pre-edit values.

- [ ] **Step 4: Assert Undo reset**

```ts
await expect(gameScreen).toHaveAttribute("data-terraform-undo-depth", "0");
```

- [ ] **Step 5: Assert persistence schema remains Terrain-owned**

Inspect saved object:

```ts
expect(saved.terrainSnapshot).toBeDefined();
expect(saved.terraformSnapshot).toBeUndefined();
```

- [ ] **Step 6: Verify TF6**

```bash
pnpm exec playwright test tests/browser/terraform-persistence.spec.ts --workers=1
pnpm verify
```

- [ ] **Step 7: Commit and merge**

```bash
git add tests/browser apps/game/tests
git commit -m "test(terraform): verify save load persistence"
```

---

# TF7 — Hardening + Production Closure

## Task 16: Add measurement-first performance baselines

**Files:**
- Create: `apps/game/tests/terraform-performance-baseline.test.ts`
- Create: `tests/browser/terraform-performance.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Add opt-in Node benchmark**

Guard:

```ts
const enabled = process.env.TERRAFORM_PERFORMANCE_BASELINE === "1";
(enabled ? describe : describe.skip)("Terraform performance baseline", () => {
  // individual measured cases below
});
```

Measure and emit JSON schema `terraform-performance-baseline-v1` for:

```text
1×1 Raise planning
3×3 Raise planning
5×5 Raise planning
Flatten planning
commit + Terrain localized projection rebuild
Undo
initial unlocked-land Terraform overlay construction
1/2/4 logical-chunk Terraform overlay rebuild
geometry bytes/object/material counts
```

- [ ] **Step 2: Add browser baseline**

Measure pointer/tap-to-visible-update latency and browser heap/resource data where available. Do not reinterpret headless frame intervals as player FPS targets.

- [ ] **Step 3: Add scripts**

```json
"terraform:performance:node": "TERRAFORM_PERFORMANCE_BASELINE=1 pnpm --filter @web-three-city/app-game exec vitest run tests/terraform-performance-baseline.test.ts --reporter=verbose",
"terraform:performance:browser": "TERRAFORM_PERFORMANCE_BASELINE=1 playwright test tests/browser/terraform-performance.spec.ts --workers=1",
"terraform:performance:baseline": "pnpm terraform:performance:node && pnpm terraform:performance:browser"
```

- [ ] **Step 4: Run baseline and commit**

```bash
pnpm terraform:performance:baseline
```

```bash
git add apps/game/tests/terraform-performance-baseline.test.ts tests/browser/terraform-performance.spec.ts package.json
git commit -m "test(terraform): add performance baseline"
```

## Task 17: Add lifecycle soak and Terraform hardening workflow

**Files:**
- Create: `tests/browser/terraform-lifecycle-soak.spec.ts`
- Create: `.github/workflows/terraform-hardening.yml`
- Modify: `package.json`

- [ ] **Step 1: Write 20-cycle soak**

Each cycle exercises:

```text
enter live city
activate Terraform
preview targets
deactivate/reactivate Terraform
perform one edit periodically
exit city
load/resume city
```

Assert:

```text
one live canvas
stable Terraform overlay-root count
stable input listener ownership
no pending Terraform RAF work after exit
no page/runtime errors
Undo history never crosses LiveCitySession boundary
IndexedDB closes cleanly at teardown
```

- [ ] **Step 2: Add script**

```json
"terraform:lifecycle:soak": "TERRAFORM_LIFECYCLE_SOAK=1 playwright test tests/browser/terraform-lifecycle-soak.spec.ts --workers=1"
```

- [ ] **Step 3: Create workflow with non-maskable failures**

Every piped shell command uses:

```bash
set -o pipefail
```

Workflow stages:

```text
verify exact HEAD
pnpm verify
pnpm terraform:performance:baseline
pnpm terraform:lifecycle:soak
upload baseline/soak artifacts
```

- [ ] **Step 4: Verify and commit**

```bash
pnpm terraform:lifecycle:soak
pnpm verify
```

```bash
git add tests/browser/terraform-lifecycle-soak.spec.ts .github/workflows/terraform-hardening.yml package.json
git commit -m "test(terraform): add lifecycle hardening gate"
```

## Owner release-gate override — 2026-08-31

SonarQube Cloud / SonarCloud is deferred and is not part of Terraform v1 production closure until a later explicit owner decision re-enables it. Any external GitHub App check is informational/non-gating while this deferral is active.

## Task 18: Create canonical runtime docs and closure evidence

**Files:**
- Create: `docs/systems/terraform/README.md`
- Create: `docs/systems/terraform/verification/TERRAFORM-V1-PRODUCTION-CLOSURE.md`

- [ ] **Step 1: Write README from shipped contracts only**

State explicitly:

```text
Terraform owns player editing policy/transient tool state.
Terrain owns canonical elevation/atomic mutation.
Terraform v1 has no canonical persistence snapshot.
Terraform Grid Overlay is gameplay presentation, not Terrain Debug.
```

List actual package exports and runtime ownership.

- [ ] **Step 2: Populate closure evidence only from real runs**

Record exact:

```text
implementation commit
PR numbers
CI run IDs
Terraform Hardening run ID
SonarQube Cloud result is not required while the 2026-08-31 owner deferral is active
performance baseline values
lifecycle soak count/results
browser E2E result
architecture result
```

No fabricated or anticipated evidence.

- [ ] **Step 3: Define reopen criteria**

Only:

```text
frozen-semantics correctness regression
save/load data-loss defect
camera gesture committing Terraform
Undo correctness defect corrupting Terrain
Terraform-owned lifecycle/resource leak
reproducible performance regression against a future adopted threshold
```

Smooth/Slope/Redo/economy/Water/Ground integration are future product/system work, not silent v1 changes.

- [ ] **Step 4: Run final local/repository verification**

```bash
pnpm format:check
pnpm verify
pnpm terraform:performance:baseline
pnpm terraform:lifecycle:soak
```

- [ ] **Step 5: Commit**

```bash
git add docs/systems/terraform
git commit -m "docs(terraform): close Terraform v1 production status"
```

## Task 19: Merge with exact-head and post-merge verification

**Files:** none unless verification finds a real defect.

- [ ] **Step 1: Capture exact final head**

```bash
git rev-parse HEAD
```

- [ ] **Step 2: Require pre-merge gates on that exact SHA**

```text
CI SUCCESS
Terraform Hardening SUCCESS
architecture check SUCCESS
SonarQube Cloud is deferred by owner decision dated 2026-08-31 and is not a Terraform v1 release gate until explicitly re-enabled
```

Vercel preview is not a Terraform release gate unless release policy is explicitly changed.

- [ ] **Step 3: Merge using expected head SHA**

Reject merge if head moved after verification.

- [ ] **Step 4: Read back master**

Confirm master contains the merged runtime and canonical Terraform docs.

- [ ] **Step 5: Require fresh post-merge master CI + Terraform Hardening**

Do not reuse pre-merge evidence.

- [ ] **Step 6: Declare Production Closed only after all gates are evidenced**

```text
TF1 Core                         CLOSED
TF2 Mutation + Undo              CLOSED
TF3 Three.js Presentation        CLOSED
TF4 Mouse/Touch                  CLOSED
TF5 Production UI                CLOSED
TF6 Persistence + Browser E2E    CLOSED
TF7 Hardening                    CLOSED
Post-merge Verification          CLOSED
```

---

## Self-Review

Spec coverage:

```text
[x] Raise/Lower/Flatten
[x] 0.25m/1m/4m strengths
[x] 1×1/3×3/5×5 brushes
[x] canonical Flatten reference + locked/readable validation
[x] shared-vertex influence ring
[x] all-or-nothing world/region validation
[x] elevation rejection/no clamp
[x] no-op planning
[x] revision-bound preview and stale rejection
[x] one action/one Terrain command
[x] transient 100-entry sequential Undo
[x] external-revision Undo invalidation
[x] no Redo
[x] no Undo persistence
[x] semantic Terrain picker reuse
[x] camera-over-Terraform gesture precedence
[x] separate Terraform gameplay grid
[x] TerrainChangeSet ownership preserved through app invalidation mapping
[x] localized Terrain/debug/Terraform rebuild
[x] explicit Terraform entry + full toolbar
[x] CitySaveV1 unchanged
[x] Save/Exit/Load acceptance
[x] lifecycle/resource soak
[x] measurement-first performance baseline
[x] architecture policy/read-edge enforcement
[x] exact-head merge + post-merge verification
```

Placeholder scan: no `TBD`, no generic "add error handling", and no unnamed test requirements remain. If implementation discovery contradicts a frozen semantic, stop that milestone and revise the spec explicitly rather than silently changing behavior.
