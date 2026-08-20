# Traffic Temporal & Physical Authority vNext Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hour-batched Traffic plus synthetic journey replay/presentation-owned spacing with minute-resolution calendar authority, deterministic Traffic transport checkpoints, real Drive lifecycle, canonical headway/physical reservations, safe merge/intersection arbitration, explicit Save migration, and owner-verifiable real Traffic motion.

**Architecture:** `simulation-core` becomes the sole minute-resolution calendar authority. Existing Building/RCI/Economy behavior remains hour-based through a derived `macroHourIndex`, not through a second clock. `citizen-mobility-core` owns deterministic desired-activity schedules and one-active-trip semantics. `traffic-core` owns subordinate transport time, real Walk/Drive progression, Drive lifecycle, physical lane occupancy, entry/receiving/merge/conflict reservations, and deterministic arbitration. `apps/game` owns minute-boundary and transport-quantum atomic world publication. `traffic-three` returns to presentation-only smoothing/materialization; synthetic Journey Replay and presentation capacity workarounds are removed.

**Tech Stack:** TypeScript, pnpm workspaces, Turborepo, Vitest, Three.js 0.185.1, Playwright Chromium, GitHub Actions, Sonar.

**Source Spec:** `docs/systems/traffic/specs/2026-08-20-traffic-temporal-physical-authority-vnext.md`

**Design baseline:** `e78a115ff06c93787efa3e09baf61af4309d426c` on PR #83 branch `feat/motion-junction-realism-v1`. Implementation starts only from a commit that contains both the source spec and this plan.

---

## Global Execution Rules

- PR #83 remains **Draft** until the final owner 414×896 visual gate and exact-head release gate pass.
- Before production edits, use `superpowers:using-git-worktrees` if the current worktree is not clean or isolated. Do not create a second implementation branch merely for convenience; preserve the existing PR branch unless the owner explicitly changes branch policy.
- Every production behavior follows strict `RED -> verify expected failure -> minimal GREEN -> verify GREEN -> refactor while green`.
- Never write production behavior first and backfill tests.
- For each numbered implementation task, keep the RED test focused on that task. Record the exact local failing command/output. Where PR evidence requires CI TDD proof, commit/push the RED test as `test(...): ...`, record the failing run, then implement GREEN in the next commit and record the passing run.
- A RED is valid only when the test fails for the intended missing behavior, not because of a syntax/type/import error.
- Do not weaken a failing assertion merely to make GREEN easier. If an approved invariant proves impossible, stop and return to the spec instead of silently changing semantics.
- No runtime `Math.random()`, wall-clock ordering, array iteration order, Three.js transform, renderer materialization, or frame delta may become Traffic/Mobility authority.
- Never use `650 mm` from PR3.1 presentation scaling as canonical Traffic headway. Canonical physical values use Traffic world millimeters on the real 8m gameplay-cell scale.
- `capacityUnits` remains flow/congestion capacity. It is not physical vehicle storage.
- Traffic temporal resolution is never Road/access capacity and never changes with population.
- Reservation release is physical-envelope based. No ingress/receiving/merge/conflict resource may acquire a timeout.
- Current-schema runtime never moves a vehicle backward to repair overlap. Backward normalization is allowed only inside the explicit legacy Traffic V1 -> V2 migration.
- Do not leave Journey Replay as a hidden fallback. The production path must contain one movement authority only.
- Update living system docs only after the corresponding implementation behavior is GREEN.

## Verification Ladder Used By This Plan

### Level 0 — focused RED/GREEN

Use package-local focused Vitest commands, for example:

```bash
pnpm --filter @web-three-city/simulation-core test -- calendar.test.ts
pnpm --filter @web-three-city/citizen-mobility-core test -- mobility-core.test.ts
pnpm --filter @web-three-city/traffic-core test -- traffic-flow-persistence.test.ts
pnpm --filter @web-three-city/game test -- traffic-transport-transaction.test.ts
```

### Level 1 — owning package

```bash
pnpm --filter @web-three-city/simulation-core test
pnpm --filter @web-three-city/simulation-core typecheck
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/citizen-mobility-core typecheck
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/traffic-core typecheck
pnpm --filter @web-three-city/traffic-three test
pnpm --filter @web-three-city/traffic-three typecheck
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
```

### Level 2 — public-contract consumers

When `simulation-core` public contracts change, verify at minimum:

```bash
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/building-core typecheck
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/rci-core typecheck
pnpm --filter @web-three-city/economy-core test
pnpm --filter @web-three-city/economy-core typecheck
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
```

When Mobility/Traffic public or Save-facing contracts change, verify their direct consumers (`game`, and `traffic-three` for Traffic projection changes) even though the older static dependency map does not list these newer packages.

### Browser / release

```bash
pnpm --filter @web-three-city/game test:browser:targeted
```

This owns the current `@road|@traffic` targeted Chromium set. Final milestone/release closure additionally runs the repository-required exact-head/full release gate and records run/artifact IDs on PR #83.

---

## Target File Map

### `packages/simulation-core`

Modify:
- `packages/simulation-core/src/contracts.ts`
- `packages/simulation-core/src/calendar.ts`
- `packages/simulation-core/src/simulation-snapshot.ts`
- `packages/simulation-core/src/simulation-mutation.ts`
- `packages/simulation-core/src/serialization.ts`
- `packages/simulation-core/src/index.ts`
- `packages/simulation-core/test/calendar.test.ts`
- `packages/simulation-core/test/simulation-mutation.test.ts`
- `packages/simulation-core/test/serialization-v2.test.ts` (retain legacy decode coverage; rename only if repository convention requires)

Create if clearer than overloading legacy tests:
- `packages/simulation-core/test/serialization-v3.test.ts`

### Macro-hour consumers

Modify:
- `packages/building-core/src/building-growth.ts`
- owning Building growth tests that currently assume one Simulation tick == one hour
- `packages/rci-core/src/rci-tick.ts`
- `packages/rci-core/src/population/age.ts`
- owning RCI tick/age tests
- `packages/economy-core/src/scheduled-settlement.ts`
- owning Economy scheduled-settlement tests

### `packages/citizen-mobility-core`

Modify:
- `packages/citizen-mobility-core/src/contracts.ts`
- `packages/citizen-mobility-core/src/schedule-policy.ts`
- `packages/citizen-mobility-core/src/schedule-index.ts`
- `packages/citizen-mobility-core/src/mobility-reconciler.ts`
- `packages/citizen-mobility-core/src/trip-lifecycle.ts`
- `packages/citizen-mobility-core/src/mobility-snapshot.ts`
- `packages/citizen-mobility-core/src/persistence.ts`
- `packages/citizen-mobility-core/src/index.ts`
- `packages/citizen-mobility-core/test/mobility-core.test.ts`
- `packages/citizen-mobility-core/test/commute-planning.test.ts`
- `packages/citizen-mobility-core/test/mobility-scale.test.ts`

Create:
- `packages/citizen-mobility-core/test/schedule-policy-v2.test.ts`

### `packages/traffic-core`

Modify:
- `packages/traffic-core/src/contracts.ts`
- `packages/traffic-core/src/traffic-snapshot.ts`
- `packages/traffic-core/src/transport-trip.ts`
- `packages/traffic-core/src/traffic-progress.ts`
- `packages/traffic-core/src/traffic-flow.ts`
- `packages/traffic-core/src/intersection-policy.ts`
- `packages/traffic-core/src/intersection-queue.ts` (reduce to compatibility/delete once arbitration cutover is GREEN)
- `packages/traffic-core/src/graph-reconciler.ts`
- `packages/traffic-core/src/persistence.ts`
- `packages/traffic-core/src/index.ts`
- existing Traffic tests including `traffic-flow-persistence.test.ts`, `traffic-routing.test.ts`, `traffic-graph.test.ts`, `traffic-scale.test.ts`, `release-scale.test.ts`, `road-definition-compatibility.test.ts`

Create:
- `packages/traffic-core/src/transport-time.ts`
- `packages/traffic-core/src/drive-lifecycle.ts`
- `packages/traffic-core/src/vehicle-envelope.ts`
- `packages/traffic-core/src/lane-occupancy.ts`
- `packages/traffic-core/src/traffic-reservation.ts`
- `packages/traffic-core/src/drive-node-classification.ts`
- `packages/traffic-core/src/intersection-arbitration.ts`
- `packages/traffic-core/src/traffic-quantum.ts`
- `packages/traffic-core/src/traffic-migration.ts`
- `packages/traffic-core/test/transport-time.test.ts`
- `packages/traffic-core/test/drive-lifecycle.test.ts`
- `packages/traffic-core/test/authoritative-headway.test.ts`
- `packages/traffic-core/test/traffic-reservation.test.ts`
- `packages/traffic-core/test/intersection-arbitration.test.ts`
- `packages/traffic-core/test/traffic-v2-migration.test.ts`

### `apps/game`

Modify:
- `apps/game/src/simulation-runtime.ts`
- `apps/game/src/game-world-tick.ts` (temporary compatibility facade, then delete/reduce after cutover)
- `apps/game/src/mobility-traffic-tick.ts` (temporary compatibility facade, then delete/reduce after cutover)
- `apps/game/src/main.ts`
- `apps/game/src/game-bootstrap.ts`
- `apps/game/src/game-time-presentation.ts`
- `apps/game/src/world-save.ts`
- `apps/game/src/application/committed-world.ts`
- `apps/game/src/application/committed-world-fingerprint.ts`
- `apps/game/src/application/world-transaction-coordinator.ts`
- `apps/game/src/application/save-coordinator.ts`
- corresponding existing tests

Create:
- `apps/game/src/game-minute-transaction.ts`
- `apps/game/src/traffic-transport-transaction.ts`
- `apps/game/src/game-minute-transaction.test.ts`
- `apps/game/src/traffic-transport-transaction.test.ts`
- `apps/game/src/traffic-authoritative-short-trip.test.ts`
- `apps/game/src/world-save-v8.test.ts`

### Presentation cutover

Modify:
- `packages/traffic-three/src/vehicle-spacing.ts`
- `packages/traffic-three/test/lane-vehicle-spacing.test.ts`
- `apps/game/src/traffic-presentation-projection.ts`
- `apps/game/src/traffic-presentation.ts`
- `apps/game/src/traffic-runtime-presentation.ts`
- `apps/game/src/traffic-runtime-presentation.test.ts`
- `apps/game/src/traffic-presentation.test.ts`
- `apps/game/src/traffic-visual-headway.test.ts`
- `apps/game/src/traffic-presentation-debug.ts`
- `apps/game/src/traffic-release-fixture.ts`
- `apps/game/src/traffic-release-fixture.test.ts`

Delete after GREEN replacement:
- `apps/game/src/traffic-journey-receipt-registry.ts`
- any replay-only types/constants/tests no longer referenced by production code

### Browser / docs

Modify:
- `browser-tests/citizen-mobility-traffic-commute.@traffic@visual@release.spec.ts`
- `browser-tests/citizen-mobility-traffic-mobile-regression.@traffic@interaction@release.spec.ts`
- `browser-tests/citizen-mobility-traffic-performance.@traffic@release.spec.ts`
- `browser-tests/citizen-mobility-traffic-road-recovery.@traffic@road@release.spec.ts`
- `browser-tests/citizen-mobility-traffic-save-load.@traffic@release.spec.ts`
- `docs/systems/simulation-time/README.md`
- `docs/systems/citizen-mobility/README.md`
- `docs/systems/traffic/README.md`

Create during documentation cutover:
- `docs/systems/simulation-time/adrs/0001-minute-calendar-macro-hour-compatibility.md`
- `docs/systems/citizen-mobility/adrs/0001-deterministic-commute-schedule-v2.md`
- `docs/systems/traffic/adrs/0003-authoritative-transport-and-physical-reservations.md`
- verification evidence documents under the owning systems' `verification/` directories if/when evidence exists.

---

# Phase A — Temporal Authority Cutover

### Task 1: Introduce minute calendar primitives and SimulationSaveV3 without changing runtime authority yet

**Files:** `packages/simulation-core/src/{contracts,calendar,serialization,index}.ts`; tests `calendar.test.ts`, new `serialization-v3.test.ts`.

**Target interfaces:**

```ts
export interface SimulationMinuteSnapshot {
  readonly revision: number;
  readonly absoluteGameMinute: number;
  readonly growthSequence: number;
}

export function deriveMacroHourIndex(absoluteGameMinute: number): number;
export function crossedMacroHour(beforeMinute: number, afterMinute: number): boolean;

export interface SimulationSaveV3 {
  readonly schemaVersion: 3;
  readonly revision: number;
  readonly absoluteGameMinute: number;
  readonly growthSequence: number;
}

export function migrateSimulationSaveV2ToV3(v2: SimulationSaveV2): SimulationSaveV3;
```

- [ ] RED: assert minute `480` derives day/hour `08:00`, minute `539` remains macro hour `8`, minute `540` becomes macro hour `9`, and V2 `absoluteTick: 8` migrates to minute `480`.
- [ ] Run:

```bash
pnpm --filter @web-three-city/simulation-core test -- calendar.test.ts serialization-v3.test.ts
```

Expected: FAIL because minute primitives/V3 do not exist.
- [ ] GREEN: add minute calendar arithmetic and V2->V3 migration as parallel APIs; do **not** add a second mutable runtime clock or cut existing `SimulationSnapshot` yet.
- [ ] Re-run focused tests, then full Simulation package test/typecheck.
- [ ] RED commit: `test(simulation): define minute calendar v3 contract`.
- [ ] GREEN commit: `feat(simulation): add minute calendar and v3 migration primitives`.

**Stop condition:** if old V2 payloads cannot be migrated with exact `absoluteTick * 60` semantics, stop and amend the approved migration contract before continuing.

---

### Task 2: Decouple macro-hour consumers from ownership of Simulation advancement

**Files:** `packages/building-core/src/building-growth.ts`; `packages/rci-core/src/rci-tick.ts`; `packages/rci-core/src/population/age.ts`; `packages/economy-core/src/scheduled-settlement.ts`; owning tests; `packages/simulation-core/src/index.ts`.

**Target contract:** macro systems consume an explicit already-planned minute transition and/or derived macro-hour index; Building no longer becomes the owner of “advance time by one hour.”

Conceptual shared input:

```ts
export interface MacroHourTransition {
  readonly beforeAbsoluteGameMinute: number;
  readonly afterAbsoluteGameMinute: number;
  readonly beforeMacroHourIndex: number;
  readonly afterMacroHourIndex: number;
  readonly crossed: boolean;
}
```

- [ ] RED Building: `08:00 -> 08:01` must not decrement a 24-hour construction duration; `08:59 -> 09:00` decrements/advances exactly one legacy hour unit.
- [ ] RED RCI: minute-only transitions do not execute hourly reconciliation/age work; macro-hour transition preserves current hourly semantics; daily `08:00` still fires once.
- [ ] RED Economy: settlement does not run 60×; the `08:00` daily settlement remains once per day; month boundary remains derived from calendar.
- [ ] Run focused owning tests and verify expected failures due to old `absoluteTick + 1` assumptions.
- [ ] GREEN: update consumers to use explicit macro-hour inputs; retain existing persisted Building/RCI/Economy hour-based fields unchanged.
- [ ] Run all four owning package test/typecheck sets.
- [ ] RED commit: `test(simulation): lock macro-hour consumer cadence`.
- [ ] GREEN commit: `refactor(simulation): decouple macro consumers from clock advancement`.

**Do not:** reinterpret Building construction `24/48/96` hour durations as minutes, or change RCI age constants to 60× values.

---

### Task 3: Cut canonical SimulationSnapshot to `absoluteGameMinute`

**Files:** `packages/simulation-core/src/{contracts,simulation-snapshot,simulation-mutation,serialization,index}.ts`; tests; Game compile consumers including `game-time-presentation.ts`, `application/committed-world*.ts`.

**Target:** the canonical exported Simulation snapshot has one time authority only:

```ts
export interface SimulationSnapshot {
  readonly revision: number;
  readonly absoluteGameMinute: number;
  readonly growthSequence: number;
}
```

- [ ] RED: `planSimulationTick`/successor advances exactly one minute and revision +1; there is no writable/persisted `absoluteTick` authority in the current snapshot.
- [ ] GREEN: rename mutation semantics to minute advancement (`planSimulationMinute` / equivalent repository naming), make calendar presentation format `HH:mm`, and update compile-time consumers.
- [ ] Keep V2 decode only as migration input; current encode uses V3.
- [ ] Run Simulation Level 1 and Level 2 consumers (`building-core`, `rci-core`, `economy-core`, `game`).
- [ ] RED commit: `test(simulation): require minute canonical snapshot`.
- [ ] GREEN commit: `feat(simulation): cut canonical clock to game minutes`.

**Stop condition:** no GREEN commit may leave both `absoluteTick` and `absoluteGameMinute` as mutable/current snapshot authority.

---

### Task 4: Split Game orchestration into Minute Boundary and Transport Quantum transactions

**Files:** create `apps/game/src/game-minute-transaction.ts`, `traffic-transport-transaction.ts` and tests; modify `game-world-tick.ts`, `application/world-transaction-coordinator.ts`, `application/committed-world*.ts`.

**Minute transaction contract:**

```text
advance minute
→ if macro boundary: Building → RCI
→ reconcile current Citizen/Home/Work
→ resolve Mobility boundaries due at this minute
→ create Traffic trip intent only
→ due Economy work
→ validate whole candidate
→ one atomic world publish
```

**Transport transaction contract:** Simulation minute may remain unchanged while Traffic/Mobility revisions and world revision advance atomically.

- [ ] RED: a non-hour minute updates Simulation/Mobility scheduling but leaves Building/RCI/Economy revisions unchanged.
- [ ] RED: `08:59 -> 09:00` runs macro consumers exactly once.
- [ ] RED: a Traffic-only quantum can publish world revision +1 with unchanged Simulation revision/minute.
- [ ] RED: any staged validation failure leaves the prior committed world fingerprint unchanged.
- [ ] GREEN: introduce the two planners/committers and reuse `WorldTransactionCoordinator.publish()` as the single publication seam.
- [ ] Reduce `game-world-tick.ts` to a compatibility facade calling the new minute planner; do not retain a second coarse progression implementation.
- [ ] Run focused Game tests, then Game Level 1.
- [ ] RED commit: `test(game): define minute and transport world transactions`.
- [ ] GREEN commit: `feat(game): split minute and traffic quantum publication`.

---

### Task 5: Change wall-clock runtime to minute pacing plus deterministic transport quanta

**Files:** `apps/game/src/simulation-runtime.ts`, `simulation-runtime.test.ts`, `main.ts`, `game-bootstrap.ts`.

**Initial pacing policy:** normal = one GameMinute per real second; four Traffic TransportSeconds/quanta per GameMinute. Fast/Faster multiply wall-clock consumption, never quantum distance.

- [ ] RED: normal one real second emits one minute boundary and exactly the policy number of ordered transport quanta; 2× and 4× scale event rate, not quantum size.
- [ ] RED: paused emits neither minute nor transport progress.
- [ ] RED: player `step()` while paused performs exactly one minute plus all of that minute's quanta in deterministic order.
- [ ] RED: frame slicing (`1000ms` once vs four `250ms` advances) yields identical emitted sequence.
- [ ] GREEN: make runtime emit explicit temporal events rather than calling the old `advanceOneLogicalTick()` hour facade.
- [ ] Run `simulation-runtime.test.ts`, `game-runtime-authority.test.ts`, Game full tests/typecheck.
- [ ] RED commit: `test(game): lock minute and transport runtime pacing`.
- [ ] GREEN commit: `feat(game): pace minute calendar with traffic quanta`.

---

# Phase B — Traffic Time + Mobility Demand

### Task 6: Introduce TrafficSnapshotV2 transport cursor and one-quantum progression

**Files:** create `transport-time.ts`, `traffic-quantum.ts`, `transport-time.test.ts`; modify `traffic-snapshot.ts`, `contracts.ts`, `traffic-progress.ts`, `index.ts`, persistence tests.

**Target:** current Traffic snapshot owns a monotonic subordinate cursor and progression API advances one deterministic quantum only.

```ts
export interface TrafficTimeCursor {
  readonly sourceGameMinute: number;
  readonly completedTransportQuantaWithinMinute: number;
  readonly absoluteTransportSecond: number;
  readonly temporalPolicyVersion: number;
}
```

- [ ] RED: four one-second quantum advances equal one four-second sequential execution result, while a single call cannot skip lifecycle/queue observation boundaries.
- [ ] RED: new intersection queue arrival timestamp uses `arrivedAtTransportSecond`, not legacy hour-derived `arrivedAtGameSecond`.
- [ ] RED: cursor cannot regress, skip the active minute policy, or exceed configured quanta without minute rollover orchestration.
- [ ] GREEN: add V2 snapshot fields and a pure `advanceTrafficQuantum(...)`; keep route travel costs in integer seconds.
- [ ] Do not yet add canonical headway/reservations beyond types needed for later tasks.
- [ ] Run Traffic Level 1 plus Game compile consumer.
- [ ] RED commit: `test(traffic): define authoritative transport cursor`.
- [ ] GREEN commit: `feat(traffic): advance deterministic transport quanta`.

---

### Task 7: Implement Mobility Schedule Policy V2

**Files:** `schedule-policy.ts`, `schedule-index.ts`, `contracts.ts`, `index.ts`, new `schedule-policy-v2.test.ts`.

**Target policy:** stable personal base; weighted 07:00-08:59 window; base safe range 07:05-08:54; morning jitter ±5; nominal work duration 540; return jitter ±10; effective interval 525-555; no RNG.

- [ ] RED: same Citizen/policy has recognizable stable base across days while daily jitter varies deterministically.
- [ ] RED: bucket distribution over a fixed deterministic Citizen fixture matches the configured weights within testable deterministic counts; do not write probabilistic flaky assertions.
- [ ] RED: exhaustive representative `(citizenId, day)` sample never leaves the morning window and never violates 525-555 work interval.
- [ ] RED: changing array iteration order does not change per-Citizen schedule.
- [ ] GREEN: version policy to V2, split base hash namespace from daily jitter namespace, and rename `workStartGameMinuteForCitizen()` to commute-departure naming.
- [ ] Keep `departureGameMinute` as the persisted trip field. Do not persist the helper name or a mutable RNG state.
- [ ] Run Mobility Level 1.
- [ ] RED commit: `test(mobility): specify deterministic commute schedule v2`.
- [ ] GREEN commit: `feat(mobility): add stable commute schedule distribution`.

---

### Task 8: Enforce one-active-trip and desired-activity catch-up semantics

**Files:** `mobility-reconciler.ts`, `trip-lifecycle.ts`, `contracts.ts`, `mobility-core.test.ts`, `commute-planning.test.ts`.

- [ ] RED: if `activeTripId != null`, a later due Home/Work boundary creates no second trip and no durable pending trip queue.
- [ ] RED: after the active trip settles, Mobility derives desired activity at current GameMinute and creates at most one catch-up intent when current location differs.
- [ ] RED: pathological multi-boundary delay does not replay each missed historical commute.
- [ ] GREEN: model schedule boundaries as desired-activity signals; preserve exactly one active trip reference in Citizen state.
- [ ] Ensure trip IDs/sequences remain deterministic and only increment when a real new trip is created.
- [ ] Run Mobility Level 1 and Game consumer tests.
- [ ] RED commit: `test(mobility): forbid overlapping citizen trips`.
- [ ] GREEN commit: `feat(mobility): reconcile current desired activity after travel`.

---

# Phase C — Real Trip Lifecycle and Replay Removal

### Task 9: Add authoritative Drive lifecycle phases

**Files:** create `drive-lifecycle.ts`, `drive-lifecycle.test.ts`; modify `contracts.ts`, `transport-trip.ts`, `traffic-snapshot.ts`, `index.ts`.

**Target:** terminal status and active movement phase are separate.

```ts
type TrafficTripStatus = 'Active' | 'Arrived' | 'Failed' | 'Cancelled';
type DriveMovementPhase = 'WaitingForEntry' | 'Entering' | 'Travelling' | 'Leaving';
```

Drive-only active fields include origin/destination access anchors and deterministic phase progress. Walk trips retain their own simpler progression contract.

- [ ] RED: new Drive trip starts `Active/WaitingForEntry`, not on first Road edge.
- [ ] RED: each major transition is observable and one quantum may cross at most one major phase boundary.
- [ ] RED: completing final Road edge enters `Leaving`; it does not set `Arrived` immediately.
- [ ] RED: invalid status/phase combinations fail snapshot validation.
- [ ] GREEN: implement lifecycle transition helpers with no Three.js concepts.
- [ ] Run Traffic Level 1 and Game compile consumer.
- [ ] RED commit: `test(traffic): define authoritative drive lifecycle`.
- [ ] GREEN commit: `feat(traffic): add waiting entering travelling leaving phases`.

---

### Task 10: Publish short Walk/Drive trips across real authoritative checkpoints and settle arrival atomically

**Files:** `apps/game/src/traffic-transport-transaction.ts`, `game-minute-transaction.ts`, `mobility-traffic-tick.ts` (remove coarse internal-hour progression), `application/world-transaction-coordinator.ts`; create `traffic-authoritative-short-trip.test.ts`; update `mobility-traffic-tick.test.ts`.

- [ ] RED fixture: an 8-12-edge Drive trip due during one minute has at least one committed active Traffic checkpoint and cannot depart+arrive within one minute-boundary publication.
- [ ] RED Walk fixture: short Walk trip also remains authoritative across transport checkpoints.
- [ ] RED: `Leaving -> Arrived` must update Traffic + Mobility trip + Citizen activity/location in one world transaction.
- [ ] RED: intentionally invalid Mobility settlement rejects the complete candidate and retains previous Traffic `Leaving` state.
- [ ] GREEN: move all second-by-second progression out of the old `planMobilityTrafficTick()` hour interval loop and into transport transactions.
- [ ] Delete/reduce duplicate coarse code once new path is GREEN; there must be one production progression path.
- [ ] Run focused Game tests plus Traffic/Mobility Level 1.
- [ ] RED commit: `test(game): require real published short-trip lifecycle`.
- [ ] GREEN commit: `feat(game): publish traffic lifecycle at transport checkpoints`.

---

### Task 11: Remove synthetic Journey Replay production path

**Files:** `apps/game/src/traffic-runtime-presentation.ts`, `traffic-runtime-presentation.test.ts`, `main.ts`, `game-world-tick.ts`; delete `traffic-journey-receipt-registry.ts` and replay-only code.

- [ ] RED: after a due commute, visible/reported Drive/Walk agents are sourced only from current authoritative Traffic trips; replay counts remain zero/absent.
- [ ] RED: no completed trip can be re-instantiated at route origin after arrival.
- [ ] RED: production runtime contains no `enqueueJourneyReceipts()` dependency and no wall-clock `REPLAY_*` timing behavior.
- [ ] GREEN: remove replay pools/state/constants/receipt registry and synchronize presentation solely from current Traffic projection.
- [ ] Keep diagnostic receipts only if they serve logging/verification and cannot create movement; otherwise delete them.
- [ ] Run Game full tests/typecheck; search source for `JourneyReplay`, `replayVehicles`, `replayPedestrians`, `REPLAY_`, `enqueueJourneyReceipts` and expect no production matches.
- [ ] RED commit: `test(traffic): forbid synthetic completed-trip replay`.
- [ ] GREEN commit: `refactor(traffic): remove journey replay movement path`.

---

# Phase D — Canonical Physical Traffic

### Task 12: Add canonical VehicleEnvelope + cross-edge lane headway

**Files:** create `vehicle-envelope.ts`, `lane-occupancy.ts`, `authoritative-headway.test.ts`; modify `traffic-progress.ts`, `road-profile.ts`, `traffic-flow.ts`, `index.ts`.

**Target:** logical vehicle length/gap/time-headway are versioned integer policy values. Required spacing derives from Road design/free-flow speed, not live congestion speed.

- [ ] RED same edge: follower never violates canonical front-to-front headway.
- [ ] RED cross edge: leader on downstream Road cell constrains follower on previous cell.
- [ ] RED simple bend: spacing survives turn/edge identity boundary.
- [ ] RED diverge: different future routes still share headway while they share the same upstream physical lane span.
- [ ] RED: changing congestion projection does not change the required headway policy value.
- [ ] RED: materialization state is absent from canonical calculation.
- [ ] GREEN: build lane-span occupancy buckets, deterministic front-to-back ordering, nearest-leader lookup, and cap forward candidate progress only. Never move current-schema runtime positions backward.
- [ ] Keep complexity local/bucketed; do not add all-pairs scans.
- [ ] Run Traffic Level 1 and `traffic-three` compile/tests if projection types change.
- [ ] RED commit: `test(traffic): require canonical lane headway`.
- [ ] GREEN commit: `feat(traffic): enforce authoritative cross-edge headway`.

---

### Task 13: Add static access service + atomic ingress/receiving admission

**Files:** create `traffic-reservation.ts`, `traffic-reservation.test.ts`; extend `drive-lifecycle.ts`, `traffic-quantum.ts`, `building-access.ts`, `contracts.ts`.

**Resource model:**

```ts
type TrafficReservationResourceKind =
  | 'IngressFootprint'
  | 'ReceivingAdmission'
  | 'MergeAdmission'
  | 'IntersectionConflictZone';
```

- [ ] RED: live congestion/load/queue length changes do not change static `accessServiceRate` accrual.
- [ ] RED: available service credit with blocked first-lane receiving footprint keeps trip `WaitingForEntry`.
- [ ] RED: ingress + receiving resources acquire all-or-nothing; two candidates cannot read the same free slot and both enter.
- [ ] RED: `Entering` vehicle holds resource while its rear envelope remains inside footprint even if it stalls from spillback.
- [ ] RED: elapsed time alone never releases resource; physical rear clearance does.
- [ ] RED: failure/cancellation releases only in the same atomic state transition that removes/relocates occupant.
- [ ] GREEN: implement deterministic resource IDs, derived owner index, atomic bundle acquisition, physical release predicates, static service credit.
- [ ] Run Traffic Level 1 + Game consumer tests.
- [ ] RED commit: `test(traffic): define physical entry reservation lifecycle`.
- [ ] GREEN commit: `feat(traffic): reserve ingress and receiving capacity atomically`.

---

### Task 14: Classify Drive nodes before applying junction policy

**Files:** create `drive-node-classification.ts`, tests in `traffic-graph.test.ts` or new `intersection-arbitration.test.ts`; modify `vehicle-graph.ts`, `index.ts`.

- [ ] RED fixtures classify `SimpleContinuation`, degree-2 bend, `Diverge`, `Merge`, T `ConflictJunction`, 4-way `ConflictJunction` deterministically from directed graph connectivity.
- [ ] RED: simple diverge is not placed in an intersection service queue solely because node degree >= 3.
- [ ] RED: pure merge does not receive Straight/Left/Right conflict movement classification.
- [ ] GREEN: add graph-revision-derived classification cache/projection and replace generic degree heuristic at queue entry seam.
- [ ] Run Traffic graph/routing tests and full package.
- [ ] RED commit: `test(traffic): classify drive node topology explicitly`.
- [ ] GREEN commit: `feat(traffic): separate continuation diverge merge and junction`.

---

### Task 15: Replace slot-based intersection queue release with unified atomic arbitration

**Files:** create `intersection-arbitration.ts`, expand `traffic-reservation.ts`, `intersection-arbitration.test.ts`; modify `intersection-policy.ts`, `intersection-queue.ts`, `traffic-quantum.ts`, `contracts.ts`.

**Target traversal:**

```ts
interface ActiveNodeTraversal {
  readonly nodeId: string;
  readonly traversalClass: 'Merge' | 'ConflictJunction';
  readonly incomingEdgeId: string;
  readonly outgoingEdgeId: string;
  readonly movementKind?: 'Straight' | 'Left' | 'Right';
  readonly reservedResourceIds: readonly string[];
  readonly progressQ: number;
}
```

- [ ] RED conflict: perpendicular conflicting straights cannot own overlapping conflict resources.
- [ ] RED compatible: truly independent complete resource bundles may grant in the same arbitration cycle.
- [ ] RED receiving race: geometric conflict-zone-compatible movements sharing one outgoing receiving footprint serialize; exactly one wins.
- [ ] RED all-or-nothing: one busy resource yields zero partial acquisition.
- [ ] RED front-most: rear higher-priority vehicle on same incoming lane cannot overtake front queued vehicle.
- [ ] RED starvation: bounded integer age promotion eventually serves a left turn under continuous straight demand.
- [ ] RED merge: two incoming lanes serialize `MergeAdmission + ReceivingAdmission` with same physical-release/no-timeout lifecycle.
- [ ] RED traversal: newly queued movement cannot be granted in same quantum; granted traversal remains canonical until rear clears reservation footprint.
- [ ] GREEN: precompute conflict resource templates per graph revision, build deterministic maximal compatible grant set in priority order, persist traversal facts on trip, derive owner indexes.
- [ ] Remove old `slotsPerNode = floor(elapsedSeconds/serviceIntervalSeconds)` as the release authority. If `serviceIntervalSeconds` remains, it may only feed static policy/service timing and cannot bypass resources.
- [ ] Run Traffic Level 1 and 5k scale smoke.
- [ ] RED commit: `test(traffic): specify atomic junction and merge arbitration`.
- [ ] GREEN commit: `feat(traffic): reserve conflict and merge resources`.

---

### Task 16: Make Road mutation reservation-safe

**Files:** `graph-reconciler.ts`, `traffic-quantum.ts`, `traffic-reservation.ts`; tests `road-definition-compatibility.test.ts`, `traffic-routing.test.ts`, new/expanded reservation tests; Game `traffic-road-reconciliation.test.ts`.

- [ ] RED: Road Local -> Collector -> Arterial upgrade preserves active trip identity/order and valid reservation ownership when topology identity remains valid.
- [ ] RED: deleting/changing an occupied junction/access cannot expose the resource as free while canonical vehicle still occupies it.
- [ ] RED: invalidated active traversal resolves route recovery/failure/cancellation and reservation ownership atomically.
- [ ] RED: no orphan owner ID remains after reconciliation.
- [ ] GREEN: extend current deterministic `lastStableNodeId` recovery with entry/node traversal recovery anchors and reservation resolution.
- [ ] Run Traffic Level 1, Game road reconciliation tests, targeted `@road|@traffic` only after focused GREEN.
- [ ] RED commit: `test(traffic): protect occupied resources during road mutation`.
- [ ] GREEN commit: `fix(traffic): reconcile reservations with road topology`.

---

# Phase E — Persistence / Migration

### Task 17: Implement TrafficSaveV2 and explicit V1 -> V2 migration

**Files:** `traffic-snapshot.ts`, `persistence.ts`, new `traffic-migration.ts`, `traffic-v2-migration.test.ts`, `traffic-flow-persistence.test.ts`.

**TrafficSaveV2 must persist:** transport cursor; Drive movement phase/progress/access anchor; queue timestamps in new transport-time semantics; active node traversal/reserved resource IDs; existing trip/route identity facts required for deterministic continuation.

Derived lane occupancy, leader maps, graph caches, conflict matrices, and global resource-owner maps are not persisted.

- [ ] RED: valid V2 round-trip preserves exact cursor, phase, progress, queue/traversal reservation facts.
- [ ] RED: old `arrivedAtGameSecond` values rebase into vNext transport timeline while preserving queue age/order; numeric old value is not simply reinterpreted.
- [ ] RED overlap migration: preserve leader, deterministically rewind followers only as needed, never move any trip forward.
- [ ] RED overflow migration: insufficient route-origin storage sends deterministic overflow Drive trips to `WaitingForEntry`.
- [ ] RED current-schema: overlapping V2 is rejected; valid V2 load performs no positional normalization.
- [ ] GREEN: implement explicit migration function and V2 validator/encoder/decoder.
- [ ] Run Traffic Level 1 and Game compile consumer.
- [ ] RED commit: `test(traffic): define v2 save migration and overlap normalization`.
- [ ] GREEN commit: `feat(traffic): persist transport lifecycle and reservations v2`.

---

### Task 18: Implement MobilitySaveV2 + WorldSaveV8 and exact checkpoint resume

**Files:** `citizen-mobility-core/src/{mobility-snapshot,persistence}.ts`; `apps/game/src/world-save.ts`, `world-save-v8.test.ts`, existing `world-save*.test.ts`, `mobility-traffic-save-continuation.test.ts`, `application/save-coordinator.ts`, `save-coordinator.test.ts`, `committed-world-fingerprint.ts`.

**WorldSaveV8 composition:** current encode uses SimulationSaveV3 + MobilitySaveV2 + TrafficSaveV2 + unchanged current Economy/other child versions. Decoder retains explicit V7-and-earlier migration routes.

- [ ] RED: old WorldSaveV7 hour `8` loads as minute `480` with deterministic child migration.
- [ ] RED: existing committed Mobility trip keeps ID/purpose/mode/departure minute while future boundaries use SchedulePolicyV2.
- [ ] RED: save after minute `M`, quantum `Q` resumes at the next exact quantum, not `Q0` and not `M+1`.
- [ ] RED equivalence: continuous execution fingerprint equals save/load/resume fingerprint through a fixture containing at least one WaitingForEntry/Travelling/queued or node-traversal state.
- [ ] RED: current save coordinator writes `web-three-city:world-save:v8` and still discovers/migrates v7 and older keys according to existing policy.
- [ ] GREEN: implement current V8 encoder/decoder/migrations and update fingerprint to include all new authoritative Traffic/Simulation fields.
- [ ] Run Simulation/Mobility/Traffic owning tests plus Game world/save tests/typecheck.
- [ ] RED commit: `test(save): specify world v8 temporal traffic migration`.
- [ ] GREEN commit: `feat(save): migrate world to minute and traffic authority v8`.

---

# Phase F — Presentation Authority Cutover

### Task 19: Make traffic-three consume canonical safe state without acting as capacity authority

**Files:** `packages/traffic-three/src/vehicle-spacing.ts`, `lane-vehicle-spacing.test.ts`; Game `traffic-presentation-projection.ts`, `traffic-presentation.ts`, `traffic-visual-headway.test.ts`, `traffic-presentation.test.ts`, debug fixture files.

- [ ] RED: canonical two-car headway-valid snapshot materializes both cars; presentation no longer returns `materialized=false` merely because it cannot manufacture spacing at route origin.
- [ ] RED: presentation interpolation never advances follower beyond canonical safe target and never changes canonical order/fingerprint.
- [ ] RED: `WaitingForEntry`, `Entering`, `Travelling`, junction traversal, and `Leaving` project to continuous visual paths tied to the same active trip ID.
- [ ] RED: `Leaving` reaches destination without any post-terminal synthetic restart/tail authority.
- [ ] GREEN: remove presentation target-spacing code that acts as physical capacity. Retain bounded visual smoothing/headway only as a safety interpolation clamp behind already-safe canonical positions.
- [ ] Update debug API to report canonical phase/transport cursor/reservation facts separately from materialized count; remove replay counters.
- [ ] Run `traffic-three` Level 1 + Game Level 1.
- [ ] RED commit: `test(traffic-three): require canonical-safe presentation input`.
- [ ] GREEN commit: `refactor(traffic-three): render authoritative traffic without capacity hacks`.

---

# Phase G — Scale, Browser, Docs, Release

### Task 20: Prove deterministic scale without O(n²) all-vehicle work

**Files:** `traffic-core/test/traffic-scale.test.ts`, `release-scale.test.ts`; `apps/game/src/traffic-performance-release-fixture.ts`; `browser-tests/citizen-mobility-traffic-performance.@traffic@release.spec.ts`.

- [ ] RED/guard: add instrumentation/counters around lane bucket construction, neighbor checks, resource arbitration candidates. Assert work scales with active trips/local candidates, not all-pairs `n*(n-1)`.
- [ ] Run deterministic 5,000-concurrent-trip fixture twice and require identical fingerprint/ordering/reservation results.
- [ ] Assert graph-revision conflict/node classification metadata is reused within unchanged graph revision and is not rebuilt per rendered frame.
- [ ] GREEN optimize only evidenced hot paths; do not weaken physical correctness or materialization limits.
- [ ] Run Traffic scale tests, Game performance fixture, package typechecks.
- [ ] RED commit: `test(traffic): guard vnext scale complexity`.
- [ ] GREEN commit: `perf(traffic): bucket authoritative traffic progression`.

---

### Task 21: Upgrade targeted browser evidence to the real authority model

**Files:** existing `browser-tests/citizen-mobility-traffic-*.spec.ts` listed above; `traffic-release-fixture.ts`; Game browser debug surface in `main.ts`/debug files.

Browser fixture must expose enough read-only authoritative facts to assert behavior without reading private Three.js implementation as simulation truth:

```text
absoluteGameMinute
traffic transport cursor
active trip IDs + phases
queued/reserved resource summaries
materialized IDs
replay count absent/zero
```

- [ ] RED browser: two Citizens with distinct due minutes do not begin the same authoritative trip checkpoint.
- [ ] RED browser: same-minute Citizens can differ in deterministic transport offset/entry ordering.
- [ ] RED browser: short Drive trip shows real active lifecycle; no replay-only visible vehicle.
- [ ] RED browser: same-lane dense vehicles remain separated and blocked followers wait instead of disappearing.
- [ ] RED browser: blocked downstream causes visible/logical queue/spillback.
- [ ] RED browser: conflicting junction movements are never simultaneously granted; independent movements may be.
- [ ] RED browser Save/Load: cursor/phase/reservation identity resumes exactly.
- [ ] RED Road recovery: mixed Local/Collector/Arterial mutation does not orphan active Traffic/reservations.
- [ ] GREEN only after the core behavior is already GREEN; browser changes should primarily wire fixtures/assertions, not invent domain fixes.
- [ ] Run:

```bash
pnpm --filter @web-three-city/game test:browser:targeted
```

Expected final: all `@road|@traffic` targeted Chromium tests pass.
- [ ] Commit: `test(browser): verify authoritative traffic lifecycle and junctions`.

---

### Task 22: Living docs, ADRs, migration handoff, and verification packet

**Files:** living README/ADR/verification paths listed in Target File Map plus source spec status.

- [ ] Update `docs/systems/simulation-time/README.md` to shipped minute authority, macro-hour compatibility, SaveV3/WorldV8 migration.
- [ ] Create Simulation ADR for minute authority and why macro hour is derived only.
- [ ] Update `docs/systems/citizen-mobility/README.md` to SchedulePolicyV2, one-active-trip, desired-activity catch-up, MobilitySaveV2.
- [ ] Create Mobility ADR for deterministic routine + daily jitter and no congestion feedback.
- [ ] Update `docs/systems/traffic/README.md` to TrafficSaveV2, transport cursor, lifecycle, canonical headway, reservations, node classification, and Journey Replay deletion.
- [ ] Create Traffic ADR for subordinate transport time + unified physical reservation authority.
- [ ] Mark the consolidated source spec `Implemented` only after all behavioral GREEN tasks and migration are complete; before then retain review/implementation status accurately.
- [ ] Add handoff notes with current exact package ownership, Save versions, remaining explicit non-goals, and no stale claim that PR3.1 presentation headway is canonical.
- [ ] Commit: `docs(traffic): document temporal and physical authority cutover`.

---

### Task 23: Final automated release gate and owner 414×896 acceptance

This is a release task, not a place to discover architecture. If a release test fails, return to the owning TDD slice and add a focused RED before changing production code.

- [ ] Run owning package suites/typechecks:

```bash
pnpm --filter @web-three-city/simulation-core test
pnpm --filter @web-three-city/simulation-core typecheck
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/building-core typecheck
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/rci-core typecheck
pnpm --filter @web-three-city/economy-core test
pnpm --filter @web-three-city/economy-core typecheck
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/citizen-mobility-core typecheck
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/traffic-core typecheck
pnpm --filter @web-three-city/traffic-three test
pnpm --filter @web-three-city/traffic-three typecheck
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
```

- [ ] Run repository checks:

```bash
pnpm check
pnpm --filter @web-three-city/game test:browser:targeted
```

- [ ] Because this closes a release/milestone visual blocker, run the repository-policy release/full browser gate required for exact candidate closure rather than relying on the old #1765 evidence.
- [ ] Run clean-worktree verification and confirm no debug/debris/generated artifacts are untracked.
- [ ] Push the exact candidate and record new CI, Browser artifact, Sonar, and clean-worktree evidence on PR #83. Old run #1765 is historical only.
- [ ] Perform owner-controlled 414×896 manual acceptance using the Traffic release fixture. Verify at minimum:
  - real staggered departures rather than hourly/synthetic batch replay;
  - no vehicle pop directly onto Road at origin;
  - `WaitingForEntry` backpressure is visually understandable;
  - no same-direction body overlap across Road cells/turns;
  - stopped leader creates queue/spillback rather than follower disappearance;
  - no car disappears merely because calendar minute advances;
  - destination uses real `Leaving` transition with no restart/tail replay;
  - conflicting junction movements do not overlap physically;
  - compatible independent movements can proceed;
  - Road Local/Collector/Arterial changes preserve real Traffic identity/recovery;
  - curved Road divider/PR3.1 motion criteria remain visually correct.
- [ ] Only after owner acceptance + exact-head automated gates pass: update PR evidence, mark PR #83 Ready for review, and follow repository squash-merge policy.

**Final stop condition:** any unresolved owner-visible overlap/pop/batched-replay/conflict defect keeps PR #83 Draft even if CI/Sonar are green.

---

## Cross-Task Invariants Checklist

Before declaring any implementation task complete, confirm it has not violated these locked contracts:

```text
[ ] one canonical game calendar: absoluteGameMinute
[ ] macroHourIndex derived only, not separately persisted
[ ] Traffic time subordinate, versioned, population-independent
[ ] non-hour minute does not execute hourly systems
[ ] one active Mobility/Traffic trip per Citizen
[ ] missed schedule boundaries do not form historical trip backlog
[ ] Drive starts WaitingForEntry and ends only after Leaving
[ ] short Walk/Drive movement remains authoritative, never synthetic replay
[ ] physical non-overlap lives in traffic-core
[ ] route identity cannot bypass same physical-span headway
[ ] access service rate is static policy; congestion only blocks physical availability
[ ] ingress/receiving/merge/conflict resources share atomic all-or-nothing lifecycle
[ ] normal reservation release follows rear-envelope clearance
[ ] no reservation timeout
[ ] node class resolved before movement/turn classification
[ ] receiving admission is reserved atomically during concurrent grants
[ ] current-schema runtime never rewinds vehicle position
[ ] legacy overlap normalization only occurs V1 -> V2 migration
[ ] derived indexes/caches are not duplicate persisted authority
[ ] traffic-three cannot decide canonical spacing/right-of-way
[ ] no Journey Replay production movement path remains
[ ] Save/Load resumed fingerprint equals continuous execution
[ ] no O(n²) world-wide vehicle comparison per transport quantum
```

## Expected Commit/Evidence Sequence

The preferred history is a series of small TDD pairs rather than one broad implementation commit:

```text
RED  calendar minute contract
GREEN minute primitives
RED  macro consumer cadence
GREEN macro decoupling
RED  canonical minute cutover
GREEN canonical minute cutover
RED  atomic minute/transport transactions
GREEN atomic transactions
RED  runtime pacing
GREEN runtime pacing
RED  Traffic transport cursor
GREEN Traffic transport cursor
RED  Mobility schedule v2
GREEN Mobility schedule v2
RED  one-active-trip/catch-up
GREEN one-active-trip/catch-up
RED  Drive lifecycle
GREEN Drive lifecycle
RED  authoritative short-trip publication
GREEN short-trip publication
RED  no Journey Replay
GREEN replay removal
RED  canonical headway
GREEN canonical headway
RED  entry reservations
GREEN entry reservations
RED  node classification
GREEN node classification
RED  junction/merge arbitration
GREEN junction/merge arbitration
RED  reservation-safe Road mutation
GREEN Road recovery
RED  TrafficSaveV2 migration
GREEN TrafficSaveV2
RED  WorldSaveV8 resume
GREEN WorldSaveV8
RED  presentation authority cutover
GREEN presentation cutover
RED  scale guard
GREEN scale optimization
GREEN browser/docs/release evidence
```

Do not collapse these into one giant write phase. The architecture is cross-system, but each behavioral seam has an independently observable RED and a bounded GREEN target.