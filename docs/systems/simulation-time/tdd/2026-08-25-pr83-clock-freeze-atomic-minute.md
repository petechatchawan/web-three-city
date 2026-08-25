# PR #83 Clock Freeze and Atomic Temporal Minute — TDD Plan

> **For Luna Max:** Execute this plan with `superpowers:test-driven-development` and `superpowers:verification-before-completion`. Stop after this phase; do not begin the temporal-unit or calendar migrations.

**Goal:** Remove the Growth boundary freeze and make one externally requested GameMinute an all-or-nothing five-phase transaction.

**Architecture:** Building lifecycle decisions remain owned by `building-core` and use macro-hour semantics. The Game temporal controller plans and validates GameMinute plus Q1–Q4 against an isolated candidate chain, then installs all five prepared worlds synchronously. A rejection leaves the original committed world untouched, pauses playback, clears accumulated elapsed time, and exposes one typed failure without automatic retry.

**Tech stack:** TypeScript, Vitest, Playwright, Three.js application composition, pnpm workspace.

**Implementation baseline:** Luna must begin from the documentation checkpoint containing the approved temporal spec and ADRs. Before editing, record `git status --short --branch`, `git rev-parse HEAD`, and the PR branch remote SHA. Preserve the two user-owned untracked plans named in the execution index.

## Scope boundaries

This phase changes no Save schema, calendar ratio, playback rate, Traffic authority, Growth policy, or rendering policy. Automatic Growth stays enabled. Current field names containing `Tick` remain serialized as they are; the implementation makes their existing macro-hour meaning explicit at call sites and in lifecycle APIs. Phase 2 owns durable renaming and branded types.

## Task 1: Reproduce the Growth boundary rejection

**Files:**

- Modify: `apps/game/src/application/world-transaction-coordinator.test.ts`
- Modify: `apps/game/src/game-minute-transaction.test.ts`
- Modify: `apps/game/src/temporal-publication.test.ts`

1. Add a deterministic candidate at `11:59` with a valid eligible Zone and Automatic Growth enabled. Assert that the planned Growth building has macro-hour lifecycle values and that the coordinator accepts the resulting world at `12:00`.
2. Add the equivalent `23:59 → 00:00` case. Assert minute `+1`, world revision `+5`, one Growth increment, and a valid construction building.
3. Add a root-cause test that passes the new construction instance to the lifecycle validity decision using `deriveMacroHourIndex(afterAbsoluteGameMinute)`. Assert it is not considered overdue at its start boundary.
4. Run RED:

```bash
pnpm --filter @web-three-city/game exec vitest run \
  src/application/world-transaction-coordinator.test.ts \
  src/game-minute-transaction.test.ts \
  src/temporal-publication.test.ts
```

Expected RED: the candidate is rejected or the minute remains unchanged because world validation compares a macro-hour completion index with an absolute game-minute value. Import, fixture, or type errors are not valid RED.

## Task 2: Centralize Building lifecycle time semantics

**Files:**

- Modify: `packages/building-core/src/building-lifecycle.ts`
- Modify: `packages/building-core/src/index.ts`
- Modify: `packages/building-core/test/building-lifecycle.test.ts`
- Modify: `packages/building-three/src/building-presentation.ts`
- Modify: `packages/building-three/test/building-presentation.test.ts`
- Modify: `apps/game/src/main.ts`
- Modify: `apps/game/src/application/world-transaction-coordinator.ts`
- Modify: `apps/game/src/world-save-legacy.ts`
- Modify: `apps/game/src/world-save-building-migration.test.ts`
- Modify the nearest affected tests for `main.ts` and the coordinator

1. Add RED lifecycle tests for named macro-hour operations:
   - `isBuildingConstructionCompleteAtMacroHour(instance, macroHourIndex)` is false before completion and true at completion.
   - `constructionProgressAtMacroHour(instance, macroHourIndex)` returns deterministic clamped progress.
   - invalid or negative macro-hour input rejects.
2. Implement those APIs in `building-core`. Keep the old `constructionProgressAtTick` only as a deprecated compatibility alias if removing it would broaden Phase 1; all production consumers changed in this phase must use the macro-hour-named API.
3. Replace direct lifecycle comparison in `validBuildingInstance` with the `building-core` completion API and pass `deriveMacroHourIndex(world.simulation.absoluteGameMinute)`.
4. In `main.ts`, derive the macro-hour once before calculating construction phases. Change `building-three` parameter names and tests so presentation receives a macro-hour index, never an absolute game minute.
5. In `world-save-legacy.ts`, derive macro-hour before validating a legacy construction lifecycle. Do not change serialized values or schema versions.
6. Run GREEN:

```bash
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/building-core typecheck
pnpm --filter @web-three-city/building-three test
pnpm --filter @web-three-city/building-three typecheck
pnpm --filter @web-three-city/game exec vitest run \
  src/application/world-transaction-coordinator.test.ts \
  src/game-minute-transaction.test.ts \
  src/world-save-building-migration.test.ts
```

Expected GREEN: lifecycle semantics are owned by `building-core`; no application or presentation code compares raw lifecycle timestamps.

## Task 3: Introduce a typed temporal advance result

**Files:**

- Modify: `apps/game/src/temporal-publication-controller.ts`
- Modify: `apps/game/src/temporal-publication.test.ts`
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `apps/game/src/game-runtime-authority.test.ts`

1. Add RED tests for a discriminated result:

```ts
type TemporalPhase = 'game-minute' | 'quantum-1' | 'quantum-2' | 'quantum-3' | 'quantum-4';

type TemporalAdvanceResult =
  | {
      readonly status: 'committed';
      readonly beforeGameMinute: number;
      readonly afterGameMinute: number;
      readonly beforeRevision: number;
      readonly afterRevision: number;
      readonly phaseReceipts: readonly [
        TemporalPhaseReceipt,
        TemporalPhaseReceipt,
        TemporalPhaseReceipt,
        TemporalPhaseReceipt,
        TemporalPhaseReceipt,
      ];
      readonly world: CommittedWorld;
    }
  | {
      readonly status: 'rejected';
      readonly phase: TemporalPhase;
      readonly reason: WorldPublicationRejection | 'traffic:unsupported-schema';
      readonly beforeGameMinute: number;
      readonly beforeRevision: number;
      readonly world: CommittedWorld;
    };
```

2. Assert success has exactly five ordered receipts, minute `+1`, revision `+5`, and the final world.
3. Inject rejection separately at GameMinute and each Q phase. Assert the phase and typed reason are preserved rather than collapsed to `world:invalid-candidate`.
4. Change `advanceTemporalMinute` to return `TemporalAdvanceResult`. Keep public single-phase `advanceGameMinute` and `advanceTransportQuantum` behavior stable unless the compiler requires a typed wrapper; they are debug/parity seams, not the production cadence path.
5. Update `game-bootstrap` to expose the typed result. Do not add a public mutable world seam.
6. Run the focused tests and keep them RED until the result contract exists, then GREEN.

## Task 4: Prepare all five worlds before committing any

**Files:**

- Modify: `apps/game/src/application/committed-world.ts`
- Modify: `apps/game/src/application/committed-world.test.ts`
- Modify: `apps/game/src/application/world-transaction-coordinator.ts`
- Modify: `apps/game/src/application/world-transaction-coordinator.test.ts`
- Modify: `apps/game/src/temporal-publication-controller.ts`
- Modify: `apps/game/src/temporal-publication.test.ts`

1. Add RED store tests for a narrow internal batch operation, for example:

```ts
replacePreparedBatch(expectedRevision, candidates);
```

The exact name may follow local conventions, but its contract is fixed:

- candidates contain revisions `R+1` through `R+5` in order;
- stale base, missing revision, duplicate revision, or invalid ordering throws before mutation;
- validation completes for every candidate before installation;
- installation is synchronous and has no callback, promise, presentation, or notification seam;
- success leaves the store at `R+5`.

2. Add RED controller tests with injected Q2/Q3/Q4 invalid plans. Assert the store remains at the original identity/revision/minute and no presentation or subscriber callback occurs.
3. Refactor planning so each phase consumes the prior prepared candidate without writing the live store. Reuse existing plan, fingerprint, candidate preparation, and validation logic; do not weaken fingerprints or validation.
4. Expose the smallest coordinator-owned prepare/validate operation needed by the controller. Do not expose `committedForTransaction()` publicly and do not give presentation code candidate access.
5. After all five prepared candidates validate, call the synchronous store batch install once. Preserve the five distinct candidate revisions and phase receipts; do not collapse authority into one revision.
6. Synchronize final presentation once and notify the committed-world subscriber once. Dynamic-only static sync remains `0`; Growth static sync is at most `1`. Keep legacy-per-commit parity mode unchanged in tests.
7. Run:

```bash
pnpm --filter @web-three-city/game exec vitest run \
  src/application/committed-world.test.ts \
  src/application/world-transaction-coordinator.test.ts \
  src/temporal-publication.test.ts
```

Expected GREEN includes rejection at every phase with original world unchanged and the existing cadence matrix `5 / +5 / 1 / 0-or-1 / 1`.

## Task 5: Fail-stop playback without silent retry

**Files:**

- Modify: `apps/game/src/simulation-runtime.ts`
- Modify: `apps/game/src/simulation-runtime.test.ts`
- Modify: `apps/game/src/main.ts`
- Modify: `apps/game/src/ui/city-ui-runtime.ts`
- Modify the nearest UI projection/controller tests

1. Add RED tests proving a rejected temporal minute:
   - sets runtime state to `{ kind: 'paused-world-rejected', failure }`;
   - clears accumulated elapsed time;
   - invokes no later minute on subsequent frames;
   - reports/logs the same failure once;
   - requires explicit resume, manual step, or world-changing action before another attempt.
2. Change the runtime event callback contract so `advanceRuntimeEvent` can report rejection. Do not infer success from a returned world whose minute did not change.
3. Present a concise UI message: `Simulation paused: world update rejected`. Keep the typed failure available to test/debug seams; do not expose internal mutable world state.
4. Make `step()` return true only for exact minute `+1`, revision `+5`, and five committed receipts.
5. Make `stepMinutes(n)` atomic per minute. It stops on first rejection and reports `committedMinutes`, `rejectedAtGameMinute`, `phase`, and `reason`; already committed prior minutes remain committed.
6. Run owner tests:

```bash
pnpm --filter @web-three-city/game exec vitest run \
  src/simulation-runtime.test.ts \
  src/game-runtime-authority.test.ts \
  src/temporal-publication.test.ts
```

## Task 6: Browser regression at the reported boundaries

**Files:**

- Modify: `browser-tests/helpers/growth-fixture.ts`
- Modify: `browser-tests/growth.@building.spec.ts`
- Modify only if needed: a focused interaction spec covering speed controls

1. Add browser tests that prepare a valid Zone/Growth world at `11:59` and `23:59` without bypassing production composition.
2. For each boundary assert:
   - the displayed minute crosses the boundary;
   - `growthSequence` increments when the deterministic fixture is eligible;
   - a construction building exists;
   - the world revision changes by exactly `+5` per minute;
   - the UI leaves `Applying change`;
   - x1, x2, and x4 continue across later hour boundaries.
3. Add an injected rejection test through an existing test seam only if it can remain deterministic and production-safe. Assert playback pauses and no retry occurs.
4. Run targeted Chromium:

```bash
pnpm exec playwright test browser-tests/growth.@building.spec.ts --project=chromium --workers=1
pnpm exec playwright test --grep '@building|@rci|@traffic|@interaction' --project=chromium --workers=1
```

The second command is affected-browser evidence, not Full Browser.

## Task 7: Living documentation and final verification

**Files:**

- Modify: `docs/systems/simulation-time/README.md`
- Modify: `docs/systems/buildings/README.md`
- Modify: `docs/systems/world/README.md`
- Modify: `docs/systems/traffic/README.md`
- Modify relevant PR #83 verification record under `docs/systems/*/verification/`

1. Update living docs to describe the implemented Phase 1 contract only. Keep Phase 2/3 labeled deferred and link their ADRs/plans.
2. Record exact commands and counts in the verification record before the exact-head run; record run IDs in the PR body/comment, not a post-verification metadata commit.
3. Run Level 1 and Level 2 in owner-first order:

```bash
pnpm --filter @web-three-city/simulation-core test
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/building-three test
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/economy-core test
pnpm --filter @web-three-city/citizen-mobility-core test
pnpm --filter @web-three-city/traffic-core test
pnpm --filter @web-three-city/game test

pnpm --filter @web-three-city/simulation-core typecheck
pnpm --filter @web-three-city/building-core typecheck
pnpm --filter @web-three-city/building-three typecheck
pnpm --filter @web-three-city/rci-core typecheck
pnpm --filter @web-three-city/economy-core typecheck
pnpm --filter @web-three-city/citizen-mobility-core typecheck
pnpm --filter @web-three-city/traffic-core typecheck
pnpm --filter @web-three-city/game typecheck
```

4. Because this is PR #83 release closure and changes application-wide time behavior, run:

```bash
pnpm test:deployment
pnpm verify
pnpm verify:full
git diff --check
```

5. Review the full diff for authority, Save, and presentation leakage. Commit and non-force push only a GREEN exact candidate. Verify exact-head Lean CI, Full Browser if triggered, clean-worktree, and Sonar. Leave PR #83 Draft and unmerged; Owner Visual remains required.

## Phase 1 completion criteria

- Valid Growth crosses `11:59 → 12:00` and `23:59 → 00:00`.
- One minute commits five ordered authority revisions or none.
- Rejection leaves minute, revision, and visible world unchanged.
- Rejection pauses playback, clears accumulated time, and does not retry silently.
- Dynamic/Growth publication cadence remains `5 commits / +5 revisions / 1 final flush / 0-or-1 static sync / 1 notification`.
- Current Save schema, calendar, and pacing remain unchanged.
- Targeted browser, `pnpm verify`, and release-triggered `pnpm verify:full` are GREEN at the exact source SHA.
