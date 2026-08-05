# Building Growth Runtime, Save, UI & Browser Integration v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the pure Simulation/Growth and Variety packages into the playable Game with deterministic runtime speeds, WorldSaveV4, accessible time controls, Undo-safe automatic growth, and browser acceptance evidence.

**Architecture:** `apps/game` owns a real-time accumulator that emits whole logical ticks into a pure composed transaction. The authoritative Simulation and Building snapshots are updated together, presentation rebuilds from receipts, and player Undo is untouched by automatic ticks. WorldSaveV4 persists SimulationSaveV1 and BuildingSaveV2 while older saves migrate deterministically.

**Tech Stack:** TypeScript 6, browser `requestAnimationFrame`, Page Visibility API, Three.js 0.185, Vitest 4, Playwright 1.61, pnpm workspaces.

## Global Constraints

- Paused `0×`, Normal `1×`, Fast `2×`, Faster `4×`.
- Normal emits one logical tick per 1000 real milliseconds.
- Step emits exactly one tick only while Paused and remains Paused.
- Hidden tabs clear the accumulator and never catch up.
- New Game starts Normal; Load starts Paused.
- Runtime speed and accumulator are never persisted.
- Automatic ticks never replace player Undo.
- Explicit `Develop Zones` is removed only after automatic growth is active.
- Tests are authored before implementation and executed only after all implementation files are complete.

---

## File map

### Create

- `apps/game/src/simulation-runtime.ts` — speed state, accumulator, visibility reset, and Step.
- `apps/game/src/simulation-runtime.test.ts`
- `apps/game/src/world-growth-transaction.ts` — composed Simulation/Building tick transaction.
- `apps/game/src/world-growth-transaction.test.ts`
- `apps/game/src/game-time-presentation.ts` — calendar label and lifecycle counts.
- `apps/game/src/game-time-presentation.test.ts`
- `apps/game/src/world-save-v4.test.ts`
- `browser-tests/growth.spec.ts` — automatic cadence, speed equivalence, pause/step, Save/Load.
- `browser-tests/growth-visual-evidence.spec.ts` — Construction phases and content variety.
- `browser-tests/helpers/growth-fixture.ts` — deterministic setup and tick-driving helpers.
- `docs/superpowers/evidence/2026-08-04-building-growth-variety-foundation-v0-1.md` — final exact-head and Owner acceptance matrix.

### Modify

- `apps/game/package.json` — add `simulation-core` dependency.
- `apps/game/src/game-bootstrap.ts` — compose Simulation snapshot, runtime, Growth ticks, presentation, counts, Save/Load, and visibility.
- `apps/game/src/game-input.ts` — preserve world interaction while time controls own UI events.
- `apps/game/src/game-tool-events.ts` — add Simulation status events without classifying automatic ticks as player transactions.
- `apps/game/src/game-tool-hud-binding.ts` — bind time controls and lifecycle counts.
- `apps/game/src/game-tool-mode.ts` — remove `building-develop` from final tool modes.
- `apps/game/src/game-tool-presentation.ts` — remove explicit development presentation state.
- `apps/game/src/game-ui.ts` — render clock and speed controls; remove Develop Zones button.
- `apps/game/src/main.ts` — drive runtime from animation frames and Page Visibility.
- `apps/game/src/world-save.ts` — WorldSaveV4 encode/decode and V1–V3 migration.
- `apps/game/src/world-undo.ts` — confirm automatic ticks bypass store and Building snapshots retain lifecycle.
- `apps/game/src/building-tool-controller.ts` — retain Bulldoze only.
- `apps/game/src/building-development-environment.ts` — no authority change; expose current revisions for every tick.
- `apps/game/src/interaction-evidence.ts` — include calendar/speed/lifecycle counts.
- `apps/game/src/game-ui.test.ts`
- `apps/game/src/game-tool-mode-building.test.ts`
- `apps/game/src/world-save-building.test.ts`
- `apps/game/src/world-save-building-migration.test.ts`
- `apps/game/src/world-undo-building.test.ts`
- `browser-tests/building.spec.ts`
- `browser-tests/building-visual-evidence.spec.ts`
- `browser-tests/game.spec.ts`
- `README.md` — describe automatic Growth and twelve prototypes.
- `pnpm-lock.yaml`

---

### Task 1: Implement the deterministic browser Simulation runtime

**Interfaces:**

```ts
export interface SimulationRuntimeState {
  readonly speed: SimulationSpeed;
  readonly accumulatedMilliseconds: number;
}

export interface SimulationRuntime {
  getState(): SimulationRuntimeState;
  setSpeed(speed: SimulationSpeed): void;
  advance(realDeltaMilliseconds: number, onTick: () => void): number;
  step(onTick: () => void): boolean;
  resetAfterVisibilityChange(): void;
}

export function createSimulationRuntime(initialSpeed: SimulationSpeed): SimulationRuntime;
```

- [ ] **Step 1: Author tests** for 999/1000 ms boundaries, 2× and 4× emission counts, paused accumulation rejection, exact Step behavior, invalid/negative delta rejection, maximum-frame clamping, and visibility reset.
- [ ] **Step 2: Implement speed multipliers** as frozen data `{paused:0, normal:1, fast:2, faster:4}`.
- [ ] **Step 3: Accumulate `delta × multiplier`; emit whole ticks while at least 1000 ms remains.**
- [ ] **Step 4: Clamp one frame's accepted real delta to 250 ms** so suspended frames cannot create catch-up bursts.
- [ ] **Step 5: Paused clears/keeps accumulator at zero; changing speed preserves no fractional authority.**
- [ ] **Step 6: Step calls `onTick` once only when paused and returns whether it executed.**
- [ ] **Step 7: `resetAfterVisibilityChange` clears the accumulator.**
- [ ] **Step 8: Record expected focused command:** `pnpm --filter @web-three-city/game test -- simulation-runtime.test.ts`.

### Task 2: Compose one atomic world Growth tick

**Interfaces:**

```ts
export interface WorldGrowthState {
  readonly simulation: SimulationSnapshot;
  readonly buildings: BuildingSnapshot;
}

export interface WorldGrowthTickResult extends WorldGrowthState {
  readonly receipt: BuildingGrowthReceipt;
}

export function executeWorldGrowthTick(input: {
  readonly state: WorldGrowthState;
  readonly environment: BuildingDevelopmentEnvironment;
  readonly config: WorldConfig;
}): WorldGrowthTickResult;
```

- [ ] **Step 1: Author tests** for idle advancement, start, completion-before-start, stale environment failure, no partial state replacement on error, and automatic tick not calling an injected Undo writer.
- [ ] **Step 2: Plan and commit through `building-core` Growth contracts only.**
- [ ] **Step 3: Return both snapshots and the frozen receipt as one immutable value.**
- [ ] **Step 4: Keep player Undo entirely outside this function.**
- [ ] **Step 5: Record expected focused command:** `pnpm --filter @web-three-city/game test -- world-growth-transaction.test.ts`.

### Task 3: Add lifecycle-aware time presentation helpers

**Interfaces:**

```ts
export interface GameTimePresentation {
  readonly calendarLabel: string;
  readonly constructionCount: number;
  readonly activeCount: number;
  readonly totalCount: number;
}

export function createGameTimePresentation(
  simulation: SimulationSnapshot,
  buildings: BuildingSnapshot,
): GameTimePresentation;
```

- [ ] **Step 1: Author tests** for `Y1 M1 D1 08:00`, zero-padded hour, and lifecycle counts.
- [ ] **Step 2: Derive calendar through `simulation-core`; do not duplicate calendar arithmetic in Game.**
- [ ] **Step 3: Derive counts through `building-core` lifecycle helpers.**
- [ ] **Step 4: Record expected focused command:** `pnpm --filter @web-three-city/game test -- game-time-presentation.test.ts`.

### Task 4: Introduce WorldSaveV4

**Contracts:**

```ts
export interface WorldSaveV4 {
  readonly kind: 'web-three-city-world';
  readonly schemaVersion: 4;
  readonly terrain: TerrainSaveV1;
  readonly roads: RoadSaveV1;
  readonly zones: ZoneSaveV1;
  readonly buildings: BuildingSaveV2;
  readonly simulation: SimulationSaveV1;
}

export interface DecodedWorldState {
  readonly terrain: TerrainSnapshot;
  readonly water: WaterSnapshot;
  readonly roads: RoadSnapshot;
  readonly zones: ZoneSnapshot;
  readonly buildings: BuildingSnapshot;
  readonly simulation: SimulationSnapshot;
}
```

- [ ] **Step 1: Author tests** for V4 Construction round trip, Active round trip, malformed Simulation, already-due Construction rejection, and exact tick preservation.
- [ ] **Step 2: Rename final encoder to `encodeWorldSaveV4`.**
- [ ] **Step 3: Decode V4 components independently, then validate Building authority against decoded Terrain/Water/Road/Zone and Simulation tick.**
- [ ] **Step 4: Migrate V1 and V2 to empty Buildings plus initial Simulation.**
- [ ] **Step 5: Migrate V3 instances to Active at initial tick and set `growthSequence = buildingCount`.**
- [ ] **Step 6: Reject Construction when `constructionCompletesAtTick <= simulation.absoluteTick`.**
- [ ] **Step 7: Keep decoding fail closed with stable world-save error codes.**
- [ ] **Step 8: Record expected focused command:** `pnpm --filter @web-three-city/game test -- world-save-v4.test.ts world-save-building.test.ts world-save-building-migration.test.ts`.

### Task 5: Integrate Simulation state into Game bootstrap

- [ ] **Step 1: Author bootstrap-level tests** using the existing Game transaction patterns to prove new worlds start at tick `8`, Growth ticks rebuild Building presentation only on meaningful receipts, and loading resets runtime speed to Paused.
- [ ] **Step 2: Add authoritative `simulation` alongside Terrain, Water, Roads, Zones, and Buildings.**
- [ ] **Step 3: Create a Simulation runtime at Normal for new games.**
- [ ] **Step 4: On each emitted logical tick, create the current Building environment, execute the world Growth transaction, replace Simulation/Building snapshots atomically, and rebuild presentation when started/completed IDs are non-empty or a Construction phase boundary changed.**
- [ ] **Step 5: Automatic ticks must not call `WorldUndoStore.set`.**
- [ ] **Step 6: On Save, persist WorldSaveV4.**
- [ ] **Step 7: On Load, replace all snapshots, set runtime Paused, clear accumulator, clear Undo, and rebuild all derived presentations exactly once.**
- [ ] **Step 8: Preserve Building Bulldoze for both lifecycle states and exact lifecycle Undo restoration.**
- [ ] **Step 9: Remove explicit `planBuildingDevelopment` invocation from Game composition.**

### Task 6: Add accessible time controls and remove Develop Zones

**Required controls:**

```text
Pause
Play
2×
4×
Step
```

- [ ] **Step 1: Author UI tests** for labels, pressed state, Step disabled while running, calendar text, and counts.
- [ ] **Step 2: Remove `building-develop` from `BuildingToolMode`, mode guards, tool-event contracts, and button rendering.**
- [ ] **Step 3: Retain `building-bulldoze` and existing interaction semantics.**
- [ ] **Step 4: Add a compact time-control group outside the map interaction surface.**
- [ ] **Step 5: Bind Pause/Play/2×/4× to runtime speed and Step to one tick.**
- [ ] **Step 6: Set `aria-pressed` on the active speed button and `aria-disabled`/native disabled on Step while running.**
- [ ] **Step 7: Render `calendarLabel`, Construction, Active, and Total counts.**
- [ ] **Step 8: Announce only Growth receipts with starts/completions; idle ticks do not replace status.**
- [ ] **Step 9: Update responsive tests so controls remain reachable without horizontal overflow.**

### Task 7: Drive frames and Page Visibility safely

- [ ] **Step 1: Author integration tests around the frame callback adapter where practical; browser tests cover actual visibility behavior.**
- [ ] **Step 2: In `main.ts`, calculate frame delta from the previous animation timestamp.**
- [ ] **Step 3: Pass delta to Simulation runtime before rendering derived UI.**
- [ ] **Step 4: On `document.visibilitychange`, reset the runtime accumulator and reset the previous frame timestamp.**
- [ ] **Step 5: Do not advance time while `document.hidden` is true.**
- [ ] **Step 6: Preserve existing render loop, camera, input, and WebGL context restoration behavior.**

### Task 8: Add deterministic browser Growth acceptance

**Browser scenarios:**

1. New Game shows `Y1 M1 D1 08:00` and Normal selected.
2. Paused prevents tick advancement.
3. Step advances exactly one hour and remains Paused.
4. Normal, 2×, and 4× reach byte-identical authoritative snapshots after the same number of logical ticks.
5. Automatic Growth starts at an evaluation hour without pressing Develop Zones.
6. At most one Construction starts per evaluation.
7. Construction progresses through foundation, frame, shell, and Active.
8. Bulldoze during Construction works and Undo restores timestamps.
9. Save during Construction and Load resumes exact authority while runtime is Paused.
10. V3 fixture migration produces Active Buildings and deterministic sequence continuation.
11. Hidden-page interval does not cause catch-up ticks.
12. Twelve definitions are reachable across deterministic fixture sequences.

- [ ] **Step 1: Create helpers** that expose authoritative Simulation/Building evidence without depending on screenshots.
- [ ] **Step 2: Author `growth.spec.ts` for scenarios 1–11.**
- [ ] **Step 3: Author deterministic catalog reachability coverage with controlled sequence fixtures.**
- [ ] **Step 4: Update existing Building tests to stop looking for Develop Zones.**
- [ ] **Step 5: Keep Playwright worker concurrency fixed at `2`.**

### Task 9: Add visual evidence and documentation

- [ ] **Step 1: Capture foundation, frame, shell, and Active states using deterministic tick stepping.**
- [ ] **Step 2: Capture representative Residential, Commercial, and Industrial variety with at least two silhouettes per Zone family.**
- [ ] **Step 3: Capture desktop and mobile time controls.**
- [ ] **Step 4: Update README current milestone and system list.**
- [ ] **Step 5: Create the evidence matrix with automated commands, expected artifacts, manual checks, and exact-head fields left blank until verification produces them.**
- [ ] **Step 6: Commit PR 3 with message:** `feat: integrate automatic Building Growth and time controls`.

### Task 10: Run the single deferred final verification gate

- [ ] **Step 1: Run formatting:** `pnpm format:check`.
- [ ] **Step 2: Run ESLint:** `pnpm lint`.
- [ ] **Step 3: Run workspace and browser typecheck:** `pnpm typecheck`.
- [ ] **Step 4: Run provenance:** `pnpm provenance:check`.
- [ ] **Step 5: Run all package/Game tests:** `pnpm test`.
- [ ] **Step 6: Run deployment contract tests:** `pnpm test:deployment`.
- [ ] **Step 7: Build all workspaces:** `pnpm build`.
- [ ] **Step 8: Install Chromium:** `pnpm exec playwright install chromium`.
- [ ] **Step 9: Run browser tests:** `pnpm test:browser:only` and require `0` failures using exactly `2` workers.
- [ ] **Step 10: Verify cleanliness:** `node tooling/verify-clean-worktree.mjs`.
- [ ] **Step 11: Repair every failure on the responsible stacked branch, propagate descendants, and rerun the complete gate from Step 1; partial reruns cannot close the milestone.**
- [ ] **Step 12: Record exact final head, commands, counts, durations, warnings, artifact ID/digest, and Owner matrix in the evidence document and PR bodies.**

## Merge gate

Keep all implementation PRs Draft and unmerged after automated verification. Final merge requires Owner visual/manual acceptance and explicit sequential merge authorization for PR 1, PR 2, and PR 3.
