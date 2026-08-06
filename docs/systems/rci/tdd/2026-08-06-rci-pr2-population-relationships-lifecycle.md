# RCI PR 2 — Population, Relationships, Households, and Daily Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Begin only after PR 1 is merged to `master`.

**Goal:** Implement deterministic citizen presence, normalized Household membership, first-class parent/partner relationships, qualification history, age-band boundaries, counter-based sampling, and the daily 08:00 aging/birth/death lifecycle.

**Architecture:** Population mutations are planned as immutable domain events and applied inside `planRciTick`; committed state remains normalized history. Age and current memberships/relationships/qualifications are derived through pure indexes. Daily sampling is counter-based and namespaced so input reordering or adding an unrelated subsystem cannot perturb outcomes.

**Tech Stack:** TypeScript, Vitest, `rci-core` contracts from PR 1, Simulation tick/calendar contracts, immutable arrays and stable indexes.

## Global Constraints

- Daily lifecycle evaluates at 08:00. The initial Year 1 / Month 1 / Day 1 / 08:00 snapshot does not immediately run lifecycle; the next 08:00 boundary does.
- `ticksPerYear = 8_640` and `ticksPerDay = 24`.
- Age derives from `absoluteTick - bornAtTick`; immigrant `bornAtTick` may be negative.
- Parent edges are directional and permanent. Partner edges are canonical undirected, temporal, and max one active partner per Citizen.
- A resident Citizen has exactly one active Household membership. Historical Citizens have none.
- PR 2 creates no Dwelling, Workplace, housing assignment, employment assignment, migration queue decision, demand, or UI behavior.
- Birth may create an unhoused/over-capacity Household state only once PR 3 integrates housing; PR 2 exposes population events without inventing housing authority.
- No lifecycle test depends on probabilistic luck; use fixture profiles with integer hazard 0 or full scale.

---

## Task 1: Add age, calendar-boundary, and current-state projections

**Files:**
- Create: `packages/rci-core/src/population/age.ts`
- Create: `packages/rci-core/src/projection/population-index.ts`
- Create: `packages/rci-core/src/projection/household-index.ts`
- Create: `packages/rci-core/src/projection/relationship-index.ts`
- Create: `packages/rci-core/test/age.test.ts`
- Create: `packages/rci-core/test/population-index.test.ts`
- Modify: `packages/rci-core/src/index.ts`

**Interfaces:**
- Produces:

```ts
export const RCI_TICKS_PER_DAY = 24;
export const RCI_DAYS_PER_YEAR = 360;
export const RCI_TICKS_PER_YEAR = 8_640;

export type AgeBandDefinitionId =
  | 'age-band.early-childhood'
  | 'age-band.school-age'
  | 'age-band.working-age'
  | 'age-band.senior';

export function ageYearsAtTick(bornAtTick: number, absoluteTick: number): number;
export function ageBandAtTick(bornAtTick: number, absoluteTick: number): AgeBandDefinitionId;
export function isDailyLifecycleTick(beforeTick: number, afterTick: number): boolean;
```

- Produces disposable indexes:

```ts
export interface RciCurrentStateIndex {
  readonly activeMembershipByCitizenId: ReadonlyMap<CitizenId, HouseholdMembershipRecord>;
  readonly activeMemberIdsByHouseholdId: ReadonlyMap<HouseholdId, readonly CitizenId[]>;
  readonly activePartnerByCitizenId: ReadonlyMap<CitizenId, UndirectedRelationshipRecord>;
  readonly activeQualificationIdsByCitizenId: ReadonlyMap<CitizenId, readonly string[]>;
}
```

- [ ] **Step 1: Write failing age-boundary tests**

Required assertions:

```ts
expect(ageYearsAtTick(-18 * 8_640, 0)).toBe(18);
expect(ageBandAtTick(0, 6 * 8_640 - 1)).toBe('age-band.early-childhood');
expect(ageBandAtTick(0, 6 * 8_640)).toBe('age-band.school-age');
expect(ageBandAtTick(0, 18 * 8_640)).toBe('age-band.working-age');
expect(ageBandAtTick(0, 65 * 8_640)).toBe('age-band.senior');
```

Test lifecycle tick detection around 07:00→08:00, 08:00→09:00, 23:00→00:00, and the initial snapshot rule.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- age.test.ts population-index.test.ts
```

- [ ] **Step 3: Implement safe-integer age arithmetic**

Reject future births, unsafe subtraction, and negative derived age with `RciContractError('rci:invalid-state')`. Use integer division only.

- [ ] **Step 4: Build current-state indexes with duplicate detection**

Indexes sort source arrays first and throw typed validation errors for overlapping active memberships, duplicate active partner edges, and duplicate active qualification IDs. Returned arrays and maps are read-only facades; they are never serialized.

- [ ] **Step 5: Run focused tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- age.test.ts population-index.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add age and current-state projections"
```

---

## Task 2: Add deterministic counter-based sampling and hazard compilation

**Files:**
- Create: `packages/rci-core/src/population/deterministic-sample.ts`
- Create: `packages/rci-core/src/population/hazard.ts`
- Create: `packages/rci-core/test/deterministic-sample.test.ts`
- Create: `packages/rci-core/test/hazard.test.ts`

**Interfaces:**
- Produces:

```ts
export type ProbabilityUnit = number; // 0..1_000_000_000
export const PROBABILITY_SCALE = 1_000_000_000;

export function deterministicSample(input: Readonly<{
  seed: number;
  eventType: string;
  evaluationTick: number;
  entityStableId: string;
  attemptIndex: number;
}>): ProbabilityUnit;

export function compileAnnualRateToDailyHazard(annualRateMilli: number): ProbabilityUnit;
export function sampleSucceeds(sample: ProbabilityUnit, hazard: ProbabilityUnit): boolean;
```

- [ ] **Step 1: Write golden deterministic-sample tests**

Freeze at least ten exact outputs covering ASCII/UTF-8 IDs, negative birth-derived entity context, attempt indexes, and separate event namespaces. Also assert permutation independence by sampling a sorted and reversed Citizen list.

- [ ] **Step 2: Write hazard golden tests**

Cover annual rates 0, 1_000_000 milli-percent equivalent used by the authored format, representative fertility/mortality rates, monotonicity, and runtime integer bounds.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- deterministic-sample.test.ts hazard.test.ts
```

- [ ] **Step 4: Implement one documented hash algorithm**

Use a small fixed 32-bit or 64-bit integer hash implemented in pure TypeScript with canonical UTF-8 bytes via a framework-free encoder. Document algorithm name/version in source. Do not call object hash, JSON property iteration, `Math.random()`, or mutable PRNG state.

- [ ] **Step 5: Centralize annual-to-daily conversion**

Authored rates may be converted at registry construction using floating arithmetic once, rounded to `ProbabilityUnit`, then runtime simulation uses integer comparisons only. Golden tests lock the conversion.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- deterministic-sample.test.ts hazard.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add deterministic lifecycle sampling"
```

---

## Task 3: Implement Relationship and Household mutation planners

**Files:**
- Create: `packages/rci-core/src/relationships/relationship-plan.ts`
- Create: `packages/rci-core/src/households/membership-plan.ts`
- Create: `packages/rci-core/src/households/household-plan.ts`
- Create: `packages/rci-core/test/relationship-plan.test.ts`
- Create: `packages/rci-core/test/membership-plan.test.ts`

**Interfaces:**
- Produces pure operation plans:

```ts
export function planCreateDirectionalRelationship(input: Readonly<{
  snapshot: RciSnapshot;
  typeDefinitionId: string;
  sourceCitizenId: CitizenId;
  targetCitizenId: CitizenId;
  startedAtTick: number;
}>): RciRecordMutationPlan;

export function planCreatePartnerRelationship(input: Readonly<{
  snapshot: RciSnapshot;
  firstCitizenId: CitizenId;
  secondCitizenId: CitizenId;
  startedAtTick: number;
}>): RciRecordMutationPlan;

export function planEndPartnerRelationship(input: Readonly<{
  snapshot: RciSnapshot;
  citizenId: CitizenId;
  endedAtTick: number;
}>): RciRecordMutationPlan;

export function planStartHouseholdMembership(input: Readonly<{
  snapshot: RciSnapshot;
  householdId: HouseholdId;
  citizenId: CitizenId;
  startedAtTick: number;
}>): RciRecordMutationPlan;
```

`RciRecordMutationPlan` carries base revision, proposed bounded arrays, next sequences, validity, and structured invalid reason. It does not commit directly; `rci-tick.ts` composes these changes.

- [ ] **Step 1: Write failing relationship tests**

Cover canonical pair ordering, self-reference rejection, duplicate active partner rejection across both participant directions, historical partner retention, permanent parent edges, max one mother/father, parent older than child, dangling Citizen rejection, and no sequence consumption on invalid plans.

- [ ] **Step 2: Write failing membership tests**

Cover exactly one active membership per resident, no active membership for historical Citizens, membership end history, household dissolution when final membership ends, no reopening dissolved Household IDs, and immutable inputs.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- relationship-plan.test.ts membership-plan.test.ts
```

- [ ] **Step 4: Implement minimal planners and stable record appends**

Allocate IDs only after all validation succeeds. Ended records retain their original ID and start tick. A new relationship/membership always receives a new monotonic ID.

- [ ] **Step 5: Add input-permutation tests**

Reverse relationship and membership history arrays before planning and assert identical plans and sequence results.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- relationship-plan.test.ts membership-plan.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add relationship and household planners"
```

---

## Task 4: Add qualification resolver and qualification-history planner

**Files:**
- Create: `packages/rci-core/src/population/qualification-resolver.ts`
- Create: `packages/rci-core/src/population/qualification-plan.ts`
- Create: `packages/rci-core/test/qualification-resolver.test.ts`
- Create: `packages/rci-core/test/qualification-plan.test.ts`
- Modify: `packages/rci-core/src/definitions/foundation-definitions.ts`

**Interfaces:**
- Produces:

```ts
export type QualificationResolverContext =
  | 'working-age-immigrant'
  | 'resident-reaching-working-age';

export interface QualificationResolver {
  resolve(input: Readonly<{
    citizenId: CitizenId;
    context: QualificationResolverContext;
    evaluationTick: number;
    deterministicSeed: number;
  }>): string;
}

export function createFoundationQualificationResolver(
  registries: RciDefinitionRegistries,
): QualificationResolver;
```

Foundation distributions:

```text
working-age immigrant: entry 55%, skilled 32%, professional 13%
resident reaching 18: entry 70%, skilled 25%, professional 5%
```

- [ ] **Step 1: Write failing distribution-boundary tests**

Test deterministic samples immediately below/at each integer cumulative threshold using an injectable sampler. Assert saved qualification records are not re-resolved after load.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- qualification-resolver.test.ts qualification-plan.test.ts
```

- [ ] **Step 3: Implement resolver behind interface**

The engine compares qualification IDs through registry rank metadata; no branch in planner code may compare literal `qualification.entry`, `qualification.skilled`, or `qualification.professional` except foundation content construction.

- [ ] **Step 4: Implement qualification history append/end rules**

PR 2 allows one active workforce-tier qualification for each resident WorkingAge Citizen. The schema remains capable of multiple future non-conflicting records.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- qualification-resolver.test.ts qualification-plan.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add qualification history resolver"
```

---

## Task 5: Define ordered lifecycle events and `planRciTick` foundation

**Files:**
- Create: `packages/rci-core/src/events/rci-domain-event.ts`
- Create: `packages/rci-core/src/events/event-ordering.ts`
- Create: `packages/rci-core/src/rci-tick.ts`
- Create: `packages/rci-core/test/event-ordering.test.ts`
- Create: `packages/rci-core/test/rci-tick-foundation.test.ts`
- Modify: `packages/rci-core/src/index.ts`

**Interfaces:**
- Produces:

```ts
export type RciDomainEvent =
  | CitizenReachedAgeBandEvent
  | CitizenBornEvent
  | CitizenDiedEvent
  | QualificationAwardedEvent
  | RelationshipEndedEvent
  | HouseholdDissolvedEvent;

export interface RciTickInput {
  readonly rci: RciSnapshot;
  readonly simulationBefore: SimulationSnapshot;
  readonly simulationAfter: SimulationSnapshot;
  readonly buildingsBefore: BuildingSnapshot;
  readonly buildingsAfter: BuildingSnapshot;
  readonly registries: RciDefinitionRegistries;
  readonly configuration: RciConfiguration;
}

export interface RciTickPlan {
  readonly baseRciRevision: number;
  readonly baseSimulationRevision: number;
  readonly baseBuildingRevision: number;
  readonly beforeAbsoluteTick: number;
  readonly afterAbsoluteTick: number;
  readonly proposedSnapshot: RciSnapshot;
  readonly emittedEvents: readonly RciDomainEvent[];
  readonly valid: boolean;
  readonly invalidReason: RciInvalidReason | null;
}

export function planRciTick(input: RciTickInput): RciTickPlan;
export function commitRciTick(input: RciTickCommitInput): Readonly<{
  snapshot: RciSnapshot;
  receipt: RciTickReceipt;
}>;
```

- [ ] **Step 1: Write failing event-ordering tests**

Order by `tick`, explicit event priority, entity kind, stable entity ID, then event sequence. Assert reversed input produces identical ordered output.

- [ ] **Step 2: Write failing plan/commit tests**

Cover no-op non-lifecycle tick, stale RCI/Simulation/Building revisions, after-tick mismatch, invalid registries, no mutation of inputs, and root revision increment only when RCI authority changes.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- event-ordering.test.ts rci-tick-foundation.test.ts
```

- [ ] **Step 4: Implement tick skeleton with daily hook**

At this task, `planRciTick` validates revisions, detects the daily boundary, gathers lifecycle events from later Task 6, applies them, validates the proposed snapshot, and returns an immutable plan. Housing/employment/demand phases remain absent rather than represented by no-op plugin APIs.

- [ ] **Step 5: Implement stale commit fences**

Commit checks exact base revisions and ticks, throws the approved typed errors, and returns the plan snapshot without recalculating lifecycle decisions.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- event-ordering.test.ts rci-tick-foundation.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add deterministic tick planning"
```

---

## Task 6: Implement daily age transitions, fertility, and mortality

**Files:**
- Create: `packages/rci-core/src/population/population-rate-profile.ts`
- Create: `packages/rci-core/src/population/daily-lifecycle.ts`
- Create: `packages/rci-core/test/daily-aging.test.ts`
- Create: `packages/rci-core/test/fertility.test.ts`
- Create: `packages/rci-core/test/mortality.test.ts`
- Modify: `packages/rci-core/src/definitions/foundation-definitions.ts`
- Modify: `packages/rci-core/src/rci-tick.ts`

**Interfaces:**
- Produces:

```ts
export function planDailyPopulationLifecycle(input: Readonly<{
  snapshot: RciSnapshot;
  evaluationTick: number;
  registries: RciDefinitionRegistries;
  configuration: RciConfiguration;
}>): Readonly<{
  proposedSnapshot: RciSnapshot;
  events: readonly RciDomainEvent[];
}>;
```

- [ ] **Step 1: Write deterministic aging tests**

Cover age 6, 18, and 65 boundaries; only age 18 mutates authority by awarding a qualification. Re-running from the same base produces the same result and cannot create duplicate qualifications.

- [ ] **Step 2: Write guaranteed fertility tests**

Use fixture rate profiles with full-scale daily hazard. Cover partnered mother with optional biological-father edge, mother without active partner, child joining mother's Household, deterministic child sex/ID, parent age validation, and no birth for ineligible profiles/ages.

- [ ] **Step 3: Write guaranteed mortality tests**

Cover resident→deceased transition, ending active membership and partner edge, preserving parent edges, dissolving final-member Household, no active qualification cleanup unless the definition policy requires ending it, stable event order, and historical graph validity.

- [ ] **Step 4: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- daily-aging.test.ts fertility.test.ts mortality.test.ts
```

- [ ] **Step 5: Implement foundation rate profiles**

Encode the approved synthetic fertility and mortality tables as versioned immutable definitions. Registry construction compiles authored annual rates to daily integer hazards.

- [ ] **Step 6: Implement lifecycle with staged event application**

Iterate resident Citizens in stable ID order. Allocate generated IDs only after event validity is known. Death is terminal. Birth creates Citizen, membership, mother edge, optional father edge, and sequence updates atomically.

- [ ] **Step 7: Run lifecycle and full package tests**

```bash
pnpm --filter @web-three-city/rci-core test -- daily-aging.test.ts fertility.test.ts mortality.test.ts
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/rci-core build
```

- [ ] **Step 8: Commit**

```bash
git add packages/rci-core
git commit -m "feat(rci): add daily population lifecycle"
```

---

## Task 7: Add persistence/determinism regression coverage and PR 2 handoff

**Files:**
- Modify: `packages/rci-core/test/serialization-v1.test.ts`
- Create: `packages/rci-core/test/lifecycle-determinism.test.ts`
- Modify: `docs/systems/rci/README.md`
- Create: `docs/systems/rci/verification/pr2-population-lifecycle.md`

- [ ] **Step 1: Extend Save fixtures with historical population records**

Round-trip residents, deceased/emigrated Citizen history, ended memberships, parent/partner edges, and qualification history. Assert canonical JSON remains equal after record-array permutations.

- [ ] **Step 2: Add continuous versus save/load/resume lifecycle test**

Run a fixture city across multiple daily boundaries continuously and with a save/load boundary before each daily evaluation. Assert equal snapshot, receipt, events, and Save JSON.

- [ ] **Step 3: Update living documentation**

Mark Citizens, Household membership, Relationship graph, qualifications, deterministic age/birth/death, and tick contracts as implemented. Keep housing, migration, employment, demand, game integration, and HUD explicitly unimplemented.

- [ ] **Step 4: Run PR verification**

```bash
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/rci-core typecheck
pnpm --filter @web-three-city/rci-core build
pnpm format:check
pnpm lint
pnpm typecheck
pnpm provenance:check
pnpm test
pnpm test:deployment
pnpm build
```

- [ ] **Step 5: Record evidence and commit**

```bash
git add docs packages/rci-core
git commit -m "docs(rci): record population lifecycle verification"
```

## PR 2 Acceptance Gate

- Citizen age and bands derive deterministically from ticks.
- Relationship and Household membership cardinality rules are enforced.
- Partner history is canonical undirected; parent edges are directional and permanent.
- Working-age qualification bootstrap is deterministic and persisted.
- Daily evaluation occurs only at the correct 08:00 boundary.
- Birth and death apply complete normalized history changes atomically.
- Counter-based sampling and hazard golden tests lock replay behavior.
- Continuous and save/load/resume lifecycle results are equivalent.
- No Housing, Employment, Demand, UI, or Building-growth behavior leaks into this PR.