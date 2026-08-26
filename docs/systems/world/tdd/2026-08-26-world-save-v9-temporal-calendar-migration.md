# WorldSaveV9 Temporal + Calendar Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce WorldSaveV9 as the sole writer with explicit temporal/calendar policy discriminators while preserving V1–V8 readability, canonical `AbsoluteGameMinute` continuity, and domain-specific temporal migration semantics.

**Architecture:** V9 composes new domain codecs and identifies temporal/calendar interpretation once at the world envelope. Raw historical fields are decoded only at codec boundaries. Canonical world time migrates 1:1; domain fields follow proven field-class rules, including explicit RCI age-origin rescaling so citizen age does not jump at cutover.

**Tech Stack:** TypeScript 6, Vitest 4, pnpm, browser Save/load fixtures.

**Spec:** `docs/systems/simulation-time/specs/2026-08-26-temporal-authority-simulation-clock-standard-v1.md`

## Global Constraints

- Reader accepts V1–V9; writer emits V9 only after this slice.
- `temporalStandardVersion = 1`, `calendarPolicyVersion = 1` are mandatory V9 envelope discriminators.
- Unknown discriminator values reject the entire Save.
- V8 `AbsoluteGameMinute` migrates 1:1; legacy Simulation V1/V2 hour ticks use checked `*60`.
- Building legacy macro-hour fields are 1:1.
- RCI/Economy fields follow their classification/golden rules; RCI `bornAtTick`/other age-origin fields use the approved age-preserving migration, not blanket 1:1.
- Mobility GameMinute fields and Traffic V2 transport seconds migrate 1:1.
- No per-record `{value, unit}` wrapper allocation.

---

### Task 1: Freeze golden legacy fixtures before writer changes

**Files:**
- Create: `apps/game/test/fixtures/world-save-v1-golden.json` through representative V8 fixture files, or use existing fixture convention if JSON fixtures already exist.
- Test: `apps/game/src/world-save.test.ts`
- Test: `apps/game/src/world-save-v8.test.ts`
- Test: existing per-domain migration tests.

**Interfaces:** Golden fixtures cover: pre-minute Simulation save, Building construction-in-progress, populated RCI age/history, Economy settlement cursor, planned/active Mobility trips, active Traffic V2 cursor.

- [ ] **Step 1: Add fixture-driven characterization tests** asserting current decode results for each historical schema.
- [ ] **Step 2: Run current tests** and capture GREEN baseline before V9 production edits.
- [ ] **Step 3: Add explicit field-semantic expectations** rather than snapshot-only blobs so migrations are reviewable.
- [ ] **Step 4: Commit** with `test(world): freeze temporal migration fixtures`.

### Task 2: Add domain codec versions used by V9

**Files:**
- Modify/create Simulation serialization for `SimulationSaveV4`.
- Modify/create Building serialization for `BuildingSaveV3`.
- Modify/create RCI persistence for `RciSaveV2`.
- Modify/create Economy serialization for `EconomySaveV2`.
- Modify/create Mobility persistence for `MobilitySaveV3`.
- Modify/create Traffic persistence for `TrafficSaveV3`.
- Tests in each owning package.

**Interfaces:** New codecs expose semantically explicit field names and integer values. Decoders return typed runtime points/durations.

- [ ] **Step 1: For each package, write RED codec schema tests first** asserting new field names, required integer validation, no ambiguous Tick fields in new writer output, and roundtrip equality.
- [ ] **Step 2: Implement the smallest new codec version in the owner package**; do not embed cross-domain migration logic in the world envelope.
- [ ] **Step 3: Run owner package tests/typecheck before moving to the next package**.
- [ ] **Step 4: Commit per owner package** so each codec can be independently reviewed.

### Task 3: Implement V8 -> V9 authority-continuity migration

**Files:**
- Modify: `apps/game/src/world-save.ts`
- Test: `apps/game/src/world-save-v8.test.ts`
- Test: `apps/game/src/world-save-rci-migration.test.ts`
- Test: `apps/game/src/world-save-economy-migration.test.ts`
- Test: `apps/game/src/world-save-building-migration.test.ts`

**Interfaces:**
```ts
interface WorldSaveV9 {
  readonly kind: 'world-save';
  readonly schemaVersion: 9;
  readonly temporalStandardVersion: 1;
  readonly calendarPolicyVersion: 1;
  // explicit domain save payloads
}
```
Migration contract:
```text
world AbsoluteGameMinute: 1:1
Building macro-hour points/durations: 1:1
Economy macro-hour settlement state: 1:1
Mobility GameMinute: 1:1
Traffic transport second: 1:1
RCI age-origin: checked legacy-year -> compressed-year rescale relative to current macro hour
RCI event/history/cycle fields: classification-driven rule
```

- [ ] **Step 1: RED tests** assert V8 current minute is numerically identical after decode, calendar label is reprojected under V9 policy, and a 1-year/18-year/65-year legacy citizen keeps the same age band after migration.
- [ ] **Step 2: Add RED ordering/determinism tests** for RCI relationships/events after age-origin migration.
- [ ] **Step 3: Implement V9 composition and domain migration calls**. World codec orchestrates; owner packages perform domain-specific conversion.
- [ ] **Step 4: Run all migration tests and `pnpm --filter @web-three-city/game typecheck`**.
- [ ] **Step 5: Commit** with `feat(world): migrate legacy saves to WorldSaveV9`.

### Task 4: Switch canonical writer/read key to V9

**Files:**
- Modify: `apps/game/src/application/save-coordinator.ts`
- Modify: `apps/game/src/world-save.ts`
- Test: `apps/game/src/application/save-coordinator.test.ts`
- Test: `apps/game/src/world-save.test.ts`

**Interfaces:**
```ts
export const WORLD_SAVE_KEY = 'web-three-city:world-save:v9';
```
Read order starts with V9 and retains V8..V1/terrain legacy keys.

- [ ] **Step 1: RED tests** assert save writes only V9 key/schema and load still finds V8/V7/etc fallback.
- [ ] **Step 2: Change writer to `encodeWorldSaveV9` and update read key list**.
- [ ] **Step 3: Verify invalid V9 discriminators reject without mutating current world**.
- [ ] **Step 4: Commit** with `feat(world): make WorldSaveV9 canonical writer`.

### Task 5: Continuation equivalence across save/load

**Files:**
- Test: `apps/game/src/mobility-traffic-save-continuation.test.ts`
- Test: `apps/game/src/economy-save-continuation.test.ts`
- Create/modify: `apps/game/src/world-save-v9.test.ts`

- [ ] **Step 1: RED tests** save at `N:59`, load, advance `N+1:00`, and compare uninterrupted vs resumed world for Simulation, Buildings, RCI, Economy, Mobility, Traffic and final revision semantics.
- [ ] **Step 2: Add construction-in-progress and active-traffic continuation cases**.
- [ ] **Step 3: GREEN all Game save/migration suites**.
- [ ] **Step 4: Run**:
```bash
pnpm --filter @web-three-city/game test
pnpm test:deployment
pnpm check
```
- [ ] **Step 5: Commit** with `test(world): verify WorldSaveV9 continuation`.

### Task 6: Browser Save/load evidence

**Files:**
- Update existing Save/load browser spec/fixture under `browser-tests/` and `apps/game/src/browser-world-save-fixture.ts`.

- [ ] **Step 1: Build once** with `pnpm build:browser`.
- [ ] **Step 2: Run targeted Save/load Chromium evidence** for fresh V9, migrated V8, calendar rollover after load, and active traffic/constructing building case.
- [ ] **Step 3: Run `git diff --check` and clean-worktree verification**.

## Exit Gate

The canonical writer is V9; V1–V8 remain readable; old cities preserve canonical timeline, Building/Economy/Mobility/Traffic continuation, and citizen age semantics while displaying the newly approved compressed calendar. No V9 field uses ambiguous Tick naming.