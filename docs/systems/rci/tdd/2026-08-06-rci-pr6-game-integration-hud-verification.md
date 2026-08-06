# RCI PR 6 — Atomic Game Integration, HUD, Browser Acceptance, and Final Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Begin only after PR 5 is merged to `master`.

**Goal:** Complete the RCI milestone by composing Simulation, Building, and RCI planning into one atomic world tick, finalizing `WorldSaveV5`, exposing a compact derived HUD, proving browser workflows, recording deterministic performance baselines, and publishing closure evidence.

**Architecture:** `apps/game` owns orchestration only. A focused `world-tick.ts` stages Building/Simulation work, passes before/after snapshots to `planRciTick`, validates the combined proposal, then replaces all three committed snapshots together. UI reads `RciProjection` and never calculates simulation totals. Save/load/reset runtime paths replace coherent world state as one operation.

**Tech Stack:** TypeScript, Vite, Three.js game app, Vitest/happy-dom, Playwright, existing world save/runtime controls, RCI/Building/Simulation packages from PRs 1–5.

## Global Constraints

- A tick commits Simulation, Buildings, and RCI together or none of them.
- No committed state is visible between Building and RCI planning phases.
- Plan failure, validation failure, stale revision, Save decode failure, or UI render failure cannot partially mutate simulation authority.
- Pause performs no tick. Step performs exactly one complete tick. Normal/Fast/Faster preserve existing cadence.
- HUD values come only from `createRciProjection`.
- RCI UI is summary-only: no Citizen browser, family tree, occupation list, or demographic dashboard.
- Save/load must preserve all authoritative records, Demand/gates, sequences, accumulators, and historical assignments.
- Reset produces coherent initial Terrain/Road/Zone/Building/Simulation/RCI state.
- Browser tests must prove background growth does not interrupt Terrain/Road/Zone interaction.
- Performance is reported as baseline evidence, not a hard wall-clock gate in v0.1; algorithmic/non-quadratic invariants remain hard tests.

---

## Task 1: Extract committed game-world state and atomic replacement boundary

**Files:**
- Create: `apps/game/src/game-world-state.ts`
- Create: `apps/game/src/game-world-state.test.ts`
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `apps/game/src/main.ts` only where bootstrap construction requires the new state owner

**Interfaces:**

```ts
export interface GameWorldState {
  readonly terrain: TerrainSnapshot;
  readonly water: WaterSnapshot;
  readonly roads: RoadSnapshot;
  readonly zones: ZoneSnapshot;
  readonly buildings: BuildingSnapshot;
  readonly simulation: SimulationSnapshot;
  readonly rci: RciSnapshot;
}

export interface GameWorldStateStore {
  current(): GameWorldState;
  replace(next: GameWorldState): void;
}

export function createGameWorldStateStore(initial: GameWorldState): GameWorldStateStore;
```

- [ ] **Step 1: Write failing state-store tests**

Cover frozen current state, atomic replacement, no partial setters, reference preservation for unchanged snapshots, and invalid incoherent revisions rejected before replacement.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/game test -- game-world-state.test.ts
```

- [ ] **Step 3: Implement one committed-state owner**

Do not create independent mutable `let rci`, `let buildings`, and `let simulation` variables that can diverge. Existing renderer/controller adapters may read snapshots through store getters.

- [ ] **Step 4: Refactor bootstrap without behavior changes**

Move only authority storage in this task. Run current game tests to prove Terrain/Road/Zone/Building interactions remain unchanged.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @web-three-city/game test -- game-world-state.test.ts
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
git add apps/game
git commit -m "refactor(game): centralize committed world state"
```

---

## Task 2: Implement atomic world-tick planning and commit

**Files:**
- Create: `apps/game/src/world-tick.ts`
- Create: `apps/game/src/world-tick.test.ts`
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `packages/rci-core/src/validation/cross-domain-validation.ts` only when final combined validation requires a narrow exported helper

**Interfaces:**

```ts
export interface WorldTickPlan {
  readonly baseSimulationRevision: number;
  readonly baseBuildingRevision: number;
  readonly baseRciRevision: number;
  readonly proposedSimulation: SimulationSnapshot;
  readonly proposedBuildings: BuildingSnapshot;
  readonly proposedRci: RciSnapshot;
  readonly buildingReceipt: BuildingGrowthReceipt;
  readonly rciReceipt: RciTickReceipt;
  readonly valid: boolean;
  readonly invalidReason: WorldTickInvalidReason | null;
}

export function planWorldTick(input: Readonly<{
  state: GameWorldState;
  buildingEnvironment: BuildingDevelopmentEnvironment;
  registries: RciDefinitionRegistries;
  rciConfiguration: RciConfiguration;
  worldConfig: WorldConfig;
}>): WorldTickPlan;

export function commitWorldTick(input: Readonly<{
  store: GameWorldStateStore;
  expectedState: GameWorldState;
  plan: WorldTickPlan;
}>): WorldTickReceipt;
```

- [ ] **Step 1: Write failing canonical-order test**

Use spies/fakes to assert exact order:

```text
derive current growth policy
plan Building/Simulation tick
plan RCI from before/after snapshots
validate combined proposed state
replace committed state once
publish receipt after replacement
```

- [ ] **Step 2: Write failure-atomicity tests**

Cover invalid Building plan, invalid RCI plan, cross-domain validation failure, stale Simulation/Building/RCI revision, exception before replacement, and repeated commit. Assert store state remains the exact original object.

- [ ] **Step 3: Write same-tick behavior tests**

Cover construction completion creating Dwelling/Workplace inventory, incoming materialization, Employment reconciliation, Demand/gate update, and next policy in one tick.

- [ ] **Step 4: Run RED**

```bash
pnpm --filter @web-three-city/game test -- world-tick.test.ts
```

- [ ] **Step 5: Implement plan without publishing intermediate snapshots**

`planBuildingGrowthTick` currently returns staged Building/Simulation data through its commit contract. Refactor narrowly if needed so orchestration can stage a deterministic result without mutating state; do not commit Building/Simulation first and attempt rollback later.

- [ ] **Step 6: Implement one replacement commit**

Validate store's current snapshot object/revisions against the plan base. Build one frozen `GameWorldState`, call `store.replace()` exactly once, then notify renderers/presenters through the existing receipt path.

- [ ] **Step 7: Run tests and commit**

```bash
pnpm --filter @web-three-city/game test -- world-tick.test.ts
pnpm --filter @web-three-city/game typecheck
git add apps/game packages/rci-core packages/building-core
git commit -m "feat(game): commit building and rci ticks atomically"
```

---

## Task 3: Integrate pause, speed, step, lifecycle cadence, and renderer refresh

**Files:**
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `apps/game/src/game-time-ui.ts`
- Modify: `apps/game/src/game-time-ui.test.ts`
- Modify: `apps/game/src/game-time-presentation.ts`
- Create: `apps/game/src/rci-runtime.test.ts`

**Interfaces:**
- Existing runtime scheduler calls `planWorldTick` once per logical tick.
- Step triggers exactly one call regardless of speed state.
- Renderer refresh receives Building dirty chunks/IDs after successful commit only.

- [ ] **Step 1: Write failing cadence tests**

Cover paused no-op, one Step tick, speed modes preserving existing logical tick behavior, daily 08:00 lifecycle once, development evaluation at 00/06/12/18, and no duplicated RCI reconciliation from frame accumulation.

- [ ] **Step 2: Write failed-tick presentation test**

An invalid plan produces no calendar advance, Building renderer mutation, RCI HUD update, save-state change, or undo entry.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/game test -- game-time-ui.test.ts rci-runtime.test.ts
```

- [ ] **Step 4: Replace direct Building tick path with world tick**

Keep scheduler/frame-delta behavior unchanged. Publish calendar, Building presentation, and RCI projection only from the newly committed state.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @web-three-city/game test -- game-time-ui.test.ts rci-runtime.test.ts
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
git add apps/game
git commit -m "feat(game): run rci through simulation controls"
```

---

## Task 4: Finalize `WorldSaveV5` runtime encode/decode/reset paths

**Files:**
- Modify: `apps/game/src/world-save.ts`
- Modify: all existing world-save tests
- Create: `apps/game/src/world-save-v5-runtime.test.ts`
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: Save/load/reset UI handlers in their current owning files

**Interfaces:**
- V5 becomes the only encoder used for new saves.
- Decoder continues accepting legacy raw Terrain and World Save V1–V5.
- Successful decode returns complete `DecodedWorldState` including RCI and all derived environments.

- [ ] **Step 1: Write failing runtime Save tests**

Cover saving a populated world, loading it into a fresh store, replacing all authority once, rebuilding derived Water/environments/renderers/HUD, and preserving Demand/gates/sequences/history.

- [ ] **Step 2: Write decode-failure atomicity tests**

Malformed RCI, unknown definition, dangling Building, invalid Assignment capacity, and incoherent tick/revision must return structured error and leave current runtime world unchanged.

- [ ] **Step 3: Write reset tests**

Reset clears Citizens/Households/Assignments/queues/Demand/gates and restores deterministic initial sequences/seed while keeping the canonical initial Simulation clock.

- [ ] **Step 4: Run RED**

```bash
pnpm --filter @web-three-city/game test -- world-save-v5-runtime.test.ts
```

- [ ] **Step 5: Implement V5-only encode and coherent decode replacement**

Do not persist `RciProjection`, indexes, current-state maps, processed events, UI mode, or renderer state. Rebuild all derived state after successful decode before publishing UI.

- [ ] **Step 6: Run all Save tests and commit**

```bash
pnpm --filter @web-three-city/game test -- world-save-v5-runtime.test.ts
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
git add apps/game
git commit -m "feat(save): finalize world save v5 runtime"
```

---

## Task 5: Add compact RCI HUD projection and accessible presentation

**Files:**
- Create: `apps/game/src/rci-presentation.ts`
- Create: `apps/game/src/rci-presentation.test.ts`
- Create: `apps/game/src/rci-hud.ts`
- Create: `apps/game/src/rci-hud.test.ts`
- Modify: `apps/game/src/game-ui.ts`
- Modify: `apps/game/src/game-ui.test.ts`
- Modify: `apps/game/src/growth-time.css`

**Interfaces:**

```ts
export interface RciHudViewModel {
  readonly residentPopulationText: string;
  readonly householdText: string;
  readonly dwellingText: string;
  readonly employmentText: string;
  readonly unemploymentText: string;
  readonly residentialDemandText: string;
  readonly commercialDemandText: string;
  readonly industrialDemandText: string;
  readonly residentialGateOpen: boolean;
  readonly commercialGateOpen: boolean;
  readonly industrialGateOpen: boolean;
}

export function createRciHudViewModel(
  projection: RciProjection,
  demand: RciDemandState,
  gates: RciGrowthGateState,
): RciHudViewModel;
```

- [ ] **Step 1: Write failing formatting tests**

Cover zero state, populated state, unemployment percentage with zero workforce, negative/positive Demand formatting, gate accessibility labels, and no locale-dependent number formatting.

- [ ] **Step 2: Write DOM tests**

Assert stable element IDs/roles, visible compact values, no overflow-prone long labels, update after commit, no update after failed tick, and no simulation calculation in DOM adapter.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @web-three-city/game test -- rci-presentation.test.ts rci-hud.test.ts game-ui.test.ts
```

- [ ] **Step 4: Implement summary HUD**

Display:

```text
population
households
occupied / vacant dwellings
employed / workforce
unemployment percentage
R / C / I Demand
optional accessible gate-open state
```

Keep Build/Terrain/Road/Zone tool layout and interaction unchanged.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @web-three-city/game test -- rci-presentation.test.ts rci-hud.test.ts game-ui.test.ts
pnpm --filter @web-three-city/game typecheck
git add apps/game
git commit -m "feat(game): add compact rci hud"
```

---

## Task 6: Add browser acceptance scenarios

**Files:**
- Create: `tests/rci-foundation.spec.ts`
- Create or modify deterministic browser fixture/helper under the existing Playwright test support directory
- Modify: game test hooks only when required to expose deterministic fixture actions; do not expose production-only debug globals without an explicit test-build boundary

**Interfaces:**
- Browser tests interact through user-visible controls and a narrow deterministic fixture setup matching existing browser-test conventions.

- [ ] **Step 1: Add Residential bootstrap scenario**

Sequence:

```text
paint Residential zone with Road access
advance to migration request and open Residential gate
allow Residential growth/construction activation
materialize Household
assert population/dwelling HUD values
```

- [ ] **Step 2: Add Commercial/Industrial Employment scenario**

Activate controlled Workplace content, advance reconciliation, and assert employed/workforce plus sector Demand changes.

- [ ] **Step 3: Add Save/load scenario**

Capture all HUD values and gate states, save, mutate/advance, load, then assert exact restored values and continued deterministic next tick.

- [ ] **Step 4: Add occupied-home bulldoze scenario**

Provide a suitable replacement Unit and assert immediate relocation; repeat without replacement and assert displaced state. Under accelerated deterministic fixture, reach exactly 720 ticks and assert household emigration.

- [ ] **Step 5: Add active-tool regression scenario**

Keep Terrain, Road, and Zone interactions active across background construction/growth/RCI ticks. Assert preview remains visible/valid and no Develop Zone or Building tool opens automatically.

- [ ] **Step 6: Run browser tests**

```bash
pnpm build:browser
pnpm exec playwright test tests/rci-foundation.spec.ts
```

Expected result: all RCI browser scenarios PASS independently and in the full suite.

- [ ] **Step 7: Commit**

```bash
git add tests apps/game
git commit -m "test(browser): cover rci foundation workflows"
```

---

## Task 7: Add deterministic synthetic benchmark and algorithmic guards

**Files:**
- Create: `packages/rci-core/test/rci-benchmark.test.ts`
- Modify: `packages/rci-core/package.json`
- Create: `docs/systems/rci/verification/rci-v0-1-performance-baseline.md`

**Interfaces:**
- Add package script:

```json
"benchmark": "vitest run test/rci-benchmark.test.ts --reporter=verbose"
```

- [ ] **Step 1: Build deterministic representative fixtures**

Include at least small/medium/large scenarios with documented counts for Citizens, Households, Dwellings, Workplaces, Assignments, and queue entries. Use stable seed/content and no random globals.

- [ ] **Step 2: Measure required phases separately**

Record:

```text
daily lifecycle
housing reconciliation
employment reconciliation
demand evaluation
RciSaveV1 encode/decode
complete RCI tick
```

- [ ] **Step 3: Add hard algorithmic assertions**

Assert operation counters/index sizes remain proportional to Citizens + Assignments + groups + vacancies and that no nested scan counter exceeds the documented bound. Do not fail on wall-clock milliseconds in v0.1.

- [ ] **Step 4: Run benchmark repeatedly**

```bash
pnpm --filter @web-three-city/rci-core benchmark
```

Record environment, Node version, scenario sizes, multiple-run median, and observed variability in the baseline document.

- [ ] **Step 5: Commit**

```bash
git add packages/rci-core docs/systems/rci/verification/rci-v0-1-performance-baseline.md
git commit -m "test(rci): add deterministic performance baseline"
```

---

## Task 8: Final system docs, verification evidence, and milestone closure

**Files:**
- Modify: `docs/systems/rci/README.md`
- Modify: `docs/systems/README.md`
- Modify: `docs/systems/buildings/README.md`
- Modify: `docs/systems/simulation-time/README.md`
- Modify: `README.md`
- Create: `docs/systems/rci/verification/rci-demand-occupancy-foundation-v0-1.md`
- Update: implementation PR description/checklist

- [ ] **Step 1: Update RCI status to `Implemented`**

Living docs must describe actual final authority, integration, `WorldSaveV5`, runtime workflow, extension boundaries, known limitations, exact source/test entry points, and links to all six plans/evidence records.

- [ ] **Step 2: Verify documentation truth**

Check that no doc claims Economy, salaries, rent, Services, Traffic, Education gameplay, Citizen AI, Building abandonment, detailed occupations, or family-tree UI exists.

- [ ] **Step 3: Run focused final tests**

```bash
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/simulation-core test
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/rci-core benchmark
```

- [ ] **Step 4: Run complete verification**

```bash
pnpm verify:full
```

- [ ] **Step 5: Verify repository state**

```bash
git status --short
git diff --check
```

Expected result: clean working tree after evidence commit; no generated/untracked artifacts.

- [ ] **Step 6: Record exact evidence**

Final verification document includes:

```text
exact HEAD SHA
Node/pnpm versions
package test counts
full verify result
Playwright result
V1–V4 migration fixtures
V5 round trip
permutation determinism
continuous vs save/load/resume
benchmark baseline
active-tool regression confirmation
known non-blocking limitations
```

- [ ] **Step 7: Commit closure**

```bash
git add README.md docs
git commit -m "docs(rci): close demand occupancy foundation v0.1"
```

## PR 6 and Milestone Acceptance Gate

- Game runtime owns one coherent committed world state.
- Every logical tick stages and commits Simulation, Buildings, and RCI atomically.
- Pause/speed/Step behavior remains correct and deterministic.
- `WorldSaveV5` is the current encoder and V1–V4 remain loadable.
- Save/load/reset cannot partially replace authority.
- Compact HUD reflects only derived RCI projection values.
- Browser acceptance proves population, housing, Employment, Demand/growth, Save/load, displacement/expiry, and active-tool safety.
- Deterministic benchmark records all required phases and hard algorithmic guards pass.
- `pnpm verify:full` passes at the exact recorded HEAD.
- Living docs accurately support future handoff and state deferred systems explicitly.
- All six RCI implementation plans and verification records are linked from the RCI system overview.