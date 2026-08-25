# Explicit Temporal Units and WorldSaveV9 — TDD Plan

> **For Luna Max:** Do not execute this plan during PR #83 Phase 1. Begin only after Phase 1 is merged or explicitly authorized on a dedicated successor branch.

**Goal:** Replace ambiguous temporal numbers with owned, explicit units and migrate durable saves to WorldSaveV9 without changing gameplay timing.

**Architecture:** `simulation-core` owns opaque absolute/duration types and conversions. Domains store the unit they mean; Save V9 encodes explicit field names plus a validated temporal-standard discriminator. Readers retain V1–V8 compatibility, while the writer emits V9 only.

**Tech stack:** TypeScript, Vitest compile fixtures, AST architecture checks, versioned JSON Save codecs.

## Frozen migration semantics

- `AbsoluteGameMinute` is canonical world time.
- Building, RCI, and Economy legacy `*Tick` values migrate to macro-hours `1:1`; never multiply by 60.
- Simulation V1/V2 hour-level ticks migrate to game minutes with checked multiplication by 60.
- Mobility and Traffic values retain their documented `1:1` units.
- Current calendar ratios and current playback pacing remain unchanged.
- Reader supports WorldSave V1–V9; writer emits V9 only.

## Task 1: Add temporal value types and owned operations

**Files:**

- Add: `packages/simulation-core/src/temporal-units.ts`
- Add: `packages/simulation-core/test/temporal-units.test.ts`
- Modify: `packages/simulation-core/src/index.ts`

1. RED tests cover constructors/decoders for safe non-negative integers and reject invalid numbers.
2. Implement opaque types:
   - `AbsoluteGameMinute`, `GameMinuteDuration`
   - `MacroHourIndex`, `MacroHourDuration`
   - `AbsoluteTransportSecond`, `TransportSecondDuration`
3. Implement owned operations: derivation, checked addition, reached comparisons, and serialization accessors. Domain packages must not construct brands by cast.
4. Keep calendar derivation behavior unchanged.

## Task 2: Enforce temporal architecture

**Files:**

- Add or modify the repository architecture test under `tooling/` that owns source-policy checks
- Add invalid/valid compile fixtures under that test's existing fixture convention
- Modify: `AGENTS.md` Static Level 2 Verification Map when dependencies change

1. RED fixtures demonstrate illegal cross-unit arithmetic/comparison and raw casts (`as`, `as unknown as`) outside `simulation-core`.
2. Implement a type-aware AST check; text matching alone is insufficient for relational operators.
3. Permit decoding only through exported constructors and permit representation access only through explicit serializer helpers.
4. Verify package dependencies remain acyclic: domain packages may depend on `simulation-core`; `simulation-core` may not import them.

## Task 3: Migrate Building lifecycle contracts

**Files:**

- Modify: `packages/building-core/src/contracts.ts`
- Modify: `packages/building-core/src/building-lifecycle.ts`
- Modify: `packages/building-core/src/building-growth.ts`
- Modify owning tests and all compiler-reported consumers

1. Rename persisted runtime fields to `constructionStartedAtMacroHourIndex`, `constructionCompletesAtMacroHourIndex`, and `activatedAtMacroHourIndex`.
2. Rename duration contracts to `constructionDurationMacroHours`.
3. Make lifecycle APIs accept `MacroHourIndex`/`MacroHourDuration` only.
4. Preserve exact lifecycle behavior and deterministic ordering.

## Task 4: Migrate RCI and Economy contracts

**Files:**

- Modify owning contracts/codecs in `packages/rci-core/**`
- Modify owning contracts/codecs in `packages/economy-core/**`
- Modify all compiler-reported consumers and tests

1. Rename `*AtTick` to `*AtMacroHourIndex` and `*Ticks` to `*MacroHours` where the existing semantics are macro-hour.
2. Replace raw arithmetic/comparison with temporal operations.
3. Add golden tests proving old numeric values map `1:1`.

## Task 5: Migrate Mobility and Traffic contracts

**Files:**

- Modify owning contracts/codecs in `packages/citizen-mobility-core/**`
- Modify owning contracts/codecs in `packages/traffic-core/**`
- Modify Game composition and tests

1. Assign `AbsoluteGameMinute` to world schedules and `AbsoluteTransportSecond`/duration to transport progression.
2. Preserve four Traffic quanta per committed GameMinute and all movement semantics.
3. Add compile-time failures for accidental cross-unit use.

## Task 6: Introduce versioned subsystem saves and WorldSaveV9

**Files:**

- Modify: `apps/game/src/world-save.ts`
- Modify: `apps/game/src/world-save-legacy.ts`
- Add: `apps/game/src/world-save-v9.test.ts`
- Add/modify subsystem Save codec files and tests in their owning packages

1. RED golden tests cover V1–V8 reads, V9 round-trip, construction-in-progress continuation, and same-number/different-unit rejection.
2. Introduce:
   - `SimulationSaveV4`
   - `BuildingSaveV3`
   - `RciSaveV2`
   - `EconomySaveV2`
   - `MobilitySaveV3`
   - `TrafficSaveV3`
   - `WorldSaveV9`
3. Use explicit field names and one envelope temporal-standard discriminator. Do not wrap every high-cardinality timestamp in `{ value, unit }`.
4. Route all decoded values through owned temporal constructors. Raw casts are forbidden.
5. Writer emits V9 only; readers keep V1–V9.

## Task 7: Documentation, topology, and verification

**Files:**

- Modify affected `docs/systems/*/README.md`
- Modify relevant Save/temporal verification records
- Modify dependency topology contracts and `AGENTS.md` map if package edges changed

Run owner tests, every Static Level 2 consumer, Save continuation/migration suites, targeted `@building|@rci|@traffic`, then:

```bash
pnpm test:deployment
pnpm verify
pnpm verify:full
git diff --check
```

This is a Save/public-contract migration and release boundary, so Level 3 and Level 4 closure are required. Record exact-head CI and Sonar; do not merge without separate authorization.
