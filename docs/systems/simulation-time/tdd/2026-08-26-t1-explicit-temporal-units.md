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
export function addGameMinutes(point: AbsoluteGameMinute, duration: GameMinuteDuration): AbsoluteGameMinute;
export function addMacroHours(point: MacroHourIndex, duration: MacroHourDuration): MacroHourIndex;
export function compareGameMinutes(a: AbsoluteGameMinute, b: AbsoluteGameMinute): -1 | 0 | 1;
export function compareMacroHours(a: MacroHourIndex, b: MacroHourIndex): -1 | 0 | 1;
```

- [ ] **Step 1: Write constructor/arithmetic RED tests**

Add tests proving zero and safe positive integers are accepted; negative, fractional, `NaN`, infinity, and unsafe integers reject with the existing simulation contract error family. Test point+duration and same-unit comparisons.

- [ ] **Step 2: Run the focused RED**

Run:
```bash
pnpm --filter @web-three-city/simulation-core exec vitest run test/temporal-units.test.ts
```
Expected: FAIL because the module/exports do not exist.

- [ ] **Step 3: Implement minimal branded integer contracts**

Use private `unique symbol` brands and runtime safe-integer validation. Do not export brand symbols and do not introduce wrapper objects.

- [ ] **Step 4: Run focused GREEN and package typecheck**

```bash
pnpm --filter @web-three-city/simulation-core exec vitest run test/temporal-units.test.ts
pnpm --filter @web-three-city/simulation-core typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

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
export function deriveMacroHourTransition(before: AbsoluteGameMinute, after: AbsoluteGameMinute): MacroHourTransition;
```
`SimulationSnapshot.absoluteGameMinute` becomes `AbsoluteGameMinute` internally while serialization still emits the same V3 integer.

- [ ] **Step 1: Add RED type/runtime tests** proving `59 -> 60` crosses macro hour, `60 -> 61` does not, and snapshot creation validates through `absoluteGameMinute(...)`.
- [ ] **Step 2: Run RED** with `pnpm --filter @web-three-city/simulation-core test`; expected compile/test failure at raw-number call sites.
- [ ] **Step 3: Implement typed signatures** and migrate only `simulation-core` call sites using constructors/helpers; preserve current calendar values byte-for-byte.
- [ ] **Step 4: Run GREEN**:
```bash
pnpm --filter @web-three-city/simulation-core test
pnpm --filter @web-three-city/simulation-core typecheck
```
- [ ] **Step 5: Commit** with `feat(simulation): type game-minute authority`.

### Task 3: Add temporal architecture enforcement

**Files:**
- Create: `tooling/temporal-unit-boundary.test.mjs`
- Create: `tooling/architecture-fixtures/temporal-unit-violations/valid.ts`
- Create: `tooling/architecture-fixtures/temporal-unit-violations/operator.ts`
- Create: `tooling/architecture-fixtures/temporal-unit-violations/cast.ts`
- Modify: `package.json`

**Interfaces:**
- Produces a Node test included in `pnpm test:deployment` that parses TypeScript with the compiler API and rejects production-source patterns that bypass the named temporal API.

- [ ] **Step 1: Write scanner RED fixture tests** proving detection of incompatible branded arithmetic/comparison, direct `as AbsoluteGameMinute` / `as MacroHourIndex`, and `as unknown as <TemporalType>`; allow trusted constructor implementation and codec decode boundaries by explicit path allowlist.
- [ ] **Step 2: Run RED**:
```bash
node --test tooling/temporal-unit-boundary.test.mjs
```
Expected: FAIL until scanner rules exist.
- [ ] **Step 3: Implement scanner and add it to `test:deployment`**. The scanner must report file/line and stable violation category.
- [ ] **Step 4: Run GREEN**:
```bash
node --test tooling/temporal-unit-boundary.test.mjs tooling/architecture-boundary.test.mjs
pnpm test:deployment
```
- [ ] **Step 5: Commit** with `test(architecture): enforce temporal unit boundaries`.

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

- [ ] **Step 1: Add RED parity assertions** for minute `+1`, revision `+5`, phase order, rejection atomicity, and unchanged runtime pacing constants.
- [ ] **Step 2: Run RED/compile gate**:
```bash
pnpm --filter @web-three-city/game exec vitest run src/game-minute-transaction.test.ts src/temporal-publication.test.ts src/simulation-runtime.test.ts
```
- [ ] **Step 3: Replace raw simulation boundary arithmetic with named helpers**. Do not touch Building/RCI/Economy/Mobility/Traffic domain public fields yet; use explicit boundary adapters at the app seam.
- [ ] **Step 4: Run GREEN plus deployment architecture**:
```bash
pnpm --filter @web-three-city/game test
pnpm test:deployment
pnpm check
```
- [ ] **Step 5: Commit** with `refactor(game): adopt explicit temporal authority types`.

## T1 Exit Gate

T1 is complete only when simulation-core, Game affected tests, architecture tooling, and `pnpm check` are GREEN, current calendar values are unchanged, runtime still nominally uses `1000ms` base with `1/2/4` multipliers, WorldSaveV8 output is unchanged, and the tracked worktree is clean. Do not start calendar or domain semantic migration in this PR.