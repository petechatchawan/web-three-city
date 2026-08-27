# T5 WorldSaveV9 Temporal + Calendar Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce WorldSaveV9 as the sole canonical writer with explicit temporal/calendar policy discriminators and explicit domain temporal field names, while preserving V1–V8 readability, canonical `AbsoluteGameMinute` continuity, RCI age semantics, and deterministic continuation across every migrated domain.

**Architecture:** Each domain owns its new save codec and converts between wire primitives and typed runtime contracts. `apps/game/src/world-save.ts` owns only world-envelope composition/version dispatch and calls domain-owned decoders/migrations; it must not reimplement Building, RCI, Economy, Mobility, or Traffic temporal arithmetic. V9 identifies Temporal Standard v1 and Compressed Calendar Policy v1 once at the world envelope, while domain payload versions make new wire names unambiguous.

**Tech Stack:** TypeScript 6, Vitest 4, Playwright 1.61, pnpm, browser save/load fixtures.

**Spec:** `docs/systems/simulation-time/specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md`

## Prerequisites and Branch Rule

- T4 Compressed Calendar must be merged and exact-head GREEN first.
- Create `feat/t5-world-save-v9-temporal-migration` from the then-current `master`.
- Record `T5_BASE_SHA=$(git rev-parse HEAD)` before the first RED.
- Do not begin T6 UI/release cutover inside this branch; Browser work here is persistence authority only.

## Current-Source Audit to Reconfirm Before RED

At planning time, before T3/T4 execution, the repository has these compatibility seams:

- Canonical world writer is `WorldSaveV8` in `apps/game/src/world-save.ts`.
- V8 composes `SimulationSaveV3`, `BuildingSaveV2`, `RciSaveV1`, `EconomySaveV1`, `MobilitySaveV2`, and `TrafficSaveV2`.
- `SimulationSaveV1/V2` persist legacy macro-hour `absoluteTick`; their reader converts with checked `* 60`. `SimulationSaveV3` already persists `absoluteGameMinute` 1:1.
- `BuildingSaveV2` retains legacy wire names such as `constructionStartedAtTick`, `constructionCompletesAtTick`, and `activatedAtTick` while runtime state is explicit macro-hour typed.
- `RciSaveV1` retains `bornAtTick` plus historical/event `*Tick` wire names. Runtime records are already classified into `AgeOriginMacroHourIndex` and `MacroHourIndex` fields.
- `EconomySaveV1` retains `lastDailySettlementTick` / `lastMonthlyCloseTick` while runtime state uses explicit macro-hour names.
- Mobility writer is V2 and, after T3A, should retain legacy wire names only at codec boundaries while runtime uses `AbsoluteGameMinute` / cycle semantics.
- Traffic writer is V2 and, after T3B, should retain legacy V1/V2 fields only at codec boundaries while runtime uses Traffic-owned transport types.
- `apps/game/src/application/save-coordinator.ts` currently uses a storage-address constant whose name/value references V8. Changing that storage address is **not** required to change the payload schema and risks making existing saves undiscoverable.

Re-audit the actual post-T4 source before implementation:

```bash
rg "WorldSaveV[1-9]|SaveV[1-4]|schemaVersion|absoluteTick|absoluteGameMinute|AtTick|GameSecond|scheduleCursor|transportSecond|WORLD_SAVE_KEY|world-v8" \
  packages apps/game/src -g '*.ts'
```

If T3/T4 already eliminated a seam, remove it from the implementation diff rather than recreating it for plan conformity.

## Global Constraints

- Reader accepts WorldSave V1–V9; writer emits WorldSave V9 only after all new domain codecs are GREEN.
- Target V9 composition is exactly:

```text
SimulationSaveV4
BuildingSaveV3
RciSaveV2
EconomySaveV2
MobilitySaveV3
TrafficSaveV3
WorldSaveV9
```

- V9 envelope requires `temporalStandardVersion = 1` and `calendarPolicyVersion = 1`.
- Unknown V9 policy discriminator values reject the entire save; no partial best-effort load.
- V8 `AbsoluteGameMinute` migrates 1:1. The old displayed calendar label is not preserved; T4 projection reprojects the same canonical minute.
- Simulation V1/V2 legacy `absoluteTick` converts using checked `* 60` only inside the legacy Simulation codec.
- Building legacy lifecycle macro-hour points/durations migrate 1:1.
- Economy settlement/accounting macro-hour points migrate 1:1.
- Mobility GameMinute schedule/trip points migrate 1:1; recurrence cursor remains a Simulation Cycle counter, not calendar authority.
- Traffic V2 transport seconds migrate 1:1; V1 legacy conversion uses the single checked Traffic-owned migration path created in T3B.
- RCI age-origin is **not** blanket 1:1. Legacy year = 8640 macro hours, compressed year = 288 macro hours. Use the approved checked mapping relative to current macro hour:

```text
legacyElapsed = currentMacroHour - legacyBornMacroHour
newElapsed    = floor(legacyElapsed * 288 / 8640)
newBorn       = currentMacroHour - newElapsed
```

- RCI non-age temporal fields follow their T2B field classification; historical/event points that were proven 1:1 remain 1:1.
- Preserve whole age-years, age band, citizen ordering, and fractional-year phase proportionally at cutover.
- No per-record `{ value, unit }` wrapper allocation.
- Do not change simulation speed, domain cadence, Traffic physics/routing, Economy formulas, automatic Growth, or UI design.
- Keep the existing persistent storage address discoverable through T5. Payload `schemaVersion` is the authority for format; do **not** rename the storage key merely to remove “v8” from its string. A storage-key migration requires a separate explicit product decision and dual-read migration.

---

### Task 1: Freeze the V1–V8 Golden Migration Oracle

**Files:**
- Create or extend fixture directory following the repository's existing convention under `apps/game/test/fixtures/` or the existing world-save fixture location discovered locally.
- Test: `apps/game/src/world-save.test.ts`
- Test: existing version-specific world-save tests.
- Test: per-domain legacy codec tests.

**Interfaces:** The fixture matrix must cover all world envelope versions V1–V8 and must assert semantic fields, not only large snapshots.

- [ ] **Step 1: Add one representative golden fixture per WorldSave version V1–V8**. The set collectively must cover: pre-minute Simulation time, construction in progress, populated RCI with citizens at age boundaries, RCI history/events, Economy settlement history, planned/active Mobility, active Walk + Drive, and Traffic queue/cursor state where that version supports them.
- [ ] **Step 2: Add a migration-oracle helper in test code only** that normalizes decoded runtime state into comparable semantic facts:

```ts
{
  absoluteGameMinute,
  buildingLifecycle,
  citizenAgesAndBands,
  rciHistoricalPoints,
  economySettlementState,
  mobilityTripsAndActivities,
  trafficCursorAndTripProgress,
  worldRevision,
}
```

- [ ] **Step 3: Run current V1–V8 readers before production changes** and record GREEN baseline values.
- [ ] **Step 4: Add explicit cutover-age fixtures** for newborn, 287/288 compressed-hour boundary equivalents, 1 year, 5.5 years, 18 years, 65+ years, signed/pre-epoch age origin where supported, and same-age citizens with deterministic ordering.
- [ ] **Step 5: Commit characterization only**:

```bash
git add apps/game/test apps/game/src/*world-save*.test.ts packages/*/test
git commit -m "test(world): freeze v1-v8 temporal migration oracle"
```

---

### Task 2: Add `SimulationSaveV4`

**Files:**
- Modify: `packages/simulation-core/src/serialization.ts`
- Modify: `packages/simulation-core/src/index.ts`
- Test: simulation serialization tests.

**Interfaces:**

```ts
export interface SimulationSaveV4 {
  readonly kind: 'simulation-save';
  readonly schemaVersion: 4;
  readonly revision: number;
  readonly absoluteGameMinute: number;
  readonly growthSequence: number;
}
```

V4 intentionally preserves the V3 canonical minute value 1:1; the version participates in the V9 all-domain explicit-cutover contract. Calendar policy discrimination remains at the WorldSaveV9 envelope, not duplicated per record.

- [ ] **Step 1: Write RED tests** for V4 schema, safe integer validation, `absoluteGameMinute` 1:1, roundtrip equality, and V1/V2 checked overflow conversion.
- [ ] **Step 2: Run RED**:

```bash
pnpm --filter @web-three-city/simulation-core test
```

- [ ] **Step 3: Implement V4 encoder/decoder and keep V1/V2/V3 readers intact**. Do not remove legacy `absoluteTick` reader code.
- [ ] **Step 4: Run package test/typecheck/build GREEN**.
- [ ] **Step 5: Commit**:

```bash
git add packages/simulation-core
git commit -m "feat(simulation): add SimulationSaveV4"
```

---

### Task 3: Add `BuildingSaveV3` with Explicit Macro-Hour Wire Names

**Files:**
- Modify: `packages/building-core/src/serialization-v2.ts` or split a focused V3 codec file if that matches package convention.
- Modify: `packages/building-core/src/index.ts`
- Test: Building serialization/lifecycle tests.

**Interfaces:** V3 preserves the existing Building snapshot structure but replaces ambiguous lifecycle wire fields with the runtime semantic names:

```text
constructionStartedAtMacroHourIndex
constructionCompletesAtMacroHourIndex
activatedAtMacroHourIndex
constructionDurationMacroHours     // where definition/duration is persisted
```

Existing V1/V2 readers and their `*Tick` JSON fields remain compatibility-only.

- [ ] **Step 1: Write RED V3 codec tests** asserting explicit field names, absence of lifecycle `*Tick` names in V3 output, 1:1 numeric values, null handling, invalid negative/fractional/unsafe rejection, and roundtrip equality.
- [ ] **Step 2: Implement V3 writer/reader using Building-owned typed constructors/helpers**. Do not duplicate lifecycle validation in world-save code.
- [ ] **Step 3: Prove an in-progress construction at macro hours 12/15/18 has identical progress/completion before and after V2->runtime->V3 migration.
- [ ] **Step 4: Run Building full suite/typecheck/build GREEN**.
- [ ] **Step 5: Commit**:

```bash
git add packages/building-core
git commit -m "feat(buildings): add explicit BuildingSaveV3"
```

---

### Task 4: Add `RciSaveV2` with Classification-Preserving Temporal Fields

**Files:**
- Modify: `packages/rci-core/src/persistence/serialization.ts`
- Modify: `packages/rci-core/src/migration/legacy-age-origin-migration.ts`
- Modify: `packages/rci-core/src/index.ts`
- Test: RCI persistence, age, event, lifecycle, and migration suites.

**Interfaces:** RciSaveV2 mirrors runtime semantics instead of legacy `*Tick` wire names. Required V2 naming follows current runtime records, including:

```text
bornAtMacroHourIndex                  // age-origin semantics
movedIntoCityAtMacroHourIndex
movedOutOfCityAtMacroHourIndex
diedAtMacroHourIndex
foundedAtMacroHourIndex
dissolvedAtMacroHourIndex
startedAtMacroHourIndex
endedAtMacroHourIndex
awardedAtMacroHourIndex
activatedAtMacroHourIndex
retiredAtMacroHourIndex
requestedAtMacroHourIndex
displacedAtMacroHourIndex
expiresAtMacroHourIndex
evaluatedAtMacroHourIndex
macroHourIndex                        // domain-event point
```

Other non-temporal V1 fields remain structurally equivalent unless validation requires a version-local DTO.

- [ ] **Step 1: Write RED schema tests** proving V2 output contains no ambiguous `bornAtTick`, `atTick`, `evaluationTick`, or generic lifecycle `*Tick` field.
- [ ] **Step 2: Write RED migration tests** applying the approved 8640->288 age-origin conversion relative to current macro hour. Assert preserved age-years, age band, proportional phase, ordering, and deterministic replay.
- [ ] **Step 3: Add property/boundary cases** around legacy-year boundaries and large safe integer values; overflow must reject, never clamp.
- [ ] **Step 4: Keep non-age historical/event points 1:1 only where the T2B classification proves that semantic. Add explicit assertions for each persisted temporal class found by:

```bash
rg "Tick|MacroHourIndex|CycleIndex" packages/rci-core/src/persistence packages/rci-core/src/contracts packages/rci-core/src/events -g '*.ts'
```

- [ ] **Step 5: Implement V2 codec using RCI-owned age migration/helpers**; world-save code passes the canonical current macro hour but does not perform RCI math.
- [ ] **Step 6: Run full RCI suite/typecheck/build GREEN**, including 287/288 and 12-cycle annual hazard tests.
- [ ] **Step 7: Commit**:

```bash
git add packages/rci-core
git commit -m "feat(rci): add explicit RciSaveV2"
```

---

### Task 5: Add `EconomySaveV2` with Explicit Macro-Hour Wire Names

**Files:**
- Modify: `packages/economy-core/src/serialization.ts`
- Modify: `packages/economy-core/src/index.ts`
- Test: Economy serialization/settlement tests.

**Interfaces:** V2 replaces legacy wire names:

```text
lastDailySettlementTick
-> latestCycleSettlementAtMacroHourIndex

lastMonthlyCloseTick
-> lastMonthlyCloseAtMacroHourIndex
```

All treasury, ledger, period, tax, and accounting values remain unchanged.

- [ ] **Step 1: Write RED V2 schema/roundtrip tests** and prove V1 decode still maps 1:1.
- [ ] **Step 2: Reject invalid negative/fractional/unsafe macro-hour points through existing typed helpers.
- [ ] **Step 3: Implement V2 codec without changing settlement formulas or period-close behavior.
- [ ] **Step 4: Prove 07->08, 08->09, and 31->32 macro-hour settlement parity plus treasury/ledger byte/value parity.
- [ ] **Step 5: Run Economy full suite/typecheck/build GREEN**.
- [ ] **Step 6: Commit**:

```bash
git add packages/economy-core
git commit -m "feat(economy): add explicit EconomySaveV2"
```

---

### Task 6: Add `MobilitySaveV3` from the T3A Runtime Contract

**Files:**
- Modify: `packages/citizen-mobility-core/src/persistence.ts`
- Modify: `packages/citizen-mobility-core/src/index.ts`
- Test: Mobility persistence/schedule tests.

**Interfaces:** Use the actual T3A merged runtime names. Expected V3 semantics are:

```text
scheduleCursorCycle: number
nextBoundaryGameMinute: number | null      // AbsoluteGameMinute wire primitive
departureGameMinute: number                // AbsoluteGameMinute wire primitive
```

If T3A selected a more precise recurrence-counter name based on characterization, V3 must use that exact merged runtime semantic name rather than reintroducing `scheduleCursorDay`.

- [ ] **Step 1: Write RED V3 schema tests** asserting cycle naming, 1:1 AbsoluteGameMinute values, writer absence of `scheduleCursorDay`, invalid point rejection, and roundtrip equality.
- [ ] **Step 2: Prove V1/V2 readers remain readable and map legacy GameMinute values 1:1 through T3A codec helpers.
- [ ] **Step 3: Prove commute identity/purpose/mode/status and `23:59 -> 00:00` recurrence behavior unchanged across V2->runtime->V3.
- [ ] **Step 4: Run Mobility full suite/typecheck/build GREEN**.
- [ ] **Step 5: Commit**:

```bash
git add packages/citizen-mobility-core
git commit -m "feat(mobility): add explicit MobilitySaveV3"
```

---

### Task 7: Add `TrafficSaveV3` from the T3B Transport-Time Contract

**Files:**
- Modify: `packages/traffic-core/src/persistence.ts`
- Modify: `packages/traffic-core/src/index.ts`
- Test: Traffic persistence/transport/physical suites.

**Interfaces:** V3 stores explicit primitives corresponding to typed runtime fields:

```text
timeCursor.sourceGameMinute
timeCursor.completedTransportQuantaWithinMinute
timeCursor.absoluteTransportSecond
timeCursor.temporalPolicyVersion
queuedMovement.arrivedAtTransportSecond
```

V1 historical `arrivedAtGameSecond` remains only in the V1 reader. V2 transport-second values migrate 1:1.

- [ ] **Step 1: Write RED V3 schema/roundtrip tests** for explicit transport names, V2 1:1 continuation, V1 checked migration, overflow rejection, and absence of V1 legacy game-second names in V3 output.
- [ ] **Step 2: Implement V3 using Traffic-owned constructors/value helpers from T3B.
- [ ] **Step 3: Prove four-quanta cursor invariants and route/junction/headway receipts identical for equal runtime state.
- [ ] **Step 4: Run Traffic full suite/typecheck/build GREEN**.
- [ ] **Step 5: Commit**:

```bash
git add packages/traffic-core
git commit -m "feat(traffic): add explicit TrafficSaveV3"
```

---

### Task 8: Compose and Decode `WorldSaveV9`

**Files:**
- Modify: `apps/game/src/world-save.ts`
- Create/modify: `apps/game/src/world-save-v9.test.ts`
- Test: existing version-specific world migration tests.

**Interfaces:**

```ts
export interface WorldSaveV9 {
  readonly kind: 'world-save';
  readonly schemaVersion: 9;
  readonly temporalStandardVersion: 1;
  readonly calendarPolicyVersion: 1;
  readonly simulation: SimulationSaveV4;
  readonly building: BuildingSaveV3;
  readonly rci: RciSaveV2;
  readonly economy: EconomySaveV2;
  readonly mobility: MobilitySaveV3;
  readonly traffic: TrafficSaveV3;
  // all existing non-temporal world payloads remain at their current versions
}
```

- [ ] **Step 1: Write RED V9 envelope tests** for exact domain schema versions and both required policy discriminators.
- [ ] **Step 2: Add RED rejection tests** for missing, zero, negative, fractional, unsafe, or unknown `temporalStandardVersion` / `calendarPolicyVersion`. The entire decode must fail before publication; no partial world is returned.
- [ ] **Step 3: Implement `encodeWorldSaveV9()` only after Tasks 2–7 are GREEN.
- [ ] **Step 4: Extend world decode dispatch to V9 while retaining V1–V8 paths. V8 canonical minute must be passed 1:1 into the new runtime; do not reconstruct it from legacy displayed year/month/day labels.
- [ ] **Step 5: Route each domain payload through its owning decoder/migration helper. No raw `*60`, `*4`, age-year scaling, lifecycle comparison, or settlement math may be introduced in `world-save.ts`.
- [ ] **Step 6: Run all world-save migration tests and Game typecheck GREEN**.
- [ ] **Step 7: Commit**:

```bash
git add apps/game/src/world-save.ts apps/game/src/*world-save*.test.ts
git commit -m "feat(world): compose WorldSaveV9"
```

---

### Task 9: Switch the Canonical Writer to V9 Without Losing Storage Discovery

**Files:**
- Modify: `apps/game/src/application/save-coordinator.ts`
- Modify: Game bootstrap/storage adapters only if they directly select writer version.
- Test: `apps/game/src/application/save-coordinator.test.ts`
- Test: `apps/game/src/world-save.test.ts`

**Interfaces:**

- Save commands call `encodeWorldSaveV9()`.
- Load accepts payload schemas V1–V9 through the existing storage address.
- The persisted storage key/address remains unchanged in T5 even if its historical name contains `v8`; payload `schemaVersion` controls interpretation.

- [ ] **Step 1: Write RED tests** asserting a fresh save emits `schemaVersion: 9` with all V9 domain versions and discriminators.
- [ ] **Step 2: Add a storage-discovery regression** that a pre-existing V8 payload at the current production storage address is still found and migrated after the writer cutover.
- [ ] **Step 3: Change writer selection to V9 without renaming the persistent storage address.
- [ ] **Step 4: Verify invalid V9 payload/discriminator rejects without mutating the current committed world or overwriting the valid stored payload.
- [ ] **Step 5: Run Game save-coordinator/world-save GREEN**.
- [ ] **Step 6: Commit**:

```bash
git add apps/game/src/application/save-coordinator.ts apps/game/src/application/save-coordinator.test.ts apps/game/src/world-save.ts apps/game/src/world-save.test.ts
git commit -m "feat(world): make WorldSaveV9 canonical writer"
```

---

### Task 10: V1–V9 Golden Migration + Continuation Equivalence

**Files:**
- Test: `apps/game/src/world-save-v9.test.ts`
- Test: `apps/game/src/mobility-traffic-save-continuation.test.ts`
- Test: `apps/game/src/economy-save-continuation.test.ts`
- Test: Building/RCI save continuation suites discovered locally.
- Fixtures: golden V1–V8 files from Task 1.

**Interfaces:** Every historical fixture migrates to a V9 runtime state whose semantic oracle is correct; uninterrupted and resumed simulations converge at the same state.

- [ ] **Step 1: Run the complete V1–V8 fixture matrix through the V9-capable reader** and compare semantic facts, not raw legacy labels.
- [ ] **Step 2: Add V9 encode->decode roundtrip and deterministic re-encode equality.
- [ ] **Step 3: Save at `23:59`, load, advance to `00:00`, and compare uninterrupted vs resumed state across Simulation, Building, RCI, Economy, Mobility, Traffic, receipts, and final revision.
- [ ] **Step 4: Include construction-in-progress, active Walk, active Drive, queued Traffic, and an RCI citizen near an age-band boundary in one integrated continuation fixture.
- [ ] **Step 5: Prove the same migrated citizen age-years/band/order/fractional phase before and after V9 roundtrip.
- [ ] **Step 6: Run full deterministic verification**:

```bash
pnpm --filter @web-three-city/simulation-core test
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/economy-core test
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/game test
pnpm test:deployment
pnpm check
git diff --check
```

- [ ] **Step 7: Commit**:

```bash
git add apps/game/src apps/game/test packages/*/test
git commit -m "test(world): prove WorldSaveV9 migration continuation"
```

---

### Task 11: Browser Persistence Authority

**Files:**
- Modify: `apps/game/src/browser-world-save-fixture.ts`
- Modify/create: existing Browser save/load specs under `browser-tests/`.

**Interfaces:** Browser evidence covers product storage/load behavior; deterministic migration arithmetic remains owner-test authority.

- [ ] **Step 1: Add Browser cases** for fresh V9 save/load, production-storage V8 migration, compressed-calendar label after migrated load, and an active construction + Mobility/Traffic continuation.
- [ ] **Step 2: Add one corrupted/unknown V9 discriminator case** proving the UI/runtime does not partially load a rejected city.
- [ ] **Step 3: Run unit/Game GREEN first, build one exact Browser artifact, then run resolver-selected save/load tags.

---

## Selective and Exact-Head Verification

Before push:

```bash
pnpm verify:affected -- --base "$T5_BASE_SHA" --head HEAD --plan-only --json
pnpm verify:affected -- --base "$T5_BASE_SHA" --head HEAD --skip-browser
pnpm check
git diff --check
```

Because persistence spans all major domains, expect broad consumer/deployment coverage and honor any GLOBAL/Full Browser escalation. Push only a GREEN candidate, open a Draft PR, and require exact-head GitHub Actions + Sonar before merge.

## Exit Gate

T5 is complete only when:

- canonical writer is WorldSaveV9 with exactly SimulationV4/BuildingV3/RciV2/EconomyV2/MobilityV3/TrafficV3;
- WorldSave V1–V9 are readable;
- unknown V9 temporal/calendar policy discriminators reject the entire save;
- V8 canonical `AbsoluteGameMinute` is numerically identical after migration and simply reprojects under T4 calendar policy;
- Building/Economy/Mobility/Traffic temporal values follow their approved 1:1 rules;
- RCI age-origin follows the approved checked 8640->288 mapping and preserves age/band/order/phase;
- V9 writer output contains no ambiguous runtime `*Tick`/legacy GameSecond field names;
- old wire names remain only in legacy readers/DTOs needed for V1–V8 compatibility;
- the existing production storage address still discovers pre-V9 saves;
- `23:59 -> 00:00` uninterrupted vs resumed continuation is equivalent across all domains;
- exact-head CI/Sonar and required Browser authority are GREEN.

Only after T5 is merged may T6 Game/UI/release cutover begin.
