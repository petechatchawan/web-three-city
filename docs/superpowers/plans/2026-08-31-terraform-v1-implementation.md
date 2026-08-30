# Terraform v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build production Terraform v1 with Raise, Lower, reference-level Flatten, 1×1/3×3/5×5 Gameplay Cell brushes, revision-safe transient Undo, exact Terrain-conforming gameplay overlay, mouse/touch interaction, save/load acceptance, performance baselines, and production closure without reopening Terrain Engine v1.

**Architecture:** `systems/terraform` is a pure/product system that reads only World and Terrain root surfaces and produces immutable Terraform plans; it never imports Terrain commands or composition. `apps/game` owns execution of a validated plan through `TerrainCommands.applyEdits()`, then rebuilds Terrain projection/debug and Terraform overlay from the returned `TerrainChangeSet`. Terraform tool/session state and Undo history are transient and are not added to `CitySaveV1`.

**Tech Stack:** Node 22.18.0, pnpm 10.15.1, TypeScript 5.9.2, Three.js 0.179.1, Vitest 3.2.4, Playwright 1.55.0, Vite 7.1.3.

**Spec:** `docs/systems/terraform/specs/TERRAFORM-V1-PRODUCT-SPEC.md`

## Global Constraints

- Terrain Engine v1 remains Production Closed; do not change Terrain authority, snapshot schema, mutation semantics, triangulation, generation, or public command behavior.
- Gameplay Cell size is exactly 8m × 8m on the production map.
- `LogicalElevation` remains exactly 0.25m per level with Terrain-owned range `-4096..4096`.
- Frozen operations are exactly `raise`, `lower`, `flatten`.
- Frozen brush sizes are exactly `1 | 3 | 5` Gameplay Cells.
- Frozen strengths are Fine = 1 level = 0.25m, Normal = 4 levels = 1m, Strong = 16 levels = 4m; Normal is default.
- Flatten target is always a canonical `LogicalElevation` selected from the nearest semantic-picked cell corner; never persist/interpolate an arbitrary triangle height.
- Footprints are all-or-nothing at world and unlocked-region boundaries; no clipping and no partial mutation.
- `systems/terraform` may import `@web-three-city/world` and `@web-three-city/terrain` root surfaces only; it must not import `@web-three-city/terrain/commands` or `@web-three-city/terrain/composition`.
- `apps/game` may import Terraform composition plus Terrain commands/composition and is the Terraform v1 execution boundary.
- One valid changed player action creates at most one Terrain command, one Terrain revision increment, and one Undo entry.
- Stale Terraform plans never commit. Compare revision and call synchronous Terrain command with no `await` between them.
- Undo history is transient, capped at 100 entries, revision-safe, supports multiple sequential Undo operations, and is not persisted.
- Redo is out of scope.
- Camera gesture recognition always wins over Terraform commit. Terraform does not continuously mutate while dragging.
- Terraform Grid Overlay is gameplay presentation separate from Terrain Debug Grid.
- `CitySaveV1` remains unchanged; persisted Terrain snapshot is sufficient to save Terraform edits.
- Initial performance work records baselines; it does not invent thresholds.
- Every implementation PR must end with `pnpm verify` and the relevant focused tests before merge.

---

## Delivery Sequence

Implement and merge in this order. Each milestone is independently reviewable and testable:

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

Do not keep all TF1-TF7 work on one long-lived feature branch. Create the next milestone branch from verified `master` after the previous milestone merges.

---

## File Structure

### New Terraform system package

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

### City Session / app integration

```text
orchestration/city-session/
├── src/contracts/city-session.ts
├── tests/lifecycle.test.ts
└── tests/public-surface.test.ts

apps/game/
├── package.json
├── src/composition/systems/terrain-lifecycle-adapter.ts
├── src/composition/terraform/create-terraform-runtime.ts
├── src/composition/terraform/terraform-pointer-session.ts
├── src/composition/create-live-city-experience.ts
├── src/presentation/input/create-city-input-controller.ts
├── src/presentation/input/gesture-recognizer.ts
├── src/ui/screens/create-game-screen.ts
├── src/ui/create-terraform-toolbar.ts
├── src/style.css
└── tests/
    ├── lifecycle-adapters.test.ts
    ├── terraform-runtime.test.ts
    ├── terraform-pointer-session.test.ts
    ├── terraform-toolbar.test.ts
    └── terraform-performance-baseline.test.ts
```

### Browser / release verification

```text
tests/browser/
├── terraform.spec.ts
├── terraform-persistence.spec.ts
├── terraform-performance.spec.ts
└── terraform-lifecycle-soak.spec.ts

.github/workflows/terraform-hardening.yml

docs/systems/terraform/
├── README.md
└── verification/TERRAFORM-V1-PRODUCTION-CLOSURE.md
```

---

# TF1 — Pure Terraform Core

## Task 1: Scaffold `@web-three-city/terraform` and lock architecture edges

**Files:**
- Create: `systems/terraform/package.json`
- Create: `systems/terraform/tsconfig.json`
- Create: `systems/terraform/src/index.ts`
- Create: `systems/terraform/src/composition.ts`
- Create: `systems/terraform/tests/public-surface.test.ts`
- Modify: `architecture.policy.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `@web-three-city/world` root surface, `@web-three-city/terrain` root surface.
- Produces: workspace package `@web-three-city/terraform`, root public surface, `./composition` presentation surface.

- [ ] **Step 1: Add architecture policy entries before implementation imports appear**

Add exactly these two entries to `approvedSystemReadEdges`:

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

`systems/terraform/package.json`:

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

`systems/terraform/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["vitest/globals"] },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 3: Write the public-surface test**

```ts
import { describe, expect, it } from "vitest";
import * as terraform from "@web-three-city/terraform";
import * as composition from "@web-three-city/terraform/composition";

describe("terraform public surface", () => {
  it("keeps product/core and Three composition surfaces explicit", () => {
    expect(terraform).toBeDefined();
    expect(composition).toBeDefined();
  });
});
```

- [ ] **Step 4: Create initially empty explicit export files**

```ts
// src/index.ts
export {};
```

```ts
// src/composition.ts
export {};
```

- [ ] **Step 5: Refresh the lockfile**

Run:

```bash
pnpm install --lockfile-only
```

Expected: workspace importer for `systems/terraform` is present in `pnpm-lock.yaml`.

- [ ] **Step 6: Verify package and architecture**

Run:

```bash
pnpm --filter @web-three-city/terraform typecheck
pnpm --filter @web-three-city/terraform test
pnpm architecture:check
```

Expected: all three commands exit 0.

- [ ] **Step 7: Commit**

```bash
git add systems/terraform architecture.policy.json pnpm-lock.yaml
git commit -m "feat(terraform): scaffold system boundary"
```

## Task 2: Implement frozen strength and brush footprint semantics

**Files:**
- Create: `systems/terraform/src/contracts/terraform-types.ts`
- Create: `systems/terraform/src/domain/strength.ts`
- Create: `systems/terraform/src/domain/brush-footprint.ts`
- Create: `systems/terraform/tests/brush-footprint.test.ts`
- Modify: `systems/terraform/src/index.ts`

**Interfaces:**
- Produces: `TerraformOperation`, `TerraformBrushSize`, `TerraformStrength`, `TerraformInvalidReason`, `TerraformVertexMutation`, `TerraformPlan`, `TerraformPreview`, `strengthLevels()`, `buildBrushFootprint()`.

- [ ] **Step 1: Write failing brush tests**

```ts
import { describe, expect, it } from "vitest";
import { buildBrushFootprint, strengthLevels } from "@web-three-city/terraform";

describe("Terraform footprint", () => {
  it.each([
    [1, 1, 4],
    [3, 9, 16],
    [5, 25, 36],
  ] as const)("maps %ix%i cells to the expected unique vertex count", (size, cellCount, vertexCount) => {
    const footprint = buildBrushFootprint({ x: 100, z: 100 }, size);
    expect(footprint.cells).toHaveLength(cellCount);
    expect(footprint.vertices).toHaveLength(vertexCount);
  });

  it("locks strength levels", () => {
    expect(strengthLevels("fine")).toBe(1);
    expect(strengthLevels("normal")).toBe(4);
    expect(strengthLevels("strong")).toBe(16);
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/terraform test -- brush-footprint.test.ts
```

Expected: fail because exports/functions do not exist.

- [ ] **Step 3: Add binding types**

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

export type TerraformPreview =
  | { readonly status: "valid"; readonly plan: TerraformPlan }
  | {
      readonly status: "invalid";
      readonly operation: TerraformOperation;
      readonly targetCell?: CellCoord;
      readonly footprintCells: readonly CellCoord[];
      readonly reason: TerraformInvalidReason;
      readonly expectedTerrainRevision: TerrainRevision;
    };
```

- [ ] **Step 4: Implement strength mapping**

```ts
import type { TerraformStrength } from "../contracts/terraform-types";

export function strengthLevels(strength: TerraformStrength): 1 | 4 | 16 {
  switch (strength) {
    case "fine": return 1;
    case "normal": return 4;
    case "strong": return 16;
  }
}
```

- [ ] **Step 5: Implement deterministic footprint mapping**

```ts
export function buildBrushFootprint(target: CellCoord, size: TerraformBrushSize) {
  const half = (size - 1) / 2;
  const xStart = target.x - half;
  const xEnd = target.x + half;
  const zStart = target.z - half;
  const zEnd = target.z + half;
  const cells: CellCoord[] = [];
  const vertices: VertexCoord[] = [];
  for (let z = zStart; z <= zEnd; z += 1)
    for (let x = xStart; x <= xEnd; x += 1) cells.push(Object.freeze({ x, z }));
  for (let z = zStart; z <= zEnd + 1; z += 1)
    for (let x = xStart; x <= xEnd + 1; x += 1) vertices.push(Object.freeze({ x, z }));
  return Object.freeze({ cells: Object.freeze(cells), vertices: Object.freeze(vertices) });
}
```

- [ ] **Step 6: Export and verify GREEN**

Run:

```bash
pnpm --filter @web-three-city/terraform test -- brush-footprint.test.ts
pnpm --filter @web-three-city/terraform typecheck
```

Expected: tests pass and typecheck exits 0.

- [ ] **Step 7: Commit**

```bash
git add systems/terraform
git commit -m "feat(terraform): define brush and strength semantics"
```

## Task 3: Implement Raise/Lower planning, world/region validation, influence cells, and no-op plans

**Files:**
- Create: `systems/terraform/src/application/plan-terraform.ts`
- Create: `systems/terraform/tests/plan-terraform.test.ts`
- Modify: `systems/terraform/src/index.ts`

**Interfaces:**
- Consumes: `MapDefinitionRead`, `WorldSpatialRead`, `MapStateRead`, `TerrainAuthorityRead`.
- Produces: `planTerraform(input): TerraformPreview`.

- [ ] **Step 1: Write failing planner tests for valid Raise and influence ring**

Use a small fake World/Terrain fixture with target `(10,10)` and all required elevations at `20`.

```ts
const preview = planTerraform({
  operation: "raise",
  brushSize: 1,
  strength: "normal",
  targetCell: { x: 10, z: 10 },
  flattenTarget: undefined,
  mapDefinition,
  world,
  mapState,
  terrain,
});
expect(preview.status).toBe("valid");
if (preview.status === "valid") {
  expect(preview.plan.edits).toHaveLength(4);
  expect(preview.plan.edits.every((edit) => edit.desiredElevation === 24)).toBe(true);
  expect(preview.plan.footprintCells).toEqual([{ x: 10, z: 10 }]);
  expect(preview.plan.influenceCells).not.toContainEqual({ x: 10, z: 10 });
  expect(preview.plan.expectedTerrainRevision).toBe(7);
}
```

- [ ] **Step 2: Add failing rejection tests**

Test exactly:

```text
5×5 at cell (0,0) -> OUT_OF_WORLD
footprint crossing a locked region -> LOCKED_REGION
one required elevation unavailable -> TERRAIN_UNAVAILABLE
raise from 4090 with Strong -> ELEVATION_LIMIT
lower from -4090 with Strong -> ELEVATION_LIMIT
```

- [ ] **Step 3: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/terraform test -- plan-terraform.test.ts
```

Expected: fail because planner is missing.

- [ ] **Step 4: Implement validation in strict order**

`planTerraform()` must evaluate in this order:

```text
1. capture Terrain revision
2. build footprint
3. reject world bounds
4. reject locked region
5. read all required vertices
6. resolve desired elevations
7. reject elevation range
8. remove unchanged edits
9. derive influence cells from incidentCells(edit.vertex)
10. return immutable preview
```

World bounds are checked directly from `mapDefinition.widthCells` and `heightCells`; do not infer bounds from failed Terrain reads.

- [ ] **Step 5: Implement Raise/Lower desired elevations with Terrain parser**

```ts
const delta = strengthLevels(input.strength) * (input.operation === "lower" ? -1 : 1);
const parsed = parseLogicalElevation(current + delta);
if (parsed.status !== "success") return invalid("ELEVATION_LIMIT");
```

Do not clamp.

- [ ] **Step 6: Implement influence set deterministically**

Use key `${x}:${z}` to de-duplicate and sort output by `z`, then `x`. Remove every cell already present in `footprintCells`.

- [ ] **Step 7: Add no-op test**

Create a later Flatten-style mutation fixture where desired values equal current values; the plan must have `edits.length === 0` rather than emitting redundant mutations.

- [ ] **Step 8: Verify GREEN and architecture**

```bash
pnpm --filter @web-three-city/terraform test -- plan-terraform.test.ts
pnpm --filter @web-three-city/terraform typecheck
pnpm architecture:check
```

Expected: all exit 0.

- [ ] **Step 9: Commit**

```bash
git add systems/terraform
git commit -m "feat(terraform): plan raise and lower edits"
```

## Task 4: Implement canonical Flatten reference selection and Flatten plans

**Files:**
- Create: `systems/terraform/src/domain/flatten-reference.ts`
- Create: `systems/terraform/tests/flatten-reference.test.ts`
- Modify: `systems/terraform/src/application/plan-terraform.ts`
- Modify: `systems/terraform/tests/plan-terraform.test.ts`
- Modify: `systems/terraform/src/index.ts`

**Interfaces:**
- Produces: `resolveFlattenReference(pick, terrain)` and Flatten branch in `planTerraform()`.

- [ ] **Step 1: Write nearest-corner tests**

Test all four quadrants and exact midpoint tie behavior:

```ts
expect(resolveCorner({ cell: { x: 5, z: 7 }, uQ16: 0, vQ16: 0 })).toEqual({ x: 5, z: 7 });
expect(resolveCorner({ cell: { x: 5, z: 7 }, uQ16: 65535, vQ16: 0 })).toEqual({ x: 6, z: 7 });
expect(resolveCorner({ cell: { x: 5, z: 7 }, uQ16: 0, vQ16: 65535 })).toEqual({ x: 5, z: 8 });
expect(resolveCorner({ cell: { x: 5, z: 7 }, uQ16: 32768, vQ16: 32768 })).toEqual({ x: 6, z: 8 });
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/terraform test -- flatten-reference.test.ts
```

- [ ] **Step 3: Implement corner resolution and Terrain read**

`resolveFlattenReference()` must return `TERRAIN_UNAVAILABLE` when the selected canonical corner elevation cannot be read. It must return the exact `LogicalElevation` from `terrain.elevationAt()`.

- [ ] **Step 4: Add Flatten planner tests**

Verify:

```text
flatten without target -> FLATTEN_TARGET_NOT_SELECTED
flatten target 31 -> every changed vertex desiredElevation 31
already-flat footprint -> valid plan with zero edits
strength choice does not affect Flatten desired elevation
```

- [ ] **Step 5: Implement Flatten branch**

```ts
if (input.operation === "flatten") {
  if (input.flattenTarget === undefined) return invalid("FLATTEN_TARGET_NOT_SELECTED");
  desired = input.flattenTarget;
}
```

- [ ] **Step 6: Verify**

```bash
pnpm --filter @web-three-city/terraform test
pnpm --filter @web-three-city/terraform typecheck
```

- [ ] **Step 7: Commit**

```bash
git add systems/terraform
git commit -m "feat(terraform): add reference-level flatten"
```

## Task 5: Implement revision-safe transient Undo history

**Files:**
- Create: `systems/terraform/src/application/undo-history.ts`
- Create: `systems/terraform/tests/undo-history.test.ts`
- Modify: `systems/terraform/src/index.ts`

**Interfaces:**
- Produces: `TerraformUndoHistory`, `createTerraformUndoHistory(initialRevision)`, `recordCommit(plan, receiptRevision)`, `peekUndo(currentRevision)`, `recordUndo(newRevision)`, `synchronizeExternalRevision(currentRevision)`.

- [ ] **Step 1: Write failing tests for stack semantics**

Cover:

```text
changed action pushes one entry
zero-edit/no-change action pushes none
101 actions retain newest 100
external revision mismatch clears history
multiple sequential Undo remains possible after revisions advance
```

The multi-Undo test must model:

```text
A: 100 -> 101
B: 101 -> 102
Undo B: 102 -> 103
Undo A is still permitted at 103
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/terraform test -- undo-history.test.ts
```

- [ ] **Step 3: Implement history with session-level expected revision**

Use this shape:

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

- [ ] **Step 4: Make invalidation explicit**

`peekUndo(currentRevision)` behavior:

```text
current == expected -> return newest entry
current != expected -> clear entries, set expected=current, return undefined
```

`recordUndo(newRevision)` pops exactly one entry and sets expected to the new revision.

- [ ] **Step 5: Verify**

```bash
pnpm --filter @web-three-city/terraform test
pnpm --filter @web-three-city/terraform typecheck
pnpm architecture:check
```

- [ ] **Step 6: Commit and close TF1**

```bash
git add systems/terraform
git commit -m "feat(terraform): add revision-safe undo history"
```

Then run:

```bash
pnpm verify
```

Open TF1 PR only after `pnpm verify` exits 0. Merge TF1 before starting TF2.

---

# TF2 — Live Terrain Mutation + Undo Integration

## Task 6: Expose typed Terrain commands through Live City session

**Files:**
- Modify: `orchestration/city-session/src/contracts/city-session.ts`
- Modify: `orchestration/city-session/package.json`
- Modify: `apps/game/src/composition/systems/terrain-lifecycle-adapter.ts`
- Modify: `orchestration/city-session/tests/lifecycle.test.ts`
- Modify: `apps/game/tests/lifecycle-adapters.test.ts`

**Interfaces:**
- Consumes: `TerrainCommands` from `@web-three-city/terrain/commands`.
- Produces: `LiveCitySession.terrain.commands` typed mutation surface.

- [ ] **Step 1: Write failing adapter test**

```ts
expect(result.status).toBe("success");
if (result.status === "success") {
  expect(typeof result.value.commands.applyEdits).toBe("function");
}
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/app-game test -- lifecycle-adapters.test.ts
```

- [ ] **Step 3: Extend the session contract**

```ts
import type { TerrainCommands } from "@web-three-city/terrain/commands";

export interface TerrainSessionHandle {
  readonly read: TerrainAuthorityRead;
  readonly commands: TerrainCommands;
  readonly opaque: unknown;
  captureSnapshot(): TerrainStateSnapshotV1;
}
```

Do not modify `CitySaveV1`.

- [ ] **Step 4: Adapt TerrainSystem commands**

```ts
value: Object.freeze({
  read: system.read,
  commands: system.commands,
  opaque: system,
  captureSnapshot: () => system.captureSnapshot(),
})
```

- [ ] **Step 5: Verify no persistence schema change**

Run:

```bash
pnpm --filter @web-three-city/orchestration-city-session test
pnpm --filter @web-three-city/app-game test -- lifecycle-adapters.test.ts
pnpm architecture:check
```

Expected: all pass; `CitySaveV1` still contains only metadata, world snapshot, Terrain snapshot.

- [ ] **Step 6: Commit**

```bash
git add orchestration/city-session apps/game/src/composition/systems/terrain-lifecycle-adapter.ts apps/game/tests/lifecycle-adapters.test.ts
git commit -m "feat(city-session): expose live terrain commands"
```

## Task 7: Add the Terraform execution runtime with stale-plan and Undo semantics

**Files:**
- Modify: `apps/game/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/game/src/composition/terraform/create-terraform-runtime.ts`
- Create: `apps/game/tests/terraform-runtime.test.ts`

**Interfaces:**
- Consumes: `TerraformPlan`, `TerraformUndoHistory`, `TerrainSessionHandle`, `TerrainThreeProjection`, `TerrainThreeDebugOverlay`, later `TerraformThreeOverlay`.
- Produces: `TerraformRuntime.commit(plan)`, `TerraformRuntime.undo()`, `TerraformRuntime.dispose()`.

- [ ] **Step 1: Add `@web-three-city/terraform` to app dependencies**

```json
"@web-three-city/terraform": "workspace:*"
```

Run:

```bash
pnpm install --lockfile-only
```

- [ ] **Step 2: Write stale-plan test before runtime**

```ts
const result = runtime.commit(planAtRevision100);
expect(result).toEqual({ status: "rejected", reason: "STALE_TERRAIN_REVISION" });
expect(commands.applyEdits).not.toHaveBeenCalled();
```

- [ ] **Step 3: Write one-command/one-rebuild test**

For a changed receipt, assert exactly once:

```ts
expect(commands.applyEdits).toHaveBeenCalledTimes(1);
expect(projection.rebuild).toHaveBeenCalledWith(receipt.changeSet);
expect(debugOverlay.rebuild).toHaveBeenCalledWith(receipt.changeSet);
expect(terraformOverlay.rebuild).toHaveBeenCalledWith(receipt.changeSet);
expect(undo.depth()).toBe(1);
```

- [ ] **Step 4: Implement synchronous commit path**

Core sequence must be literally synchronous:

```ts
const current = terrain.read.revision();
if (current !== plan.expectedTerrainRevision) {
  undo.synchronizeExternalRevision(current);
  return { status: "rejected", reason: "STALE_TERRAIN_REVISION" } as const;
}
if (plan.edits.length === 0) return { status: "noop" } as const;
const result = terrain.commands.applyEdits({
  edits: plan.edits.map((edit) => ({ vertex: edit.vertex, elevation: edit.desiredElevation })),
});
```

There must be no `await` between revision read and `applyEdits()`.

- [ ] **Step 5: Implement successful receipt fan-out**

For `changed=true`:

```ts
projection.rebuild(receipt.changeSet);
debugOverlay.rebuild(receipt.changeSet);
terraformOverlay.rebuild(receipt.changeSet);
undo.recordCommit(plan, receipt.newRevision);
```

For `changed=false`, do not push Undo.

- [ ] **Step 6: Implement Undo execution**

```ts
const current = terrain.read.revision();
const entry = undo.peekUndo(current);
if (entry === undefined) return { status: "unavailable" } as const;
const result = terrain.commands.applyEdits({ edits: entry.inverseEdits });
```

On changed success, rebuild all three presentation consumers and call `undo.recordUndo(receipt.newRevision)`.

- [ ] **Step 7: Verify sequential Undo test**

Run:

```bash
pnpm --filter @web-three-city/app-game test -- terraform-runtime.test.ts
```

Expected: A/B/two-Undo sequence passes and external revision invalidation disables Undo.

- [ ] **Step 8: Close TF2**

```bash
pnpm verify
```

Commit:

```bash
git add apps/game orchestration/city-session pnpm-lock.yaml
git commit -m "feat(terraform): execute terrain edits with undo"
```

Merge TF2 before TF3.

---

# TF3 — Terraform Three.js Presentation

## Task 8: Build exact Terrain-conforming logical-chunk grid geometry

**Files:**
- Create: `systems/terraform/src/contracts/terraform-three.ts`
- Create: `systems/terraform/src/presentation/three/overlay-config.ts`
- Create: `systems/terraform/src/presentation/three/build-grid-chunk-geometry.ts`
- Create: `systems/terraform/tests/presentation-three.test.ts`
- Modify: `systems/terraform/src/composition.ts`

**Interfaces:**
- Produces: `TerraformThreeOverlay` contract and exact cell-edge geometry builder.

- [ ] **Step 1: Write geometry test for one cell**

Given cell `(2,3)` with four canonical corner elevations, assert line position Y values equal `logicalElevationToMeters()` plus configured surface offset. Do not read any Terrain Three mesh.

- [ ] **Step 2: Write editable-region filtering test**

Given a logical chunk containing cells from locked/unlocked regions, assert only edges incident to unlocked cells are emitted.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/terraform test -- presentation-three.test.ts
```

- [ ] **Step 4: Define overlay contract**

```ts
export interface TerraformThreeOverlay {
  readonly root: Group;
  setActive(active: boolean): void;
  setPreview(preview: TerraformPreview | undefined): void;
  rebuild(changeSet: TerrainChangeSet): void;
  dispose(): void;
}
```

`TerraformChangeSet` is not introduced; Terrain's existing `TerrainChangeSet` remains the invalidation seed at the app/presentation boundary.

- [ ] **Step 5: Implement chunk geometry**

Generate line segments from canonical vertex elevations for cell boundaries. Use logical chunk size 32 from map definition. De-duplicate identical edge segments within a chunk so shared cell edges are not emitted twice.

- [ ] **Step 6: Verify**

```bash
pnpm --filter @web-three-city/terraform test -- presentation-three.test.ts
pnpm --filter @web-three-city/terraform typecheck
```

- [ ] **Step 7: Commit**

```bash
git add systems/terraform
git commit -m "feat(terraform): build terrain-conforming grid geometry"
```

## Task 9: Implement overlay states and localized rebuild

**Files:**
- Create: `systems/terraform/src/presentation/three/terraform-three-overlay.ts`
- Modify: `systems/terraform/src/composition.ts`
- Modify: `systems/terraform/tests/presentation-three.test.ts`

**Interfaces:**
- Produces: `createTerraformThreeOverlay()`.

- [ ] **Step 1: Write tests for overlay ownership/resources**

Assert:

```text
root is a distinct Group
setActive(false) hides root
setActive(true) shows root
setPreview(valid) creates primary + influence presentation
setPreview(invalid) creates active invalid presentation
setPreview(undefined) clears transient highlight resources
```

- [ ] **Step 2: Write localized rebuild test**

Create a `TerrainChangeSet` touching logical chunks `(1,1)` and `(2,1)`. Spy on chunk geometry rebuild and assert only those existing overlay chunks are rebuilt.

- [ ] **Step 3: Implement separate material/resource ownership**

Use a bounded shared material set for:

```text
editable grid
valid primary
influence
invalid
flatten reference
```

Do not allocate a material per cell.

- [ ] **Step 4: Implement idempotent `dispose()`**

Dispose every owned geometry/material exactly once, detach children, clear internal maps, and allow a second `dispose()` call without throwing.

- [ ] **Step 5: Verify TF3**

```bash
pnpm --filter @web-three-city/terraform test
pnpm --filter @web-three-city/terraform typecheck
pnpm architecture:check
pnpm verify
```

- [ ] **Step 6: Commit and merge TF3**

```bash
git add systems/terraform
git commit -m "feat(terraform): add gameplay grid overlay"
```

---

# TF4 — Mouse + Touch Interaction

## Task 10: Forward normalized pointer lifecycle to active tool runtime without duplicating DOM listeners

**Files:**
- Modify: `apps/game/src/presentation/input/create-city-input-controller.ts`
- Modify: `apps/game/tests/gesture-recognizer.test.ts`
- Modify: `apps/game/tests/camera-input-motion.test.ts`

**Interfaces:**
- Produces: optional `CityToolPointerSink` callback receiving the exact normalized pointer stream already used by camera gesture recognition.

- [ ] **Step 1: Add test sink and assert normalized forwarding**

Assert `down`, `move`, `up`, `cancel` events are forwarded once with `pointerType`, `id`, `button`, `x`, `y` preserved.

- [ ] **Step 2: Add regression test proving `onTap` remains camera recognizer authority**

For a left pointer move greater than 9 px followed by up:

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

Add optional:

```ts
readonly toolPointerSink?: CityToolPointerSink;
```

In each DOM handler, create one normalized event, forward it to `toolPointerSink`, then pass the same object to `transition()`.

- [ ] **Step 4: Verify no listener-count regression**

Existing lifecycle tests must still observe the same DOM listener ownership count; no second Terraform DOM pointer listener is introduced.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @web-three-city/app-game test -- gesture-recognizer.test.ts camera-input-motion.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/game/src/presentation/input apps/game/tests
git commit -m "feat(input): expose normalized tool pointer stream"
```

## Task 11: Implement Terraform pointer candidate/hover state

**Files:**
- Create: `apps/game/src/composition/terraform/terraform-pointer-session.ts`
- Create: `apps/game/tests/terraform-pointer-session.test.ts`

**Interfaces:**
- Consumes: normalized pointer events, shared 9 px threshold, semantic picker callback.
- Produces: preview callbacks only; commit remains `onTap` from City Input.

- [ ] **Step 1: Write mouse tests**

Cover:

```text
mouse move with no active pointer -> hover preview
left down -> transient preview
movement <=9px -> candidate remains
movement >9px -> preview cleared/candidate cancelled
right down -> never starts Terraform candidate
```

- [ ] **Step 2: Write touch takeover tests**

Cover:

```text
first touch -> candidate preview
second touch down -> candidate cleared immediately
later up events -> no Terraform commit signal from pointer session
```

- [ ] **Step 3: Implement pure candidate state**

The pointer session must not mutate Terrain and must not own DOM listeners. It only calls:

```ts
onPreviewClientPoint(x, y)
onClearPreview()
```

- [ ] **Step 4: Verify**

```bash
pnpm --filter @web-three-city/app-game test -- terraform-pointer-session.test.ts
```

- [ ] **Step 5: Close TF4 with full verification**

```bash
pnpm verify
```

Commit:

```bash
git add apps/game/src/composition/terraform apps/game/tests/terraform-pointer-session.test.ts
git commit -m "feat(terraform): add pointer preview lifecycle"
```

Merge TF4 before UI/live wiring.

---

# TF5 — Production UI + Live Composition

## Task 12: Build mobile-first Terraform toolbar

**Files:**
- Create: `apps/game/src/ui/create-terraform-toolbar.ts`
- Create: `apps/game/tests/terraform-toolbar.test.ts`
- Modify: `apps/game/src/ui/screens/create-game-screen.ts`
- Modify: `apps/game/src/style.css`

**Interfaces:**
- Produces: tool entry button, toolbar handle, callbacks for operation/brush/strength/repick/undo/close, state render methods.

- [ ] **Step 1: Write toolbar test first**

Assert defaults:

```text
Raise selected
1×1 selected
Normal 1m selected
Flatten target hidden/empty
Undo disabled
```

Then click controls and assert callbacks receive exact typed values.

- [ ] **Step 2: Add explicit game-level Terraform entry control**

Add a `Terraform` button to the game HUD/tool launcher. It opens the Terraform tray; `Close` deactivates the tool and returns camera-only interaction.

- [ ] **Step 3: Implement required controls**

Render exactly:

```text
Raise / Lower / Flatten
1×1 / 3×3 / 5×5
Fine 0.25m / Normal 1m / Strong 4m
Flatten target readout
Repick Level
Undo
Close
```

When operation is Flatten, disable the strength group and expose reference-target state.

- [ ] **Step 4: Add accessible state**

Use native buttons, `aria-pressed` for selected segmented controls, meaningful labels, and an `aria-live` region for invalid target/Flatten target/Undo feedback.

- [ ] **Step 5: Add mobile CSS**

The tray must stay within viewport safe areas, use touch targets at least 44 CSS px high, wrap groups on narrow widths, and not cover Save/Exit controls.

- [ ] **Step 6: Verify**

```bash
pnpm --filter @web-three-city/app-game test -- terraform-toolbar.test.ts
pnpm --filter @web-three-city/app-game typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/game/src/ui apps/game/src/style.css apps/game/tests/terraform-toolbar.test.ts
git commit -m "feat(terraform): add production tool controls"
```

## Task 13: Wire Terraform into `createLiveCityExperience`

**Files:**
- Modify: `apps/game/src/composition/create-live-city-experience.ts`
- Modify: `apps/game/src/composition/terraform/create-terraform-runtime.ts`
- Modify: `apps/game/src/ui/screens/create-game-screen.ts`
- Modify: `apps/game/tests/live-city-harness.ts`
- Create/Modify: `apps/game/tests/terraform-runtime.test.ts`

**Interfaces:**
- Consumes: semantic Terrain picker, Terraform planner, Flatten reference resolver, Terraform Three overlay, toolbar, typed Terrain commands.
- Produces: complete live Terraform gameplay loop.

- [ ] **Step 1: Create overlay next to Terrain projection/debug**

After Terrain projection/debug construction succeeds:

```ts
const terraformOverlay = createTerraformThreeOverlay({
  mapDefinition: map,
  world: input.session.world.spatial,
  mapState: input.session.world.mapState,
  terrain: input.session.terrain.read,
});
scene.scene.add(projection.root, overlay.root, terraformOverlay.root);
```

Terraform overlay starts inactive.

- [ ] **Step 2: Build preview from semantic pick only**

`previewClientPoint(x,y)`:

```text
picker.pickClientPoint
-> if hit, use pick.value.cell as target
-> planTerraform using current operation/brush/strength/flattenTarget
-> terraformOverlay.setPreview(preview)
-> update toolbar status
-> render
```

Do not raycast a second custom Terraform surface.

- [ ] **Step 3: Implement Flatten first-tap reference behavior**

When active operation is Flatten and `flattenTarget` is undefined, `onTap` must call `resolveFlattenReference()` from the semantic pick and set the target. It must not call Terrain commands on that tap.

- [ ] **Step 4: Implement normal commit tap**

For Raise/Lower or Flatten with target:

```text
recompute preview from the tap semantic pick
-> runtime.commit(valid plan)
-> refresh current preview from current Terrain revision
-> update Undo enablement
-> render
```

Never execute an old hover preview object blindly.

- [ ] **Step 5: Wire pointer sink and camera precedence**

Pass `terraformPointerSession` into `createCityInputController.toolPointerSink`; leave existing `onTap` as the only commit entry.

- [ ] **Step 6: Wire Undo and Close**

Undo calls runtime `undo()`, refreshes preview/UI, and renders. Close clears preview/flatten target and hides Terraform overlay, but keeps live-session Undo history.

- [ ] **Step 7: Keep diagnostics observable for E2E**

Update stable dataset fields only for test/diagnostic inspection:

```text
data-terraform-active
 data-terraform-operation
 data-terraform-brush
 data-terraform-strength
 data-terraform-preview
 data-terraform-undo-depth
 data-terrain-revision
```

Do not expose canonical mutation APIs on `window`.

- [ ] **Step 8: Dispose all Terraform runtime resources**

`LiveCityExperience.dispose()` must dispose pointer session/runtime/overlay and clear transient UI state before disposing Terrain resources.

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

## Task 14: Add browser interaction E2E for mouse and touch semantics

**Files:**
- Create: `tests/browser/terraform.spec.ts`
- Modify if needed: `apps/game/tests/live-city-harness.ts`

**Interfaces:**
- Tests the production page and real input/picker/runtime path.

- [ ] **Step 1: Add deterministic city bootstrap helper inside the spec**

Use the same fixed seed pattern already used by live-city browser tests. Enter a live city and assert `data-live-runtime="ready"` before Terraform interaction.

- [ ] **Step 2: Test mouse Raise commit**

Flow:

```text
open Terraform
choose Raise / 1×1 / Normal
move pointer to a known terrain hit
record data-terrain-revision
click
expect revision +1
expect undo depth 1
```

- [ ] **Step 3: Test mouse drag does not commit**

Move >9 px while primary button is down. Assert camera target changes while Terrain revision and Undo depth remain unchanged.

- [ ] **Step 4: Test right-drag/wheel navigation does not commit**

Assert camera azimuth/distance changes and Terrain revision stays unchanged.

- [ ] **Step 5: Test touch tap and two-finger takeover**

Use Playwright touchscreen/pointer dispatch supported by the existing browser harness. Single touch tap commits; second touch before release cancels Terraform candidate and does not increment Terrain revision.

- [ ] **Step 6: Run focused browser test**

```bash
pnpm exec playwright test tests/browser/terraform.spec.ts --workers=1
```

Expected: all Terraform interaction cases pass.

- [ ] **Step 7: Commit**

```bash
git add tests/browser/terraform.spec.ts apps/game/tests/live-city-harness.ts
git commit -m "test(terraform): cover browser interaction semantics"
```

## Task 15: Prove Terraform save/exit/load persistence without a Terraform snapshot

**Files:**
- Create: `tests/browser/terraform-persistence.spec.ts`
- Modify if needed: `apps/game/tests/city-persistence-harness.ts`

**Interfaces:**
- Verifies canonical Terrain snapshot persistence through existing City Session service/IndexedDB path.

- [ ] **Step 1: Record a target cell's canonical corner elevations before edit**

Read the persisted/live Terrain diagnostics through the existing harness rather than adding a second Terraform save channel.

- [ ] **Step 2: Perform a Terraform edit and save**

Assert Terrain revision increments and Save reports success.

- [ ] **Step 3: Exit and Load the same city**

After load, assert the same target canonical elevations match the post-edit values, not the pre-edit values.

- [ ] **Step 4: Assert Undo history is empty after Load**

```ts
await expect(gameScreen).toHaveAttribute("data-terraform-undo-depth", "0");
```

- [ ] **Step 5: Assert saved object has no Terraform snapshot field**

Inspect IndexedDB `CitySaveV1` and assert:

```ts
expect(saved.terraformSnapshot).toBeUndefined();
expect(saved.terrainSnapshot).toBeDefined();
```

- [ ] **Step 6: Run focused persistence E2E**

```bash
pnpm exec playwright test tests/browser/terraform-persistence.spec.ts --workers=1
```

- [ ] **Step 7: Close TF6**

```bash
pnpm verify
```

Commit:

```bash
git add tests/browser apps/game/tests
git commit -m "test(terraform): verify save load persistence"
```

Merge TF6 before hardening.

---

# TF7 — Hardening + Production Closure

## Task 16: Add Terraform performance baseline instrumentation

**Files:**
- Create: `apps/game/tests/terraform-performance-baseline.test.ts`
- Create: `tests/browser/terraform-performance.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Produces measurement-only JSON baselines for pure planning, execution/rebuild, initial overlay, localized overlay rebuild, Undo, browser visible latency, and resource counts.

- [ ] **Step 1: Add opt-in Node baseline test**

Guard with:

```ts
const enabled = process.env.TERRAFORM_PERFORMANCE_BASELINE === "1";
(enabled ? describe : describe.skip)("Terraform performance baseline", () => { /* measurements */ });
```

Measure at least:

```text
1×1 Raise plan
3×3 Raise plan
5×5 Raise plan
Flatten plan
changed commit + projection rebuild
Undo
initial unlocked-land Terraform overlay creation
1/2/4 logical-chunk overlay rebuild
geometry bytes/object/material counts
```

Emit one JSON object with `schema: "terraform-performance-baseline-v1"`.

- [ ] **Step 2: Add browser baseline**

Measure pointer/tap-to-visible-render latency and browser heap/resource diagnostics where supported. Do not turn headless CI frame timing into a player FPS requirement.

- [ ] **Step 3: Add scripts**

```json
"terraform:performance:node": "TERRAFORM_PERFORMANCE_BASELINE=1 pnpm --filter @web-three-city/app-game exec vitest run tests/terraform-performance-baseline.test.ts --reporter=verbose",
"terraform:performance:browser": "TERRAFORM_PERFORMANCE_BASELINE=1 playwright test tests/browser/terraform-performance.spec.ts --workers=1",
"terraform:performance:baseline": "pnpm terraform:performance:node && pnpm terraform:performance:browser"
```

- [ ] **Step 4: Run baseline and preserve output**

```bash
pnpm terraform:performance:baseline
```

Expected: measurement output produced; no arbitrary threshold gate added.

- [ ] **Step 5: Commit**

```bash
git add apps/game/tests/terraform-performance-baseline.test.ts tests/browser/terraform-performance.spec.ts package.json
git commit -m "test(terraform): add performance baseline"
```

## Task 17: Add Terraform lifecycle soak and release workflow

**Files:**
- Create: `tests/browser/terraform-lifecycle-soak.spec.ts`
- Create: `.github/workflows/terraform-hardening.yml`
- Modify: `package.json`

**Interfaces:**
- Proves repeated tool/city lifecycle cleanup and provides CI artifact evidence.

- [ ] **Step 1: Write soak scenario**

Run at least 20 alternating cycles covering:

```text
enter live city
activate Terraform
preview several targets
deactivate Terraform
reactivate Terraform
perform one edit
exit city
load/resume city
```

Assert each cycle:

```text
one live canvas only
Terraform overlay root count stable
input listener count stable
pending RAF count returns to baseline after exit
no page errors
undo history never crosses LiveCitySession boundary
IndexedDB closes cleanly at final teardown
```

- [ ] **Step 2: Add opt-in script**

```json
"terraform:lifecycle:soak": "TERRAFORM_LIFECYCLE_SOAK=1 playwright test tests/browser/terraform-lifecycle-soak.spec.ts --workers=1"
```

- [ ] **Step 3: Create hardening workflow with `pipefail`**

Every piped command must start with:

```bash
set -o pipefail
```

Workflow runs:

```text
exact-head verification
pnpm verify
terraform:performance:baseline
terraform:lifecycle:soak
```

Upload textual baseline/soak artifacts even when later steps fail.

- [ ] **Step 4: Run locally/focused**

```bash
pnpm terraform:lifecycle:soak
pnpm verify
```

- [ ] **Step 5: Commit**

```bash
git add tests/browser/terraform-lifecycle-soak.spec.ts .github/workflows/terraform-hardening.yml package.json
git commit -m "test(terraform): add lifecycle hardening gate"
```

## Task 18: Create canonical Terraform documentation and Production Closure record

**Files:**
- Create: `docs/systems/terraform/README.md`
- Create: `docs/systems/terraform/verification/TERRAFORM-V1-PRODUCTION-CLOSURE.md`
- Modify only if evidence requires: `docs/systems/terraform/specs/TERRAFORM-V1-PRODUCT-SPEC.md`

**Interfaces:**
- Produces final status/evidence record; no runtime behavior.

- [ ] **Step 1: Document final public surfaces and ownership**

README must state:

```text
Terraform owns player land-editing policy and transient tool state.
Terrain owns canonical elevation and atomic mutation.
Terraform has no canonical persistence snapshot in v1.
Terraform Grid Overlay is gameplay presentation, not Terrain Debug.
```

List exact package surfaces actually shipped.

- [ ] **Step 2: Capture release evidence**

Closure record must contain exact:

```text
final implementation commit
PR numbers
CI run IDs
Terraform Hardening run ID
Sonar result if configured for the PR
performance baseline values
lifecycle soak count/results
browser E2E results
architecture check result
post-merge master verification
```

Do not fill evidence before it exists.

- [ ] **Step 3: Define reopen criteria**

Use only concrete reasons:

```text
correctness regression violating frozen Terraform semantics
save/load defect causing edited Terrain loss
input defect causing camera gestures to commit Terraform
Undo correctness defect corrupting Terrain
resource/lifecycle leak owned by Terraform
reproducible performance regression against a future adopted threshold
```

New tools such as Smooth, Slope, Redo, economy cost, Water/Ground reconciliation are vNext/new-system work, not reasons to reopen v1 semantics silently.

- [ ] **Step 4: Run formatting and full verification**

```bash
pnpm format:check
pnpm verify
pnpm terraform:performance:baseline
pnpm terraform:lifecycle:soak
```

All required correctness commands must exit 0. Performance output is evidence, not a threshold unless a threshold was explicitly adopted.

- [ ] **Step 5: Commit documentation**

```bash
git add docs/systems/terraform
git commit -m "docs(terraform): close Terraform v1 production status"
```

## Task 19: Merge and post-merge verification

**Files:** none expected unless a verified defect is found.

- [ ] **Step 1: Verify final PR exact head**

Record:

```bash
git rev-parse HEAD
```

Use that SHA as the expected head for merge.

- [ ] **Step 2: Require final PR checks**

Required:

```text
CI SUCCESS
Terraform Hardening SUCCESS
architecture check SUCCESS
Sonar SUCCESS when present as repository gate
```

Do not treat Vercel preview as a Terraform release gate unless the repository's release policy changes explicitly.

- [ ] **Step 3: Merge with exact expected head SHA**

Do not merge if the PR head moved after verification.

- [ ] **Step 4: Verify `master` read-back**

Confirm `master` points at the merge commit and canonical Terraform README/closure record are present.

- [ ] **Step 5: Verify post-merge workflows**

Require fresh `master` CI and Terraform Hardening success. Do not reuse pre-merge evidence as post-merge proof.

- [ ] **Step 6: Mark Terraform v1 Production Closed only after evidence exists**

Final status may be declared only when:

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

## Self-Review Checklist

Before executing this plan, verify all of the following against `TERRAFORM-V1-PRODUCT-SPEC.md`:

```text
[x] Raise/Lower/Flatten covered
[x] 0.25m/1m/4m strengths covered
[x] 1×1/3×3/5×5 brushes covered
[x] shared-vertex influence ring covered
[x] world boundary all-or-nothing covered
[x] unlocked-region all-or-nothing covered
[x] elevation limit/no clamp covered
[x] canonical Flatten reference selection covered
[x] stale preview revision protection covered
[x] one action/one Terrain command covered
[x] no-op behavior covered
[x] multiple sequential Undo covered
[x] external revision invalidation covered
[x] Undo 100-entry cap covered
[x] no Redo covered
[x] no Undo persistence covered
[x] semantic Terrain picking reuse covered
[x] mouse/touch camera precedence covered
[x] separate Terraform gameplay grid covered
[x] localized Terrain/debug/terraform rebuild covered
[x] CitySaveV1 unchanged covered
[x] save/exit/load acceptance covered
[x] lifecycle/resource soak covered
[x] performance measurement-first baseline covered
[x] architecture policy/read-edge enforcement covered
[x] production closure/post-merge verification covered
```

Placeholder scan: this plan intentionally contains no `TBD`, no unspecified error handling, and no task that says only "write tests" without naming the exact behavior. Any implementation discovery that contradicts a frozen semantic must stop and amend the spec through an explicit design revision rather than silently changing behavior.
