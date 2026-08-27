# T4 Compressed Calendar Projection + Playback Preservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the game from the legacy 30-day/month calendar projection to the approved compressed calendar—24 GameHours per Simulation Cycle, one cycle per Calendar Month, 12 months per Calendar Year—while preserving the sole `AbsoluteGameMinute` authority and the existing x1/x2/x4 playback cadence exactly.

**Architecture:** `simulation-core` remains the Level-0 owner of world time. T4 changes only deterministic calendar projection and the consumers that display or read projected calendar fields; it does not create another clock, rescale canonical minutes, or change domain cadence. Building, RCI, Economy, Mobility, and Traffic continue to consume their explicit temporal contracts established by T1–T3.

**Tech Stack:** TypeScript 6, Vitest 4, Playwright 1.61, pnpm.

**Spec:** `docs/systems/simulation-time/specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md`

## Prerequisites and Branch Rule

- T3A Mobility and T3B Traffic must both be merged with combined T3 exact-head verification GREEN.
- Create `feat/t4-compressed-calendar-projection` from the then-current `master` only after T3 closure.
- Record `T4_BASE_SHA=$(git rev-parse HEAD)` before the first RED and use it for affected verification.
- T4 must not contain WorldSave V9 writer work; T5 owns writer/version migration.

## Current-Source Audit to Reconfirm Before RED

At planning time the repository still contains the legacy projection:

- `packages/simulation-core/src/contracts.ts` exposes `GameCalendar { year, month, day, hour }` without minute.
- `packages/simulation-core/src/calendar.ts` derives 24 hours/day, 30 days/month, 12 months/year and still accepts legacy macro-hour-style inputs through `deriveGameCalendar()`.
- `deriveGameCalendarFromGameMinute()` delegates through that legacy projection.
- `apps/game/src/game-time-presentation.ts` derives `minute` manually from `absoluteGameMinute % 60` while presenting `calendar.day`.
- `packages/economy-core/src/scheduled-settlement.ts` accepts a projected calendar object including `day`, although settlement semantics are 08:00 once per 24-hour Simulation Cycle and period rollover uses year/month.
- `apps/game/src/simulation-runtime.ts` already has the approved playback pacing: x1 `1000 ms`, x2 `500 ms`, x4 `250 ms` per GameMinute.
- World persistence remains V8 until T5.

Re-run the inventory locally before edits:

```bash
rg "deriveGameCalendar|GameCalendar|\.day\b|minuteOfDay|MINUTES_PER_DAY|DAYS_PER_MONTH|1000|500|250" \
  packages/simulation-core packages/economy-core apps/game browser-tests -g '*.ts'
```

If current source materially differs because T3 changed a consumer, update only the affected file list; do not broaden T4 semantics.

## Global Constraints

- `AbsoluteGameMinute` remains the sole mutable world-calendar authority.
- One GameHour = `60` GameMinutes.
- One Simulation Cycle = `24` GameHours = `1440` GameMinutes.
- One Calendar Month = exactly one Simulation Cycle.
- One Calendar Year = `12` Calendar Months = `12` Simulation Cycles = `17280` GameMinutes.
- Canonical minute values are never rescaled during T4.
- Playback remains x1 `1.000 s`, x2 `0.500 s`, x4 `0.250 s` per GameMinute.
- Building construction/Growth, RCI lifecycle/hazard, Economy settlement, Mobility schedules, and Traffic four-quanta cadence do not change.
- Successful minute publication remains `GameMinute -> Q1 -> Q2 -> Q3 -> Q4`, revision `+5`.
- Rejection remains fail-stop and atomic; runtime pauses and clears accumulated wall-clock time with no silent retry.
- WorldSave writer remains V8 throughout T4.
- Automatic Growth remains enabled.
- `23:59 -> 00:00` is a first-class regression boundary.
- No T5 persistence-version work or T6 visual redesign belongs in this slice.

---

### Task 1: Characterize Canonical-Minute and Playback Parity

**Files:**
- Test: `packages/simulation-core/test/calendar.test.ts` or the existing calendar test file discovered locally.
- Test: `apps/game/src/game-time-presentation.test.ts`
- Test: `apps/game/src/simulation-runtime.test.ts`
- Test: `apps/game/src/game-minute-transaction.test.ts`
- Test: existing Economy settlement boundary tests.

**Interfaces:** Current canonical `AbsoluteGameMinute` values and runtime pacing are the preservation oracle; only calendar labels are expected to change later.

- [ ] **Step 1: Add characterization tests** proving canonical minute continuity around `59 -> 60`, `1439 -> 1440`, `17279 -> 17280`, and a large safe minute.
- [ ] **Step 2: Record current runtime playback evidence** for x1/x2/x4 and pause/step behavior without changing production code.
- [ ] **Step 3: Record transaction parity** proving one successful minute still produces GameMinute + Q1..Q4 and final revision `+5`, while rejection publishes none of the staged chain.
- [ ] **Step 4: Run characterization GREEN**:

```bash
pnpm --filter @web-three-city/simulation-core test
pnpm --filter @web-three-city/economy-core test
pnpm --filter @web-three-city/game exec vitest run \
  src/game-time-presentation.test.ts \
  src/simulation-runtime.test.ts \
  src/game-minute-transaction.test.ts
```

- [ ] **Step 5: Commit characterization only**:

```bash
git add packages/simulation-core/test packages/economy-core/test apps/game/src/*time*presentation*.test.ts apps/game/src/simulation-runtime.test.ts apps/game/src/game-minute-transaction.test.ts
git commit -m "test(simulation): lock compressed-calendar cutover invariants"
```

---

### Task 2: Define the Compressed Calendar Policy in Simulation Core

**Files:**
- Create: `packages/simulation-core/src/calendar-policy.ts`
- Modify: `packages/simulation-core/src/contracts.ts`
- Modify: `packages/simulation-core/src/calendar.ts`
- Modify: `packages/simulation-core/src/index.ts`
- Test: simulation-core calendar tests.

**Interfaces:**

```ts
export const GAME_MINUTES_PER_HOUR = 60 as const;
export const GAME_HOURS_PER_SIMULATION_CYCLE = 24 as const;
export const GAME_MINUTES_PER_SIMULATION_CYCLE = 1440 as const;
export const SIMULATION_CYCLES_PER_CALENDAR_YEAR = 12 as const;
export const GAME_MINUTES_PER_CALENDAR_YEAR = 17280 as const;

export interface GameCalendar {
  readonly year: number;   // 1-based
  readonly month: number;  // 1..12, one Simulation Cycle each
  readonly hour: number;   // 0..23
  readonly minute: number; // 0..59
}

export function simulationCycleIndexAtGameMinute(
  absoluteGameMinute: AbsoluteGameMinute,
): number;

export function deriveGameCalendarFromGameMinute(
  absoluteGameMinute: AbsoluteGameMinute,
): GameCalendar;
```

`simulationCycleIndexAtGameMinute()` returns a validated non-negative safe integer counter, not a second mutable clock.

- [ ] **Step 1: Change tests to the target calendar first**. Required exact expectations:

```text
minute 0      -> Y1 M1 00:00, cycle 0
minute 59     -> Y1 M1 00:59, cycle 0
minute 60     -> Y1 M1 01:00, cycle 0
minute 1439   -> Y1 M1 23:59, cycle 0
minute 1440   -> Y1 M2 00:00, cycle 1
minute 17279  -> Y1 M12 23:59, cycle 11
minute 17280  -> Y2 M1 00:00, cycle 12
```

Also test overflow/safe-integer boundaries for derived multiplications/additions.

- [ ] **Step 2: Run RED**:

```bash
pnpm --filter @web-three-city/simulation-core test
pnpm --filter @web-three-city/simulation-core typecheck
```

Expected: failures because `GameCalendar.minute`/compressed projection do not yet exist and legacy `day` is still public.

- [ ] **Step 3: Implement `calendar-policy.ts` as pure constants/helpers** with checked integer math where needed. Do not store cycle/month/year mutable state.
- [ ] **Step 4: Rewrite `deriveGameCalendarFromGameMinute()` directly from `AbsoluteGameMinute`**. Do not convert through a legacy macro-hour/day/month model.
- [ ] **Step 5: Remove `day` from the canonical `GameCalendar` contract**. If a legacy helper is temporarily required for historical tests, name it explicitly `legacy*`, keep it out of the canonical public runtime API, and schedule its final removal in T7.
- [ ] **Step 6: Run simulation-core GREEN**:

```bash
pnpm --filter @web-three-city/simulation-core test
pnpm --filter @web-three-city/simulation-core typecheck
pnpm --filter @web-three-city/simulation-core build
```

- [ ] **Step 7: Commit**:

```bash
git add packages/simulation-core
git commit -m "feat(simulation): project compressed calendar"
```

---

### Task 3: Cut Domain Consumers to the New Projection Without Changing Cadence

**Files:**
- Modify: `packages/economy-core/src/scheduled-settlement.ts`
- Modify: any RCI/Building/Mobility consumer found by the audit that reads `GameCalendar.day` or legacy month/day constants.
- Test: affected owner tests.

**Interfaces:** Economy should consume only the projected fields it actually needs:

```ts
calendar: Readonly<{
  year: number;
  month: number;
  hour: number;
}>;
```

or an equivalent narrow type derived from canonical `GameCalendar`. It must not require `day` merely because legacy projection exposed it.

- [ ] **Step 1: Change consumer tests first** so no domain test constructs or asserts `calendar.day` for canonical runtime behavior.
- [ ] **Step 2: Run typecheck/test RED** for the affected domains after canonical `GameCalendar.day` removal.
- [ ] **Step 3: Update consumers minimally**. Economy remains one settlement at hour 08:00 per 24-hour Simulation Cycle; period close occurs on month/year transition derived from the compressed projection. RCI remains 12 cycle evaluations/year; Building/Mobility/Traffic cadence remains unchanged.
- [ ] **Step 4: Run owner GREEN**:

```bash
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/economy-core test
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/traffic-core test
```

- [ ] **Step 5: Commit**:

```bash
git add packages
git commit -m "refactor(domains): consume compressed calendar projection"
```

---

### Task 4: Cut Game Presentation to Canonical Calendar Projection

**Files:**
- Modify: `apps/game/src/game-time-presentation.ts`
- Modify: Game projections/view-models that still expose `day` for canonical runtime time.
- Test: `apps/game/src/game-time-presentation.test.ts`
- Test: affected shell/view-model tests under `apps/game/src/ui/`.

**Interfaces:**

```ts
export interface GameTimePresentation {
  readonly year: number;
  readonly month: number;
  readonly hour: number;
  readonly minute: number;
}
```

If the current exported type has a different name, preserve the established name but change its fields to the canonical projection above. Do not manually compute `minute` in the Game layer.

- [ ] **Step 1: Change presentation tests first** to expect Y/M/HH:MM and explicitly reject dependence on `day`.
- [ ] **Step 2: Run focused RED**:

```bash
pnpm --filter @web-three-city/game exec vitest run src/game-time-presentation.test.ts
pnpm --filter @web-three-city/game typecheck
```

- [ ] **Step 3: Replace manual `% 60`/legacy day projection** with `deriveGameCalendarFromGameMinute()` output only.
- [ ] **Step 4: Update canonical shell/view-model consumers** without visual redesign. T6 owns final release/visual acceptance.
- [ ] **Step 5: Run Game GREEN**:

```bash
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
```

- [ ] **Step 6: Commit**:

```bash
git add apps/game/src
git commit -m "refactor(game): present compressed calendar"
```

---

### Task 5: Prove Playback and Atomic-Minute Semantics Are Unchanged

**Files:**
- Test: `apps/game/src/simulation-runtime.test.ts`
- Test: `apps/game/src/game-minute-transaction.test.ts`
- Test: `apps/game/src/temporal-publication.test.ts`
- Test: existing rejection/clock-freeze tests.

**Interfaces:** Runtime pacing remains:

```text
Pause -> no automatic GameMinute
x1    -> 1000 ms / GameMinute
x2    ->  500 ms / GameMinute
x4    ->  250 ms / GameMinute
Step  -> exactly one ordinary authoritative GameMinute transaction
```

- [ ] **Step 1: Add explicit RED-resistant regression assertions** that changing calendar policy does not change the constants or wall-clock accumulator behavior.
- [ ] **Step 2: Verify `23:59 -> 00:00` crosses the month boundary while still producing exactly Q1..Q4 and `+5` revision.
- [ ] **Step 3: Verify a rejected `23:59 -> 00:00` attempt leaves canonical minute, revision, calendar label, domain state, and transport state unchanged; playback pauses and the accumulator is cleared.
- [ ] **Step 4: Run focused GREEN**:

```bash
pnpm --filter @web-three-city/game exec vitest run \
  src/simulation-runtime.test.ts \
  src/game-minute-transaction.test.ts \
  src/temporal-publication.test.ts
```

- [ ] **Step 5: Commit**:

```bash
git add apps/game/src/*runtime*.test.ts apps/game/src/game-minute-transaction.test.ts apps/game/src/temporal-publication.test.ts
git commit -m "test(game): preserve playback across calendar cutover"
```

---

### Task 6: Keep WorldSave V8 Bytes Stable While Reprojecting Labels

**Files:**
- Test: `apps/game/src/world-save.test.ts`
- Test: existing save continuation tests for Building/RCI/Economy/Mobility/Traffic.
- Production: no writer-version change expected in this task.

**Interfaces:** A V8 save continues to persist the same canonical `AbsoluteGameMinute` numeric authority. Loading the same minute after T4 may display a different calendar label because projection changed; that is intentional and must be explicit in tests.

- [ ] **Step 1: Add a golden V8 test** with canonical minute `1440`: serialized minute remains `1440` byte/value-compatible, while runtime projection is Y1 M2 00:00.
- [ ] **Step 2: Add another golden near year rollover** at `17280`: canonical minute is preserved 1:1 and projects to Y2 M1 00:00.
- [ ] **Step 3: Assert `encodeWorldSaveV8()` still emits version 8 and all existing domain writer versions. Do not add V9 fields.
- [ ] **Step 4: Run save continuation GREEN**:

```bash
pnpm --filter @web-three-city/game exec vitest run \
  src/world-save.test.ts \
  src/*save-continuation*.test.ts
```

- [ ] **Step 5: Commit tests only unless a compatibility adapter is genuinely required**:

```bash
git add apps/game/src/*save*.test.ts
git commit -m "test(world): prove v8 authority continuity under compressed calendar"
```

---

### Task 7: Browser Authority for Calendar Rollover and Controls

**Files:**
- Create or modify: a focused Browser spec under `browser-tests/` for simulation/calendar presentation.
- Reuse: existing automatic-growth, interaction, Mobility, Traffic, and simulation-inspection specs where they already cover the required authority.

**Interfaces:** Browser authority proves rendered calendar labels and playback controls only. It does not replace deterministic domain tests.

- [ ] **Step 1: Add targeted Browser coverage** for Y1 M1 23:59 -> Y1 M2 00:00, Y1 M12 23:59 -> Y2 M1 00:00, pause, x1/x2/x4 selection, and Step.
- [ ] **Step 2: Assert the UI no longer presents a canonical day-of-month field**. Do not redesign the shell.
- [ ] **Step 3: Include one automatic-growth/settlement observation across a cycle boundary** to prove the UI cutover did not suppress domain cadence.
- [ ] **Step 4: Run unit/Game GREEN first, then build one exact Browser artifact and run the resolver-selected tagged Browser suite.

---

## Selective and Exact-Head Verification

Before push:

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

pnpm verify:affected -- --base "$T4_BASE_SHA" --head HEAD --plan-only --json
pnpm verify:affected -- --base "$T4_BASE_SHA" --head HEAD --skip-browser
```

Honor Browser/Full Browser exactly as the resolver requires; the resolver is the minimum. Push only a GREEN candidate, open a Draft PR, and require exact-head GitHub Actions + Sonar before merge.

## Exit Gate

T4 is complete only when:

- canonical time is still one `AbsoluteGameMinute` authority with identical numeric values before/after cutover;
- calendar projection is exactly 60 minutes/hour, 24 hours/month-cycle, 12 month-cycles/year;
- `GameCalendar` no longer exposes canonical `day` and includes `minute`;
- `23:59 -> 00:00` and year rollover are proven in unit/Game/Browser layers;
- x1/x2/x4 remain 1000/500/250 ms per GameMinute, pause/step semantics unchanged;
- Building, RCI, Economy, Mobility, Traffic cadence/behavior remain GREEN;
- WorldSave writer is still V8 and canonical minute bytes are unchanged;
- automatic Growth remains ON;
- exact-head CI/Sonar and required Browser authority are GREEN.

Only after T4 is merged may T5 WorldSave V9 implementation begin.
