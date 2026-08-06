# RCI PR 4 — Workplaces and Employment Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Begin only after PR 3 is merged to `master`.

**Goal:** Add versioned Commercial/Industrial Workplace capacity profiles, deterministic Workplace inventory, position groups and requirement eligibility, normalized Employment Assignment history, end-of-tick invalidations, stability-first best-fit matching, and controlled underemployment upgrades.

**Architecture:** Building definitions continue exposing capacity-profile IDs only. `rci-core` resolves those profiles into Workplace inventory and indexed vacancies. Employment reconciliation preserves every valid assignment, fills unemployed Citizens through deterministic best-fit matching, then performs one bounded improvement pass without displacing workers or reducing total employment.

**Tech Stack:** TypeScript, Vitest, Building/Simulation contracts, `rci-core` snapshots and deterministic helpers from PRs 1–3.

## Global Constraints

- Commercial and Industrial Buildings expose no Workplace while under construction.
- Workplace ID is `workplace:<buildingInstanceId>`.
- A resident WorkingAge Citizen has at most one active Employment Assignment.
- A Workplace position group cannot exceed configured capacity.
- Requirement definitions decide eligibility; matching code does not hard-code qualification IDs.
- Existing valid assignments are stable and never moved merely to improve a global score.
- Exact/best requirement matches are filled before legal lower-suitability matches.
- Insufficient qualification never fills a higher requirement.
- Controlled upgrade uses only vacant strictly better positions, displaces nobody, preserves employment count, and moves a Citizen at most once per reconciliation.
- All assignment starts/ends are historical immutable records.
- Matching must avoid unbounded Citizen × Workplace nested scans; index eligible Citizens and vacant position slots.

---

## Task 1: Add Workplace capacity profiles and requirement definitions

**Files:**
- Create: `packages/rci-core/src/employment/workplace-profile.ts`
- Create: `packages/rci-core/src/employment/requirement-policy.ts`
- Create: `packages/rci-core/test/workplace-profile.test.ts`
- Create: `packages/rci-core/test/requirement-policy.test.ts`
- Modify: `packages/rci-core/src/definitions/foundation-definitions.ts`

**Interfaces:**
- Produces:

```ts
export interface PositionGroupCapacityDefinition {
  readonly positionGroupDefinitionId: string;
  readonly capacity: number;
  readonly employmentRequirementDefinitionId: string;
  readonly occupationDefinitionId: string | null;
}

export interface WorkplaceCapacityProfileDefinition {
  readonly id: string;
  readonly kind: 'commercial' | 'industrial';
  readonly positionGroups: readonly PositionGroupCapacityDefinition[];
}

export interface EmploymentRequirementPolicy {
  evaluate(input: Readonly<{
    qualificationDefinitionIds: readonly string[];
    requirementDefinitionId: string;
    registries: RciDefinitionRegistries;
  }>): Readonly<{
    eligible: boolean;
    qualificationDistance: number;
  }>;
}
```

Approved capacities:

```text
commercial.shop.v1:       entry 3, skilled 1, professional 0
commercial.cafe.v1:       entry 4, skilled 2, professional 0
commercial.market.v1:     entry 7, skilled 4, professional 1
commercial.office.v1:     entry 4, skilled 8, professional 12
industrial.depot.v1:      entry 4, skilled 1, professional 0
industrial.workshop.v1:   entry 6, skilled 3, professional 1
industrial.warehouse.v1:  entry 12, skilled 5, professional 1
industrial.factory.v1:    entry 16, skilled 10, professional 4
```

- [ ] **Step 1: Write failing profile tests**

Assert exact totals, stable group ordering, no zero/negative/non-safe capacity, no duplicate group ID, valid requirement references, optional occupation references, and immutable arrays.

- [ ] **Step 2: Write failing eligibility tests**

Cover exact qualification, higher-ranked Citizen legally filling lower requirement, lower-ranked Citizen rejected, multiple future qualifications choosing minimum distance, missing definitions, and no literal-ID branching.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- workplace-profile.test.ts requirement-policy.test.ts
```

- [ ] **Step 4: Implement rank-based foundation policy**

Foundation requirements reference minimum qualification rank. Return distance `citizenRank - requiredRank` for eligible Citizens. The policy interface remains replaceable for future degrees/licenses without changing Assignment records.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- workplace-profile.test.ts requirement-policy.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add workplace capacity and requirements"
```

---

## Task 2: Synchronize Workplace inventory from Building lifecycle

**Files:**
- Create: `packages/rci-core/src/employment/workplace-inventory.ts`
- Create: `packages/rci-core/test/workplace-inventory.test.ts`
- Modify: `packages/rci-core/src/rci-tick.ts`
- Modify: `packages/rci-core/src/validation/cross-domain-validation.ts`

**Interfaces:**
- Produces:

```ts
export function synchronizeWorkplaceInventory(input: Readonly<{
  snapshot: RciSnapshot;
  buildingsBefore: BuildingSnapshot;
  buildingsAfter: BuildingSnapshot;
  registries: RciDefinitionRegistries;
  evaluationTick: number;
}>): Readonly<{
  proposedSnapshot: RciSnapshot;
  activatedWorkplaceIds: readonly WorkplaceId[];
  retiredWorkplaceIds: readonly WorkplaceId[];
  endedEmploymentAssignmentIds: readonly EmploymentAssignmentId[];
  invalidations: readonly EmploymentInvalidation[];
}>;
```

- [ ] **Step 1: Write failing inventory tests**

Cover active Commercial/Industrial activation, no Workplace for Residential/construction, idempotency, stable canonical ID, retirement after bulldoze, end reason `employment-ended.workplace-retired`, and Building-array permutation equality.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- workplace-inventory.test.ts
```

- [ ] **Step 3: Implement indexed before/after comparison**

Reuse the stable Building indexing approach from Dwelling synchronization. Do not scan all Employment Assignments separately per retired Workplace; pre-index active assignments by Workplace ID.

- [ ] **Step 4: Extend validation**

Reject active Assignment references to unknown/retired Workplace, unknown group/profile/requirement, or capacity overflow.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- workplace-inventory.test.ts rci-validation.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): synchronize workplace inventory"
```

---

## Task 3: Add Employment indexes, vacancies, and invalidation ordering

**Files:**
- Create: `packages/rci-core/src/employment/employment-index.ts`
- Create: `packages/rci-core/src/employment/employment-invalidation.ts`
- Create: `packages/rci-core/test/employment-index.test.ts`
- Create: `packages/rci-core/test/employment-invalidation.test.ts`
- Modify: `packages/rci-core/src/events/rci-domain-event.ts`
- Modify: `packages/rci-core/src/events/event-ordering.ts`

**Interfaces:**
- Produces:

```ts
export type EmploymentInvalidationReason =
  | 'citizen-immigrated'
  | 'citizen-reached-working-age'
  | 'citizen-deceased'
  | 'citizen-emigrated'
  | 'qualification-changed'
  | 'workplace-activated'
  | 'workplace-retired'
  | 'assignment-invalid';

export interface EmploymentInvalidation {
  readonly reason: EmploymentInvalidationReason;
  readonly citizenId: CitizenId | null;
  readonly workplaceId: WorkplaceId | null;
  readonly sequence: number;
}

export type ReconciliationScope =
  | Readonly<{ kind: 'all' }>
  | Readonly<{
      kind: 'affected';
      citizenIds: readonly CitizenId[];
      workplaceIds: readonly WorkplaceId[];
    }>;
```

- [ ] **Step 1: Write failing index tests**

Cover current Assignment by Citizen, Assignment lists by Workplace/group, vacancy counts, eligible unemployed workforce, unemployment duration derivation from historical Assignments, underemployment detection, and capacity consistency.

- [ ] **Step 2: Write failing invalidation tests**

Append duplicate/reordered events and assert canonical dedupe by reason/Citizen/Workplace with stable sequence resolution. Verify lifecycle/migration events from PRs 2–3 produce the expected Employment invalidations.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- employment-index.test.ts employment-invalidation.test.ts
```

- [ ] **Step 4: Implement disposable indexes**

Precompute position slots by requirement rank and stable slot key:

```text
<positionGroupDefinitionId>|<workplaceId>|<slotIndex>
```

Slots are runtime-only and never serialized.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- employment-index.test.ts employment-invalidation.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add employment indexes and invalidations"
```

---

## Task 4: Implement stability-first unemployment matching

**Files:**
- Create: `packages/rci-core/src/employment/employment-matching.ts`
- Create: `packages/rci-core/test/employment-matching.test.ts`

**Interfaces:**
- Produces:

```ts
export interface EmploymentReconciliationPlan {
  readonly baseRciRevision: number;
  readonly scope: ReconciliationScope;
  readonly preservedAssignmentIds: readonly EmploymentAssignmentId[];
  readonly endedAssignmentIds: readonly EmploymentAssignmentId[];
  readonly startedAssignments: readonly EmploymentAssignmentRecord[];
  readonly upgradedCitizenIds: readonly CitizenId[];
  readonly proposedSnapshot: RciSnapshot;
  readonly valid: boolean;
  readonly invalidReason: RciInvalidReason | null;
}

export function planEmploymentReconciliation(input: Readonly<{
  snapshot: RciSnapshot;
  evaluationTick: number;
  scope: ReconciliationScope;
  registries: RciDefinitionRegistries;
  requirementPolicy: EmploymentRequirementPolicy;
}>): EmploymentReconciliationPlan;
```

- [ ] **Step 1: Write failing preservation tests**

A valid existing Assignment remains even when another unemployed Citizen would be a closer fit. Invalid Assignments end before filling vacancies.

- [ ] **Step 2: Write failing matching-order tests**

Cover exact match before legal down-ranking, insufficient qualification rejection, minimum qualification distance, stable position-group/workplace/Citizen tie breaks, max employment after stability constraints, and capacity limits.

- [ ] **Step 3: Write permutation tests**

Permute Citizens, qualifications, Workplaces, groups, Assignments, and invalidations; assert identical proposed Save JSON and receipt.

- [ ] **Step 4: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- employment-matching.test.ts
```

- [ ] **Step 5: Implement indexed greedy lexicographic matching**

Algorithm:

```text
1. Validate and preserve active Assignments.
2. Build sorted vacant slot buckets by requirement rank/group/workplace/slot.
3. Sort eligible unemployed Citizens by stable Citizen ID.
4. For each Citizen, rank eligible slots by qualification distance, group ID, Workplace ID, slot index.
5. Assign the best remaining slot.
6. Append one immutable Assignment record and increment sequence only after validation.
```

The result must satisfy the locked lexicographic rules; do not introduce a general optimization library.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- employment-matching.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add stability-first employment matching"
```

---

## Task 5: Implement controlled best-fit upgrade pass

**Files:**
- Create: `packages/rci-core/src/employment/employment-upgrade.ts`
- Create: `packages/rci-core/test/employment-upgrade.test.ts`
- Modify: `packages/rci-core/src/employment/employment-matching.ts`

**Interfaces:**
- Produces:

```ts
export function planControlledEmploymentUpgrades(input: Readonly<{
  snapshotAfterUnemploymentMatching: RciSnapshot;
  evaluationTick: number;
  registries: RciDefinitionRegistries;
  requirementPolicy: EmploymentRequirementPolicy;
}>): Readonly<{
  proposedSnapshot: RciSnapshot;
  movedCitizenIds: readonly CitizenId[];
  endedAssignmentIds: readonly EmploymentAssignmentId[];
  startedAssignments: readonly EmploymentAssignmentRecord[];
}>;
```

- [ ] **Step 1: Write failing upgrade tests**

Cover underemployed Citizen moving to a vacant exact/better slot, no move to equal/worse slot, no displacement, total employment unchanged, one move maximum per Citizen, stable tie break, old end reason `employment-ended.best-fit-upgrade`, and atomic old-end/new-start history.

- [ ] **Step 2: Write churn-prevention test**

Run reconciliation repeatedly without world changes and assert no additional Assignment history is created after the first stable result.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- employment-upgrade.test.ts
```

- [ ] **Step 4: Implement strict improvement metric**

A slot is strictly better when qualification distance is lower than the current Assignment's requirement distance. Rank candidate upgrades by improvement descending, then group ID, Workplace ID, Citizen ID. Reserve slots as moves are planned.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- employment-upgrade.test.ts employment-matching.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add controlled employment upgrades"
```

---

## Task 6: Integrate one Employment reconciliation into the RCI tick

**Files:**
- Modify: `packages/rci-core/src/rci-tick.ts`
- Create: `packages/rci-core/test/rci-tick-employment.test.ts`
- Modify: `packages/rci-core/src/migration/request-policy.ts`
- Modify: `packages/rci-core/src/migration/emigration-pressure.ts`

**Interfaces:**
- RCI tick order becomes:

```text
inventory synchronization
population/lifecycle/migration mutations
housing reconciliation/materialization
Employment invalidation dedupe
one Employment reconciliation
employment-aware pressure/request projection
validation
```

- [ ] **Step 1: Write failing same-tick integration tests**

Cover immigrant materialized into housing and employed in the same tick, Citizen reaching 18 receiving qualification then employment, death/emigration ending Assignment, Workplace activation creating same-tick jobs, Workplace retirement ending Assignments and rematching eligible workers elsewhere.

- [ ] **Step 2: Assert exactly one reconciliation**

Use an injectable matching policy spy or receipt counter. Multiple invalidations in one tick must dedupe into one reconciliation call.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- rci-tick-employment.test.ts
```

- [ ] **Step 4: Feed Employment projections into migration policies**

Incoming-request policy receives suitable vacancy count up to the approved +650 milli-household contribution. Add Employment pressure factors:

```text
emigration.employment.unemployed-members
emigration.employment.unemployment-duration
emigration.employment.no-compatible-vacancies
emigration.employment.underemployment
```

All outputs use fixed-point integers and stable factor order.

- [ ] **Step 5: Run integration tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- rci-tick-employment.test.ts migration-request-policy.test.ts emigration-pressure.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): integrate employment reconciliation"
```

---

## Task 7: Complete migration inventory, persistence, docs, and PR 4 verification

**Files:**
- Modify: `apps/game/src/world-save-rci-migration.test.ts`
- Modify: RCI migration helper in `packages/rci-core/src/persistence/`
- Modify: `packages/rci-core/test/serialization-v1.test.ts`
- Create: `packages/rci-core/test/employment-determinism.test.ts`
- Modify: `docs/systems/rci/README.md`
- Create: `docs/systems/rci/verification/pr4-workplaces-employment.md`

- [ ] **Step 1: Add V1–V4 Workplace migration tests**

Active Commercial/Industrial Buildings create canonical Workplaces with correct profile IDs; construction and Residential Buildings do not. Migration creates no Employment Assignments or Citizens.

- [ ] **Step 2: Add Save round-trip and continuous/resume tests**

Include Workplaces, ended/current Assignments, invalidation-derived stable state, unemployment duration, underemployment, and migration/emigration Employment factors.

- [ ] **Step 3: Add synthetic scale test without timing gate**

Build a deterministic fixture with thousands of Citizens and position slots. Instrument operation counts or index sizes to prove matching is not implemented as an unbounded nested Citizen-by-Workplace scan.

- [ ] **Step 4: Update living docs**

Mark Workplace inventory, Employment history, requirement policy, matching, controlled upgrades, and Employment-aware migration pressure implemented. Keep Demand/Growth policy, app atomic orchestration, HUD, and browser acceptance unimplemented.

- [ ] **Step 5: Run PR verification**

```bash
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/game test -- world-save-rci-migration.test.ts
pnpm format:check
pnpm lint
pnpm typecheck
pnpm provenance:check
pnpm test
pnpm test:deployment
pnpm build
```

- [ ] **Step 6: Record evidence and commit**

```bash
git add apps/game packages/rci-core docs
git commit -m "docs(rci): record employment verification"
```

## PR 4 Acceptance Gate

- Active Commercial/Industrial Buildings produce deterministic Workplace capacity.
- Requirement eligibility is registry-driven and extensible.
- Existing valid Assignments are preserved.
- Unemployed matching follows exact/best fit, qualification distance, capacity, and stable ties.
- Controlled upgrades are strict, vacancy-only, non-displacing, and churn-free.
- All lifecycle, migration, housing, and Building invalidations reconcile Employment once per tick.
- Employment history round-trips canonically and continuous execution equals save/load/resume.
- Prior-save migration creates Workplaces without inventing workers.
- No circular package dependency or business logic enters the app/UI layer.