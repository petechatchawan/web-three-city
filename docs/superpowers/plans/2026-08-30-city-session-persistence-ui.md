# City Session Persistence UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add New City, Load City, Resume City, Save City, IndexedDB persistence, and clean responsive application UI over World/Terrain lifecycle ports.

**Architecture:** `orchestration/city-session` owns cross-system sequencing using lifecycle/repository/environment ports. `apps/game` owns system-composition adapters, IndexedDB/browser environment adapters, screens/UI primitives, and live Three.js presentation composition.

**Tech Stack:** TypeScript, IndexedDB, Three.js, CSS, Vitest, Playwright.

**Spec:** `docs/orchestration/city-session/specs/CITY-SESSION-DESIGN.md` and `docs/apps/game/specs/CITY-UI-AND-PERSISTENCE-ADAPTER-DESIGN.md`

## Global Constraints

- Orchestration cannot import system `./composition`.
- Save payload contains canonical snapshots only.
- IndexedDB adapter is app-owned; no `localStorage`.
- Explicit save only; no unload autosave.
- UI is vanilla TS, mobile-first, shadcn-like tokens, 44px targets.

---

### Task 1: Create city-session package contracts and package boundary

**Files:**
- Create package under `orchestration/city-session/` with package.json, tsconfig, src/contracts, src/ports, src/index/composition.
- Add tests.

**Core interfaces:** `CityId`, `CityMetadata`, `CitySaveV1`, `CitySaveSummary`, `NewCityPreview`, `LiveCitySession`, `WorldLifecyclePort`, `TerrainLifecyclePort`, `CitySaveRepository`, `Clock`, `IdSource`.

- [ ] RED architecture/package tests proving allowed root imports and no system composition import.
- [ ] Add minimal typed contracts/ports and package scripts/exports (`.` + `./composition`).
- [ ] GREEN typecheck/architecture.
- [ ] Commit `feat(city-session): define lifecycle orchestration contracts`.

### Task 2: Implement New/Save/Load/Resume orchestration

**Files:** application use-case modules + factory + tests.

- [ ] RED prepare new city validation, exact prepared-field reuse, selected Region membership, initial save, save failure retaining live state, load restore, corrupt save rejection, resume latest/tie break/empty, canonical list ordering.
- [ ] Implement functional use-case functions over explicit dependency object; orchestration object is a factory/closure.
- [ ] GREEN orchestration tests/typecheck/architecture.
- [ ] Commit `feat(city-session): orchestrate city lifecycle`.

### Task 3: Add app lifecycle adapters for World/Terrain

**Files:**
- Add app production dependencies on world/terrain/orchestration.
- Create `apps/game/src/composition/systems/world-lifecycle-adapter.ts`
- Create `apps/game/src/composition/systems/terrain-lifecycle-adapter.ts`
- Add adapter tests where useful.

- [ ] RED adapter contract tests using only system public/composition surfaces.
- [ ] Implement trivial translation: prepare/create/restore/capture capability assembly; no business decisions.
- [ ] GREEN app/orchestration typecheck + architecture.
- [ ] Commit `feat(game): adapt world terrain lifecycle composition`.

### Task 4: IndexedDB repository + browser environment adapters

**Files:**
- Create `apps/game/src/persistence/city-save-schema.ts`
- Create `apps/game/src/persistence/create-indexeddb-city-save-repository.ts`
- Create clock/id/seed browser adapters.
- Tests primarily browser-level for real IndexedDB.

- [ ] RED real browser repository save/load/list/latest/remove and unsupported/corrupt record behavior.
- [ ] Implement database/open upgrade/store/index constants; complete-record readwrite transaction; structured clone plain data.
- [ ] Implement `Clock`, `IdSource`, `SeedSource` adapters using Date/crypto only here.
- [ ] GREEN browser repository spec + typecheck.
- [ ] Commit `feat(game): persist canonical city saves in indexeddb`.

### Task 5: UI design tokens and reusable primitives

**Files:**
- Refactor `apps/game/src/style.css` into token-led styles while keeping entry file stable.
- Create focused `ui/primitives/*` factories.
- App tests/browser assertions for accessible labels/focus/target sizes.

- [ ] RED UI contract assertions.
- [ ] Implement tokens/primitives; no component framework, no raw repeated colors in new screen modules.
- [ ] GREEN lint/typecheck/browser accessibility basics.
- [ ] Commit `feat(game): add clean application ui primitives`.

### Task 6: Home / New City / Load City screens

**Files:** `apps/game/src/ui/screens/*` plus coordinator/router-like app presentation module.

- [ ] RED browser Home empty/populated; New City validation/randomize/generate/eligible Region/create; Load list/load; Resume latest.
- [ ] Implement disposable screen factories with semantic form controls and async busy/error states.
- [ ] GREEN desktop/mobile responsive browser tests.
- [ ] Commit `feat(game): add city lifecycle screens`.

### Task 7: Production Game screen/runtime composition

**Files:** focused composition modules for live city presentation, game screen, debug panel.

- [ ] RED entering city creates 64 Terrain sectors, camera/input/picker/debug overlay; Save works; exit disposes presentation/input; returning Home retains durable save.
- [ ] Implement scene/presentation assembly from `LiveCitySession` and app system capabilities. No orchestration logic in `create-game.ts`.
- [ ] GREEN browser integration/typecheck/architecture.
- [ ] Commit `feat(game): compose live city terrain experience`.

### Task 8: Async bootstrap

**Files:** `apps/game/src/bootstrap/main.ts`, `apps/game/src/composition/create-game.ts`, bootstrap browser tests.

- [ ] RED startup Home instead of minimal shell, repository startup failure stable error, pagehide only disposes resources (does not save).
- [ ] Implement async `createGame()` lifecycle with explicit disposed guard.
- [ ] GREEN bootstrap/browser tests.
- [ ] Commit `feat(game): boot persistent city application`.
