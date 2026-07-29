# Web Terraform Foundation v0.1 — Design Specification

- Status: **Accepted by delegated owner decision on 2026-07-29**
- Decision owner: repository owner
- Delivery profile: **single developer / low maintenance / mobile first**
- Base commit: `ccd0c41c50c6704b7f67e51913780aa823eea2e2`
- Depends on:
  - Web Terrain Foundation v0.1
  - Prototype Interaction Completion v0.1
  - Water & Shoreline Foundation v0.1

## 1. Purpose

Add deterministic, reversible Terrain editing to the Game with Raise, Lower, and Flatten tools; square brushes; accumulated drag preview; commit-on-release; one-level Undo; and complete Water re-derivation after accepted Terrain changes.

The milestone must preserve the existing shared-corner height lattice, canonical Terrain topology, camera gestures, save schema, Water ownership, mobile framing, and pure TypeScript domain boundaries.

## 2. Scope policy

Terraform v0.1 intentionally prioritizes correctness and maintainability over incremental optimization.

Included:

- Navigate, Raise, Lower, and Flatten modes;
- square brush sizes `1 × 1`, `3 × 3`, and `5 × 5` cells;
- continuous cell-line rasterization during a stroke;
- union of every brush footprint crossed by the stroke;
- transient resulting-surface Preview;
- all-or-nothing validation;
- one Terrain transaction at `pointerup`;
- one-level Undo;
- complete Water derivation and complete atomic Water replacement after Commit and Undo;
- desktop mouse, touch, and two-finger camera handoff;
- deterministic unit, presentation, browser, and visual evidence.

Excluded:

- Redo;
- multiple Undo entries;
- Terraform costs, economy, unlocks, sounds, particles, haptics, or final art;
- Roads/buildings/zones constraints;
- automatic slope propagation;
- incremental Water connectivity updates;
- partial Water chunk replacement;
- background workers;
- WebGPU.

## 3. Architecture

Dependency direction:

```text
world-core
   ↓
terrain-core
   ↓
terraform-core
   ↓
terraform-three
   ↓
apps/game

terrain-core → water-core → water-three → apps/game
```

Rules:

- `terraform-core` is pure TypeScript and must not import Three.js, DOM APIs, browser APIs, application code, or Water.
- `terraform-three` owns only Preview geometry, materials, scene lifecycle, render order, and disposal.
- Terrain remains the sole authority for height levels and revision.
- Water remains derived from the committed Terrain snapshot.
- The Game application composes Terraform, Terrain, Water, Grid, Selection, Camera, and UI.
- Terrain and Water do not import Terraform.

## 4. Tool modes

```ts
export type WorldToolMode = 'navigate' | 'raise' | 'lower' | 'flatten';
export type TerraformOperation = 'raise' | 'lower' | 'flatten';
export type TerraformBrushSize = 1 | 3 | 5;
```

Initial state:

```text
mode        navigate
brush size  1
undo        unavailable
preview     empty
```

Selecting a Terraform tool automatically makes the Terrain Grid visible. Returning to Navigate does not forcibly hide a Grid the user can already see.

One-finger/primary-pointer behavior:

- Navigate: existing pan and tap-selection behavior.
- Raise/Lower/Flatten: Terraform stroke; no one-finger camera pan.

Camera behavior while a Terraform tool is active:

- mouse wheel remains zoom;
- Rotate buttons and keyboard camera commands remain available;
- a second touch contact cancels the pending Terraform stroke without mutation and transfers the active contacts to the existing two-finger camera gesture controller;
- the tool does not resume until all transferred contacts end.

## 5. Stroke contract

A Terraform stroke starts on an in-bounds Terrain pick.

Locked behavior:

1. Capture the committed Terrain snapshot at `pointerdown` as the immutable stroke base.
2. Capture the first picked cell.
3. For Flatten, derive and lock one target height level from the first pick.
4. Expand the selected brush around every rasterized cell crossed by the pointer.
5. Union cells and vertices; duplicates never apply the operation twice.
6. Recompute the complete plan from the immutable stroke base whenever the accumulated cell set changes.
7. Update Preview only; committed Terrain and Water remain unchanged.
8. At `pointerup`, commit exactly one transaction when the final plan is valid.
9. `pointercancel`, lost capture, blur, context loss, explicit cancellation, disposal, or second-contact camera takeover clears Preview and commits nothing.

A pointer move between non-adjacent cells uses deterministic integer supercover rasterization so a fast drag cannot leave holes.

## 6. Brush footprint

Brushes are square and cell-centered.

```text
size 1  radius 0  footprint up to 1 cell
size 3  radius 1  footprint up to 9 cells
size 5  radius 2  footprint up to 25 cells
```

At map boundaries, footprints are clipped to in-bounds cells. Boundary clipping is valid and does not by itself reject a stroke.

Each affected cell contributes its four shared lattice vertices. The operation applies once to each unique affected vertex, regardless of how many accumulated cells reference it.

## 7. Operation semantics

### Raise

```text
nextLevel = baseLevel + 1
```

### Lower

```text
nextLevel = baseLevel - 1
```

### Flatten

The target is derived from the Terrain world-space hit at `pointerdown`:

```ts
const targetLevel = clamp(
  Math.round(worldPoint.y / config.heightStep),
  config.minHeightLevel,
  config.maxHeightLevel,
);
```

The target is locked for the complete stroke. Every unique affected vertex is set to that target level.

All operations are calculated from the stroke base snapshot, never from an earlier Preview frame.

## 8. Validation policy

A plan is accepted only when all requirements pass:

1. Terrain dimensions and lattice length match `WorldConfig`.
2. Every proposed level is an integer inside `[minHeightLevel, maxHeightLevel]`.
3. Every cardinally adjacent lattice pair in the resulting Terrain differs by at most one level.
4. At least one lattice vertex changes.
5. Every accumulated cell is in bounds after brush clipping.

Validation is transaction-wide and all-or-nothing.

```ts
export type TerraformInvalidReason =
  | 'terraform:height-range'
  | 'terraform:cardinal-delta'
  | 'terraform:no-change'
  | 'terraform:invalid-cell'
  | 'terraform:invalid-terrain';
```

An invalid plan remains visible as a red Preview and does not commit at `pointerup`. Additional cells may be accumulated after an invalid intermediate frame; the plan is recalculated and can become valid later.

No automatic slope propagation occurs in v0.1.

## 9. Domain model

```ts
export interface TerraformStrokeInput {
  readonly operation: TerraformOperation;
  readonly brushSize: TerraformBrushSize;
  readonly cells: readonly CellCoord[];
  readonly flattenTargetLevel?: number;
}

export interface TerraformPlan {
  readonly operation: TerraformOperation;
  readonly brushSize: TerraformBrushSize;
  readonly baseTerrainRevision: number;
  readonly affectedCells: readonly CellCoord[];
  readonly affectedVertices: readonly GridVertexCoord[];
  readonly proposedHeightLevels: Uint8Array;
  readonly changedVertexCount: number;
  readonly dirtyRegion: TerrainDirtyRegion;
  readonly valid: boolean;
  readonly invalidReason: TerraformInvalidReason | null;
}

export interface TerraformCommitReceipt {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly changedVertexCount: number;
  readonly affectedCellCount: number;
  readonly dirtyRegion: TerrainDirtyRegion;
}
```

Public functions:

```ts
export function expandBrushCells(
  center: CellCoord,
  brushSize: TerraformBrushSize,
  config: WorldConfig,
): readonly CellCoord[];

export function rasterizeCellLine(
  from: CellCoord,
  to: CellCoord,
): readonly CellCoord[];

export function planTerraformStroke(
  terrain: TerrainSnapshot,
  input: TerraformStrokeInput,
  config: WorldConfig,
): TerraformPlan;

export function commitTerraformPlan(
  terrain: TerrainSnapshot,
  plan: TerraformPlan,
  config: WorldConfig,
): Readonly<{ snapshot: TerrainSnapshot; receipt: TerraformCommitReceipt }>;
```

`commitTerraformPlan()` rejects invalid plans and stale `baseTerrainRevision` values.

## 10. Undo policy

`TerraformUndoStore` holds at most one pre-commit lattice snapshot.

```ts
export class TerraformUndoStore {
  get available(): boolean;
  captureBeforeCommit(snapshot: TerrainSnapshot): void;
  clear(): void;
  undo(current: TerrainSnapshot, config: WorldConfig): TerrainSnapshot | null;
}
```

Undo restores the previous height bytes while preserving monotonic revision:

```text
undoRevision = current.revision + 1
```

Undo is consumed once. A new successful commit replaces the prior Undo entry. Load clears Undo. Invalid/no-op strokes do not modify Undo.

## 11. Preview presentation

Preview depicts the resulting top surface for exactly the accumulated affected cells.

- Geometry uses canonical `selectTerrainDiagonal()` and `CELL_TRIANGLES`.
- Vertex Y comes from `plan.proposedHeightLevels * heightStep + 0.030`.
- Valid color: translucent green.
- Invalid color: translucent red.
- Preview is double-sided, depth-tested, does not write depth, and renders above Water/Grid but below Selection.
- Locked render order: `15`.
- Root name: `terraform-preview-root`.
- Mesh name: `terraform-preview-surface`.
- Preview geometry rebuilds only when the accumulated cell set, operation, brush size, target level, or base revision changes; never merely because another animation frame rendered.
- `clear()` removes and disposes geometry idempotently.

Preview does not alter Terrain, Water, Grid, save data, raycast objects, or revision.

## 12. Input arbitration

The existing world input binding gains an optional primary-pointer tool delegate rather than adding competing canvas listeners.

```ts
export interface PrimaryPointerToolDelegate {
  isEnabled(): boolean;
  begin(pointerId: number, point: ScreenPoint): boolean;
  move(pointerId: number, point: ScreenPoint): void;
  end(pointerId: number, point: ScreenPoint): void;
  cancel(pointerId: number): void;
  cancelAll(): void;
}
```

Rules:

- A successful `begin()` claims the first pointer for the tool.
- Claimed pointer movement is not sent to one-finger camera gestures.
- A second accepted pointer calls `cancelAll()`, seeds the latest first-pointer sample plus the new sample into `GestureController`, and transfers ownership to camera gestures.
- `clearActiveSession()` cancels both tool and camera sessions.
- UI-origin suppression and pointer capture remain unchanged.
- Wheel and keyboard camera behavior remain unchanged.

## 13. Commit composition

On a valid `pointerup`:

```text
commit TerraformPlan
→ derive complete WaterSnapshot once
→ pause rendering
→ load complete Terrain presentation
→ load complete Water presentation
→ reload Grid
→ rebuild Selection
→ refresh Terrain raycast objects
→ publish current snapshots and metrics
→ resume rendering
```

v0.1 intentionally uses complete Terrain/Grid/Water replacement after Commit and Undo. Existing dirty-region data is included in the receipt/evidence but incremental presentation scheduling is deferred until profiling proves it necessary.

If Water derivation fails, no visible mutation occurs. If presentation replacement throws, the Game attempts to restore the previous committed Terrain/Water state before reporting an error.

## 14. Save, load, restoration, and disposal

- Terrain save schema remains `TerrainSaveV1`.
- Water and Undo are not persisted.
- Save cancels an active stroke before serializing.
- Load cancels Preview, clears Undo, derives Water, and replaces the world.
- WebGL context loss cancels the active stroke and Preview.
- Context restoration reloads committed Terrain, Water, Grid, Selection, and empty Preview state.
- Disposal order: Input → Preview → Selection → Grid → Water → Terrain → Renderer.

## 15. UI contract

The Game panel adds:

- active tool status;
- Navigate, Raise, Lower, Flatten buttons;
- brush buttons `1 × 1`, `3 × 3`, `5 × 5`;
- Undo button with disabled state;
- active/pressed visual state for tool and brush controls.

Compact layout must remain usable at `390 × 844` without covering the complete usable world viewport after camera fit/reset.

## 16. Evidence contract

Read-only browser evidence adds:

```ts
export interface TerraformInteractionEvidence {
  readonly mode: WorldToolMode;
  readonly brushSize: TerraformBrushSize;
  readonly strokeActive: boolean;
  readonly previewValid: boolean | null;
  readonly previewCellCount: number;
  readonly committedTerrainRevision: number;
  readonly waterSourceTerrainRevision: number;
  readonly undoAvailable: boolean;
  readonly commitCount: number;
  readonly undoCount: number;
  readonly waterRebuildCount: number;
  readonly previewRootCount: number;
}
```

Acceptance evidence covers:

- Raise, Lower, and Flatten;
- brush sizes 1/3/5;
- continuous drag union;
- no mutation before `pointerup`;
- cancellation and second-pointer takeover;
- invalid range/delta/no-op rejection;
- one transaction and one Water rebuild per commit;
- Undo and monotonic revision;
- save/load and context restoration;
- desktop and mobile screenshots.

## 17. Performance policy

Structural gates:

- no Terrain or Water mutation during Preview;
- no Water derivation during pointer movement;
- one complete Water derivation per successful Commit or Undo;
- no per-frame Preview rebuild;
- one shared Preview material set;
- no worker, reflection, refraction, or extra render pass;
- complete replacement timing is evidence, not a hard v0.1 budget.

## 18. Acceptance gates

The milestone is complete only when:

1. exact-head formatting, lint, strict TypeScript, provenance, unit, coverage, build, and Chromium suites pass;
2. all three operations and all brush sizes work;
3. Preview accumulates across drag and committed Terrain remains unchanged before release;
4. cancellation leaves Terrain/Water revisions unchanged;
5. invalid plans render red and do not commit;
6. each accepted stroke produces one Terrain revision and one Water derivation/replacement;
7. Undo restores heights with a newer revision and updates Water once;
8. two-finger camera gestures remain usable while a tool is selected;
9. save/load, context restoration, Grid, Selection, and camera behavior do not regress;
10. deterministic screenshots and metrics are captured for owner visual review.
