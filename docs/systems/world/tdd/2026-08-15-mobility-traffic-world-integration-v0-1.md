# Mobility + Traffic World Integration v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compose Mobility and Traffic into the committed world, authoritative tick pipeline, Road-mutation reconciliation, and `WorldSaveV7` without creating cross-domain cycles or partial publication.

**Architecture:** `apps/game` owns adapters from RCI/Buildings/Roads/Simulation into Mobility/Traffic primitive projections. Mobility and Traffic snapshots become fields of `GameWorldState` and `CommittedWorld`; the application plans Mobility due boundaries, asks Traffic for route candidates, commits selected Mobility/Traffic trips, progresses Traffic, validates everything, then publishes once. Save/load decodes upstream domains first, then Mobility/Traffic with cross-reference validation.

**Tech Stack:** existing `apps/game/src/application/committed-world.ts`, `game-world-state.ts`, `game-world-tick.ts`, `world-save.ts`, TypeScript/Vitest.

## Global Constraints

- `apps/game` is the only package that sees RCI + Buildings + Roads + Mobility + Traffic together.
- World publication remains atomic and revision-fenced.
- Traffic routing for new trips reads the previous committed Traffic cost field.
- Road changes reconcile active routes only after the Road mutation is committed/staged coherently.
- Save V1–V6 behavior remains backward compatible.
- V1–V6 → V7 migration invents no active historical trip.
- World load rejects invalid Mobility/Traffic references atomically.

---

# PR6 — World/Application Integration + WorldSaveV7

**Branch:** `feat/mobility-traffic-world-integration-v0-1`

## Task 1: Add workspace dependencies and narrow source-projection adapters

**Files:**
- Modify: `apps/game/package.json`
- Create: `apps/game/src/mobility-source-projection.ts`
- Create: `apps/game/src/traffic-source-projection.ts`
- Test: `apps/game/src/mobility-source-projection.test.ts`
- Test: `apps/game/src/traffic-source-projection.test.ts`

**Dependencies added:**

```json
{
  "@web-three-city/citizen-mobility-core": "workspace:*",
  "@web-three-city/traffic-core": "workspace:*"
}
```

**Produces:**

```ts
export function createPresentCitizenMobilityProjection(
  rci: RciSnapshot,
  buildings: BuildingSnapshot,
  absoluteTick: number,
): readonly PresentCitizenMobilityProjection[];

export function createRoadTrafficSourceProjection(
  roads: RoadSnapshot,
  terrain: TerrainSnapshot,
): RoadTrafficSourceProjection;

export function createBuildingTrafficAccessProjection(
  buildings: BuildingSnapshot,
  roads: RoadSnapshot,
  environment: BuildingDevelopmentEnvironment,
): readonly BuildingTrafficAccess[];
```

- [ ] **RED:** projection maps a real employed/housed Citizen to exact current Home/Work Building IDs; no Home/Job returns null, not fake identifiers.
- [ ] **RED:** Building access uses deterministic accepted frontage from current Building/Road environment.
- [ ] **RED:** Road projection carries stable connection mask/revision and current terrain traversal information without moving ownership out of Road/Terrain.
- [ ] Implement adapters using existing RCI projections/assignments, Building instances/frontage helpers, and Road connectivity helpers.
- [ ] Run focused game tests GREEN.
- [ ] Commit `feat(world): add mobility traffic source projections`.

## Task 2: Extend `GameWorldState` and compatibility projection

**Files:**
- Modify: `apps/game/src/game-world-state.ts`
- Modify: `apps/game/src/application/committed-world.ts`
- Test: `apps/game/src/game-world-state.test.ts`
- Test: `apps/game/src/application/committed-world.test.ts`

**New fields:**

```ts
readonly mobility: MobilitySnapshotV1;
readonly traffic: TrafficSnapshotV1;
```

Update:

```ts
GameWorldState
GameWorldStateStore.synchronizeExternal(...)
CommittedWorld
CommittedWorldInput
CommittedDomainState
gameWorldStateFromCommittedWorld(...)
createCommittedWorld(...)
createCommittedWorldFromDomainState(...)
```

- [ ] **RED:** store replacement requires coherent Mobility/Traffic snapshots and preserves reference-free clone semantics expected by current world store.
- [ ] **RED:** compatibility projection contains Mobility/Traffic exactly once.
- [ ] **RED:** `createCommittedWorld` rejects Traffic whose saved source revisions are inconsistent with supplied Road/Building revision when active routes require those revisions.
- [ ] Implement fields/clone validation; do not add route logic to `committed-world.ts`.
- [ ] GREEN.
- [ ] Commit `feat(world): compose mobility and traffic snapshots`.

## Task 3: Add application coordinator for one Mobility/Traffic interval

**Files:**
- Create: `apps/game/src/mobility-traffic-tick.ts`
- Test: `apps/game/src/mobility-traffic-tick.test.ts`

**Consumes:** staged RCI/Buildings/Simulation from the existing world-tick pipeline plus current Roads/Mobility/Traffic.

**Produces:**

```ts
export interface MobilityTrafficTickResult {
  readonly mobility: MobilitySnapshotV1;
  readonly traffic: TrafficSnapshotV1;
  readonly mobilityReceipts: readonly unknown[];
  readonly trafficReceipts: readonly unknown[];
}

export function planMobilityTrafficTick(input: Readonly<{
  mobilityBefore: MobilitySnapshotV1;
  trafficBefore: TrafficSnapshotV1;
  rciAfter: RciSnapshot;
  buildingsAfter: BuildingSnapshot;
  roads: RoadSnapshot;
  simulationBefore: SimulationSnapshot;
  simulationAfter: SimulationSnapshot;
  trafficSource: Readonly<{
    roads: RoadTrafficSourceProjection;
    buildingAccess: readonly BuildingTrafficAccess[];
  }>;
}>): MobilityTrafficTickResult;
```

- [ ] **RED sequence test:** due Citizen boundary → Mobility request → Traffic Walk/Drive candidates based on previous cost → Mobility chooses mode → selected route creates one active Traffic trip with same `citizenId`/`tripId`.
- [ ] **RED:** no candidate creates failed Mobility outcome and no active Traffic trip.
- [ ] **RED:** death/emigration cancels downstream active Traffic trip in same staged result.
- [ ] **RED:** Pause interval (`beforeTick === afterTick`) returns authority unchanged.
- [ ] **RED:** Step one tick processes all due `GameMinute` boundaries inside the hour.
- [ ] Implement adapter/conductor only; algorithm stays in core packages.
- [ ] GREEN.
- [ ] Commit `feat(world): coordinate mobility and traffic tick`.

## Task 4: Insert Mobility/Traffic into `planGameWorldTick` after RCI reconciliation

**Files:**
- Modify: `apps/game/src/game-world-tick.ts`
- Modify: `apps/game/src/game-world-state.ts`
- Test: `apps/game/src/game-world-tick.test.ts`
- Test: `apps/game/src/game-world-tick-rci.test.ts` if existing split fixtures live there; otherwise extend the owning tick test file only.

**Canonical order after this PR:**

```text
read committed world
→ plan/commit Building Growth + Simulation advance
→ plan/commit RCI against staged Building/Simulation
→ reconcile Mobility against latest RCI/Buildings
→ generate due Mobility requests
→ derive Traffic route candidates from current Road/Building graph + previous Traffic costs
→ choose mode and stage selected Mobility/Traffic trips
→ progress active Traffic through the interval / queues
→ derive staged Traffic projection
→ settle Economy from staged RCI + current Roads
→ validate complete proposed state
→ publish one next GameWorldState revision
```

- [ ] **RED:** invalid Mobility/Traffic stage returns `valid:false` and original proposed state; store is not mutated.
- [ ] **RED:** successful tick increments world revision once, not once per subsystem.
- [ ] **RED:** Economy/RCI existing outputs remain unchanged when no Mobility boundary is due.
- [ ] **RED:** active tool/UI state tests remain unaffected because tick path still owns no presentation state.
- [ ] Implement coordinator call and new receipts in `GameWorldTickPlan`/`executeGameWorldTick`.
- [ ] Run impacted RCI/Economy/Game suites GREEN.
- [ ] Commit `feat(world): publish mobility traffic in atomic ticks`.

## Task 5: Reconcile explicit Road mutations with Traffic routes

**Files:**
- Create: `apps/game/src/traffic-road-reconciliation.ts`
- Modify the existing committed Road transaction orchestration file(s) that call `CommittedWorldStore.replace`; do not modify `road-core` to import Traffic.
- Test: `apps/game/src/traffic-road-reconciliation.test.ts`
- Extend existing Road mutation integration test where world transaction atomicity is already covered.

**Produces:**

```ts
export function reconcileTrafficAfterRoadChange(input: Readonly<{
  traffic: TrafficSnapshotV1;
  mobility: MobilitySnapshotV1;
  roadsAfter: RoadSnapshot;
  buildings: BuildingSnapshot;
  trafficSourceAfter: Readonly<{
    roads: RoadTrafficSourceProjection;
    buildingAccess: readonly BuildingTrafficAccess[];
  }>;
}>): TrafficSnapshotV1;
```

- [ ] **RED:** Road addition not affecting active route preserves trip route/progress.
- [ ] **RED:** Road removal affecting future route edge triggers core recovery from `lastStableNodeId`.
- [ ] **RED:** no recovery route marks Traffic trip failed; Mobility reconciliation receives that outcome on the next atomic application publication without deleting Citizen/Home/Job.
- [ ] **RED:** stale world revision blocks whole Road+Traffic publication.
- [ ] Implement application seam after successful Road plan and before complete-world replace.
- [ ] GREEN.
- [ ] Commit `feat(world): reconcile traffic after road mutations`.

## Task 6: Introduce `WorldSaveV7`

**Files:**
- Modify: `apps/game/src/world-save.ts`
- Modify: `apps/game/src/world-save-legacy.ts` only if type/export plumbing requires it; do not rewrite old decoders.
- Test: `apps/game/src/world-save.test.ts`
- Create: `apps/game/src/mobility-traffic-save-continuation.test.ts`

**New schema:**

```ts
export interface WorldSaveV7 extends Omit<WorldSaveV6, 'schemaVersion'> {
  readonly schemaVersion: 7;
  readonly mobility: MobilitySaveV1;
  readonly traffic: TrafficSaveV1;
}
```

`DecodedWorldState` adds:

```ts
readonly mobility: MobilitySnapshotV1;
readonly traffic: TrafficSnapshotV1;
```

- [ ] **RED:** `encodeWorldSaveV7` round-trips Mobility + Traffic with exact fingerprints.
- [ ] **RED:** active mid-Walk trip retains same trip/route/progress after decode.
- [ ] **RED:** active queued Drive trip retains queue/order/progress.
- [ ] **RED:** invalid Traffic→Mobility trip cross-reference fails `world-save:invalid-traffic`.
- [ ] **RED:** V1–V6 migration creates deterministic stationary Mobility states and empty Traffic active trips; no synthetic catch-up trip.
- [ ] **RED:** V6 economy/simulation values survive migration unchanged.
- [ ] Implement `encodeWorldSaveV7`, detect V7 first, reuse current V6 decoder path for upstream domains, then decode/migrate Mobility and Traffic in dependency order.
- [ ] Add error codes:

```ts
'world-save:invalid-mobility'
'world-save:invalid-traffic'
```

- [ ] Run continuation equivalence comparing N ticks continuous vs save/reload at midpoint then remaining ticks.
- [ ] GREEN.
- [ ] Commit `feat(world): persist mobility traffic in world save v7`.

## Task 7: Final PR6 integration gate and docs

**Files:**
- Modify: `docs/systems/world/README.md`
- Modify: `docs/systems/citizen-mobility/README.md`
- Modify: `docs/systems/traffic/README.md`
- Add verification record under `docs/systems/world/verification/` after exact-head tests.

- [ ] Run:

```bash
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
pnpm check
```

Expected: PASS.

- [ ] Verify World README is corrected to current `WorldSaveV7` and current committed-world fields; remove stale statements that world composition stops at RCI/Economy.
- [ ] Record exact candidate SHA and commands in PR body/verification doc.
- [ ] Commit docs and squash-merge PR6.

---

## PR6 Handoff to Presentation

After merge, `apps/game` must expose immutable Traffic agent/edge projections to presentation; PR7+ must not read RCI directly to create random people/cars.

Expected seam:

```ts
export interface TrafficPresentationSnapshot {
  readonly trafficRevision: number;
  readonly agents: readonly TrafficAgentProjection[];
  readonly edges: readonly TrafficEdgeProjection[];
}
```

The exact helper may live in `apps/game/src/traffic-presentation-projection.ts`; it contains no Three.js object and no mutation methods.

## Related Plans

- Execution index: `../../architecture-infrastructure/tdd/2026-08-15-citizen-mobility-traffic-foundation-v0-1-execution-index.md`
- Mobility: `../../citizen-mobility/tdd/2026-08-15-citizen-mobility-foundation-v0-1.md`
- Traffic: `../../traffic/tdd/2026-08-15-traffic-foundation-v0-1.md`
