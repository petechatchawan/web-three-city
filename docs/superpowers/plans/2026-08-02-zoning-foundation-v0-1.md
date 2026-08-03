# Zoning Foundation v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Deliver authoritative Residential, Commercial, and Industrial zoning with reversible Paint/Remove strokes, Road-access validation, atomic persistence, Undo, presentation, and exact-head browser verification.

**Architecture:** Add pure TypeScript `zone-core` and presentation-only `zone-three` packages. Keep every cross-domain rule in `apps/game`: immutable placement environments, Road/Zone and Terraform/Zone guards, world Undo, `WorldSaveV2`, tool ownership, HUD, and lifecycle integration. Every mutation is planned against immutable snapshots, committed with stale-revision fencing, and presented by atomic root replacement.

**Tech Stack:** TypeScript 6.0.3, pnpm 10.13.1 workspaces, Vitest 4.1.10, Three.js 0.185.1, Vite 8.1.5, Playwright 1.61.1.

## Global Constraints

- Canonical map dimensions remain `128 × 128` cells with the existing shared Terrain lattice and world origin.
- Zone definition codes are stable: `0` empty, `1` Residential, `2` Commercial, `3` Industrial.
- Paint accepts dry, flat cells only.
- Every newly painted cell must independently reach a committed Road through one cardinal ray of depth `1..3`; Zones never propagate access.
- Paint never replaces another Zone type; Remove is required first.
- Zone mutations are all-or-nothing and commit once on pointer-up.
- Terrain, Water, and Roads remain Zone-agnostic; cross-domain policy belongs to `apps/game`.
- `zone-core` must not import Three.js, DOM APIs, `road-core`, `water-core`, or Game code.
- `zone-three` must not own or mutate authoritative state.
- Undo remains one-level and tagged by world transaction kind.
- `WorldSaveV2` must migrate both Terrain-only saves and `WorldSaveV1` by creating an empty Zone snapshot.
- Production implementation must follow RED → verified failure → GREEN → verified pass for every task.
- Final acceptance requires exact-head `pnpm verify:full`, browser evidence, a clean worktree, and no temporary workflow files.

---

## File Structure Map

### New package: `packages/zone-core`

- `src/contracts.ts` — public identifiers, environment, plan, receipt, result, and error contracts.
- `src/zone-definitions.ts` — stable definition registry and code/id conversion.
- `src/zone-snapshot.ts` — immutable state, occupancy queries, and derived counts.
- `src/road-access.ts` — deterministic cardinal depth-1..3 access evaluation.
- `src/zone-mutation.ts` — Paint/Remove planning, invalid-cell diagnostics, commit, stale fencing, dirty chunks.
- `src/serialization.ts` — `ZoneSaveV1` encode/decode.
- `src/index.ts` — explicit public exports.
- `test/*.test.ts` — behavior-first tests for every public contract.

### New package: `packages/zone-three`

- `src/zone-mesh-data.ts` — renderer-independent mesh contracts and bounds.
- `src/zone-overlay-geometry.ts` — flat-cell inset overlays at authoritative surface height.
- `src/material-factory.ts` — committed/valid/invalid/remove materials.
- `src/zone-chunk-presentation.ts` — committed roots and atomic dirty-chunk replacement.
- `src/zone-preview-presentation.ts` — changed-cell-scoped Preview and invalid markers.
- `src/index.ts` — public presentation API.
- `test/*.test.ts` — deterministic geometry, isolation, disposal, and atomic-swap tests.

### Game composition

- `apps/game/src/reversible-cell-trace.ts` — shared ordered trace semantics for Roads and Zones.
- `apps/game/src/zone-placement-environment.ts` — immutable Terrain/Water/Road/occupancy adapter.
- `apps/game/src/zone-stroke-controller.ts` — pointer-session planning and Preview routing.
- `apps/game/src/terraform-occupancy-guard.ts` — combined Road and Zone Terraform guard.
- `apps/game/src/road-zone-guard.ts` — Road Build overlap and Bulldoze access preservation.
- `apps/game/src/world-save.ts` — `WorldSaveV2`, migrations, full atomic validation.
- `apps/game/src/world-undo.ts` — tagged Zone snapshot entry.
- Existing tool, UI, bootstrap, evidence, and browser test files — Zone integration.

---

### Task 1: Immutable Zone Definitions, Snapshot, and Counts

**Files:**
- Create: `packages/zone-core/package.json`
- Create: `packages/zone-core/tsconfig.json`
- Create: `packages/zone-core/tsconfig.build.json`
- Create: `packages/zone-core/vitest.config.ts`
- Create: `packages/zone-core/src/contracts.ts`
- Create: `packages/zone-core/src/zone-definitions.ts`
- Create: `packages/zone-core/src/zone-snapshot.ts`
- Create: `packages/zone-core/src/index.ts`
- Test: `packages/zone-core/test/zone-definitions.test.ts`
- Test: `packages/zone-core/test/zone-snapshot.test.ts`

**Interfaces:**
- Produces: `ZoneDefinitionId`, `ZoneDefinitionCode`, `ZoneSnapshot`, `createZoneSnapshot`, `createEmptyZoneSnapshot`, `zoneDefinitionCodeAt`, `zoneOccupiedAt`, `zoneCounts`, `zoneDefinitionForId`, `zoneDefinitionForCode`.

- [x] **Step 1: Write failing definition and snapshot tests**

```ts
it('keeps stable definition ids and codes', () => {
  expect(zoneDefinitionForId('residential')).toMatchObject({ code: 1, label: 'Residential' });
  expect(zoneDefinitionForCode(3)).toMatchObject({ id: 'industrial' });
});

it('defensively copies authoritative codes', () => {
  const codes = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
  codes[0] = 1;
  const snapshot = createZoneSnapshot({
    width: WORLD_CONFIG.mapWidth,
    height: WORLD_CONFIG.mapHeight,
    revision: 4,
    definitionCodes: codes,
  }, WORLD_CONFIG);
  codes[0] = 0;
  expect(zoneDefinitionCodeAt(snapshot, { x: 0, z: 0 })).toBe(1);
  expect(snapshot.definitionCodes).not.toBe(snapshot.definitionCodes);
});

it('derives exact R/C/I counts', () => {
  const snapshot = snapshotWithCodes([1, 1, 2, 3, 3, 3]);
  expect(zoneCounts(snapshot)).toEqual({ residential: 2, commercial: 1, industrial: 3, total: 6 });
});
```

- [x] **Step 2: Run RED**

Run: `pnpm --filter @web-three-city/zone-core test`

Expected: FAIL because package and exports do not exist.

- [x] **Step 3: Implement minimal immutable contracts and state**

Use a private `WeakMap<ZoneSnapshot, Uint8Array>` matching the Road snapshot defensive-copy pattern. Reject invalid dimensions, revisions, byte lengths, and codes with stable `zone-snapshot:*` errors.

- [x] **Step 4: Run GREEN**

Run: `pnpm --filter @web-three-city/zone-core test && pnpm --filter @web-three-city/zone-core typecheck`

Expected: all Task 1 tests pass and TypeScript exits `0`.

- [x] **Step 5: Commit**

```bash
git add packages/zone-core
git commit -m "feat: add immutable Zone state"
```

---

### Task 2: Deterministic Road Access and Zone Mutation Planning

**Files:**
- Modify: `packages/zone-core/src/contracts.ts`
- Create: `packages/zone-core/src/road-access.ts`
- Create: `packages/zone-core/src/zone-mutation.ts`
- Modify: `packages/zone-core/src/index.ts`
- Test: `packages/zone-core/test/road-access.test.ts`
- Test: `packages/zone-core/test/zone-mutation.test.ts`

**Interfaces:**
- Consumes: Task 1 snapshot and definition APIs plus `TerrainCellSurfaceProfile`, `ChunkCoord`, `WorldConfig`.
- Produces: `ZonePlacementEnvironment`, `ZoneRoadAccess`, `ZoneInvalidReason`, `ZoneInvalidCell`, `ZoneMutationPlan`, `planZoneMutation`, `commitZoneMutation`.

- [x] **Step 1: Write failing Road-access tests**

```ts
it.each([1, 2, 3])('accepts a flat dry cell with committed Road at depth %s', (distance) => {
  expect(findZoneRoadAccess({ x: 4, z: 4 }, environmentWithRoadNorth(distance), WORLD_CONFIG))
    .toMatchObject({ direction: 'north', distance });
});

it('rejects depth four and does not chain through Zones', () => {
  expect(findZoneRoadAccess({ x: 4, z: 4 }, environmentWithRoadNorth(4), WORLD_CONFIG)).toBeNull();
});

it('uses shortest distance then N/E/S/W tie breaking', () => {
  expect(findZoneRoadAccess({ x: 4, z: 4 }, environmentWithRoads({ north: 2, east: 1 }), WORLD_CONFIG))
    .toEqual({ direction: 'east', distance: 1, roadCell: { x: 5, z: 4 } });
});
```

Cover blocked occupancy, wet intermediates, non-flat intermediates, grade discontinuity, and Ramp end-edge compatibility.

- [x] **Step 2: Run Road-access RED**

Run: `pnpm --filter @web-three-city/zone-core test -- road-access.test.ts`

Expected: FAIL because `findZoneRoadAccess` does not exist.

- [x] **Step 3: Implement cardinal access evaluator**

Evaluate directions in `north`, `east`, `south`, `west` order and distances `1..3`. Validate every intermediate cell and the final Road edge using immutable environment facts; return the shortest deterministic route or `null`.

- [x] **Step 4: Write failing Paint/Remove plan tests**

```ts
it('rejects the complete Paint transaction when one cell conflicts', () => {
  const plan = planZoneMutation(baseZones, {
    operation: 'paint', definitionId: 'residential', cells: [validCell, conflictingCommercialCell],
  }, environment, WORLD_CONFIG);
  expect(plan.valid).toBe(false);
  expect(plan.invalidCells).toContainEqual(expect.objectContaining({
    cell: conflictingCommercialCell,
    reason: 'zone:zone-conflict',
  }));
});

it('removes invalid legacy Zones without placement eligibility', () => {
  const plan = planZoneMutation(invalidlyPlacedZones, {
    operation: 'remove', definitionId: null, cells: [invalidCell],
  }, hostileEnvironment, WORLD_CONFIG);
  expect(plan.valid).toBe(true);
  expect(plan.changedCells).toEqual([invalidCell]);
});
```

Also cover Road occupancy, Water, Ramp Terrain, non-Zone occupancy, same-type no-op filtering, no-change, deterministic invalid precedence, stale Zone/Terrain/Water/Road/occupancy revision rejection, revision increment exactly once, and owning-chunk dirty derivation.

- [x] **Step 5: Run mutation RED**

Run: `pnpm --filter @web-three-city/zone-core test -- zone-mutation.test.ts`

Expected: FAIL because mutation APIs do not exist.

- [x] **Step 6: Implement plan and commit**

Planning must copy the code buffer, validate every Paint cell independently, collect all invalid diagnostics, select the transaction reason by the locked precedence, and never commit a valid subset. Commit must reject every stale captured revision and malformed plan before creating a snapshot at `revision + 1`.

- [x] **Step 7: Run Task 2 GREEN**

Run: `pnpm --filter @web-three-city/zone-core test && pnpm --filter @web-three-city/zone-core typecheck`

Expected: all Zone core tests pass.

- [x] **Step 8: Commit**

```bash
git add packages/zone-core
git commit -m "feat: plan and commit Zone mutations"
```

---

### Task 3: ZoneSaveV1 Serialization

**Files:**
- Create: `packages/zone-core/src/serialization.ts`
- Modify: `packages/zone-core/src/index.ts`
- Test: `packages/zone-core/test/serialization.test.ts`

**Interfaces:**
- Produces: `ZoneSaveV1`, `encodeZoneSaveV1`, `decodeZoneSaveV1`, `ZoneSaveError`.

- [x] **Step 1: Write failing serialization tests**

```ts
it('round-trips Zone bytes and revision exactly', () => {
  const encoded = encodeZoneSaveV1(source);
  const decoded = decodeZoneSaveV1(encoded, WORLD_CONFIG);
  expect(decoded).toEqual({ ok: true, value: expect.any(Object) });
  if (decoded.ok) expect(decoded.value.definitionCodes).toEqual(source.definitionCodes);
});

it.each([
  { schemaVersion: 2 },
  { width: 127 },
  { definitionCodes: 'not-base64' },
])('rejects malformed save %o', (patch) => {
  expect(decodeZoneSaveV1({ ...validSave, ...patch }, WORLD_CONFIG).ok).toBe(false);
});
```

- [x] **Step 2: Run RED**

Run: `pnpm --filter @web-three-city/zone-core test -- serialization.test.ts`

- [x] **Step 3: Implement strict Base64 encode/decode**

Match existing Road serialization conventions, validate the envelope before snapshot construction, and map constructor failures to stable `zone-save:*` codes.

- [x] **Step 4: Run GREEN and package build**

Run: `pnpm --filter @web-three-city/zone-core test && pnpm --filter @web-three-city/zone-core build`

- [x] **Step 5: Commit**

```bash
git add packages/zone-core
git commit -m "feat: serialize Zone state"
```

---

### Task 4: Zone Overlay and Preview Presentation

**Files:**
- Create: `packages/zone-three/package.json`
- Create: `packages/zone-three/tsconfig.json`
- Create: `packages/zone-three/tsconfig.build.json`
- Create: `packages/zone-three/vitest.config.ts`
- Create: `packages/zone-three/src/zone-mesh-data.ts`
- Create: `packages/zone-three/src/zone-overlay-geometry.ts`
- Create: `packages/zone-three/src/material-factory.ts`
- Create: `packages/zone-three/src/zone-chunk-presentation.ts`
- Create: `packages/zone-three/src/zone-preview-presentation.ts`
- Create: `packages/zone-three/src/index.ts`
- Test: `packages/zone-three/test/zone-overlay-geometry.test.ts`
- Test: `packages/zone-three/test/zone-chunk-presentation.test.ts`
- Test: `packages/zone-three/test/zone-preview-presentation.test.ts`

**Interfaces:**
- Consumes: Zone snapshot/plan and a read-only `surfaceAt(cell)` adapter.
- Produces: `buildZoneOverlayMesh`, `ZoneChunkPresentation`, `ZonePreviewPresentation`.

- [x] **Step 1: Write failing geometry tests**

Assert finite indexed geometry, centered world origin, inset cell bounds, `surfaceOffset = 0.03`, deterministic hashes, and separate material groups for Residential/Commercial/Industrial.

- [x] **Step 2: Run geometry RED**

Run: `pnpm --filter @web-three-city/zone-three test -- zone-overlay-geometry.test.ts`

- [x] **Step 3: Implement minimal cell-local overlay geometry**

Generate one inset quad per zoned flat cell at the authoritative level plus `0.03`. Do not merge Zone geometry into Terrain, Water, or Road roots.

- [x] **Step 4: Write failing presentation tests**

Cover atomic committed-root replacement, old-root preservation on replacement failure, disposal after successful swap, Preview footprint restricted to `plan.changedCells`, invalid markers restricted to `plan.invalidCells`, and complete clear on cancellation.

- [x] **Step 5: Run presentation RED**

Run: `pnpm --filter @web-three-city/zone-three test -- zone-chunk-presentation.test.ts zone-preview-presentation.test.ts`

- [x] **Step 6: Implement committed and Preview presenters**

Use separate roots and materials. Valid Paint uses selected Zone tint; Remove uses removal tint over base cells; invalid Preview displays only requested invalid cells plus markers.

- [x] **Step 7: Run GREEN**

Run: `pnpm --filter @web-three-city/zone-three test && pnpm --filter @web-three-city/zone-three typecheck && pnpm --filter @web-three-city/zone-three build`

- [x] **Step 8: Commit**

```bash
git add packages/zone-three pnpm-lock.yaml
git commit -m "feat: render Zone overlays and Preview"
```

---

### Task 5: Shared Reversible Trace and Zone Stroke Controller

**Files:**
- Create: `apps/game/src/reversible-cell-trace.ts`
- Create: `apps/game/src/reversible-cell-trace.test.ts`
- Modify: `apps/game/src/road-stroke-controller.ts`
- Modify: `apps/game/src/road-stroke-controller.test.ts`
- Create: `apps/game/src/zone-stroke-controller.ts`
- Create: `apps/game/src/zone-stroke-controller.test.ts`
- Modify: `apps/game/package.json`

**Interfaces:**
- Produces: `createReversibleCellTrace`, `ZoneStrokeController`, `createZoneStrokeController`.

- [x] **Step 1: Write failing shared-trace tests**

```ts
it('pops the exact reverse tail and branches from the retained cell', () => {
  const trace = createReversibleCellTrace({ x: 1, z: 1 });
  trace.extendTo({ x: 4, z: 1 });
  trace.extendTo({ x: 2, z: 1 });
  trace.extendTo({ x: 2, z: 3 });
  expect(trace.cells()).toEqual([
    { x: 1, z: 1 }, { x: 2, z: 1 }, { x: 2, z: 2 }, { x: 2, z: 3 },
  ]);
});
```

- [x] **Step 2: Run RED, implement utility, migrate Road, run Road regressions**

Run RED: `pnpm --filter @web-three-city/game test -- reversible-cell-trace.test.ts`

After implementation run: `pnpm --filter @web-three-city/game test -- reversible-cell-trace.test.ts road-stroke-controller.test.ts`

- [x] **Step 3: Write failing Zone controller tests**

Cover immutable base capture, Paint/Remove mode mapping, reverse-tail Preview shrink, reverse-then-branch, cancellation, second-pointer rejection, pointer-up returning the retained final plan, and Preview clear.

- [x] **Step 4: Implement Zone controller**

The controller must capture Zones and placement environment at begin, replan from retained unique trace cells, and never commit directly.

- [x] **Step 5: Run GREEN**

Run: `pnpm --filter @web-three-city/game test -- reversible-cell-trace.test.ts road-stroke-controller.test.ts zone-stroke-controller.test.ts`

- [x] **Step 6: Commit**

```bash
git add apps/game/src/reversible-cell-trace* apps/game/src/road-stroke-controller* apps/game/src/zone-stroke-controller* apps/game/package.json
git commit -m "feat: add reversible Zone strokes"
```

---

### Task 6: Immutable Zone Placement Environment and Cross-Domain Guards

**Files:**
- Create: `apps/game/src/zone-placement-environment.ts`
- Create: `apps/game/src/zone-placement-environment.test.ts`
- Create: `apps/game/src/terraform-occupancy-guard.ts`
- Create: `apps/game/src/terraform-occupancy-guard.test.ts`
- Delete after migration: `apps/game/src/terraform-road-guard.ts`
- Delete after migration: `apps/game/src/terraform-road-guard.test.ts`
- Create: `apps/game/src/road-zone-guard.ts`
- Create: `apps/game/src/road-zone-guard.test.ts`

**Interfaces:**
- Produces: `createZonePlacementEnvironment`, `guardTerraformPlanWithOccupancy`, `guardRoadPlanWithZones`.

- [x] **Step 1: Write failing environment tests**

Verify defensive snapshots, coherent Terrain/Water revisions, committed Road-only access, copied Water mask, Road revision fencing, and deterministic occupancy revision.

- [x] **Step 2: Implement environment and run GREEN**

Run: `pnpm --filter @web-three-city/game test -- zone-placement-environment.test.ts`

- [x] **Step 3: Write failing Terraform guard tests**

A Terraform plan is blocked when any affected shared vertex touches either a Road or Zone cell; reasons are `terraform:road-occupied` and `terraform:zone-occupied`, with deterministic blocked-cell lists and no mutation of the core plan.

- [x] **Step 4: Implement combined occupancy guard and migrate callers**

Preserve existing Road behavior exactly while adding Zone blocking. Do not add Zone reasons to `terrain-core`.

- [x] **Step 5: Write failing Road guard tests**

Cover Build over a Zone, Bulldoze preserving access, Bulldoze removing the sole valid access ray, alternate Road access allowing Bulldoze, and no Zone snapshot mutation.

- [x] **Step 6: Implement Road/Zone guard**

Evaluate the proposed final Road snapshot against every committed Zone cell using the same access algorithm and current Terrain/Water/occupancy facts. Reject the complete Road transaction on any overlap or access loss.

- [x] **Step 7: Run GREEN**

Run: `pnpm --filter @web-three-city/game test -- zone-placement-environment.test.ts terraform-occupancy-guard.test.ts road-zone-guard.test.ts`

- [x] **Step 8: Commit**

```bash
git add apps/game/src/zone-placement-environment* apps/game/src/terraform-*guard* apps/game/src/road-zone-guard*
git commit -m "feat: enforce Zone world invariants"
```

---

### Task 7: Tool Vocabulary, HUD, Reasons, and Accessible UI

**Files:**
- Modify: `apps/game/src/game-tool-mode.ts`
- Modify: `apps/game/src/game-tool-events.ts`
- Modify: `apps/game/src/game-reason-catalog.ts`
- Modify: `apps/game/src/game-tool-presentation.ts`
- Modify: `apps/game/src/game-tool-hud-binding.ts`
- Modify: `apps/game/src/game-ui.ts`
- Modify: `apps/game/src/style.css`
- Modify matching `*.test.ts` files.

**Interfaces:**
- Produces: `ZoneToolMode`, mode guards, Zone tool events, reason copy, HUD counts and labels.

- [x] **Step 1: Write failing tool/UI tests**

Assert four Zone modes, mutually exclusive tool ownership, Residential/Commercial/Industrial/Remove controls, accessible names, active-state presentation, `R/C/I` committed counts, valid/invalid requested/effective counts, and exact reason copy.

- [x] **Step 2: Run RED**

Run: `pnpm --filter @web-three-city/game test -- game-tool-events.test.ts game-reason-catalog.test.ts game-tool-presentation.test.ts game-tool-hud-binding.test.ts game-ui.test.ts`

- [x] **Step 3: Implement minimal UI and HUD integration**

Keep the map-first layout and existing responsive breakpoints. Zone colors are presentation constants only and must not become definition identity.

- [x] **Step 4: Run GREEN**

Run the same focused command and `pnpm --filter @web-three-city/game typecheck`.

- [x] **Step 5: Commit**

```bash
git add apps/game/src/game-tool-* apps/game/src/game-reason-catalog* apps/game/src/game-ui* apps/game/src/style.css
git commit -m "feat: add Zone tools and HUD"
```

---

### Task 8: WorldSaveV2 and Tagged Zone Undo

**Files:**
- Modify: `apps/game/src/world-save.ts`
- Modify: `apps/game/src/world-save.test.ts`
- Modify: `apps/game/src/world-undo.ts`
- Modify: `apps/game/src/world-undo.test.ts`

**Interfaces:**
- Produces: `WorldSaveV2`, decoded world state including `zones` and `zoneEnvironment`, Zone-tagged Undo.

- [x] **Step 1: Write failing migration tests**

Cover Terrain-only → empty Roads and Zones, `WorldSaveV1` → preserved Roads plus empty Zones, `WorldSaveV2` exact round-trip, invalid Zone bytes, Zone over Road, wet/non-flat Zone, missing Road access, and atomic rejection without partial state exposure.

- [x] **Step 2: Run save RED**

Run: `pnpm --filter @web-three-city/game test -- world-save.test.ts`

- [x] **Step 3: Implement `WorldSaveV2`**

Decode Terrain, derive Water, decode Roads, construct Road environment, validate Roads, decode Zones, construct Zone environment, and validate every Zone cell in that order. Legacy input must remain accepted.

- [x] **Step 4: Write failing Undo tests**

```ts
it('stores and consumes one immutable Zone entry', () => {
  store.replace({ kind: 'zone', zones });
  expect(store.kind).toBe('zone');
  const restored = store.consume();
  expect(restored?.kind).toBe('zone');
  expect(store.available).toBe(false);
});
```

Cover replacement ordering, defensive copy, revision restoration, Load clear, and failed/no-op mutations leaving Undo unchanged.

- [x] **Step 5: Implement Zone Undo and run GREEN**

Run: `pnpm --filter @web-three-city/game test -- world-save.test.ts world-undo.test.ts`

- [x] **Step 6: Commit**

```bash
git add apps/game/src/world-save* apps/game/src/world-undo*
git commit -m "feat: persist and undo Zones"
```

---

### Task 9: Game Bootstrap, Lifecycle, Presentation, and Context Restoration

**Files:**
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `apps/game/src/game-input.ts`
- Modify: `apps/game/src/main.ts`
- Modify: `apps/game/src/interaction-evidence.ts`
- Modify relevant composition, routing, recovery, transaction, and bootstrap tests.

**Interfaces:**
- Integrates all prior tasks into the live Game.

- [x] **Step 1: Write failing composition tests**

Cover initial empty Zones, Paint commit, Remove commit, Undo, Save/Load, Road guard routing, Terraform guard routing, Preview clear on tool change/load/context loss/disposal, context restoration rebuilding committed Zone chunks, and failure preserving previous roots.

- [x] **Step 2: Run composition RED**

Run focused Game tests naming every changed composition test file.

- [x] **Step 3: Implement bootstrap and transaction routing**

Commit order for Zone mutation: validate final plan → capture Undo snapshot → commit Zone snapshot → rebuild changed Zone chunks → clear Preview → update HUD/evidence. On presentation failure, keep authoritative/presentation recovery behavior consistent with existing Road transactions.

- [x] **Step 4: Run composition GREEN**

Run focused tests, then `pnpm --filter @web-three-city/game test`, typecheck, and build.

- [x] **Step 5: Commit**

```bash
git add apps/game/src
git commit -m "feat: integrate Zoning into the Game"
```

---

### Task 10: Browser Acceptance and Visual Evidence

**Files:**
- Create: `browser-tests/zoning.spec.ts`
- Create: `browser-tests/zoning-visual-evidence.spec.ts`
- Modify: `browser-tests/helpers/interaction.ts`
- Modify: `browser-tests/game.spec.ts`
- Modify: `browser-tests/transaction-release.spec.ts`
- Modify: `browser-tests/terrain-lab-globals.d.ts` only if diagnostics require shared types.

**Interfaces:**
- Produces exact-head evidence for interaction, state, bounds, pixels, and lifecycle.

- [x] **Step 1: Write browser tests before final integration changes**

Required scenarios:

1. Paint Residential at Road depths 1, 2, and 3.
2. Reject depth 4, Water, Ramp, Road overlap, and different-Zone overlap.
3. Exact reverse removes the abandoned Paint tail.
4. Reverse-then-branch excludes the abandoned branch.
5. Remove reverse restores the abandoned removal tail.
6. Preview changes only active cells; committed overlays outside the stroke retain committed styling.
7. Terraform rejects a transaction touching Zones.
8. Road Build rejects Zone overlap.
9. Road Bulldoze rejects loss of the sole access ray and succeeds when an alternate ray remains.
10. Undo, `WorldSaveV2`, legacy migration, reload, resize, mobile viewport, and WebGL context restoration.
11. HUD R/C/I counts equal authoritative Zone counts.
12. Pointer cancellation, blur, second-touch takeover, and load leave no Preview root and commit nothing.

- [x] **Step 2: Run browser RED**

Run: `pnpm build:browser && pnpm exec playwright test browser-tests/zoning.spec.ts browser-tests/zoning-visual-evidence.spec.ts`

Expected: new scenarios fail before missing integration is completed.

- [x] **Step 3: Add only the diagnostics required by tests**

Expose Zone revision, counts, requested/effective/invalid counts, Preview root count, committed chunk/root counts, Preview world bounds, invalid reasons, and transaction receipts. Do not expose mutable snapshots.

- [x] **Step 4: Run browser GREEN**

Run the focused browser command until all new scenarios pass, then run the complete Chromium suite.

- [x] **Step 5: Commit**

```bash
git add browser-tests apps/game/src/interaction-evidence.ts
git commit -m "test: verify Zoning in Chromium"
```

---

### Task 11: Exact-Head Verification, Evidence Record, and PR Closure

**Files:**
- Create: `docs/evidence/zoning-foundation-v0-1.md`
- Modify: `docs/superpowers/specs/2026-08-02-zoning-foundation-v0-1-design.md` status only.
- Modify: `docs/superpowers/plans/2026-08-02-zoning-foundation-v0-1.md` checkbox state only.
- Modify PR description with exact evidence.

- [x] **Step 1: Run focused package and Game verification**

```bash
pnpm --filter @web-three-city/zone-core test
pnpm --filter @web-three-city/zone-three test
pnpm --filter @web-three-city/game test
pnpm typecheck
```

- [x] **Step 2: Run repository verification**

```bash
pnpm verify
```

Expected: format, lint, TypeScript, provenance, all workspace tests, deployment contracts, and all builds pass.

- [x] **Step 3: Run exact-head full verification**

```bash
pnpm verify:full
```

Expected: frozen install, `pnpm verify`, Chromium install, complete Playwright suite, and clean-worktree gate pass at the same commit.

- [x] **Step 4: Inspect visual artifacts**

Confirm Zone colors, flat-surface alignment, committed/Preview isolation, invalid markers, Road overlap, Road-access depth, HUD counts, desktop layout, responsive/mobile layout, and restoration evidence directly from screenshots and traces.

- [x] **Step 5: Write evidence with exact values**

Record exact head SHA, command outputs, test counts, workflow/run IDs, artifact ID/size/hash, screenshots reviewed, remaining limitations, and merge gate. Do not use estimated or inherited counts.

- [x] **Step 6: Final scope audit**

Verify no Buildings, growth, Demand, Population, Economy, Utilities, Traffic, Mixed-use, slope zoning, generic occupancy framework, final art, or temporary CI workflow entered the diff.

- [x] **Step 7: Commit closure documents**

```bash
git add docs
git commit -m "docs: close Zoning Foundation v0.1"
```

- [x] **Step 8: Re-run exact-head verification after documentation commit**

Run `pnpm verify:full` again on the final documentation descendant before claiming completion or requesting merge.
