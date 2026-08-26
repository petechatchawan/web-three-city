# T4 Compressed Calendar + Playback Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut calendar projection to the compressed city-builder standard while preserving the merged playback pacing and the canonical temporal transaction model.

**Architecture:** `AbsoluteGameMinute` remains the only mutable world-calendar authority. Calendar month/year/clock values are pure projections from a versioned policy. The 24-hour Simulation Cycle is both the repeating operational day for Growth/RCI/Economy/Mobility and one displayed calendar month. Playback stays an application-only real-time request policy at the existing nominal 1.000/0.500/0.250 seconds per GameMinute for x1/x2/x4.

**Tech Stack:** TypeScript 6, Vitest 4, Playwright 1.61, pnpm.

**Spec:** `docs/systems/simulation-time/specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md`

## Global Constraints

- Calendar: 60 min/hour, 24 hours/cycle/month, 12 months/year.
- `23:59 -> 00:00` increments month; December rollover increments year.
- Do not create a mutable day/month/year counter.
- Keep runtime `GAME_MINUTE_MILLISECONDS = 1000` and multipliers paused/1/2/4 unless implementation encapsulates them without changing effective pacing.
- Do not use slower pacing to hide performance regressions.
- Do not change domain duration units, Traffic quanta, five-phase publication, or WorldSave writer in T4.

---

### Task 1: Add versioned compressed calendar policy

**Files:**
- Modify: `packages/simulation-core/src/calendar.ts`
- Create or modify: `packages/simulation-core/src/calendar-policy.ts`
- Modify: `packages/simulation-core/src/index.ts`
- Test: `packages/simulation-core/test/calendar.test.ts`
- Test: `packages/simulation-core/test/calendar-policy.test.ts`

**Interfaces:**
```ts
export const COMPRESSED_CALENDAR_POLICY_VERSION = 1 as const;
export const GAME_MINUTES_PER_HOUR = 60 as const;
export const HOURS_PER_SIMULATION_CYCLE = 24 as const;
export const MONTHS_PER_CALENDAR_YEAR = 12 as const;

export interface GameCalendar {
  readonly year: number;
  readonly month: number; // 1..12
  readonly hour: number;  // 0..23
  readonly minute: number; // 0..59
}

export function deriveGameCalendarFromGameMinute(minute: AbsoluteGameMinute): GameCalendar;
export function deriveSimulationCycleIndex(minute: AbsoluteGameMinute): number;
```

- [ ] **Step 1: Write RED boundary table** for minute 0, 59, 60, 1439, 1440, month 12 end, year rollover, and large safe values.
- [ ] **Step 2: Run focused RED**:
```bash
pnpm --filter @web-three-city/simulation-core exec vitest run test/calendar.test.ts test/calendar-policy.test.ts
```
Expected: current 30-day calendar assertions conflict with compressed policy.
- [ ] **Step 3: Implement projection-only policy**. Month index is `floor(absoluteGameMinute / 1440) % 12 + 1`; year is `floor(absoluteGameMinute / (1440*12)) + 1`; clock remains minute-of-cycle. Use checked helpers rather than open-coded formulas at consumers.
- [ ] **Step 4: Run Simulation GREEN**.
- [ ] **Step 5: Commit** with `feat(simulation): adopt compressed calendar projection`.

### Task 2: Reconcile recurring Simulation Cycle consumers

**Files:**
- Modify only as required: `apps/game/src/game-minute-transaction.ts`
- Test: `apps/game/src/game-minute-transaction.test.ts`
- Test: RCI/Economy/Mobility boundary suites produced by T2/T3.

**Interfaces:** Operational recurrence remains 24 macro hours; the calendar label change must not cause Growth/settlement/Mobility to run 30x or skip cycles.

- [ ] **Step 1: RED integration matrix** for one complete 24-hour cycle: Growth at 00/06/12/18, RCI/Economy 08:00 boundary, commute outbound/return, month rollover at 00:00.
- [ ] **Step 2: Run affected suites** and identify any consumer accidentally using legacy `day`/month projection for cadence.
- [ ] **Step 3: Cut consumers to `deriveSimulationCycleIndex`/macro-hour helpers** where recurrence is operational rather than calendar-month accounting.
- [ ] **Step 4: GREEN Game + RCI + Economy + Mobility packages**.
- [ ] **Step 5: Commit** with `refactor(game): separate cycle cadence from calendar labels`.

### Task 3: Preserve current playback pacing explicitly

**Files:**
- Modify: `apps/game/src/simulation-runtime.ts` only to make pacing contract explicit if useful.
- Test: `apps/game/src/simulation-runtime.test.ts`
- Test: `apps/game/src/game-time-presentation.test.ts`

**Interfaces:**
```text
paused = no automatic GameMinute requests
x1 = 1000ms / GameMinute
x2 = 500ms / GameMinute
x4 = 250ms / GameMinute
```

- [ ] **Step 1: Add RED/exact tests** feeding deterministic deltas and asserting emitted minute counts at each speed, accumulator reset on speed/visibility change, max minutes per advance behavior, and Step only while paused.
- [ ] **Step 2: Run focused runtime test**. If current implementation already passes exact behavior, this is characterization GREEN; do not rewrite for novelty.
- [ ] **Step 3: If constants are refactored, preserve effective values exactly** and keep wall-clock policy out of domain packages.
- [ ] **Step 4: Run Game tests and typecheck**.
- [ ] **Step 5: Commit only if production code changed**, message `refactor(game): make playback pacing contract explicit`; otherwise keep test-only commit.

### Task 4: Update calendar HUD/presentation

**Files:**
- Modify: `apps/game/src/game-time-presentation.ts`
- Modify: UI shell/HUD files consuming date labels, identified by `rg "day|month|year|absoluteGameMinute" apps/game/src/ui apps/game/src -g '*.ts'`
- Test: `apps/game/src/game-time-presentation.test.ts`
- Test: UI shell tests.

**Interfaces:** Display clock `HH:mm`, Month 1..12, Year >=1. Do not show legacy Day 1..30 as calendar authority.

- [ ] **Step 1: RED presentation tests** for January 23:59 -> February 00:00 and December Year 1 -> January Year 2.
- [ ] **Step 2: Update projection/view-model only**; no UI component may calculate calendar arithmetic itself.
- [ ] **Step 3: Run Game/UI GREEN**.
- [ ] **Step 4: Commit** with `feat(ui): present compressed simulation calendar`.

### Task 5: Browser acceptance for pacing and rollover

**Files:**
- Modify/create browser tests with existing tags under `browser-tests/`; prefer the existing simulation/time spec if present instead of a new broad suite.

- [ ] **Step 1: Add targeted browser tests** for Pause, x1/x2/x4 ordering/cadence tolerance, month rollover, year rollover, and no temporal failure notification during normal progression.
- [ ] **Step 2: Build once**:
```bash
pnpm build:browser
```
- [ ] **Step 3: Run targeted Chromium only** with the relevant existing tags/specs.
- [ ] **Step 4: Run `pnpm check`, `git diff --check`, and clean tracked worktree verification**.

## Exit Gate

Calendar labels use the compressed policy, recurring operational systems still execute on their intended 24-hour-cycle boundaries, and playback remains effectively identical to the merged `1000ms * 1/2/4` model. Any desire for faster-than-current x4 is a separate product/performance milestone.