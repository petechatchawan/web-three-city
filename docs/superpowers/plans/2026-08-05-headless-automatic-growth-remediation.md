# Headless Automatic Growth Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Interactive Develop Zones from the production tool-routing graph and guarantee that Automatic Growth is a headless background domain operation that preserves the player's active tool and stroke.

**Architecture:** The simulation shell calls `GameRuntime.runBackgroundGrowthTick`, which delegates only to `executeWorldGrowthTick` and applies snapshot/presentation updates without interactive UI side effects. The production tool union, DOM, input router, bootstrap listeners, and keyboard action map expose only `building-bulldoze` for Building interaction.

**Tech Stack:** TypeScript 6, Vite 8, Vitest 4, Happy DOM, Playwright 1.61, pnpm 10, GitHub Actions.

## Global Constraints

- Automatic Growth must not click DOM controls or dispatch synthetic pointer events.
- Automatic Growth must not select Navigate, cancel a tool/stroke, emit Building transaction presentation, write player status, or replace player Undo.
- `building-develop`, its control, and its listener must not exist in the production tool graph.
- Interactive Bulldoze Building remains available and undoable.
- Verification must be bound to one exact commit SHA.

---

### Task 1: Add failing production-graph regressions

**Files:**
- Modify: `apps/game/src/game-ui.test.ts`
- Modify: `browser-tests/growth.spec.ts`

**Interfaces:**
- Consumes: `renderGameUi(root)`, production game page, `window.__WEB_THREE_CITY_TIME__`.
- Produces: regression assertions that reject a Develop Zones DOM action and detect any transient Navigate/tool-cancel/interactive Building transaction during Growth.

- [ ] **Step 1: Change the Game UI unit test to require no Develop Zones action or copy**

Replace the existing positive Develop Zones assertion with:

```ts
expect(root.querySelector('[data-action="tool-building-develop"]')).toBeNull();
expect(root.textContent).not.toContain('Develop Zones');
```

- [ ] **Step 2: Strengthen the Growth browser regression**

Require the Develop Zones locator count to be zero, remove the assumption that a hidden Develop button exists, and retain probes for Navigate clicks, Building transaction events, status history, active tool, and active Zoning stroke.

- [ ] **Step 3: Commit RED tests**

Commit message:

```text
test: reject interactive develop zones production routing
```

- [ ] **Step 4: Run CI for the RED commit**

Expected: unit and/or browser verification fails because the production DOM still contains `tool-building-develop` and `Develop Zones`.

---

### Task 2: Remove Develop Zones from the production tool model and DOM

**Files:**
- Modify: `apps/game/src/game-tool-mode.ts`
- Modify: `apps/game/src/game-ui.ts`
- Modify: `apps/game/src/main.ts`
- Modify: `apps/game/src/game-tool-hud-binding.ts`

**Interfaces:**
- Produces: `BuildingToolMode = 'building-bulldoze'`; production UI and action records with no Develop Zones member.

- [ ] **Step 1: Define the production tool set without `building-develop`**

Keep `BuildingToolMode` as only `building-bulldoze`; add `isGameToolMode` for runtime validation; make `isBuildingToolMode` accept only Bulldoze Building.

- [ ] **Step 2: Remove the Develop Zones DOM button and GameUi port**

Delete `buildingDevelopButton` from the `GameUi` interface, markup, element lookup, tool button record, return object, label switch, and context-message branch.

- [ ] **Step 3: Remove Develop Zones from application action routing**

Delete it from `main.ts` `toolActions`, remove the required button lookup and hidden-control synchronization, and leave `setAutomaticGrowthEnabled` responsible only for the background simulation switch used by deterministic tests.

- [ ] **Step 4: Remove the Develop selector from HUD mutation controls**

Delete `[data-action="tool-building-develop"]` from `game-tool-hud-binding.ts` so HUD binding cannot require a non-existent control.

---

### Task 3: Remove interactive development from input and bootstrap routing

**Files:**
- Modify: `apps/game/src/game-input.ts`
- Modify: `apps/game/src/game-bootstrap.ts`

**Interfaces:**
- Consumes: `planBuildingBulldoze`, `executeWorldGrowthTick`.
- Produces: `onBuildingBulldoze(cell)` interactive port and `runBackgroundGrowthTick(simulation)` background port with no shared UI transaction route.

- [ ] **Step 1: Narrow the GameInput Building callback**

Replace `onBuildingRequest(mode, cell)` with `onBuildingBulldoze(cell)`. Building pointer release must call the callback with the selected cell only. Input mode validation must use the production `isGameToolMode` predicate and reject `building-develop`.

- [ ] **Step 2: Remove the interactive development planner**

Delete `planBuildingDevelopment` and `BuildingToolMode` imports from `game-bootstrap.ts`. Replace `applyBuildingRequest` with `applyBuildingBulldozeRequest(cell)`, which calls only `planBuildingBulldoze`.

- [ ] **Step 3: Make interactive Building commit bulldoze-specific**

Rename the helper to reflect interactive Bulldoze behavior, report only Bulldoze Building statuses, and increment only `buildingBulldozeCount`. It may still use the existing authoritative `commitBuildingMutation` and player Undo path.

- [ ] **Step 4: Preserve the headless background path**

Keep `runBackgroundGrowthTick` limited to `executeWorldGrowthTick`, Building snapshot/presentation replacement, derived zone occupancy refresh, background commit evidence, and Building count update. It must not call interactive commit helpers or UI status/Undo/transaction APIs.

---

### Task 4: Verify and document exact-head evidence

**Files:**
- Modify: `docs/superpowers/evidence/2026-08-04-building-growth-variety-foundation-v0-1.md`
- Update: PR #23 description

**Interfaces:**
- Produces: exact-head verification record and manual acceptance instructions.

- [ ] **Step 1: Run focused checks**

```bash
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
pnpm exec playwright test browser-tests/growth.spec.ts --grep "automatic Growth preserves|does not expose"
```

- [ ] **Step 2: Run full verification**

```bash
pnpm verify:full
```

Expected: all workspace tests, typechecks, lint, formatting, provenance, builds, Playwright tests, and clean-worktree verification pass.

- [ ] **Step 3: Confirm source and DOM invariants**

Confirm no production source route or DOM control contains `building-develop`; references may remain only in regression assertions that forbid it and historical documentation.

- [ ] **Step 4: Update evidence and PR metadata**

Record exact head, GitHub Actions run, job conclusions, Playwright total, and the manual scenario: select a Zone tool, hold/continue a stroke across a Growth evaluation, and verify the tool remains active with no `Zones developed` or Navigate transition.
