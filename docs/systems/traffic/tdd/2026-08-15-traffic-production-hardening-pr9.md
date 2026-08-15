# Traffic Production Hardening PR9 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the production-performance seams that are intentionally not authority: incremental derived graph rebuilds, visual headway, spatial materialization, LOD/pooling budgets, and instrumentation that proves the renderer never scales per frame with all logical Citizens/trips.

**Architecture:** Canonical Traffic remains `TrafficSnapshotV1`; all graph caches, spatial indexes, visual spacing and LOD are derived. `traffic-core` may maintain disposable graph/cache adapters keyed by exact source revisions. `traffic-three` receives immutable Traffic projections and camera queries, then materializes a bounded deterministic subset.

**Tech Stack:** TypeScript/Vitest, Three.js 0.185.1, existing Road mutation receipts and Traffic presentation metrics.

## Global Constraints

- This PR may optimize derived work only; canonical route/trip/queue semantics from PR5 cannot change silently.
- Incremental graph output must be fingerprint-equivalent to a full deterministic rebuild.
- Visual headway must not delay/advance authoritative arrival or queue order.
- Presentation caps never cancel logical trips.
- No full logical-trip scan in the per-frame camera update path.

---

# PR9 — `feat/traffic-materialization-performance-v0-1`

## Task 1: Add incremental derived graph reconciliation

**Files:**
- Create: `packages/traffic-core/src/graph-reconciler.ts`
- Modify: `packages/traffic-core/src/index.ts`
- Test: `packages/traffic-core/test/graph-reconciler.test.ts`
- Modify: `apps/game/src/traffic-source-projection.ts`
- Test: `apps/game/src/traffic-source-projection.test.ts`

**Produces:**

```ts
export interface TrafficGraphDirtyRegion {
  readonly changedRoadCells: readonly Readonly<{ x: number; z: number }>[];
  readonly changedBuildingIds: readonly string[];
}

export function reconcileTrafficGraphs(input: Readonly<{
  previousVehicleGraph: TrafficGraph;
  previousPedestrianGraph: TrafficGraph;
  roads: RoadTrafficSourceProjection;
  buildingAccess: readonly BuildingTrafficAccess[];
  dirty: TrafficGraphDirtyRegion;
}>): Readonly<{
  vehicleGraph: TrafficGraph;
  pedestrianGraph: TrafficGraph;
}>;
```

- [ ] RED: one changed straight Road cell rebuilds that cell + connectivity neighbors only.
- [ ] RED: Building frontage change rebuilds only affected access connectors.
- [ ] RED: incremental graph fingerprints exactly equal full `deriveVehicleTrafficGraph` / `derivePedestrianTrafficGraph` results.
- [ ] RED: discontinuous/missing previous source revision falls back to full rebuild rather than trusting stale cache.
- [ ] Implement canonical dirty expansion by changed cell + N/E/S/W neighbors; do not mutate Road state.
- [ ] GREEN and commit `perf(traffic): reconcile derived graphs by dirty region`.

## Task 2: Add visual vehicle headway projection

**Files:**
- Create: `packages/traffic-three/src/vehicle-spacing.ts`
- Modify: `packages/traffic-three/src/vehicle-agent.ts`
- Test: `packages/traffic-three/test/vehicle-spacing.test.ts`

**Produces:**

```ts
export interface VehicleVisualPlacement {
  readonly tripId: string;
  readonly edgeId: string;
  readonly distanceAlongEdgeMillimeters: number;
  readonly queued: boolean;
}

export function deriveVehicleVisualPlacements(
  inputs: readonly TrafficAgentProjection[],
  minimumHeadwayMillimeters: number,
): readonly VehicleVisualPlacement[];
```

- [ ] RED: two cars on the same visual lane are ordered by authoritative edge progress/queue order and rendered with minimum headway when geometry permits.
- [ ] RED: extreme logical density degrades by overlapping LOD/materialization eligibility rather than modifying Traffic snapshot/progress.
- [ ] RED: same input permutation yields same visual placement order by edge + authoritative progress + tripId.
- [ ] Implement presentation-only spacing; snapshot fingerprint before/after rendering remains identical.
- [ ] GREEN and commit `perf(traffic-three): add derived vehicle headway`.

## Task 3: Add spatial index with visited-work instrumentation

**Files:**
- Create: `packages/traffic-three/src/traffic-spatial-index.ts`
- Create: `packages/traffic-three/src/traffic-presentation-metrics.ts`
- Test: `packages/traffic-three/test/traffic-spatial-index.test.ts`
- Test: `packages/traffic-three/test/traffic-presentation-metrics.test.ts`

**Produces:**

```ts
export interface TrafficSpatialQueryMetrics {
  readonly bucketCount: number;
  readonly visitedBucketCount: number;
  readonly candidateTripCount: number;
}
```

- [ ] RED: 5,000 active trips distributed across spatial buckets; local camera query visits only intersecting buckets.
- [ ] RED: query output contains only geometrically relevant candidate routes/agents and is canonical by distance class then tripId.
- [ ] RED: instrumentation exposes visited bucket/candidate counts without wall-clock dependence.
- [ ] Implement reusable disposable index rebuilt only when committed Traffic route topology/revision requires it.
- [ ] GREEN and commit.

## Task 4: Freeze materialization/LOD policy and deterministic caps

**Files:**
- Create: `packages/traffic-three/src/materialization-policy.ts`
- Create: `packages/traffic-three/src/traffic-agent-materializer.ts`
- Modify: `packages/traffic-three/src/pedestrian-pool.ts`
- Modify: `packages/traffic-three/src/vehicle-pool.ts`
- Test: `packages/traffic-three/test/traffic-agent-materializer.test.ts`

**Foundation policy:**

```ts
export const FOUNDATION_TRAFFIC_PRESENTATION_POLICY = Object.freeze({
  maxPedestrians: 300,
  maxVehicles: 300,
  maxCombinedFullDetail: 500,
  nearUpdateEveryFrames: 1,
  midUpdateEveryFrames: 3,
});
```

- [ ] RED: >300 eligible Walk trips materialize <=300 pedestrians while all logical Walk trips remain in Traffic state.
- [ ] RED: >300 Drive trips materialize <=300 vehicles.
- [ ] RED: combined full-detail population <=500; overflow is assigned cheaper Mid/Far handling or no object.
- [ ] RED: deterministic selection order is spatial distance class → mode policy → tripId.
- [ ] RED: move camera away/back; pool reuse count increases and logical trip count/progress is unchanged.
- [ ] Implement Near/Mid/Far update policy and reuse pools.
- [ ] GREEN and commit.

## Task 5: Wire application presentation metrics and browser debug seam

**Files:**
- Modify: `apps/game/src/traffic-presentation.ts`
- Create: `apps/game/src/traffic-presentation-debug.ts`
- Test: `apps/game/src/traffic-presentation.test.ts`
- Test: `apps/game/src/traffic-presentation-debug.test.ts`

**Debug output:**

```ts
export interface TrafficPresentationDebugSnapshot {
  readonly trafficRevision: number;
  readonly logicalActiveTrips: number;
  readonly spatialCandidates: number;
  readonly visiblePedestrians: number;
  readonly visibleVehicles: number;
  readonly nearAgents: number;
  readonly midAgents: number;
  readonly poolReuseCount: number;
  readonly visitedSpatialBuckets: number;
}
```

- [ ] RED: debug snapshot proves materialized caps and reports candidate work.
- [ ] RED: presentation update API accepts Traffic presentation projection + camera only; no RCI Citizen collection parameter exists.
- [ ] RED: repeated camera-only updates do not rebuild/reconcile canonical Traffic snapshot.
- [ ] Implement a test/debug-only read seam consistent with existing browser harness conventions; do not add player-visible diagnostics.
- [ ] GREEN and commit.

## Task 6: PR9 performance evidence

**Files:**
- Add: `docs/systems/traffic/verification/2026-08-15-traffic-pr9-materialization-performance.md`

- [ ] Run deterministic suites:

```bash
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/traffic-three test
pnpm --filter @web-three-city/game test
pnpm check
```

- [ ] Run focused browser fixture at 414×896 with enough logical trips to exceed visual caps and assert debug counters remain inside policy.
- [ ] Capture measured frame/CPU/memory observations separately from deterministic pass/fail assertions; record browser/device/environment with results.
- [ ] Do not promote an arbitrary millisecond number to an authority contract during PR9 unless measured evidence supports a stable threshold. PR11 freezes release budgets from PR9 evidence.
- [ ] Verify clean worktree and merge PR9 only after all deterministic gates pass.

## Related Plans

- Main Traffic TDD: `2026-08-15-traffic-foundation-v0-1.md`
- Release PR11: `../../architecture-infrastructure/tdd/2026-08-15-citizen-mobility-traffic-release-pr11.md`
