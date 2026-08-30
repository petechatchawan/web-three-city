# Terraform v1 Product Specification

- **Status:** FROZEN — OWNER APPROVED 2026-08-31
- **Date:** 2026-08-31
- **Baseline:** `master@e07e1e0e0f6843826d6c362fc020d5be6c94969a`
- **Terrain baseline:** Terrain Engine v1 — Production Closed
- **Natural World baseline:** Natural World Architecture v1 — Frozen
- **Scope:** Player-facing land editing policy, planning, preview, interaction, undo, presentation, persistence acceptance, hardening, and release closure

## 1. Decision

Terraform v1 is a separate product/gameplay capability that translates player intent into Terrain mutations. It does not own canonical elevation and does not reopen Terrain Engine v1.

```text
Terraform
= how the player changes land

Terrain
= canonical land geometry/elevation truth
```

Binding pipeline:

```text
Pointer / tool intent
        ↓
Terrain semantic pick
        ↓
Gameplay Cell target
        ↓
Terraform footprint + validation
        ↓
immutable Terraform plan
        ↓
apps/game execution boundary
        ↓
TerrainCommands.applyEdits()
        ↓
TerrainMutationReceipt / TerrainChangeSet
        ↓
Terrain presentation rebuild
+ Terraform-local invalidation mapping
        ↓
Terraform presentation rebuild
+ transient Undo history
```

Terraform must never mutate Terrain internals, Terrain Three.js geometry, Terrain snapshots, or persistence data directly.

## 2. Existing production facts

Terraform v1 is designed against the current production World/Terrain contracts:

```text
World cells              512 × 512
Gameplay Cell            8m × 8m
Canonical Terrain grid   513 × 513 vertices
LogicalElevation unit    0.25m
Terrain min              -4096 levels = -1024m
Terrain max              +4096 levels = +1024m
Logical chunk            32 × 32 cells
```

Terrain canonical mutation remains vertex-based. Terraform presents cell-based editing to the player and resolves it into desired canonical vertex elevations.

## 3. Architecture boundary

Package direction:

```text
systems/terraform
├─ domain
├─ application
├─ contracts
├─ presentation/three
├─ index.ts
└─ composition.ts
```

Approved direct read dependencies:

```text
@web-three-city/terraform -> @web-three-city/world
@web-three-city/terraform -> @web-three-city/terrain
```

Both are root read/public surfaces only.

`systems/terraform` must not import:

```text
@web-three-city/terrain/commands
@web-three-city/terrain/composition
Terrain internal modules
World composition surfaces
```

`apps/game` may import Terraform composition plus Terrain command/composition surfaces and is the v1 execution boundary. This preserves ADR-001: one production system does not command another production system.

Terraform v1 has no independent canonical save authority. Tool state, preview state, and Undo history are transient.

## 4. Product operations

Terraform v1 supports exactly:

```text
RAISE
LOWER
FLATTEN
```

Deferred from v1:

```text
Smooth
Slope tool
Erosion tool
Ground/soil painting
Water editing
Road grading
construction cost/economy policy
Redo
continuous paint while dragging
continuous radial/falloff sculpting
```

### 4.1 Raise

For every unique canonical vertex touched by the selected Gameplay Cell footprint:

```text
desiredElevation = currentElevation + strengthLevels
```

All touched vertices receive the same delta, preserving local height differences inside the footprint.

### 4.2 Lower

```text
desiredElevation = currentElevation - strengthLevels
```

### 4.3 Flatten

Flatten is reference-level based.

When Flatten is active without a target, the next valid reference tap selects one canonical `LogicalElevation` and does not mutate Terrain.

Reference selection uses the nearest canonical corner of the semantic-picked cell:

```text
uQ16 < 32768  -> west
uQ16 >= 32768 -> east
vQ16 < 32768  -> south
vQ16 >= 32768 -> north
```

Exact midpoint ties therefore resolve east/north deterministically.

A valid reference tap must be:

```text
inside World bounds
inside an unlocked region
Terrain-readable
```

The chosen corner elevation becomes `flattenTarget`.

Subsequent valid taps set all unique footprint vertices to that exact canonical level:

```text
desiredElevation = flattenTarget
```

`Repick Level` clears the target; the next valid reference tap selects a new one.

Flatten never stores or commits an arbitrary interpolated triangle height.

## 5. Strength

Frozen strengths:

| Strength | Levels | Vertical change |
| -------- | -----: | --------------: |
| Fine     |      1 |           0.25m |
| Normal   |      4 |              1m |
| Strong   |     16 |              4m |

Default:

```text
Normal = 4 levels = 1m
```

Strength changes action magnitude only; Terrain precision remains 0.25m.

## 6. Brush footprints

Frozen brush sizes:

```text
1 × 1 Gameplay Cells =  8m ×  8m
3 × 3 Gameplay Cells = 24m × 24m
5 × 5 Gameplay Cells = 40m × 40m
```

Only odd square brushes exist in v1 so the picked Gameplay Cell is always the center.

For `N`:

```text
half   = (N - 1) / 2
xStart = target.x - half
xEnd   = target.x + half
zStart = target.z - half
zEnd   = target.z + half
```

The primary footprint is the inclusive cell rectangle.

## 7. Footprint to canonical vertices

A cell footprint maps to the unique surrounding vertex rectangle:

```text
1×1 cells -> 2×2 vertices -> 4 candidate vertices
3×3 cells -> 4×4 vertices -> 16 candidate vertices
5×5 cells -> 6×6 vertices -> 36 candidate vertices
```

```text
vertexX = xStart .. xEnd + 1
vertexZ = zStart .. zEnd + 1
```

Plans include only vertices whose desired elevation differs from current elevation. Zero changed vertices means a no-op.

## 8. Primary footprint and shared-vertex influence

Terrain vertices are shared, so changing boundary vertices can change neighboring cells outside the selected footprint.

Terraform exposes:

```text
footprintCells
= cells explicitly selected by the player

influenceCells
= additional incident cells whose exact surface can change
```

`influenceCells` excludes cells already in `footprintCells`.

Influence is derived through public World facts such as `incidentCells(vertex)` and sorted deterministically.

Gameplay preview must visually distinguish primary footprint and influence ring.

## 9. Validation

Planning reads canonical state and returns either an immutable valid plan or immutable invalid preview. It never partially mutates while validating.

Frozen invalid reasons:

```text
OUT_OF_WORLD
LOCKED_REGION
TERRAIN_UNAVAILABLE
ELEVATION_LIMIT
FLATTEN_TARGET_NOT_SELECTED
STALE_TERRAIN_REVISION
```

### 9.1 World boundary

If any selected cell is outside World bounds:

```text
INVALID -> OUT_OF_WORLD
```

No clipping and no partial execution.

### 9.2 Region ownership

Every footprint cell must satisfy:

```text
regionAtCell(cell) ∈ world.mapState.unlockedRegionIds
```

One locked cell rejects the whole footprint:

```text
INVALID -> LOCKED_REGION
```

### 9.3 Terrain availability

Every required current vertex elevation must be available through Terrain root read contracts. Any unavailable required chunk yields:

```text
TERRAIN_UNAVAILABLE
```

### 9.4 Elevation domain

Terraform never silently clamps.

If any Raise/Lower desired elevation exceeds Terrain's frozen logical range:

```text
INVALID -> ELEVATION_LIMIT
```

The whole action is rejected before issuing a Terrain command.

## 10. Immutable plan contract

Binding semantic shape:

```ts
export type TerraformOperation = "raise" | "lower" | "flatten";
export type TerraformBrushSize = 1 | 3 | 5;
export type TerraformStrength = "fine" | "normal" | "strong";

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

Preview:

```ts
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

Exact file split may vary; these semantics are binding.

## 11. Revision safety

Every plan captures `expectedTerrainRevision`.

Immediately before execution:

```text
terrain.read.revision() === plan.expectedTerrainRevision
```

If false:

```text
reject stale plan
invalidate/recompute preview
issue no Terrain mutation
```

The revision comparison and synchronous `TerrainCommands.applyEdits()` call have no `await` or asynchronous boundary between them.

Terraform does not alter Terrain's frozen command contract to add CAS.

## 12. Commit semantics

```text
1 valid changed tap/release
= 1 Terraform action
= at most 1 TerrainCommands.applyEdits() call
= at most 1 Terrain revision increment
= at most 1 Undo entry
```

Zero-edit plan:

```text
no Terrain command required
no Terrain revision increment
no Undo entry
```

Terrain remains the atomic mutation authority.

## 13. Execution boundary and invalidation mapping

`systems/terraform` produces plans and presentation-local contracts; it does not call Terrain commands.

`apps/game` executes:

```text
TerraformPlan
↓
verify revision
↓
map TerraformVertexMutation[] -> TerrainVertexEdit[]
↓
TerrainCommands.applyEdits()
```

On successful changed receipt:

```text
TerrainThreeProjection.rebuild(receipt.changeSet)
TerrainThreeDebugOverlay.rebuild(receipt.changeSet)
```

Terraform system presentation must not import the Terrain command surface merely to consume `TerrainChangeSet`. Instead the app maps the Terrain receipt to a minimal Terraform-owned invalidation DTO:

```ts
export interface TerraformTerrainInvalidation {
  readonly touchingLogicalChunks: readonly ChunkCoord[];
}
```

Then:

```text
TerraformThreeOverlay.rebuild({
  touchingLogicalChunks: receipt.changeSet.touchingLogicalChunks
})
```

This keeps `TerrainChangeSet` Terrain-only while still using it as the source of localized invalidation.

Terrain Debug presentation must also rebuild after Terraform changes; diagnostic presentation may not remain stale.

## 14. Live City session access

Terraform runtime receives typed Terrain mutation capability without casting `opaque`.

Direction:

```ts
export interface TerrainSessionHandle {
  readonly read: TerrainAuthorityRead;
  readonly commands: TerrainCommands;
  captureSnapshot(): TerrainStateSnapshotV1;
}
```

The existing opaque value may remain only for lifecycle internals that still need it; Terraform must not depend on it.

This changes City Session orchestration contracts, not Terrain Engine v1.

## 15. Undo

Terraform Undo is transient live-session history.

Frozen cap:

```text
MAX_UNDO_ENTRIES = 100
```

Each changed action records inverse canonical elevations:

```ts
export interface TerraformUndoEntry {
  readonly inverseEdits: readonly {
    readonly vertex: VertexCoord;
    readonly elevation: LogicalElevation;
  }[];
}
```

### 15.1 Revision-safe history

The history owns one session-level expected revision:

```text
undoHistory.expectedTerrainRevision
```

After changed commit:

```text
expectedTerrainRevision = receipt.newRevision
push inverse entry
```

Before Undo:

```text
terrain.read.revision() must equal expectedTerrainRevision
```

If an external actor changed Terrain:

```text
clear history
synchronize expectedTerrainRevision to current Terrain revision
Undo disabled until a new Terraform action commits
```

After successful Undo:

```text
pop one entry
expectedTerrainRevision = undoReceipt.newRevision
```

This explicitly permits multiple sequential Undo operations even though each inverse Terrain mutation advances revision.

### 15.2 Redo

Redo is deferred from v1.

## 16. Undo and persistence

Undo history is not persisted.

```text
Raise -> Save -> Undo
```

is allowed while the same live session remains active.

```text
Raise -> Save -> Exit -> Load
```

restores modified Terrain but starts with empty Terraform Undo history.

`CitySaveV1` remains unchanged because canonical modified Terrain already lives in `terrainSnapshot`.

## 17. Input and camera precedence

Existing City Input remains navigation authority.

Frozen tap/drag threshold:

```text
9 CSS pixels
```

### Mouse

```text
hover, no button -> preview
left down -> transient candidate preview
left up within threshold -> commit
left move beyond threshold -> cancel candidate + camera pan
right drag -> camera rotate
wheel -> camera zoom
```

### Touch

```text
first touch down -> transient candidate preview
release within threshold -> commit
movement beyond threshold -> cancel candidate + camera pan
second touch appears -> cancel candidate immediately
multi-touch -> camera pan/zoom/rotate
```

Binding invariant:

```text
Camera navigation gesture always wins over Terraform commit.
```

Terraform never continuously mutates while dragging.

## 18. Input integration shape

The generic City Input controller remains sole owner of viewport pointer DOM listeners/capture.

It forwards the same normalized pointer stream to an optional tool sink:

```ts
export interface CityToolPointerSink {
  onPointerEvent(event: NormalizedPointerEvent): void;
}
```

Existing `onTap` remains the only commit signal.

Terraform may use normalized pointer lifecycle for hover/transient preview/cancel, but no second Terraform DOM pointer listener stack is introduced.

## 19. Terraform Three.js overlay

Terrain Debug Grid remains diagnostic-only. Terraform owns a separate gameplay overlay.

Terraform-local interface:

```ts
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

Presentation layers:

```text
Editable grid       subtle
Primary footprint   strong valid highlight
Influence ring      secondary highlight
Invalid footprint   active error highlight
Flatten reference   dedicated target marker
```

The overlay is derived presentation only and never persistence authority.

## 20. Overlay geometry truth

Terraform overlay geometry conforms to Terrain root authority reads.

It must not infer canonical height from rendered Terrain meshes.

Gameplay grid boundaries use exact canonical Terrain vertex elevations along each 8m cell boundary.

## 21. Overlay chunking and localized rebuild

Chunking uses World logical chunks:

```text
32 × 32 cells per logical chunk
512 / 32 = 16 chunks per axis
16 × 16 = 256 maximum logical chunks
```

Only currently editable/unlocked land needs gameplay grid geometry while Terraform is active.

`TerrainChangeSet.touchingLogicalChunks[]` is mapped by `apps/game` into `TerraformTerrainInvalidation.touchingLogicalChunks[]`.

No DOM element or independent Three.js object is created per Gameplay Cell.

## 22. Tool session state

Transient state:

```ts
export interface TerraformSessionState {
  readonly active: boolean;
  readonly operation: TerraformOperation;
  readonly brushSize: TerraformBrushSize;
  readonly strength: TerraformStrength;
  readonly flattenTarget?: LogicalElevation;
}
```

Defaults:

```text
active         false
operation      raise
brushSize      1
strength       normal (1m)
flattenTarget  none
undoHistory    empty
```

Closing Terraform:

```text
clear preview
clear flatten target
hide gameplay overlay
retain Undo history while same LiveCitySession remains alive
```

New/Create/Load/Resume live session:

```text
undoHistory = empty
```

## 23. UI

Game UI exposes an explicit `Terraform` entry control that opens a mobile-first tool tray.

Required tray controls:

```text
Raise
Lower
Flatten

Brush 1×1
Brush 3×3
Brush 5×5

Fine 0.25m
Normal 1m
Strong 4m

Flatten target readout
Repick Level

Undo
Close
```

Strength controls are disabled/irrelevant while Flatten is active.

Undo is disabled when history is empty or invalidated.

UI labels map typed product semantics; UI code does not own Terraform rules.

## 24. Natural World compatibility

Terraform v1 mutates Terrain only.

Ground, Water, Environment, and Vegetation runtime implementation is not required before Terraform v1.

When future natural-world owners exist, multi-authority effects move behind explicit orchestration according to Natural World Architecture v1. Terrain does not gain Water/Ground/Vegetation semantics for Terraform convenience.

## 25. Save/load acceptance

Required scenario:

```text
New City
↓
enter Terraform
↓
Raise/Lower/Flatten edit
↓
Save
↓
Exit
↓
Load
↓
exact modified Terrain restored
```

Loaded session starts with empty Terraform Undo history.

No Terraform snapshot is added to `CitySaveV1`.

## 26. Lifecycle/resource requirements

Repeated Terraform activation/deactivation and city enter/exit must not leak:

```text
DOM event listeners
pointer capture
requestAnimationFrame work
Three.js geometries/materials
Terraform overlay roots
stale previews
Undo history across LiveCitySession boundaries
```

Terraform runtime/presentation `dispose()` operations are idempotent.

## 27. Performance baseline

Before Production Closure, record measurement baselines for:

```text
1×1 Raise plan
3×3 Raise plan
5×5 Raise plan
Flatten plan
commit + localized Terrain projection rebuild
Terraform overlay initial construction for unlocked land
localized overlay rebuild
Undo
browser interaction-to-visible-update latency
CPU-side Terraform geometry memory
Three.js geometry/material/object counts
```

Baseline is measurement-first. No pass/fail threshold is invented without observed evidence and explicit adoption.

## 28. Delivery gates

```text
TF0 Product/Architecture Freeze
TF1 Pure Terraform Core
TF2 Live Terrain Mutation + Undo Integration
TF3 Terraform Three.js Presentation
TF4 Mouse + Touch Interaction
TF5 Production UI + Live Composition
TF6 Persistence + Browser E2E
TF7 Hardening + Production Closure
```

### TF1

Must prove footprint/vertex mapping, strengths, Raise/Lower/Flatten, canonical Flatten reference, bounds/lock/availability/elevation rejection, influence cells, no-op planning, revision capture, deterministic purity.

### TF2

Must prove typed live Terrain commands, one action/one transaction, stale-plan rejection, Terrain projection/debug rebuild, mapped Terraform invalidation, one changed action/one Undo entry, sequential Undo, external-revision invalidation.

### TF3

Must prove separate gameplay grid, exact surface-conforming geometry, valid/invalid/influence/reference presentation, logical-chunk rebuild, resource disposal.

### TF4

Must prove mouse hover/tap/drag/rotate/wheel and touch tap/drag/second-finger takeover with camera precedence.

### TF5

Must prove explicit Terraform entry, required controls/defaults, Flatten target/repick, Undo enablement, mobile/accessibility behavior, live composition wiring.

### TF6

Must prove edit -> Save -> Exit -> Load -> exact Terrain restoration and empty Undo after Load/Resume, with unchanged `CitySaveV1` schema.

### TF7

Must prove full repository verify, architecture check, browser E2E, lifecycle soak, performance baseline, no Terraform-owned resource leak, canonical closure docs, and post-merge verification.

## 29. Binding invariants

```text
Terrain Engine v1 remains Production Closed.
Terraform never owns canonical elevation.
Player targeting is Gameplay Cell based.
Terrain commit remains canonical vertex based.
Brushes are exactly 1×1, 3×3, 5×5 cells.
Strengths are exactly Fine 0.25m, Normal 1m, Strong 4m; Normal is default.
Flatten uses a canonical reference LogicalElevation, never arbitrary interpolated height.
Flatten reference sampling is in-world, unlocked, and Terrain-readable.
Primary footprint and shared-vertex influence cells are distinct product concepts.
Footprints are all-or-nothing at World and unlocked-region boundaries.
Invalid elevation is rejected, never silently clamped.
Terraform system reads World/Terrain root surfaces only.
Terraform system never imports Terrain commands/composition.
apps/game executes Terrain commands from validated Terraform plans.
TerrainChangeSet remains Terrain-owned; apps/game maps it to TerraformTerrainInvalidation.
One valid changed action creates at most one Terrain transaction and one Undo entry.
Preview plans are revision-bound; stale plans never commit.
Undo is transient, capped at 100, sequentially usable, revision-safe, and not persisted.
Redo is deferred.
Camera gestures always win over Terraform commit.
Terraform never continuously mutates while dragging.
Terraform Grid Overlay is gameplay presentation separate from Terrain Debug Grid.
Derived overlay state is never persistence authority.
Terraform v1 does not require Ground/Water/Environment/Vegetation runtime implementation.
CitySaveV1 remains unchanged; Terrain snapshot persists Terraform edits.
TF1-TF7 close independently before Terraform v1 Production Closure.
```
