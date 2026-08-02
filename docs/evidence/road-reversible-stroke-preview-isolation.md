# Road Reversible Stroke and Preview Isolation — Verification Evidence

**Status:** Focused verification complete; official exact-head CI pending  
**Date:** 2026-08-02  
**Repository baseline:** `master@73045e40af2618eaf01d07ed2c55cdb70f1f6f32`  
**Focused verified implementation head:** `9fa4c6b731b73e1d88e094c68fd6c9bfd381c88d`

## 1. User-observed defects

The Road tool exposed two related interaction defects:

1. Valid Preview material recolored committed Roads outside the active pointer stroke because Preview rebuilt every occupied Road in each dirty chunk from the proposed snapshot.
2. Stroke cells were retained in a set-only accumulator, so dragging backward could not remove the abandoned tail before pointer-up.

## 2. Confirmed root causes

### 2.1 Non-reversible stroke state

`RoadStrokeController` stored only a deduplicated set of visited cells. Every rasterized cell was added with no ordered path or tail-pop operation. Once visited, a cell remained in the plan for the rest of the pointer session.

### 2.2 Whole-chunk Preview rendering

Valid Preview derived `dirtyChunks` and rendered all occupied Roads from the proposed snapshot in those chunks with Preview material. The mutation footprint and render footprint were therefore different: committed topology neighbors and unrelated committed Roads in the same chunk were recolored.

## 3. TDD RED evidence

### 3.1 Controller reversal RED

Focused test command:

```bash
pnpm exec vitest run apps/game/src/road-stroke-controller.test.ts
```

Observed failure before the controller fix:

```text
Expected requested cells: [1, 2]
Received requested cells: [1, 2, 3, 4]
```

This reproduced the exact forward-then-reverse defect: the abandoned tail remained in the active plan.

### 3.2 Preview isolation RED

A base Road at cell `10,10` and an active Build at cell `11,10` were placed in the same chunk. The new bounding-box assertion required Preview geometry to begin at the active cell.

Observed failure before the renderer fix:

```text
Expected minimum X >= -53.0001
Received minimum X = -53.86000061035156
```

The received bound included the committed neighbor at cell 10 and directly proved whole-chunk Preview contamination.

### 3.3 Game composition RED

The renderer contract changed to require the captured base `RoadSnapshot`. Before Game wiring was implemented:

- `routeRoadPreview` did not exist;
- controller test callbacks still read the old first argument as the plan;
- Game called `show(plan, environment)` instead of `show(baseRoads, plan, environment)`.

## 4. Implemented correction

### 4.1 Reversible ordered pointer trace

The controller now:

- preserves an ordered cardinal trace;
- ignores same-tail jitter;
- pops the current tail when the next traversed cell is the immediately previous trace cell;
- processes fast pointer movement cell-by-cell through the existing rasterizer;
- supports reverse-then-branch behavior;
- derives the unique mutation footprint from the remaining trace;
- applies identical semantics to Build and Bulldoze;
- commits only the plan remaining at pointer-up.

### 4.2 Cell-scoped Preview presentation

`RoadPreviewPresentation.show` now receives:

```ts
show(
  baseRoads: RoadSnapshot,
  plan: RoadMutationPlan,
  environment: RoadPlacementEnvironment,
): void
```

Rendering rules:

- valid Build renders only `plan.addedCells` from the proposed snapshot;
- valid Bulldoze renders only `plan.removedCells` from the captured base snapshot;
- invalid Preview renders only `plan.requestedCells` and their markers;
- committed Roads outside the active footprint remain in the committed presentation layer;
- replacing a longer Preview with a shorter backtracked Preview disposes the old root atomically.

### 4.3 Deterministic browser evidence

Interaction evidence now exposes exact world-space Preview bounds. Browser acceptance combines:

- HUD Requested/Effective counts;
- authoritative occupied Road count;
- Preview root lifecycle;
- world-space geometry bounds;
- visible pixel attachments for baseline, forward Preview, reverse, branch, Bulldoze, and final commit states.

An initial test revision compared PNG files byte-for-byte. State and count assertions passed, but screenshots differed slightly because WebGL object replacement can alter antialiasing at nearby edges. That brittle harness was replaced with visible-pixel presence plus exact geometry bounds; this verifies the product contract without treating renderer sampling noise as a Road mutation.

## 5. Focused GREEN verification

GitHub Actions:

- Workflow: `Road Stroke TDD`
- Run: `#21`
- Run ID: `30734797070`
- Job ID: `91461534776`
- Focused implementation head before the workflow commit: `4c4dcd38ee0c7cf0d0bf4c0fb602cfd92dcef104`
- Verified commit produced by the successful workflow: `9fa4c6b731b73e1d88e094c68fd6c9bfd381c88d`

Results:

```text
Focused unit tests:        16/16 PASS
Game TypeScript typecheck: PASS
road-three typecheck:      PASS
Terrain Lab build:         PASS
Game build:                PASS
Focused Chromium:          3/3 PASS in 1.2 minutes
```

Chromium scenarios:

1. Build Preview remains cell-scoped and exact reverse removes the abandoned tail — PASS.
2. Reverse then perpendicular movement branches from the retained tail — PASS.
3. Bulldoze reverse restores the abandoned removal tail before release — PASS.

## 6. Focused artifact

- Name: `road-reversible-stroke-evidence`
- Artifact ID: `8829194829`
- Size: `244,925` bytes
- SHA-256: `badaa0e125549c08cac2e666c74033ec073c37acd137c5cb808557d6cbab08cc`

Visual review confirmed:

- committed Roads remain gray during an active Build Preview;
- the active stroke uses green Preview material;
- Requested/Effective counts decrease during reverse movement;
- world-space Preview bounds exclude the abandoned tail after reverse;
- reverse-then-branch excludes the abandoned original branch;
- Bulldoze Preview bounds shrink after reverse;
- pointer-up leaves no Preview root and mutates only the retained footprint.

## 7. Remaining exact-head gates

Focused verification does not authorize merge. Before PR closure, the final branch head after temporary-workflow removal must pass:

- official Lean CI with `pnpm install --frozen-lockfile` and `pnpm check`;
- complete Full Chromium/WebGL suite with the `full-ci` label;
- final browser artifact review;
- changed-file audit showing no temporary workflow files;
- PR description update and Ready-for-Review transition.

Merge remains blocked pending exact-head verification and explicit owner authorization.
