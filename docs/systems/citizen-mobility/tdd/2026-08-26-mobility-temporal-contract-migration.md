# Citizen Mobility Temporal Contract Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Type Mobility schedule points as `AbsoluteGameMinute`, rename legacy day cursor semantics to Simulation Cycle semantics where appropriate, and preserve commute behavior exactly.

**Architecture:** `citizen-mobility-core` consumes time primitives from `simulation-core`. Mobility owns schedule policy and trip intent; Traffic remains the transport executor. The 24-hour citizen schedule repeats every Simulation Cycle even though the calendar presents each cycle as a month.

**Tech Stack:** TypeScript 6, Vitest 4, pnpm.

**Spec:** `docs/systems/simulation-time/specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md`

## Global Constraints

- `departureGameMinute` and `nextBoundaryGameMinute` become `AbsoluteGameMinute` without changing represented values.
- The existing Home/Work schedule remains anchored to the 24-hour Simulation Cycle.
- Do not infer calendar month/year from Mobility local state.
- Do not alter mode choice, route selection, trip purpose, failure handling, or Traffic admission.
- Save writer version changes are deferred to T5.

---

### Task 1: Characterize schedule-cycle parity

**Files:**
- Test: Mobility schedule tests under `packages/citizen-mobility-core/test/`
- Test: `apps/game/src/mobility-traffic-tick.test.ts`

**Interfaces:** Existing schedule policy must produce identical due boundaries for the same `absoluteGameMinute` before and after migration.

- [ ] **Step 1: Add characterization cases** across `07:59 -> 08:00`, commute departure/return boundaries, `23:59 -> 00:00`, and the same clock time in the next 24-hour cycle.
- [ ] **Step 2: Run current package/Game tests and record expected trip IDs/statuses/departure numeric values**.
- [ ] **Step 3: Commit GREEN characterization** with `test(mobility): lock schedule cycle semantics`.

### Task 2: Add simulation-core dependency and type Mobility contracts

**Files:**
- Modify: `packages/citizen-mobility-core/package.json`
- Modify: `packages/citizen-mobility-core/src/contracts.ts`
- Modify: `packages/citizen-mobility-core/src/schedule-index.ts`
- Modify: `packages/citizen-mobility-core/src/schedule-policy.ts`
- Modify: `packages/citizen-mobility-core/src/mobility-planner.ts`
- Modify: `packages/citizen-mobility-core/src/mobility-reconciler.ts`
- Modify: `packages/citizen-mobility-core/src/mobility-snapshot.ts`
- Modify: `packages/citizen-mobility-core/src/index.ts`
- Tests: affected Mobility tests.

**Interfaces:**
```ts
nextBoundaryGameMinute: AbsoluteGameMinute | null;
departureGameMinute: AbsoluteGameMinute;
scheduleCursorCycle: number;
```
If the existing `scheduleCursorDay` is purely a 24-hour recurrence counter, rename it to `scheduleCursorCycle`; if characterization proves a different meaning, keep a semantic name matching evidence.

- [ ] **Step 1: Change tests to new types/names and run typecheck RED**.
- [ ] **Step 2: Add `@web-three-city/simulation-core` dependency and migrate contracts** through named helpers.
- [ ] **Step 3: Replace minute arithmetic/comparison with `addGameMinutes`/same-unit comparison helpers**.
- [ ] **Step 4: Run**:
```bash
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/citizen-mobility-core typecheck
pnpm test:deployment
```
- [ ] **Step 5: Commit** with `refactor(mobility): type schedule time authority`.

### Task 3: Isolate Mobility V1/V2 codec legacy fields

**Files:**
- Modify: `packages/citizen-mobility-core/src/persistence.ts`
- Test: Mobility persistence tests under `packages/citizen-mobility-core/test/`

**Interfaces:** V1/V2 GameMinute values migrate 1:1 into `AbsoluteGameMinute`; cycle cursor integers remain counters, not calendar-month authority.

- [ ] **Step 1: Add RED migration tests** for planned/active trips and next boundary values, including unsafe input rejection.
- [ ] **Step 2: Implement validating decode adapters**; raw numeric construction remains inside codec boundary only.
- [ ] **Step 3: Prove existing V2 writer payload remains unchanged until T5**.
- [ ] **Step 4: Commit** with `refactor(mobility): isolate legacy temporal codec`.

### Task 4: Cut application source projections/orchestration to typed Mobility time

**Files:**
- Modify: `apps/game/src/mobility-source-projection.ts`
- Modify: `apps/game/src/mobility-traffic-tick.ts`
- Modify: `apps/game/src/game-minute-transaction.ts`
- Test: `apps/game/src/mobility-traffic-tick.test.ts`
- Test: `apps/game/src/mobility-traffic-save-continuation.test.ts`

- [ ] **Step 1: RED parity tests** compare trip identity, purpose, departure time, mode, status, and citizen activity across schedule boundaries.
- [ ] **Step 2: Replace raw GameMinute values at the app seam with typed helpers**; do not change Traffic advancement here.
- [ ] **Step 3: Run Mobility + affected Game GREEN**.
- [ ] **Step 4: Run `pnpm check`**.
- [ ] **Step 5: Commit** with `refactor(game): adopt mobility temporal contracts`.

## Exit Gate

At identical absolute GameMinutes, Mobility creates/retains/completes exactly the same trips and citizen activities as before. `scheduleCursorDay` must not remain if it is merely a 24-hour recurrence counter; no Mobility field may become an independent month/year clock.