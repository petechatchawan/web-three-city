# T1 Explicit Temporal Units Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce explicit point/duration temporal types in `simulation-core` and repository-level enforcement without changing calendar mapping, playback pacing, domain cadence, persistence writer, or five-phase transaction behavior.

**Architecture:** `simulation-core` remains Level-0 temporal owner. Temporal values remain validated integer-backed branded numbers; constructors and named arithmetic/conversion helpers are the only production creation/manipulation path. A TypeScript-AST architecture test blocks incompatible temporal operators/casts outside trusted codec/constructor boundaries.

**Tech Stack:** TypeScript 6, Vitest 4, Node test runner, pnpm workspace.

**Spec:** `docs/systems/simulation-time/specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md`

## Global Constraints

- `AbsoluteGameMinute` is the sole mutable world-calendar authority.
- Do not create `temporal-core` unless a real dependency cycle is demonstrated.
- Do not change current calendar projection or playback pacing in T1.
- Do not change WorldSaveV8 writer output in T1.
- Do not change `GameMinute -> Q1 -> Q2 -> Q3 -> Q4` or revision `+5` semantics.
- Do not push intentional RED.
- **Selective Verification is the baseline verification authority for T1.** Run the repository affected-plan resolver against the exact T1 base/head before broadening verification manually.
- Never suppress a resolver escalation. If a T1 change is classified as shared verification/configuration authority, honor its GLOBAL / Full Browser requirement.

## Selective Verification Baseline

Capture the exact implementation base before the first RED edit:

```bash
T1_BASE_SHA=$(git rev-parse HEAD)
git status --short --branch
git rev-parse HEAD
pnpm test:deployment
```

`T1_BASE_SHA` is the immutable comparison base for the whole T1 implementation branch. After each locally GREEN commit, publish the affected plan locally first:

```bash
pnpm verify:affected -- --base "$T1_BASE_SHA" --head HEAD --plan-only --json
```

Then execute the selected deterministic lanes before broader gates:

```bash
pnpm verify:affected -- --base "$T1_BASE_SHA" --head HEAD --skip-browser
```

Rules:

1. Treat the resolver output as the minimum owner/consumer verification set; do not replace it with a manually smaller test list.
2. Focused RED/GREEN tests still run first for the task being implemented.
3. For ordinary `simulation-core` source/test changes, expect affected verification to select Simulation and conservative consumers without inventing Browser work.
4. T1 Task 3 changes repository verification authority (`package.json` plus architecture tooling). The existing resolver classifies `package.json` and shared verification/configuration paths as GLOBAL and therefore requires Full Browser. **This escalation is expected and must be honored at the final GREEN candidate.** Selective Verification remains the baseline because it is the mechanism that decides the escalation.
5. `pnpm check` remains mandatory before the first non-force push even when affected verification is GREEN.
6. Never push RED to obtain CI feedback. GitHub Actions verifies a locally GREEN exact HEAD; it is not the first debugger.
7. Do not modify Selective Verification topology/resolver behavior as part of T1 merely to reduce the selected test set. Any Selective Verification vNext work remains a separate change.

---

### Task 1: Add explicit simulation temporal scalar contracts

**Files:**

- Create: `packages/simulation-core/src/temporal-units.ts`
- Modify: `packages/simulation-core/src/index.ts`
- Test: `packages/simulation-core/test/temporal-units.test.ts`

**Interfaces:**

- Produces:

```ts
export type AbsoluteGameMinute = number & { readonly __absoluteGameMinute: unique symbol };
export type GameMinuteDuration = number & { readonly __gameMinuteDuration: unique symbol };
export type MacroHourIndex = number & { readonly __macroHourIndex: unique symbol };
export type MacroHourDuration = number & { readonly __macroHourDuration: unique symbol };

export function absoluteGameMinute(value: number): AbsoluteGameMinute;
export function gameMinuteDuration(value: number): GameMinuteDuration;
export function macroHourIndex(value: number): MacroHourIndex;
export function macroHourDuration(value: number): MacroHourDuration;
export function gameMinuteValue(value: AbsoluteGameMinute | GameMinuteDuration): number;
export function macroHourValue(value: MacroHourIndex | MacroHourDuration): number;
export function addGameMinutes(
  point: AbsoluteGameMinute,
  duration: GameMinuteDuration,
): AbsoluteGameMinute;
export function addMacroHours(point: MacroHourIndex, duration: MacroHourDuration): MacroHourIndex;
export function compareGameMinutes(a: AbsoluteGameMinute, b: AbsoluteGameMinute): -1 | 0 | 1;
export function compareMacroHours(a: MacroHourIndex, b: MacroHourIndex): -1 | 0 | 1;
```

- [x] **Step 1: Write constructor/arithmetic RED tests**

Add tests proving zero and safe positive integers are accepted; negative, fractional, `NaN`, infinity, and unsafe integers reject with the existing simulation contract error family. Test point+duration and same-unit comparisons.

- [x] **Step 2: Run the focused RED**

Run:

```bash
pnpm --filter @web-three-city/simulation-core exec vitest run test/temporal-units.test.ts
```

Expected: FAIL because the module/exports do not exist.

- [x] **Step 3: Implement minimal branded integer contracts**

Use private `unique symbol` brands and runtime safe-integer validation. Do not export brand symbols and do not introduce wrapper objects.

- [x] **Step 4: Run focused GREEN and package typecheck**

```bash
pnpm --filter @web-three-city/simulation-core exec vitest run test/temporal-units.test.ts
pnpm --filter @web-three-city/simulation-core typecheck
```

Expected: PASS.

- [x] **Step 5: Run Selective GREEN checkpoint**

```bash
pnpm verify:affected -- --base "$T1_BASE_SHA" --head HEAD --plan-only --json
pnpm verify:affected -- --base "$T1_BASE_SHA" --head HEAD --skip-browser
```

- [x] **Step 6: Commit**

```bash
git add packages/simulation-core/src/temporal-units.ts packages/simulation-core/src/index.ts packages/simulation-core/test/temporal-units.test.ts
git commit -m "feat(simulation): add explicit temporal units"
```

### Task 2: Move macro-hour derivation behind typed helpers

**Files:**

- Modify: `packages/simulation-core/src/calendar.ts`
- Modify: `packages/simulation-core/src/contracts.ts`
- Modify: `packages/simulation-core/src/simulation-snapshot.ts`
- Test: `packages/simulation-core/test/calendar.test.ts`
- Test: `packages/simulation-core/test/simulation-snapshot.test.ts`

**Interfaces:**

- Consumes: T1 temporal units.
- Produces:

```ts
export function deriveMacroHourIndex(gameMinute: AbsoluteGameMinute): MacroHourIndex;
export function deriveMacroHourTransition(
  before: AbsoluteGameMinute,
  after: AbsoluteGameMinute,
): MacroHourTransition;
```

`SimulationSnapshot.absoluteGameMinute` becomes `AbsoluteGameMinute` internally while serialization still emits the same V3 integer.

- [x] **Step 1: Add RED type/runtime tests** proving `59 -> 60` crosses macro hour, `60 -> 61` does not, and snapshot creation validates through `absoluteGameMinute(...)`.
- [x] **Step 2: Run RED** with `pnpm --filter @web-three-city/simulation-core test`; expected compile/test failure at raw-number call sites.
- [x] **Step 3: Implement typed signatures** and migrate only `simulation-core` call sites using constructors/helpers; preserve current calendar values byte-for-byte.
- [x] **Step 4: Run GREEN**:

```bash
pnpm --filter @web-three-city/simulation-core test
pnpm --filter @web-three-city/simulation-core typecheck
pnpm verify:affected -- --base "$T1_BASE_SHA" --head HEAD --plan-only --json
pnpm verify:affected -- --base "$T1_BASE_SHA" --head HEAD --skip-browser
```

- [x] **Step 5: Commit** with `feat(simulation): type game-minute authority`.

### Task 3: Add temporal architecture enforcement

**Files:**

- Create: `tooling/temporal-unit-boundary.test.mjs`
- Create: `tooling/architecture-fixtures/temporal-unit-violations/valid.ts`
- Create: `tooling/architecture-fixtures/temporal-unit-violations/operator.ts`
- Create: `tooling/architecture-fixtures/temporal-unit-violations/cast.ts`
- Modify: `package.json`

**Interfaces:**

- Produces a Node test included in `pnpm test:deployment` that parses TypeScript with the compiler API and rejects production-source patterns that bypass the named temporal API.

- [x] **Step 1: Write scanner RED fixture tests** proving detection of incompatible branded arithmetic/comparison, direct `as AbsoluteGameMinute` / `as MacroHourIndex`, and `as unknown as <TemporalType>`; allow trusted constructor implementation and codec decode boundaries by explicit path allowlist.
- [x] **Step 2: Run RED**:

```bash
node --test tooling/temporal-unit-boundary.test.mjs
```

Expected: FAIL until scanner rules exist.

- [x] **Step 3: Implement scanner and add it to `test:deployment`**. The scanner must report file/line and stable violation category.
- [x] **Step 4: Run GREEN and confirm resolver escalation**:

```bash
node --test tooling/temporal-unit-boundary.test.mjs tooling/architecture-boundary.test.mjs
pnpm test:deployment
pnpm verify:affected -- --base "$T1_BASE_SHA" --head HEAD --plan-only --json
pnpm verify:affected -- --base "$T1_BASE_SHA" --head HEAD --skip-browser
```

Expected Selective result after `package.json` is changed: GLOBAL/shared-verification escalation with Full Browser required for final closure. Do not weaken classification to avoid this.

- [x] **Step 5: Commit** with `test(architecture): enforce temporal unit boundaries`.

### Task 4: Migrate Game application compile seam without semantic change

**Files:**

- Modify: `apps/game/src/game-minute-transaction.ts`
- Modify: `apps/game/src/temporal-publication-controller.ts`
- Modify: `apps/game/src/simulation-runtime.ts` only where typed adapter conversion is required; do not change constants.
- Test: `apps/game/src/game-minute-transaction.test.ts`
- Test: `apps/game/src/temporal-publication.test.ts`
- Test: `apps/game/src/simulation-runtime.test.ts`

**Interfaces:**

- Consumes typed Simulation contracts.
- Preserves public temporal result behavior and five ordered phase receipts.

- [x] **Step 1: Add RED parity assertions** for minute `+1`, revision `+5`, phase order, rejection atomicity, and unchanged runtime pacing constants.
- [x] **Step 2: Run RED/compile gate**:

```bash
pnpm --filter @web-three-city/game exec vitest run src/game-minute-transaction.test.ts src/temporal-publication.test.ts src/simulation-runtime.test.ts
```

- [x] **Step 3: Replace raw simulation boundary arithmetic with named helpers**. Do not touch Building/RCI/Economy/Mobility/Traffic domain public fields yet; use explicit boundary adapters at the app seam.
- [x] **Step 4: Run GREEN plus Selective/deployment architecture**:

```bash
pnpm --filter @web-three-city/game test
pnpm test:deployment
pnpm verify:affected -- --base "$T1_BASE_SHA" --head HEAD --plan-only --json
pnpm verify:affected -- --base "$T1_BASE_SHA" --head HEAD --skip-browser
pnpm check
```

- [x] **Step 5: Commit** with `refactor(game): adopt explicit temporal authority types`.

## T1 Exit Gate

T1 is complete only when:

- simulation-core focused/owner tests are GREEN;
- Game affected tests are GREEN;
- temporal architecture tooling and `pnpm test:deployment` are GREEN;
- the Selective Verification plan has been generated from exact `T1_BASE_SHA...HEAD` and all selected deterministic lanes are GREEN;
- any resolver escalation caused by shared verification/configuration changes is honored, including Full Browser when selected;
- `pnpm check` is GREEN;
- current calendar values are unchanged;
- runtime still nominally uses `1000ms` base with `1/2/4` multipliers;
- WorldSaveV8 output is unchanged;
- `git diff --check` passes and the tracked worktree is clean;
- only then may a non-force GREEN candidate be pushed for exact-head CI/Sonar verification.

Do not start calendar or domain semantic migration in this PR.

## Execution Record

- T1 implementation base: `10a6c1f8c593451262d077779787fc5c127858e1`
- GREEN commits: `e810f85`, `f461abf`, `932ccbc`, `b01c701`, `62a6b6e`
- Local Full Browser: `149 passed`, `1 skipped`, `0 failed` (the explicit Metal-gated performance test is skipped under local SwiftShader)
- The final exit status of `pnpm verify:full` was affected only by the repository clean-worktree check seeing the two pre-existing protected untracked plan files; they were preserved untouched.
- Exact-head CI/Sonar remains the post-push gate.
