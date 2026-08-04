# Building Content & Occupancy Foundation v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic, data-driven Buildings with authoritative occupancy, explicit development, bulldoze, Save/Load, Undo, Three.js prototypes, and live Game integration.

**Architecture:** Add isolated `building-core` and `building-three` workspaces. `building-core` owns immutable definitions, instances, plans, snapshots, serialization, and derived occupancy; `building-three` derives low-poly presentation. `apps/game` composes Building state with Terrain, Water, Roads, Zones, UI, Save/Load, Undo, and cross-domain guards.

**Tech Stack:** TypeScript 6, pnpm workspaces, Vitest, Three.js 0.185, Vite, Playwright.

## Global Constraints

- Branch: `agent/building-content-occupancy-v0-1`; base: `master`.
- Zone remains authoritative development-right state under every Building.
- Persist only Building Definition identity/version, canonical origin, and quarter-turn rotation.
- `CompatibleZoneDefinitionIds[]` is non-empty, canonical, strict, and fail-closed.
- No fallback, remapping, randomness, or compatibility inference.
- Explicit `Develop Zones` command; no simulation-tick development.
- Bulldoze removes only Building state and preserves Zone state.
- Exclude economy, demand, population, jobs, utilities, services, traffic, pathfinding, upgrades, abandonment, and final art.
- Write implementation and complete test coverage before running any verification command, per Owner instruction.

---

### Task 1: Building Core Definitions, Footprints, and Snapshot

**Files:**
- Create: `packages/building-core/package.json`
- Create: `packages/building-core/tsconfig.json`
- Create: `packages/building-core/tsconfig.build.json`
- Create: `packages/building-core/vitest.config.ts`
- Create: `packages/building-core/src/contracts.ts`
- Create: `packages/building-core/src/building-definitions.ts`
- Create: `packages/building-core/src/building-footprint.ts`
- Create: `packages/building-core/src/building-snapshot.ts`
- Create: `packages/building-core/src/index.ts`
- Test: `packages/building-core/test/building-definitions.test.ts`
- Test: `packages/building-core/test/building-footprint.test.ts`
- Test: `packages/building-core/test/building-snapshot.test.ts`

**Interfaces:**
- Produces: `BuildingDefinition`, `BuildingInstance`, `BuildingSnapshot`, `buildingDefinitions()`, `buildingDefinitionForId()`, `rotatedBuildingFootprint()`, `occupiedCellsForBuilding()`, `createBuildingSnapshot()`, `createEmptyBuildingSnapshot()`, `buildingAtCell()`, `buildingOccupiedAt()`, `buildingCount()`.

- [ ] Write immutable definition catalog and compatibility tests.
- [ ] Write rotation, footprint, bounds, and row-major occupied-cell tests.
- [ ] Write snapshot defensive-copy, duplicate-ID, overlap, and occupancy-index tests.
- [ ] Implement contracts, six built-in definitions, footprint derivation, snapshot validation, and public exports.
- [ ] Do not run tests yet; commit the complete task.

### Task 2: Deterministic Frontage and Atomic Mutations

**Files:**
- Create: `packages/building-core/src/building-frontage.ts`
- Create: `packages/building-core/src/building-mutation.ts`
- Test: `packages/building-core/test/building-frontage.test.ts`
- Test: `packages/building-core/test/building-mutation.test.ts`
- Modify: `packages/building-core/src/index.ts`

**Interfaces:**
- Consumes: Task 1 catalog, footprint, and snapshot APIs.
- Produces: `resolveBuildingFrontage()`, `planBuildingDevelopment()`, `planBuildingBulldoze()`, `commitBuildingMutation()`, stable `building:*` invalid and contract error codes.

- [ ] Write deterministic frontage ordering tests.
- [ ] Write scanner ordering, homogeneous Zone, flat/dry/Road/overlap validation tests.
- [ ] Write deterministic definition/rotation selection and instance-ID tests.
- [ ] Write bulldoze, no-change, immutable plan, atomic commit, and stale-revision tests.
- [ ] Implement frontage resolution and re-planned atomic commit.
- [ ] Do not run tests yet; commit the complete task.

### Task 3: Building Serialization

**Files:**
- Create: `packages/building-core/src/serialization.ts`
- Test: `packages/building-core/test/serialization.test.ts`
- Modify: `packages/building-core/src/index.ts`

**Interfaces:**
- Produces: `BuildingSaveV1`, `encodeBuildingSaveV1()`, `decodeBuildingSaveV1()`.

- [ ] Write round-trip tests proving derived occupancy is not persisted.
- [ ] Write malformed schema, unknown definition/version, rotation, bounds, duplicate, and overlap rejection tests.
- [ ] Implement fail-closed encode/decode with immutable results.
- [ ] Do not run tests yet; commit the complete task.

### Task 4: Three.js Building Presentation

**Files:**
- Create: `packages/building-three/package.json`
- Create: `packages/building-three/tsconfig.json`
- Create: `packages/building-three/tsconfig.build.json`
- Create: `packages/building-three/vitest.config.ts`
- Create: `packages/building-three/src/material-factory.ts`
- Create: `packages/building-three/src/prototype-factory.ts`
- Create: `packages/building-three/src/building-presentation.ts`
- Create: `packages/building-three/src/index.ts`
- Test: `packages/building-three/test/building-presentation.test.ts`

**Interfaces:**
- Consumes: `BuildingSnapshot`, catalog definitions, `WorldConfig`, and a terrain elevation resolver.
- Produces: `BuildingPresentation` with `load()`, `clear()`, and `dispose()`.

- [ ] Write tests for one group per instance, footprint center, rotation, prototype distinction, userData identity, reload, clear, and disposal.
- [ ] Implement reusable materials and cube-composed cottage, rowhouse, shop, office, workshop, and warehouse prototypes.
- [ ] Do not run tests yet; commit the complete task.

### Task 5: Game Environment and Cross-Domain Occupancy Guards

**Files:**
- Create: `apps/game/src/building-development-environment.ts`
- Create: `apps/game/src/building-world-occupancy.ts`
- Create: `apps/game/src/road-building-guard.ts`
- Create: `apps/game/src/zone-building-guard.ts`
- Modify: `apps/game/src/terraform-occupancy-guard.ts`
- Test: `apps/game/src/building-development-environment.test.ts`
- Test: `apps/game/src/road-building-guard.test.ts`
- Test: `apps/game/src/zone-building-guard.test.ts`
- Test: `apps/game/src/terraform-building-guard.test.ts`

**Interfaces:**
- Produces: coherent `BuildingDevelopmentEnvironment`, `ZoneWorldOccupancy` adapter backed by Buildings, and fail-closed Road/Zone/Terraform guards.

- [ ] Write environment revision and terrain/water/road/zone adapter tests.
- [ ] Write Road build/bulldoze rejection tests for Building cells.
- [ ] Write Zone paint/remove rejection tests for Building cells.
- [ ] Extend Terraform occupancy tests to reject Building cells.
- [ ] Implement adapters and guards without creating a second occupancy authority.
- [ ] Do not run tests yet; commit the complete task.

### Task 6: WorldSaveV3 and Building Undo

**Files:**
- Modify: `apps/game/src/world-save.ts`
- Modify: `apps/game/src/world-undo.ts`
- Modify: `apps/game/src/world-save.test.ts`
- Modify: `apps/game/src/world-undo.test.ts`

**Interfaces:**
- Produces: `WorldSaveV3`, V1/V2 migration to empty Buildings, V3 validation, and `WorldUndoEntry` kind `building`.

- [ ] Extend save tests for V1/V2 migration, V3 round-trip, and all Building load validation failures.
- [ ] Extend Undo tests for defensive copy, development/bulldoze restore, newer revision, and single consumption.
- [ ] Implement `encodeWorldSaveV3()` and return Buildings plus Building environment from `decodeWorldSave()`.
- [ ] Implement Building snapshot copy/restore in `WorldUndoStore`.
- [ ] Do not run tests yet; commit the complete task.

### Task 7: Building Tool, UI, Status, and Input Contracts

**Files:**
- Modify: `apps/game/src/game-tool-mode.ts`
- Modify: `apps/game/src/game-ui.ts`
- Modify: `apps/game/src/game-tool-presentation.ts`
- Modify: `apps/game/src/game-reason-catalog.ts`
- Modify: `apps/game/src/main.ts`
- Create: `apps/game/src/building-tool-controller.ts`
- Test: `apps/game/src/building-tool-controller.test.ts`
- Modify: `apps/game/src/game-ui.test.ts`
- Modify: `apps/game/src/game-reason-catalog.test.ts`

**Interfaces:**
- Produces: `building-develop`, `building-bulldoze`, accessible buttons, Building count, and pointer-release operation requests.

- [ ] Write mode narrowing and controller request tests.
- [ ] Extend UI tests for controls, pressed state, count, context, and labels.
- [ ] Extend reason catalog tests for stable Building messages.
- [ ] Implement controls without adding keyboard shortcuts in v0.1.
- [ ] Do not run tests yet; commit the complete task.

### Task 8: Live Runtime Composition

**Files:**
- Modify: `apps/game/package.json`
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `apps/game/src/game-input.ts`
- Modify: `apps/game/src/interaction-evidence.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: Tasks 1–7.
- Produces: live Building state, presentation, develop/bulldoze commit flow, Save/Load, Undo, occupancy guards, evidence counters, and disposal.

- [ ] Initialize empty Building state and Building presentation.
- [ ] Route pointer-release develop/bulldoze actions.
- [ ] Guard Road, Zone, and Terraform plans with current Building occupancy.
- [ ] Rebuild coherent environments after every world transaction.
- [ ] Integrate Building state into WorldSaveV3, load staging, Undo, UI counts, status, and evidence.
- [ ] Dispose Building presentation and listeners.
- [ ] Do not run tests yet; commit the complete task.

### Task 9: Browser Acceptance and Closure Evidence

**Files:**
- Create: `browser-tests/building.spec.ts`
- Create: `browser-tests/building-visual-evidence.spec.ts`
- Create: `docs/superpowers/evidence/2026-08-03-building-content-occupancy-foundation-v0-1.md`
- Modify: `browser-tests/game.spec.ts`

**Interfaces:**
- Produces: final Owner test matrix and evidence placeholders tied to exact scenarios.

- [ ] Write browser acceptance for zoning, Develop, deterministic counts, prototype rendering, bulldoze preserving Zone, occupancy guards, Save/Load, and Undo.
- [ ] Write visual evidence capture for Residential, Commercial, and Industrial prototypes.
- [ ] Document exact manual scenarios and expected outcomes without claiming execution.
- [ ] Do not run browser tests or verification; commit the complete task.

### Task 10: Final Verification Gate — Deferred to Owner

**Files:**
- Update after execution: PR description and evidence document only.

**Interfaces:**
- Consumes: completed implementation and Owner verification results.
- Produces: exact-head closure evidence and merge decision.

- [ ] Owner runs focused package and Game tests.
- [ ] Owner runs `pnpm check`.
- [ ] Owner runs Playwright Building acceptance and visual review.
- [ ] Record exact head, commands, counts, warnings, and screenshots.
- [ ] Mark PR ready and merge only after explicit Owner authorization.
