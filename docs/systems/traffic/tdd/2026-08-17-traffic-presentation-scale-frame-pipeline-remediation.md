# Traffic Presentation Scale & Frame Pipeline Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Traffic/Citizen presentation correctly scaled and visually continuous at 1×/2×/4× while keeping canonical Traffic/Mobility authority unchanged and making the RAF hot path bounded.

**Architecture:** Split revision/context reconciliation from per-frame transform sampling. Reconciliation prepares stable visual bindings, route caches, LOD and headway targets; RAF uses the real timestamp and only advances prepared motion/replay state into pooled Three.js transforms. Visual dimensions come from a centralized road-relative scale policy supplied by the game adapter.

**Tech Stack:** TypeScript 6, Three.js 0.185, Vitest 4, Playwright 1.61, pnpm 10.13, GitHub Actions.

## Global Constraints

- PR #79 stays Draft and must not merge.
- Canonical Citizen identity/schedules, Traffic routing/progress/queue/persistence, simulation tick semantics, Roads/Zoning/Growth/Economy/RCI domain rules are unchanged.
- `traffic-three` must not depend directly on `road-core`.
- Basic road rendered width is currently 0.72 world units; the game adapter supplies it to the visual scale policy.
- Vehicle width <= 40% road width; vehicle length <= 85% road width; Citizen width < vehicle width / 2; visual size variation <= ±5%.
- Real RAF timestamp is presentation time. Do not use `frameIndex * 16.667` as production timing authority.
- No route rebuild, global logical-trip scan, headway regroup/sort, appearance/material allocation, or route-history slice/reduce in the stable per-frame path.
- Full Browser is not run unless Browser Verification Policy v0.2 Level-4 escalation applies.

---

### Task 1: RED — lock scale and frame-pipeline contracts

**Files:**
- Modify: `packages/traffic-three/test/vehicle-agent.test.ts`
- Modify: `packages/traffic-three/test/pedestrian-agent.test.ts`
- Modify: `packages/traffic-three/test/route-motion.test.ts`
- Modify: `apps/game/src/traffic-presentation.test.ts`
- Modify: `apps/game/src/traffic-runtime-presentation.test.ts`

**Interfaces:**
- Consumes existing pools/presentation/debug APIs only, using geometry/debug observation so the RED commit typechecks.
- Produces failing behavioral requirements for Tasks 2–6.

- [ ] Add a vehicle test that inspects the body `BoxGeometry.parameters.width/depth` and asserts the current basic-road envelope (`width <= 0.288`, `length <= 0.612`). It must fail against the current 1.6×3.2 body.
- [ ] Add a pedestrian test that asserts total visual envelope is smaller than the vehicle and width <= 0.10 for the current basic road. It must fail against the current ~0.42 body.
- [ ] Add a route-motion test using a dynamically accessed future API (`prepareTrafficRoute` / `samplePreparedRouteInto`) so runtime assertion fails clearly if unavailable without making TypeScript fail during `pnpm typecheck`.
- [ ] Add a game presentation test that calls repeated unchanged render updates and asserts debug `reconciliationCount` remains 1 while `frameSampleCount` increases.
- [ ] Add a runtime presentation test that passes explicit irregular timestamps and asserts motion advances according to elapsed RAF time rather than frame index.
- [ ] Push the RED commit and verify the PR Lean run fails for the intended Traffic presentation tests, not formatting/typecheck/lint.

### Task 2: GREEN — centralized road-relative visual scale

**Files:**
- Create: `packages/traffic-three/src/visual-scale-policy.ts`
- Modify: `packages/traffic-three/src/index.ts`
- Modify: `packages/traffic-three/src/vehicle-agent.ts`
- Modify: `packages/traffic-three/src/pedestrian-agent.ts`
- Modify: `packages/traffic-three/src/vehicle-pool.ts`
- Modify: `packages/traffic-three/src/pedestrian-pool.ts`
- Modify: `apps/game/src/traffic-presentation.ts`
- Modify: `apps/game/src/traffic-runtime-presentation.ts`

**Interfaces:**
- Produces `createTrafficVisualScalePolicy(roadWidthWorldUnits: number): TrafficVisualScalePolicy`.
- `TrafficVisualScalePolicy` contains computed vehicle/pedestrian dimensions and max variation.
- Pools accept an optional visual scale policy and pass it only when constructing/rebinding an agent.

- [ ] Implement the scale factory with fixed ratios from the approved spec and finite/positive input validation.
- [ ] Replace hard-coded vehicle/pedestrian geometry dimensions with policy dimensions; variants use 0.95/1/1.05 only.
- [ ] In game composition, create the scale policy from `BASIC_ROAD_DEFINITION.width` and pass the same policy to authoritative and replay pools.
- [ ] Run focused Traffic-three tests; scale RED tests must turn GREEN while unrelated tests remain green.

### Task 3: GREEN — prepared route cache and allocation-light sampler

**Files:**
- Modify: `packages/traffic-three/src/route-geometry.ts`
- Modify: `packages/traffic-three/src/index.ts`
- Modify: `packages/traffic-three/test/route-motion.test.ts`
- Modify: `apps/game/src/traffic-presentation.ts`
- Modify: `apps/game/src/traffic-runtime-presentation.ts`

**Interfaces:**
- Produces `PreparedTrafficRoute`.
- Produces `prepareTrafficRoute(route: readonly TrafficRouteSegment[]): PreparedTrafficRoute`.
- Produces `samplePreparedRouteInto(route, distanceMillimeters, outPosition): { headingRadians: number; segmentIndex: number }` where `outPosition` is caller-owned.

- [ ] Prepare cumulative segment end distances and total distance once.
- [ ] Implement binary or monotonic bounded segment lookup without constructing arrays/vectors/results for route position; write position into `outPosition`.
- [ ] Keep `sampleRoutePolyline` as compatibility wrapper implemented using the prepared primitive, but production frame paths use prepared routes directly.
- [ ] Cache `PreparedTrafficRoute` in per-trip vehicle motion state and journey replay state; rebuild only when route edge identity changes.
- [ ] Remove replay `slice(0, segmentIndex).reduce(...)` route-distance calculation.
- [ ] Run route-motion and runtime focused tests; prepared-route RED must turn GREEN.

### Task 4: GREEN — split reconciliation from RAF frame sampling

**Files:**
- Modify: `apps/game/src/traffic-presentation.ts`
- Modify: `apps/game/src/traffic-presentation-debug.ts`
- Modify: `apps/game/src/traffic-runtime-presentation.ts`
- Modify: `apps/game/src/traffic-presentation.test.ts`
- Modify: `apps/game/src/traffic-runtime-presentation.test.ts`

**Interfaces:**
- `TrafficPresentation.reconcile(snapshot, camera, frameIndex, timestampMs)` performs heavy revision/context work.
- `TrafficPresentation.frame(timestampMs)` performs only existing-bound motion/arrival transforms.
- `TrafficRuntimePresentation.synchronize(world)` records latest snapshot as pending.
- `TrafficRuntimePresentation.frame(timestampMs)` reconciles only when snapshot revision/camera context is dirty, then always calls frame sampling.
- Debug adds `reconciliationCount`, `frameSampleCount`, `preparedRouteCount`.

- [ ] Move spatial-index rebuild/query, selection, headway derivation, retained-set decisions, pool bind/release decisions and target reconciliation into `reconcile`.
- [ ] Keep a prepared selected-vehicle/pedestrian state so `frame` does not filter/map/sort selection data.
- [ ] Move continuous vehicle motion sampling and arrival transform advancement into `frame`.
- [ ] Cache camera anchor revision/coordinates; changing the anchor marks reconciliation dirty, unchanged anchor does not.
- [ ] Pass the real `requestAnimationFrame` timestamp from runtime `frame(timestampMs)` all the way to motion sampling.
- [ ] Preserve a compatibility `update(...)` wrapper only if existing consumers/tests require it; production runtime must use reconcile+frame explicitly.
- [ ] Run game presentation/runtime tests; repeated-frame reconciliation RED turns GREEN.

### Task 5: GREEN — bind-once pool lifecycle and replay hot-path cleanup

**Files:**
- Modify: `packages/traffic-three/src/vehicle-agent.ts`
- Modify: `packages/traffic-three/src/pedestrian-agent.ts`
- Modify: `packages/traffic-three/src/vehicle-pool.ts`
- Modify: `packages/traffic-three/src/pedestrian-pool.ts`
- Modify: `apps/game/src/traffic-runtime-presentation.ts`
- Modify: `packages/traffic-three/test/vehicle-agent.test.ts`
- Modify: `packages/traffic-three/test/pedestrian-agent.test.ts`

**Interfaces:**
- Agents expose bind/update-state/set-transform separation internally/publicly as minimally needed by pools.
- `acquire` of an already-active trip returns the same instance without re-running static appearance/scale binding.

- [ ] Split static trip binding from dynamic visual-state updates.
- [ ] Ensure materials/geometries are still created only at agent construction and disposed once.
- [ ] Ensure replay `frame` mutates retained agent transform/state instead of creating frozen agent snapshots/sets/maps for each trip where avoidable.
- [ ] Add/complete focused assertions that createdCount/reuseCount and stable object identity remain unchanged across repeated frames.
- [ ] Run Traffic-three + game Traffic presentation focused tests.

### Task 6: Performance instrumentation and architectural budget

**Files:**
- Modify: `apps/game/src/traffic-presentation-debug.ts`
- Modify: `apps/game/src/traffic-performance-release-fixture.ts`
- Modify: `apps/game/src/traffic-release-fixture.test.ts` or create a focused presentation performance test adjacent to existing fixture ownership
- Modify: `docs/systems/traffic/verification/2026-08-16-traffic-foundation-v0-1-performance.md`

**Interfaces:**
- Performance/debug evidence exposes reconciliation/frame/prepared-route/pool counters, not device-specific FPS promises.

- [ ] Warm presentation once, advance at least 120 synthetic RAF frames with unchanged snapshot, and assert reconciliation/prepared-route counts remain stable while frameSampleCount advances.
- [ ] Reconcile a new Traffic revision and assert counts increase exactly at the revision boundary, not every RAF.
- [ ] Exercise target cadence representing 1×/2×/4× and assert canonical input snapshots are unchanged.
- [ ] Keep 5,000 logical Traffic and 20,000-Citizen fixtures passing.
- [ ] Update verification living doc with the new architectural budget and owner visual gate.

### Task 7: Final automated verification and PR evidence

**Files:**
- Modify only living docs/PR body if evidence requires it; no production behavior after final candidate verification without re-running gates.

- [ ] Run focused Traffic-three tests.
- [ ] Run focused game Traffic presentation/runtime/release tests.
- [ ] Run `pnpm check`.
- [ ] Request Targeted Browser `@traffic|@building` only if the final affected surface still includes Building integration; otherwise `@traffic`.
- [ ] Confirm targeted browser PASS, Sonar PASS, clean worktree PASS, 5k/20k performance evidence PASS.
- [ ] Update PR #79 exact candidate SHA and evidence. Keep Draft and owner visual acceptance `PENDING OWNER RE-TEST`.
- [ ] Do not run Full Browser absent an explicit Level-4 trigger.
- [ ] Hand owner exact re-test instructions for 414×896 at 1×/2×/4× morning/evening commute.

## Plan self-review

- Spec coverage: scale, prepared route, reconcile/frame split, real RAF clock, bind-once pools, replay cleanup, performance instrumentation and final release gate are each mapped to Tasks 1–7.
- Placeholder scan: no TBD/TODO/implement-later steps.
- Type consistency: visual-scale factory and prepared-route APIs are defined before consuming tasks; reconciliation/frame method names are fixed in Task 4.
- Scope: presentation-only; no canonical Traffic/Mobility redesign and no InstancedMesh/ECS rewrite in PR #79.