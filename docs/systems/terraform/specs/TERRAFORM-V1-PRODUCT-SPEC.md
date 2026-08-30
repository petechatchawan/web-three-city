# Terraform v1 Product Specification

- **Status:** FROZEN — OWNER APPROVED 2026-08-31
- **Date:** 2026-08-31
- **Baseline:** `master@e07e1e0e0f6843826d6c362fc020d5be6c94969a`
- **Terrain baseline:** Terrain Engine v1 — Production Closed
- **Natural World baseline:** Natural World Architecture v1 — Frozen
- **Scope:** Player-facing land editing policy, planning, preview, interaction, undo, presentation, persistence acceptance, and release gates

## 1. Decision

Terraform v1 is a separate product/gameplay capability that translates player intent into Terrain mutations. It does not own canonical elevation and does not reopen Terrain Engine v1.

```text
Terraform
= how the player changes land

Terrain
= canonical land geometry/elevation truth
```

The binding pipeline is:

```text
Pointer / tool intent
        ↓
Terrain semantic pick
        ↓
Gameplay Cell target
        ↓
Terraform footprint + policy validation
        ↓
Terraform immutable mutation plan
        ↓
apps/game execution boundary
        ↓
TerrainCommands.applyEdits()
        ↓
TerrainMutationReceipt / TerrainChangeSet
        ↓
localized Terrain + Terraform presentation rebuild
        ↓
transient Terraform undo history
```

Terraform must never mutate Terrain internals, Three.js Terrain geometry, snapshots, or persistence data directly.

## 2. Existing world and Terrain facts

Terraform v1 is designed against the existing production map and Terrain contracts:

```text
World cells              512 × 512
Gameplay Cell            8m × 8m
Canonical Terrain grid   513 × 513 vertices
LogicalElevation unit    0.25m
Terrain min              -4096 levels = -1024m
Terrain max              +4096 levels = +1024m
Logical chunk            32 × 32 cells
```

Terrain canonical mutation remains vertex-based. Terraform may present cell-based editing to the player, but the resulting commit is an immutable set of desired canonical vertex elevations.

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

Both dependencies use root read/public surfaces only.

`systems/terraform` must not import:

```text
@web-three-city/terrain/commands
@web-three-city/terrain/composition
Terrain internal modules
World composition surfaces
```

The application/composition layer may import Terrain command/composition surfaces and execute a validated Terraform plan. This preserves ADR-001: one system never commands another system directly.

Terraform v1 has no independent canonical save authority. Its tool/session state and undo history are transient.

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
continuous radial falloff/sculpt brush
```

### 4.1 Raise

For every unique canonical vertex touched by the selected Gameplay Cell footprint:

```text
desiredElevation = currentElevation + strengthLevels
```

The operation preserves local height differences inside the footprint because each vertex is offset by the same delta.

### 4.2 Lower

For every unique canonical vertex touched by the selected Gameplay Cell footprint:

```text
desiredElevation = currentElevation - strengthLevels
```

### 4.3 Flatten

Flatten is reference-level based.

When Flatten becomes active without a target level, the next valid Terrain tap selects a canonical `LogicalElevation` reference and does not mutate Terrain.

Reference selection uses the nearest canonical corner of the semantic-picked cell:

```text
uQ16 < 32768  -> west corner
uQ16 >= 32768 -> east corner
vQ16 < 32768  -> south corner
vQ16 >= 32768 -> north corner
```

The chosen corner elevation becomes `flattenTarget`.

Subsequent valid taps set every unique vertex in the footprint to exactly that canonical level:

```text
desiredElevation = flattenTarget
```

The player can explicitly choose `Repick Level`, which clears the target and makes the next valid tap select a new reference.

Flatten never stores or commits an arbitrary interpolated triangle height; the target is always an existing valid canonical `LogicalElevation`.

## 5. Strength

The frozen Terraform v1 strength model is:

| Strength | Levels | Meters |
| --- | ---: | ---: |
| Fine | 1 | 0.25m |
| Normal | 4 | 1m |
| Strong | 16 | 4m |

Default:

```text
Normal = 4 LogicalElevation levels = 1m
```

Strength changes Terraform action magnitude only. It does not change Terrain precision.

## 6. Brush footprints

Frozen brush sizes:

```text
1 × 1 Gameplay Cells =  8m ×  8m
3 × 3 Gameplay Cells = 24m × 24m
5 × 5 Gameplay Cells = 40m × 40m
```

Only odd square sizes are supported in v1 so the semantic-picked cell is always the center.

For brush size `N`, with `half = (N - 1) / 2`:

```text
xStart = target.x - half
xEnd   = target.x + half
zStart = target.z - half
zEnd   = target.z + half
```

The primary footprint is the inclusive cell rectangle `[xStart..xEnd] × [zStart..zEnd]`.

## 7. Footprint to canonical vertices

A cell footprint maps to the unique vertex rectangle surrounding it:

```text
1×1 cells -> 2×2 vertices -> 4 candidate vertices
3×3 cells -> 4×4 vertices -> 16 candidate vertices
5×5 cells -> 6×6 vertices -> 36 candidate vertices
```

For footprint bounds:

```text
vertexX = xStart .. xEnd + 1
vertexZ = zStart .. zEnd + 1
```

Terraform plans contain only vertices whose desired elevation differs from current elevation. A plan with zero changed vertices is a no-op.

## 8. Primary footprint and influence cells

Because Terrain vertices are shared, editing boundary vertices can change the visible slope of cells immediately outside the selected footprint.

Terraform must expose both concepts:

```text
footprintCells
= cells explicitly selected by the player

influenceCells
= additional cells whose exact Terrain surface can change because they are incident to edited shared vertices
```

`influenceCells` excludes cells already in `footprintCells`.

Influence calculation uses public World spatial facts, especially `incidentCells(vertex)`, and must be deterministic.

The preview must visually distinguish the primary footprint from the influence ring. This prevents the product UI from pretending a shared-vertex Terrain mutation affects only the selected cells.

## 9. Validation

Terraform planning is pure with respect to canonical state: it reads World/Terrain and returns either an immutable valid plan or an immutable invalid preview. It never partially mutates while validating.

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

A footprint is all-or-nothing.

If any selected cell is outside the world:

```text
INVALID -> OUT_OF_WORLD
```

No clipping and no partial execution are allowed.

### 9.2 Region ownership

Every cell in the footprint must belong to a currently unlocked World region:

```text
regionAtCell(cell) ∈ world.mapState.unlockedRegionIds
```

If one cell is locked:

```text
INVALID -> LOCKED_REGION
```

No partial execution is allowed.

### 9.3 Terrain availability

Every required current vertex elevation must be available through Terrain root read contracts. Any unavailable required chunk rejects the plan as:

```text
TERRAIN_UNAVAILABLE
```

### 9.4 Elevation domain

Terraform never silently clamps.

For Raise/Lower, if any desired elevation would fall outside Terrain's frozen logical range:

```text
INVALID -> ELEVATION_LIMIT
```

The entire action is rejected before a Terrain command is issued.

## 10. Immutable preview/plan contract

The v1 domain contract is conceptually:

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

Preview result:

```ts
export type TerraformPreview =
  | {
      readonly status: "valid";
      readonly plan: TerraformPlan;
    }
  | {
      readonly status: "invalid";
      readonly operation: TerraformOperation;
      readonly targetCell?: CellCoord;
      readonly footprintCells: readonly CellCoord[];
      readonly reason: TerraformInvalidReason;
      readonly expectedTerrainRevision: TerrainRevision;
    };
```

Exact names may be split across focused files, but the semantics above are binding.

## 11. Revision safety

Every plan captures:

```text
expectedTerrainRevision
```

Immediately before execution, the app runtime compares:

```text
terrain.read.revision() === plan.expectedTerrainRevision
```

If not equal:

```text
reject stale plan
recompute preview from current Terrain
no mutation from stale plan
```

The revision check and synchronous `TerrainCommands.applyEdits()` call must have no `await` or asynchronous boundary between them.

Terraform does not change Terrain's frozen mutation contract to add CAS semantics.

## 12. Commit semantics

One committed player action has this invariant:

```text
1 valid tap/release
= 1 Terraform action
= at most 1 TerrainCommands.applyEdits() call
= at most 1 Terrain revision increment
= at most 1 Undo entry
```

A zero-edit plan:

```text
no Terrain command required
no Terrain revision increment
no Undo entry
```

Terrain mutation remains the canonical atomicity boundary.

## 13. Execution boundary

The Terraform package produces a domain plan; it does not call Terrain commands.

Execution belongs to `apps/game` composition/runtime:

```text
TerraformPlan
        ↓
verify expected Terrain revision
        ↓
map TerraformVertexMutation[] -> TerrainVertexEdit[]
        ↓
TerrainCommands.applyEdits()
```

On success with `changed=true`:

```text
TerrainThreeProjection.rebuild(changeSet)
TerrainThreeDebugOverlay.rebuild(changeSet)
TerraformThreeOverlay.rebuild(changeSet)
push Terraform Undo entry
refresh Terraform preview/HUD
render
```

Terrain debug presentation must remain correct after Terraform mutations; it cannot be left stale merely because it is diagnostic.

## 14. Live City session access

The live city runtime must receive typed Terrain mutation capability without casting `opaque`.

The `TerrainSessionHandle` direction is:

```ts
export interface TerrainSessionHandle {
  readonly read: TerrainAuthorityRead;
  readonly commands: TerrainCommands;
  captureSnapshot(): TerrainStateSnapshotV1;
}
```

The existing internal opaque handle may remain only if another lifecycle concern still requires it; Terraform runtime must not rely on it.

This is a City Session orchestration contract change, not a Terrain Engine v1 redesign.

## 15. Undo

Terraform Undo is transient live-session history and is not canonical save data.

Frozen limit:

```text
MAX_UNDO_ENTRIES = 100
```

Each successful changed Terraform action records enough previous vertex elevations to restore the immediately prior canonical Terrain state.

Conceptually:

```ts
export interface TerraformUndoEntry {
  readonly inverseEdits: readonly {
    readonly vertex: VertexCoord;
    readonly elevation: LogicalElevation;
  }[];
}
```

### 15.1 Revision-safe history

The undo manager tracks one session-level expected Terrain revision:

```text
undoHistory.expectedTerrainRevision
```

After a successful Terraform commit:

```text
expectedTerrainRevision = receipt.newRevision
push inverse entry
```

Before Undo:

```text
terrain.read.revision() must equal expectedTerrainRevision
```

If another actor changed Terrain:

```text
clear/invalidate Terraform undo history
synchronize expectedTerrainRevision to current Terrain revision
Undo disabled until a new Terraform action is committed
```

After a successful Undo, the undo entry is popped and:

```text
expectedTerrainRevision = undoReceipt.newRevision
```

This permits multiple sequential Undo operations even though each inverse mutation advances Terrain revision.

### 15.2 No Redo in v1

Redo is deferred. After Undo, a new Terraform action simply continues from the current canonical Terrain state.

## 16. Undo and persistence

Undo history is not persisted.

```text
Raise -> Save -> Undo
```

is allowed while the same live session remains active.

But:

```text
Raise -> Save -> Exit -> Load
```

restores the modified Terrain and starts with:

```text
undoHistory = empty
```

`CitySaveV1` does not change for Terraform v1 because canonical modified Terrain is already captured by the Terrain snapshot.

## 17. Input and camera precedence

Existing camera gestures remain authoritative for navigation.

The frozen tap/drag threshold remains the current City Input default:

```text
9 pixels
```

### 17.1 Mouse

```text
hover with no pressed button
-> update Terraform preview

left pointer down
-> show transient candidate preview

left release within tap threshold
-> commit valid Terraform action

left movement beyond tap threshold
-> cancel Terraform candidate
-> camera pan

right drag
-> camera rotate

wheel
-> camera zoom
```

### 17.2 Touch

```text
first touch down
-> transient candidate preview

release within tap threshold
-> commit valid Terraform action

movement beyond tap threshold
-> cancel Terraform candidate
-> camera pan

second touch appears
-> cancel Terraform candidate immediately
-> camera multi-touch pan/zoom/rotate owns the gesture
```

Binding invariant:

```text
Camera navigation gesture always wins over Terraform commit.
```

Terraform never continuously mutates while dragging.

## 18. Input integration shape

The generic City Input controller remains responsible for DOM pointer capture and camera gesture recognition.

It must expose enough normalized pointer lifecycle information for an active tool runtime without creating a second DOM gesture listener stack. The recommended v1 shape is:

```ts
export interface CityToolPointerSink {
  onPointerEvent(event: NormalizedPointerEvent): void;
}
```

`createCityInputController` forwards the same normalized down/move/up/cancel stream to the optional tool sink and retains `onTap` as the only commit signal.

The Terraform runtime may maintain transient candidate/hover state from these normalized events, but commit occurs only through the existing tap recognition path. This guarantees that a gesture promoted to camera pan/multitouch does not accidentally commit Terraform.

## 19. Terraform Three.js overlay

Terrain Debug Grid remains diagnostic-only. Terraform owns a separate gameplay overlay.

Conceptual interface:

```ts
export interface TerraformThreeOverlay {
  readonly root: Group;
  setActive(active: boolean): void;
  setPreview(preview: TerraformPreview | undefined): void;
  rebuild(changeSet: TerrainChangeSet): void;
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

Terraform overlay geometry must conform to Terrain public authority reads.

It must not reconstruct canonical height from rendered Terrain meshes.

Gameplay grid boundaries are rendered from exact canonical Terrain vertex elevations along each 8m cell boundary.

After Terrain mutation, only affected overlay chunks are rebuilt.

## 21. Overlay chunking and performance model

Terraform grid batching uses World logical chunks:

```text
logical chunk = 32 × 32 cells
production map = 16 × 16 logical chunks = 256 maximum chunks
```

The overlay builds/renderers only for currently editable/unlocked land while Terraform is active.

Terrain mutation `touchingLogicalChunks[]` is the initial localized invalidation source for overlay rebuild.

The implementation must not create one DOM element or one independent Three.js object per Gameplay Cell.

## 22. Tool session state

Terraform tool session state is transient:

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

Closing/deactivating the Terraform tool:

```text
clears preview
clears flattenTarget
retains undo history while the same LiveCitySession remains alive
```

A newly created, loaded, or resumed LiveCitySession starts with empty Terraform undo history.

## 23. UI

Terraform v1 adds a mobile-first tool tray independent from Terrain Debug controls.

Required controls:

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

Undo is disabled when history is empty or invalidated.

Strength controls are disabled/visually irrelevant while Flatten is active because Flatten uses an absolute reference level.

UI strings do not define domain policy; the Terraform package exposes typed semantics and the app UI maps them to labels.

## 24. Natural World compatibility

Terraform v1 is Terrain-only at canonical mutation time.

It does not require Ground, Water, Environment, or Vegetation runtime implementation.

When future natural-world systems exist:

```text
Terraform intent
-> explicit cross-system orchestration
-> Terrain command
-> downstream owner reconciliation
```

must follow Natural World Architecture v1. Terrain must not gain Water/Ground/Vegetation semantics merely to support Terraform.

## 25. Save/load acceptance

Required canonical persistence scenario:

```text
New City
↓
enter Terraform
↓
valid Raise/Lower/Flatten edit
↓
Save
↓
Exit
↓
Load
↓
exact modified Terrain restored
```

The restored session starts with no Terraform undo history.

No separate Terraform snapshot is added to `CitySaveV1`.

## 26. Lifecycle and resource requirements

Repeated Terraform activation/deactivation and city enter/exit must not leak:

```text
DOM event listeners
pointer capture
requestAnimationFrame work
Three.js geometries
Three.js materials
Terraform overlay roots
stale previews
undo history across LiveCitySession boundaries
```

`dispose()` must be idempotent for Terraform presentation/runtime resources.

## 27. Performance measurement

Before Production Closure, establish measurement baselines for at least:

```text
1×1 Raise plan
3×3 Raise plan
5×5 Raise plan
Flatten plan
commit + Terrain localized projection rebuild
Terraform overlay localized rebuild
Undo
Terraform overlay initial construction for unlocked land
browser interaction-to-visible-update latency
CPU-side Terraform geometry memory
Three.js geometry/material/object counts
```

Initial baseline is measurement-first. Do not invent pass/fail thresholds without observed evidence and an explicitly adopted target.

## 28. Release gates

Terraform v1 implementation is divided into:

```text
TF0 Product/Architecture Freeze
TF1 Pure Terraform Core
TF2 Live Terrain Mutation + Undo Integration
TF3 Terraform Three.js Presentation
TF4 Mouse + Touch Interaction
TF5 Production UI
TF6 Persistence + Browser E2E
TF7 Hardening + Production Closure
```

### TF1 gate

Must prove:

```text
footprint mapping
vertex mapping
Raise/Lower/Flatten
nearest canonical Flatten reference selection
world boundary rejection
locked-region rejection
Terrain unavailable rejection
elevation-limit rejection
influence-cell calculation
no-op plan
expected Terrain revision capture
pure deterministic planning
```

### TF2 gate

Must prove:

```text
TerrainSessionHandle exposes typed commands
one action -> one Terrain transaction
stale plan rejected before command
projection/debug/overlay localized rebuild
one changed action -> one undo entry
multiple sequential Undo works
external Terrain revision invalidates undo history
```

### TF3 gate

Must prove:

```text
Terraform grid is separate from Terrain Debug
exact surface-conforming geometry
valid/invalid/influence/reference presentation states
localized logical-chunk rebuild
resource disposal
```

### TF4 gate

Must prove:

```text
mouse hover preview
mouse tap commit
mouse drag camera-only
right-drag rotate
wheel zoom
touch tap commit
touch drag camera-only
second finger cancels candidate
pinch/rotate never commits Terraform
```

### TF5 gate

Must prove:

```text
all required controls
correct defaults
Flatten target/repick behavior
Undo enablement
mobile layout
keyboard/accessibility basics for controls
```

### TF6 gate

Must prove:

```text
Terraform edit -> Save -> Exit -> Load -> exact Terrain restored
Load/Resume -> undo history empty
existing city lifecycle remains valid
```

### TF7 gate

Must prove:

```text
full repository verify
architecture check
browser E2E
lifecycle soak
performance baseline
no resource/listener leak
canonical documentation
post-merge verification
```

## 29. Binding invariants

```text
Terrain Engine v1 remains production closed.
Terraform never owns canonical elevation.
Player targeting is Gameplay Cell based.
Terrain commit remains canonical vertex based.
Brushes are exactly 1×1, 3×3, 5×5 cells in v1.
Strengths are exactly Fine 0.25m, Normal 1m, Strong 4m; Normal is default.
Flatten uses a canonical reference LogicalElevation, never an arbitrary interpolated height.
Primary footprint and shared-vertex influence cells are distinct product concepts.
Footprints are all-or-nothing at world and unlocked-region boundaries.
Invalid elevation is rejected, never silently clamped.
Terraform system reads World/Terrain root surfaces only and never imports Terrain commands/composition.
apps/game executes Terrain commands from validated Terraform plans.
One valid changed player action creates at most one Terrain transaction and one Undo entry.
Preview plans are revision-bound and stale plans never commit.
Undo history is transient, capped at 100, revision-safe, and not persisted.
Redo is deferred.
Camera gestures always win over Terraform commit.
Terraform never continuously mutates while dragging.
Terraform Grid Overlay is gameplay presentation and is separate from Terrain Debug Grid.
Derived overlay state is never canonical persistence data.
Terraform v1 does not require Ground/Water/Environment/Vegetation runtime implementation.
CitySaveV1 remains unchanged; current Terrain snapshot persists Terraform edits.
TF1-TF7 must close independently with tests before Terraform v1 Production Closure.
```
