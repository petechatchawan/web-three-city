# RCI Temporal + Calendar Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RCI temporal semantics explicit, bind age/annual-rate behavior to the compressed 12-cycle calendar year, and migrate legacy age-bearing state without changing a citizen's age at cutover.

**Architecture:** RCI consumes macro-hour/calendar helpers from `simulation-core`. The recurring 24-hour lifecycle remains one Simulation Cycle and still evaluates at 08:00 each cycle. Age and annual fertility/mortality rates bind to the new calendar year (`12 cycles = 288 macro hours`), while field migration is classified per semantic purpose instead of applying one blanket conversion.

**Tech Stack:** TypeScript 6, Vitest 4, pnpm.

**Spec:** `docs/systems/simulation-time/specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md`

## Global Constraints

- New year length: `12 * 24 = 288 MacroHours`.
- Legacy year length: `360 * 24 = 8640 legacy macro-hour ticks`.
- `AbsoluteGameMinute` remains 1:1 across V8 -> V9.
- Age-origin migration must preserve citizen age-years and fractional-year phase at cutover; do not let a 1-year legacy resident become 30 years old.
- Lifecycle event/history timestamps are not automatically age-scaled; classify each field first.
- RCI daily/cycle evaluation remains at 08:00 once per 24-hour Simulation Cycle.
- Annual probability definitions remain annual probabilities; per-cycle hazard must be recomputed for 12 evaluations/year.

---

### Task 1: Classify every RCI Tick field before renaming

**Files:**
- Create: `packages/rci-core/test/temporal-field-semantics.test.ts`
- Inspect/modify later: `packages/rci-core/src/contracts/records.ts`, `packages/rci-core/src/events/`, `packages/rci-core/src/households/`, `packages/rci-core/src/population/`, `packages/rci-core/src/persistence/`, `packages/rci-core/src/rci-snapshot.ts`, `packages/rci-core/src/rci-tick.ts`

**Interfaces:** Test table classifies each durable/runtime temporal field as one of:
```ts
type RciTemporalSemantic =
  | 'age-origin'
  | 'macro-hour-point'
  | 'macro-hour-duration'
  | 'cycle-index'
  | 'historical-event-point';
```

- [ ] **Step 1: Add a RED completeness test** containing the known Tick-suffixed fields discovered by `rg "Tick|Ticks" packages/rci-core/src -g '*.ts'`; test fails when a discovered field has no classification.
- [ ] **Step 2: Run**:
```bash
pnpm --filter @web-three-city/rci-core exec vitest run test/temporal-field-semantics.test.ts
```
Expected: FAIL until every discovered field is classified.
- [ ] **Step 3: Complete the field table from source evidence**. `bornAtTick` is `age-origin`; `startedAtTick`/`endedAtTick`/event `tick` are macro-hour/historical points unless source proves otherwise. Do not infer from name alone.
- [ ] **Step 4: GREEN the completeness test** and commit `test(rci): classify legacy temporal fields`.

### Task 2: Replace legacy age constants with calendar-year semantics

**Files:**
- Modify: `packages/rci-core/src/population/age.ts`
- Modify: `packages/rci-core/src/population/hazard.ts`
- Test: RCI age/hazard tests under `packages/rci-core/test/`

**Interfaces:**
```ts
export const RCI_CYCLES_PER_CALENDAR_YEAR = 12;
export const RCI_MACRO_HOURS_PER_CALENDAR_YEAR = 288;
export function ageYearsAtMacroHour(bornAt: MacroHourIndex, now: MacroHourIndex): number;
export function ageBandAtMacroHour(bornAt: MacroHourIndex, now: MacroHourIndex): AgeBandDefinitionId;
export function compileAnnualRateToCycleHazard(annualRateMillionth: number): ProbabilityUnit;
```

- [ ] **Step 1: Add RED tests**: age increments exactly at 288 macro hours; `287` remains age 0; annual hazard `p` compounded across 12 cycle evaluations approximates `p` within integer rounding; 0 and 100% remain exact.
- [ ] **Step 2: Run focused RED**; expected failures against current `8640` hours/year and 360-way daily hazard.
- [ ] **Step 3: Implement new constants/helpers** using simulation calendar policy constants/helpers rather than duplicating `12`/`24` where practical.
- [ ] **Step 4: Run RCI focused GREEN** and typecheck.
- [ ] **Step 5: Commit** with `feat(rci): bind age and hazards to calendar year`.

### Task 3: Preserve existing citizen age at calendar cutover

**Files:**
- Create: `packages/rci-core/src/migration/legacy-age-origin-migration.ts`
- Test: `packages/rci-core/test/legacy-age-origin-migration.test.ts`

**Interfaces:**
```ts
export function migrateLegacyBornAtMacroHour(input: Readonly<{
  legacyBornAtMacroHour: number;
  currentMacroHour: MacroHourIndex;
}>): MacroHourIndex;
```

Required mapping:
```ts
legacyElapsed = current - legacyBorn;
newElapsed = floor(legacyElapsed * 288 / 8640);
newBorn = current - newElapsed;
```
Use checked integer arithmetic and preserve ordering/age band. For exact whole legacy years, whole new years must be exact.

- [ ] **Step 1: RED tests** for newborn, 1 year, 5.5 years, 18 years, senior, current-time birth, negative/future/unsafe rejection, and monotonic ordering of two citizens.
- [ ] **Step 2: Run RED**; expected missing helper.
- [ ] **Step 3: Implement checked migration** without floating timestamp state. Use integer numerator/denominator math and explicit floor policy.
- [ ] **Step 4: GREEN plus property-style boundary cases** around age-band transitions.
- [ ] **Step 5: Commit** with `feat(rci): preserve age across calendar cutover`.

### Task 4: Rename runtime RCI temporal contracts

**Files:**
- Modify: `packages/rci-core/src/contracts/records.ts`
- Modify: relevant `packages/rci-core/src/events/*.ts`
- Modify: `packages/rci-core/src/population/daily-lifecycle.ts`
- Modify: `packages/rci-core/src/population/qualification-*.ts`
- Modify: `packages/rci-core/src/rci-snapshot.ts`
- Modify: `packages/rci-core/src/rci-tick.ts`
- Modify: `packages/rci-core/src/index.ts`
- Tests: affected RCI tests.

**Interfaces:** Examples, only where classification proves semantics:
```text
bornAtTick -> bornAtMacroHourIndex
movedIntoCityAtTick -> movedIntoCityAtMacroHourIndex
startedAtTick -> startedAtMacroHourIndex
endedAtTick -> endedAtMacroHourIndex
evaluationTick -> evaluationMacroHourIndex
```
Cycle counters use `*CycleIndex`; durations use `*MacroHours`.

- [ ] **Step 1: Change tests first to new names/types and run typecheck RED**.
- [ ] **Step 2: Migrate contracts and algorithms** through `MacroHourIndex` helpers; remove raw relational/arithmetic escapes caught by T1 architecture tooling.
- [ ] **Step 3: Replace `evaluateDailyPopulationLifecycle` with a semantically named cycle-level API, e.g. `evaluatePopulationLifecycleCycle`, while a temporary private compatibility alias may exist only until all callers move.
- [ ] **Step 4: Run full RCI test/typecheck/build**.
- [ ] **Step 5: Commit** with `refactor(rci): make temporal semantics explicit`.

### Task 5: Prove cycle lifecycle and deterministic rate behavior

**Files:**
- Test: existing population lifecycle tests plus new `packages/rci-core/test/compressed-calendar-lifecycle.test.ts`
- Modify only if required: deterministic sampling inputs/event naming.

- [ ] **Step 1: RED tests** covering 12 consecutive 08:00 cycle boundaries, one calendar-year age increment, annual fertility/mortality hazard compounding, age-band transition, deterministic replay from identical snapshot/seed.
- [ ] **Step 2: Verify deterministic samples remain keyed by stable temporal integer point**; if event naming changes, prove equivalent ordering and replay rather than silently reseeding.
- [ ] **Step 3: GREEN all RCI tests**:
```bash
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/rci-core typecheck
pnpm --filter @web-three-city/rci-core build
```
- [ ] **Step 4: Run affected Game tests** for `08:00` lifecycle/Demand boundary.
- [ ] **Step 5: Commit** with `test(rci): verify compressed calendar lifecycle`.

## Exit Gate

At cutover, a migrated V8 citizen has the same age-years/age-band and proportional position within the year as immediately before migration. Future aging uses 12 Simulation Cycles per year. Annual fertility/mortality definitions still represent annual probabilities. No unclassified Tick field may reach T5 codec work.