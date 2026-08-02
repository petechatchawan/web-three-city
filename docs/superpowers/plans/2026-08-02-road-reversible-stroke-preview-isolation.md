# Road Reversible Stroke and Preview Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Road Build and Bulldoze strokes tail-reversible while limiting valid and invalid Preview rendering to the active stroke footprint.

**Architecture:** Keep pointer-trace editing in `apps/game`, keep authoritative mutation planning in `road-core`, and make `road-three` render cell-scoped Preview geometry from an explicit captured base snapshot plus the current plan. The controller owns an ordered trace and occurrence counts; the renderer derives final connectivity from the proposed snapshot without recoloring committed neighbors.

**Tech Stack:** TypeScript 6.0.3, Three.js 0.185.1, Vitest 4.1.10, Playwright 1.61.1, Vite 8.1.5, pnpm 10.13.1, Node.js 22+

## Global Constraints

- Repository baseline is `master@73045e40af2618eaf01d07ed2c55cdb70f1f6f32`.
- Preserve Road persistence, connectivity, Save/Load, Undo, Terrain compatibility, Water eligibility, and all-or-nothing commit contracts.
- Preview valid/invalid styling must be limited to the active stroke footprint.
- Committed Roads outside that footprint must retain committed styling during Preview.
- Exact reverse movement must remove the active tail before pointer-up.
- Forward movement after reverse must branch from the retained tail and must not restore the abandoned tail.
- Build and Bulldoze must use the same reversible trace semantics.
- Fast pointer movement must remain cardinally continuous through `rasterizeTerraformCellLine`.
- No new runtime dependency is permitted.
- No temporary workflow file may remain in the final PR diff.
- The exact final PR head must pass Lean CI and Full Chromium/WebGL verification.

---

## File Structure

### Files modified

- `apps/game/src/road-stroke-controller.ts` — ordered trace, occurrence counts, tail pop, deterministic footprint.
- `apps/game/src/road-stroke-controller.test.ts` — controller RED/GREEN coverage for reverse, branch, fast reverse, jitter, loops, Build/Bulldoze parity.
- `apps/game/src/game-input.ts` — pass captured base Road snapshot into Preview rendering.
- `apps/game/src/game-input-road-preview.test.ts` — composition-level contract for base snapshot and Preview replacement.
- `packages/road-three/src/road-preview-presentation.ts` — cell-scoped valid Build/Bulldoze and invalid Preview rendering.
- `packages/road-three/test/road-preview-presentation.test.ts` — Preview isolation, final topology, root replacement, disposal.
- `browser-tests/road-reversible-stroke.spec.ts` — built-application visible behavior for Build and Bulldoze.
- `docs/evidence/road-reversible-stroke-preview-isolation.md` — exact-head RED/GREEN and artifact evidence.
- `docs/superpowers/specs/2026-08-02-road-reversible-stroke-preview-isolation-design.md` — status updated from proposed to implemented after verification.

### Interfaces changed

`CreateRoadStrokeControllerOptions.onPreview` becomes:

```ts
readonly onPreview: (
  baseRoads: RoadSnapshot | null,
  plan: RoadMutationPlan | null,
  environment: RoadPlacementEnvironment | null,
) => void;
```

`RoadPreviewPresentation.show` becomes:

```ts
show(
  baseRoads: RoadSnapshot,
  plan: RoadMutationPlan,
  environment: RoadPlacementEnvironment,
): void;
```

No `road-core` public interface changes.

---

### Task 1: Controller RED — encode reversible trace behavior

**Files:**
- Modify: `apps/game/src/road-stroke-controller.test.ts`

**Interfaces:**
- Consumes: `createRoadStrokeController(options)` and `RoadMutationPlan.requestedCells`.
- Produces: failing tests that define ordered tail reversal for Task 2.

- [ ] **Step 1: Replace the permanent-accumulation test with an immediate reverse test**

Use a controller starting at `{ x: 1, z: 1 }`, move to `{ x: 4, z: 1 }`, then move back to `{ x: 2, z: 1 }`. Assert the latest Preview and final plan contain only cells 1–2:

```ts
it('removes the active tail when the pointer reverses over the same path', () => {
  const previews: RoadMutationPlan[] = [];
  const controller = createRoadStrokeController({
    config: WORLD_CONFIG,
    getMode: () => 'road-build',
    getRoadSnapshot: () => createEmptyRoadSnapshot(WORLD_CONFIG),
    getEnvironment: () => environment(),
    onPreview: (_base, plan) => {
      if (plan !== null) previews.push(plan);
    },
  });

  controller.begin(1, { x: 1, z: 1 });
  controller.move(1, { x: 4, z: 1 });
  controller.move(1, { x: 2, z: 1 });

  expect(previews.at(-1)?.requestedCells).toEqual([
    { x: 1, z: 1 },
    { x: 2, z: 1 },
  ]);
  expect(controller.getState().previewCellCount).toBe(2);
  expect(controller.end(1, { x: 2, z: 1 })?.requestedCells).toEqual([
    { x: 1, z: 1 },
    { x: 2, z: 1 },
  ]);
});
```

- [ ] **Step 2: Add reverse-then-branch coverage**

Trace `{1,1} → {4,1} → {2,1} → {2,3}` and assert the abandoned `{3,1}`/`{4,1}` tail is absent while the retained path and new branch remain:

```ts
expect(finalPlan?.requestedCells).toEqual([
  { x: 1, z: 1 },
  { x: 2, z: 1 },
  { x: 2, z: 2 },
  { x: 2, z: 3 },
]);
```

- [ ] **Step 3: Add fast reverse coverage**

Move from `{1,1}` to `{7,1}` and back to `{2,1}` in one sample. Assert every traversed tail cell from 7 down to 3 is removed.

- [ ] **Step 4: Add same-cell jitter coverage**

Call `move` repeatedly with the current tail cell. Assert Preview callback count does not increase and requested cells remain unchanged.

- [ ] **Step 5: Add non-tail self-crossing coverage**

Build a rectangular loop that revisits an older cell not immediately before the tail. Assert the trace does not truncate unrelated history and the unique mutation footprint remains deterministic.

- [ ] **Step 6: Add Bulldoze parity coverage**

Create a base snapshot containing a straight Road, run the same forward/reverse path in `road-bulldoze`, and assert `removedCells` contains only the retained path.

- [ ] **Step 7: Run focused tests and confirm RED**

Run:

```bash
pnpm exec vitest run apps/game/src/road-stroke-controller.test.ts
```

Expected: failures showing reversed tail cells remain in `requestedCells` and Preview callback still uses the old signature.

- [ ] **Step 8: Commit RED tests**

```bash
git add apps/game/src/road-stroke-controller.test.ts
git commit -m "test: define reversible Road stroke behavior"
```

---

### Task 2: Controller GREEN — ordered tail-reversible pointer trace

**Files:**
- Modify: `apps/game/src/road-stroke-controller.ts`
- Test: `apps/game/src/road-stroke-controller.test.ts`

**Interfaces:**
- Produces: `onPreview(baseRoads, plan, environment)` and deterministic unique active footprint.
- Consumed by: Task 4 Game wiring and Task 5 browser tests.

- [ ] **Step 1: Change the Preview callback contract**

```ts
readonly onPreview: (
  baseRoads: RoadSnapshot | null,
  plan: RoadMutationPlan | null,
  environment: RoadPlacementEnvironment | null,
) => void;
```

`clear()` must call:

```ts
options.onPreview(null, null, null);
```

`replan()` must call:

```ts
options.onPreview(session.roads, session.plan, session.environment);
```

- [ ] **Step 2: Replace set-only session state**

Use:

```ts
interface RoadStrokeSession {
  readonly pointerId: number;
  readonly mode: RoadToolMode;
  readonly roads: RoadSnapshot;
  readonly environment: RoadPlacementEnvironment;
  readonly trace: CellCoord[];
  readonly occurrenceCountByCell: Map<string, number>;
  lastPointerCell: CellCoord;
  plan: RoadMutationPlan | null;
}
```

- [ ] **Step 3: Add trace count helpers**

```ts
function sameCell(first: CellCoord, second: CellCoord): boolean {
  return first.x === second.x && first.z === second.z;
}

function incrementOccurrence(session: RoadStrokeSession, cell: CellCoord): void {
  const key = cellKey(cell);
  session.occurrenceCountByCell.set(key, (session.occurrenceCountByCell.get(key) ?? 0) + 1);
}

function decrementOccurrence(session: RoadStrokeSession, cell: CellCoord): void {
  const key = cellKey(cell);
  const next = (session.occurrenceCountByCell.get(key) ?? 0) - 1;
  if (next <= 0) session.occurrenceCountByCell.delete(key);
  else session.occurrenceCountByCell.set(key, next);
}
```

- [ ] **Step 4: Process each rasterized cell sequentially**

```ts
function processTraceCell(session: RoadStrokeSession, cell: CellCoord): boolean {
  const tail = session.trace.at(-1);
  if (tail !== undefined && sameCell(tail, cell)) return false;

  const previous = session.trace.at(-2);
  if (previous !== undefined && sameCell(previous, cell)) {
    const removed = session.trace.pop();
    if (removed !== undefined) decrementOccurrence(session, removed);
    return true;
  }

  const copied = copyCell(cell);
  session.trace.push(copied);
  incrementOccurrence(session, copied);
  return true;
}
```

- [ ] **Step 5: Derive the unique footprint from the remaining trace**

Preserve first remaining occurrence order, then let `road-core` normalize deterministically:

```ts
function activeFootprint(session: RoadStrokeSession): readonly CellCoord[] {
  const seen = new Set<string>();
  const cells: CellCoord[] = [];
  for (const cell of session.trace) {
    const key = cellKey(cell);
    if (seen.has(key) || !session.occurrenceCountByCell.has(key)) continue;
    seen.add(key);
    cells.push(copyCell(cell));
  }
  return cells;
}
```

- [ ] **Step 6: Replace `addCell` with reversible movement processing**

For the initial cell, append once. For later samples, rasterize from `lastPointerCell` and skip the first duplicate cell returned by the rasterizer. Replan once after the whole sample only when at least one trace operation changed state.

- [ ] **Step 7: Keep the anchor cell on full reverse**

Do not allow the trace to become empty through movement. When the trace length is one, movement to the same cell is a no-op; cancellation remains the only way to discard the anchor.

- [ ] **Step 8: Run focused tests and confirm GREEN**

```bash
pnpm exec vitest run apps/game/src/road-stroke-controller.test.ts
```

Expected: all controller tests pass, including Build/Bulldoze reverse and branch behavior.

- [ ] **Step 9: Run Game typecheck**

```bash
pnpm --filter @web-three-city/game typecheck
```

Expected at this checkpoint: only call-site errors for the intentionally changed Preview callback/show signatures may remain until Task 4.

- [ ] **Step 10: Commit controller implementation**

```bash
git add apps/game/src/road-stroke-controller.ts apps/game/src/road-stroke-controller.test.ts
git commit -m "fix: make Road strokes tail reversible"
```

---

### Task 3: Preview isolation RED/GREEN in `road-three`

**Files:**
- Modify: `packages/road-three/src/road-preview-presentation.ts`
- Modify: `packages/road-three/test/road-preview-presentation.test.ts`

**Interfaces:**
- Consumes: captured `RoadSnapshot`, `RoadMutationPlan`, `RoadPlacementEnvironment`, `roadCellViewAt`.
- Produces: `show(baseRoads, plan, environment)` with geometry limited to effective/requested cells.

- [ ] **Step 1: Write RED test for valid Build isolation**

Create a base snapshot with committed Roads in the same chunk and a plan that adds one adjacent cell. Call:

```ts
preview.show(baseRoads, buildPlan, environment);
```

Assert:

- Preview root contains geometry for exactly one added cell.
- Preview bounds cover the added cell only.
- The committed sentinel remains untouched.
- Added-cell topology includes its committed neighbor connection.

- [ ] **Step 2: Write RED test for valid Bulldoze isolation**

Create a base snapshot with multiple Road cells, remove one cell, and assert Preview geometry is derived only from `removedCells` using base-state connectivity.

- [ ] **Step 3: Write RED test for invalid isolation**

Use requested cells in a chunk with unrelated committed Roads. Assert invalid surface triangle/marker bounds cover only requested cells.

- [ ] **Step 4: Write RED test for backtracked root replacement**

Show a longer plan, capture its root and geometry, then show a shorter plan. Assert the old root is removed/disposed and the new bounds exclude the abandoned tail.

- [ ] **Step 5: Run focused test and confirm RED**

```bash
pnpm exec vitest run packages/road-three/test/road-preview-presentation.test.ts
```

Expected: old `show(plan, environment)` signature and whole-chunk source behavior fail the new assertions.

- [ ] **Step 6: Import direct cell view support**

Add `roadCellViewAt` and snapshot construction imports from `road-core`. Remove chunk-based Preview source use from valid Preview paths; keep the constructor source only if another compatibility contract still requires it, otherwise remove the source field and constructor parameter in Task 4.

- [ ] **Step 7: Implement valid Build geometry**

Create a proposed snapshot from `plan.proposedDefinitionCodes`. For each `plan.addedCells` cell:

```ts
const view = roadCellViewAt(proposed, cell, environment, this.#config);
```

Build and merge only non-null views, then create one Preview mesh with `validPreview` material.

- [ ] **Step 8: Implement valid Bulldoze geometry**

For each `plan.removedCells`, derive the view from `baseRoads`. Build and merge only those views with the same valid Preview material.

- [ ] **Step 9: Keep invalid geometry requested-cell scoped**

Continue building invalid surface/markers only from `plan.requestedCells`; do not use `dirtyChunks` or chunk source data.

- [ ] **Step 10: Preserve atomic replacement and disposal**

Construct staged root completely before adding it to the scene. After adding, remove and dispose the previous root exactly once.

- [ ] **Step 11: Run focused tests and confirm GREEN**

```bash
pnpm exec vitest run packages/road-three/test/road-preview-presentation.test.ts
```

- [ ] **Step 12: Run package typecheck/tests**

```bash
pnpm --filter @web-three-city/road-three typecheck
pnpm --filter @web-three-city/road-three test
```

- [ ] **Step 13: Commit Preview isolation**

```bash
git add packages/road-three/src/road-preview-presentation.ts packages/road-three/test/road-preview-presentation.test.ts
git commit -m "fix: isolate Road Preview to active cells"
```

---

### Task 4: Game composition and state contract

**Files:**
- Modify: `apps/game/src/game-input.ts`
- Create: `apps/game/src/game-input-road-preview.test.ts`
- Modify: affected existing Game tests that provide `onPreview` mocks.

**Interfaces:**
- Consumes: controller `onPreview(baseRoads, plan, environment)` and renderer `show(baseRoads, plan, environment)`.
- Produces: one explicit data path from pointer-down snapshot to Preview rendering.

- [ ] **Step 1: Add composition RED test**

Mock `RoadPreviewPresentation.show` and assert one active stroke calls it with the exact `RoadSnapshot` captured at pointer-down, not a later snapshot returned by `getRoadSnapshot`.

- [ ] **Step 2: Wire the new callback**

```ts
onPreview(baseRoads, plan, environment): void {
  if (baseRoads === null || plan === null || environment === null) {
    options.roadPreview.clear();
  } else {
    options.roadPreview.show(baseRoads, plan, environment);
  }
  // existing road-state event dispatch remains unchanged
}
```

- [ ] **Step 3: Update all controller callback mocks**

Use `(_base, plan, _environment)` where tests only inspect plans. Keep null-clear assertions as three-null arguments.

- [ ] **Step 4: Run Game-focused tests**

```bash
pnpm exec vitest run \
  apps/game/src/road-stroke-controller.test.ts \
  apps/game/src/game-input-road-preview.test.ts \
  apps/game/src/game-tool-events.test.ts \
  apps/game/src/game-tool-presentation.test.ts
```

- [ ] **Step 5: Run Game typecheck**

```bash
pnpm --filter @web-three-city/game typecheck
```

- [ ] **Step 6: Commit Game wiring**

```bash
git add apps/game/src/game-input.ts apps/game/src/game-input-road-preview.test.ts apps/game/src/*.test.ts
git commit -m "refactor: pass captured Road state to Preview"
```

---

### Task 5: Browser RED/GREEN acceptance for visible reversal and isolation

**Files:**
- Create: `browser-tests/road-reversible-stroke.spec.ts`
- Modify only if necessary: `browser-tests/helpers/interaction.ts`

**Interfaces:**
- Consumes: built Game, `window.__WEB_THREE_CITY_INTERACTION_EVIDENCE__`, HUD Requested/Effective values, canvas screenshots.
- Produces: browser evidence that the user-observed defects are closed.

- [ ] **Step 1: Add a helper to resolve deterministic screen points for a cardinal Road path**

Reuse existing world/cell projection helpers. Return points for at least six adjacent flat/dry cells plus nearby precommitted Road cells.

- [ ] **Step 2: Add Build Preview isolation scenario**

1. Commit a gray Road near the test path.
2. Start a new Build stroke without release.
3. Capture a clip around the existing Road and active stroke.
4. Assert existing committed Road pixels remain committed-colored while active cells change.
5. Assert HUD requested/effective counts match the active footprint.

- [ ] **Step 3: Add Build reverse scenario**

1. Drag forward across six cells.
2. Record HUD counts and pixels at the tail.
3. Drag backward across three tail cells.
4. Assert counts decrease by three.
5. Assert abandoned-tail pixels return to their pre-Preview image.
6. Release and assert only retained cells increase `occupiedCellCount`.

- [ ] **Step 4: Add reverse-then-branch scenario**

Reverse part of a path, move in a perpendicular direction, release, and assert the abandoned original tail is not committed.

- [ ] **Step 5: Add Bulldoze reverse scenario**

Create a committed straight Road, start Bulldoze across it, reverse partway, and assert only the retained removal path is previewed and committed.

- [ ] **Step 6: Run browser tests and confirm RED before implementation is complete**

```bash
pnpm build:browser
pnpm exec playwright test browser-tests/road-reversible-stroke.spec.ts --project=chromium
```

Expected before Tasks 2–4 GREEN: Preview recolors committed cells and reverse counts do not decrease.

- [ ] **Step 7: Run focused browser tests and confirm GREEN**

Use the same command. Expected: all new scenarios pass with visible pixel/geometry evidence.

- [ ] **Step 8: Commit browser acceptance**

```bash
git add browser-tests/road-reversible-stroke.spec.ts browser-tests/helpers/interaction.ts
git commit -m "test: verify reversible Road Preview in Chromium"
```

---

### Task 6: Repository verification and evidence closure

**Files:**
- Create: `docs/evidence/road-reversible-stroke-preview-isolation.md`
- Modify: `docs/superpowers/specs/2026-08-02-road-reversible-stroke-preview-isolation-design.md`
- Modify: PR #15 description

**Interfaces:**
- Consumes: exact-head CI runs and browser artifact.
- Produces: merge-ready evidence ledger.

- [ ] **Step 1: Run focused unit suite**

```bash
pnpm exec vitest run \
  apps/game/src/road-stroke-controller.test.ts \
  apps/game/src/game-input-road-preview.test.ts \
  packages/road-three/test/road-preview-presentation.test.ts
```

- [ ] **Step 2: Run repository Lean gate**

```bash
pnpm install --frozen-lockfile
pnpm check
```

Expected: exit 0 with format, lint, typecheck, provenance, all workspace tests, deployment contracts, and builds passing.

- [ ] **Step 3: Run focused Chromium gate**

```bash
pnpm build:browser
pnpm exec playwright test browser-tests/road-reversible-stroke.spec.ts --project=chromium
```

- [ ] **Step 4: Commit evidence candidate**

Record exact head, RED failure summaries, GREEN commands, counts, and changed-file scope in the evidence document. Set design status to `Implemented; exact-head verification pending`.

- [ ] **Step 5: Trigger Lean CI on the owner-authored exact head**

Verify `pnpm check` succeeds in GitHub Actions for the exact PR head.

- [ ] **Step 6: Add `full-ci` label and run complete browser suite**

Require all production builds, every Chromium/WebGL test, and artifact upload to pass on the same exact head.

- [ ] **Step 7: Review artifact visually**

Confirm:

- committed Roads outside active stroke remain gray;
- active Build/invalid/Bulldoze feedback is cell-scoped;
- abandoned tail disappears during reverse;
- final committed Road contains only retained path;
- desktop and responsive layouts remain usable.

- [ ] **Step 8: Check final diff hygiene**

```bash
git diff --check master...HEAD
git diff --name-only master...HEAD | grep '^.github/workflows/' && exit 1 || true
```

Expected: clean diff and no temporary workflow files.

- [ ] **Step 9: Finalize evidence and PR status**

Update the evidence document and PR description with exact verified head, Lean run, Full CI run, test count, artifact ID/digest, and changed-file list. Mark PR Ready for Review but do not merge without owner authorization.

- [ ] **Step 10: Commit final evidence**

```bash
git add docs/evidence/road-reversible-stroke-preview-isolation.md \
  docs/superpowers/specs/2026-08-02-road-reversible-stroke-preview-isolation-design.md
git commit -m "docs: record Road reversible stroke verification"
```

---

## Plan Self-Review

- Spec coverage: reversible tail, reverse-then-branch, fast reverse, self-crossing, Build/Bulldoze parity, cell-scoped valid/invalid Preview, captured base snapshot, atomic root replacement, HUD count reduction, browser pixels, exact-head CI and artifact review are each assigned to explicit tasks.
- Placeholder scan: no TBD, TODO, deferred implementation, or unspecified test instruction remains.
- Type consistency: controller callback and renderer `show` signatures use the same ordered arguments in Tasks 2–4.
- Scope: no Road persistence, connectivity, Save/Load, Undo, Terrain, Water, or unrelated UI refactor is included.
