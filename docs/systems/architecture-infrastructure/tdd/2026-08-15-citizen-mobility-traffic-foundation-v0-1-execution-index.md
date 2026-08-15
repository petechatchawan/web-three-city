# Citizen Mobility & Traffic Foundation v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver real Citizen walking, real Citizen-linked car traffic, deterministic Home ↔ Work commuting, congestion/queues, exact Save/Load, bounded Three.js materialization, Inspect/Traffic UI, and production acceptance without creating a second Citizen authority.

**Architecture:** Existing RCI remains Citizen identity/lifecycle authority. `citizen-mobility-core` owns activity/schedule/trip intent; `traffic-core` owns derived transport graphs, routes, logical progression, queues and congestion; `traffic-three` materializes only visible/relevant real trips. `apps/game` is the only cross-domain composition layer and publishes Mobility/Traffic atomically with the committed world.

**Tech Stack:** TypeScript 6, pnpm workspaces, Vitest 4, Three.js 0.185.1, Vite 8, Playwright 1.61, existing `apps/game` committed-world/world-save orchestration.

## Global Constraints

- Existing RCI `CitizenId` is the sole Citizen identity/lifecycle authority.
- `rci-core`, `road-core`, `building-core`, and `simulation-core` must not import Mobility or Traffic.
- `citizen-mobility-core` and `traffic-core` are sibling packages; they do not import each other.
- Cross-system translation and atomic composition live in `apps/game`.
- Every production pedestrian maps to one real active Walk trip; every production car maps to one real active Drive trip.
- No anonymous/decorative pedestrian or car may be counted as canonical v0.1 traffic.
- Off-screen trips continue logically; camera, LOD, pooling, animation, and render delta never change authority.
- Mobility event ordering uses deterministic integer game time; Traffic progression uses deterministic integer/fixed-point time/progress.
- New routes use the previous committed Traffic-cost projection; no same-tick route ↔ congestion cycle.
- Road topology mutation may trigger deterministic recovery; ordinary congestion does not mid-trip reroute in v0.1.
- `MobilitySaveV1` + `TrafficSaveV1` extend the world envelope as `WorldSaveV7`.
- V1–V6 migration starts Citizens stationary at valid current places and creates no synthetic historical/catch-up trips.
- Foundation scale gate: at least 20,000 logical Citizens and 5,000 concurrent logical trips.
- Presentation target: at most 300 visible pedestrians, at most 300 visible vehicles, with a normal combined full-detail target of 400–500 agents.
- No per-frame scan over all Citizens or all logical trips.
- City UI M6.4 remains frozen; PR10 extends its Inspect/Information View seams without redesigning shell authority.

---

## Planning PR Closure — PR #68

**Purpose:** Freeze design + implementation packet before production code.

- [ ] Confirm PR #68 contains only `docs/systems/**` changes.
- [ ] Confirm both specs remain `Status: Approved` and ADRs remain `Status: Accepted`.
- [ ] Add the four system-specific TDD plans and this execution index.
- [ ] Scan all new planning documents for `TBD`, `TODO`, placeholder sections, contradictory type names, or Mobility↔Traffic direct imports.
- [ ] Run documentation-safe repository checks:

```bash
pnpm format:check
pnpm lint
pnpm provenance:check
```

Expected: PASS.

- [ ] Update PR #68 body with the final PR1–PR11 matrix and TDD document links.
- [ ] Mark PR #68 Ready for review.
- [ ] Squash-merge PR #68 into `master` only after this implementation packet is approved.

Expected merge commit title:

```text
docs: define Citizen Mobility & Traffic Foundation v0.1
```

---

## Delivery Sequence

| PR | System owner | Deliverable | Required gate before next PR |
|---|---|---|---|
| PR1 | Citizen Mobility | package contracts, immutable snapshot, IDs, validation, `MobilitySaveV1` codec | Mobility unit GREEN + root `pnpm check` |
| PR2 | Citizen Mobility | schedule/event index, Home↔Work trip intent, deterministic mode-choice seam, lifecycle reconciliation | Mobility unit GREEN + 20k schedule scale test |
| PR3 | Traffic | package contracts, Road/Building source projection, vehicle/pedestrian graph derivation, profile registry | Traffic graph unit GREEN + architecture boundary GREEN |
| PR4 | Traffic | deterministic Walk/Drive routing, integer costs, candidate API, route cache seam | routing RED→GREEN + deterministic replay fixtures |
| PR5 | Traffic | active trip progression, intersection queues, load/capacity/congestion, lagged cost field, topology recovery | flow/queue/recovery GREEN + 5k concurrent-trip scale test |
| PR6 | World/Application | `GameWorldState`/`CommittedWorld` integration, `WorldSaveV7`, V1–V6 migration, atomic tick/revision semantics | app integration + Save continuation + root `pnpm check` |
| PR7 | Traffic Three | real pedestrian world agents, route geometry sampling, Citizen linkage, pooling primitive | `traffic-three` GREEN + game presentation integration GREEN |
| PR8 | Traffic Three | real vehicle world agents, stop/turn/queue presentation, Citizen linkage | visual vehicle unit/integration GREEN |
| PR9 | Traffic Three | spatial materialization, near/mid/far LOD, deterministic caps, pool reuse, performance instrumentation | materialization caps + browser-visible agent budget + profiling evidence |
| PR10 | City UI | Citizen/Vehicle Inspect target/projections + Traffic Information View, EN/TH labels | City UI unit GREEN + focused Playwright GREEN at 414×896 |
| PR11 | Cross-system release | full browser scenarios, deterministic replay, Save/reload, topology mutation, scale/performance, manual visual acceptance, closure docs | exact-head `pnpm verify:full`, performance gates, owner visual PASS |

**Rule:** each implementation PR branches from the latest merged `master`. Do not stack unmerged production PRs unless an explicit recovery decision is recorded.

---

## Universal RED → GREEN Protocol

Every behavior PR (PR1–PR10) follows this evidence sequence:

- [ ] Add only the smallest test/fixture needed to express the new contract.
- [ ] Run the narrow target command and capture the expected semantic failure.
- [ ] Commit RED evidence before production implementation when practical.
- [ ] Implement the smallest production slice that satisfies the contract.
- [ ] Re-run the same narrow test and confirm GREEN.
- [ ] Run the owning package suite.
- [ ] Run impacted application/browser tests.
- [ ] Run root `pnpm check` on the exact candidate head.
- [ ] Record commands/results in the PR body.

A formatting, missing-fixture, timeout, topology-inventory, or test-harness failure is **not** semantic RED evidence. Fix harness failures before declaring RED.

PR11 additionally runs:

```bash
pnpm verify:full
```

which includes frozen install, format/lint/typecheck/provenance/deployment/unit/build, full Chromium Playwright, and clean-worktree verification.

---

## Branch / PR Naming

Use these branch/PR identities so evidence remains searchable:

```text
PR1  feat/citizen-mobility-core-v0-1
PR2  feat/citizen-mobility-commute-v0-1
PR3  feat/traffic-graph-v0-1
PR4  feat/traffic-routing-v0-1
PR5  feat/traffic-flow-v0-1
PR6  feat/mobility-traffic-world-integration-v0-1
PR7  feat/traffic-pedestrian-agents-v0-1
PR8  feat/traffic-vehicle-agents-v0-1
PR9  feat/traffic-materialization-performance-v0-1
PR10 feat/city-ui-citizen-traffic-inspect-v0-1
PR11 feat/citizen-mobility-traffic-release-v0-1
```

Use squash merge for completed production PRs unless a PR explicitly needs preserved merge topology.

---

## Cross-System Contract Names

The implementation plans use these names consistently:

```ts
// citizen-mobility-core
export type MobilityActivityKind = 'Home' | 'Work' | 'Idle' | 'Travel';
export type MobilityTripMode = 'Walk' | 'Drive';
export type MobilityTripPurpose = 'CommuteToWork' | 'CommuteHome';
export type MobilityTripStatus = 'Planned' | 'Active' | 'Arrived' | 'Failed' | 'Cancelled';
export type MobilityTripId = string;

export interface MobilityModeCandidate {
  readonly mode: MobilityTripMode;
  readonly available: boolean;
  readonly generalizedCostSeconds: number | null;
}

export interface MobilityTripPlanningRequest {
  readonly tripId: MobilityTripId;
  readonly citizenId: string;
  readonly purpose: MobilityTripPurpose;
  readonly originBuildingId: string;
  readonly destinationBuildingId: string;
  readonly departureGameMinute: number;
}
```

```ts
// traffic-core
export type TrafficEdgeId = string;
export type TrafficNodeId = string;
export type TrafficTripStatus = 'Active' | 'Arrived' | 'Failed' | 'Cancelled';

export interface TransportRouteCandidate {
  readonly requestTripId: string;
  readonly mode: 'Walk' | 'Drive';
  readonly available: boolean;
  readonly generalizedCostSeconds: number | null;
  readonly routeEdgeIds: readonly TrafficEdgeId[];
}

export interface TrafficAgentProjection {
  readonly tripId: string;
  readonly citizenId: string;
  readonly mode: 'Walk' | 'Drive';
  readonly routeEdgeId: TrafficEdgeId;
  readonly progressQ: number;
  readonly queued: boolean;
}
```

`apps/game` converts `TransportRouteCandidate` to `MobilityModeCandidate`; neither package imports the other.

---

## PR11 Release Acceptance

### Automated functional acceptance

- [ ] Morning commute produces staggered real Walk/Drive trips from valid Home/Work assignments.
- [ ] Every materialized pedestrian/car exposes `citizenId` + `tripId` and resolves to a committed real trip.
- [ ] Pause advances no mobility/traffic authority; Step advances exactly one normal game hour and all due sub-hour events inside it.
- [ ] Save during an active walking trip, reload, and continue with the same trip/route/logical progress.
- [ ] Save during an active driving/queued trip, reload, and preserve queue order/progress.
- [ ] Bulldoze a Road on an active route: unaffected routes continue, invalidated routes recover from `lastStableNodeId` or fail typed/unreachable without deleting Citizen/Home/Job authority.
- [ ] Congestion increases effective travel time monotonically under equal topology/profile inputs.
- [ ] Opening Build/City/Inspect/Traffic view does not mutate Mobility/Traffic, Simulation speed, tools, or Undo.
- [ ] EN/TH Inspect/Traffic labels fit canonical 414×896 without document overflow.

### Scale / performance acceptance

Create deterministic scale fixtures; do not use wall-clock assertions as the sole correctness gate.

- [ ] Core scale fixture: 20,000 Citizens, 5,000 concurrent trips, deterministic snapshot fingerprint equality across two identical runs.
- [ ] Routing cache fixture proves repeated origin/destination/revision inputs reuse derived route results without changing canonical output.
- [ ] Browser camera fixture verifies materialized counts never exceed configured pedestrian/vehicle caps.
- [ ] Per-frame visual update iterates materialized agents/spatial buckets only; an instrumentation assertion must fail if the update path scans all logical Citizens/trips.
- [ ] Capture CPU/frame/memory measurements for canonical mobile viewport and record them in `docs/systems/traffic/verification/`; regressions must be explained before release.

### Manual visual acceptance

Canonical viewport: **414×896 portrait**. Secondary: **390×844**, landscape, and desktop.

Owner must visually verify:

```text
07:00–09:00  Citizens visibly leave Residential buildings
             pedestrians use sidewalk corridors
             cars use Road routes and intersections
             traffic density rises toward job districts

16:00–19:00  return commute visibly reverses flow

Inspect       a visible person resolves to a real Citizen/activity/trip
              a visible car resolves to a real Citizen/Drive trip

Camera move   agents materialize/dematerialize without obvious popping storms,
              duplicate cars, teleports, or trip loss

Congestion    queues/stops are visually legible and cars do not simply pass through
              over-capacity intersections
```

Visual acceptance fails if tests pass but the city still appears empty, agents visibly walk/drive through invalid geometry, cars overlap systematically, or visible agents are anonymous decorative traffic.

### Exact-head release gate

- [ ] Freeze candidate SHA.
- [ ] Run `pnpm verify:full` on that SHA.
- [ ] Verify Sonar/quality checks used by the repository are GREEN.
- [ ] Verify clean worktree.
- [ ] Attach Playwright/browser evidence artifact and performance evidence.
- [ ] Obtain owner manual visual PASS.
- [ ] Add closure records under:

```text
docs/systems/citizen-mobility/verification/
docs/systems/traffic/verification/
docs/systems/world/verification/
docs/systems/city-ui/verification/
```

- [ ] Update each living system README from `Approved design — not implemented` to the delivered state.
- [ ] Squash-merge PR11 and record the final `master` release SHA/tree in closure docs.

---

## System-Specific Plans

- Citizen Mobility PR1–PR2: `docs/systems/citizen-mobility/tdd/2026-08-15-citizen-mobility-foundation-v0-1.md`
- Traffic PR3–PR5 + PR7–PR9: `docs/systems/traffic/tdd/2026-08-15-traffic-foundation-v0-1.md`
- World/Application PR6: `docs/systems/world/tdd/2026-08-15-mobility-traffic-world-integration-v0-1.md`
- City UI PR10: `docs/systems/city-ui/tdd/2026-08-15-citizen-traffic-inspect-information-view-v0-1.md`

## Related Approved Designs

- `docs/systems/citizen-mobility/specs/2026-08-15-citizen-mobility-foundation-v0-1.md`
- `docs/systems/traffic/specs/2026-08-15-traffic-foundation-v0-1.md`
- `docs/systems/citizen-mobility/adrs/0001-existing-rci-citizen-remains-identity-authority.md`
- `docs/systems/traffic/adrs/0001-logical-real-trips-materialized-visual-agents.md`
- `docs/systems/traffic/adrs/0002-derived-transport-graphs-and-lagged-costs.md`
