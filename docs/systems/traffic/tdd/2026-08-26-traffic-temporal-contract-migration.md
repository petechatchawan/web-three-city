# T3B Traffic Temporal Contract Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Traffic transport time explicit, centralize every GameMinute-to-transport conversion behind Traffic-owned APIs, extend temporal architecture enforcement to Traffic-owned units, and preserve four-quanta physical/transaction semantics exactly.

**Architecture:** `traffic-core` consumes `AbsoluteGameMinute` from `simulation-core` and owns `AbsoluteTransportSecond` plus `TransportSecondDuration`. The existing `transport-time.ts` is the correct authority seam but currently stores raw numbers and performs open-coded `sourceGameMinute * 4`; T3B upgrades that existing seam instead of creating a parallel module. Game continues to own cross-domain orchestration, but it must ask Traffic to construct/advance transport cursors and must not multiply GameMinutes or legacy queued timestamps itself.

**Tech Stack:** TypeScript 6, Vitest 4, Node test architecture tooling, Playwright 1.61, pnpm.

**Spec:** `docs/systems/simulation-time/specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md`

## Prerequisites and Branch Rule

- T3A Citizen Mobility must be merged and exact-head GREEN first.
- Create `feat/t3b-traffic-temporal-migration` from the then-current `master`; do not branch T3B from the pre-T3A T2 master.
- Record `T3B_BASE_SHA=$(git rev-parse HEAD)` before the first RED and use that SHA for all affected verification in this slice.
- Do not re-open T3A semantics unless an actual integration defect proves T3A incorrect.

## Current-Source Audit to Reconfirm Before RED

At planning time the repository already contains:

- `packages/traffic-core/src/transport-time.ts`, with `TRAFFIC_TRANSPORT_QUANTA_PER_GAME_MINUTE = 4`, a raw-number `TrafficTimeCursor`, and open-coded cursor invariant arithmetic.
- `packages/traffic-core/src/contracts.ts`, where V2 queued movement stores raw `arrivedAtTransportSecond: number`, while V1 retains historical `arrivedAtGameSecond: number`.
- `packages/traffic-core/src/persistence.ts`, where V2 decode uses raw-number parsing and `as unknown as` at codec seams.
- `apps/game/src/game-minute-transaction.ts`, where Traffic V2 construction still performs `sourceGameMinute * 4` and legacy queued conversion `arrivedAtGameSecond * 4`.
- `apps/game/src/simulation-runtime.ts`, with a duplicate local `TRANSPORT_QUANTA_PER_GAME_MINUTE = 4` used to emit Q1..Q4.
- `tooling/temporal-unit-boundary.test.mjs`, which currently knows only Simulation temporal types and trusts only `simulation-core/src/temporal-units.ts`.

Re-run the inventory locally before implementation:

```bash
rg "sourceGameMinute|absoluteTransportSecond|arrivedAtTransportSecond|arrivedAtGameSecond|TRANSPORT_QUANTA_PER_GAME_MINUTE|TRAFFIC_TRANSPORT_QUANTA_PER_GAME_MINUTE|\*\s*4" packages/traffic-core apps/game tooling -g '*.ts' -g '*.mjs'
```

Any materially different source topology is a stop-and-review condition before coding.

## Global Constraints

- Four transport quanta per GameMinute remain exactly `4`.
- Successful temporal publication remains `GameMinute -> Q1 -> Q2 -> Q3 -> Q4`, final world revision `+5`.
- `AbsoluteGameMinute` remains the sole mutable world-calendar authority.
- Traffic owns transport-resolution point/duration types and the cross-unit conversion policy.
- No route, lane, intersection, headway, entry/leave, acceleration, cap, rendering, Road, graph, or admission behavior change belongs in this slice.
- Traffic V1/V2 readers remain supported; the canonical writer remains the existing V2 wire format until T5.
- Historical V1 `arrivedAtGameSecond` is a legacy codec/runtime compatibility field only; do not rename historical bytes in T3B.
- No raw `gameMinute * 4`, `arrivedAtGameSecond * 4`, or equivalent conversion may remain in production consumers outside the Traffic-owned trusted conversion/migration seam.
- Do not weaken `temporal-unit-boundary.test.mjs` to make new code pass.
- No T4 calendar projection, T5 writer-version, or UI work in T3B.

---

### Task 1: Characterize Four-Quanta and Physical Parity

**Files:**
- Test: `packages/traffic-core/test/transport-time.test.ts`
- Test: existing Traffic drive/intersection/headway/lifecycle suites under `packages/traffic-core/test/`
- Test: `apps/game/src/traffic-transport-transaction.test.ts`
- Test: `apps/game/src/temporal-publication.test.ts`
- Test: `apps/game/src/traffic-authoritative-short-trip.test.ts`

**Interfaces:** Existing behavior for the same world snapshot is the oracle. Characterization records must include cursor values, route progress, queued arbitration timestamps, terminal trip status, and world revision order.

- [ ] **Step 1: Add characterization cases** for source GameMinute `0`, `1`, an arbitrary minute `M`, Q1..Q4 cursor progression, one walking trip, one driving trip, one junction queue, one merge/headway case, and a terminal arrival.
- [ ] **Step 2: Add Game characterization** proving one accepted minute publishes exactly five revisions/receipts in order and one rejected quantum publishes none of the staged chain.
- [ ] **Step 3: Run current tests before changing production code**:

```bash
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/game exec vitest run \
  src/traffic-transport-transaction.test.ts \
  src/temporal-publication.test.ts \
  src/traffic-authoritative-short-trip.test.ts
```

Expected: GREEN characterization. Record the exact cursor/progress/status values as parity evidence.

- [ ] **Step 4: Commit characterization only**:

```bash
git add packages/traffic-core/test apps/game/src/traffic-transport-transaction.test.ts apps/game/src/temporal-publication.test.ts apps/game/src/traffic-authoritative-short-trip.test.ts
git commit -m "test(traffic): lock transport-time parity"
```

---

### Task 2: Upgrade the Existing Traffic Transport-Time Authority

**Files:**
- Modify: `packages/traffic-core/package.json`
- Modify: `packages/traffic-core/src/transport-time.ts`
- Modify: `packages/traffic-core/src/contracts.ts`
- Modify: `packages/traffic-core/src/index.ts`
- Modify: `packages/traffic-core/src/traffic-snapshot.ts`
- Test: `packages/traffic-core/test/transport-time.test.ts`
- Test: affected snapshot/drive/lifecycle tests.

**Interfaces:**

```ts
export type AbsoluteTransportSecond = number & {
  readonly __absoluteTransportSecond: unique symbol;
};

export type TransportSecondDuration = number & {
  readonly __transportSecondDuration: unique symbol;
};

export const TRANSPORT_QUANTA_PER_GAME_MINUTE = 4 as const;

export function absoluteTransportSecond(value: number): AbsoluteTransportSecond;
export function transportSecondDuration(value: number): TransportSecondDuration;
export function transportSecondValue(
  value: AbsoluteTransportSecond | TransportSecondDuration,
): number;
export function transportSecondAtGameMinute(
  minute: AbsoluteGameMinute,
): AbsoluteTransportSecond;
export function addTransportSeconds(
  point: AbsoluteTransportSecond,
  duration: TransportSecondDuration,
): AbsoluteTransportSecond;
export function compareTransportSeconds(
  a: AbsoluteTransportSecond,
  b: AbsoluteTransportSecond,
): -1 | 0 | 1;

export interface TrafficTimeCursor {
  readonly sourceGameMinute: AbsoluteGameMinute;
  readonly completedTransportQuantaWithinMinute: number;
  readonly absoluteTransportSecond: AbsoluteTransportSecond;
  readonly temporalPolicyVersion: 1;
}
```

`ActiveTransportTripV2.queuedMovement.arrivedAtTransportSecond` becomes `AbsoluteTransportSecond`.

- [ ] **Step 1: Change tests to the target interfaces first**. Add constructor tests for negative/fractional/unsafe values, `minute 0 -> 0`, `minute 1 -> 4`, largest safe conversion boundary, overflow rejection, addition overflow rejection, and same-unit comparisons.
- [ ] **Step 2: Run focused RED**:

```bash
pnpm --filter @web-three-city/traffic-core exec vitest run test/transport-time.test.ts
pnpm --filter @web-three-city/traffic-core typecheck
```

Expected: FAIL because branded transport APIs/typed cursor fields do not yet exist.

- [ ] **Step 3: Add the one-way `traffic-core -> simulation-core` workspace dependency** if it is not already present after T3A/master changes.
- [ ] **Step 4: Implement the branded constructors/helpers inside the existing `transport-time.ts`**. `transportSecondAtGameMinute()` is the only normal runtime GameMinute-to-transport conversion and must perform checked multiplication before constructing the result.
- [ ] **Step 5: Rebuild `createTrafficTimeCursor()` invariants** using `transportSecondAtGameMinute(sourceGameMinute)` plus `transportSecondDuration(completedTransportQuantaWithinMinute)` and same-unit comparison/value helpers. Do not compare branded points with raw arithmetic in consumers.
- [ ] **Step 6: Type V2 queued movement and all Traffic runtime storage**. Keep V1 `arrivedAtGameSecond` historical compatibility as raw legacy data until codec migration.
- [ ] **Step 7: Run GREEN**:

```bash
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/traffic-core typecheck
pnpm --filter @web-three-city/traffic-core build
```

- [ ] **Step 8: Commit**:

```bash
git add packages/traffic-core
git commit -m "feat(traffic): type transport time authority"
```

---

### Task 3: Extend Temporal Architecture Enforcement to Traffic Units

**Files:**
- Modify: `tooling/temporal-unit-boundary.test.mjs`
- Create/modify fixtures under: `tooling/architecture-fixtures/temporal-unit-violations/`
- Test: repository architecture/deployment tests.

**Interfaces:** The scanner must understand `AbsoluteTransportSecond` and `TransportSecondDuration` and must distinguish trusted constructor boundaries by owned type. `simulation-core/src/temporal-units.ts` is trusted for Simulation types; `traffic-core/src/transport-time.ts` is trusted only for Traffic transport types.

- [ ] **Step 1: Add RED fixtures** proving these are rejected outside trusted boundaries:

```ts
const direct = 4 as AbsoluteTransportSecond;
const escaped = value as unknown as AbsoluteTransportSecond;
const invalid = gameMinute < transportSecond;
const rawAdvance = transportSecond + 1;
```

Also add one valid fixture using `transportSecondAtGameMinute`, `addTransportSeconds`, and `compareTransportSeconds`.

- [ ] **Step 2: Run RED architecture test**:

```bash
node --test tooling/temporal-unit-boundary.test.mjs
```

Expected: new Traffic violation fixture is not fully classified yet.

- [ ] **Step 3: Extend the scanner** with the two Traffic type names and type-specific trusted-boundary logic. Do not globally exempt all code in `transport-time.ts` from Simulation-unit rules if a narrower ownership-aware exemption can be expressed.
- [ ] **Step 4: Run architecture/deployment GREEN**:

```bash
node --test tooling/temporal-unit-boundary.test.mjs
pnpm test:deployment
```

- [ ] **Step 5: Commit**:

```bash
git add tooling/temporal-unit-boundary.test.mjs tooling/architecture-fixtures
git commit -m "test(architecture): enforce traffic temporal units"
```

Because verification tooling changed, expect Selective Verification to classify this commit conservatively, potentially GLOBAL/Full Browser. Do not weaken the resolver or scanner to avoid that escalation.

---

### Task 4: Isolate Traffic V1/V2 Codec Temporal Semantics

**Files:**
- Modify: `packages/traffic-core/src/persistence.ts`
- Modify only if existing migration owner requires: `packages/traffic-core/src/traffic-migration.ts`
- Test: Traffic persistence/migration tests under `packages/traffic-core/test/`.

**Interfaces:**

- Traffic V2 `timeCursor.sourceGameMinute` decodes 1:1 to `AbsoluteGameMinute`.
- Traffic V2 `timeCursor.absoluteTransportSecond` and `arrivedAtTransportSecond` decode 1:1 to `AbsoluteTransportSecond`.
- Traffic V1 `arrivedAtGameSecond` remains historical wire data and converts through one checked Traffic-owned migration helper.
- Current V2 writer payload field names and numeric values remain unchanged until T5.

- [ ] **Step 1: Add RED codec tests** for V2 cursor 1:1 continuation, queued movement 1:1 continuation, invalid negative/fractional/unsafe points, cross-field cursor mismatch, V1 queued migration, and conversion overflow.
- [ ] **Step 2: Add a writer-parity assertion** comparing the V2 payload before/after runtime typing; JSON-visible field names and numeric values must be unchanged.
- [ ] **Step 3: Replace broad `as unknown as TrafficSnapshotV2['timeCursor']` construction** with validating field-by-field decode into Traffic-owned constructors.
- [ ] **Step 4: Route V1 conversion through the single checked migration/conversion function**. No caller outside the codec/migration owner may multiply by `4`.
- [ ] **Step 5: Run Traffic persistence + full package GREEN**:

```bash
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/traffic-core typecheck
```

- [ ] **Step 6: Commit**:

```bash
git add packages/traffic-core/src/persistence.ts packages/traffic-core/src/traffic-migration.ts packages/traffic-core/test
git commit -m "refactor(traffic): isolate temporal codec migration"
```

---

### Task 5: Cut Game to Traffic-Owned Cursor and Conversion APIs

**Files:**
- Modify: `apps/game/src/game-minute-transaction.ts`
- Modify: `apps/game/src/traffic-transport-transaction.ts`
- Modify: `apps/game/src/temporal-publication-controller.ts`
- Modify: `apps/game/src/mobility-traffic-tick.ts`
- Modify: `apps/game/src/simulation-runtime.ts`
- Test: `apps/game/src/traffic-transport-transaction.test.ts`
- Test: `apps/game/src/temporal-publication.test.ts`
- Test: `apps/game/src/traffic-authoritative-short-trip.test.ts`
- Test: `apps/game/src/simulation-runtime.test.ts`

**Interfaces:** Game may pass `AbsoluteGameMinute` into Traffic APIs, but must not know how many transport seconds that minute represents except via the Traffic constant/API. Runtime event order remains Q1..Q4.

- [ ] **Step 1: Change focused tests first** so the Game seam expects typed `sourceGameMinute` and Traffic-constructed cursor values. Add a static regression assertion or architecture check that `game-minute-transaction.ts` contains no `* 4` temporal conversion.
- [ ] **Step 2: Run focused RED**:

```bash
pnpm --filter @web-three-city/game exec vitest run \
  src/traffic-transport-transaction.test.ts \
  src/temporal-publication.test.ts \
  src/traffic-authoritative-short-trip.test.ts \
  src/simulation-runtime.test.ts
```

Expected: type/API failures at the old raw conversion seam.

- [ ] **Step 3: Replace `sourceGameMinute * 4` with `transportSecondAtGameMinute(sourceGameMinute)`** and replace legacy queued timestamp conversion with the Traffic-owned migration helper.
- [ ] **Step 4: Replace the duplicate Game constant** with the canonical Traffic-owned quanta constant where doing so does not create a dependency cycle. The runtime still emits exactly ordinals 1,2,3,4.
- [ ] **Step 5: Do not change `advanceTrafficQuantum()` physical semantics**. Re-run the characterization from Task 1 and compare cursor/progress/terminal results.
- [ ] **Step 6: Run GREEN**:

```bash
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/game exec vitest run \
  src/traffic-transport-transaction.test.ts \
  src/temporal-publication.test.ts \
  src/traffic-authoritative-short-trip.test.ts \
  src/simulation-runtime.test.ts
pnpm --filter @web-three-city/game typecheck
```

- [ ] **Step 7: Commit**:

```bash
git add apps/game/src packages/traffic-core
git commit -m "refactor(game): adopt traffic transport-time contracts"
```

---

### Task 6: Combined T3A + T3B Persistence and Physical Parity

**Files:**
- Test: `apps/game/src/mobility-traffic-save-continuation.test.ts`
- Test: existing Traffic drive/intersection/headway suites.
- Browser: existing `@traffic` specs, especially save/load, commute, mobile regression, and release coverage.

**Interfaces:** This is the combined T3 proof. Mobility schedule points are typed by T3A; Traffic transport points are typed by T3B; save/load and physical results must match the pre-T3 behavior at identical canonical GameMinutes.

- [ ] **Step 1: Add/refresh continuation cases** for `N:59 -> N+1:00` with one active Walk trip, one active Drive trip, and at least one queued/junction movement.
- [ ] **Step 2: Assert uninterrupted vs save/load-resumed equality** for Mobility trip identity/status/activity, Traffic cursor, route segment/progress, queued timestamps, final world revision, and receipt order.
- [ ] **Step 3: Run full owner/consumer GREEN**:

```bash
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/game test
pnpm test:deployment
pnpm check
git diff --check
```

- [ ] **Step 4: Run affected plan before Browser**:

```bash
pnpm verify:affected -- --base "$T3B_BASE_SHA" --head HEAD --plan-only --json
pnpm verify:affected -- --base "$T3B_BASE_SHA" --head HEAD --skip-browser
```

The resolver result is the minimum. If shared verification tooling changed, honor GLOBAL/Full Browser escalation.

- [ ] **Step 5: Build browser artifact once and run the resolver-required Browser authority**. At minimum when targeted Traffic Browser is selected, use the existing `@traffic` tagged specs rather than inventing duplicate broad suites.
- [ ] **Step 6: Verify tracked cleanliness**. The two pre-existing user-owned untracked planning files may remain untouched if they still exist; record them separately rather than hiding them.

---

## Exact-Head Release Gate

Before push:

```bash
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/traffic-core typecheck
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/game test
pnpm test:deployment
pnpm check
git diff --check
```

Then non-force push the GREEN candidate, open a Draft PR, and require exact-head GitHub Actions + Sonar. Full Browser is required when the resolver/verification-tooling authority selects it. Do not merge T3B until exact-head gates are GREEN.

## Exit Gate

T3 is complete only when:

- Mobility schedule points remain exact 1:1 `AbsoluteGameMinute` semantics from T3A.
- Traffic runtime cursor/queued points use explicit Traffic-owned transport types.
- all cross-unit conversion is centralized in Traffic-owned checked helpers;
- four quanta per GameMinute and `GameMinute -> Q1 -> Q2 -> Q3 -> Q4` remain unchanged;
- route, lane, junction, headway, entry/leave, rendering, and Road behavior are parity-equivalent;
- V1/V2 Traffic read support and V2 writer bytes remain compatible;
- combined Mobility+Traffic save/load continuation is GREEN;
- architecture tooling rejects direct/escaped Traffic temporal casts;
- exact-head CI/Sonar and required Browser authority are GREEN.

Only after T3B is merged and combined T3 closure is recorded may T4 Compressed Calendar implementation begin.
