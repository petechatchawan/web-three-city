# Road Network Foundation v0.1 — Design Specification

**Status:** Accepted design; written specification pending owner review  
**Date:** 2026-07-29  
**Repository baseline:** `master@2707d40b3a0dfd563c8b183a8422fa1c013e5bf1`  
**Audience:** Web Three City maintainers and implementation agents  
**Target team size:** 3–5 developers

## 1. Decision

Road Network Foundation v0.1 delivers the first authoritative, persistent, and renderable Road system for Web Three City.

The milestone is intentionally limited to a usable foundation:

- build and bulldoze Roads on the square cell grid;
- derive cardinal connectivity automatically;
- render isolated pieces, end caps, straights, corners, T-junctions, four-way intersections, and straight ramp pieces;
- persist Roads together with Terrain while loading legacy Terrain-only saves;
- reject Terraform transactions that touch occupied Road cells;
- rebuild only Road chunks affected by a Road mutation;
- support deterministic automated verification and owner review through the existing CI-gated Vercel Preview flow.

The milestone does **not** add traffic simulation, pathfinding, vehicles, zoning, economy, bridges, tunnels, diagonal Roads, one-way Roads, lane semantics, or final art.

## 2. Product behavior

### 2.1 Tools

The Game adds two application-level tool modes:

- `road-build`
- `road-bulldoze`

The existing Terrain-owned `WorldToolMode` remains unchanged. The Game defines an application union equivalent to:

```ts
type GameToolMode = WorldToolMode | 'road-build' | 'road-bulldoze';
```

This prevents `terrain-core` from acquiring Road concepts.

### 2.2 Pointer interaction

Road tools use the existing primary-pointer and gesture-ownership rules.

- A tap targets one cell.
- A drag accumulates a cardinally continuous supercover cell line.
- Preview is shown during the active stroke.
- The complete stroke commits once on pointer-up.
- Pointer cancellation, browser blur, WebGL context loss, disposal, or second-touch camera takeover commits nothing.
- Build and Bulldoze are transaction-based and all-or-nothing.

Build ignores cells already occupied by the requested Road definition. Bulldoze ignores empty cells. A stroke that produces no actual mutation is invalid and does not create an Undo entry.

### 2.3 Preview

Preview evaluates the final state of the complete stroke, including existing Roads and every Road cell proposed by the stroke. Validation must not process cells as independent sequential edits because cells within one stroke may establish or invalidate each other’s final connectivity.

The Preview presents:

- every cell in the proposed mutation footprint;
- valid or invalid status for the transaction as a whole;
- the final derived topology that would exist after commit;
- no committed Road mesh mutation before pointer-up.

Committed Roads and Preview Roads use separate Three.js objects and materials.

## 3. Package architecture

Two packages are added:

```text
packages/road-core
packages/road-three
```

### 3.1 `@web-three-city/road-core`

`road-core` is pure TypeScript. It must not import Three.js, DOM APIs, browser input code, Game UI code, or application composition code.

Responsibilities:

- immutable Road state;
- Road definitions;
- placement environment contracts;
- Build and Bulldoze planning;
- terrain, water, occupancy, and topology validation;
- cardinal connectivity derivation;
- Road mutation commit and stale-plan fencing;
- Road mutation receipts;
- Road-owned dirty-chunk derivation;
- Road serialization and validation;
- deterministic queries used by rendering and tests.

Allowed dependencies:

- `@web-three-city/world-core`;
- read-only Terrain contracts and shared chunk-coordinate helpers from `@web-three-city/terrain-core`.

Water eligibility is supplied through a read-only placement-environment contract so `road-core` does not own Water derivation or import `water-core`.

### 3.2 `@web-three-city/road-three`

`road-three` owns presentation only.

Responsibilities:

- deterministic procedural Road mesh generation;
- Road chunk presentation;
- atomic dirty-chunk replacement;
- Road Preview presentation;
- context-restoration rebuilds;
- geometry metrics and deterministic evidence hooks.

Dependencies:

- `@web-three-city/road-core`;
- `@web-three-city/world-core`;
- Three.js.

`road-three` never owns or mutates authoritative Road state.

### 3.3 Game composition

The Game composes Terrain, Water, Roads, UI, input, Undo, and Save/Load.

The dependency direction is:

```text
world-core
   ├── terrain-core ── read-only surface/chunk contracts ──▶ road-core
   ├── water-core
   ├── terrain-three
   ├── water-three
   └── road-three

apps/game composes all domain and presentation packages.
```

Terrain does not import Roads. Water does not import Roads. Roads do not mutate Terrain or Water.

## 4. Authoritative Road state

### 4.1 Stored state

`RoadSnapshot` stores one private definition-code byte per map cell. Its public contract does not expose the mutable backing buffer:

```ts
interface RoadSnapshot {
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  definitionCodeAt(cell: CellCoord): RoadDefinitionCode;
  copyDefinitionCodes(): Uint8Array;
}
```

Definition codes are:

- `0`: empty;
- `1`: `basic-road`.

Unknown definition codes are invalid.

Constructors defensively copy input buffers. `copyDefinitionCodes()` always returns a new buffer. No query returns mutable internal storage.

### 4.2 Road definitions

v0.1 ships one definition:

```ts
interface RoadDefinition {
  readonly id: 'basic-road';
  readonly code: 1;
  readonly width: 0.64;
  readonly surfaceOffset: 0.02;
}
```

Measurements are in world units against the existing `1.0` cell size. The definition boundary exists now so later Road types do not require replacing the authoritative state model. v0.1 does not implement multiple Road types, upgrades, lanes, costs, or one-way semantics.

### 4.3 Derived state

Connectivity and surface geometry are derived and are never authoritative or serialized.

A Road cell view contains:

```ts
interface RoadCellView {
  readonly cell: CellCoord;
  readonly definition: RoadDefinition;
  readonly connections: RoadConnectionMask;
  readonly surface: TerrainCellSurfaceProfile;
}
```

`RoadConnectionMask` is a four-bit mask:

- North;
- East;
- South;
- West.

Connectivity is recomputed from final occupancy and placement compatibility after every mutation and after load.

## 5. Read-only placement environment

Roads own Road placement policy. Terrain and Water expose read-only facts.

The planning API receives an immutable environment equivalent to:

```ts
interface RoadPlacementEnvironment {
  readonly terrainRevision: number;
  readonly waterSourceTerrainRevision: number;
  surfaceAt(cell: CellCoord): TerrainCellSurfaceProfile;
  isDry(cell: CellCoord): boolean;
}
```

`TerrainCellSurfaceProfile` includes the authoritative four corner levels, classified Terrain shape, minimum level, maximum level, and slope axis.

A cell is dry when Water derivation contains no positive-area wet fragment in that cell. Contact only along a zero-area shoreline boundary is permitted. Road eligibility is based on authoritative Water geometry, not the visual width of the shoreline presentation ribbon.

The environment must describe one coherent world revision:

```text
waterSourceTerrainRevision === terrainRevision
```

Otherwise planning fails as inconsistent world state.

## 6. Terrain compatibility policy

Road placement accepts only:

- `flat`;
- `ramp-north`;
- `ramp-south`;
- `ramp-east`;
- `ramp-west`.

A supported ramp has an exact one-level range under the existing Terrain classifier.

Road placement rejects:

- single-corner-high shapes;
- single-corner-low shapes;
- diagonal ridge;
- diagonal valley;
- saddle or twist;
- severe delta;
- any wet cell;
- out-of-bounds cells.

### 6.1 Flat cells

Flat cells support every cardinal topology in v0.1:

- isolated;
- one-connection end cap;
- straight;
- corner;
- T-junction;
- four-way intersection.

### 6.2 Ramp cells

Ramp cells support only a complete straight connection along the slope axis:

- North/South ramps require exactly `North | South`;
- East/West ramps require exactly `East | West`.

Ramp cells reject:

- isolated pieces;
- end caps;
- corners;
- T-junctions;
- four-way intersections;
- straight Roads perpendicular to the slope axis.

This rule is evaluated against final transaction occupancy. A valid Build stroke may therefore create the Ramp cell and its required aligned neighbors in one transaction.

## 7. Connectivity

Connectivity uses a non-iterative deterministic rule:

1. For each occupied cell in the final proposed state, derive a raw mask from all occupied cardinal neighbors.
2. The shared Terrain lattice supplies the exact shared-edge heights; no Road-specific elevation cache is stored.
3. Validate each occupied cell’s raw mask against its Flat or Ramp placement policy.
4. Do not remove or prune individual connections to make an invalid cell valid. Any invalid affected cell rejects the complete transaction.

This makes connectivity independent of Build stroke ordering and prevents topology from changing according to validation iteration order.

## 8. Mutation planning and commit

### 8.1 Input

```ts
interface RoadStrokeInput {
  readonly operation: 'build' | 'bulldoze';
  readonly definitionId: 'basic-road';
  readonly cells: readonly CellCoord[];
}
```

### 8.2 Invalid reasons

```ts
type RoadInvalidReason =
  | 'road:invalid-state'
  | 'road:invalid-environment'
  | 'road:invalid-cell'
  | 'road:unknown-definition'
  | 'road:no-change'
  | 'road:unsupported-terrain'
  | 'road:wet-cell'
  | 'road:invalid-ramp-topology';
```

Stale revisions are commit-time contract errors rather than Preview invalid reasons.

### 8.3 Plan

```ts
interface RoadMutationPlan {
  readonly operation: 'build' | 'bulldoze';
  readonly baseRoadRevision: number;
  readonly baseTerrainRevision: number;
  readonly baseWaterSourceTerrainRevision: number;
  readonly requestedCells: readonly CellCoord[];
  readonly addedCells: readonly CellCoord[];
  readonly removedCells: readonly CellCoord[];
  readonly topologyChangedCells: readonly CellCoord[];
  readonly proposedDefinitionCodes: Uint8Array;
  readonly dirtyChunks: readonly ChunkCoord[];
  readonly valid: boolean;
  readonly invalidReason: RoadInvalidReason | null;
}
```

The proposed buffer is owned by the immutable plan and is never the snapshot’s backing buffer.

Planning pipeline:

```text
validate the complete base Road snapshot
→ normalize and deduplicate requested cells
→ apply Build or Bulldoze to a copied occupancy buffer
→ derive raw connectivity from final occupancy
→ validate Terrain and Water eligibility
→ validate final Ramp/Flat topology
→ derive changed cells and N/E/S/W topology neighbors
→ derive Road-owned dirty chunks
→ return immutable plan
```

The plan is invalid when:

- input or base Road state is malformed;
- any requested cell is outside the map;
- Terrain and Water revisions are incoherent;
- no effective occupancy mutation exists;
- an unknown Road definition is requested;
- any final occupied affected cell violates Terrain or Water policy;
- any final Ramp connection mask violates the slope-axis rule.

The affected validation neighborhood consists of all added or removed cells plus their cardinal neighbors. Valid `RoadSnapshot` construction and atomic load guarantee that unaffected occupied cells already satisfy invariants.

### 8.4 Commit

The commit API receives current Road state and the current read-only placement environment:

```ts
commitRoadMutation(
  roads: RoadSnapshot,
  plan: RoadMutationPlan,
  environment: RoadPlacementEnvironment,
  config: WorldConfig,
): RoadCommitResult;
```

It rejects:

- an invalid plan;
- a stale Road revision;
- a stale Terrain revision;
- a stale Water source Terrain revision;
- incoherent current Terrain and Water revisions;
- a proposed buffer inconsistent with the plan’s changed-cell counts;
- malformed or unknown Road definition codes.

Successful commit increments Road revision exactly once and returns an immutable snapshot and receipt.

### 8.5 Receipt

```ts
interface RoadMutationReceipt {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly addedCellCount: number;
  readonly removedCellCount: number;
  readonly topologyChangedCellCount: number;
  readonly dirtyChunks: readonly ChunkCoord[];
}
```

## 9. Road-owned dirty chunks

Roads own their dirty-chunk lifecycle while reusing the project’s existing chunk-coordinate contract.

For every added, removed, or topology-changed cell, the Road mutation invalidates:

- the cell’s owning Road chunk;
- the owning chunks of cardinal neighbors whose connection mask changed.

A connection that crosses a chunk boundary invalidates both participating chunks.

Dirty chunks are deduplicated and returned in deterministic `z`, then `x` order.

v0.1 does not introduce a shared Terrain/Water/Road render scheduler. Each presentation subsystem retains its own rebuild lifecycle and budget.

## 10. Rendering

### 10.1 Procedural geometry

v0.1 uses deterministic procedural geometry, not external Road models.

Supported render shapes:

- isolated;
- North/East/South/West end caps;
- North–South and East–West straights;
- four corners;
- four T-junction rotations;
- four-way intersection;
- North–South ramp straight;
- East–West ramp straight.

Flat Road geometry sits at the authoritative flat cell height plus `0.02` world units.

Ramp Road geometry follows the authoritative Terrain corner heights along the supported slope axis plus the same fixed offset. It does not flatten, carve, or otherwise mutate Terrain.

### 10.2 Chunk presentation

`RoadChunkPresentation` maintains one committed presentation root per Road chunk.

Rebuild behavior:

1. build replacement geometry off-scene;
2. validate finite positions, indices, bounds, and material groups;
3. swap the replacement root atomically;
4. dispose the previous root only after successful replacement.

A failed rebuild leaves the previous committed Road mesh visible and reports a world-update failure to Game composition.

### 10.3 Preview presentation

Preview geometry uses the same topology derivation as committed geometry. It may use simplified materials but must preserve final shape and Ramp orientation.

Preview is cleared on commit, cancellation, tool change, load, context loss, and disposal.

## 11. Terraform constraint

Terraform remains Terrain-owned and does not import Roads.

After `terrain-core` creates a `TerraformPlan`, Game composition applies a Road occupancy guard:

```text
TerraformPlan.affectedCells ∩ occupied Road cells
```

When the intersection is non-empty:

- the complete Terraform transaction is invalid;
- the complete Preview is shown invalid;
- Terrain is unchanged;
- Roads are unchanged;
- Water is not rebuilt;
- no Terraform Undo entry is created.

The integration-level rejection reason is `terraform:road-occupied`. It is not added to Terrain lattice validation.

After a successful Road Bulldoze removes the blocking Road cells, a later Terraform transaction may modify those cells normally.

## 12. Undo

v0.1 keeps one visible Undo command and one level of history.

Game composition owns a tagged world Undo slot:

```ts
type WorldUndoEntry =
  | { readonly kind: 'terraform'; readonly snapshot: TerrainSnapshot }
  | { readonly kind: 'road'; readonly snapshot: RoadSnapshot };
```

Rules:

- a successful Road Build or Bulldoze replaces the previous Undo entry with a Road entry;
- a successful Terraform commit replaces the previous Undo entry with a Terraform entry;
- Undo consumes the entry once;
- Load clears Undo;
- failed and no-op mutations do not change Undo;
- Road Undo changes Roads only and does not rebuild Water;
- Terraform Undo changes Terrain and performs exactly one Water update under the existing Terraform contract.

Because Terraform cannot affect occupied Road cells, a successful Terraform commit cannot invalidate the current Road snapshot. Multi-level Undo and Redo are excluded.

## 13. Save and load

### 13.1 Road save

```ts
interface RoadSaveV1 {
  readonly schemaVersion: 1;
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  readonly definitionCodes: string;
}
```

`definitionCodes` is the Base64 encoding of the cell-definition byte array.

Connections and Terrain surface profiles are not serialized.

### 13.2 World envelope

```ts
interface WorldSaveV1 {
  readonly kind: 'world-save';
  readonly schemaVersion: 1;
  readonly terrain: TerrainSaveV1;
  readonly roads: RoadSaveV1;
}
```

The world-envelope codec lives in Game integration for v0.1 and delegates to Terrain and Road domain codecs. No new generic persistence package is introduced.

The Game saves `WorldSaveV1` after this milestone.

### 13.3 Backward compatibility

The decoder accepts:

1. `WorldSaveV1`;
2. the legacy top-level `TerrainSaveV1` currently stored by the Game.

A valid legacy Terrain save produces an empty Road snapshot with revision `0`.

### 13.4 Atomic load

Load order:

```text
decode and validate Terrain
→ derive Water from decoded Terrain
→ decode Road occupancy
→ derive Road connectivity and surface views
→ validate every occupied Road cell against decoded Terrain and Water
→ atomically replace committed Terrain, Water, and Road state
```

Any failure leaves the current world unchanged.

Road load rejects:

- wrong dimensions;
- malformed Base64;
- wrong byte length;
- unknown definition codes;
- invalid revision;
- Roads on unsupported Terrain;
- Roads in wet cells;
- invalid Ramp topology.

## 14. Lifecycle and diagnostics

Roads participate in:

- initial Game boot;
- Save/Load;
- WebGL context restoration;
- renderer disposal;
- responsive desktop and mobile controls;
- exact-head browser evidence.

Game diagnostics expose at least:

- committed Road revision;
- occupied Road cell count;
- last Road mutation counts;
- Road dirty-chunk count;
- Road chunk rebuild count;
- active Road Preview validity and cell count;
- current Undo kind;
- Terrain, Water source, and Road planning revisions.

Diagnostics are read-only and are not persisted.

## 15. Terrain Lab fixtures

The existing Terrain Lab is extended rather than creating a new Road app.

Required fixtures:

- isolated and four end-cap rotations;
- both straight orientations;
- four corners;
- four T-junction rotations;
- four-way intersection;
- North–South Ramp in both elevation directions;
- East–West Ramp in both elevation directions;
- invalid perpendicular Ramp Road;
- invalid Ramp corner and junction;
- invalid wet-cell placement;
- chunk-boundary connection and dirty rebuild evidence.

## 16. Error handling

Domain planners return typed invalid reasons. Commit functions throw typed contract errors only for programmer misuse, stale plans, or corrupted proposed state.

Application behavior:

- invalid Preview remains interactive and commits nothing;
- stale plan is discarded and Preview is recomputed from current state;
- failed Road presentation replacement preserves the previous committed Road mesh;
- failed atomic world load preserves the previous Terrain, Water, and Roads;
- UI messages remain short and actionable: `Road placement invalid`, `Roads removed`, `Road update failed`, or `Invalid save`.

## 17. Verification strategy

### 17.1 `road-core` tests

- immutable snapshot construction and defensive copying;
- Build and Bulldoze no-op behavior;
- deterministic input normalization;
- every Flat topology;
- every Ramp orientation and allowed straight mask;
- rejection of Ramp isolated/end/corner/T/four-way/perpendicular masks;
- rejection of unsupported Terrain shapes;
- rejection of wet cells;
- stale Road/Terrain/Water fencing;
- transaction atomicity;
- topology neighbor recomputation;
- chunk-boundary dirty invalidation;
- deterministic receipt ordering;
- RoadSaveV1 round trip and malformed-input rejection;
- legacy Terrain-only save migration to empty Roads;
- atomic world-load validation.

### 17.2 `road-three` tests

- deterministic vertices, indices, bounds, and hashes for every supported shape;
- exact edge-port alignment between connected pieces;
- Ramp mesh conformance to Terrain corner heights;
- finite geometry and valid index ranges;
- atomic chunk replacement and disposal;
- Preview/committed object separation;
- context-restoration rebuild.

### 17.3 Game and browser tests

- desktop tap Build and Bulldoze;
- desktop drag supercover Build and Bulldoze;
- mobile primary-touch Build and Bulldoze;
- second-touch camera takeover cancels Road commit;
- final-stroke Preview topology matches committed topology;
- Flat straight, corner, T, and four-way construction;
- aligned Ramp construction;
- invalid Ramp junction rejection;
- wet-cell rejection;
- Terraform brush touching one Road cell rejects the complete transaction;
- rejected Terraform does not rebuild Water and creates no Undo entry;
- Road mutation does not rebuild Water;
- single visible Undo follows latest successful world mutation;
- Save/Reload restores Roads;
- legacy Terrain-only save loads with empty Roads;
- WebGL context restoration restores committed Roads and clears Preview;
- Game and Terrain Lab remain deployable at `/` and `/terrain-lab/`.

### 17.4 Merge gates

- format, lint, typecheck, and provenance checks;
- unit, geometry, serialization, coverage, and deployment contracts;
- recursive workspace build;
- Vercel Build Output API verification;
- full Chromium interaction and visual evidence;
- SonarQube Quality Gate;
- protected exact-head Vercel Preview;
- owner visual and physical-feel approval;
- explicit merge authorization.

## 18. Owner acceptance checklist

The owner must be able to verify:

1. Build a Flat straight Road by tap and drag.
2. Form a corner, T-junction, and four-way intersection automatically.
3. Build a straight Road up or down a supported Ramp axis.
4. See perpendicular Roads and junctions rejected on Ramps.
5. Bulldoze a Road cell and see neighboring topology update correctly.
6. See Road connectivity remain correct across a chunk boundary.
7. See a Terraform brush touching any Road cell rejected as one transaction.
8. Bulldoze the Road and then Terraform the released cell.
9. Save, reload, and recover identical Road occupancy and topology.
10. Load a legacy Terrain-only save with no Roads and no data loss.
11. Use Road tools on desktop and mobile without breaking camera takeover gestures.

## 19. Explicit exclusions

Road Network Foundation v0.1 does not include:

- traffic graph or route finding;
- vehicles or pedestrians;
- zoning, building frontage, or service access;
- construction cost, maintenance, or economy;
- bridges, tunnels, retaining walls, or overpasses;
- one-way Roads, lane counts, lane markings, traffic lights, or signs;
- diagonal, curved, freeform, or roundabout Roads;
- automatic Terrain grading or Road-driven Terraform;
- Road placement over positive-area Water;
- Road types beyond `basic-road`;
- multi-level Undo or Redo;
- a shared cross-subsystem dirty scheduler;
- WebGPU;
- final Road art, textures, props, audio, particles, or polish.

## 20. Implementation boundary

This document authorizes design and planning only. Production implementation begins only after:

1. the written specification is reviewed and accepted;
2. a task-by-task TDD implementation plan is written and reviewed;
3. execution mode and merge authority are explicitly confirmed.
