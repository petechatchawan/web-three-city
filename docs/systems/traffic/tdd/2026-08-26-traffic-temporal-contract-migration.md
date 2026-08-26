# Traffic Temporal Contract Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Traffic transport time explicit, centralize GameMinute-to-transport conversion, and preserve four-quanta physical/transaction semantics exactly.

**Architecture:** `traffic-core` gains a one-way dependency on `simulation-core` for `AbsoluteGameMinute`. Traffic owns `AbsoluteTransportSecond`/`TransportSecondDuration` and the conversion policy `4 transport seconds/quanta per GameMinute`. Game orchestration keeps five authority phases and only uses Traffic's named conversion/cursor APIs.

**Tech Stack:** TypeScript 6, Vitest 4, pnpm.

**Spec:** `docs/systems/simulation-time/specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md`

## Global Constraints

- Four transport quanta per GameMinute remain unchanged.
- No route, lane, intersection, headway, entry/leave, acceleration, cap, rendering, or Road behavior change belongs in this slice.
- Remove raw `gameMinute * 4` and legacy `arrivedAtGameSecond * 4` from production consumers.
- Traffic V2 payload remains supported until T5; new writer version waits for T5.

---

### Task 1: Add Traffic transport temporal contracts

**Files:**
- Modify: `packages/traffic-core/package.json`
- Create: `packages/traffic-core/src/transport-time.ts`
- Modify: `packages/traffic-core/src/contracts.ts`
- Modify: `packages/traffic-core/src/index.ts`
- Test: `packages/traffic-core/test/transport-time.test.ts`

**Interfaces:**
```ts
export type AbsoluteTransportSecond = number & { readonly __absoluteTransportSecond: unique symbol };
export type TransportSecondDuration = number & { readonly __transportSecondDuration: unique symbol };
export const TRANSPORT_QUANTA_PER_GAME_MINUTE = 4 as const;
export function absoluteTransportSecond(value: number): AbsoluteTransportSecond;
export function transportSecondDuration(value: number): TransportSecondDuration;
export function transportSecondAtGameMinute(minute: AbsoluteGameMinute): AbsoluteTransportSecond;
export function addTransportSeconds(point: AbsoluteTransportSecond, duration: TransportSecondDuration): AbsoluteTransportSecond;
```

- [ ] **Step 1: RED tests** for safe integer constructors, `minute 0 -> second 0`, `minute 1 -> second 4`, overflow rejection, and same-unit arithmetic.
- [ ] **Step 2: Run**:
```bash
pnpm --filter @web-three-city/traffic-core exec vitest run test/transport-time.test.ts
```
Expected: FAIL until module exists.
- [ ] **Step 3: Implement contracts and dependency**. Do not expose mutable objects or raw casts.
- [ ] **Step 4: Run Traffic test/typecheck + architecture deployment tests**.
- [ ] **Step 5: Commit** with `feat(traffic): add explicit transport time`.

### Task 2: Type Traffic V2 cursor and queued movement

**Files:**
- Modify: `packages/traffic-core/src/contracts.ts`
- Modify: Traffic snapshot/lifecycle files identified by `rg "absoluteTransportSecond|arrivedAtTransportSecond|sourceGameMinute" packages/traffic-core/src`
- Tests: Traffic snapshot/lifecycle/drive tests.

**Interfaces:**
```ts
timeCursor.sourceGameMinute: AbsoluteGameMinute;
timeCursor.absoluteTransportSecond: AbsoluteTransportSecond;
queuedMovement.arrivedAtTransportSecond: AbsoluteTransportSecond;
```

- [ ] **Step 1: Change tests first to typed cursor fields and run typecheck RED**.
- [ ] **Step 2: Migrate runtime comparisons/arithmetic through named helpers**.
- [ ] **Step 3: Prove route progress and junction arbitration receipts are byte/value-equivalent for identical snapshots**.
- [ ] **Step 4: Run `pnpm --filter @web-three-city/traffic-core test` and typecheck**.
- [ ] **Step 5: Commit** with `refactor(traffic): type transport cursor`.

### Task 3: Isolate legacy Traffic codec conversion

**Files:**
- Modify: `packages/traffic-core/src/persistence.ts`
- Tests: Traffic persistence/migration tests.

**Interfaces:**
- Traffic V2 transport-second values map 1:1 to typed runtime values.
- Legacy V1 game-second/older fields use one checked migration helper, not open-coded multiplication at callers.

- [ ] **Step 1: RED tests** for V1->V2/V3-compatible conversion, overflow rejection, and 1:1 V2 transport-second continuation.
- [ ] **Step 2: Implement codec helpers** with trusted constructors.
- [ ] **Step 3: Verify current V2 writer payload remains compatible until T5**.
- [ ] **Step 4: Commit** with `refactor(traffic): isolate temporal codec migration`.

### Task 4: Cut Game Traffic orchestration to named transport-time APIs

**Files:**
- Modify: `apps/game/src/game-minute-transaction.ts`
- Modify: `apps/game/src/traffic-transport-transaction.ts`
- Modify: `apps/game/src/temporal-publication-controller.ts`
- Modify: `apps/game/src/mobility-traffic-tick.ts`
- Test: `apps/game/src/traffic-transport-transaction.test.ts`
- Test: `apps/game/src/temporal-publication.test.ts`
- Test: `apps/game/src/traffic-authoritative-short-trip.test.ts`

- [ ] **Step 1: RED tests** lock the per-minute sequence: source minute `M+1`, transport cursor starts at `(M+1)*4`, then Q1..Q4 advance deterministically according to the existing transaction model; final world revision remains `+5`.
- [ ] **Step 2: Replace all raw conversion formulas with Traffic APIs**.
- [ ] **Step 3: Run focused GREEN**:
```bash
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/game exec vitest run src/traffic-transport-transaction.test.ts src/temporal-publication.test.ts src/traffic-authoritative-short-trip.test.ts
```
- [ ] **Step 4: Run `pnpm check`**.
- [ ] **Step 5: Commit** with `refactor(game): adopt traffic transport time contracts`.

### Task 5: Prove physical and persistence parity

**Files:**
- Test: existing `packages/traffic-core/test/` drive/intersection/headway suites.
- Test: `apps/game/src/mobility-traffic-save-continuation.test.ts`
- Browser: existing `@traffic` targeted suite.

- [ ] **Step 1: Run Traffic core full suite** and compare counts/results to pre-slice evidence.
- [ ] **Step 2: Run save/load continuation** at `N:59 -> N+1:00` with active Walk and Drive trips.
- [ ] **Step 3: Run targeted Chromium `@traffic`** only after unit/Game GREEN.
- [ ] **Step 4: Run `git diff --check` and clean-worktree verification**.

## Exit Gate

Traffic temporal types are explicit, all raw conversion arithmetic is centralized, and physical behavior/route/junction/headway outcomes are unchanged for identical authority state. Four quanta per GameMinute and five-phase world publication are unchanged.