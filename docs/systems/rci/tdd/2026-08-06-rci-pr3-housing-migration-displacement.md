# RCI PR 3 — Housing, Migration, Relocation, and Displacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Begin only after PR 2 is merged to `master`.

**Goal:** Add versioned residential capacity profiles, deterministic Dwelling Unit inventory, normalized housing-assignment history, incoming Household requests/materialization, best-fit relocation, displaced-queue expiry, household emigration, and housing-side emigration pressure.

**Architecture:** Building definitions expose only a versioned capacity-profile ID; `building-core` still owns Building lifecycle while `rci-core` owns inventory and occupancy. RCI compares before/after Building snapshots during tick planning, materializes canonical unit IDs, allocates housing using stable best-fit rules, and retains all ended assignments/retired units as history.

**Tech Stack:** TypeScript, Vitest, `building-core`, `simulation-core`, `rci-core` contracts and lifecycle from PRs 1–2, immutable plans and fixed-point values.

## Global Constraints

- Residential capacity is content metadata; occupancy never enters `building-core`.
- Capacity profile IDs are versioned and never silently redefined.
- Active construction exposes no Dwelling capacity.
- Unit IDs are `dwelling:<buildingInstanceId>:<unitIndex>` with zero-based unit indexes.
- A Household has at most one active housing assignment; a Unit has at most one active assignment.
- Incoming requests are not population and contain no Citizen IDs before successful materialization.
- Displaced Households remain resident and retain employment once Employment exists.
- Displaced allocation always precedes incoming allocation.
- `expiresAtTick = displacedAtTick + 720`; expiry performs one final relocation attempt, then household emigration atomically.
- Birth may exceed unit capacity; overcrowding is derived and contributes pressure.
- PR 3 adds only housing-side emigration factors. Employment factors are added in PR 4 through the same registry contract.

---

## Task 1: Extend Building definitions with versioned capacity-profile references

**Files:**
- Modify: `packages/building-core/src/contracts.ts`
- Modify: `packages/building-core/src/building-definitions.ts`
- Modify: `packages/building-core/test/building-definitions.test.ts`
- Modify: `packages/building-core/src/serialization-v2.ts` only when definition metadata validation requires it
- Modify: `docs/systems/buildings/README.md`

**Interfaces:**
- `BuildingDefinition` gains:

```ts
readonly capacityProfileDefinitionId: string;
```

Every built-in definition receives exactly one versioned profile ID:

```text
capacity.residential.cottage.v1
capacity.residential.rowhouse.v1
capacity.residential.duplex.v1
capacity.residential.apartment.v1
capacity.commercial.shop.v1
capacity.commercial.cafe.v1
capacity.commercial.market.v1
capacity.commercial.office.v1
capacity.industrial.workshop.v1
capacity.industrial.depot.v1
capacity.industrial.warehouse.v1
capacity.industrial.factory.v1
```

Building Save continues storing definition ID/version on each instance, not copied capacity fields.

- [ ] **Step 1: Write failing Building-definition tests**

Assert every definition has a non-empty capacity profile ID, IDs are version-suffixed, residential definitions map to the approved four profiles, and content lookup remains deterministic.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/building-core test -- building-definitions.test.ts
```

- [ ] **Step 3: Add metadata and validation**

`building-core` validates syntax/non-empty uniqueness only. It must not import `rci-core` to validate profile contents.

- [ ] **Step 4: Verify existing Building Save compatibility**

Run existing serialization tests and confirm no instance schema change is required because definition metadata is resolved from the saved definition ID/version.

```bash
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/building-core typecheck
```

- [ ] **Step 5: Update Building living docs and commit**

Document that Building definitions expose capacity-profile references but Building does not own Dwelling/Workplace inventory or occupancy.

```bash
git add packages/building-core docs/systems/buildings/README.md
git commit -m "feat(buildings): add versioned capacity profile references"
```

---

## Task 2: Add residential capacity profiles and deterministic inventory synchronization

**Files:**
- Create: `packages/rci-core/src/housing/capacity-profile.ts`
- Create: `packages/rci-core/src/housing/dwelling-inventory.ts`
- Create: `packages/rci-core/test/residential-capacity-profile.test.ts`
- Create: `packages/rci-core/test/dwelling-inventory.test.ts`
- Modify: `packages/rci-core/src/definitions/foundation-definitions.ts`
- Modify: `packages/rci-core/src/rci-tick.ts`

**Interfaces:**
- Produces:

```ts
export interface ResidentialCapacityProfileDefinition {
  readonly id: string;
  readonly kind: 'residential';
  readonly dwellingUnitCount: number;
  readonly residentCapacityPerUnit: number;
}

export function synchronizeDwellingInventory(input: Readonly<{
  snapshot: RciSnapshot;
  buildingsBefore: BuildingSnapshot;
  buildingsAfter: BuildingSnapshot;
  registries: RciDefinitionRegistries;
  evaluationTick: number;
}>): Readonly<{
  proposedSnapshot: RciSnapshot;
  activatedDwellingUnitIds: readonly DwellingUnitId[];
  retiredDwellingUnitIds: readonly DwellingUnitId[];
  endedHousingAssignmentIds: readonly HousingAssignmentId[];
}>;
```

Approved profiles:

```text
cottage:   1 unit × 4 residents
rowhouse:  1 unit × 5 residents
duplex:    2 units × 4 residents
apartment: 6 units × 3 residents
```

- [ ] **Step 1: Write failing profile-validation tests**

Reject zero/negative/non-safe capacities, duplicate IDs, wrong kind, and silent redefinition. Assert exact approved totals.

- [ ] **Step 2: Write failing inventory tests**

Cover newly active residential Building, no inventory during construction, idempotent re-planning, canonical unit IDs/indexes, retirement after bulldoze, no retirement for unrelated Building changes, and stable results under Building-array permutation.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- residential-capacity-profile.test.ts dwelling-inventory.test.ts
```

- [ ] **Step 4: Implement before/after Building indexing**

Index Buildings by stable `instanceId`; compare lifecycle transitions without nested scans. Resolve `buildingDefinitionForId(instance.buildingDefinitionId)` then profile registry metadata.

- [ ] **Step 5: End assignments when a unit retires**

Use end reason `housing-ended.dwelling-retired`. Retirement and assignment endings occur in the same proposed snapshot. Retired unit history remains immutable.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- residential-capacity-profile.test.ts dwelling-inventory.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add dwelling inventory synchronization"
```

---

## Task 3: Implement housing assignments, capacity projection, and stable best-fit relocation

**Files:**
- Create: `packages/rci-core/src/housing/housing-index.ts`
- Create: `packages/rci-core/src/housing/housing-assignment-plan.ts`
- Create: `packages/rci-core/src/housing/housing-reconciliation.ts`
- Create: `packages/rci-core/test/housing-assignment.test.ts`
- Create: `packages/rci-core/test/housing-reconciliation.test.ts`
- Modify: `packages/rci-core/src/validation/cross-domain-validation.ts`

**Interfaces:**
- Produces:

```ts
export interface HousingProjection {
  readonly activeDwellingCount: number;
  readonly occupiedDwellingCount: number;
  readonly vacantDwellingCount: number;
  readonly residentCapacity: number;
  readonly residentCount: number;
  readonly overcrowdedResidentCount: number;
}

export function planHousingReconciliation(input: Readonly<{
  snapshot: RciSnapshot;
  evaluationTick: number;
  registries: RciDefinitionRegistries;
}>): HousingReconciliationPlan;
```

Canonical suitable-unit order:

```text
unused capacity ascending
then dwellingUnitId ascending by compareStableId
```

- [ ] **Step 1: Write failing uniqueness/capacity tests**

Cover duplicate active assignment per Household/Unit, assignment to retired Unit, assignment to dissolved Household, and insufficient capacity for incoming materialization.

- [ ] **Step 2: Write failing relocation tests**

Use fixtures with multiple capacities and assert minimum unused capacity wins, then stable ID. Cover immediate relocation after unit retirement, no move when current assignment remains valid, birth-caused overcrowding retained, and input permutation equality.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- housing-assignment.test.ts housing-reconciliation.test.ts
```

- [ ] **Step 4: Implement current housing indexes**

Build maps by Household and Unit once per reconciliation. Compute Household resident count from active membership projection. Do not persist projection maps.

- [ ] **Step 5: Implement assignment append/end plans**

Allocate `housing-assignment:<sequence>` only after candidate validation. Relocation ends the old assignment and appends the new one atomically at the same tick.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- housing-assignment.test.ts housing-reconciliation.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add deterministic housing reconciliation"
```

---

## Task 4: Add incoming-request generation and stable queue rules

**Files:**
- Create: `packages/rci-core/src/migration/migration-archetype.ts`
- Create: `packages/rci-core/src/migration/request-policy.ts`
- Create: `packages/rci-core/src/migration/incoming-queue.ts`
- Create: `packages/rci-core/test/migration-request-policy.test.ts`
- Create: `packages/rci-core/test/incoming-queue.test.ts`
- Modify: `packages/rci-core/src/definitions/foundation-definitions.ts`

**Interfaces:**
- Produces:

```ts
export interface MigrationRequestPolicy {
  planRequests(input: Readonly<{
    snapshot: RciSnapshot;
    evaluationTick: number;
    suitableVacantJobCount: number;
    registries: RciDefinitionRegistries;
    configuration: RciConfiguration;
  }>): Readonly<{
    requests: readonly IncomingHouseholdRequest[];
    nextAttractionMilli: number;
    nextIncomingRequestSequence: number;
  }>;
}
```

PR 3 passes `suitableVacantJobCount = 0`; PR 4 supplies the Employment projection.

Foundation daily behavior:

```text
baseline +350 milli-households
vacant-job contribution capped at +650 milli-households
max 2 generated requests/day
queue cap 64
requests do not expire
```

- [ ] **Step 1: Write failing accumulator tests**

Cover accumulation below one request, exact threshold, multiple-day carry, max two/day, queue cap pausing generation without discarding accumulator/history, and save/load continuity.

- [ ] **Step 2: Write failing queue-order tests**

Order by `queuePriority` descending, `requestedAtTick` ascending, `deterministicSequence` ascending, then request ID ascending. Assert reversed input yields identical order.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- migration-request-policy.test.ts incoming-queue.test.ts
```

- [ ] **Step 4: Add versioned archetypes**

Register the five approved archetypes with age distributions, relationship template, capacity range, sex distribution, and qualification-resolver context. Definitions contain no preallocated Citizen IDs.

- [ ] **Step 5: Implement accumulator and deterministic weighted archetype selection**

Use counter-based sampling with event namespace `migration-request-archetype`. Allocate only request IDs/sequences; no Citizen/Household/Relationship sequence moves.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- migration-request-policy.test.ts incoming-queue.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add deterministic incoming request queue"
```

---

## Task 5: Implement atomic incoming-Household materialization

**Files:**
- Create: `packages/rci-core/src/migration/household-materialization.ts`
- Create: `packages/rci-core/test/household-materialization.test.ts`
- Modify: `packages/rci-core/src/housing/housing-reconciliation.ts`
- Modify: `packages/rci-core/src/rci-tick.ts`

**Interfaces:**
- Produces:

```ts
export function planMaterializeIncomingHousehold(input: Readonly<{
  snapshot: RciSnapshot;
  requestId: IncomingHouseholdRequestId;
  dwellingUnitId: DwellingUnitId;
  evaluationTick: number;
  registries: RciDefinitionRegistries;
  qualificationResolver: QualificationResolver;
}>): RciRecordMutationPlan;
```

- [ ] **Step 1: Write failing no-preallocation test**

Create a request with no suitable Unit and assert every Citizen/Household/Relationship/Qualification/Membership/Housing sequence is unchanged.

- [ ] **Step 2: Write failing successful materialization tests**

Cover each archetype, deterministic ages/sexes/relationships/qualifications, one Household, one membership per Citizen, one housing assignment, request removal, stable IDs, and exact sequence increments.

- [ ] **Step 3: Write failure-atomicity tests**

Inject an invalid archetype reference or profile and assert the request remains and no authority changes.

- [ ] **Step 4: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- household-materialization.test.ts
```

- [ ] **Step 5: Implement allocation after displaced Household reconciliation**

Housing reconciliation processes suitable displaced entries first, then incoming requests in canonical queue order. Incoming requires sufficient capacity; existing Household relocation may accept current overcrowding only when preserving an existing Household after housing loss according to configuration locked by the spec.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- household-materialization.test.ts housing-reconciliation.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): materialize incoming households atomically"
```

---

## Task 6: Add displaced queue, expiry, and household emigration

**Files:**
- Create: `packages/rci-core/src/migration/displaced-queue.ts`
- Create: `packages/rci-core/src/migration/household-emigration.ts`
- Create: `packages/rci-core/test/displaced-queue.test.ts`
- Create: `packages/rci-core/test/household-emigration.test.ts`
- Modify: `packages/rci-core/src/housing/housing-reconciliation.ts`
- Modify: `packages/rci-core/src/rci-tick.ts`

**Interfaces:**
- Produces:

```ts
export function planDisplaceHousehold(input: Readonly<{
  snapshot: RciSnapshot;
  householdId: HouseholdId;
  displacedAtTick: number;
}>): RciRecordMutationPlan;

export function planEmigrateHousehold(input: Readonly<{
  snapshot: RciSnapshot;
  householdId: HouseholdId;
  evaluationTick: number;
  endReasonDefinitionId: string;
}>): RciRecordMutationPlan;
```

- [ ] **Step 1: Write failing displaced-queue tests**

Cover exactly one entry per Household, resident members/no active assignment invariant, stable priority ordering, retry after capacity change, save/load survival, and `expiresAtTick` exactly 720 ticks later.

- [ ] **Step 2: Write failing expiry tests**

At tick 719 relative to displacement, no forced emigration. At tick 720, one final relocation attempt; success removes entry and adds assignment, failure emigrates every resident member and dissolves Household in one plan.

- [ ] **Step 3: Write historical-preservation tests**

Emigration ends memberships, active partner edges only when partner does not emigrate as the same Household transaction according to relationship lifecycle policy, and future Employment assignments once PR 4 exists. Parent and historical records remain.

- [ ] **Step 4: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- displaced-queue.test.ts household-emigration.test.ts
```

- [ ] **Step 5: Implement stable expiry processing**

Order due entries by `expiresAtTick`, `displacedAtTick`, sequence, then Household ID. Remove an entry only in the same proposed snapshot that creates housing or completes emigration.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- displaced-queue.test.ts household-emigration.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add displacement expiry and emigration"
```

---

## Task 7: Add housing pressure and general-emigration policy extension point

**Files:**
- Create: `packages/rci-core/src/migration/emigration-pressure.ts`
- Create: `packages/rci-core/test/emigration-pressure.test.ts`
- Modify: `packages/rci-core/src/rci-tick.ts`
- Modify: `packages/rci-core/src/definitions/foundation-definitions.ts`

**Interfaces:**
- Produces:

```ts
export interface EmigrationPressureFactorDefinition {
  readonly id: string;
  readonly category: 'housing' | 'employment';
  readonly weightMilli: number;
  evaluate(context: EmigrationPressureContext): number; // 0..100_000
}

export function evaluateHouseholdEmigrationPressure(
  context: EmigrationPressureContext,
  factors: readonly EmigrationPressureFactorDefinition[],
): number;
```

PR 3 foundation factors:

```text
emigration.housing.displaced
emigration.housing.days-displaced
emigration.housing.overcrowded-members
emigration.housing.overcrowding-duration
```

- [ ] **Step 1: Write failing fixed-point aggregation tests**

Cover factor sorting by stable ID, weight validation, clamping, zero pressure, maximum pressure, and reversed factor/input order.

- [ ] **Step 2: Write guaranteed general-emigration test**

Use a fixture policy that maps full pressure to full daily hazard and assert a housed Household emigrates as a group while preserving historical records.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- emigration-pressure.test.ts
```

- [ ] **Step 4: Implement replaceable policy with daily integer hazard**

Displacement expiry remains deterministic and independent of this hazard. Employment-category factors may be registered but return zero until PR 4 supplies Employment context.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- emigration-pressure.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add housing emigration pressure"
```

---

## Task 8: Complete prior-save migration with residential inventory and close PR 3

**Files:**
- Modify: `apps/game/src/world-save.ts`
- Modify: `apps/game/src/world-save-rci-migration.test.ts`
- Modify: `packages/rci-core/test/serialization-v1.test.ts`
- Modify: `docs/systems/rci/README.md`
- Create: `docs/systems/rci/verification/pr3-housing-migration.md`

- [ ] **Step 1: Write failing V1–V4 migration inventory tests**

Decode prior Save fixtures containing active Cottage, Row House, Duplex, and Apartment Buildings. Assert canonical Dwelling inventory exists; construction Buildings have none; Citizens/Households/assignments remain empty; repeated migration is idempotent.

- [ ] **Step 2: Update migration composition**

After Building and Simulation decode, call a pure `createRciMigrationInventory` helper from `rci-core` using foundation registries. Do not duplicate profile logic in `apps/game`.

- [ ] **Step 3: Add continuous/save-load housing tests**

Cover incoming accumulator, request queue, displaced entry, housing history, and general-emigration pressure across Save boundaries.

- [ ] **Step 4: Update living docs**

Mark Dwelling inventory, housing assignments, incoming materialization, relocation, displacement, expiry, and housing-side emigration pressure implemented. Keep Workplaces/Employment/Demand/HUD unimplemented.

- [ ] **Step 5: Run PR verification**

```bash
pnpm --filter @web-three-city/building-core test
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
git add apps/game packages docs
git commit -m "docs(rci): record housing migration verification"
```

## PR 3 Acceptance Gate

- Every active Residential Building exposes deterministic versioned Dwelling capacity.
- Unit activation/retirement and housing-assignment history are lossless.
- Best-fit relocation is deterministic and input-order independent.
- Incoming requests allocate no Citizen IDs before successful housing assignment.
- Displaced Households receive priority, survive Save/Load, and expire exactly at 720 ticks.
- Household emigration preserves historical Citizens/relationships and dissolves active residence authority atomically.
- Housing pressure uses fixed-point factors and deterministic daily sampling.
- V1–V4 migration materializes residential inventory without inventing population.
- Existing Building behavior and renderer remain unchanged.