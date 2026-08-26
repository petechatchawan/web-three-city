# Building Temporal Contract Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ambiguous Building `*Tick` lifecycle names with explicit macro-hour point/duration contracts while preserving construction and Growth behavior exactly.

**Architecture:** `building-core` consumes `MacroHourIndex`/`MacroHourDuration` from `simulation-core`. Building remains the sole lifecycle authority; application/world/presentation consumers must call Building lifecycle APIs instead of comparing raw lifecycle timestamps.

**Tech Stack:** TypeScript 6, Vitest 4, pnpm.

**Spec:** `docs/systems/simulation-time/specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md`

## Global Constraints

- Legacy Building lifecycle Tick values already represent macro hours and migrate 1:1.
- Do not multiply Building lifecycle values by 60.
- Keep Growth evaluation boundaries `00`, `06`, `12`, `18` and current construction duration semantics.
- No presentation/world/save raw comparison against lifecycle fields after this slice.
- WorldSave writer remains V8 until T5; codec compatibility adapters are temporary and private.

---

### Task 1: Characterize lifecycle 1:1 semantics

**Files:**
- Test: `packages/building-core/test/building-lifecycle.test.ts`
- Test: `packages/building-core/test/building-growth.test.ts`
- Test: `apps/game/src/game-minute-transaction.test.ts`

**Interfaces:** Existing `validateBuildingLifecycleAtMacroHour`, `deriveConstructionStateAtMacroHour`, and `deriveConstructionProgressAtMacroHour` are semantic authority.

- [ ] **Step 1: Add RED/characterization cases** for start at macro hour `12`, duration `6`, completion at `18`; verify progress at `12/15/18`, invalid completion before start, and Growth at `00/06/12/18`.
- [ ] **Step 2: Run focused tests**:
```bash
pnpm --filter @web-three-city/building-core exec vitest run test/building-lifecycle.test.ts test/building-growth.test.ts
pnpm --filter @web-three-city/game exec vitest run src/game-minute-transaction.test.ts
```
Expected: existing behavioral assertions PASS; new compile-time semantic-name assertions fail until Task 2.
- [ ] **Step 3: Record a golden fixture** in the test showing old numeric lifecycle values equal the new macro-hour numeric values 1:1.
- [ ] **Step 4: Commit characterization only if GREEN** with `test(buildings): lock macro-hour lifecycle semantics`.

### Task 2: Rename Building runtime contracts

**Files:**
- Modify: `packages/building-core/src/contracts.ts`
- Modify: `packages/building-core/src/building-lifecycle.ts`
- Modify: `packages/building-core/src/building-growth.ts`
- Modify: `packages/building-core/src/building-mutation.ts`
- Modify: `packages/building-core/src/building-snapshot.ts`
- Modify: `packages/building-core/src/building-snapshot-fingerprint.ts`
- Modify: `packages/building-core/src/runtime-growth-bridge.ts`
- Modify: `packages/building-core/src/index.ts`
- Tests: affected `packages/building-core/test/*.test.ts`

**Interfaces:**
- Produces lifecycle fields:
```ts
constructionStartedAtMacroHourIndex: MacroHourIndex | null;
constructionCompletesAtMacroHourIndex: MacroHourIndex | null;
activatedAtMacroHourIndex: MacroHourIndex | null;
```
- Definitions/durations use `MacroHourDuration`, e.g. `constructionDurationMacroHours`.
- Produces Building-owned helpers:
```ts
validateBuildingLifecycleAtMacroHour(instance, now: MacroHourIndex): void;
deriveConstructionStateAtMacroHour(instance, now: MacroHourIndex): 'construction' | 'active';
deriveConstructionProgressAtMacroHour(instance, now: MacroHourIndex): number;
```

- [ ] **Step 1: Add compile RED** by changing tests to consume the new field names/types first.
- [ ] **Step 2: Run** `pnpm --filter @web-three-city/building-core typecheck`; expected FAIL on missing names.
- [ ] **Step 3: Rename runtime fields and route arithmetic/comparisons through simulation temporal helpers**. Preserve numeric fingerprints for equivalent states unless the fingerprint intentionally includes property labels; if label changes alter the fingerprint, update the fingerprint version deliberately and document it rather than hiding the change.
- [ ] **Step 4: Run**:
```bash
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/building-core typecheck
```
- [ ] **Step 5: Commit** with `refactor(buildings): make lifecycle macro-hour explicit`.

### Task 3: Migrate Building persistence boundary without changing writer version

**Files:**
- Modify: `packages/building-core/src/serialization-v2.ts`
- Tests: existing Building serialization/migration tests under `packages/building-core/test/`

**Interfaces:**
- Decoder maps legacy persisted `*Tick` integer fields 1:1 into typed macro-hour runtime fields.
- Existing V2 writer field names remain unchanged until T5 if WorldSaveV8 requires them.

- [ ] **Step 1: Add RED codec tests** for legacy field `12 -> macroHourIndex(12)` and unsafe/negative values rejecting.
- [ ] **Step 2: Run focused serialization tests**; expected FAIL until adapter exists.
- [ ] **Step 3: Implement decode/encode boundary adapters**; raw JSON numbers may exist only inside codec implementation.
- [ ] **Step 4: Run Building test/typecheck/build**.
- [ ] **Step 5: Commit** with `refactor(buildings): isolate legacy lifecycle codec names`.

### Task 4: Cut consumers over to Building lifecycle authority

**Files:**
- Modify: `apps/game/src/game-minute-transaction.ts`
- Modify: `apps/game/src/world-save.ts` validation paths only if they inspect Building lifecycle fields.
- Modify: Building presentation consumer(s) in `packages/building-three/src/` identified by search for old lifecycle fields.
- Test: `apps/game/src/game-minute-transaction.test.ts`
- Test: Building presentation tests under `packages/building-three/test/`

- [ ] **Step 1: Search and make a checked list**:
```bash
rg "construction(Started|Completes|Duration).*Tick|activatedAtTick" packages apps -g '*.ts'
```
Expected: only Building codec legacy compatibility paths may remain after cutover.
- [ ] **Step 2: Add RED consumer tests** proving world validation/presentation use macro-hour APIs at boundaries.
- [ ] **Step 3: Replace direct comparisons with Building-owned helpers**. Do not duplicate progress math in Game or Three.js presentation.
- [ ] **Step 4: Run**:
```bash
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/building-three test
pnpm --filter @web-three-city/game test
pnpm check
```
- [ ] **Step 5: Commit** with `refactor(buildings): cut consumers to lifecycle authority`.

## Exit Gate

Equivalent pre/post Building snapshots must produce identical construction/Growth outcomes at the same macro-hour indexes. The only permitted legacy `Tick` names are private V8/V2 codec compatibility fields scheduled for deletion/replacement in T5/T7.