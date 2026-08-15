# Citizen Mobility & Traffic Foundation v0.1 Release PR11 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the merged PR1–PR10 implementation into one exact-head production release candidate with full commute/browser/Save/topology/performance evidence and owner visual acceptance.

**Architecture:** PR11 should add only missing release fixtures, acceptance tests, measurement/debug harnesses, targeted hardening required by those tests, and closure documentation. It must not redesign Citizen/Mobility/Traffic authority. Any semantic defect found here is fixed at its owning seam with a regression test before the full release gate is rerun.

**Tech Stack:** Vitest, Playwright Chromium, repository `pnpm verify:full`, Three.js browser runtime, existing clean-worktree and Sonar/quality workflows.

## Global Constraints

- PR11 branches from `master` only after PR10 is merged.
- No acceptance test may depend on uncontrolled wall-clock timing or random city state.
- Browser fixtures must expose real committed Citizen/Mobility/Traffic identities, not mocked anonymous cars.
- Functional correctness and measured performance are separate evidence streams.
- Owner visual acceptance is mandatory even when automation is GREEN because the product goal is visible city life.
- Final candidate SHA is frozen before the exact-head full verification run.

---

# PR11 — `feat/citizen-mobility-traffic-release-v0-1`

## Task 1: Add deterministic end-to-end commute fixture

**Files:**
- Create: `apps/game/src/traffic-release-fixture.ts`
- Test: `apps/game/src/traffic-release-fixture.test.ts`
- Modify browser test harness entry only to expose fixture controls required by Playwright.

**Produces:**

```ts
export interface TrafficReleaseFixtureSummary {
  readonly citizenIds: readonly string[];
  readonly walkTripIds: readonly string[];
  readonly driveTripIds: readonly string[];
  readonly congestedEdgeIds: readonly string[];
}
```

Fixture must create a deterministic small city with:

```text
Residential buildings with housed/employed Citizens
Commercial/Industrial workplaces
at least one short Home↔Work pair where Walk wins
at least one longer pair where Drive wins
one shared bottleneck/intersection producing queue/congestion under peak demand
one alternate Road path usable for topology-recovery acceptance
```

- [ ] RED: fixture summary contains real RCI Citizen IDs and no duplicate Mobility/Traffic trip identity.
- [ ] RED: two fresh fixture builds have identical committed-world/Mobility/Traffic fingerprints.
- [ ] Implement fixture through public/game application seams; do not write TrafficSnapshot internals directly except through explicit test fixture constructors already sanctioned by owning package tests.
- [ ] GREEN and commit `test(traffic): add deterministic release city fixture`.

## Task 2: Add full morning/evening commute browser acceptance

**Files:**
- Create: `browser-tests/citizen-mobility-traffic-commute.@traffic@rci@release.spec.ts`

**Scenarios:**

### Morning peak

- start before 07:00,
- advance authoritative Simulation through 09:00 using normal speed/Step fixture controls,
- assert due trip departure minutes are staggered rather than identical,
- assert at least one real materialized pedestrian and car become visible,
- assert each visible agent debug record maps to committed `citizenId` + `tripId`,
- assert Drive trips use Road edges and Walk trips use pedestrian corridor edges,
- assert shared bottleneck reports nonzero load/queue/congestion.

### Midday

- advance beyond arrivals,
- assert completed commuters settle at `Work` activity,
- assert no arrived Traffic trip remains Active,
- assert renderer releases no-longer-visible/active agents to pools.

### Evening peak

- advance through return boundaries,
- assert `CommuteHome` trips are generated and visual flow reverses toward Residential buildings,
- assert arrivals settle at `Home`.

- [ ] Write semantic RED before any PR11 hardening.
- [ ] Run:

```bash
pnpm build:browser
pnpm exec playwright test browser-tests/citizen-mobility-traffic-commute.@traffic@rci@release.spec.ts --project=chromium
```

Expected: only true product/regression failures.

- [ ] Fix owning seams until GREEN.
- [ ] Commit `test(traffic): verify real citizen commute lifecycle`.

## Task 3: Add Save/Load continuation acceptance

**Files:**
- Create: `browser-tests/citizen-mobility-traffic-save-load.@traffic@save@release.spec.ts`
- Extend: `apps/game/src/mobility-traffic-save-continuation.test.ts`

**Scenario A — walking mid-trip:**

```text
start Walk trip
capture citizenId/tripId/route/segment/progressQ
save WorldSaveV7
reload
assert same identity/route/logical progress
advance to arrival
assert Work/Home destination activity as appropriate
```

**Scenario B — queued driving mid-trip:**

```text
create Drive queue
capture queue movement/order/progress
save/reload
assert same trip and stable queue ordering
advance
assert eventual service/arrival
```

- [ ] RED continuous-run vs save/reload-run final Mobility/Traffic fingerprints differ before continuation support is correct.
- [ ] GREEN requires fingerprint-equivalent final authority for deterministic fixture.
- [ ] Browser additionally asserts visual agents rematerialize from logical state and are not persisted transforms.
- [ ] Commit `test(world): verify mobility traffic save continuation`.

## Task 4: Add Road topology mutation/recovery acceptance

**Files:**
- Create: `browser-tests/citizen-mobility-traffic-road-recovery.@traffic@road@release.spec.ts`
- Extend: `apps/game/src/traffic-road-reconciliation.test.ts`

**Scenarios:**

1. remove Road not on active route → route/progress unchanged;
2. remove future Road edge with alternate path → recover from `lastStableNodeId`, same trip/citizen identity, new valid route;
3. remove route so destination becomes unreachable → Traffic trip fails `UnreachableDestination`; Citizen/Home/Employment remains present/unchanged;
4. Undo/rebuild Road later → new future trips may route normally; failed historical trip is not resurrected by UI/renderer.

- [ ] RED/GREEN focused unit first, then focused Playwright.
- [ ] Assert road mutation + Traffic reconciliation publishes one coherent application revision.
- [ ] Commit `test(traffic): verify road topology recovery semantics`.

## Task 5: Add deterministic scale/replay release gates

**Files:**
- Create: `packages/citizen-mobility-core/test/release-scale.test.ts`
- Create: `packages/traffic-core/test/release-scale.test.ts`
- Extend: `packages/traffic-three/test/traffic-agent-materializer.test.ts`

**Deterministic fixtures:**

```text
20,000 present Citizens
5,000 concurrent logical trips
mixed Walk/Drive
multiple repeated Home/Work origin-destination pairs
enough visual candidates to exceed pedestrian and vehicle caps
```

- [ ] Mobility: same inputs twice → identical schedule/trip-plan fingerprints.
- [ ] Traffic: same active trips twice → identical progression/queue/congestion fingerprints.
- [ ] Route cache enabled vs disabled → canonical route/output fingerprints equal.
- [ ] Materializer: logical counts remain 5,000 while visible agents stay within foundation caps.
- [ ] Spatial instrumentation: local query visited candidates are less than total logical trips in a spatially distributed fixture.
- [ ] Run package suites GREEN.
- [ ] Commit `test(traffic): add release scale and replay gates`.

## Task 6: Freeze measured browser performance evidence

**Files:**
- Create: `browser-tests/citizen-mobility-traffic-performance.@traffic@release.spec.ts`
- Create: `docs/systems/traffic/verification/2026-08-15-traffic-foundation-v0-1-performance.md`

**Browser assertions (deterministic):**

```text
visible pedestrians <= 300
visible vehicles <= 300
combined full-detail <= 500
logical trips remain >= fixture target
per-frame presentation debug path reports spatial candidates/materialized agents,
not an all-Citizen scan
pool reuse becomes >0 after camera leave/return
```

**Measured evidence (record, not fake deterministic truth):**

Capture:

```text
browser + OS/runner
viewport
logical Citizens
logical active trips
materialized pedestrian/vehicle counts
representative frame-duration sample statistics
Traffic presentation/update CPU observation available from harness
JS heap/memory observation when browser API exposes it reliably
```

- [ ] Run measurement 3 times on same environment and record each result, median, and spread.
- [ ] Freeze release warning/failure thresholds only if PR9/PR11 evidence demonstrates they are stable under CI/browser variance. If a timing metric is too noisy for a hard CI threshold, keep deterministic workload/cap assertions as the gate and record the measured metric as baseline evidence.
- [ ] Document why any non-hard metric remains observational.
- [ ] Commit evidence only after exact fixture/test revision is recorded.

## Task 7: Full UI/interaction regression at canonical mobile viewports

**Files:**
- Extend: `browser-tests/citizen-mobility-traffic-ui.@traffic@interaction@release.spec.ts`
- Do not alter unrelated M6.4 expectations unless Traffic genuinely adds a registered target/view.

- [ ] 414×896 portrait: no horizontal overflow; person/car Inspect bounded.
- [ ] 390×844 portrait: no clipping.
- [ ] landscape: world agents and bottom chrome remain usable.
- [ ] EN and TH: Traffic/Citizen labels fit.
- [ ] Build picker/active tools: opening/closing Traffic Inspect/View never synthesizes Navigate or clears active tool.
- [ ] Simulation controls: opening UI changes no speed; Pause/Step Traffic semantics remain correct.
- [ ] HUD/world input: Traffic visual objects are pickable in their geometry while unrelated transparent UI whitespace preserves world input.
- [ ] Commit regression additions.

## Task 8: Exact-head automated release verification

Before this task, stop changing code except to fix a discovered failed gate and restart the exact-head process.

- [ ] Record candidate SHA in PR body.
- [ ] Run targeted ownership suites first:

```bash
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/traffic-three test
pnpm --filter @web-three-city/game test
```

- [ ] Run exact candidate full repository verification:

```bash
pnpm verify:full
```

Expected: PASS including full Chromium Playwright and clean-worktree gate.

- [ ] Confirm repository Sonar/quality check is PASS on same candidate head.
- [ ] Collect browser evidence artifact ID/digest from CI.
- [ ] Record total browser test inventory and focused Traffic acceptance result counts.

Do not claim release completion until these are fresh on the final candidate.

## Task 9: Owner manual visual acceptance

**Canonical:** 414×896 portrait.  
**Secondary:** 390×844 portrait, landscape, desktop.

Provide/review a deterministic live commute scene and verify:

- [ ] Citizens visibly leave Residential Buildings during morning departure window.
- [ ] Pedestrians follow sidewalk/frontage corridors rather than Road centerline/terrain shortcuts.
- [ ] Cars emerge from real Citizen Drive trips and follow connected Roads.
- [ ] Cars stop/queue at constrained intersections; no systematic pass-through/overlap.
- [ ] Traffic density visually increases during peak and reduces afterward.
- [ ] Evening flow visibly returns toward Residential areas.
- [ ] Camera movement materializes/dematerializes agents without duplicate-agent storms or obvious teleport loops.
- [ ] Inspect a person: real Citizen ID/activity/trip/destination are coherent.
- [ ] Inspect a car: real Citizen/Drive trip and current Traffic facts are coherent.
- [ ] Traffic overlay reflects visibly busy/free Roads and remains readable in EN/TH.
- [ ] Overall city is materially more alive; release fails product acceptance if the logical system is correct but people/cars are effectively invisible in ordinary play.

Owner response must explicitly record PASS or required remediation.

## Task 10: Closure documentation and final integration

**Files:**
- Modify: `docs/systems/citizen-mobility/README.md`
- Modify: `docs/systems/traffic/README.md`
- Modify: `docs/systems/world/README.md`
- Modify: `docs/systems/city-ui/README.md`
- Add: `docs/systems/citizen-mobility/verification/2026-08-15-citizen-mobility-foundation-v0-1-closure.md`
- Add: `docs/systems/traffic/verification/2026-08-15-traffic-foundation-v0-1-closure.md`
- Add: `docs/systems/world/verification/2026-08-15-mobility-traffic-world-integration-v0-1-closure.md`
- Add: `docs/systems/city-ui/verification/2026-08-15-citizen-traffic-ui-v0-1-closure.md`
- Modify: `docs/systems/README.md`

- [ ] Set Citizen Mobility and Traffic registry statuses to Implemented only after exact-head automated + manual gates PASS.
- [ ] Record PR1–PR11 merge SHAs, final candidate SHA, verification run IDs/artifacts, performance evidence, owner visual acceptance, `WorldSaveV7` migration boundary, and known deferred features.
- [ ] State explicitly that future Shopping/Leisure/Education/Public Transit/Car Ownership extend this foundation; they do not reopen Citizen identity authority.
- [ ] Run documentation-safe final checks if closure-only commit follows the already verified runtime candidate.
- [ ] Squash-merge PR11 after final checks.
- [ ] Verify `master` contains the intended runtime tree + closure docs and no implementation PR remains open.

---

## Release Stop Conditions

Stop and do not merge PR11 if any of these are true:

```text
visible pedestrian/car cannot trace to real committed Citizen/trip
Save/load changes active trip identity/route/queue authority
Road deletion can orphan/delete Citizen/Home/Employment authority
same input produces nondeterministic schedule/route/queue result
per-frame renderer scans all logical Citizens/trips
materialized agent caps are exceeded without an explicit approved policy change
full verify or clean-worktree fails
manual visual acceptance fails
```

A stop condition requires root-cause remediation in the owning system plus a regression test, then a new exact-head verification cycle.

## Related Plans

- Execution index: `2026-08-15-citizen-mobility-traffic-foundation-v0-1-execution-index.md`
- Citizen Mobility: `../../citizen-mobility/tdd/2026-08-15-citizen-mobility-foundation-v0-1.md`
- Traffic: `../../traffic/tdd/2026-08-15-traffic-foundation-v0-1.md`
- Traffic PR9 hardening: `../../traffic/tdd/2026-08-15-traffic-production-hardening-pr9.md`
- World PR6: `../../world/tdd/2026-08-15-mobility-traffic-world-integration-v0-1.md`
- City UI PR10: `../../city-ui/tdd/2026-08-15-citizen-traffic-inspect-information-view-v0-1.md`
