# Road Lane & Vehicle Life Realism v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build versioned Road types, real two-direction lane geometry, lane-aware Traffic presentation, deterministic Household-owned vehicle life, persistent parking, and WorldSaveV8 migration without duplicating authority.

**Architecture:** Road definition codes remain canonical Road authority. Lane geometry and markings derive from Road definitions/connectivity; Traffic keeps edge-based routing and derives lane paths. A new Vehicle Life authority owns vehicle identity/location while RCI remains Household truth and Mobility chooses an available concrete vehicle for Drive trips.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, Three.js, Playwright, GitHub Actions Browser Verification Policy v0.2.

## Global Constraints

- Baseline is `master@eaa15d2f72f957c1d31169de2adcf4946f99b70e`.
- Never implement new work directly on `master`.
- `basic-road` remains canonical Road definition ID/code `1`.
- Road codes `2` and `3` are monotonic extensions and must never be reused.
- v1 has exactly one travel lane per direction for all three Road types.
- Production Traffic handedness defaults to `left` and must be centrally configured.
- Traffic routing remains edge-based; lane geometry is derived.
- Traffic trips never own vehicle identity.
- RCI Household membership/housing/employment remain authoritative inputs to Vehicle Life.
- Presentation never mutates Road, Traffic, Mobility, RCI, or Vehicle Life authority.
- Full Browser is escalation-only under Browser Verification Policy v0.2.
- Every PR uses focused RED/GREEN before `pnpm check`.

---

## PR1 — Road Definition Catalog & Upgrade Semantics

### Task 1: Add versioned Road catalog

**Files:**
- Modify: `packages/road-core/src/contracts.ts`
- Modify: `packages/road-core/src/index.ts`
- Test: existing `packages/road-core` contract/snapshot tests or create `packages/road-core/test/road-definition-catalog.test.ts`

**Produces:**

```ts
export type RoadDefinitionId = 'basic-road' | 'collector-road' | 'arterial-road';
export type RoadDefinitionCode = 0 | 1 | 2 | 3;
export const BASIC_ROAD_CODE = 1 as const;
export const COLLECTOR_ROAD_CODE = 2 as const;
export const ARTERIAL_ROAD_CODE = 3 as const;
export function roadDefinitionForCode(code: RoadDefinitionCode): RoadDefinition | null;
export function roadDefinitionForId(id: RoadDefinitionId): RoadDefinition;
```

- [ ] Write RED tests proving codes 1/2/3 resolve to `basic-road`/`collector-road`/`arterial-road`, widths are `0.72/0.82/0.92`, and unknown IDs fail closed.
- [ ] Run the focused test and confirm failure because only `basic-road` exists.
- [ ] Replace the singleton `if` resolver with a frozen definition catalog keyed by stable code/ID.
- [ ] Re-run focused tests and confirm GREEN.
- [ ] Commit `feat(roads): add versioned road definition catalog`.

### Task 2: Support deterministic Road replacement/upgrade

**Files:**
- Modify: `packages/road-core/src/contracts.ts`
- Modify: `packages/road-core/src/road-mutation.ts`
- Test: existing Road mutation tests

- [ ] Write RED coverage for empty→Local, Local→Collector, Collector→Arterial, Arterial→Local replacement, same-definition no-change, and Bulldoze→empty.
- [ ] Confirm RED with current `definitionId: 'basic-road'`-only mutation contract.
- [ ] Generalize `RoadStrokeInput.definitionId` to `RoadDefinitionId`; planning writes the selected code into the proposed snapshot and treats differing occupied definitions as replacement rather than no-change.
- [ ] Preserve occupancy semantics: replacement does not count as newly occupied Road; it does count as topology/presentation changed at the target cell.
- [ ] Re-run mutation tests GREEN and commit `feat(roads): support road type replacement`.

### Task 3: Lock RoadSaveV1 compatibility

**Files:**
- Modify only if required: `packages/road-core/src/road-snapshot.ts`
- Modify only if required: `packages/road-core/src/serialization.ts`
- Test: Road serialization tests

- [ ] Write RED/compatibility test encoding/decoding definition bytes `[0,1,2,3]` exactly under `RoadSaveV1`.
- [ ] Confirm validation currently rejects codes 2/3.
- [ ] Generalize snapshot validation to accept catalog codes without changing serialization shape/schema version.
- [ ] Verify legacy saves containing only 0/1 remain byte-for-byte compatible.
- [ ] Run `pnpm --filter @web-three-city/road-core test` and typecheck GREEN.
- [ ] Commit `test(roads): lock multi-definition RoadSaveV1 compatibility`.

### PR1 final gate

- [ ] Run Road-focused tests.
- [ ] Run `pnpm check` once after GREEN work is complete.
- [ ] Update `docs/systems/roads/README.md` with Road catalog and remaining limitations.
- [ ] Open/keep PR Draft until CI/Sonar are green.
- [ ] No Browser job is required unless this PR changes game UI/presentation.

---

## PR2 — Lane Geometry & Road Presentation

### Task 4: Add data-driven Road style profiles

**Files:**
- Create: `packages/road-three/src/road-style-profile.ts`
- Create: `packages/road-three/src/lane-marking-geometry.ts`
- Modify: `packages/road-three/src/road-geometry.ts`
- Modify: `packages/road-three/src/material-factory.ts`
- Modify: `packages/road-three/src/index.ts`
- Test: `packages/road-three` geometry tests

- [ ] RED: each Road definition produces a distinct surface width and center-divider geometry on a straight cell.
- [ ] GREEN: derive style from Road definition, never duplicate per-definition mesh builders.
- [ ] RED: four-way/T-junction cells suppress center markings within the junction interior.
- [ ] GREEN: generate marking segments only on non-junction carriageway regions.

### Task 5: Add Road type selection/upgrade UI

**Files:**
- Modify: `apps/game/src/ui/city-ui-runtime.ts`
- Modify relevant Road tool integration files
- Test: UI unit tests and `@road` Playwright

- [ ] RED: Road Build UI exposes Local Street, Collector Road, Arterial Road, Bulldoze using the compact Build workflow.
- [ ] GREEN: selecting a Road type changes only active Road definition, not tool ownership/simulation speed.
- [ ] Browser RED/GREEN: build all three, upgrade an occupied cell, bulldoze, and reload.

### PR2 gate

- [ ] `pnpm check`.
- [ ] Targeted Browser `@road`.
- [ ] Sonar + clean worktree.
- [ ] Manual 414×896 road-marking check if automated screenshots cannot prove readability.

---

## PR3 — Lane-aware Traffic

### Task 6: Extend Traffic Road profiles

**Files:**
- Modify: `packages/traffic-core/src/road-profile.ts`
- Modify tests under `packages/traffic-core/test`

- [ ] RED: profiles for Road codes 1/2/3 resolve deterministically with increasing free-flow speed/capacity.
- [ ] GREEN: add Local/Collector/Arterial profiles while keeping Road authority out of Traffic.

### Task 7: Add directed lane path derivation

**Files:**
- Create: `packages/traffic-three/src/directed-lane-path.ts`
- Create: `packages/traffic-three/src/intersection-lane-connector.ts`
- Modify: `packages/traffic-three/src/route-geometry.ts`
- Modify: `packages/traffic-three/src/index.ts`
- Test: `packages/traffic-three/test/route-motion.test.ts` plus focused new tests

**Produces:**

```ts
export type TrafficHandedness = 'left' | 'right';
export const FOUNDATION_TRAFFIC_HANDEDNESS: TrafficHandedness = 'left';
```

- [ ] RED: eastbound and westbound movement over the same Road edge yields opposite offsets from centerline under left-hand traffic.
- [ ] GREEN: derive lane offset from directed tangent + centrally configured handedness.
- [ ] RED: N→E, N→W, N→S connectors stay inside the intersection envelope and maintain continuous tangent; U-turn has no connector.
- [ ] GREEN: add deterministic curved intersection connector sampling.

### Task 8: Integrate lane paths into presentation and recovery

**Files:**
- Modify: `apps/game/src/traffic-presentation-projection.ts`
- Modify: `apps/game/src/traffic-runtime-presentation.ts`
- Modify: `packages/traffic-three/src/vehicle-spacing.ts` as required
- Tests: Traffic app + browser

- [ ] RED: opposing trips do not share visual centerline.
- [ ] RED: Road upgrade during an active trip preserves Traffic/Mobility identity while re-preparing presentation route.
- [ ] GREEN: keep canonical edge routing untouched; convert only presentation route preparation to directed lane geometry.
- [ ] Verify 1×/2×/4× frame-pipeline performance contract still holds.

### PR3 gate

- [ ] Traffic core + traffic-three focused tests.
- [ ] `pnpm check`.
- [ ] Targeted Browser `@road|@traffic`.
- [ ] 5,000 logical Traffic fixture.
- [ ] Owner 414×896 lane-direction visual acceptance.

---

## PR4 — Vehicle Life Authority

### Task 9: Create `vehicle-life-core`

**Files:**
- Create package workspace `packages/vehicle-life-core`
- Create `src/contracts.ts`
- Create `src/vehicle-snapshot.ts`
- Create `src/ownership-policy.ts`
- Create `src/vehicle-reconciler.ts`
- Create `src/persistence.ts`
- Create `src/index.ts`
- Create focused Vitest suite

**Produces:**

```ts
export type VehicleId = string;
export type VehicleLocation =
  | Readonly<{ kind: 'Parked'; buildingInstanceId: string }>
  | Readonly<{ kind: 'InTrip'; tripId: string; driverCitizenId: string }>
  | Readonly<{ kind: 'Stored' }>;
```

- [ ] RED: one deterministic primary vehicle for each employed resident Household member with valid housing; unemployed member receives none.
- [ ] GREEN: reconcile from indexed RCI projections without mutating RCI.
- [ ] RED: identical RCI inputs produce identical vehicle IDs/order.
- [ ] GREEN: deterministic IDs derive from stable Household/Citizen identity, not iteration timing.
- [ ] RED/GREEN: Parked→InTrip→Parked and Parked→Stored lifecycle.
- [ ] RED/GREEN: VehicleLifeSaveV1 deterministic round trip.
- [ ] Performance: prove 20k-Citizen reconciliation avoids quadratic household scans.

### PR4 gate

- [ ] vehicle-life-core tests/typecheck.
- [ ] RCI regression suite.
- [ ] `pnpm check`.
- [ ] No Browser gate unless presentation is touched.

---

## PR5 — Mobility Assignment & WorldSaveV8

### Task 10: Extend Mobility with concrete vehicle assignment

**Files:**
- Modify: `packages/citizen-mobility-core/src/contracts.ts`
- Modify: `packages/citizen-mobility-core/src/mode-choice.ts`
- Modify: `packages/citizen-mobility-core/src/mobility-planner.ts`
- Modify: `packages/citizen-mobility-core/src/mobility-reconciler.ts`
- Modify tests

- [ ] RED: Walk route + unavailable car chooses Walk and `vehicleId=null`.
- [ ] RED: available assigned car at trip origin chooses Drive with exact VehicleId.
- [ ] RED: Citizen who walked Home→Work cannot use their Home-parked car for Work→Home.
- [ ] RED: morning/evening Drive uses the same VehicleId.
- [ ] GREEN: Mobility consumes a narrow Vehicle Availability projection; it never mutates Vehicle Life directly.

### Task 11: Integrate atomic world tick/transaction

**Files:**
- Modify: `apps/game/src/game-world-state.ts`
- Modify: `apps/game/src/mobility-traffic-tick.ts`
- Modify committed-world transaction files
- Test atomic failure paths

- [ ] RED: Traffic route failure cannot leave Mobility Active or Vehicle InTrip.
- [ ] GREEN: plan Mobility + vehicle reservation + Traffic, then commit atomically or reject atomically.

### Task 12: Add MobilitySaveV2 + WorldSaveV8 migration

**Files:**
- Modify: `packages/citizen-mobility-core/src/persistence.ts`
- Modify: `apps/game/src/world-save.ts`
- Add migration tests/fixtures

- [ ] RED: MobilitySaveV2 preserves VehicleId.
- [ ] RED: WorldSaveV7 employed active Drive Citizen migrates to deterministic VehicleId + `InTrip` while preserving existing Traffic trip identity.
- [ ] RED: stationary Home/Work Citizen receives deterministic parked/stored vehicle according to the migration rule.
- [ ] GREEN: implement explicit V7→V8 migration; never mutate V7 input.

### PR5 gate

- [ ] Mobility + Vehicle Life + game focused tests.
- [ ] WorldSave V7/V8 tests.
- [ ] `pnpm check`.
- [ ] Targeted Browser `@traffic|@building` for save/commute integration.
- [ ] 20k Citizen + 5k Traffic fixtures.

---

## PR6 — Persistent Parking & Vehicle Presentation

### Task 13: Add parking anchor resolver

**Files:**
- Create: `packages/traffic-three/src/parking-anchor-resolver.ts`
- Create: `packages/traffic-three/src/vehicle-access-connector.ts`
- Modify: `packages/traffic-three/src/index.ts`
- Tests: focused geometry/anchor tests

- [ ] RED: same building/vehicle/Road definition resolves identical anchor.
- [ ] RED: Arterial never resolves curb parking inside an active lane.
- [ ] RED: multiple vehicles at one building get deterministic unique slots.
- [ ] GREEN: implement frontage→curb-if-allowed→lot-safe→null priority.

### Task 14: Key moving/parked presentation by VehicleId

**Files:**
- Create: `packages/traffic-three/src/vehicle-life-materializer.ts`
- Modify: `packages/traffic-three/src/vehicle-agent.ts`
- Modify: `packages/traffic-three/src/vehicle-pool.ts`
- Modify: `apps/game/src/traffic-runtime-presentation.ts`
- Modify: `apps/game/src/traffic-presentation-projection.ts`

- [ ] RED: Parked V1→Drive Trip→Parked V1 keeps same pooled visual identity while materialized.
- [ ] GREEN: pool key becomes VehicleId for Drive vehicles; appearance remains deterministic from VehicleId.
- [ ] RED/GREEN: pull-out and pull-in connectors form continuous visual routes to/from lane paths.
- [ ] RED: repeated RAF with unchanged canonical state performs no parking-anchor recompute, pool rebind, route rebuild, or global parked-vehicle scan.
- [ ] GREEN: precompute/reconcile on canonical revision/context change; RAF updates transforms only.

### PR6 gate

- [ ] traffic-three focused tests.
- [ ] `pnpm check`.
- [ ] Targeted Browser `@traffic|@building`.
- [ ] Presentation performance budget and 4× regression fixture.
- [ ] Owner 414×896 parked/depart/arrive visual acceptance.

---

## PR7 — Release Verification & Living Documentation

### Task 15: End-to-end Road hierarchy scenarios

- [ ] Browser: build Local/Collector/Arterial, upgrade Local→Collector, save/load, and keep active Traffic coherent.
- [ ] Browser: opposite commuters use opposite lane paths.

### Task 16: End-to-end persistent vehicle scenarios

- [ ] Morning: Vehicle V parked Home→Drive→parked Work.
- [ ] Evening: exact V drives Work→Home→parked Home.
- [ ] Assert same Citizen, Household, VehicleId, and appearance key.
- [ ] Walking coherence: if Citizen walks Home→Work, their car stays Home and is unavailable for evening Drive from Work.
- [ ] Road bulldoze/recovery preserves Citizen and VehicleId or fails cleanly.

### Task 17: Performance and release gates

- [ ] 20,000-Citizen fixture PASS.
- [ ] 5,000 logical Traffic trips PASS.
- [ ] Large logical parked-vehicle population remains presentation-capped.
- [ ] RAF work scales with materialized agents, not total logical vehicles.
- [ ] `pnpm check` PASS.
- [ ] targeted browser ownership sets PASS.
- [ ] Sonar Quality Gate PASS.
- [ ] clean-worktree verification PASS.
- [ ] Full Browser only if a Level-4 escalation trigger exists.

### Task 18: Living docs and owner acceptance

- [ ] Update `docs/systems/roads/README.md`.
- [ ] Update `docs/systems/traffic/README.md`.
- [ ] Update `docs/systems/citizen-mobility/README.md`.
- [ ] Create/update `docs/systems/vehicle-life/README.md`.
- [ ] Manual owner acceptance at 414×896 verifies Road type distinction, visible lane divider, opposite-direction lanes, parked cars near homes/workplaces, same vehicle round trip, and smooth 4× motion.
- [ ] Only after owner PASS mark final release PR Ready and squash-merge.
