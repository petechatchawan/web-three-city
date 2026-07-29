# Web Terraform Foundation v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic Raise, Lower, and Flatten Terrain editing with accumulated square-brush Preview, commit-on-release, one-level Undo, and exactly one complete Water update per accepted Commit or Undo.

**Architecture:** `terraform-core` owns pure brush/raster, planning, validation, commit, and Undo contracts over immutable Terrain snapshots. `terraform-three` owns transient cell-accurate Preview presentation. `camera-input` gains one generic primary-pointer tool delegate for conflict-free camera handoff, while `apps/game` composes UI, input, Terrain, Water, Grid, Selection, lifecycle, and evidence.

**Tech Stack:** Node.js 22+, pnpm 10.13.1, TypeScript 6 strict mode, Three.js 0.185.1 WebGL2, Vitest 4.1.10, Playwright 1.61.1, Vite 8.1.5, GitHub Actions.

## Global Constraints

- Approved specification: `docs/superpowers/specs/2026-07-29-terraform-foundation-v0-1-design.md`.
- Base commit: `ccd0c41c50c6704b7f67e51913780aa823eea2e2`.
- Delivery profile: single developer / low maintenance / mobile first.
- Shared authoritative lattice remains `129 × 129` for `128 × 128` cells.
- Height levels remain integer `0..4`; height step remains `0.5`.
- Cardinally adjacent lattice heights may differ by at most one level.
- Brush sizes are exactly `1`, `3`, and `5` cells.
- Stroke cells accumulate from an immutable pointer-down Terrain snapshot.
- Every unique affected vertex changes at most once per stroke.
- Flatten target is locked from pointer-down world Y rounded to the nearest level.
- Preview changes no committed state and triggers no Water work.
- Commit occurs only at `pointerup`; interruption commits nothing.
- One successful Commit or Undo performs exactly one complete Water derivation/replacement.
- Terrain save remains `TerrainSaveV1`; Undo and Water are not persisted.
- No Redo, multi-level Undo, automatic slope propagation, incremental Water scheduling, Roads/buildings constraints, economy, workers, WebGPU, or final art.
- Every production behavior follows RED → verify RED → minimal GREEN → focused regression → commit.

---

## Planned File Map

```text
packages/terraform-core/
  package.json
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
  src/contracts.ts
  src/brush.ts
  src/cell-line.ts
  src/plan.ts
  src/undo-store.ts
  src/index.ts
  test/brush.test.ts
  test/cell-line.test.ts
  test/plan.test.ts
  test/undo-store.test.ts

packages/terraform-three/
  package.json
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
  src/preview-geometry.ts
  src/preview-presentation.ts
  src/index.ts
  test/preview-geometry.test.ts
  test/preview-presentation.test.ts

packages/camera-input/src/dom-input-binding.ts
packages/camera-input/src/index.ts
packages/camera-input/test/dom-input-binding.test.ts

apps/game/package.json
apps/game/src/game-ui.ts
apps/game/src/game-input.ts
apps/game/src/game-bootstrap.ts
apps/game/src/interaction-evidence.ts
apps/game/src/style.css

browser-tests/helpers/interaction.ts
browser-tests/terraform.spec.ts
browser-tests/visual-evidence.spec.ts
docs/evidence/terraform-foundation-v0-1.md
pnpm-lock.yaml
```

---

### Task 1: Brush expansion and continuous stroke raster

**Files:**
- Create: `packages/terraform-core/package.json`
- Create: `packages/terraform-core/tsconfig.json`
- Create: `packages/terraform-core/tsconfig.build.json`
- Create: `packages/terraform-core/vitest.config.ts`
- Create: `packages/terraform-core/src/contracts.ts`
- Create: `packages/terraform-core/src/brush.ts`
- Create: `packages/terraform-core/src/cell-line.ts`
- Create: `packages/terraform-core/src/index.ts`
- Create: `packages/terraform-core/test/brush.test.ts`
- Create: `packages/terraform-core/test/cell-line.test.ts`

**Interfaces:**
- Consumes: `CellCoord`, `WorldConfig`.
- Produces: `TerraformOperation`, `TerraformBrushSize`, `WorldToolMode`, `expandBrushCells()`, `rasterizeCellLine()`.

- [ ] **Step 1: Create package metadata and failing brush tests**

```ts
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { expandBrushCells } from '../src/index.js';

describe('expandBrushCells', () => {
  it.each([
    [1, 1],
    [3, 9],
    [5, 25],
  ] as const)('expands size %s to %s centered cells', (size, count) => {
    expect(expandBrushCells({ x: 64, z: 64 }, size, WORLD_CONFIG)).toHaveLength(count);
  });

  it('clips a 5x5 brush at the north-west boundary deterministically', () => {
    expect(expandBrushCells({ x: 0, z: 0 }, 5, WORLD_CONFIG)).toEqual([
      { x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 },
      { x: 0, z: 1 }, { x: 1, z: 1 }, { x: 2, z: 1 },
      { x: 0, z: 2 }, { x: 1, z: 2 }, { x: 2, z: 2 },
    ]);
  });
});
```

- [ ] **Step 2: Write failing cell-line tests**

```ts
import { expect, it } from 'vitest';
import { rasterizeCellLine } from '../src/index.js';

it('fills a fast horizontal drag without holes', () => {
  expect(rasterizeCellLine({ x: 2, z: 4 }, { x: 6, z: 4 })).toEqual([
    { x: 2, z: 4 }, { x: 3, z: 4 }, { x: 4, z: 4 }, { x: 5, z: 4 }, { x: 6, z: 4 },
  ]);
});

it('uses deterministic supercover cells for a diagonal drag', () => {
  expect(rasterizeCellLine({ x: 1, z: 1 }, { x: 4, z: 3 })).toEqual([
    { x: 1, z: 1 }, { x: 2, z: 1 }, { x: 2, z: 2 },
    { x: 3, z: 2 }, { x: 4, z: 2 }, { x: 4, z: 3 },
  ]);
});
```

- [ ] **Step 3: Verify RED**

Run:

```bash
pnpm install --frozen-lockfile
pnpm --filter @web-three-city/terraform-core test -- brush.test.ts cell-line.test.ts
```

Expected: FAIL because the package and exports do not exist.

- [ ] **Step 4: Implement contracts and deterministic algorithms**

```ts
export type WorldToolMode = 'navigate' | 'raise' | 'lower' | 'flatten';
export type TerraformOperation = Exclude<WorldToolMode, 'navigate'>;
export type TerraformBrushSize = 1 | 3 | 5;
```

`expandBrushCells()` validates the center and brush enum, clips to map bounds, and returns z-major/x-major unique cells. `rasterizeCellLine()` uses integer supercover traversal, includes both endpoints, and removes only adjacent duplicate cells.

- [ ] **Step 5: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/terraform-core test -- brush.test.ts cell-line.test.ts
pnpm --filter @web-three-city/terraform-core typecheck
pnpm --filter @web-three-city/terraform-core build
pnpm lint

git add packages/terraform-core pnpm-lock.yaml
git commit -m "feat(terraform): add brush and stroke raster"
```

---

### Task 2: Transaction planning, validation, and commit

**Files:**
- Modify: `packages/terraform-core/src/contracts.ts`
- Create: `packages/terraform-core/src/plan.ts`
- Modify: `packages/terraform-core/src/index.ts`
- Create: `packages/terraform-core/test/plan.test.ts`

**Interfaces:**
- Consumes: Task 1 brush cells, `TerrainSnapshot`, `createTerrainMap()`, `TerrainDirtyRegion`, `GridVertexCoord`, `WorldConfig`.
- Produces: `TerraformStrokeInput`, `TerraformPlan`, `TerraformCommitReceipt`, `planTerraformStroke()`, `commitTerraformPlan()`.

- [ ] **Step 1: Write failing Raise/Lower tests**

```ts
it('raises every unique shared vertex exactly once', () => {
  const terrain = flatTerrain(1);
  const plan = planTerraformStroke(terrain, {
    operation: 'raise', brushSize: 1, cells: [{ x: 10, z: 10 }, { x: 11, z: 10 }],
  }, WORLD_CONFIG);
  expect(plan.valid).toBe(true);
  expect(plan.affectedCells).toHaveLength(2);
  expect(plan.affectedVertices).toHaveLength(6);
  expect(plan.changedVertexCount).toBe(6);
  expect(plan.proposedHeightLevels[latticeIndex(11, 10)]).toBe(2);
});

it('rejects a Lower transaction when any affected vertex is already minimum', () => {
  const plan = planTerraformStroke(flatTerrain(0), {
    operation: 'lower', brushSize: 1, cells: [{ x: 2, z: 2 }],
  }, WORLD_CONFIG);
  expect(plan).toMatchObject({ valid: false, invalidReason: 'terraform:height-range' });
});
```

- [ ] **Step 2: Write failing Flatten and constraint tests**

```ts
it('flattens every affected vertex to the locked target', () => {
  const terrain = terrainWithLevels([[10, 10, 1], [11, 10, 2], [10, 11, 2], [11, 11, 1]]);
  const plan = planTerraformStroke(terrain, {
    operation: 'flatten', brushSize: 1, cells: [{ x: 10, z: 10 }], flattenTargetLevel: 2,
  }, WORLD_CONFIG);
  expect(plan.valid).toBe(true);
  for (const vertex of plan.affectedVertices) {
    expect(plan.proposedHeightLevels[latticeIndex(vertex.x, vertex.z)]).toBe(2);
  }
});

it('rejects a resulting cardinal delta greater than one', () => {
  const terrain = terrainWithLevels([[20, 20, 2], [19, 20, 0]]);
  const plan = planTerraformStroke(terrain, {
    operation: 'raise', brushSize: 1, cells: [{ x: 20, z: 20 }],
  }, WORLD_CONFIG);
  expect(plan).toMatchObject({ valid: false, invalidReason: 'terraform:cardinal-delta' });
});

it('rejects a no-op Flatten plan', () => {
  const plan = planTerraformStroke(flatTerrain(2), {
    operation: 'flatten', brushSize: 3, cells: [{ x: 20, z: 20 }], flattenTargetLevel: 2,
  }, WORLD_CONFIG);
  expect(plan).toMatchObject({ valid: false, invalidReason: 'terraform:no-change' });
});
```

- [ ] **Step 3: Write failing commit tests**

```ts
it('commits an immutable snapshot with one revision increment and receipt', () => {
  const terrain = flatTerrain(1, 7);
  const plan = planTerraformStroke(terrain, {
    operation: 'raise', brushSize: 1, cells: [{ x: 8, z: 9 }],
  }, WORLD_CONFIG);
  const result = commitTerraformPlan(terrain, plan, WORLD_CONFIG);
  expect(result.snapshot.revision).toBe(8);
  expect(result.snapshot.heightLevels).not.toBe(terrain.heightLevels);
  expect(terrain.heightLevels[latticeIndex(8, 9)]).toBe(1);
  expect(result.receipt).toMatchObject({ beforeRevision: 7, afterRevision: 8, changedVertexCount: 4 });
});

it('rejects a stale or invalid plan', () => {
  const terrain = flatTerrain(1, 4);
  const plan = planTerraformStroke(terrain, {
    operation: 'raise', brushSize: 1, cells: [{ x: 1, z: 1 }],
  }, WORLD_CONFIG);
  expect(() => commitTerraformPlan({ ...terrain, revision: 5 }, plan, WORLD_CONFIG))
    .toThrowError('terraform:stale-plan');
});
```

- [ ] **Step 4: Verify RED**

```bash
pnpm --filter @web-three-city/terraform-core test -- plan.test.ts
```

Expected: FAIL because plan and commit APIs do not exist.

- [ ] **Step 5: Implement plan generation**

The implementation must:

- validate Terrain dimensions/lattice;
- deduplicate and z-major sort input cells;
- expand every center by the selected brush and deduplicate again;
- derive four shared vertices per affected cell and sort z-major/x-major;
- copy the base height bytes exactly once;
- apply Raise/Lower/Flatten once per unique vertex from base bytes;
- record the tight vertex dirty region;
- validate integer range, complete-map cardinal deltas, and non-zero change;
- freeze metadata arrays while retaining a private immutable `Uint8Array` copy.

- [ ] **Step 6: Implement commit**

`commitTerraformPlan()` verifies `plan.valid`, exact `baseTerrainRevision`, dimensions, and changed count; then calls `createTerrainMap()` with copied proposed bytes, original seed/generator metadata, and `revision + 1`.

- [ ] **Step 7: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/terraform-core test -- plan.test.ts
pnpm --filter @web-three-city/terraform-core test:coverage
pnpm --filter @web-three-city/terraform-core typecheck
pnpm --filter @web-three-city/terraform-core build

git add packages/terraform-core
git commit -m "feat(terraform): plan and commit Terrain transactions"
```

---

### Task 3: One-level monotonic Undo

**Files:**
- Create: `packages/terraform-core/src/undo-store.ts`
- Modify: `packages/terraform-core/src/index.ts`
- Create: `packages/terraform-core/test/undo-store.test.ts`

**Interfaces:**
- Consumes: committed `TerrainSnapshot`, `createTerrainMap()`, `WorldConfig`.
- Produces: `TerraformUndoStore`.

- [ ] **Step 1: Write failing tests**

```ts
it('restores the captured bytes with a newer revision and consumes Undo', () => {
  const before = flatTerrain(1, 3);
  const after = flatTerrain(2, 4);
  const store = new TerraformUndoStore();
  store.captureBeforeCommit(before);
  const restored = store.undo(after, WORLD_CONFIG);
  expect(restored?.heightLevels).toEqual(before.heightLevels);
  expect(restored?.revision).toBe(5);
  expect(store.available).toBe(false);
  expect(store.undo(restored!, WORLD_CONFIG)).toBeNull();
});

it('a later commit replaces the previous Undo entry', () => {
  const store = new TerraformUndoStore();
  store.captureBeforeCommit(flatTerrain(1, 1));
  store.captureBeforeCommit(flatTerrain(2, 2));
  expect(store.undo(flatTerrain(3, 3), WORLD_CONFIG)?.heightLevels[0]).toBe(2);
});
```

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @web-three-city/terraform-core test -- undo-store.test.ts
```

Expected: FAIL because the store does not exist.

- [ ] **Step 3: Implement minimal immutable storage**

Store only copied lattice bytes plus seed/generator metadata. `clear()` is idempotent. `undo()` returns `null` when empty, otherwise creates a new snapshot with `current.revision + 1` and consumes the entry.

- [ ] **Step 4: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/terraform-core test -- undo-store.test.ts
pnpm --filter @web-three-city/terraform-core test:coverage
pnpm --filter @web-three-city/terraform-core typecheck

git add packages/terraform-core
git commit -m "feat(terraform): add one-level monotonic Undo"
```

---

### Task 4: Cell-accurate Three.js Preview

**Files:**
- Create: `packages/terraform-three/package.json`
- Create: `packages/terraform-three/tsconfig.json`
- Create: `packages/terraform-three/tsconfig.build.json`
- Create: `packages/terraform-three/vitest.config.ts`
- Create: `packages/terraform-three/src/preview-geometry.ts`
- Create: `packages/terraform-three/src/preview-presentation.ts`
- Create: `packages/terraform-three/src/index.ts`
- Create: `packages/terraform-three/test/preview-geometry.test.ts`
- Create: `packages/terraform-three/test/preview-presentation.test.ts`

**Interfaces:**
- Consumes: `TerraformPlan`, canonical Terrain topology, `WorldConfig`, Three.js Scene.
- Produces: `TerraformPreviewMeshData`, `buildTerraformPreviewMesh()`, `TerraformPreviewPresentation`.

- [ ] **Step 1: Write failing geometry tests**

```ts
it('builds exactly two canonical triangles for one affected cell', () => {
  const data = buildTerraformPreviewMesh(validOneCellPlan(), WORLD_CONFIG);
  expect(data.cellCount).toBe(1);
  expect(data.indices).toHaveLength(6);
  expect(data.positions).toHaveLength(12);
  for (let index = 1; index < data.positions.length; index += 3) {
    expect(data.positions[index]).toBeCloseTo(1 * WORLD_CONFIG.heightStep + 0.03, 8);
  }
});

it('uses valid green and invalid red vertex colors', () => {
  expect([...buildTerraformPreviewMesh(validOneCellPlan(), WORLD_CONFIG).colors.slice(0, 3)])
    .toEqual([0.2, 0.9, 0.42]);
  expect([...buildTerraformPreviewMesh(invalidOneCellPlan(), WORLD_CONFIG).colors.slice(0, 3)])
    .toEqual([0.95, 0.22, 0.2]);
});
```

- [ ] **Step 2: Write failing lifecycle tests**

```ts
it('keeps one named root and atomically replaces Preview geometry', () => {
  const scene = new THREE.Scene();
  const preview = new TerraformPreviewPresentation(scene, WORLD_CONFIG);
  preview.show(validOneCellPlan());
  const first = preview.object3d;
  preview.show(validTwoCellPlan());
  expect(scene.children.filter((node) => node.name === 'terraform-preview-root')).toHaveLength(1);
  expect(preview.object3d).not.toBe(first);
});

it('clears and disposes idempotently', () => {
  const scene = new THREE.Scene();
  const preview = new TerraformPreviewPresentation(scene, WORLD_CONFIG);
  preview.show(validOneCellPlan());
  preview.clear();
  preview.clear();
  expect(scene.children).toHaveLength(0);
});
```

- [ ] **Step 3: Verify RED**

```bash
pnpm install --frozen-lockfile
pnpm --filter @web-three-city/terraform-three test
```

Expected: FAIL because the package does not exist.

- [ ] **Step 4: Implement geometry and presentation**

For each affected cell, read four proposed lattice levels, choose `selectTerrainDiagonal()`, emit four world-space vertices at `level * heightStep + 0.030`, and emit the two `CELL_TRIANGLES` indices with upward winding. Use one shared transparent `MeshBasicMaterial` with vertex colors, `opacity: 0.52`, `depthTest: true`, `depthWrite: false`, `DoubleSide`, and render order `15`.

- [ ] **Step 5: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/terraform-three test
pnpm --filter @web-three-city/terraform-three test:coverage
pnpm --filter @web-three-city/terraform-three typecheck
pnpm --filter @web-three-city/terraform-three build

git add packages/terraform-three pnpm-lock.yaml
git commit -m "feat(terraform): add transient Three.js Preview"
```

---

### Task 5: Primary-pointer tool and two-finger camera handoff

**Files:**
- Modify: `packages/camera-input/src/dom-input-binding.ts`
- Modify: `packages/camera-input/src/index.ts`
- Modify: `packages/camera-input/test/dom-input-binding.test.ts`

**Interfaces:**
- Consumes: existing `GestureController`, pointer capture, camera controller.
- Produces: `PrimaryPointerToolDelegate`, optional `tool` on `WorldInputBindingOptions`.

- [ ] **Step 1: Write failing single-pointer tool tests**

```ts
it('routes a claimed primary pointer to the tool instead of camera pan/tap', () => {
  const tool = createToolDelegate({ enabled: true, claim: true });
  const binding = bindWorldInput({ ...options, tool });
  dispatchPointer(canvas, 'pointerdown', 1, 100, 100);
  dispatchPointer(canvas, 'pointermove', 1, 140, 100);
  dispatchPointer(canvas, 'pointerup', 1, 140, 100);
  expect(tool.calls).toEqual(['begin:1', 'move:1', 'end:1']);
  expect(camera.panScreen).not.toHaveBeenCalled();
  expect(onEligibleTap).not.toHaveBeenCalled();
  binding.dispose();
});
```

- [ ] **Step 2: Write failing interruption/handoff tests**

```ts
it('cancels the tool and transfers two contacts to camera gestures', () => {
  const tool = createToolDelegate({ enabled: true, claim: true });
  bindWorldInput({ ...options, tool });
  dispatchPointer(canvas, 'pointerdown', 1, 100, 100);
  dispatchPointer(canvas, 'pointermove', 1, 110, 100);
  dispatchPointer(canvas, 'pointerdown', 2, 200, 100);
  dispatchPointer(canvas, 'pointermove', 2, 220, 100);
  expect(tool.calls).toContain('cancelAll');
  expect(camera.zoomAt.mock.calls.length + camera.rotateYawAt.mock.calls.length + camera.panScreen.mock.calls.length)
    .toBeGreaterThan(0);
});

it.each(['pointercancel', 'lostpointercapture', 'blur'] as const)(
  'cancels a claimed tool stroke on %s',
  (kind) => { /* dispatch kind and assert cancelAll exactly once */ },
);
```

- [ ] **Step 3: Verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- dom-input-binding.test.ts
```

Expected: FAIL because tool delegation does not exist.

- [ ] **Step 4: Implement ownership state machine**

Track `toolPointerId`, latest first sample, and `toolTransferredToGestures`. A claimed first pointer bypasses GestureController. On second pointer, call `tool.cancelAll()`, seed first latest sample then second sample into GestureController, and route both contacts to gestures until all end. `clearActiveSession()` cancels tool and gesture state, releases capture, and clears ownership. Wheel/keyboard logic remains unchanged.

- [ ] **Step 5: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/camera-input test -- dom-input-binding.test.ts
pnpm --filter @web-three-city/camera-input test:coverage
pnpm --filter @web-three-city/camera-input typecheck

git add packages/camera-input
git commit -m "feat(input): arbitrate primary Terraform tools"
```

---

### Task 6: Game UI, stroke session, Commit/Undo, and Water composition

**Files:**
- Modify: `apps/game/package.json`
- Modify: `apps/game/src/game-ui.ts`
- Modify: `apps/game/src/game-input.ts`
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `apps/game/src/interaction-evidence.ts`
- Modify: `apps/game/src/style.css`
- Modify: `pnpm-lock.yaml`
- Modify: `browser-tests/game.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–5, existing Terrain/Water/Grid/Selection lifecycle.
- Produces: functional Terraform UI and read-only evidence.

- [ ] **Step 1: Write failing UI/browser contract tests**

```ts
test('exposes Navigate, Raise, Lower, Flatten, brush, and Undo controls', async ({ page }) => {
  await openGame(page);
  await expect(page.getByRole('button', { name: 'Navigate' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Raise' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lower' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Flatten' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Brush 1 × 1' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Undo Terraform' })).toBeDisabled();
});
```

- [ ] **Step 2: Add a Terraform stroke controller inside `game-input.ts`**

The app controller must:

- expose mutable mode/brush accessors to UI;
- use existing Terrain raycast result including `worldPoint`;
- lock base snapshot and Flatten target at begin;
- accumulate supercover line cells and brush union;
- rebuild Preview only when the plan fingerprint changes;
- call `onCommit(plan)` exactly once at tool pointer end when valid;
- clear Preview and call no commit on cancellation;
- report active/valid/cell-count evidence.

Pass this controller as the new `tool` delegate to `bindWorldInput()`.

- [ ] **Step 3: Add UI controls and state updates**

Extend `GameUi` with tool/brush/Undo buttons and methods:

```ts
setToolMode(mode: WorldToolMode): void;
setBrushSize(size: TerraformBrushSize): void;
setUndoAvailable(available: boolean): void;
```

Use `aria-pressed`, disabled Undo, visible active styling, and compact three/four-column button groups that remain usable at `390 × 844`.

- [ ] **Step 4: Implement world replacement helper**

Add one helper in `game-bootstrap.ts` that accepts a next Terrain snapshot and reason. It must derive Water before visible changes, pause rendering, load Terrain → Water → Grid → Selection, refresh Terrain raycasts, update snapshots/metrics, and resume rendering in `finally`. On presentation failure, reload the previous committed Terrain/Water/Grid/Selection before rethrowing.

- [ ] **Step 5: Implement Commit and Undo composition**

On valid stroke end:

```text
undo.captureBeforeCommit(snapshot)
→ commitTerraformPlan(snapshot, plan)
→ replaceWorld(committed.snapshot, 'Terraform applied')
→ commitCount += 1
→ waterRebuildCount += 1
→ update Undo enabled state
```

On Undo:

```text
cancel active session and Preview
→ undo.undo(snapshot)
→ replaceWorld(restored, 'Terraform undone')
→ undoCount += 1
→ waterRebuildCount += 1
→ disable Undo
```

If replacement fails, clear the newly captured Undo entry and keep/report the previous committed world.

- [ ] **Step 6: Integrate lifecycle rules**

- selecting Raise/Lower/Flatten sets Grid visible;
- Save cancels active Preview before encoding current Terrain;
- Load cancels Preview and clears Undo before replacement;
- context loss cancels Preview;
- restoration reloads empty Preview state;
- disposal order is Input → Preview → Selection → Grid → Water → Terrain → Renderer.

- [ ] **Step 7: Publish Terraform evidence**

Add the exact `TerraformInteractionEvidence` fields from the spec plus `sceneRootCounts.preview`. Evidence contains no mutation callbacks.

- [ ] **Step 8: Verify focused GREEN and commit**

```bash
pnpm --filter @web-three-city/game typecheck
pnpm --filter @web-three-city/game build
pnpm exec playwright test browser-tests/game.spec.ts browser-tests/interaction.spec.ts --project=chromium

git add apps/game browser-tests/game.spec.ts pnpm-lock.yaml
git commit -m "feat(terraform): integrate tools, Commit, Undo, and Water"
```

---

### Task 7: Terraform browser acceptance and deterministic evidence

**Files:**
- Modify: `browser-tests/helpers/interaction.ts`
- Create: `browser-tests/terraform.spec.ts`
- Modify: `browser-tests/visual-evidence.spec.ts`
- Create: `docs/evidence/terraform-foundation-v0-1.md`

**Interfaces:**
- Consumes: Game Terraform controls/evidence.
- Produces: Chromium acceptance, screenshots, trace, metrics, exact evidence record.

- [ ] **Step 1: Add deterministic browser helpers**

Add helpers that project/select known Terrain cells, drag through a list of cell targets, dispatch pointer cancellation, and read Terraform evidence. Do not depend on screenshot pixels for behavior assertions.

- [ ] **Step 2: Test Preview-before-Commit and one Water update**

```ts
test('accumulates Raise Preview and commits once on release', async ({ page }) => {
  await openGame(page);
  await page.getByRole('button', { name: 'Raise' }).click();
  const before = await readEvidence(page);
  await beginTerrainStroke(page, { x: 50, z: 50 });
  await moveTerrainStroke(page, { x: 54, z: 50 });
  const preview = await readEvidence(page);
  expect(preview.terraform.strokeActive).toBe(true);
  expect(preview.terraform.previewCellCount).toBeGreaterThan(1);
  expect(preview.terraform.committedTerrainRevision).toBe(before.terraform.committedTerrainRevision);
  expect(preview.terraform.waterRebuildCount).toBe(before.terraform.waterRebuildCount);
  await endTerrainStroke(page, { x: 54, z: 50 });
  const after = await readEvidence(page);
  expect(after.terraform.committedTerrainRevision).toBe(before.terraform.committedTerrainRevision + 1);
  expect(after.terraform.waterRebuildCount).toBe(before.terraform.waterRebuildCount + 1);
  expect(after.terraform.commitCount).toBe(before.terraform.commitCount + 1);
});
```

- [ ] **Step 3: Test all tools and brushes**

Cover:

- Raise then Lower returning the edited area to its original height;
- Flatten locking its target from pointer-down and applying across a drag;
- brush evidence counts for 1/3/5 on an interior cell;
- fast drag supercover with no missing centerline cells;
- boundary-clipped 5×5 brush.

- [ ] **Step 4: Test invalid and interrupted strokes**

Cover:

- max-level Raise, min-level Lower, no-op Flatten, and cardinal-delta Preview are red and do not commit;
- pointercancel, lost capture, blur, and context loss leave Terrain/Water revisions unchanged;
- second touch cancels Preview and produces camera movement without a Terraform commit.

- [ ] **Step 5: Test Undo, save/load, and restoration**

Cover:

- Undo restores deterministic Terrain heights, increments revision, and rebuilds Water exactly once;
- Undo is consumed and disabled;
- second commit replaces prior Undo entry;
- load clears Undo and Preview;
- save/load reproduces committed Terrain and derived Water;
- context restoration leaves one Terrain, Water, Grid, Selection, and zero Preview roots when idle.

- [ ] **Step 6: Capture visual evidence**

Required files:

```text
terraform-game-desktop-navigate.png
terraform-raise-preview-1x1.png
terraform-raise-preview-5x5.png
terraform-invalid-preview.png
terraform-after-commit-water.png
terraform-after-undo.png
terraform-game-mobile-tools.png
terraform-mobile-drag-preview.png
terraform-performance-evidence.json
```

JSON records preview cell/triangle counts, Commit/Undo durations, Terrain/Water revisions, Water rebuild counts, root counts, and screenshot inventory. Timings are observations, not budgets.

- [ ] **Step 7: Verify browser GREEN and commit**

```bash
pnpm exec playwright test browser-tests/terraform.spec.ts browser-tests/visual-evidence.spec.ts --project=chromium --trace=on

git add browser-tests docs/evidence/terraform-foundation-v0-1.md
git commit -m "test(terraform): add browser acceptance and evidence"
```

---

### Task 8: Final verification, boundary audit, and review handoff

**Files:**
- Modify only actual defects found in Tasks 1–7.
- Finalize: `docs/evidence/terraform-foundation-v0-1.md`.
- Update PR description/checklist.

**Interfaces:**
- Consumes: complete milestone.
- Produces: exact-head verification and owner visual-review handoff.

- [ ] **Step 1: Run focused gates**

```bash
pnpm --filter @web-three-city/terraform-core test:coverage
pnpm --filter @web-three-city/terraform-three test:coverage
pnpm --filter @web-three-city/camera-input test:coverage
pnpm --filter @web-three-city/terraform-core typecheck
pnpm --filter @web-three-city/terraform-three typecheck
pnpm --filter @web-three-city/camera-input typecheck
pnpm --filter @web-three-city/game build
```

- [ ] **Step 2: Run full repository gates**

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

Expected: every command PASS on the exact head.

- [ ] **Step 3: Run boundary and scope audits**

```bash
rg -n "from ['\"]three['\"]|document\.|window\." packages/terraform-core
rg -n "terraform" packages/terrain-core packages/terrain-generator packages/water-core packages/water-three
rg -n "TerrainSaveV2|TerraformSave|undo.*localStorage|localStorage.*undo" .
rg -n "redo|multi.*undo|dirtyWater|worker|WebGPU|terraformCost|buildingConstraint|roadConstraint" \
  packages/terraform-core packages/terraform-three apps/game
```

Expected: pure core; no reverse dependencies; unchanged save schema; no excluded subsystem implementation.

- [ ] **Step 4: Verify changed-file boundary and exact head**

Allow only Terraform packages, generic input extension, Game composition/UI, browser tests/evidence, docs, and required lockfile changes. Reject unrelated Terrain topology, Water connectivity, camera behavior, generator, or art refactors.

```bash
git status --short
git diff --check
git push
```

- [ ] **Step 5: Require exact-head CI and review artifacts**

Require all four jobs:

```text
Quality and provenance
Unit, geometry, and golden tests
Build all packages and applications
Chromium smoke, interaction, and visual evidence
```

Inspect the complete desktop/mobile Preview, Commit, Water-update, invalid, and Undo screenshot inventory. Record exact head SHA, CI run ID, test counts, artifact IDs/digests, timings, root counts, review-thread count, and owner visual approval state.

- [ ] **Step 6: Mark PR Ready only after exact-head PASS**

The PR remains unmerged until exact-head CI passes and the owner accepts the visual result or explicitly delegates final visual approval.

---

## Self-review result

- Spec coverage: all operation, brush, stroke, validity, Preview, input handoff, Commit, Undo, Water, lifecycle, UI, evidence, and exclusion requirements map to Tasks 1–8.
- Placeholder scan: no `TBD`, deferred implementation instruction, or undefined “similar to” step remains.
- Type consistency: operation, brush, mode, plan, receipt, Undo, Preview, delegate, and evidence names match the accepted specification.

## Completion definition

Terraform Foundation v0.1 is complete only when all eight tasks are implemented with observed RED/GREEN cycles, exact-head CI passes every required job, Raise/Lower/Flatten and 1/3/5 brushes work, accumulated Preview mutates nothing before release, interruptions commit nothing, invalid plans remain uncommitted, Commit and Undo each update Water exactly once, revisions remain monotonic, mobile camera handoff remains usable, and visual evidence is approved before merge.
