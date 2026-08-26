# Economy Temporal Contract Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Economy's ambiguous Tick language and open-coded minute/hour conversion with explicit macro-hour/cycle semantics while keeping fiscal cadence and values behaviorally identical.

**Architecture:** Economy gains a one-way dependency on `simulation-core` for temporal types/helpers. Existing settlement that runs once at the 08:00 boundary of each 24-hour Simulation Cycle remains once per cycle; the compressed calendar does not multiply or divide charges/revenue merely because that cycle is displayed as a calendar month.

**Tech Stack:** TypeScript 6, Vitest 4, pnpm.

**Spec:** `docs/systems/simulation-time/specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md`

## Global Constraints

- Preserve current cash, tax, maintenance, ledger, and settlement formulas.
- Preserve the existing once-per-24h-cycle 08:00 settlement cadence.
- Do not call the recurring operational settlement a calendar-month settlement unless policy explicitly changes later.
- Remove open-coded `Math.floor(gameMinute / 60)` and equivalent temporal conversion from Economy production code.
- Writer version changes are deferred to T5.

---

### Task 1: Characterize settlement temporal semantics

**Files:**
- Test: `packages/economy-core/test/scheduled-settlement.test.ts`
- Test: `packages/economy-core/test/economy-snapshot.test.ts`
- Test: `apps/game/src/economy-save-continuation.test.ts`

**Interfaces:** Current settlement takes macro-hour-like before/after tick boundaries and a calendar projection. New tests lock that one 08:00 crossing creates one settlement and non-boundary hours do not.

- [ ] **Step 1: Add characterization cases** for `07 -> 08`, `08 -> 09`, next-cycle `31 -> 32` (08:00 on cycle 2), and multi-cycle catch-up rejection/explicit behavior already supported by source.
- [ ] **Step 2: Run focused tests**:
```bash
pnpm --filter @web-three-city/economy-core test
pnpm --filter @web-three-city/game exec vitest run src/economy-save-continuation.test.ts
```
- [ ] **Step 3: Record the existing expected treasury/ledger values** as golden parity evidence.
- [ ] **Step 4: Commit GREEN characterization** with `test(economy): lock cycle settlement semantics`.

### Task 2: Introduce explicit Economy temporal fields

**Files:**
- Modify: `packages/economy-core/package.json`
- Modify: `packages/economy-core/src/economy-snapshot.ts`
- Modify: `packages/economy-core/src/scheduled-settlement.ts`
- Modify: `packages/economy-core/src/rules.ts`
- Modify: `packages/economy-core/src/index.ts`
- Tests: affected Economy tests.

**Interfaces:**
```ts
latestCycleSettlementAtMacroHourIndex: MacroHourIndex;
```
Settlement input uses:
```ts
beforeMacroHourIndex: MacroHourIndex;
afterMacroHourIndex: MacroHourIndex;
```
Durations use `MacroHourDuration`; cycle-boundary helper comes from `simulation-core`.

- [ ] **Step 1: Change tests first to new fields/types; run typecheck RED**.
- [ ] **Step 2: Add `@web-three-city/simulation-core` workspace dependency** and migrate runtime contracts.
- [ ] **Step 3: Replace local conversion formulas with named simulation helpers**. No raw cast bypasses T1 architecture tooling.
- [ ] **Step 4: Run**:
```bash
pnpm --filter @web-three-city/economy-core test
pnpm --filter @web-three-city/economy-core typecheck
pnpm test:deployment
```
- [ ] **Step 5: Commit** with `refactor(economy): make settlement time explicit`.

### Task 3: Isolate legacy Economy codec semantics

**Files:**
- Modify: `packages/economy-core/src/serialization.ts`
- Test: Economy serialization tests under `packages/economy-core/test/`

**Interfaces:** Legacy V1 Tick-named integer fields decode 1:1 to explicit macro-hour runtime values. Existing writer output remains compatible until T5.

- [ ] **Step 1: RED codec tests** for 1:1 mapping, negative/fractional/unsafe rejection, and roundtrip preservation of existing V1 payload.
- [ ] **Step 2: Implement validating codec adapters** using `macroHourIndex(...)` at the untrusted JSON boundary.
- [ ] **Step 3: Run full Economy package tests/build**.
- [ ] **Step 4: Commit** with `refactor(economy): isolate legacy temporal codec`.

### Task 4: Cut Game orchestration to explicit Economy time

**Files:**
- Modify: `apps/game/src/game-minute-transaction.ts`
- Modify: `apps/game/src/world-save.ts` migration/bootstrap paths that derive Economy temporal state.
- Test: `apps/game/src/game-minute-transaction.test.ts`
- Test: `apps/game/src/world-save-economy-migration.test.ts`

- [ ] **Step 1: RED tests** prove settlement remains exactly once on the same macro-hour/cycle boundary before and after type migration.
- [ ] **Step 2: Replace open-coded or raw Economy temporal values with `MacroHourIndex` helpers**.
- [ ] **Step 3: Run Game focused GREEN and Economy package tests**.
- [ ] **Step 4: Run `pnpm check`**.
- [ ] **Step 5: Commit** with `refactor(game): use economy temporal contracts`.

## Exit Gate

For identical world state and macro-hour boundaries, treasury balance, ledger entries, settlement count, and tax/maintenance amounts are unchanged. The only semantic calendar change arrives in T4 presentation/calendar projection; Economy operational settlement stays once per 24-hour Simulation Cycle.