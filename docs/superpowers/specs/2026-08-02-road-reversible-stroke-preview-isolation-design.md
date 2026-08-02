# Road Reversible Stroke and Preview Isolation — Design Specification

**Status:** Proposed for owner review  
**Date:** 2026-08-02  
**Repository baseline:** `master@73045e40af2618eaf01d07ed2c55cdb70f1f6f32`  
**Scope:** Correct Road Build/Bulldoze stroke editing and Preview rendering without changing authoritative Road persistence, connectivity, save/load, Undo, or Terrain policy.

## 1. Problem statement

The current Road interaction has two observable defects.

1. The active Preview recolors committed Roads outside the current stroke because valid Preview rebuilds every occupied Road in each dirty chunk from the proposed snapshot and applies the Preview material to the entire rebuilt chunk.
2. A Road stroke is stored as a set-only `Map`. Once a cell has been visited, dragging backward over the same path cannot remove it from the active stroke. The Preview and final commit therefore retain abandoned tail cells.

These behaviors conflict with direct-manipulation Road drawing:

- Preview feedback must identify only the mutation currently controlled by the pointer.
- Exact backward movement along the active tail must undo that tail before pointer-up.
- Pointer-up must commit only the path that remains after all forward and backward movement.

## 2. Product behavior

### 2.1 Active-stroke isolation

During Road Build or Bulldoze:

- committed Road meshes remain rendered with committed materials;
- valid Preview material is applied only to cells that the current transaction will add or remove;
- invalid Preview material and markers are applied only to the current requested stroke footprint;
- existing Road cells outside the active mutation footprint are never recolored by Preview, even when their topology would change after commit;
- committed topology is rebuilt only after a successful pointer-up commit.

The HUD `Requested` count represents the unique cells currently present in the reversible pointer trace. `Effective` represents cells that would actually be added or removed by the current plan. Both counts update downward when backtracking removes cells.

### 2.2 Reversible tail semantics

The Road controller maintains an ordered pointer trace rather than a set-only accumulator.

For a path:

```text
A → B → C → D
```

moving backward from `D` to `C` produces:

```text
A → B → C
```

moving backward again to `B` produces:

```text
A → B
```

and moving from `B` to `E` produces:

```text
A → B → E
```

The abandoned `C → D` tail is no longer previewed and is not committed.

Backtracking is tail-local and deterministic:

- movement to the current tail cell is a no-op;
- movement to the immediately previous trace cell pops the current tail;
- any other traversed cell appends to the trace;
- a fast pointer move is rasterized into cardinal supercover cells and each traversed cell is processed sequentially under the same rules;
- revisiting an older non-tail cell through a new route does not erase unrelated history automatically;
- exact reverse traversal removes cells one by one, including across a fast multi-cell movement.

The trace may revisit a cell through a loop. The mutation footprint is the unique set of cells with a positive occurrence count in the remaining trace. This preserves loop/crossing support while allowing exact tail reversal.

### 2.3 Transaction semantics

The existing all-or-nothing transaction contract remains unchanged:

- one pointer-down captures Road and environment revisions;
- the complete current footprint is replanned after each effective trace change;
- pointer-up commits once;
- cancellation, blur, context loss, tool switch, disposal, or second-touch takeover commits nothing;
- an empty or no-op final footprint is invalid and creates no Undo entry;
- Build ignores cells already occupied by the same Road definition;
- Bulldoze ignores empty cells;
- final Terrain, Water, and Ramp topology validation still evaluates the complete proposed state.

## 3. Chosen architecture

### 3.1 Controller data model

Replace the set-only session state with two coordinated structures:

```ts
interface RoadStrokeSession {
  readonly trace: CellCoord[];
  readonly occurrenceCountByCell: Map<string, number>;
  lastPointerCell: CellCoord;
  plan: RoadMutationPlan | null;
}
```

Responsibilities:

- `trace` preserves movement order and supports tail pop;
- `occurrenceCountByCell` derives the unique active footprint without losing loop/crossing information;
- `lastPointerCell` remains the rasterization origin for the next pointer sample;
- planning receives a deterministic unique footprint derived from the remaining trace.

Processing one rasterized cell:

1. Ignore it when it equals the current trace tail.
2. When it equals the trace cell immediately before the tail, pop the tail and decrement that cell's occurrence count.
3. Otherwise append it and increment its occurrence count.
4. Replan only when the unique footprint or ordered trace changes in a way that can affect the transaction.

The controller remains application-owned. `road-core` continues to receive normalized cell input and remains unaware of pointer-trace semantics.

### 3.2 Preview presentation

`RoadPreviewPresentation` must stop rebuilding whole dirty chunks for the Preview layer.

The Preview API receives both:

- the immutable base `RoadSnapshot` captured for the stroke;
- the current `RoadMutationPlan` and placement environment.

Rendering rules:

#### Valid Build

- create the proposed snapshot from `plan.proposedDefinitionCodes`;
- derive `RoadCellView` only for `plan.addedCells`;
- build Preview geometry only from those views;
- derive each added cell's final connectivity against the complete proposed snapshot, including committed neighboring Roads.

#### Valid Bulldoze

- derive `RoadCellView` only for `plan.removedCells` from the captured base snapshot;
- render only those cells with the Bulldoze Preview material;
- leave every non-removed committed Road untouched.

#### Invalid transaction

- render invalid surface feedback only for `plan.requestedCells`;
- render invalid markers only for `plan.requestedCells`;
- never rebuild or recolor other cells in the dirty chunk.

Preview root replacement remains atomic: construct the new root off-scene, add it, then remove and dispose the previous root. This guarantees that cells removed by backtracking disappear in the same update.

### 3.3 Alternatives rejected

#### Whole-chunk Preview with masking

Retaining chunk rebuilds and attempting to mask committed cells was rejected because it keeps Preview coupled to dirty-chunk breadth, makes material partitioning fragile, and can regress whenever topology neighbors expand the dirty set.

#### Anchor-to-current straight-line rerasterization

Recomputing the stroke only from pointer-down to the current cell was rejected because it discards intentional bends and cannot represent freeform cardinal Road drawing.

#### Toggle-on-revisit semantics

Toggling any revisited cell was rejected because crossing an older path would unexpectedly remove interior cells and make loops ambiguous. Tail-local reversal is predictable and matches direct manipulation.

## 4. Component changes

### 4.1 `apps/game/src/road-stroke-controller.ts`

- introduce ordered trace and occurrence counts;
- process rasterized movement sequentially;
- support tail pop and branch replacement;
- derive deterministic unique requested cells;
- replan after forward append and reverse pop;
- preserve captured Road/environment revisions and cancellation behavior.

### 4.2 Game Preview adapter/composition

- pass the stroke's captured base `RoadSnapshot` to Preview presentation;
- ensure every Preview update replaces the previous root;
- keep committed presentation untouched until commit.

### 4.3 `packages/road-three/src/road-preview-presentation.ts`

- render cell-scoped Preview geometry instead of chunk-scoped geometry;
- derive Build geometry from proposed state and `addedCells`;
- derive Bulldoze geometry from base state and `removedCells`;
- keep invalid geometry constrained to `requestedCells`;
- retain current material ownership, disposal, context restoration, and root naming contracts.

No changes are required to serialized Road state, `RoadMutationPlan`, `commitRoadMutation`, World Save schema, Undo schema, or Terrain/Water contracts.

## 5. Edge cases

- **Tap:** one-cell trace; commits one effective cell or returns `road:no-change`.
- **Same-cell jitter:** does not duplicate cells or trigger unnecessary replan.
- **Fast reverse:** rasterized intermediate cells pop the active tail sequentially.
- **Reverse to pointer-down:** leaves one-cell trace at the anchor; the anchor is removed only by cancellation, not by moving outside the map.
- **Branch after reverse:** new movement appends from the retained tail; abandoned cells remain absent.
- **Self-crossing:** crossing an older non-tail cell is allowed; occurrence counts prevent premature footprint removal.
- **Build over existing Road:** requested count may exceed effective count; only effective additions use valid Preview geometry.
- **Bulldoze over empty cells:** only effective removals use valid Preview geometry.
- **Invalid Ramp/Water/Terrain:** the complete remaining footprint is shown invalid; no partial commit occurs.
- **Chunk boundary:** Preview remains cell-scoped even when the final mutation dirties multiple committed chunks.
- **Context loss or cancellation:** Preview root clears and the captured transaction is discarded.

## 6. TDD verification plan

### 6.1 Controller RED tests

Add failing tests before production changes for:

1. `A-B-C-D`, reverse to `C`, final requested cells are `A-B-C`.
2. Reverse to `B`, branch to `E`, final requested cells are `A-B-E`.
3. A fast multi-cell reverse pops every traversed tail cell.
4. HUD Preview count decreases immediately after reverse movement.
5. Same-cell jitter does not duplicate or replan.
6. A non-tail self-crossing does not erase unrelated trace cells.
7. Build and Bulldoze use identical reversible trace semantics.

The existing test that explicitly expects permanent accumulation after reversing must be replaced because it encodes the superseded UX contract.

### 6.2 Preview isolation RED tests

Add failing presentation tests for:

1. A valid Build in a chunk containing committed Roads produces Preview geometry only for `addedCells`.
2. Added-cell topology is derived against committed neighbors without recoloring those neighbors.
3. A valid Bulldoze produces Preview geometry only for `removedCells` from the base snapshot.
4. Invalid Preview contains only requested stroke cells and markers.
5. Replacing a longer Preview with a backtracked shorter Preview disposes the old root and removes tail geometry.

### 6.3 Browser RED/GREEN tests

Add built-application Chromium tests that:

1. create committed Roads near the test area;
2. begin a new Road stroke and assert committed Roads remain visually committed while only the active stroke changes color;
3. drag forward and record requested/effective counts plus target-cell pixels;
4. drag backward over the same path;
5. assert requested/effective counts decrease;
6. assert removed tail pixels return to the non-Preview image;
7. release and verify only the remaining path commits;
8. repeat the reversible-path assertion for Bulldoze.

The browser gate must validate visible pixels or explicit scene geometry bounds, not only HUD status.

## 7. Verification gates

Before merge, the exact PR head must pass:

- `pnpm install --frozen-lockfile`;
- `pnpm check`;
- focused Road controller tests;
- focused `road-three` Preview tests;
- focused Chromium reversible-stroke and Preview-isolation tests;
- complete Full Chromium/WebGL suite with the `full-ci` label;
- artifact review confirming committed Roads remain gray and backtracked tail cells disappear;
- no temporary workflow files in the final diff.

## 8. Acceptance criteria

The work is complete only when all of the following are true:

- Preview valid/invalid styling is limited to the active stroke footprint.
- Committed Roads outside that footprint retain committed styling during Preview.
- Exact backward dragging removes the active tail immediately.
- Forward-after-reverse creates a new branch without restoring the abandoned tail.
- HUD counts decrease consistently with the remaining footprint.
- Pointer-up commits only the remaining effective path.
- Build and Bulldoze obey the same reversible trace contract.
- Existing Road connectivity, Ramp validation, Save/Load, Undo, Terraform guarding, mobile interaction, and context-restoration tests remain green.

## 9. Supersession note

This specification narrows and supersedes the Road Network Foundation v0.1 wording that described a drag as a permanently accumulating deduplicated cell set. The authoritative behavior after this change is an ordered, tail-reversible pointer trace with a unique mutation footprint and cell-scoped Preview presentation.
