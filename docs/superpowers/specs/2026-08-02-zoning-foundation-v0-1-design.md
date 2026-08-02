# Zoning Foundation v0.1 — Design Specification

**Status:** Written specification pending owner review  
**Date:** 2026-08-02  
**Repository baseline:** `master@1d330d1103051d1dfdc10b67e3548e679cbb682b`  
**Audience:** Web Three City maintainers and implementation agents  
**Target team size:** 3–5 developers

## 1. Decision

Zoning Foundation v0.1 delivers the first authoritative, persistent, editable gameplay layer that composes Terrain, Water, Roads, world interaction, Undo, and Save/Load.

The milestone adds:

- Residential, Commercial, and Industrial Zone definitions;
- Paint and Remove tools;
- reversible pointer strokes with exact reverse-tail removal;
- valid and invalid cell-scoped Preview;
- deterministic Road-access validation with a maximum depth of three cells;
- rejection of Water, Road cells, unsupported Terrain, and conflicting Zone occupancy;
- Terraform rejection when a transaction affects any zoned cell;
- Road mutation guards that preserve Zone overlap and Road-access invariants;
- tagged one-level world Undo;
- `WorldSaveV2` with migration from legacy Terrain-only saves and `WorldSaveV1`;
- committed Zone overlay, HUD counts, browser evidence, and exact-head `verify:full` acceptance.

The milestone does **not** add Buildings, automatic building growth, Population, Demand, Economy, taxes, Utilities, Traffic, pathfinding, Mixed-use zoning, costs, demolition refunds, desirability, pollution, land value, or final art.

## 2. Product behavior

### 2.1 Zone definitions

v0.1 ships exactly three authoritative Zone definitions:

```ts
type ZoneDefinitionId =
  | 'residential'
  | 'commercial'
  | 'industrial';

interface ZoneDefinition {
  readonly id: ZoneDefinitionId;
  readonly code: 1 | 2 | 3;
  readonly label: 'Residential' | 'Commercial' | 'Industrial';
}
```

Definition codes are stable serialized identifiers:

- `0`: empty;
- `1`: Residential;
- `2`: Commercial;
- `3`: Industrial.

Unknown codes and duplicate definition registrations are invalid.

### 2.2 Application tool modes

The Game adds four application-level tool modes:

```ts
type ZoneToolMode =
  | 'zone-residential'
  | 'zone-commercial'
  | 'zone-industrial'
  | 'zone-remove';

type GameToolMode = WorldToolMode | RoadToolMode | ZoneToolMode;
```

`terrain-core` and `road-core` do not acquire Zone tool vocabulary. Tool ownership and cross-domain routing remain in `apps/game`.

### 2.3 Pointer interaction

Zone tools follow the established operation-aware input lifecycle.

- A tap targets one cell.
- A drag rasterizes a cardinally continuous cell trace.
- The active trace is ordered, not set-only.
- Moving exactly back to the previous trace cell removes the abandoned tail.
- Same-tail pointer jitter is ignored.
- Fast pointer movement is processed cell-by-cell through the shared line rasterizer.
- Reverse-then-branch continues from the retained tail without restoring the abandoned branch.
- Paint and Remove use identical trace semantics.
- Preview is replaced atomically after every effective trace change.
- The retained transaction commits once on pointer-up.
- Pointer cancellation, second-touch camera takeover, browser blur, WebGL context loss, disposal, load, or tool change commits nothing.

v0.1 uses a one-cell-wide stroke only. Rectangular zoning, flood fill, configurable brush sizes, and lasso tools are excluded.

### 2.4 Paint semantics

Paint applies one selected Zone definition to the complete retained stroke.

- Empty eligible cells become the selected Zone type.
- Cells already containing the selected Zone type are ignored.
- A cell containing a different Zone type is a conflict and rejects the complete transaction.
- A transaction with no effective changes is invalid and creates no Undo entry.
- Paint never silently replaces a different Zone type; the user must Remove it first.

### 2.5 Remove semantics

Remove clears Zone occupancy from the complete retained stroke.

- Zoned cells are removed regardless of their current Road access or current Terrain eligibility.
- Empty cells are ignored.
- A transaction with no effective changes is invalid and creates no Undo entry.
- Remove remains available as the recovery path if a future schema or policy migration marks an existing Zone invalid.

Remove validates state integrity and coordinates but does not require Road access, dry Terrain, or current placement eligibility for the cells being removed.

## 3. Package architecture

Two packages are added:

```text
packages/zone-core
packages/zone-three
```

### 3.1 `@web-three-city/zone-core`

`zone-core` is pure TypeScript. It must not import Three.js, DOM APIs, browser input code, Game UI code, `road-core`, or application composition code.

Responsibilities:

- immutable Zone state;
- Zone definitions and stable definition codes;
- Paint and Remove mutation planning;
- Zone state validation;
- placement-environment contracts;
- stale revision fencing;
- mutation commit and receipts;
- deterministic dirty-chunk derivation;
- `ZoneSaveV1` serialization and decoding;
- deterministic queries used by Game composition, rendering, and tests.

Allowed dependencies:

- `@web-three-city/world-core`;
- read-only Terrain surface and chunk-coordinate contracts from `@web-three-city/terrain-core`.

Road, Water, and non-Zone occupancy facts are supplied through an immutable placement environment owned by Game composition.

### 3.2 `@web-three-city/zone-three`

`zone-three` owns presentation only.

Responsibilities:

- deterministic committed Zone overlay geometry;
- one committed presentation root per Zone chunk;
- atomic dirty-chunk replacement;
- valid Paint Preview;
- invalid Preview markers;
- Remove Preview;
- context-restoration rebuilds;
- deterministic bounds, counts, and evidence hooks.

Dependencies:

- `@web-three-city/zone-core`;
- `@web-three-city/world-core`;
- read-only Terrain surface contracts or a Game-provided surface adapter;
- Three.js.

`zone-three` never owns or mutates authoritative Zone state.

### 3.3 `apps/game`

Game composition owns all cross-system policy and lifecycle integration:

- `ZoneToolMode` and tool routing;
- shared reversible cell-trace utility used by Road and Zone controllers;
- immutable `ZonePlacementEnvironment` construction;
- committed Road queries and Road-access evaluation;
- Road–Zone mutation guards;
- Terraform–Zone guarding;
- tagged world Undo;
- `WorldSaveV2` composition and migration;
- committed and Preview presentation routing;
- HUD counts, reasons, recovery, and accessible controls;
- browser diagnostics and evidence.

### 3.4 Dependency direction

```text
world-core
   ├── terrain-core
   ├── water-core
   ├── road-core
   ├── zone-core
   ├── terrain-three
   ├── water-three
   ├── road-three
   └── zone-three

apps/game composes every domain and presentation package.
```

Locked boundaries:

- Terrain does not import Roads or Zones.
- Water does not import Roads or Zones.
- Roads do not import Zones.
- Zones do not import Roads or Water.
- Presentation packages do not mutate authoritative state.
- Cross-domain mutation policy remains application-owned.

## 4. Authoritative Zone state

### 4.1 Snapshot

`ZoneSnapshot` stores one private definition-code byte per map cell:

```ts
interface ZoneSnapshot {
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  definitionCodeAt(cell: CellCoord): ZoneDefinitionCode;
  copyDefinitionCodes(): Uint8Array;
}
```

Constructors defensively copy input buffers. `copyDefinitionCodes()` always returns a new buffer. No public query exposes mutable backing storage.

Snapshot invariants:

- dimensions equal the canonical world dimensions;
- revision is a non-negative safe integer;
- buffer length equals `width * height`;
- every code is `0`, `1`, `2`, or `3`;
- no derived Road-access, Terrain, presentation, demand, or building state is stored.

### 4.2 Derived counts

Counts are derived from the authoritative code buffer:

```ts
interface ZoneCounts {
  readonly residential: number;
  readonly commercial: number;
  readonly industrial: number;
  readonly total: number;
}
```

Counts are not serialized independently and cannot diverge from the snapshot.

## 5. Placement environment

Paint planning receives one immutable, coherent environment:

```ts
interface ZonePlacementEnvironment {
  readonly terrainRevision: number;
  readonly waterSourceTerrainRevision: number;
  readonly roadRevision: number;
  readonly occupancyRevision: number;
  surfaceAt(cell: CellCoord): TerrainCellSurfaceProfile;
  isDry(cell: CellCoord): boolean;
  isRoadOccupied(cell: CellCoord): boolean;
  roadAccessAt(cell: CellCoord): ZoneRoadAccess | null;
  isBlockedByNonZoneOccupancy(cell: CellCoord): boolean;
}
```

`occupancyRevision` is Game-owned. In v0.1 it fences the composed Road and other registered world-cell occupancy view. Zone occupancy remains authoritative in `ZoneSnapshot` and is validated separately.

The environment must satisfy:

```text
waterSourceTerrainRevision === terrainRevision
```

All revision fields captured by a plan must still match at commit time.

The environment is constructed from defensive snapshots or copied read models. It must not observe mutable live state changing during one stroke.

## 6. Terrain and Water eligibility

Paint accepts only dry, flat Terrain cells.

Accepted Terrain shape:

- `flat`.

Rejected Terrain shapes include every Ramp and non-flat classifier result:

- `ramp-north`;
- `ramp-south`;
- `ramp-east`;
- `ramp-west`;
- single-corner-high;
- single-corner-low;
- diagonal ridge;
- diagonal valley;
- saddle or twist;
- severe delta;
- any later non-flat shape.

A cell is dry only when Water derivation contains no positive-area wet fragment in either Terrain triangle of that cell. Zero-area shoreline contact is allowed. Eligibility uses authoritative Water geometry, not shoreline ribbon width or material pixels.

Flat-only zoning intentionally preserves a clean future building footprint contract. Supporting hillside, stepped, terraced, or retaining-wall development requires a later specification.

## 7. Road-access policy

### 7.1 Rule

Every newly painted Zone cell must independently have direct cardinal Road access at depth `1`, `2`, or `3` from a committed Road cell.

A candidate has Road access when at least one North, East, South, or West search ray satisfies all of the following:

1. an occupied committed Road cell exists one to three cells away on that ray;
2. every intermediate non-Road cell is in bounds;
3. every intermediate cell is dry;
4. every intermediate cell is flat;
5. every intermediate cell has the same flat level as the candidate;
6. shared edges between the candidate and intermediate cells are level-continuous;
7. the final shared edge into the Road cell matches the candidate flat level at both edge vertices;
8. no intermediate cell is blocked by non-Zone world occupancy.

Existing Zones of any type do not block the access ray. Roads, Water, unsupported Terrain, world occupancy, and grade discontinuity do block it.

### 7.2 No Zone-chain access

Zones never propagate Road access.

- A Preview cell does not make another Preview cell valid.
- A committed Zone cell does not act as an access source.
- Every painted cell is validated directly against committed Roads and Terrain/Water facts.

This prevents stroke ordering from affecting validity and avoids arbitrarily deep zoning through connected Zone regions.

### 7.3 Deterministic selected access

Validity may have multiple access rays. Diagnostics select one deterministically:

1. shortest distance first;
2. direction tie-break order: North, East, South, West.

The selected diagnostic route is derived only and is not serialized.

### 7.4 Ramp Roads

A Ramp Road may provide access only through an end edge whose two Road edge vertices exactly match the adjacent flat Zone-access level.

A flat Zone cannot obtain access through the side edge of a one-level Ramp when that side edge contains two different heights.

This permits zoning at compatible Ramp endpoints while rejecting visually and structurally inconsistent side frontage.

## 8. Occupancy and overlap policy

Paint rejects:

- a Road-occupied cell;
- a cell blocked by another registered non-Zone world occupancy;
- a cell occupied by a different Zone definition;
- an out-of-bounds cell.

Paint ignores a cell already occupied by the selected Zone definition.

Remove affects Zone occupancy only. It never deletes Roads, Terrain, Water, or another world entity.

No generic cross-package occupancy registry is introduced in v0.1. Game composition owns the minimal read-only occupancy adapter required by the current systems. A broader occupancy platform requires a separate design if Buildings later justify it.

## 9. Mutation planning

### 9.1 Input

```ts
interface ZoneStrokeInput {
  readonly operation: 'paint' | 'remove';
  readonly definitionId: ZoneDefinitionId | null;
  readonly cells: readonly CellCoord[];
}
```

`definitionId` is required for Paint and must be `null` for Remove.

### 9.2 Invalid reasons

```ts
type ZoneInvalidReason =
  | 'zone:invalid-state'
  | 'zone:invalid-environment'
  | 'zone:invalid-cell'
  | 'zone:unknown-definition'
  | 'zone:no-change'
  | 'zone:unsupported-terrain'
  | 'zone:wet-cell'
  | 'zone:road-occupied'
  | 'zone:occupied'
  | 'zone:zone-conflict'
  | 'zone:road-access-required';
```

Stale revisions are commit-time contract errors rather than Preview invalid reasons.

### 9.3 Plan

```ts
interface ZoneMutationPlan {
  readonly operation: 'paint' | 'remove';
  readonly definitionId: ZoneDefinitionId | null;
  readonly baseZoneRevision: number;
  readonly baseTerrainRevision: number;
  readonly baseWaterSourceTerrainRevision: number;
  readonly baseRoadRevision: number;
  readonly baseOccupancyRevision: number;
  readonly requestedCells: readonly CellCoord[];
  readonly changedCells: readonly CellCoord[];
  readonly unchangedCells: readonly CellCoord[];
  readonly invalidCells: readonly ZoneInvalidCell[];
  readonly proposedDefinitionCodes: Uint8Array;
  readonly dirtyChunks: readonly ChunkCoord[];
  readonly valid: boolean;
  readonly invalidReason: ZoneInvalidReason | null;
}
```

The proposed buffer belongs to the immutable plan and is never the snapshot backing buffer.

### 9.4 Planning pipeline

```text
validate complete base Zone state
→ normalize and deduplicate requested cells in deterministic trace order
→ validate operation and definition
→ copy Zone codes
→ apply proposed Paint or Remove
→ validate every Paint cell against Terrain, Water, Road, occupancy, Zone conflict, and direct Road access
→ derive effective changed and unchanged cells
→ derive Zone-owned dirty chunks
→ return one immutable all-or-nothing plan
```

The complete transaction is invalid when any requested Paint cell is invalid. No valid subset commits.

For deterministic HUD and evidence, `invalidCells` records every invalid requested cell and its primary reason. `invalidReason` is the transaction-level primary reason selected by this precedence:

1. invalid state or environment;
2. invalid coordinate or definition;
3. Road occupancy;
4. non-Zone occupancy;
5. conflicting Zone type;
6. Water;
7. unsupported Terrain;
8. missing Road access;
9. no effective change.

Remove uses only state, operation, definition-null, and coordinate validation. Empty requested cells are unchanged rather than invalid.

## 10. Commit and stale fencing

```ts
commitZoneMutation(
  zones: ZoneSnapshot,
  plan: ZoneMutationPlan,
  environment: ZonePlacementEnvironment,
  config: WorldConfig,
): ZoneCommitResult;
```

Commit rejects:

- an invalid plan;
- stale Zone revision;
- stale Terrain revision;
- stale Water source Terrain revision;
- stale Road revision;
- stale occupancy revision;
- incoherent current Terrain and Water revisions;
- malformed proposed code buffers;
- changed-cell counts inconsistent with the proposed buffer;
- an operation/definition combination inconsistent with the plan.

Successful commit increments Zone revision exactly once and returns an immutable snapshot and receipt.

```ts
interface ZoneMutationReceipt {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly operation: 'paint' | 'remove';
  readonly definitionId: ZoneDefinitionId | null;
  readonly changedCellCount: number;
  readonly unchangedCellCount: number;
  readonly dirtyChunks: readonly ChunkCoord[];
}
```

## 11. Zone-owned dirty chunks

Zone overlay geometry is cell-local in v0.1. A mutation invalidates only the owning Zone chunk of each changed cell.

Dirty chunks are:

- derived from effective changed cells only;
- deduplicated;
- sorted by `z`, then `x`;
- owned by the Zone subsystem;
- rebuilt independently from Terrain, Water, and Road chunks.

v0.1 does not merge neighboring cells into polygon regions and does not introduce a shared global render scheduler.

## 12. Shared reversible trace utility

The Road controller already requires ordered reversible trace behavior. Zoning must not copy that algorithm into a second divergent implementation.

Game composition extracts a framework-free utility equivalent to:

```ts
interface ReversibleCellTrace {
  reset(initial: CellCoord): void;
  extendTo(cell: CellCoord): boolean;
  cells(): readonly CellCoord[];
  clear(): void;
}
```

The utility owns:

- cardinal line rasterization;
- same-tail jitter suppression;
- exact reverse-tail pop;
- reverse-then-branch behavior;
- defensive cell copies.

Road and Zone controllers own their separate sessions, base snapshots, planning callbacks, lifecycle, and operation semantics. Only trace evolution is shared.

Extraction must preserve all existing Road behavior and tests before Zone integration proceeds.

## 13. Road–Zone guards

Zones introduce two new Road mutation invariants. `road-core` remains Zone-agnostic; Game composition guards the core Road plan.

### 13.1 Road Build overlap guard

A Road Build plan is invalid when any proposed added Road cell is zoned in the committed Zone snapshot.

Integration reason:

```text
road:zone-occupied
```

The complete Road transaction is rejected. Roads and Zones remain unchanged, no Undo entry is created, and Preview is shown invalid only on the active Road footprint.

### 13.2 Road Bulldoze access guard

A Road Bulldoze plan is invalid when its proposed final Road snapshot would cause any committed Zone cell to lose the Road-access policy in Section 7.

Integration reason:

```text
road:zone-access-required
```

v0.1 may revalidate all committed Zone cells against the proposed Road snapshot because the canonical map contains only `128 × 128` cells. Premature incremental dependency indexing is excluded.

The complete Road transaction is rejected. Road bulldozing never cascades into automatic Zone removal.

### 13.3 Road Build that improves access

Road Build may create new access for existing or future Zones. It does not mutate Zone state and does not require Zone presentation rebuilds.

## 14. Terraform–Zone guard

Terraform remains Terrain-owned and does not import Zones.

After `terrain-core` produces a `TerraformPlan`, Game composition applies world occupancy guards in deterministic order:

```text
core Terraform validity
→ Road shared-vertex occupancy guard
→ Zone shared-vertex occupancy guard
```

A Zone blocks Terraform when any `TerraformPlan.affectedVertices` belongs to one or more occupied Zone cells, using the same four-cell shared-vertex expansion already required for Roads.

Integration reason:

```text
terraform:zone-occupied
```

When blocked:

- the complete Terraform transaction is invalid;
- the complete Terraform Preview is presented invalid;
- Terrain, Water, Roads, and Zones remain unchanged;
- Water is not rebuilt;
- no Undo entry is created.

If both Roads and Zones block the transaction, the existing Road reason remains the primary reason and both blocked-cell collections remain available to diagnostics.

A later Zone Remove may unblock Terraform normally.

## 15. Undo

The Game retains one visible Undo command and one level of world history.

```ts
type WorldUndoEntry =
  | { readonly kind: 'terraform'; readonly terrain: TerrainSnapshot }
  | { readonly kind: 'road'; readonly roads: RoadSnapshot }
  | { readonly kind: 'zone'; readonly zones: ZoneSnapshot };
```

Rules:

- successful Zone Paint or Remove replaces the previous entry with a Zone entry;
- successful Road or Terraform mutations continue replacing the slot with their own tagged entries;
- Undo consumes the entry once;
- Load clears Undo;
- failed and no-op mutations do not change Undo;
- Zone Undo changes Zones only;
- Zone Undo rebuilds only affected Zone presentation roots or performs one atomic full Zone presentation replacement when the current Undo API lacks a dirty receipt;
- Zone Undo does not rebuild Water, Roads, or Terrain;
- revision restoration follows the existing stale-fencing convention so old plans cannot commit after Undo.

Because history is one-level, a Road mutation that a later Zone transaction depends upon cannot subsequently be undone: the Zone transaction replaces the Road Undo entry.

Multi-level Undo and Redo remain excluded.

## 16. Save and load

### 16.1 Zone save

```ts
interface ZoneSaveV1 {
  readonly schemaVersion: 1;
  readonly width: number;
  readonly height: number;
  readonly revision: number;
  readonly definitionCodes: string;
}
```

`definitionCodes` is Base64 encoding of the complete Zone byte buffer.

Decoding rejects:

- wrong schema version;
- wrong dimensions;
- invalid revision;
- malformed Base64;
- wrong decoded length;
- unknown definition code.

### 16.2 `WorldSaveV2`

```ts
interface WorldSaveV2 {
  readonly kind: 'world-save';
  readonly schemaVersion: 2;
  readonly terrain: TerrainSaveV1;
  readonly roads: RoadSaveV1;
  readonly zones: ZoneSaveV1;
}
```

Saving encodes Terrain, Roads, and Zones from one committed world state.

Water remains derived and is not serialized.

### 16.3 Migration

`decodeWorldSave` accepts:

1. legacy Terrain-only save input;
2. `WorldSaveV1` containing Terrain and Roads;
3. `WorldSaveV2` containing Terrain, Roads, and Zones.

Migration behavior:

- legacy Terrain-only → decoded Terrain, derived Water, empty Roads, empty Zones;
- `WorldSaveV1` → decoded Terrain, derived Water, decoded Roads, empty Zones;
- `WorldSaveV2` → decoded Terrain, derived Water, decoded Roads, decoded Zones.

Migration never rewrites the user’s stored payload implicitly. The next explicit Save emits `WorldSaveV2`.

### 16.4 Atomic validation order

Load validates in this order:

```text
world envelope
→ Terrain
→ derived Water
→ Roads against Terrain and Water
→ Zones against Terrain, Water, Roads, occupancy, and Road access
→ complete presentation construction
→ atomic world swap
```

Any failure rejects the complete load. The previous world remains authoritative and visible. Partial Terrain, Road, or Zone replacement is forbidden.

A valid loaded Zone snapshot must satisfy every current placement invariant. Remove-mode recovery does not weaken load integrity.

### 16.5 Post-load lifecycle

Successful load:

- atomically replaces Terrain, Water, Roads, Zones, and their read-only environments;
- clears every active pointer session and Preview root;
- clears Undo;
- rebuilds committed presentations;
- refreshes HUD counts and reasons;
- preserves camera state only according to the existing world-load contract.

## 17. Rendering

### 17.1 Committed overlay

Committed Zones render as lightweight translucent cell overlays:

- Residential: one stable semantic material;
- Commercial: one stable semantic material;
- Industrial: one stable semantic material.

The specification locks semantic distinction, not final palette values. Materials must remain visually distinguishable under the current desktop/mobile scene and accessible diagnostics.

Each Zone cell is rendered only on flat Terrain at authoritative height plus a small fixed presentation offset to prevent z-fighting. Overlay geometry does not modify Terrain.

### 17.2 Chunk presentation

`ZoneChunkPresentation` maintains one committed root per Zone chunk.

Rebuild behavior:

1. build replacement geometry off-scene;
2. validate finite positions, indices, bounds, counts, and material groups;
3. swap the replacement root atomically;
4. dispose the previous root only after successful replacement.

A failed rebuild leaves the previous committed overlay visible and reports a world-update failure through Game composition.

### 17.3 Preview isolation

Preview and committed overlays use separate Three.js roots and materials.

- Valid Paint Preview renders only effective cells in the active retained stroke.
- Same-type unchanged cells may be represented by HUD counts but are not recolored as active changes.
- Invalid Paint Preview renders only active requested cells and invalid markers.
- Remove Preview renders only effective cells that would be cleared, using the captured base Zone snapshot.
- Committed Zones outside the active footprint never receive Preview material.
- Reverse movement atomically replaces the previous Preview root and disposes abandoned-tail geometry.
- Pointer-up, cancellation, load, context loss, recovery, tool change, and disposal leave no Preview root.

### 17.4 No region topology

v0.1 does not derive Zone borders, connected regions, district polygons, frontage arrows, lot subdivision, parcel geometry, or building footprints. Overlay is cell-based and authoritative state remains one definition code per cell.

## 18. HUD and controls

The Game exposes:

- Residential Paint control;
- Commercial Paint control;
- Industrial Paint control;
- Zone Remove control;
- committed counts for each Zone type;
- total committed Zone count;
- active requested-cell count;
- active effective-change count;
- invalid-cell count;
- contextual transaction status and primary invalid reason;
- standard Save, Load, and Undo state.

Controls use the existing operation-aware ownership model:

- Zone tools suppress camera pan for the owned primary pointer;
- camera controls continue operating outside active Zone strokes;
- UI-origin pointers never paint the world;
- keyboard ownership and Escape cancellation follow existing Game conventions;
- desktop remains map-first while responsive/mobile compatibility remains required.

Final HUD composition and final visual design are excluded, but accessibility names and status semantics are acceptance requirements.

## 19. Error handling and recovery

Expected invalid user actions produce immutable invalid plans and contextual Preview; they do not throw.

Contract corruption and stale commit attempts use typed errors.

A failed Zone presentation rebuild:

- preserves the last committed visible Zone root;
- does not roll back authoritative Zone state silently;
- enters the existing recoverable world-presentation failure path;
- disables conflicting mutation controls until rebuild or full scene recovery succeeds.

WebGL context restoration rebuilds Zone presentation from authoritative Zone, Terrain, and environment state. No serialized GPU state is trusted.

## 20. Testing strategy

### 20.1 `zone-core` unit tests

Required deterministic coverage includes:

- snapshot defensive copying and code validation;
- definition registry validation;
- Paint, Remove, same-type no-op, and different-type conflict;
- flat-only Terrain policy;
- Water rejection;
- Road-cell rejection;
- non-Zone occupancy rejection;
- Road access at depths 1, 2, and 3;
- rejection at depth 4;
- North/East/South/West access;
- blocked intermediate cell;
- grade discontinuity;
- compatible Ramp endpoint access;
- incompatible Ramp side access;
- no Zone-chain access;
- all-or-nothing mixed-validity strokes;
- stale Zone, Terrain, Water, Road, and occupancy fencing;
- dirty-chunk derivation and deterministic ordering;
- `ZoneSaveV1` round trip and malformed payload taxonomy.

### 20.2 Game integration tests

Required coverage includes:

- Game tool-mode discrimination;
- shared reversible trace preserving all Road behavior;
- Zone reverse-tail removal and reverse-then-branch;
- operation-aware camera/Zone ownership;
- immutable placement-environment capture;
- Road Build rejection on zoned cells;
- Road Bulldoze rejection when Zone access would be lost;
- Terraform rejection on Zone shared vertices;
- deterministic Road-before-Zone Terraform reason precedence;
- tagged Zone Undo;
- `WorldSaveV2` encoding;
- legacy Terrain-only and `WorldSaveV1` migration;
- atomic invalid `WorldSaveV2` rejection;
- HUD counts, reasons, control state, and recovery.

### 20.3 `zone-three` tests

Required coverage includes:

- finite flat overlay geometry;
- centered world-coordinate alignment;
- material grouping by Zone type;
- dirty-chunk atomic replacement;
- committed/Preview root separation;
- valid Paint footprint isolation;
- invalid marker footprint isolation;
- Remove Preview from base snapshot;
- reverse-tail Preview disposal;
- context-restoration rebuild;
- deterministic geometry bounds and hashes where appropriate.

### 20.4 Browser acceptance

Built-application Chromium/WebGL acceptance must prove:

1. Paint each of the three Zone types on eligible cells.
2. Reject depth-4 Road access while accepting depths 1–3.
3. Reject Water, Road cells, non-flat Terrain, conflicting Zones, and blocked occupancy.
4. Reverse a Paint stroke and confirm the abandoned tail is neither previewed nor committed.
5. Reverse then branch and commit only the retained branch.
6. Reverse a Remove stroke and restore the abandoned removal tail before pointer-up.
7. Keep committed Zones outside the active footprint visually unchanged during Preview.
8. Reject Terraform touching a zoned cell as one complete transaction.
9. Reject Road Build over a Zone.
10. Reject Road Bulldoze that would remove required access.
11. Undo Zone Paint and Zone Remove through tagged world Undo.
12. Save `WorldSaveV2`, reload it, and preserve byte-equivalent Zone occupancy.
13. Load legacy Terrain-only and `WorldSaveV1` payloads with empty Zones.
14. Reject invalid Zone save data atomically without changing the visible world.
15. Restore Zone roots after WebGL context restoration.
16. Maintain usable desktop and responsive/mobile controls and framing.

## 21. Browser evidence contract

Evidence exposes deterministic diagnostics for:

- Zone revision;
- committed count by type and total;
- active operation and selected Zone type;
- requested, effective, unchanged, and invalid Preview counts;
- invalid reason and invalid cell coordinates;
- active Preview world-space bounds;
- committed and Preview root counts;
- dirty Zone chunks;
- Road-access distance and direction for selected evidence cells;
- blocked Road/Zone cells for guarded Terraform and Road transactions;
- Undo kind and availability;
- world save schema version;
- context-loss and restoration lifecycle.

Screenshots must visibly demonstrate semantic differentiation, Preview isolation, invalid status, reverse-tail behavior, Save/Load restoration, and desktop/mobile usability.

## 22. Verification and delivery gates

The implementation is complete only when all of the following pass on one exact head:

- canonical formatting;
- ESLint;
- TypeScript typecheck;
- provenance scan;
- all workspace unit and integration tests;
- deployment contract tests;
- all package and application builds;
- complete Chromium/WebGL suite;
- new Zoning browser acceptance scenarios;
- visual evidence review;
- clean-worktree verification through `pnpm verify:full`;
- no temporary trigger, repair, diagnostic, or credential-bearing files in the final diff;
- zero unresolved Critical or Important review findings;
- explicit owner authorization before merge.

CI and deployment automation follow the repository policy present at implementation time. The normative verification command remains repository-owned `pnpm verify:full`.

## 23. Explicit exclusions

Zoning Foundation v0.1 does not include:

- Buildings or prototype building placement;
- automatic Zoned Building Growth;
- lot, parcel, or frontage subdivision;
- Population, jobs, households, or workers;
- Demand bars or demand calculation;
- Economy, money, taxes, maintenance, costs, or refunds;
- Electricity, Water utility networks, sewage, or service coverage;
- Traffic, pathfinding, vehicles, pedestrians, or transit;
- Mixed-use or custom Zone definitions;
- density levels, upgrades, de-zoning fees, or historical zoning;
- desirability, land value, pollution, noise, crime, or happiness;
- diagonal Road access;
- zoning on Ramps, terraces, cliffs, or retaining walls;
- rectangle, flood-fill, multi-size brush, or lasso tools;
- region polygonization or district systems;
- multi-level Undo or Redo;
- a generic plugin-based global occupancy platform;
- final UI composition, final palette, final shaders, or final art.

## 24. Milestone sequence

After Zoning Foundation v0.1:

1. Building Placement & Content Foundation v0.1;
2. Zoned Building Growth v0.1;
3. Demand & Population Simulation v0.1;
4. Economy & Budget Foundation;
5. Utilities;
6. Traffic & Pathfinding.

Later milestones may consume Zone definitions and queries but must not move Building or Simulation ownership into `zone-core`.

## 25. Approval boundary

Owner approval of this written specification authorizes creation of a separate TDD implementation plan.

It does not authorize production implementation or merge. Production work begins only after the implementation plan is written, self-reviewed, and explicitly approved with an execution mode.