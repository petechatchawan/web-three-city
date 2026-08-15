# Traffic Foundation v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route and progress real Citizen Walk/Drive trips over derived transport graphs, produce deterministic queues/congestion, and materialize real pedestrians/cars in Three.js under strict mobile budgets.

**Architecture:** `traffic-core` owns derived graph/profile/routing/progression/queue/congestion authority and has no dependencies on RCI, Mobility, Road, Building, DOM, or Three.js. `traffic-three` consumes immutable Traffic projections and owns geometry sampling, pooled visual agents, spatial materialization and LOD only. `apps/game` supplies narrow Road/Building/Mobility projections and performs all cross-domain composition.

**Tech Stack:** TypeScript 6, Vitest 4, Three.js 0.185.1, pnpm workspace packages, Playwright for game/browser acceptance.

## Global Constraints

- Every Traffic trip carries the Mobility `tripId` and real RCI `citizenId`; Traffic creates neither identity.
- Road cells/connectivity and Building frontage remain upstream authority.
- Derived graph/cache/spatial-index state is disposable and not saved as authority.
- Walk and Drive are first-class from v0.1.
- New route costs use the previous committed Traffic cost field.
- Normal congestion does not reroute active trips; topology/destination invalidation may recover deterministically.
- Traffic authority advances on deterministic game time/fixed-point progress, never render frame delta.
- Traffic Three cannot mutate `TrafficSnapshotV1`.
- No anonymous production pedestrians/cars.
- Presentation caps are not simulation caps.

---

# PR3 — Traffic Contracts, Profiles, Building Access, Pedestrian + Vehicle Graphs

**Branch:** `feat/traffic-graph-v0-1`

## Task 1: Scaffold `traffic-core`

**Files:**
- Create: `packages/traffic-core/package.json`
- Create: `packages/traffic-core/tsconfig.json`
- Create: `packages/traffic-core/tsconfig.build.json`
- Create: `packages/traffic-core/vitest.config.ts`
- Create: `packages/traffic-core/src/index.ts`
- Test: `packages/traffic-core/test/public-api.test.ts`

**Produces:**

```ts
export const TRAFFIC_SCHEMA_VERSION = 1 as const;
```

- [ ] Write RED import test.
- [ ] Run `pnpm --filter @web-three-city/traffic-core test` and verify missing package/export.
- [ ] Add package config matching dependency-free core package conventions.
- [ ] Run package test/typecheck GREEN.
- [ ] Commit `feat(traffic): add core package boundary`.

## Task 2: Define Traffic source, graph, route and snapshot contracts

**Files:**
- Create: `packages/traffic-core/src/contracts.ts`
- Create: `packages/traffic-core/src/errors.ts`
- Create: `packages/traffic-core/src/traffic-snapshot.ts`
- Create: `packages/traffic-core/src/traffic-fingerprint.ts`
- Modify: `packages/traffic-core/src/index.ts`
- Test: `packages/traffic-core/test/contracts.test.ts`
- Test: `packages/traffic-core/test/traffic-snapshot.test.ts`

**Produces:**

```ts
export type TrafficNodeId = string;
export type TrafficEdgeId = string;
export type TrafficMode = 'Walk' | 'Drive';
export type TrafficTripStatus = 'Active' | 'Arrived' | 'Failed' | 'Cancelled';

export interface RoadTrafficSourceCell {
  readonly x: number;
  readonly z: number;
  readonly definitionCode: number;
  readonly connectionMask: number;
  readonly elevationStartQ: number;
  readonly elevationEndQ: number;
}

export interface RoadTrafficSourceProjection {
  readonly roadRevision: number;
  readonly width: number;
  readonly height: number;
  readonly cells: readonly RoadTrafficSourceCell[];
}

export interface BuildingTrafficAccess {
  readonly buildingInstanceId: string;
  readonly frontageRoadX: number;
  readonly frontageRoadZ: number;
  readonly frontageDirection: 'N' | 'E' | 'S' | 'W';
}

export interface TrafficGraphNode {
  readonly nodeId: TrafficNodeId;
  readonly xQ: number;
  readonly zQ: number;
  readonly yQ: number;
}

export interface TrafficGraphEdge {
  readonly edgeId: TrafficEdgeId;
  readonly fromNodeId: TrafficNodeId;
  readonly toNodeId: TrafficNodeId;
  readonly mode: TrafficMode;
  readonly lengthQ: number;
  readonly freeFlowTravelSeconds: number;
  readonly capacityUnits: number;
}
```

`TrafficSnapshotV1` starts with `revision`, `policyVersion`, `graphSourceRoadRevision`, `graphSourceBuildingRevision`, and `activeTrips`.

- [ ] RED: reject duplicate node/edge IDs, dangling edge nodes, unsafe capacities/times, duplicate active trip IDs, invalid segment index/progress.
- [ ] Implement explicit safe-integer validators and canonical stable sorting.
- [ ] Add deterministic fingerprint independent of input insertion order.
- [ ] Run package GREEN.
- [ ] Commit `feat(traffic): define graph and traffic authority contracts`.

## Task 3: Add versioned basic-road traffic profile registry

**Files:**
- Create: `packages/traffic-core/src/road-profile.ts`
- Modify: `packages/traffic-core/src/index.ts`
- Test: `packages/traffic-core/test/road-profile.test.ts`

**Produces:**

```ts
export interface TrafficRoadProfileV1 {
  readonly definitionCode: number;
  readonly freeFlowSpeedMillimetersPerSecond: number;
  readonly edgeCapacityUnits: number;
  readonly intersectionServiceUnitsPerSecondQ: number;
  readonly pedestrianOffsetMillimeters: number;
  readonly vehicleOffsetMillimeters: number;
}

export const FOUNDATION_TRAFFIC_ROAD_PROFILES: readonly TrafficRoadProfileV1[];
export function resolveTrafficRoadProfile(definitionCode: number): TrafficRoadProfileV1;
```

- [ ] RED profile validation for duplicate definition code, nonpositive speed/capacity and invalid offsets.
- [ ] Freeze one foundation profile for current `basic-road` code; do not change `road-core` authority.
- [ ] GREEN and commit.

## Task 4: Derive deterministic vehicle graph from Road source projection

**Files:**
- Create: `packages/traffic-core/src/vehicle-graph.ts`
- Modify: `packages/traffic-core/src/index.ts`
- Test: `packages/traffic-core/test/vehicle-graph.test.ts`

**Produces:**

```ts
export interface TrafficGraph {
  readonly sourceRoadRevision: number;
  readonly sourceBuildingRevision: number;
  readonly nodes: readonly TrafficGraphNode[];
  readonly edges: readonly TrafficGraphEdge[];
}

export function deriveVehicleTrafficGraph(
  roads: RoadTrafficSourceProjection,
  profiles: readonly TrafficRoadProfileV1[],
): TrafficGraph;
```

- [ ] RED fixtures: straight road yields two directed edges per cardinal connection; T and four-way intersections create stable node/edge IDs; disconnected cells do not connect; input permutation yields same fingerprint.
- [ ] Graph IDs must derive from canonical cell/direction coordinates, not array position.
- [ ] Use integer metric conversion from current 8m Gameplay Cell geometry.
- [ ] GREEN and commit.

## Task 5: Derive deterministic pedestrian sidewalk/access graph

**Files:**
- Create: `packages/traffic-core/src/pedestrian-graph.ts`
- Create: `packages/traffic-core/src/building-access.ts`
- Modify: `packages/traffic-core/src/index.ts`
- Test: `packages/traffic-core/test/pedestrian-graph.test.ts`
- Test: `packages/traffic-core/test/building-access.test.ts`

**Produces:**

```ts
export interface BuildingAccessNodePair {
  readonly buildingInstanceId: string;
  readonly walkAccessNodeId: TrafficNodeId;
  readonly driveAccessNodeId: TrafficNodeId;
}

export function derivePedestrianTrafficGraph(...): TrafficGraph;
export function deriveBuildingAccessNodes(...): readonly BuildingAccessNodePair[];
```

- [ ] RED: Building access must use supplied accepted frontage road cell/direction; no arbitrary nearest-Road fallback.
- [ ] RED: pedestrian path is offset from vehicle centerline and remains connected across straight/corner/intersection fixtures.
- [ ] RED: inaccessible/missing frontage produces no access pair.
- [ ] Implement deterministic corridor/access-node IDs and geometry Q coordinates.
- [ ] Run PR3 gate:

```bash
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/traffic-core typecheck
pnpm check
```

- [ ] Update Traffic README exact package/files; status remains Partial.
- [ ] Commit docs/evidence and merge PR3 only after GREEN.

---

# PR4 — Deterministic Multimodal Routing + Candidate Costs

**Branch:** `feat/traffic-routing-v0-1`

## Task 6: Implement deterministic A* priority/tie contract

**Files:**
- Create: `packages/traffic-core/src/routing-priority.ts`
- Create: `packages/traffic-core/src/route-planner.ts`
- Modify: `packages/traffic-core/src/index.ts`
- Test: `packages/traffic-core/test/route-planner.test.ts`

**Produces:**

```ts
export interface TransportRouteRequest {
  readonly requestTripId: string;
  readonly citizenId: string;
  readonly mode: 'Walk' | 'Drive';
  readonly originAccessNodeId: string;
  readonly destinationAccessNodeId: string;
}

export interface TransportRouteCandidate {
  readonly requestTripId: string;
  readonly mode: 'Walk' | 'Drive';
  readonly available: boolean;
  readonly generalizedCostSeconds: number | null;
  readonly routeEdgeIds: readonly string[];
}

export function planTransportRoute(...): TransportRouteCandidate;
```

- [ ] RED equal-cost diamond graph chooses stable canonical path using `(totalCost, traversalCount, nodeId, edgeId)` ordering.
- [ ] RED graph input permutation returns byte-identical candidate.
- [ ] RED unreachable returns `available:false`, `cost:null`, empty route.
- [ ] RED unsafe negative cost is rejected.
- [ ] Implement deterministic priority queue; never depend on `Map` iteration as tie-break.
- [ ] GREEN and commit.

## Task 7: Add lagged Traffic cost field and Walk/Drive generalized costs

**Files:**
- Create: `packages/traffic-core/src/traffic-cost-field.ts`
- Modify: `packages/traffic-core/src/route-planner.ts`
- Test: `packages/traffic-core/test/traffic-cost-field.test.ts`
- Test: `packages/traffic-core/test/multimodal-routing.test.ts`

**Produces:**

```ts
export interface TrafficCostField {
  readonly trafficRevision: number;
  readonly edgeTravelSecondsById: ReadonlyMap<string, number>;
  readonly queueDelaySecondsByNodeId: ReadonlyMap<string, number>;
}

export function deriveTrafficCostField(...): TrafficCostField;
export function planModeCandidates(...): readonly TransportRouteCandidate[];
```

- [ ] RED: Drive candidate uses **previous committed** cost field, not values being generated by current departures.
- [ ] RED: Walk cost uses pedestrian graph travel time; Drive includes access + route + committed congestion delay.
- [ ] RED: candidate output order is always Walk then Drive.
- [ ] Implement adapters entirely inside `traffic-core` primitives; Mobility chooses the winner later through `apps/game`.
- [ ] GREEN and commit.

## Task 8: Add disposable route cache keyed only by derived revisions/policy

**Files:**
- Create: `packages/traffic-core/src/route-cache.ts`
- Test: `packages/traffic-core/test/route-cache.test.ts`

Key exactly:

```ts
interface RouteCacheKey {
  mode: 'Walk' | 'Drive';
  originAccessNodeId: string;
  destinationAccessNodeId: string;
  roadGraphRevision: number;
  trafficCostRevision: number;
  routingPolicyVersion: 1;
}
```

- [ ] RED cache hit/miss/revision invalidation tests.
- [ ] Assert cached/uncached route candidates have identical fingerprints.
- [ ] Do not serialize cache.
- [ ] PR4 full Traffic package + root `pnpm check` GREEN.
- [ ] Commit and merge.

---

# PR5 — Active Progression, Intersection Queues, Congestion, Recovery

**Branch:** `feat/traffic-flow-v0-1`

## Task 9: Add active transport-trip creation and fixed-point progression

**Files:**
- Create: `packages/traffic-core/src/transport-trip.ts`
- Create: `packages/traffic-core/src/traffic-progress.ts`
- Modify: `packages/traffic-core/src/traffic-snapshot.ts`
- Test: `packages/traffic-core/test/traffic-progress.test.ts`

**Produces:**

```ts
export interface ActiveTransportTrip {
  readonly tripId: string;
  readonly citizenId: string;
  readonly mode: 'Walk' | 'Drive';
  readonly originBuildingId: string;
  readonly destinationBuildingId: string;
  readonly routeEdgeIds: readonly string[];
  readonly routeGraphRevision: number;
  readonly segmentIndex: number;
  readonly progressQ: number; // 0..1_000_000
  readonly lastStableNodeId: string;
  readonly queuedMovement: Readonly<{ fromEdgeId: string; toEdgeId: string }> | null;
  readonly status: 'Active' | 'Arrived' | 'Failed' | 'Cancelled';
  readonly failureReason: 'UnreachableDestination' | null;
}
```

- [ ] RED: exact edge boundary progression, multi-edge progression, arrival, Pause equivalent zero elapsed, deterministic chunking (60s once equals 30s twice when no service boundary differs).
- [ ] Implement integer/fixed-point `progressQ`; geometry floats remain outside core.
- [ ] GREEN and commit.

## Task 10: Add deterministic unsignalized intersection service/queue policy

**Files:**
- Create: `packages/traffic-core/src/intersection-policy.ts`
- Create: `packages/traffic-core/src/intersection-queue.ts`
- Modify: `packages/traffic-core/src/traffic-progress.ts`
- Test: `packages/traffic-core/test/intersection-queue.test.ts`

**Queue order:**

```text
logical arrival time
→ versioned movement priority
→ tripId
```

- [ ] RED: over-capacity node creates waiting state rather than pass-through.
- [ ] RED: equal arrival/movement priority resolves by `tripId`.
- [ ] RED: queue service result is invariant to input array ordering.
- [ ] Implement one `FOUNDATION_INTERSECTION_POLICY_V1`; no traffic lights/sign gameplay.
- [ ] GREEN and commit.

## Task 11: Derive load/capacity/congestion and next lagged cost field

**Files:**
- Create: `packages/traffic-core/src/traffic-flow.ts`
- Create: `packages/traffic-core/src/traffic-projection.ts`
- Test: `packages/traffic-core/test/traffic-flow.test.ts`

**Produces:**

```ts
export interface TrafficEdgeProjection {
  readonly edgeId: string;
  readonly activeTripCount: number;
  readonly capacityUnits: number;
  readonly loadRatioMilli: number;
  readonly queueDelaySeconds: number;
  readonly effectiveTravelSeconds: number;
  readonly congestionMilli: number;
}

export function createTrafficProjection(...): Readonly<{
  edges: readonly TrafficEdgeProjection[];
}>;
```

- [ ] RED monotonicity: same edge/profile with more active Drive trips or queue wait cannot reduce effective travel seconds.
- [ ] RED zero load equals free-flow time.
- [ ] RED output canonical edge order.
- [ ] Implement integer formulas in `TrafficFlowPolicyV1`; document constants in source and Traffic README.
- [ ] GREEN and commit.

## Task 12: Recover invalidated routes from stable logical anchors

**Files:**
- Create: `packages/traffic-core/src/route-recovery.ts`
- Modify: `packages/traffic-core/src/traffic-progress.ts`
- Test: `packages/traffic-core/test/route-recovery.test.ts`

**Produces:**

```ts
export interface RouteRecoveryRequest {
  readonly tripId: string;
  readonly lastStableNodeId: string;
  readonly latestDestinationAccessNodeId: string | null;
}

export function recoverInvalidatedRoute(...):
  | Readonly<{ status: 'recovered'; routeEdgeIds: readonly string[] }>
  | Readonly<{ status: 'failed'; reason: 'UnreachableDestination' }>;
```

- [ ] RED remaining-route still valid → no recovery.
- [ ] RED deleted upcoming Road edge → replan from `lastStableNodeId`.
- [ ] RED latest destination changed → target latest destination access node.
- [ ] RED no destination/route → typed failure, Citizen identity untouched.
- [ ] GREEN.

## Task 13: Add TrafficSaveV1 codec and 5k concurrent-trip scale fixture

**Files:**
- Create: `packages/traffic-core/src/persistence.ts`
- Modify: `packages/traffic-core/src/index.ts`
- Test: `packages/traffic-core/test/persistence.test.ts`
- Test: `packages/traffic-core/test/traffic-scale.test.ts`

Persist active route/progress/queue authority, not graph/cache/projection.

- [ ] RED round-trip exact snapshot fingerprint with queued and mid-edge trips.
- [ ] RED reject graph revision mismatch/dangling route edges when decoder receives validation environment.
- [ ] Scale fixture: 5,000 deterministic active trips; progress two identical snapshots and compare fingerprints.
- [ ] Run PR5 gate:

```bash
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/traffic-core typecheck
pnpm check
```

- [ ] Commit docs/evidence and merge.

---

# PR7 — Real Pedestrian Three.js Agents

**Branch:** `feat/traffic-pedestrian-agents-v0-1`

## Task 14: Scaffold `traffic-three` and route geometry sampler

**Files:**
- Create: `packages/traffic-three/package.json`
- Create: `packages/traffic-three/tsconfig.json`
- Create: `packages/traffic-three/tsconfig.build.json`
- Create: `packages/traffic-three/vitest.config.ts`
- Create: `packages/traffic-three/src/index.ts`
- Create: `packages/traffic-three/src/route-geometry.ts`
- Test: `packages/traffic-three/test/route-geometry.test.ts`

Dependencies: `three` plus `@web-three-city/traffic-core` stable projection types only.

- [ ] RED straight/corner path geometry and `progressQ` sampling.
- [ ] Implement deterministic world-position sampling after logical edge/progress is fixed.
- [ ] GREEN and commit.

## Task 15: Add pooled pedestrian agent presentation

**Files:**
- Create: `packages/traffic-three/src/pedestrian-agent.ts`
- Create: `packages/traffic-three/src/pedestrian-pool.ts`
- Create: `packages/traffic-three/src/pedestrian-appearance.ts`
- Test: `packages/traffic-three/test/pedestrian-agent.test.ts`
- Test: `packages/traffic-three/test/pedestrian-pool.test.ts`

**Produces:**

```ts
export interface TrafficPedestrianVisualInput {
  readonly tripId: string;
  readonly citizenId: string;
  readonly routeEdgeId: string;
  readonly progressQ: number;
  readonly queued: boolean;
}
```

- [ ] RED: visual object preserves linked Citizen/trip IDs in `userData`/adapter metadata.
- [ ] RED: release→acquire reuses pooled hierarchy; no duplicate active assignment.
- [ ] RED: deterministic appearance seed from Citizen ID gives same variant after rematerialization.
- [ ] Implement low-poly primitive citizen prototype and `Idle`/`Walk` animation phase without authoring new Citizen facts.
- [ ] Run package GREEN.
- [ ] Commit.

## Task 16: Integrate pedestrian presentation into game scene without changing world authority

**Files:**
- Create: `apps/game/src/traffic-presentation.ts`
- Modify: `apps/game/package.json` to depend on `traffic-three` after PR6 has added core dependencies.
- Modify focused bootstrap composition file(s) only; if `game-bootstrap.ts` would exceed responsibility, extract mount/update/dispose into `traffic-presentation.ts` rather than adding route logic to bootstrap.
- Test: `apps/game/src/traffic-presentation.test.ts`

- [ ] RED: committed Walk trip projection mounts a pedestrian; removing visual eligibility dematerializes but leaves world snapshot untouched.
- [ ] GREEN game test/typecheck + root check.
- [ ] Commit/merge PR7.

---

# PR8 — Real Vehicle Three.js Agents

**Branch:** `feat/traffic-vehicle-agents-v0-1`

## Task 17: Add pooled vehicle prototype and route/turn presentation

**Files:**
- Create: `packages/traffic-three/src/vehicle-agent.ts`
- Create: `packages/traffic-three/src/vehicle-pool.ts`
- Create: `packages/traffic-three/src/vehicle-appearance.ts`
- Modify: `packages/traffic-three/src/route-geometry.ts`
- Modify: `packages/traffic-three/src/index.ts`
- Test: `packages/traffic-three/test/vehicle-agent.test.ts`
- Test: `packages/traffic-three/test/vehicle-pool.test.ts`

**Produces:** `Drive | Stop | Turn` presentation states from immutable Traffic projection.

- [ ] RED: one materialized car maps to one active Drive `tripId` + real `citizenId`.
- [ ] RED: queued projection produces stopped car and does not advance logical snapshot.
- [ ] RED: corner transition uses smooth presentation turn but retains authoritative edge order.
- [ ] RED: deterministic visual variant/color across rematerialization.
- [ ] Implement and GREEN.
- [ ] Commit.

## Task 18: Integrate vehicle agents into game presentation

**Files:**
- Modify: `apps/game/src/traffic-presentation.ts`
- Test: `apps/game/src/traffic-presentation.test.ts`

- [ ] RED mixed Walk/Drive snapshot creates correct separate agent types.
- [ ] RED car/pedestrian disposal does not mutate Traffic snapshot fingerprint.
- [ ] GREEN + root check.
- [ ] Merge PR8.

---

# PR9 — Spatial Materialization, LOD, Caps, Pooling Performance

**Branch:** `feat/traffic-materialization-performance-v0-1`

## Task 19: Add derived active-route spatial index

**Files:**
- Create: `packages/traffic-three/src/traffic-spatial-index.ts`
- Test: `packages/traffic-three/test/traffic-spatial-index.test.ts`

**Produces:**

```ts
export interface TrafficSpatialQuery {
  readonly centerX: number;
  readonly centerZ: number;
  readonly radius: number;
}

export function buildTrafficSpatialIndex(...): TrafficSpatialIndex;
export function queryTrafficSpatialIndex(...): readonly TrafficAgentProjection[];
```

- [ ] RED query only returns intersecting spatial buckets and canonical trip order.
- [ ] RED instrumentation counts visited buckets/trips and proves a local camera query does not scan all 5,000 logical trips.
- [ ] Implement disposable index; never persist it.
- [ ] GREEN.

## Task 20: Add deterministic materialization selector and budgets

**Files:**
- Create: `packages/traffic-three/src/materialization-policy.ts`
- Create: `packages/traffic-three/src/traffic-agent-materializer.ts`
- Test: `packages/traffic-three/test/traffic-agent-materializer.test.ts`

**Foundation defaults:**

```ts
export const FOUNDATION_TRAFFIC_PRESENTATION_POLICY = Object.freeze({
  maxPedestrians: 300,
  maxVehicles: 300,
  maxCombinedFullDetail: 500,
});
```

- [ ] RED >300 eligible pedestrians caps at 300 without changing logical trip count.
- [ ] RED >300 eligible vehicles caps at 300.
- [ ] RED deterministic choice under cap uses spatial distance class then `tripId`.
- [ ] RED camera change may change materialized set but not Traffic fingerprint.
- [ ] Implement Near/Mid/Far tiers and pool acquire/release.
- [ ] GREEN.

## Task 21: Add update-cadence/LOD instrumentation

**Files:**
- Create: `packages/traffic-three/src/traffic-presentation-metrics.ts`
- Modify: `apps/game/src/traffic-presentation.ts`
- Test: `packages/traffic-three/test/presentation-metrics.test.ts`
- Test: `apps/game/src/traffic-presentation.test.ts`

- [ ] Track logical trip count, queried bucket count, eligible visual count, materialized pedestrian/vehicle count, pool acquire/reuse counts, and per-tier update counts.
- [ ] RED asserts update function receives/query-results only; no API accepts the complete RCI Citizen collection.
- [ ] Add a browser-readable debug snapshot behind existing test/debug integration seam, not player UI.
- [ ] Run PR9 package/game/root check.
- [ ] Record deterministic scale counts plus non-gating measured CPU/frame/memory observations in PR body.
- [ ] Commit/merge PR9.

---

## PR3–PR9 Verification Commands

Core PRs:

```bash
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/traffic-core typecheck
pnpm check
```

Presentation PRs:

```bash
pnpm --filter @web-three-city/traffic-three test
pnpm --filter @web-three-city/traffic-three typecheck
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
pnpm check
```

Do not claim visual acceptance from unit tests. PR7–PR9 may use focused browser smoke evidence, but canonical visual acceptance is PR11.

## Related Plans

- Execution index: `../../architecture-infrastructure/tdd/2026-08-15-citizen-mobility-traffic-foundation-v0-1-execution-index.md`
- Mobility: `../../citizen-mobility/tdd/2026-08-15-citizen-mobility-foundation-v0-1.md`
- World integration: `../../world/tdd/2026-08-15-mobility-traffic-world-integration-v0-1.md`
- City UI: `../../city-ui/tdd/2026-08-15-citizen-traffic-inspect-information-view-v0-1.md`
