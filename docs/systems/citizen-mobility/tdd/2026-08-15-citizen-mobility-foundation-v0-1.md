# Citizen Mobility Foundation v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic per-Citizen activity/schedule/trip authority for real Home ↔ Work commuting while preserving RCI as the sole Citizen identity/lifecycle authority.

**Architecture:** `packages/citizen-mobility-core` is framework-independent and consumes only narrow primitive projections supplied by `apps/game`; it never imports `rci-core`, `building-core`, `road-core`, `traffic-core`, DOM, or Three.js. PR1 establishes contracts/snapshot/persistence; PR2 adds deterministic schedule/event processing, commute requests, mode-choice, and lifecycle reconciliation.

**Tech Stack:** TypeScript 6, Vitest 4, pnpm workspace package conventions matching `rci-core`/`economy-core`.

## Global Constraints

- RCI `CitizenId = string` remains the sole Citizen identity.
- Mobility owns activity/schedule/trip intent only; Traffic owns route/progress.
- No direct `citizen-mobility-core` → `traffic-core` import.
- No `Math.random()`, wall clock, or render delta in authority.
- One simulation tick remains one game hour; Mobility event boundaries use integer `GameMinute`.
- A failed/stale world transaction consumes no generated trip ID.
- V1–V6 migration creates no historical/catch-up trip.
- Scale target: 20,000 logical Citizens without per-frame all-Citizen work.

---

# PR1 — Core Contracts, Snapshot, Validation, MobilitySaveV1

**Branch:** `feat/citizen-mobility-core-v0-1`

## Task 1: Scaffold the workspace package with a dependency-free public API

**Files:**
- Create: `packages/citizen-mobility-core/package.json`
- Create: `packages/citizen-mobility-core/tsconfig.json`
- Create: `packages/citizen-mobility-core/tsconfig.build.json`
- Create: `packages/citizen-mobility-core/vitest.config.ts`
- Create: `packages/citizen-mobility-core/src/index.ts`
- Modify later in PR6: `apps/game/package.json` — do **not** add app dependency in PR1 unless an app test consumes it.

**Interfaces:**
- Package name: `@web-three-city/citizen-mobility-core`
- Runtime dependencies: none.

- [ ] **Step 1: Add the RED package-boundary test**

Create `packages/citizen-mobility-core/test/public-api.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MOBILITY_SCHEMA_VERSION } from '../src/index.js';

describe('citizen-mobility-core public API', () => {
  it('exports the v1 schema version without framework dependencies', () => {
    expect(MOBILITY_SCHEMA_VERSION).toBe(1);
  });
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test
```

Expected: package/source does not exist or export is missing.

- [ ] **Step 3: Add package files and minimal export**

`src/index.ts` begins with:

```ts
export const MOBILITY_SCHEMA_VERSION = 1 as const;
```

Follow the exact scripts/config shape already used by `packages/rci-core`.

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/citizen-mobility-core typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/citizen-mobility-core
git commit -m "feat(mobility): add core package boundary"
```

## Task 2: Define stable Mobility contracts and typed validation errors

**Files:**
- Create: `packages/citizen-mobility-core/src/contracts.ts`
- Create: `packages/citizen-mobility-core/src/errors.ts`
- Modify: `packages/citizen-mobility-core/src/index.ts`
- Test: `packages/citizen-mobility-core/test/contracts.test.ts`

**Produces:**

```ts
export type MobilityTripId = string;
export type MobilityActivityKind = 'Home' | 'Work' | 'Idle' | 'Travel';
export type MobilityTripMode = 'Walk' | 'Drive';
export type MobilityTripPurpose = 'CommuteToWork' | 'CommuteHome';
export type MobilityTripStatus = 'Planned' | 'Active' | 'Arrived' | 'Failed' | 'Cancelled';
export type MobilityTripFailureReason = 'Unreachable' | 'OriginUnavailable' | 'DestinationUnavailable';

export interface CitizenMobilityState {
  readonly citizenId: string;
  readonly currentActivity: MobilityActivityKind;
  readonly stationaryBuildingId: string | null;
  readonly activeTripId: MobilityTripId | null;
  readonly scheduleCursorDay: number;
  readonly nextBoundaryGameMinute: number | null;
}

export interface MobilityTrip {
  readonly tripId: MobilityTripId;
  readonly citizenId: string;
  readonly purpose: MobilityTripPurpose;
  readonly originBuildingId: string;
  readonly destinationBuildingId: string;
  readonly mode: MobilityTripMode;
  readonly departureGameMinute: number;
  readonly status: MobilityTripStatus;
  readonly failureReason: MobilityTripFailureReason | null;
}
```

- [ ] **Step 1: Write RED tests**

Test invalid negative times, duplicate trip IDs, `Travel` without `activeTripId`, non-Travel with active trip, and active trip referencing a different Citizen.

```ts
expect(() => validateCitizenMobilityState({
  citizenId: 'citizen-1',
  currentActivity: 'Travel',
  stationaryBuildingId: null,
  activeTripId: null,
  scheduleCursorDay: 1,
  nextBoundaryGameMinute: 500,
})).toThrow('mobility:travel-without-active-trip');
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test -- contracts
```

Expected: missing contracts/validators.

- [ ] **Step 3: Implement contracts + `MobilityContractError`**

Use explicit safe-integer checks and stable string-ID checks. Do not import RCI ID types; `apps/game` will pass the same string identity across the seam.

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test -- contracts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/citizen-mobility-core/src packages/citizen-mobility-core/test/contracts.test.ts
git commit -m "feat(mobility): define core activity and trip contracts"
```

## Task 3: Add immutable MobilitySnapshotV1 and deterministic fingerprint

**Files:**
- Create: `packages/citizen-mobility-core/src/mobility-snapshot.ts`
- Create: `packages/citizen-mobility-core/src/mobility-fingerprint.ts`
- Modify: `packages/citizen-mobility-core/src/index.ts`
- Test: `packages/citizen-mobility-core/test/mobility-snapshot.test.ts`

**Produces:**

```ts
export interface MobilitySnapshotV1 {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly policyVersion: 1;
  readonly scheduleSeedVersion: 1;
  readonly nextTripSequence: number;
  readonly citizenStates: readonly CitizenMobilityState[];
  readonly trips: readonly MobilityTrip[];
}

export function createMobilitySnapshot(input: MobilitySnapshotV1): MobilitySnapshotV1;
export function createEmptyMobilitySnapshot(): MobilitySnapshotV1;
export function fingerprintMobilitySnapshot(snapshot: MobilitySnapshotV1): string;
```

- [ ] **Step 1: Write RED snapshot invariants**

Cover sorted canonical Citizen/trip output, duplicate Citizen state rejection, duplicate trip rejection, invalid next sequence, active-trip referential integrity, and immutable cloned arrays.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test -- mobility-snapshot
```

Expected: snapshot API missing.

- [ ] **Step 3: Implement canonical clone/validation**

Canonical order:

```text
citizenStates: citizenId ascending
trips: tripId ascending
```

`fingerprintMobilitySnapshot` must serialize the validated canonical structure, not object insertion order.

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test -- mobility-snapshot
```

- [ ] **Step 5: Commit**

```bash
git add packages/citizen-mobility-core
git commit -m "feat(mobility): add immutable snapshot authority"
```

## Task 4: Add MobilitySaveV1 codec

**Files:**
- Create: `packages/citizen-mobility-core/src/persistence.ts`
- Modify: `packages/citizen-mobility-core/src/index.ts`
- Test: `packages/citizen-mobility-core/test/persistence.test.ts`

**Produces:**

```ts
export interface MobilitySaveV1 {
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly policyVersion: 1;
  readonly scheduleSeedVersion: 1;
  readonly nextTripSequence: number;
  readonly citizenStates: readonly CitizenMobilityState[];
  readonly trips: readonly MobilityTrip[];
}

export function encodeMobilitySaveV1(snapshot: MobilitySnapshotV1): MobilitySaveV1;
export function decodeMobilitySaveV1(input: unknown):
  | Readonly<{ ok: true; value: MobilitySnapshotV1 }>
  | Readonly<{ ok: false; error: Readonly<{ code: 'mobility-save:invalid' }> }>;
```

- [ ] **Step 1: Write RED codec tests**

Round-trip exact fingerprint; reject unknown schema; reject duplicate IDs; reject unsafe integers; reject Travel state whose active trip is absent.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test -- persistence
```

- [ ] **Step 3: Implement fail-closed decoder**

Do not coerce strings/numbers. Decode into plain validated input and pass through `createMobilitySnapshot`.

- [ ] **Step 4: Run GREEN + full PR1 package gate**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/citizen-mobility-core typecheck
pnpm check
```

Expected: PASS.

- [ ] **Step 5: Update docs and PR1 body**

Update `docs/systems/citizen-mobility/README.md` from planned package names to exact source links, but keep milestone status Partial until PR2/PR6 close behavior/integration.

- [ ] **Step 6: Commit final PR1 docs**

```bash
git add docs/systems/citizen-mobility packages/citizen-mobility-core
git commit -m "docs(mobility): record core contract implementation"
```

---

# PR2 — Schedule, Commute Trip Generation, Mode Choice, Lifecycle Reconciliation

**Branch:** `feat/citizen-mobility-commute-v0-1`

## Task 5: Freeze deterministic schedule policy and daily boundary generation

**Files:**
- Create: `packages/citizen-mobility-core/src/schedule-policy.ts`
- Create: `packages/citizen-mobility-core/src/schedule-index.ts`
- Modify: `packages/citizen-mobility-core/src/index.ts`
- Test: `packages/citizen-mobility-core/test/schedule-policy.test.ts`
- Test: `packages/citizen-mobility-core/test/schedule-scale.test.ts`

**Produces:**

```ts
export interface FoundationMobilitySchedulePolicyV1 {
  readonly version: 1;
  readonly workStartEarliestMinuteOfDay: 420; // 07:00
  readonly workStartLatestMinuteOfDay: 540;   // 09:00
  readonly workDurationMinutes: 540;          // 9h
}

export interface PresentCitizenMobilityProjection {
  readonly citizenId: string;
  readonly homeBuildingId: string | null;
  readonly workBuildingId: string | null;
  readonly present: boolean;
}

export interface DueMobilityBoundary {
  readonly citizenId: string;
  readonly atGameMinute: number;
  readonly nextActivity: 'Work' | 'Home';
}

export function deriveCitizenScheduleForDay(...): readonly DueMobilityBoundary[];
export function collectDueMobilityBoundaries(...): readonly DueMobilityBoundary[];
```

- [ ] **Step 1: Write semantic RED tests**

Required assertions:

```ts
expect(workStart).toBeGreaterThanOrEqual(dayStart + 420);
expect(workStart).toBeLessThanOrEqual(dayStart + 540);
expect(returnHome).toBe(workStart + 540);
```

Same Citizen/day/policy gives identical boundaries; different Citizen IDs create a distributed deterministic set; input order permutations produce identical canonical output.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test -- schedule
```

- [ ] **Step 3: Implement stable hash + due-event index**

Use a package-owned deterministic integer hash over `(citizenId, dayIndex, policyVersion, scheduleSeedVersion)`; never use runtime randomness. `collectDueMobilityBoundaries` returns order:

```text
atGameMinute → nextActivity priority Work before Home → citizenId
```

- [ ] **Step 4: Add 20k scale correctness fixture**

Create 20,000 deterministic projections, derive one day twice, and assert equal fingerprints/counts. This is a correctness/scale-count gate, not a flaky wall-clock threshold.

- [ ] **Step 5: Run GREEN**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test -- schedule
```

- [ ] **Step 6: Commit**

```bash
git add packages/citizen-mobility-core
git commit -m "feat(mobility): add deterministic commute schedules"
```

## Task 6: Plan Home ↔ Work trip requests without Traffic imports

**Files:**
- Create: `packages/citizen-mobility-core/src/mobility-planner.ts`
- Modify: `packages/citizen-mobility-core/src/index.ts`
- Test: `packages/citizen-mobility-core/test/mobility-planner.test.ts`

**Produces:**

```ts
export interface MobilityTripPlanningRequest {
  readonly tripId: string;
  readonly citizenId: string;
  readonly purpose: 'CommuteToWork' | 'CommuteHome';
  readonly originBuildingId: string;
  readonly destinationBuildingId: string;
  readonly departureGameMinute: number;
}

export interface MobilityPlanResult {
  readonly baseRevision: number;
  readonly proposedSnapshot: MobilitySnapshotV1;
  readonly planningRequests: readonly MobilityTripPlanningRequest[];
  readonly skipped: readonly Readonly<{
    citizenId: string;
    reason: 'OriginUnavailable' | 'DestinationUnavailable';
  }>[];
}

export function planMobilityBoundaries(...): MobilityPlanResult;
```

- [ ] **Step 1: RED tests**

Cover:
- Home→Work request uses latest Home/Work projection.
- Work→Home request reverses endpoints.
- missing Home/Work creates typed skip and does not invent a Building.
- same due boundary cannot create a duplicate active trip.
- tentative trip ID is deterministic from `nextTripSequence` and is consumed only by committed snapshot.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test -- mobility-planner
```

- [ ] **Step 3: Implement planner**

Keep a planned trip in `Planned` until caller supplies mode candidate(s). Do not store Traffic route/progress in Mobility.

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test -- mobility-planner
```

- [ ] **Step 5: Commit**

```bash
git add packages/citizen-mobility-core
git commit -m "feat(mobility): plan real home work commute trips"
```

## Task 7: Add deterministic mode-choice commit seam

**Files:**
- Create: `packages/citizen-mobility-core/src/mode-choice.ts`
- Modify: `packages/citizen-mobility-core/src/mobility-planner.ts`
- Modify: `packages/citizen-mobility-core/src/index.ts`
- Test: `packages/citizen-mobility-core/test/mode-choice.test.ts`

**Produces:**

```ts
export interface MobilityModeCandidate {
  readonly mode: 'Walk' | 'Drive';
  readonly available: boolean;
  readonly generalizedCostSeconds: number | null;
}

export function chooseMobilityMode(
  candidates: readonly MobilityModeCandidate[],
): 'Walk' | 'Drive' | null;

export function commitPlannedMobilityTrip(...): MobilitySnapshotV1;
```

- [ ] **Step 1: RED tests**

```ts
expect(chooseMobilityMode([
  { mode: 'Walk', available: true, generalizedCostSeconds: 600 },
  { mode: 'Drive', available: true, generalizedCostSeconds: 600 },
])).toBe('Walk');
```

Also cover cheapest valid candidate, unavailable candidate ignored, unsafe/negative cost rejected, no candidate → null/failed `Unreachable`.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test -- mode-choice
```

- [ ] **Step 3: Implement minimal deterministic chooser**

Tie order: generalized cost then `Walk` before `Drive`.

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test -- mode-choice
```

- [ ] **Step 5: Commit**

```bash
git add packages/citizen-mobility-core
git commit -m "feat(mobility): add deterministic walk drive mode choice"
```

## Task 8: Reconcile Citizen/Home/Employment lifecycle changes

**Files:**
- Create: `packages/citizen-mobility-core/src/mobility-reconciler.ts`
- Modify: `packages/citizen-mobility-core/src/index.ts`
- Test: `packages/citizen-mobility-core/test/mobility-reconciler.test.ts`

**Produces:**

```ts
export interface MobilityReconciliationResult {
  readonly snapshot: MobilitySnapshotV1;
  readonly cancelledTripIds: readonly string[];
  readonly destinationRevalidationTripIds: readonly string[];
}

export function reconcileMobilityCitizens(...): MobilityReconciliationResult;
```

- [ ] **Step 1: RED lifecycle tests**

Cover:
- newly present Citizen gets stationary state without fake historical trip;
- death/emigration removes active state and returns active trip for Traffic cancellation;
- changed Home affects next Home activity destination;
- changed job affects next Work activity destination;
- active trip whose latest authoritative destination changed is marked for destination revalidation;
- job loss prevents future Work departure but does not mutate Employment itself.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test -- mobility-reconciler
```

- [ ] **Step 3: Implement reconciliation**

Mobility never decides route recovery. It only returns trip IDs requiring downstream Traffic revalidation against the latest requested destination.

- [ ] **Step 4: Run GREEN + PR2 package gate**

```bash
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/citizen-mobility-core typecheck
pnpm check
```

Expected: PASS.

- [ ] **Step 5: Update README and PR evidence**

Document exact implemented policy/version, package exports, and measured 20k fixture counts. Do not claim world integration/visual behavior until PR6+.

- [ ] **Step 6: Commit**

```bash
git add packages/citizen-mobility-core docs/systems/citizen-mobility
git commit -m "docs(mobility): record commute foundation verification"
```

---

## PR1/PR2 Handoff to Traffic / World Plans

After PR2 merge, the following are frozen consumer contracts:

```ts
MobilitySnapshotV1
MobilityTripPlanningRequest
MobilityModeCandidate
chooseMobilityMode(...)
planMobilityBoundaries(...)
commitPlannedMobilityTrip(...)
reconcileMobilityCitizens(...)
encodeMobilitySaveV1(...)
decodeMobilitySaveV1(...)
```

Traffic must not import these types directly. `apps/game` owns adapters whose field names are intentionally aligned to reduce translation mistakes.

## Related Plans

- Execution index: `../../architecture-infrastructure/tdd/2026-08-15-citizen-mobility-traffic-foundation-v0-1-execution-index.md`
- Traffic: `../../traffic/tdd/2026-08-15-traffic-foundation-v0-1.md`
- World integration: `../../world/tdd/2026-08-15-mobility-traffic-world-integration-v0-1.md`
