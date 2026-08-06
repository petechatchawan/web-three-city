# RCI PR 5 — Demand and Building-Growth Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Begin only after PR 4 is merged to `master`.

**Goal:** Implement fixed-point target-buffer R/C/I Demand, stable factor aggregation, smoothing, persisted hysteresis gates, demand multipliers, and caller-supplied Building Growth policy without introducing an RCI dependency into `building-core`.

**Architecture:** `rci-core` derives Demand from authoritative Housing, Employment, and Migration projections. Demand and gate state are authoritative because smoothing and hysteresis require previous state. `building-core` receives a plain `BuildingGrowthPolicy` input and remains independently usable; `apps/game` composes the policy into automatic growth.

**Tech Stack:** TypeScript, Vitest, fixed-point integer arithmetic, Building growth planner, RCI projections from PRs 1–4.

## Global Constraints

- Demand values use milli-points in `-100_000..100_000`.
- Factor outputs and weights are integers; factor order is stable definition-ID order.
- Smoothing is `previous + roundHalfAwayFromZero((raw - previous) × 250 / 1000)` by default.
- Gate opens at `>= 15_000`, closes at `<= 5_000`, otherwise retains previous state.
- Demand/gate evaluation can occur after daily lifecycle and after relevant Building/queue changes.
- Closed gate excludes that zone from new automatic growth only.
- Negative Demand never removes, abandons, downgrades, or bulldozes existing Buildings.
- Existing development hours remain 00:00, 06:00, 12:00, and 18:00.
- Background growth remains headless and cannot modify tool/input/undo state.

---

## Task 1: Add fixed-point arithmetic primitives and golden tests

**Files:**
- Create: `packages/rci-core/src/demand/fixed-point.ts`
- Create: `packages/rci-core/test/fixed-point.test.ts`

**Interfaces:**

```ts
export type DemandMilliPoint = number;
export const DEMAND_MIN = -100_000;
export const DEMAND_MAX = 100_000;

export function clampDemand(value: number): DemandMilliPoint;
export function multiplyMilli(value: number, factorMilli: number): number;
export function roundHalfAwayFromZero(numerator: number, denominator: number): number;
export function smoothDemand(previous: number, raw: number, smoothingMilli: number): DemandMilliPoint;
```

- [ ] **Step 1: Write failing arithmetic tests**

Cover positive/negative half values, exact divisions, overflow guards, clamp bounds, default smoothing golden values, and repeated smoothing without floating drift.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- fixed-point.test.ts
```

- [ ] **Step 3: Implement safe-integer arithmetic**

Validate operands before multiplication. Throw `RciContractError('rci:invalid-demand')` when operations exceed safe-integer bounds. Do not use floating accumulators in runtime evaluation.

- [ ] **Step 4: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- fixed-point.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add fixed-point demand arithmetic"
```

---

## Task 2: Implement RCI projection inputs for Demand

**Files:**
- Create: `packages/rci-core/src/projection/rci-projection.ts`
- Create: `packages/rci-core/test/rci-projection.test.ts`
- Modify: `packages/rci-core/src/index.ts`

**Interfaces:**

```ts
export interface RciProjection {
  readonly residentPopulation: number;
  readonly householdCount: number;
  readonly activeDwellingCount: number;
  readonly occupiedDwellingCount: number;
  readonly vacantDwellingCount: number;
  readonly overcrowdedResidentCount: number;
  readonly displacedHouseholdCount: number;
  readonly incomingHouseholdRequestCount: number;
  readonly workforceCount: number;
  readonly employedCount: number;
  readonly unemployedCount: number;
  readonly underemployedCount: number;
  readonly commercialPositionCapacity: number;
  readonly commercialVacancyCount: number;
  readonly industrialPositionCapacity: number;
  readonly industrialVacancyCount: number;
}

export function createRciProjection(
  snapshot: RciSnapshot,
  registries: RciDefinitionRegistries,
  absoluteTick: number,
): RciProjection;
```

- [ ] **Step 1: Write failing projection tests**

Cover empty city, occupied/vacant Dwelling counts, overcrowding, displaced/incoming queues, workforce boundaries, Employment totals, sector vacancy counts, and underemployment.

- [ ] **Step 2: Add reconstruction/permutation tests**

Encode/decode the same snapshot with arrays reversed and assert identical projection. Projection construction must not mutate or cache into the snapshot.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- rci-projection.test.ts
```

- [ ] **Step 4: Implement indexed linear projection**

Reuse current-state Housing/Employment indexes; avoid repeated full-array scans for each metric. Sector comes from Workplace profile kind, not Building-zone string comparison inside projection code.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- rci-projection.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add demand projection"
```

---

## Task 3: Add Demand factor registry and initial target-buffer factors

**Files:**
- Create: `packages/rci-core/src/demand/demand-factor.ts`
- Create: `packages/rci-core/src/demand/foundation-demand-factors.ts`
- Create: `packages/rci-core/test/demand-factor.test.ts`
- Create: `packages/rci-core/test/foundation-demand-factors.test.ts`
- Modify: `packages/rci-core/src/definitions/contracts.ts`
- Modify: `packages/rci-core/src/definitions/foundation-definitions.ts`

**Interfaces:**

```ts
export interface DemandEvaluationContext {
  readonly projection: RciProjection;
  readonly previousDemand: RciDemandState;
  readonly configuration: RciConfiguration;
}

export interface DemandFactorDefinition {
  readonly id: string;
  readonly appliesTo: readonly ('residential' | 'commercial' | 'industrial')[];
  readonly weightMilli: number;
  evaluate(context: DemandEvaluationContext): DemandMilliPoint;
}
```

Initial weights:

```text
Residential: vacancy gap 450, incoming queue 250, displacement 200, overcrowding 100
Commercial: sector vacancy gap 450, compatible unemployment 350, sector balance 200
Industrial: sector vacancy gap 450, compatible unemployment 350, sector balance 200
```

Initial targets:

```text
residential vacancy 10%
commercial position vacancy 8%
industrial position vacancy 8%
```

- [ ] **Step 1: Write failing registry tests**

Reject duplicate/empty IDs, invalid zone targets, negative weights, per-zone weight totals other than 1000 for foundation configuration, and non-integer factor output.

- [ ] **Step 2: Write factor golden tests**

Cover empty city/bootstrap pressure, above/below vacancy targets, incoming/displaced/overcrowding pressure, unemployment with compatible vacancies, sector imbalance, zero denominators, and clamp limits.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- demand-factor.test.ts foundation-demand-factors.test.ts
```

- [ ] **Step 4: Implement normalized factor functions**

Each factor returns `-100_000..100_000`; aggregation applies weight separately. Division uses explicit integer rounding. A factor never reads DOM, Building placement candidates, or frame state.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- demand-factor.test.ts foundation-demand-factors.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add target-buffer demand factors"
```

---

## Task 4: Implement Demand evaluation, smoothing, and authoritative gates

**Files:**
- Create: `packages/rci-core/src/demand/demand-evaluation.ts`
- Create: `packages/rci-core/src/demand/growth-gate.ts`
- Create: `packages/rci-core/test/demand-evaluation.test.ts`
- Create: `packages/rci-core/test/growth-gate.test.ts`
- Modify: `packages/rci-core/src/rci-tick.ts`

**Interfaces:**

```ts
export function evaluateRciDemand(input: Readonly<{
  projection: RciProjection;
  previousDemand: RciDemandState;
  factors: readonly DemandFactorDefinition[];
  configuration: RciConfiguration;
  evaluationTick: number;
}>): RciDemandState;

export function evaluateRciGrowthGates(input: Readonly<{
  demand: RciDemandState;
  previous: RciGrowthGateState;
  evaluationTick: number;
  openThresholdMilli: number;
  closeThresholdMilli: number;
}>): RciGrowthGateState;
```

- [ ] **Step 1: Write failing aggregation-order tests**

Reverse factors and definitions; assert exact equal raw/smoothed Demand. Verify factor contributions sort by ID before aggregation.

- [ ] **Step 2: Write failing gate boundary tests**

For each zone test `4_999`, `5_000`, `5_001`, `14_999`, `15_000`, `15_001` from both prior open and closed states. Assert evaluated tick and other zones remain independent.

- [ ] **Step 3: Write invalidation-cadence tests**

Daily lifecycle always evaluates Demand. Dwelling/Workplace activation/retirement and incoming/displaced queue change evaluate in the same tick. An unrelated no-op tick preserves exact Demand/gate object identity when no evaluation is required.

- [ ] **Step 4: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- demand-evaluation.test.ts growth-gate.test.ts
```

- [ ] **Step 5: Integrate into canonical RCI tick order**

Evaluate after Housing/Employment/Emigration cleanup. Persist Demand and gates in the proposed snapshot. Increment Demand bounded revision and root revision only when values or evaluated tick change.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- demand-evaluation.test.ts growth-gate.test.ts rci-tick-employment.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): add demand smoothing and growth gates"
```

---

## Task 5: Derive caller-supplied `BuildingGrowthPolicy`

**Files:**
- Create: `packages/rci-core/src/demand/building-growth-policy.ts`
- Create: `packages/rci-core/test/building-growth-policy.test.ts`
- Modify: `packages/rci-core/src/index.ts`

**Interfaces:**

```ts
export interface BuildingGrowthPolicy {
  readonly eligibleZoneDefinitionIds: readonly ZoneDefinitionId[];
  readonly demandWeightMilliByZoneDefinitionId: Readonly<Record<ZoneDefinitionId, number>>;
}

export function createBuildingGrowthPolicy(input: Readonly<{
  demand: RciDemandState;
  gates: RciGrowthGateState;
}>): BuildingGrowthPolicy;
```

Demand multipliers:

```text
15_000..34_999 => 1_000
35_000..59_999 => 1_500
60_000..79_999 => 2_000
80_000..100_000 => 3_000
```

- [ ] **Step 1: Write failing gate/multiplier tests**

Closed zones are absent even with high Demand. Open zones map to correct integer multiplier. Zone IDs sort canonically. Returned record and arrays are frozen.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/rci-core test -- building-growth-policy.test.ts
```

- [ ] **Step 3: Implement plain-data policy**

The object contains no callbacks and no RCI-specific type import is needed by `building-core`. It is safe to store in app runtime memory but is derived and not persisted separately.

- [ ] **Step 4: Run tests and commit**

```bash
pnpm --filter @web-three-city/rci-core test -- building-growth-policy.test.ts
pnpm --filter @web-three-city/rci-core typecheck
git add packages/rci-core
git commit -m "feat(rci): derive building growth policy"
```

---

## Task 6: Add Growth policy input to `building-core`

**Files:**
- Modify: `packages/building-core/src/contracts.ts`
- Modify: `packages/building-core/src/building-growth.ts`
- Modify: `packages/building-core/src/building-selection.ts`
- Modify: `packages/building-core/src/runtime-growth-bridge.ts`
- Modify: `packages/building-core/test/building-growth.test.ts`
- Modify: `packages/building-core/test/building-selection.test.ts`
- Modify: `packages/building-core/test/runtime-growth-bridge.test.ts`

**Interfaces:**
- Define `BuildingGrowthPolicy` in `building-core` as the same structural plain-data contract. `rci-core` should return a structurally compatible object or import the type from `building-core`; `building-core` never imports RCI.
- `planBuildingGrowthTick` gains required input:

```ts
readonly growthPolicy: BuildingGrowthPolicy;
```

- [ ] **Step 1: Write failing closed-gate growth tests**

At a development evaluation tick, a closed Residential policy excludes Residential candidates while allowing open Commercial/Industrial candidates. All gates closed yields no new Building but still completes construction and advances Simulation.

- [ ] **Step 2: Write failing demand-weight tests**

Use equal base candidates and deterministic selection fixtures to prove multiplier affects selection weight while preserving definition priority and stable tie behavior.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/building-core test -- building-growth.test.ts building-selection.test.ts runtime-growth-bridge.test.ts
```

- [ ] **Step 4: Thread policy through selection**

Filter candidate zone types before expensive lot/definition work. Multiply base definition weight by policy multiplier using safe integer arithmetic; reject malformed policy as `building-growth:invalid-environment` or a new explicit policy error code covered by tests.

- [ ] **Step 5: Preserve non-RCI consumers**

Provide an exported `OPEN_ALL_BUILDING_GROWTH_POLICY` fixture/default only when a caller explicitly selects it. Do not make missing policy silently mean open-all.

- [ ] **Step 6: Run full Building tests and commit**

```bash
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/building-core typecheck
git add packages/building-core
git commit -m "feat(buildings): accept caller growth policy"
```

---

## Task 7: Compose policy into game automatic growth without tool-state coupling

**Files:**
- Modify: `apps/game/src/game-bootstrap.ts`
- Create: `apps/game/src/rci-growth-bridge.ts`
- Create: `apps/game/src/rci-growth-bridge.test.ts`
- Modify: existing tool/headless regression tests, including `apps/game/src/game-tool-mode-building.test.ts` and relevant preview tests
- Modify: `apps/game/package.json` only if dependency was not already added in PR 1

**Interfaces:**

```ts
export function createRciGrowthBridge(input: Readonly<{
  getRciSnapshot: () => RciSnapshot;
}>): Readonly<{
  currentPolicy(): BuildingGrowthPolicy;
}>;
```

- [ ] **Step 1: Write failing integration test**

Set persisted Demand/gates in an RCI fixture, invoke automatic growth, and assert the Building planner receives exact policy values.

- [ ] **Step 2: Write active-tool regression tests**

For Terrain, Road, and Zone tools, keep an active preview/session while background tick completes construction and evaluates growth. Assert tool mode, preview data, pointer session, undo stack, and HUD menu state are unchanged.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/game test -- rci-growth-bridge.test.ts game-tool-mode-building.test.ts game-input-road-preview.test.ts game-input-zone-preview.test.ts
```

- [ ] **Step 4: Add headless bridge**

The bridge reads committed RCI state and returns derived policy. It never calls UI/controller methods and never synthesizes Building-tool actions.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @web-three-city/game test -- rci-growth-bridge.test.ts game-tool-mode-building.test.ts game-input-road-preview.test.ts game-input-zone-preview.test.ts
pnpm --filter @web-three-city/game typecheck
git add apps/game
git commit -m "feat(game): apply rci growth policy headlessly"
```

---

## Task 8: Add persistence/determinism evidence and close PR 5

**Files:**
- Modify: `packages/rci-core/test/serialization-v1.test.ts`
- Create: `packages/rci-core/test/demand-determinism.test.ts`
- Modify: `docs/systems/rci/README.md`
- Modify: `docs/systems/buildings/README.md`
- Create: `docs/systems/rci/verification/pr5-demand-growth.md`

- [ ] **Step 1: Extend Save golden fixtures**

Assert Demand and gate state round-trip exactly, including a value in the hysteresis band where current Demand alone cannot reconstruct prior gate state.

- [ ] **Step 2: Add continuous/save-load/resume test**

Run Housing/Employment changes, evaluate Demand, save/load inside the hysteresis band, then continue growth evaluations. Assert exact equal gates, policy, selected Building, growth sequence, and Save JSON.

- [ ] **Step 3: Add factor/input permutation test**

Permute factor definitions and authoritative record arrays; assert equal raw Demand, smoothed Demand, gates, policy, receipts, and canonical Save.

- [ ] **Step 4: Update living docs**

Mark Demand, smoothing, authoritative gates, and Building policy integration implemented. State that the game still lacks final atomic world-tick ownership/HUD/browser closure until PR 6.

- [ ] **Step 5: Run PR verification**

```bash
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/game test
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
git add packages apps/game docs
git commit -m "docs(rci): record demand growth verification"
```

## PR 5 Acceptance Gate

- Housing/Employment/Migration projections deterministically produce R/C/I Demand.
- Integer aggregation, smoothing, clamps, and gate boundaries pass golden tests.
- Gate state persists and survives hysteresis-band Save/Load.
- `building-core` accepts a plain caller policy and has no RCI dependency.
- Closed zones cannot start growth; Demand multipliers influence eligible selection.
- Construction completion and Simulation advancement still occur with all gates closed.
- Background RCI growth never changes active tools, previews, pointer sessions, HUD mode, or undo state.
- Continuous execution and save/load/resume choose identical Building growth outcomes.