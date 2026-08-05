# Simulation Clock & Building Growth Core v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a framework-independent in-game calendar and deterministic one-building-at-a-time Growth lifecycle without browser or Three.js dependencies.

**Architecture:** A new `simulation-core` package owns absolute logical time, calendar derivation, immutable snapshots, tick plans, and serialization. `building-core` extends Building authority with Construction and Active lifecycle states and provides a pure Growth planner that consumes a Simulation snapshot plus the existing placement environment. Runtime accumulation and UI remain outside this PR.

**Tech Stack:** TypeScript 6, Vitest 4, pnpm workspaces, immutable frozen records, existing `world-core`, `terrain-core`, `zone-core`, and `building-core` contracts.

## Global Constraints

- One logical tick equals one in-game hour.
- Calendar is exactly 24 hours/day, 30 days/month, and 12 months/year.
- Initial time is Year 1 / Month 1 / Day 1 / 08:00, represented by absolute tick `8`.
- Evaluation hours are exactly `0`, `6`, `12`, and `18`.
- At most one Building starts Construction per evaluation tick.
- Construction duration is exactly `24 × footprint area` unless the Definition declares the same canonical value explicitly.
- Core packages must not import browser APIs or Three.js.
- Tests are authored before implementation, but by Owner instruction all tests are executed only after all three implementation PRs have been written.

---

## File map

### Create

- `packages/simulation-core/package.json` — workspace package metadata and scripts.
- `packages/simulation-core/tsconfig.json` — package typecheck configuration.
- `packages/simulation-core/tsconfig.build.json` — declaration/build configuration.
- `packages/simulation-core/vitest.config.ts` — deterministic Node test environment.
- `packages/simulation-core/src/contracts.ts` — Simulation snapshot, calendar, plan, receipt, speed, and error contracts.
- `packages/simulation-core/src/calendar.ts` — absolute-tick validation and calendar derivation.
- `packages/simulation-core/src/simulation-snapshot.ts` — immutable snapshot creation and initial state.
- `packages/simulation-core/src/simulation-mutation.ts` — one-tick immutable plan/commit.
- `packages/simulation-core/src/serialization.ts` — `SimulationSaveV1` encode/decode.
- `packages/simulation-core/src/index.ts` — public exports.
- `packages/simulation-core/test/calendar.test.ts`
- `packages/simulation-core/test/simulation-snapshot.test.ts`
- `packages/simulation-core/test/simulation-mutation.test.ts`
- `packages/simulation-core/test/serialization.test.ts`
- `packages/building-core/src/building-lifecycle.ts` — lifecycle validation, counts, progress, completion conversion.
- `packages/building-core/src/building-growth.ts` — deterministic Growth plan and commit.
- `packages/building-core/test/building-lifecycle.test.ts`
- `packages/building-core/test/building-growth.test.ts`

### Modify

- `packages/building-core/package.json` — add `simulation-core` workspace dependency.
- `packages/building-core/src/contracts.ts` — add Definition duration/weight metadata, lifecycle union, and Growth contracts.
- `packages/building-core/src/building-definitions.ts` — add canonical duration and initial weights to the six existing Definitions.
- `packages/building-core/src/building-snapshot.ts` — copy and validate lifecycle authority.
- `packages/building-core/src/building-mutation.ts` — explicit development creates Active instances at initial tick without changing legacy command behavior.
- `packages/building-core/src/serialization.ts` — retain V1 compatibility and add lifecycle-aware V2 contracts without cutting over WorldSave yet.
- `packages/building-core/src/index.ts` — export lifecycle and Growth modules.
- `packages/building-core/test/building-definitions.test.ts` — validate duration and weight.
- `packages/building-core/test/building-snapshot.test.ts` — validate lifecycle authority.
- `packages/building-core/test/serialization.test.ts` — V1 migration and V2 round trip.
- `pnpm-lock.yaml` — add workspace importers.

---

### Task 1: Create `simulation-core` contracts and calendar tests

**Interfaces:**

```ts
export type SimulationSpeed = 'paused' | 'normal' | 'fast' | 'faster';

export interface SimulationSnapshot {
  readonly revision: number;
  readonly absoluteTick: number;
  readonly growthSequence: number;
}

export interface GameCalendar {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
}

export const INITIAL_ABSOLUTE_TICK = 8;
export const DEVELOPMENT_EVALUATION_HOURS = Object.freeze([0, 6, 12, 18] as const);

export function deriveGameCalendar(absoluteTick: number): GameCalendar;
export function isDevelopmentEvaluationTick(absoluteTick: number): boolean;
```

- [ ] **Step 1: Author failing calendar tests** covering initial `Y1 M1 D1 08:00`, day/month/year boundaries, negative/non-integer rejection, and evaluation hours.
- [ ] **Step 2: Create package scaffolding and public contracts.**
- [ ] **Step 3: Implement `deriveGameCalendar` using integer division and modulo only.**
- [ ] **Step 4: Implement `isDevelopmentEvaluationTick` from the derived hour.**
- [ ] **Step 5: Record expected test command without executing it:** `pnpm --filter @web-three-city/simulation-core test -- calendar.test.ts`.

### Task 2: Add immutable Simulation snapshots and tick mutation

**Interfaces:**

```ts
export interface SimulationTickPlan {
  readonly baseRevision: number;
  readonly beforeAbsoluteTick: number;
  readonly afterAbsoluteTick: number;
  readonly valid: boolean;
  readonly invalidReason: 'simulation:invalid-state' | 'simulation:tick-overflow' | null;
}

export interface SimulationTickReceipt {
  readonly beforeRevision: number;
  readonly afterRevision: number;
  readonly beforeAbsoluteTick: number;
  readonly afterAbsoluteTick: number;
}

export function createSimulationSnapshot(input: SimulationSnapshot): SimulationSnapshot;
export function createInitialSimulationSnapshot(): SimulationSnapshot;
export function planSimulationTick(snapshot: SimulationSnapshot): SimulationTickPlan;
export function commitSimulationTick(snapshot: SimulationSnapshot, plan: SimulationTickPlan): {
  readonly snapshot: SimulationSnapshot;
  readonly receipt: SimulationTickReceipt;
};
```

- [ ] **Step 1: Author tests** for defensive freezing, invalid revisions/ticks/sequences, exactly-one-tick advancement, stale-plan rejection, and safe-integer overflow.
- [ ] **Step 2: Implement snapshot validation** requiring safe non-negative integer fields.
- [ ] **Step 3: Implement immutable plan/commit** with revision fencing and `afterAbsoluteTick = beforeAbsoluteTick + 1`.
- [ ] **Step 4: Export stable `SimulationContractError` codes** for invalid and stale plans.
- [ ] **Step 5: Record expected test command:** `pnpm --filter @web-three-city/simulation-core test -- simulation-snapshot.test.ts simulation-mutation.test.ts`.

### Task 3: Add `SimulationSaveV1`

**Interfaces:**

```ts
export interface SimulationSaveV1 {
  readonly kind: 'simulation-save';
  readonly schemaVersion: 1;
  readonly absoluteTick: number;
  readonly growthSequence: number;
}

export function encodeSimulationSaveV1(snapshot: SimulationSnapshot): SimulationSaveV1;
export function decodeSimulationSaveV1(input: unknown): Result<SimulationSnapshot, SimulationSaveError>;
```

- [ ] **Step 1: Author malformed-schema and round-trip tests.**
- [ ] **Step 2: Implement frozen encoding without persisting runtime speed or accumulators.**
- [ ] **Step 3: Implement fail-closed decoding through `createSimulationSnapshot`.**
- [ ] **Step 4: Record expected test command:** `pnpm --filter @web-three-city/simulation-core test -- serialization.test.ts`.

### Task 4: Convert Building authority to a lifecycle union

**Interfaces:**

```ts
interface BuildingInstanceBase {
  readonly instanceId: string;
  readonly buildingDefinitionId: BuildingDefinitionId;
  readonly buildingDefinitionVersion: BuildingDefinitionVersion;
  readonly originCell: CellCoord;
  readonly rotationQuarterTurns: BuildingRotationQuarterTurns;
}

export interface ConstructionBuildingInstance extends BuildingInstanceBase {
  readonly lifecycle: 'construction';
  readonly constructionStartedAtTick: number;
  readonly constructionCompletesAtTick: number;
}

export interface ActiveBuildingInstance extends BuildingInstanceBase {
  readonly lifecycle: 'active';
  readonly activatedAtTick: number;
}

export type BuildingInstance = ConstructionBuildingInstance | ActiveBuildingInstance;
```

- [ ] **Step 1: Author lifecycle tests** for valid Construction, valid Active, end-before-start rejection, unsafe tick rejection, lifecycle counts, and progress boundaries.
- [ ] **Step 2: Add `selectionWeight` and `constructionDurationTicks` to `BuildingDefinition`.**
- [ ] **Step 3: Add canonical metadata to the six existing Definitions:** weights from the approved catalog and durations `24 × area`.
- [ ] **Step 4: Implement `copyBuildingInstance`, `validateBuildingLifecycle`, `constructionProgressAtTick`, `buildingLifecycleCounts`, and `activateCompletedBuilding` in `building-lifecycle.ts`.
- [ ] **Step 5: Update snapshot copying and validation** to retain exact lifecycle fields.
- [ ] **Step 6: Update explicit legacy development** to create `active` instances with `activatedAtTick: INITIAL_ABSOLUTE_TICK`; preserve its existing deterministic whole-world behavior until PR 3.
- [ ] **Step 7: Record expected focused test command:** `pnpm --filter @web-three-city/building-core test -- building-lifecycle.test.ts building-snapshot.test.ts building-definitions.test.ts`.

### Task 5: Add one-candidate deterministic Growth planning

**Interfaces:**

```ts
export interface BuildingGrowthPlan {
  readonly baseBuildingRevision: number;
  readonly baseSimulationRevision: number;
  readonly beforeAbsoluteTick: number;
  readonly afterAbsoluteTick: number;
  readonly proposedInstances: readonly BuildingInstance[];
  readonly startedInstanceIds: readonly string[];
  readonly completedInstanceIds: readonly string[];
  readonly nextGrowthSequence: number;
  readonly dirtyChunks: readonly ChunkCoord[];
  readonly valid: boolean;
  readonly invalidReason: BuildingGrowthInvalidReason | null;
}

export function planBuildingGrowthTick(input: {
  readonly buildings: BuildingSnapshot;
  readonly simulation: SimulationSnapshot;
  readonly environment: BuildingDevelopmentEnvironment;
  readonly config: WorldConfig;
}): BuildingGrowthPlan;

export function commitBuildingGrowthTick(...): {
  readonly buildings: BuildingSnapshot;
  readonly simulation: SimulationSnapshot;
  readonly receipt: BuildingGrowthReceipt;
};
```

- [ ] **Step 1: Author Growth tests** for completion-before-start ordering, non-evaluation idle ticks, one start maximum, row-major origin selection, source-revision fail closed, stale plan rejection, sequence increment only on start, and speed-independent equality when the same number of ticks is committed.
- [ ] **Step 2: Reuse existing placement validation and frontage resolution** without importing Game-layer adapters.
- [ ] **Step 3: On each plan, derive the next Simulation tick first.**
- [ ] **Step 4: Complete all due Construction instances sorted by `instanceId`, setting `activatedAtTick = afterAbsoluteTick`.**
- [ ] **Step 5: At evaluation hours, scan row-major and start the first valid candidate only.**
- [ ] **Step 6: Generate IDs as `building:growth:<nextGrowthSequence>` and set Construction start/end from Definition duration.**
- [ ] **Step 7: Commit Simulation and Building snapshots atomically after exact stale-revision checks.**
- [ ] **Step 8: Return frozen receipts with started/completed IDs and dirty chunks.**
- [ ] **Step 9: Record expected focused test command:** `pnpm --filter @web-three-city/building-core test -- building-growth.test.ts`.

### Task 6: Add lifecycle serialization without WorldSave cutover

**Interfaces:**

```ts
export interface BuildingSaveV2 {
  readonly kind: 'building-save';
  readonly schemaVersion: 2;
  readonly revision: number;
  readonly instances: readonly BuildingSaveInstanceV2[];
}

export function encodeBuildingSaveV2(snapshot: BuildingSnapshot): BuildingSaveV2;
export function decodeBuildingSaveV2(input: unknown, config: WorldConfig): Result<BuildingSnapshot, BuildingSaveError>;
export function migrateBuildingSaveV1(input: BuildingSaveV1, config: WorldConfig): Result<BuildingSnapshot, BuildingSaveError>;
```

- [ ] **Step 1: Author V2 tests** for Construction and Active round trips and lifecycle mismatch rejection.
- [ ] **Step 2: Preserve V1 decoding** by migrating every V1 instance to Active at `INITIAL_ABSOLUTE_TICK`.
- [ ] **Step 3: Reject already-due Construction when decoding requires a current Simulation tick; expose a separate validation helper for PR 3 composition.**
- [ ] **Step 4: Record expected test command:** `pnpm --filter @web-three-city/building-core test -- serialization.test.ts`.

### Task 7: Update workspace metadata and review PR boundary

- [ ] **Step 1: Add `@web-three-city/simulation-core` to `building-core` dependencies.**
- [ ] **Step 2: Regenerate `pnpm-lock.yaml` with `pnpm install --lockfile-only`.**
- [ ] **Step 3: Export only documented public contracts from both package indexes.**
- [ ] **Step 4: Run a static review for browser/Three.js imports in both core packages.**
- [ ] **Step 5: Commit PR 1 with message:** `feat: add simulation clock and Building Growth core`.

## Deferred final verification

Per Owner instruction, do not execute the authored tests during Tasks 1–7. PR 3's final gate executes:

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm provenance:check
pnpm test
pnpm test:deployment
pnpm build
pnpm exec playwright install chromium
pnpm test:browser:only
node tooling/verify-clean-worktree.mjs
```

Any failure is repaired on the responsible stacked branch while preserving the three PR boundaries, then the complete final gate is rerun from the exact PR 3 head.
