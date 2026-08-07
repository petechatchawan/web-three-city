# Architecture and Infrastructure Upgrade v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incrementally enforce package boundaries, make application coordination explicit, reduce `game-bootstrap.ts` coupling, and make targeted verification and browser CI faster without changing gameplay, deterministic simulation, or Save compatibility.

**Architecture:** Keep `*-core` as deterministic domain authority and `*-three` as presentation adapters. Add deep application modules inside `apps/game` for complete committed-world publication, transaction coordination, Save/Load ownership, dependent-world Undo, tick coordination, and presentation synchronization. Extract one responsibility at a time; never replace the bootstrap hub with another God Coordinator.

**Tech Stack:** TypeScript 6, Node.js 22+, pnpm 10.13.1, Vitest 4, Node `node:test`, ESLint 9, Prettier 3, Playwright 1.61, Vite 8, Three.js 0.185.

## Global Constraints

- Preserve modular monolith architecture; do not introduce microservices.
- `*-core` packages own deterministic domain state and must not depend on DOM, browser UI, `apps/*`, or `*-three`.
- `*-three` packages consume domain snapshots and must not own authoritative gameplay state.
- `apps/game` owns application composition and cross-system coordination.
- Existing gameplay behavior, deterministic tick ordering, Save schemas, migration behavior, and Undo semantics must remain behaviorally equivalent unless a separately approved ADR changes them.
- `master` is the always-releasable trunk; use short-lived branches and pull requests; do not create `develop`.
- Use package-targeted Level 0/1 verification during implementation.
- Public/exported/Save-facing changes require Level 2 owner plus affected consumers from `AGENTS.md`.
- Root, workspace, tooling, TypeScript, ESLint, Prettier, pnpm, CI, and development-dependency changes require Level 3 `pnpm verify` before PR finalization.
- Browser, release, or milestone closure requires Level 4 `pnpm verify:full` on the exact clean candidate head.
- Targeted RED/GREEN commands before commit are inner-loop evidence only. Every implementation PR runs its required final escalation after its candidate commit: `test -z "$(git status --porcelain=v1 --untracked-files=all)"` must pass, `git rev-parse HEAD` records exact head, then Level 3 runs `pnpm verify`; Level 4 runs `pnpm verify:full`. No pre-commit pass qualifies as merge evidence.
- Do not run repository-wide verification as the normal edit loop.
- Save and Load must read and publish one coherent committed world.
- Undo must restore dependent state coherently; one-domain snapshot restoration is not sufficient when dependent state is retired or reconciled.
- No implementation PR may modify runtime code as part of the Planning PR.
- No Nx, Turborepo, generic event bus, or DI framework enters the repository without a measured comparison and accepted ADR.
- Required living documentation belongs in the same implementation PR as behavior or boundary changes.
- The AGENTS static Level 2 map remains conservative verification policy and is not silently replaced by an automatically generated graph.

---

## File Map

### Planning PR files

- Create: `docs/systems/architecture-infrastructure/README.md` - current handoff and planning authority.
- Create: `docs/systems/architecture-infrastructure/specs/2026-08-07-architecture-infrastructure-upgrade-v0-1.md` - approved target architecture and program scope.
- Create: `docs/systems/architecture-infrastructure/adrs/0001-application-orchestration-seam.md` - application coordination decision.
- Create: `docs/systems/architecture-infrastructure/adrs/0002-complete-world-publication-and-dependent-undo.md` - complete publication, Save, and Undo decision.
- Create: `docs/systems/architecture-infrastructure/adrs/0003-repository-native-boundary-enforcement.md` - lightweight enforcement decision.
- Create: `docs/systems/architecture-infrastructure/adrs/0004-layered-targeted-verification-and-ci.md` - verification and CI decision.
- Create: `docs/systems/architecture-infrastructure/verification/2026-08-07-architecture-infrastructure-phase-1-baseline.md` - measured audit evidence.
- Create: `docs/systems/architecture-infrastructure/tdd/2026-08-07-architecture-infrastructure-upgrade-v0-1.md` - this implementation plan.
- Modify: `docs/systems/README.md` - register Architecture and Infrastructure as approved but not implemented.

### Future implementation files

- Create: `tooling/architecture-boundary.test.mjs` - repository-native graph and layer contract test.
- Create: `tooling/architecture-fixtures/` - synthetic cycle, undeclared dependency, deep-import, DOM, and browser-import fixtures used to prove scanner failures are non-vacuous.
- Create: `apps/game/src/application/committed-world.ts` - complete committed-world interface and store seam.
- Create: `apps/game/src/application/committed-world.test.ts` - publication and revision tests.
- Create: `apps/game/src/application/committed-world-fingerprint.ts` - canonical domain/provenance content fence.
- Create: `apps/game/src/application/world-transaction-coordinator.ts` - staged cross-system publication seam.
- Create: `apps/game/src/application/world-transaction-coordinator.test.ts` - transaction and rollback tests.
- Create: `apps/game/src/application/save-coordinator.ts` - single storage and Load command owner.
- Create: `apps/game/src/application/save-coordinator.test.ts` - one-command ownership and Save/Load tests.
- Create: `apps/game/src/application/undo-coordinator.ts` - dependent-world Undo command seam.
- Create: `apps/game/src/application/undo-coordinator.test.ts` - dependent-state restoration tests.
- Create: `apps/game/test/application-fixtures.ts` - test-only complete-world fixtures, storage doubles, and scenario result types.
- Create: `apps/game/test/fixtures/world-save-rci-expected.ts` - independent literal V1-V4 migration expectations.
- Create: `apps/game/src/application/presentation-coordinator.ts` - committed-world presentation synchronization.
- Create: `apps/game/src/application/presentation-coordinator.test.ts` - post-publication and recovery tests.
- Create: `browser-tests/helpers/domain-fixtures.ts` - one explicit browser fixture seam.
- Create: `tooling/test-topology.test.mjs` - test discovery and execution contract checks.
- Modify: `package.json` - register architecture/test topology checks only in implementation PRs.
- Modify: `AGENTS.md` - only when an implementation changes dependency relationships or policy.
- Modify: `apps/game/src/game-bootstrap.ts` - bounded extraction commits only.
- Modify: `apps/game/src/main.ts` - consume committed-world snapshots/subscriptions and remove duplicate Save/Load and renderer-derived authority reads.
- Modify: `apps/game/src/game-world-state.ts` - migrate partial store to the approved committed-world seam.
- Modify: `apps/game/src/game-world-tick.ts` - consume application committed-world seam without moving orchestration into core.
- Modify: `apps/game/src/world-save.ts` - only command ownership/wiring; preserve codec and schemas.
- Modify: `apps/game/src/world-undo.ts` - only after dependent-world Undo contract is characterized.
- Modify: `packages/rci-core/src/rci-tick.ts` - add exact Building after-state commit fencing.
- Modify: `packages/rci-core/test/rci-tick-foundation.test.ts` or create `packages/rci-core/test/rci-tick-consistency.test.ts` - RCI fence tests.
- Modify: `apps/game/vitest.config.ts` and `apps/game/tsconfig.json` - include current `apps/game/test` tests.
- Modify: browser spec files only to move fixture construction behind the explicit helper seam and add ownership tags.
- Modify: `playwright.config.ts` and `.github/workflows/ci.yml` - relevant projects and artifact reuse after measurements.

---

## Phase Mapping

| Program phase | Planning or implementation tasks |
|---|---|
| Phase 1 - Architecture Baseline and Dependency Audit | Planning PR baseline record and audit evidence; no runtime task |
| Phase 2 - Architecture Boundary Enforcement | Tasks 1-2 |
| Phase 3 - Application / Orchestration Layer Design | Task 4 defines the committed-world seam; Task 5 implements it after approval |
| Phase 4 - Incremental Game Bootstrap Decomposition | Tasks 5-7, one bounded extraction at a time |
| Phase 5 - Test and CI Architecture v0.2 | Task 3 closes the existing Game test discovery gap; Tasks 8-9 add browser classification and CI reuse |
| Phase 6 - Architecture Closure and Performance Baseline | Task 10 |

Task 3 is intentionally executed before runtime extraction because hidden tests must become visible before they are used as characterization evidence. It does not change gameplay behavior.
Its commit may be stacked early as a prerequisite, but PR grouping follows the spec's implementation slices and keeps Task 3 in the Test/CI PR rather than treating it as a separate runtime PR.

---

### Task 1: Add Repository-Native Architecture Contract Tests

**Files:**
- Create: `tooling/architecture-boundary.test.mjs`
- Create: `tooling/architecture-fixtures/graph-violations/pnpm-workspace.yaml`
- Create: `tooling/architecture-fixtures/graph-violations/package.json`
- Create: `tooling/architecture-fixtures/graph-violations/packages/fixture-a/package.json`
- Create: `tooling/architecture-fixtures/graph-violations/packages/fixture-a/src/index.ts`
- Create: `tooling/architecture-fixtures/graph-violations/packages/fixture-b/package.json`
- Create: `tooling/architecture-fixtures/graph-violations/packages/fixture-b/src/index.ts`
- Create: `tooling/architecture-fixtures/graph-violations/packages/fixture-core/package.json`
- Create: `tooling/architecture-fixtures/graph-violations/packages/fixture-core/src/index.ts`
- Create: `tooling/architecture-fixtures/graph-violations/packages/fixture-domain/package.json`
- Create: `tooling/architecture-fixtures/graph-violations/packages/fixture-domain/src/index.ts`
- Create: `tooling/architecture-fixtures/graph-violations/packages/fixture-domain/src/internal.ts`
- Modify: `package.json` `scripts.test:deployment` in Implementation PR 1 only.
- Modify: `tooling/verification-scripts.test.mjs` with verification ordering assertions.
- Test: `tooling/architecture-boundary.test.mjs`

**Interfaces:**
- Consumes: `pnpm-workspace.yaml`, every workspace `package.json`, `tsconfig*.json`, production `.ts` imports, and browser-test imports.
- Produces: deterministic reports for undeclared workspace imports, cycles, package-to-app imports, core-to-presentation imports, and deep production imports. Later tasks extend the same scanner with core DOM configuration and browser fixture location rules.

- [ ] **Step 1: Write failing graph contract tests**

Add tests with these exact observable contracts:

```js
test('production workspace graph is declared and acyclic', async () => {
  const graph = await readRepositoryGraph();
  assert.deepEqual(graph.undeclaredWorkspaceImports, []);
  assert.deepEqual(graph.deepProductionImports, []);
  assert.deepEqual(graph.cycles, []);
  assert.deepEqual(graph.packageToAppImports, []);
});

test('core source has no presentation, app, or browser imports', async () => {
  const graph = await readRepositoryGraph();
  assert.deepEqual(graph.coreLayerViolations, []);
});

test('scanner detects adversarial graph fixtures', async () => {
  const graph = await readRepositoryGraph({ root: fixtureRoot('graph-violations') });
  assert.deepEqual(graph.undeclaredWorkspaceImports, ['@fixture/missing']);
  assert.deepEqual(graph.deepProductionImports, ['fixture-core -> fixture-domain/src/internal.js']);
  assert.deepEqual(graph.cycles, [['fixture-a', 'fixture-b', 'fixture-a']]);
});
```

The scanner must parse static `import`, `export ... from`, and `import()` string specifiers. It must classify workspace aliases, relative production imports, and browser fixture imports separately. It must not use a blanket regex that treats test-only imports as runtime dependencies.

- [ ] **Step 2: Run the focused RED test**

Run:

```bash
node --test tooling/architecture-boundary.test.mjs
```

Expected: FAIL because no graph scanner exists. The RED failure must come from the missing contract implementation, not from known current-state exceptions that belong to later tasks.

- [ ] **Step 3: Implement the minimum scanner**

Implement these internal functions in the same tooling module. Their returned fields must be concrete so later tasks can extend the scanner without changing its public test surface:

```js
readRepositoryGraph(options?: { root?: URL | string }) -> {
  undeclaredWorkspaceImports: string[],
  unusedRuntimeWorkspaceDependencies: string[],
  testOnlyRuntimeDependencies: string[],
  deepProductionImports: string[],
  cycles: string[][],
  packageToAppImports: string[],
  coreLayerViolations: string[],
}
readCoreTsConfigs(options?: { root?: URL | string }) -> { path: string, includesDomLib: boolean }[]
readBrowserImports(options?: { root?: URL | string }) -> { path: string, specifier: string, isDirectSourceImport: boolean }[]
workspaceNameForSpecifier(specifier) -> string | null
isForbiddenCoreSpecifier(specifier) -> boolean
findCycles(graph) -> string[][]
fixtureRoot(name) -> URL
```

Use `node:fs/promises`, `node:path`, `node:url`, `node:assert/strict`, and `node:test` only. Read the repository tree from `import.meta.url`; do not invoke a third-party graph framework.

`readBrowserImports().path` and `.specifier` are normalized repository-relative paths. The browser contract must compare this single DTO shape; do not introduce a second field name for the imported target.

- [ ] **Step 4: Run GREEN for the scanner implementation**

Run:

```bash
node --test tooling/architecture-boundary.test.mjs
```

Expected: PASS for the production graph contract. Do not add the DOM or browser-fixture assertions until the task that resolves each known current-state violation; a committed implementation slice must not leave the registered repository gate red.

- [ ] **Step 5: Register the scanner before recursive package tests**

Prepend `tooling/architecture-boundary.test.mjs` to the explicit `node --test` file list in root `package.json` `scripts.test:deployment`. Change root `scripts.check` ordering so `pnpm test:deployment` runs before recursive `pnpm test`; do not replace existing tooling tests or add the scanner to pre-commit.

Add this ordering contract to `tooling/verification-scripts.test.mjs`:

```js
test('architecture and deployment contracts run before recursive package tests', async () => {
  const packageJson = await readRepoJson('package.json');
  const deployment = packageJson.scripts['test:deployment'];
  const check = packageJson.scripts.check;
  assert.ok(deployment.indexOf('tooling/architecture-boundary.test.mjs') < deployment.indexOf('tooling/development-workflow.test.mjs'));
  assert.ok(check.indexOf('pnpm test:deployment') < check.indexOf('pnpm test'));
});
```

- [ ] **Step 6: Run affected verification and commit**

Run:

```bash
node --test tooling/architecture-boundary.test.mjs
pnpm --filter @web-three-city/game typecheck
pnpm --filter @web-three-city/rci-core typecheck
```

Commit:

```bash
git add tooling/architecture-boundary.test.mjs tooling/architecture-fixtures/graph-violations package.json tooling/verification-scripts.test.mjs
git commit -m "test(workflow): enforce architecture boundaries"

set -euo pipefail
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git rev-parse HEAD
pnpm verify
```

Final escalation: Level 3 because root tooling and package scripts changed. Do not run Level 4 unless the implementation PR changes browser-visible behavior or is designated milestone closure.

---

### Task 2: Close Known Manifest and Core Type Boundaries

**Files:**
- Modify: `packages/rci-core/package.json`
- Modify: `packages/shared-testkit/package.json`
- Modify: `packages/world-core/tsconfig.json`
- Modify: `packages/simulation-core/tsconfig.json`
- Modify: `packages/terrain-core/tsconfig.json`
- Modify: `packages/water-core/tsconfig.json`
- Modify: `packages/road-core/tsconfig.json`
- Modify: `packages/zone-core/tsconfig.json`
- Modify: `packages/building-core/tsconfig.json`
- Modify: `packages/rci-core/tsconfig.json`
- Modify: `packages/terrain-generator/tsconfig.json`
- Modify: `pnpm-lock.yaml` after manifest edits; no lockfile change belongs in Planning PR.
- Create: `tooling/architecture-fixtures/dom-config/tsconfig.base.json`
- Create: `tooling/architecture-fixtures/dom-config/fixture-core/tsconfig.json`
- Test: `tooling/architecture-boundary.test.mjs`

**Interfaces:**
- Consumes: Task 1 graph scanner and current production/test import classification.
- Produces: manifests that distinguish runtime from test-only dependencies and core TypeScript configs that do not inherit DOM libraries.

- [ ] **Step 1: Add failing assertions for known manifest drift**

Extend the contract test:

```js
test('runtime manifest dependencies match production imports', async () => {
  const graph = await readRepositoryGraph();
  assert.deepEqual(graph.unusedRuntimeWorkspaceDependencies, []);
  assert.deepEqual(graph.testOnlyRuntimeDependencies, []);
});

test('core TypeScript configs do not provide DOM libraries', async () => {
  const configs = await readCoreTsConfigs();
  for (const config of configs) assert.equal(config.includesDomLib, false, config.path);
});

test('core DOM detector catches synthetic inherited and explicit DOM configs', async () => {
  const configs = await readCoreTsConfigs({ root: fixtureRoot('dom-config') });
  assert.deepEqual(
    configs.filter((config) => config.includesDomLib).map((config) => config.path),
    ['fixture-core/tsconfig.json'],
  );
});
```

Expected RED findings:

- `@web-three-city/zone-core` is unused by `rci-core` production source.
- `@web-three-city/terrain-generator` is imported by `shared-testkit` tests rather than runtime source.
- every listed core config inherits DOM through `tsconfig.base.json` instead of declaring a non-DOM library set.

- [ ] **Step 2: Run the RED test**

Run:

```bash
node --test tooling/architecture-boundary.test.mjs
```

Expected: FAIL with both exact package names.

- [ ] **Step 3: Correct manifest classifications**

Remove `@web-three-city/zone-core` from `packages/rci-core/package.json` dependencies. Move `@web-three-city/terrain-generator` from `packages/shared-testkit/package.json` `dependencies` to `devDependencies`. Run `pnpm install --lockfile-only` to update importer metadata in `pnpm-lock.yaml`; do not change any source import or package export. The lockfile change is part of Implementation PR 1, never Planning PR.

- [ ] **Step 4: Add explicit non-DOM libraries to core configs**

For each core/domain `tsconfig.json` listed above, preserve `extends` and `noEmit`, then add:

```json
"compilerOptions": {
  "noEmit": true,
  "lib": ["ES2022"]
}
```

If a config already contains `compilerOptions`, add `lib` without removing existing options. Do not change the shared base config in this task. The application and presentation packages retain their current DOM-compatible configuration.

- [ ] **Step 5: Run focused GREEN verification**

Run:

```bash
node --test tooling/architecture-boundary.test.mjs
pnpm --filter @web-three-city/world-core typecheck
pnpm --filter @web-three-city/simulation-core typecheck
pnpm --filter @web-three-city/terrain-core typecheck
pnpm --filter @web-three-city/water-core typecheck
pnpm --filter @web-three-city/road-core typecheck
pnpm --filter @web-three-city/zone-core typecheck
pnpm --filter @web-three-city/building-core typecheck
pnpm --filter @web-three-city/rci-core typecheck
pnpm --filter @web-three-city/terrain-generator typecheck
```

Expected: all pass and the graph contract no longer reports the two manifest violations.

- [ ] **Step 6: Update ownership evidence and commit**

If dependency relationships changed the affected consumer set, update the corresponding rows in `AGENTS.md` in this same PR. If no consumer relationship changed, record that fact in the PR body and leave the static map unchanged.

Run:

```bash
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/shared-testkit test
pnpm --filter @web-three-city/shared-testkit typecheck
```

Commit:

```bash
git add packages/rci-core/package.json packages/shared-testkit/package.json packages/world-core/tsconfig.json packages/simulation-core/tsconfig.json packages/terrain-core/tsconfig.json packages/water-core/tsconfig.json packages/road-core/tsconfig.json packages/zone-core/tsconfig.json packages/building-core/tsconfig.json packages/rci-core/tsconfig.json packages/terrain-generator/tsconfig.json pnpm-lock.yaml tooling/architecture-boundary.test.mjs tooling/architecture-fixtures/dom-config AGENTS.md
git commit -m "build(architecture): close package boundary drift"

set -euo pipefail
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git rev-parse HEAD
pnpm verify
```

Final escalation: Level 3 for workspace and TypeScript configuration. Add Level 2 only if a public package dependency or exported contract changed.

---

### Task 3: Include All Existing Game Unit Tests in Normal Verification

**Files:**
- Modify: `apps/game/vitest.config.ts`
- Modify: `apps/game/tsconfig.json`
- Create: `tooling/test-topology.test.mjs`
- Modify: `package.json` `scripts.test:deployment`
- Test: `apps/game/test/road-release-contract.test.ts`
- Test: `apps/game/test/road-preview-label.test.ts`

**Interfaces:**
- Consumes: existing `apps/game/test` files and the current Vitest/happy-dom setup.
- Produces: normal `pnpm --filter @web-three-city/game test` coverage of 49 files and 204 tests, plus a contract preventing the directory from silently dropping out again.

- [ ] **Step 1: Write the failing topology contract**

Create `tooling/test-topology.test.mjs` with this contract:

```js
test('Game Vitest includes both source and test directories', async () => {
  const config = await readRepoText('apps/game/vitest.config.ts');
  assert.match(config, /src\/\*\*\/\*\.test\.ts/);
  assert.match(config, /test\/\*\*\/\*\.test\.ts/);
});

test('Game TypeScript includes browser-independent game test helpers', async () => {
  const config = await readRepoText('apps/game/tsconfig.json');
  assert.match(config, /"include"\s*:\s*\[[^\]]*"test"/s);
});

test('Game test inventory matches discovered files and tests', async () => {
  const inventory = await readGameTestInventory();
  assert.equal(inventory.files, 49);
  assert.equal(inventory.tests, 204);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
node --test tooling/test-topology.test.mjs
```

Expected: FAIL because current configs include only `src`.

- [ ] **Step 3: Add the two existing directories**

Change `apps/game/vitest.config.ts` to include exactly:

```ts
include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
```

Change `apps/game/tsconfig.json` to include exactly:

```json
"include": ["src", "test", "vite.config.ts"]
```

Do not move or rewrite the seven existing tests.

- [ ] **Step 4: Run GREEN and record new counts**

Run:

```bash
node --test tooling/test-topology.test.mjs
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
```

Expected: 49 Game test files and 204 Game tests pass. The topology contract discovers the inventory rather than trusting a command's aggregate output; update expected counts only when the discovered test inventory actually changes.

- [ ] **Step 5: Register and commit**

Insert `tooling/test-topology.test.mjs` immediately after `tooling/architecture-boundary.test.mjs` in `scripts.test:deployment`; keep both before the existing deployment test list, run `pnpm --filter @web-three-city/game test`, then commit:

```bash
git add apps/game/vitest.config.ts apps/game/tsconfig.json tooling/test-topology.test.mjs package.json
git commit -m "test(game): include all unit test directories"

set -euo pipefail
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git rev-parse HEAD
pnpm verify
```

Final escalation: Level 3 because workspace test/typecheck configuration and repository tooling changed.

---

### Task 4: Introduce Complete Committed-World Application Seam

**Files:**
- Create: `apps/game/src/application/committed-world.ts`
- Create: `apps/game/src/application/committed-world.test.ts`
- Modify: `apps/game/src/game-world-state.ts`
- Modify: `apps/game/src/game-world-state.test.ts`
- Test: `apps/game/src/world-save-v5.test.ts`

**Interfaces:**
- Consumes: Terrain, Water, Road, Zone, Building, Simulation, RCI snapshots and existing placement environment constructors.
- Produces: a single immutable `CommittedWorld` interface and revision-fenced store consumed by later application coordinators.

- [ ] **Step 1: Write failing publication tests**

Create tests equivalent to:

```ts
it('publishes all domain snapshots and derived environments in one revision', () => {
  const world = createCommittedWorld(fixtures.initialWorld);
  const store = new CommittedWorldStore(world);
  const next = createCommittedWorld({ ...fixtures.nextWorld, revision: 1 });

  const committed = store.replace(0, next);
  expect(committed.revision).toBe(1);
  expect(committed.terrain).toEqual(next.terrain);
  expect(store.snapshot().water.sourceTerrainRevision).toBe(next.terrain.revision);
  expect(committed.environments.road.terrainRevision).toBe(next.terrain.revision);
  expect(committed.environments.road.waterSourceTerrainRevision).toBe(next.terrain.revision);
  expect(committed.environments.zone.terrainRevision).toBe(next.terrain.revision);
  expect(committed.environments.zone.waterSourceTerrainRevision).toBe(next.terrain.revision);
  expect(committed.environments.zone.roadRevision).toBe(next.roads.revision);
  expect(committed.environments.building.terrainRevision).toBe(next.terrain.revision);
  expect(committed.environments.building.waterSourceTerrainRevision).toBe(next.terrain.revision);
  expect(committed.environments.building.roadRevision).toBe(next.roads.revision);
  expect(committed.environments.building.zoneRevision).toBe(next.zones.revision);
  expect(committed.roads).toEqual(next.roads);
  expect(committed.zones).toEqual(next.zones);
  expect(committed.buildings).toEqual(next.buildings);
  expect(committed.simulation).toEqual(next.simulation);
  expect(committed.rci).toEqual(next.rci);
  expect(committed.environments.building).toEqual(next.environments.building);
});

it('rejects stale or skipped revisions without changing committed state', () => {
  const store = new CommittedWorldStore(fixtures.initialWorld);
  expect(() => store.replace(1, fixtures.nextWorld)).toThrow('stale');
  expect(() => store.replace(0, { ...fixtures.nextWorld, revision: 2 })).toThrow('revision');
  expect(store.snapshot().revision).toBe(fixtures.initialWorld.revision);
});

it('does not expose mutable Terrain or Water buffers through committed state', () => {
  const source = createCommittedWorld(fixtures.initialWorld);
  const store = new CommittedWorldStore(source);
  const sourceHeight = source.terrain.heightLevels[0]!;
  const sourceMask = source.water.seaTriangleMask[0]!;
  const sourceRoadCode = source.roads.definitionCodes[0]!;
  const sourceZoneCode = source.zones.definitionCodes[0]!;
  source.terrain.heightLevels[0] = sourceHeight + 1;
  source.water.seaTriangleMask[0] = sourceMask === 0 ? 1 : 0;
  source.roads.definitionCodes[0] = sourceRoadCode === 0 ? 1 : 0;
  source.zones.definitionCodes[0] = sourceZoneCode === 0 ? 1 : 0;
  expect(store.snapshot().terrain.heightLevels[0]).toBe(sourceHeight);
  expect(store.snapshot().water.seaTriangleMask[0]).toBe(sourceMask);
  expect(store.snapshot().roads.definitionCodes[0]).toBe(sourceRoadCode);
  expect(store.snapshot().zones.definitionCodes[0]).toBe(sourceZoneCode);

  const publicHeightLevels = store.snapshot().terrain.heightLevels;
  const publicMask = store.snapshot().water.seaTriangleMask;
  const publicRoadCodes = store.snapshot().roads.definitionCodes;
  const publicZoneCodes = store.snapshot().zones.definitionCodes;
  publicHeightLevels[0] = sourceHeight + 2;
  publicMask[0] = sourceMask === 0 ? 1 : 0;
  publicRoadCodes[0] = sourceRoadCode === 0 ? 1 : 0;
  publicZoneCodes[0] = sourceZoneCode === 0 ? 1 : 0;
  expect(store.snapshot().terrain.heightLevels[0]).toBe(sourceHeight);
  expect(store.snapshot().water.seaTriangleMask[0]).toBe(sourceMask);
  expect(store.snapshot().roads.definitionCodes[0]).toBe(sourceRoadCode);
  expect(store.snapshot().zones.definitionCodes[0]).toBe(sourceZoneCode);
});
```

The concrete interface must expose `revision`, all seven domain snapshots, Water, and the three placement environments. It must not expose mutable internal arrays or a second copy of domain facts. Use copy-on-publication and copy-on-read for all four typed-array fields above. Publication may copy object graphs, so tests assert value/provenance equality rather than object identity.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm --filter @web-three-city/game test -- src/application/committed-world.test.ts
```

Expected: FAIL because the application module and complete-world store do not exist.

- [ ] **Step 3: Implement the minimum immutable seam**

Implement equivalent to this contract without coupling the module to DOM or Three.js. Clone all four typed-array fields on publication and on `snapshot()` reads; `Object.freeze` alone is not acceptable:

```ts
export interface CommittedWorld {
  readonly revision: number;
  readonly terrain: TerrainSnapshot;
  readonly water: WaterSnapshot;
  readonly roads: RoadSnapshot;
  readonly zones: ZoneSnapshot;
  readonly buildings: BuildingSnapshot;
  readonly simulation: SimulationSnapshot;
  readonly rci: RciSnapshot;
  readonly environments: Readonly<{
    readonly road: RoadPlacementEnvironment;
    readonly zone: ZonePlacementEnvironment;
    readonly building: BuildingDevelopmentEnvironment;
  }>;
}

export class CommittedWorldStore {
  snapshot(): CommittedWorld;
  replace(expectedRevision: number, next: CommittedWorld): CommittedWorld;
}

export interface GameRuntime {
  snapshot(): CommittedWorld;
  subscribeCommittedWorld(listener: (world: CommittedWorld) => void): () => void;
  advanceLogicalTick(options: { automaticGrowth: boolean }): CommittedWorld;
  dispose(): void;
}

export function createCommittedWorld(input: CommittedWorldInput): CommittedWorld;
export function createSaveCoordinator(input: SaveCoordinatorDependencies): SaveCoordinator;
export function fingerprintCommittedWorld(world: CommittedWorld): string;
```

Preserve `GameWorldStateStore` as a compatibility adapter only during migration. Do not add a second mutable source that can diverge from the new store.

`CommittedWorldStore.replace` accepts only `expectedRevision === current.revision` and `next.revision === current.revision + 1`; it rejects stale or skipped candidates without mutating the store. Derived-environment provenance fields must match the domain revisions in the candidate world.

`fingerprintCommittedWorld` canonicalizes Terrain, Water, Roads, Zones, Buildings, Simulation, RCI, and every environment provenance revision. Typed arrays become ordered byte/value arrays; object collections use stable ID ordering. Environment function identity is not fingerprinted; its revision inputs are.

Define `CommittedWorldInput` as `{ revision: number; terrain: TerrainSnapshot; water: WaterSnapshot; roads: RoadSnapshot; zones: ZoneSnapshot; buildings: BuildingSnapshot; simulation: SimulationSnapshot; rci: RciSnapshot; environments: CommittedWorld['environments'] }`, `WorldStoragePort` as `{ read(key: string): string | null; write(key: string, value: string): void }`, `SaveCoordinatorDependencies` as `{ storage: WorldStoragePort; worldStore: CommittedWorldStore; transactionCoordinator: WorldTransactionCoordinator }`, and `SaveCoordinator` as `{ save(): void; load(): Promise<WorldPublicationResult> }`. `SaveCoordinator` must read only `worldStore.snapshot()` and publish decoded data only through `transactionCoordinator.replaceFromDecodedWorld`; codecs remain in `world-save.ts`.

- [ ] **Step 4: Run GREEN and affected verification**

Run:

```bash
pnpm --filter @web-three-city/game test -- src/application/committed-world.test.ts src/game-world-state.test.ts
pnpm --filter @web-three-city/game typecheck
```

Expected: PASS. Existing Save tests remain unchanged and pass.

- [ ] **Step 5: Commit the application seam**

```bash
git add apps/game/src/application/committed-world.ts apps/game/src/application/committed-world.test.ts apps/game/src/application/committed-world-fingerprint.ts apps/game/src/game-world-state.ts apps/game/src/game-world-state.test.ts
git commit -m "refactor(game): define committed world application seam"

set -euo pipefail
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git rev-parse HEAD
pnpm verify
```

Final escalation: Level 3 because application orchestration and shared runtime state changed. Level 4 is not required unless the implementation changes browser-visible behavior in this slice.

---

### Task 5: Characterize and Fix Transaction, Save, Undo, and RCI Consistency

**Files:**
- Create: `apps/game/src/application/world-transaction-coordinator.ts`
- Create: `apps/game/src/application/world-transaction-coordinator.test.ts`
- Create: `apps/game/src/application/save-coordinator.ts`
- Create: `apps/game/src/application/save-coordinator.test.ts`
- Create: `apps/game/src/application/undo-coordinator.ts`
- Create: `apps/game/src/application/undo-coordinator.test.ts`
- Create: `apps/game/test/application-fixtures.ts`
- Create: `apps/game/test/fixtures/world-save-rci-expected.ts`
- Create: `apps/game/src/world-save-dependent-state.test.ts`
- Modify: `apps/game/src/world-save-rci-migration.test.ts`
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `apps/game/src/game-input.ts` only where command callbacks are wired
- Modify: `packages/rci-core/src/persistence/migration-inventory.ts`
- Create: `packages/rci-core/test/rci-tick-consistency.test.ts`
- Create: `packages/building-core/src/building-snapshot-fingerprint.ts`
- Modify: `packages/building-core/src/index.ts`
- Test: `packages/building-core/test/building-snapshot-fingerprint.test.ts`
- Modify: `packages/rci-core/src/rci-tick.ts`
- Modify: `apps/game/src/game-world-tick.ts`
- Modify: `apps/game/src/world-save.ts` only for command wiring, not schema.
- Modify: `apps/game/src/world-undo.ts` only for coordinator wiring.

**Interfaces:**
- Consumes: Task 4 `CommittedWorldStore`, existing domain plan/commit functions, existing Save codecs, and existing RCI registries.
- Produces: staged application publication, a tested Save/Load coordinator boundary for Task 6 routing, and dependent-world Undo semantics.

All scenario names used below must be backed by `apps/game/test/application-fixtures.ts`; tests must not hide setup in undefined helpers. That file exports `fixtures.initialWorld`, `fixtures.nextPublication`, `fixtures.worldWithBuilding`, `fixtures.invalidDecodedWorld`, `fixtures.rciPlanInput`, `fixtures.rciCommitInput`, `fixtures.invalidRciPlanInput`, and these result-producing signatures:

The same file defines test-only `PresentationTestDouble`, `StorageTestDouble`, `ToolAndUndoState`, and imports `GameTimePresentation`/domain snapshot types from their public package or application entry points. `loadLegacyFixture` and `loadLegacyFixtureWithCommercialAndIndustrialBuildings` remain in `world-save-rci-migration.test.ts` because they exercise the actual Save decoder.

```ts
export function runBulldozeSaveLoadScenario(world: CommittedWorld): Promise<{
  before: CommittedWorld;
  afterBulldoze: CommittedWorld;
  decode: { ok: boolean };
  saved: CommittedWorld;
  loaded: CommittedWorld;
}>;
export function runBulldozeTickUndoScenario(world: CommittedWorld): {
  before: CommittedWorld;
  afterBulldoze: CommittedWorld;
  afterTick: CommittedWorld;
  afterUndo: CommittedWorld;
};
export function runSaveLoadResumeScenario(world: CommittedWorld): Promise<{
  saved: CommittedWorld;
  resumed: CommittedWorld;
  continuous: CommittedWorld;
}>;
export function runCompleteWorldUndoScenario(world: CommittedWorld): {
  before: CommittedWorld;
  afterUndo: CommittedWorld;
};
export function runFailedUndoScenario(world: CommittedWorld): {
  current: CommittedWorld;
  pendingUndo: unknown;
  afterAttempt: CommittedWorld;
  pendingUndoAfterAttempt: unknown;
};
export function mutateBuildingContent(snapshot: BuildingSnapshot): BuildingSnapshot;
export function changeBuildingRevision(snapshot: BuildingSnapshot): BuildingSnapshot;
export function mutateCommittedWorldField(
  world: CommittedWorld,
  field: 'terrain' | 'water' | 'roads' | 'zones' | 'buildings' | 'simulation' | 'rci' | 'roadEnvironment' | 'zoneEnvironment' | 'buildingEnvironment',
): CommittedWorld;
export function allRciBuildingReferencesExist(world: CommittedWorld): boolean;
export function encodeCommittedWorld(world: CommittedWorld): WorldSaveV5;
export function decodeSavedPayload(value: string | null): WorldSaveV5;
export function createWorldTransactionCoordinator(
  world: CommittedWorld,
  presentation: PresentationTestDouble,
): WorldTransactionCoordinator;
export function createInstrumentedSaveCoordinator(input: SaveCoordinatorDependencies & { storage: StorageTestDouble }): SaveCoordinator & {
  decodeCount: number;
  replaceCount: number;
};
export function countingStorage(savedWorld: CommittedWorld): StorageTestDouble & {
  readCount: number;
  writeCount: number;
  lastWrittenValue: string | null;
};
export const stablePresentation: PresentationTestDouble;
export const failingOncePresentation: PresentationTestDouble;
export function runPresentationPublicationScenario(worlds: readonly CommittedWorld[]): {
  adapterUpdates: readonly string[];
};
export function restorePresentationContext(world: CommittedWorld): { derivedRoots: unknown };
export function derivePresentationRoots(world: CommittedWorld): unknown;
export function cloneToolAndUndoState(state: ToolAndUndoState): ToolAndUndoState;
export function runBackgroundGrowthPresentationUpdate(
  world: CommittedWorld,
  state: ToolAndUndoState,
): void;
export const fixtures: {
  initialWorld: CommittedWorld;
  nextWorld: CommittedWorld;
  nextPublication: WorldPublication;
  worldWithBuilding: CommittedWorld;
  savedWorld: CommittedWorld;
  invalidDecodedWorld: DecodedWorldState;
  rciPlanInput: RciTickInput;
  rciCommitInput: RciTickCommitInput;
  invalidRciPlanInput: RciTickInput;
  storage: StorageTestDouble;
  saveCoordinatorDependencies: Omit<SaveCoordinatorDependencies, 'storage'>;
  committedWorld: CommittedWorld;
  latestPresentedBuildingSnapshot: BuildingSnapshot;
  expectedCommittedTimePresentation: GameTimePresentation;
  worlds: readonly CommittedWorld[];
  toolAndUndoState: ToolAndUndoState;
};
```

`world-save-rci-migration.test.ts` defines `loadLegacyFixture(version: 1 | 2 | 3 | 4)` and `loadLegacyFixtureWithCommercialAndIndustrialBuildings(version: 3 | 4)` by starting from the existing encoded fixtures and changing only test fixture inputs; it does not change Save codecs.

It also defines `expectedRciForLegacyVersion(version, decoded): RciSnapshot` and `expectedSimulationForLegacyVersion(version, decoded): SimulationSnapshot`, imported from `apps/game/test/fixtures/world-save-rci-expected.ts`. These are independent literal snapshots from checked-in fixture values and hand-authored Building/workplace records; they must not call `createRciMigrationInventory`, `synchronizeDwellingInventory`, `synchronizeWorkplaceInventory`, or the Save decoder. Migration tests therefore assert exact nested revisions, collection contents, stable ordering, Building-to-workplace IDs, active/retired state, and V3 synthesized versus V4 decoded Simulation behavior.

`fixtures.nextPublication` is constructed as `{ baseRevision: fixtures.initialWorld.revision, baseFingerprint: fingerprintCommittedWorld(fixtures.initialWorld), nextWorld: fixtures.nextWorld, nextFingerprint: fingerprintCommittedWorld(fixtures.nextWorld) }`; mutation helpers preserve `nextWorld.revision`, while RED tests deliberately pass the original `nextFingerprint` after each mutation and assert recomputation differs.

- [ ] **Step 1: Add failing characterization tests before changing production wiring**

Add these tests with exact scenario names:

```ts
it('building bulldoze followed by immediate Save and Load remains coherent', async () => {
  const result = await runBulldozeSaveLoadScenario(fixtures.worldWithBuilding);
  expect(result.afterBulldoze.buildings.instances.length).toBeLessThan(result.before.buildings.instances.length);
  expect(result.afterBulldoze.buildings).not.toEqual(result.before.buildings);
  expect(allRciBuildingReferencesExist(result.afterBulldoze)).toBe(true);
  expect(result.decode.ok).toBe(true);
  expect(result.saved.buildings).toEqual(result.afterBulldoze.buildings);
  expect(result.saved.rci).toEqual(result.afterBulldoze.rci);
  expect(result.loaded.buildings).toEqual(result.afterBulldoze.buildings);
  expect(result.loaded.rci).toEqual(result.afterBulldoze.rci);
  expect(result.loaded.buildings).toEqual(result.saved.buildings);
  expect(allRciBuildingReferencesExist(result.loaded)).toBe(true);
});
it('building bulldoze followed by one tick and Undo restores RCI inventory', () => {
  const result = runBulldozeTickUndoScenario(fixtures.worldWithBuilding);
  expect(result.afterBulldoze.rci.employment.workplaces.some((workplace) => workplace.retiredAtTick !== null)).toBe(true);
  expect(result.afterTick.rci.employment.workplaces.some((workplace) => workplace.retiredAtTick !== null)).toBe(true);
  expect(result.afterUndo.buildings).toEqual(result.before.buildings);
  expect(result.afterUndo.rci).toEqual(result.before.rci);
});
it('legacy V1 through V2 migration does not invent Building-linked inventory', () => {
  for (const legacyVersion of [1, 2]) {
    const result = loadLegacyFixture(legacyVersion);
    expect(result.ok).toBe(true);
    expect(result.value.buildings.instances).toEqual([]);
    expect(result.value.rci).toEqual(expectedRciForLegacyVersion(legacyVersion, result.value));
    expect(result.value.simulation).toEqual(expectedSimulationForLegacyVersion(legacyVersion, result.value));
  }
});
it('legacy V3 through V4 migration materializes active commercial and industrial workplaces', () => {
  for (const legacyVersion of [3, 4]) {
    const result = loadLegacyFixtureWithCommercialAndIndustrialBuildings(legacyVersion);
    expect(result.ok).toBe(true);
    const expected = expectedRciForLegacyVersion(legacyVersion, result.value);
    const expectedSimulation = expectedSimulationForLegacyVersion(legacyVersion, result.value);
    const activeWorkplaces = result.value.rci.employment.workplaces.filter(
      (workplace) => workplace.retiredAtTick === null,
    );
    expect(activeWorkplaces.length).toBeGreaterThan(0);
    expect(
      activeWorkplaces.some((workplace) =>
        workplace.capacityProfileDefinitionId.startsWith('capacity.commercial.'),
      ),
    ).toBe(true);
    expect(activeWorkplaces.some((workplace) => workplace.capacityProfileDefinitionId.startsWith('capacity.industrial.'))).toBe(
      true,
    );
    expect(result.value.rci.revision).toBe(expected.revision);
    expect(result.value.rci.employment.revision).toBe(expected.employment.revision);
    expect(result.value.rci.employment.workplaces).toEqual(expected.employment.workplaces);
    expect(result.value.rci).toEqual(expected);
    expect(result.value.simulation).toEqual(expectedSimulation);
  }
});
it('RCI commit rejects a mismatched Building after-state', () => {
  const planned = planRciTick(fixtures.rciPlanInput);
  const changedAfter = mutateBuildingContent(fixtures.rciPlanInput.buildingsAfter);
  expect(fingerprintBuildingSnapshot(changedAfter)).not.toBe(planned.afterBuildingFingerprint);
  expect(() => commitRciTick({ ...fixtures.rciCommitInput, plan: planned, buildingsAfter: changedAfter })).toThrow(
    'rci:stale-building-plan',
  );
});
it('RCI commit rejects a changed Building after revision', () => {
  const planned = planRciTick(fixtures.rciPlanInput);
  const changedAfter = changeBuildingRevision(fixtures.rciPlanInput.buildingsAfter);
  expect(fingerprintBuildingSnapshot(changedAfter)).not.toBe(planned.afterBuildingFingerprint);
  expect(() => commitRciTick({ ...fixtures.rciCommitInput, plan: planned, buildingsAfter: changedAfter })).toThrow(
    'rci:stale-building-plan',
  );
});
it('invalid RCI plans retain both Building after-state fence fields', () => {
  const input = fixtures.invalidRciPlanInput;
  const plan = planRciTick(input);
  expect(plan.afterBuildingRevision).toBe(input.buildingsAfter.revision);
  expect(plan.afterBuildingFingerprint).toBe(fingerprintBuildingSnapshot(input.buildingsAfter));
});
it('rejects same-revision content changes in every committed-world domain and environment', () => {
  for (const field of [
    'terrain',
    'water',
    'roads',
    'zones',
    'buildings',
    'simulation',
    'rci',
    'roadEnvironment',
    'zoneEnvironment',
    'buildingEnvironment',
  ] as const) {
    const coordinator = createWorldTransactionCoordinator(fixtures.initialWorld, stablePresentation);
    const changed = mutateCommittedWorldField(fixtures.nextPublication.nextWorld, field);
    expect(fingerprintCommittedWorld(changed)).not.toBe(fixtures.nextPublication.nextFingerprint);
    expect(() => coordinator.publish({ ...fixtures.nextPublication, nextWorld: changed, nextFingerprint: fixtures.nextPublication.nextFingerprint })).toThrow(
      'world:stale-content',
    );
    expect(coordinator.snapshot()).toEqual(fixtures.initialWorld);
  }
});
it('failed complete-world replacement before publication leaves authority and presentation on the prior world', () => {
  const coordinator = createWorldTransactionCoordinator(fixtures.initialWorld, stablePresentation);
  expect(() => coordinator.replaceFromDecodedWorld(fixtures.invalidDecodedWorld)).toThrow();
  expect(coordinator.snapshot()).toEqual(fixtures.initialWorld);
  expect(stablePresentation.lastWorld).toEqual(fixtures.initialWorld);
});
it('rejects same-revision candidate content before publication', () => {
  const coordinator = createWorldTransactionCoordinator(fixtures.initialWorld, stablePresentation);
  const changed = mutateBuildingContent(fixtures.nextPublication.nextWorld);
  expect(fingerprintCommittedWorld(changed)).not.toBe(fixtures.nextPublication.nextFingerprint);
  expect(() => coordinator.publish({ ...fixtures.nextPublication, nextWorld: changed, nextFingerprint: fixtures.nextPublication.nextFingerprint })).toThrow(
    'world:stale-content',
  );
  expect(coordinator.snapshot()).toEqual(fixtures.initialWorld);
});
it('rejects a publication with a mismatched base fingerprint before publication', () => {
  const coordinator = createWorldTransactionCoordinator(fixtures.initialWorld, stablePresentation);
  expect(() =>
    coordinator.publish({
      ...fixtures.nextPublication,
      baseFingerprint: 'wrong-base-fingerprint',
    }),
  ).toThrow('world:stale-content');
  expect(coordinator.snapshot()).toEqual(fixtures.initialWorld);
});
it('post-publication presentation failure retains authority and rebuilds from committed world', () => {
  const coordinator = createWorldTransactionCoordinator(fixtures.initialWorld, failingOncePresentation);
  const result = coordinator.publish(fixtures.nextPublication);
  expect(result.presentationStatus).toBe('degraded');
  expect(result.world).toEqual(fixtures.nextPublication.nextWorld);
  expect(coordinator.snapshot()).toEqual(fixtures.nextPublication.nextWorld);
  expect(failingOncePresentation.rebuiltFrom).toEqual(fixtures.nextPublication.nextWorld);
});
it('SaveCoordinator reads storage and decodes one world exactly once', async () => {
  const storage = countingStorage(fixtures.savedWorld);
  const coordinator = createInstrumentedSaveCoordinator({
    ...fixtures.saveCoordinatorDependencies,
    storage,
  });
  const result = await coordinator.load();
  expect(result.ok).toBe(true);
  expect(storage.readCount).toBe(1);
  expect(coordinator.decodeCount).toBe(1);
});
it('SaveCoordinator writes one payload from the committed world', () => {
  const storage = countingStorage(fixtures.savedWorld);
  const coordinator = createInstrumentedSaveCoordinator({
    ...fixtures.saveCoordinatorDependencies,
    storage,
  });
  coordinator.save();
  expect(storage.writeCount).toBe(1);
  expect(decodeSavedPayload(storage.lastWrittenValue)).toEqual(encodeCommittedWorld(fixtures.savedWorld));
});
it('Save/Load/resume preserves domain revisions and RCI sequences while advancing application revision', async () => {
  const result = await runSaveLoadResumeScenario(fixtures.worldWithBuilding);
  expect(result.resumed.revision).toBe(result.saved.revision + 1);
  expect(result.resumed.terrain.revision).toBe(result.continuous.terrain.revision);
  expect(result.resumed.water.sourceTerrainRevision).toBe(result.continuous.water.sourceTerrainRevision);
  expect(result.resumed.roads.revision).toBe(result.continuous.roads.revision);
  expect(result.resumed.zones.revision).toBe(result.continuous.zones.revision);
  expect(result.resumed.buildings.revision).toBe(result.continuous.buildings.revision);
  expect(result.resumed.simulation.revision).toBe(result.continuous.simulation.revision);
  expect(result.resumed.rci.revision).toBe(result.continuous.rci.revision);
  expect(result.resumed.rci.sequences).toEqual(result.continuous.rci.sequences);
});
it('complete-world Undo restores dependent state and advances application revision', () => {
  const result = runCompleteWorldUndoScenario(fixtures.worldWithBuilding);
  expect(result.afterUndo.revision).toBe(result.before.revision + 1);
  expect(result.afterUndo.rci).toEqual(result.before.rci);
  expect(result.afterUndo.rci.sequences).toEqual(result.before.rci.sequences);
});
it('failed Undo preserves current world and pending complete-world entry', () => {
  const result = runFailedUndoScenario(fixtures.worldWithBuilding);
  expect(result.afterAttempt).toEqual(result.current);
  expect(result.pendingUndoAfterAttempt).toEqual(result.pendingUndo);
});
```

The tests must assert facts, not implementation calls: `decodeWorldSave` returns `ok`, V1-V2 produce no invented Building-linked inventory, V3-V4 produce active commercial and industrial workplaces, RCI references all exist in the Building after-state, Undo returns the previous dependent inventory, Save/Load clears transient command state, application revision advances exactly once, and the prior committed world remains unchanged after pre-publication failure.

- [ ] **Step 2: Run RED and classify each failure**

Run:

```bash
pnpm --filter @web-three-city/game test -- src/world-save-dependent-state.test.ts src/application/world-transaction-coordinator.test.ts src/application/save-coordinator.test.ts src/application/undo-coordinator.test.ts
pnpm --filter @web-three-city/rci-core test -- test/rci-tick-consistency.test.ts
```

Expected: the tests fail for real behavior reasons, not harness errors. If a test fails before reaching its assertion because its fixture cannot construct a valid world, fix the fixture and reproduce RED before production edits.

- [ ] **Step 3: Add exact after-state RCI fencing**

Add `afterBuildingRevision` and `afterBuildingFingerprint` to `RciTickPlan`. Export `fingerprintBuildingSnapshot(snapshot)` from `building-core`; it must canonicalize `revision` plus every authoritative instance field (`instanceId`, definition ID/version, origin cell, rotation, lifecycle, and lifecycle tick fields), sorting instances by `instanceId` before `JSON.stringify`.

The plan contract becomes:

```ts
interface RciTickPlan {
  readonly baseBuildingRevision: number;
  readonly afterBuildingRevision: number;
  readonly afterBuildingFingerprint: string;
  readonly proposedSnapshot: RciSnapshot;
  // existing plan fields remain unchanged
}
```

Extend `commitRciTick` validation so input `buildingsAfter.revision` and `fingerprintBuildingSnapshot(input.buildingsAfter)` match the values captured during planning. Do not compare unrelated presentation data.

The new test must prove that changing either `buildingsAfter.revision` or any canonicalized instance field after planning causes `rci:stale-building-plan` and publishes no RCI snapshot. Add the fingerprint unit test before changing RCI production code.

Update `createRciMigrationInventory` to run workplace synchronization after dwelling synchronization, using the same migrated Building snapshot and registries. Preserve V1-V4 wire decoding; V1-V2 must remain empty because their decoded Building snapshot is empty, while V3-V4 migration tests must cover active commercial and industrial workplace records. Do not introduce a new Save schema field.

- [ ] **Step 4: Implement staged world transaction coordination**

The coordinator must expose behavior equivalent to:

```ts
export interface WorldTransactionCoordinator {
  snapshot(): CommittedWorld;
  publish(plan: WorldPublication): WorldPublicationResult;
  replaceFromDecodedWorld(world: DecodedWorldState): WorldPublicationResult;
}

export interface WorldPublicationResult {
  readonly ok: true;
  readonly world: CommittedWorld;
  readonly presentationStatus: 'ready' | 'degraded';
}
```

The implementation must:

- capture one base world revision;
- stage all dependent snapshots before publication;
- validate Terrain -> Water -> Road -> Zone -> Building -> Simulation -> RCI coherence;
- publish one next revision;
- leave the previous committed world unchanged if any stage fails;
- notify presentation only after successful publication.
- if a presentation adapter fails after publication, retain the new authoritative world, report degraded state, and rebuild presentation from that committed world; never roll back domain authority after publication.

`WorldPublication` is the exact shape in the spec: `baseRevision`, `baseFingerprint`, `nextWorld`, and `nextFingerprint`. The coordinator must require `baseRevision === current.revision`, `baseFingerprint === fingerprintCommittedWorld(current)`, `nextWorld.revision === current.revision + 1`, and `nextFingerprint === fingerprintCommittedWorld(nextWorld)`. Reject a same-revision/different-content candidate as `world:stale-content`; application revision alone is not a sufficient publication fence.

Route every current mutating path through this coordinator before deleting local publication logic: Terraform (`commitTerraformPlan`), Road (`commitRoadMutation`), Zone (`commitZoneMutation`), Building develop/bulldoze (`commitBuildingMutation`), foreground tick (`executeGameWorldTick`), background Growth (`runBackgroundGrowthTick`, including `commitBuildingGrowthTick`), Load (`replaceFromDecodedWorld`), and Undo (complete before-world replacement). Add one integration test that invokes each command adapter and records exactly one coordinator publication with one monotonically increasing application revision. No command may update a domain local, derived environment, presentation adapter, or Undo entry directly after this step.

Replace the current `GameRuntime.runBackgroundGrowthTick(simulation)` API with the explicit `snapshot`/`subscribeCommittedWorld`/`advanceLogicalTick` API above. `advanceLogicalTick({ automaticGrowth: true })` uses `executeGameWorldTick` and its `commitBuildingGrowthTick` path; `automaticGrowth: false` publishes a simulation-only next world through the same coordinator. Both foreground manual stepping and webdriver/background stepping must use this API; neither may increment a local Simulation snapshot in `main.ts`.

Characterize current asymmetry before changing it: `game-bootstrap.ts:804-837` currently wraps `executeGameWorldTick`, while `main.ts:156-163` directly increments Simulation when webdriver disables automatic Growth. The new API must preserve those two user-visible modes while giving both one committed-world publication path.

Application revision is not part of `WorldSaveV5` and is not restored from storage. `replaceFromDecodedWorld` and complete-world Undo publish at `currentApplicationRevision + 1`, while preserving each decoded/restored domain revision and RCI sequence state. Save/Load/resume tests must assert this distinction explicitly.

Do not move domain policy into the coordinator. Keep domain planners in their existing packages.

- [ ] **Step 5: Implement one Save/Load command owner**

`SaveCoordinator` owns the storage key list, JSON read/write, and one Load result within the new application seam. `world-save.ts` remains responsible for encoding/decoding contracts. Keep the existing `main.ts` path as a compatibility adapter in this task; Task 6 removes its duplicate decode and proves one application command path.

The Save path must read `CommittedWorldStore.snapshot()` only. A Building bulldoze that has not reconciled RCI must not be serializable as a committed world.

Load publishes decoded domain snapshots through `WorldTransactionCoordinator.replaceFromDecodedWorld`, advances application revision once, clears transient tool/preview/selection state, and returns one committed-world result. It must preserve decoded domain revisions and RCI sequence values while leaving `WorldSaveV5` unchanged.

- [ ] **Step 6: Implement dependent-world Undo**

`UndoCoordinator` must record either a complete before-world or a deterministic reverse command. The Building path must restore RCI inventory and assignments coherently; it must not rely on the next Simulation tick to repair state.

Undo publishes the complete before-world through the same coordinator, advances application revision once, restores RCI sequence state exactly, and clears transient state that belongs to the undone command. A failed Undo leaves both the current committed world and the pending Undo entry unchanged.

Keep the existing one-entry UX. This task changes storage semantics, not the number of Undo entries or player-visible controls.

- [ ] **Step 7: Run GREEN and affected-consumer verification**

Run:

```bash
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/rci-core typecheck
pnpm --filter @web-three-city/building-core test
pnpm --filter @web-three-city/building-core typecheck
pnpm --filter @web-three-city/building-three test
pnpm --filter @web-three-city/building-three typecheck
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
```

Because RCI and Save-facing contracts changed, run the affected consumers required by `AGENTS.md`, then run the relevant Level 3 gate before PR finalization. Browser Level 4 is required if the implementation changes browser-visible Save/Undo behavior in the final candidate.

- [ ] **Step 8: Commit the consistency slice**

```bash
git add apps/game/src/application/committed-world.ts apps/game/src/application/committed-world-fingerprint.ts apps/game/src/application/world-transaction-coordinator.ts apps/game/src/application/world-transaction-coordinator.test.ts apps/game/src/application/save-coordinator.ts apps/game/src/application/save-coordinator.test.ts apps/game/src/application/undo-coordinator.ts apps/game/src/application/undo-coordinator.test.ts apps/game/test/application-fixtures.ts apps/game/test/fixtures/world-save-rci-expected.ts apps/game/src/game-bootstrap.ts apps/game/src/game-input.ts apps/game/src/game-world-tick.ts apps/game/src/world-save.ts apps/game/src/world-undo.ts apps/game/src/world-save-dependent-state.test.ts apps/game/src/world-save-rci-migration.test.ts packages/rci-core/src/rci-tick.ts packages/rci-core/src/persistence/migration-inventory.ts packages/rci-core/test/rci-tick-consistency.test.ts packages/building-core/src/building-snapshot-fingerprint.ts packages/building-core/src/index.ts packages/building-core/test/building-snapshot-fingerprint.test.ts
git commit -m "refactor(game): coordinate dependent world state"

set -euo pipefail
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git rev-parse HEAD
pnpm verify
# If this slice changes browser-visible Save/Undo behavior, run pnpm verify:full now on this clean commit.
```

The commit must contain no Save schema change and no unrelated bootstrap extraction.

---

### Task 6: Remove Duplicate Save/Load and Renderer-Derived Authority Reads

**Files:**
- Modify: `apps/game/src/main.ts`
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `apps/game/src/application/save-coordinator.ts`
- Modify: `apps/game/src/application/committed-world.ts`
- Create: `apps/game/src/application/save-coordinator.test.ts` additions
- Modify: `tooling/architecture-boundary.test.mjs`
- Test: `browser-tests/game.spec.ts`
- Test: `browser-tests/growth.spec.ts`
- Test: `browser-tests/rci.spec.ts`

**Interfaces:**
- Consumes: Task 5 Save/Load coordinator boundary and committed-world read model.
- Produces: one Load event path and application-owned committed Building reads for time UI and growth presentation decisions.

- [ ] **Step 1: Add failing duplicate-path tests**

Test these observable properties:

```ts
it('loads one decoded world through one application command', async () => {
  const coordinator = createInstrumentedSaveCoordinator({
    ...fixtures.saveCoordinatorDependencies,
    storage: fixtures.storage,
  });
  await coordinator.load();
  expect(coordinator.decodeCount).toBe(1);
  expect(coordinator.replaceCount).toBe(1);
});
it('Load button publishes one committed revision through runtime API', async () => {
  const before = await browserTimeApi.snapshot();
  await browserPage.locator('[data-action="load"]').click();
  const after = await browserTimeApi.snapshot();
  expect(after.revision).toBe(before.revision + 1);
});
it('Save button writes the encoded committed world exactly', async () => {
  const expected = await browserPage.evaluate(() => window.__WEB_THREE_CITY_TIME__!.savePayload());
  await browserPage.locator('[data-action="save"]').click();
  const actual = await browserPage.evaluate(() =>
    JSON.parse(window.localStorage.getItem('web-three-city:world-save:v5') ?? 'null'),
  );
  expect(actual).toEqual(expected);
});
it('time UI reads committed Building state rather than latest renderer state', () => {
  const model = createGameTimePresentation(
    fixtures.committedWorld.simulation,
    fixtures.committedWorld.buildings,
  );
  const rendererModel = createGameTimePresentation(
    fixtures.committedWorld.simulation,
    fixtures.latestPresentedBuildingSnapshot,
  );
  expect(model).toEqual(fixtures.expectedCommittedTimePresentation);
  expect(model).not.toEqual(rendererModel);
});
it('Save storage and decode identifiers have one application owner', async () => {
  const ownership = await readSaveLoadOwnership();
  expect(ownership.violations).toEqual([]);
});
```

Instrument the coordinator and presentation adapters with test doubles. Assert one decode, one committed-world replacement, one storage write, and statically verify that application code calls `runtime.snapshot()`/`subscribeCommittedWorld` and `createGameTimePresentation` with the committed-world projection rather than renderer storage. Add a source contract that forbids `decodeWorldSave`, `localStorage`, and direct Save-key reads outside `save-coordinator.ts` and the codec module. `browser-tests/game.spec.ts` owns the Load/Save button path tests; the test-only time API exposes committed `revision` and `savePayload()` for these assertions.

`readSaveLoadOwnership() -> { violations: string[] }` must scan production `apps/game/src/**/*.ts` while excluding `**/*.test.ts`, then exclude `application/save-coordinator.ts` and `world-save.ts` owners, and report any direct storage-key, `localStorage`, `JSON.parse` of Save payload, or `decodeWorldSave` use. This contract remains registered after Task 6 so duplicate ownership cannot return.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm --filter @web-three-city/game test -- src/application/save-coordinator.test.ts
```

Expected: FAIL because `main.ts:208-235` and `game-bootstrap.ts:947-995` currently own overlapping Load behavior and `main.ts:127-153` reads the renderer-global Building snapshot.

- [ ] **Step 3: Route Load through `SaveCoordinator`**

Keep the existing storage keys and `decodeWorldSave` contract. Move only command ownership and event wiring. `main.ts` must receive the committed Simulation/Building read model after Load rather than decoding a second copy.

`bootstrapGame` returns `GameRuntime`. `main.ts` must use `runtime.snapshot()` for `createGameTimePresentation`, subscribe once with `runtime.subscribeCommittedWorld` to refresh UI/presentation, and call `runtime.advanceLogicalTick({ automaticGrowth })` for both manual and webdriver stepping. Remove local `simulation`/`currentBuildings()` authority and the direct `latestPresentedBuildingSnapshot` read from application code.

Extend the existing `__WEB_THREE_CITY_TIME__` test API with `snapshot().revision` and `savePayload(): WorldSaveV5`; `savePayload()` must encode `runtime.snapshot()` through the same SaveCoordinator codec and must not expose a second mutable world authority.

- [ ] **Step 4: Replace renderer-global Building reads**

Change `main.ts` time presentation and construction phase logic to consume the application committed-world projection. `building-three` remains responsible for rendering and may retain internal presentation helpers for its own package tests, but application logic must not use renderer storage as authority.

- [ ] **Step 5: Run focused and browser verification**

Run:

```bash
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
pnpm exec playwright test browser-tests/game.spec.ts browser-tests/growth.spec.ts browser-tests/rci.spec.ts --project=chromium
```

Expected: Save/Load, time controls, RCI HUD, and growth behavior remain unchanged.

- [ ] **Step 6: Commit**

```bash
git add apps/game/src/main.ts apps/game/src/game-bootstrap.ts apps/game/src/application/committed-world.ts apps/game/src/application/save-coordinator.ts apps/game/src/application/save-coordinator.test.ts browser-tests/game.spec.ts browser-tests/growth.spec.ts browser-tests/rci.spec.ts tooling/architecture-boundary.test.mjs
git commit -m "refactor(game): centralize Save and committed reads"

set -euo pipefail
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git rev-parse HEAD
pnpm verify:full
```

Final escalation: Level 4 for final candidate because browser-visible Save, RCI, and growth behavior is covered by the implementation slice.

---

### Task 7: Extract Bounded Bootstrap Responsibilities

**Files:**
- Modify: `apps/game/src/game-bootstrap.ts`
- Create or modify: `apps/game/src/application/presentation-coordinator.ts`
- Create or modify: `apps/game/src/application/presentation-coordinator.test.ts`
- Create or modify: `apps/game/src/application/undo-coordinator.ts`
- Test: existing `apps/game/src/game-tool-*.test.ts`
- Test: existing `apps/game/src/*presentation.test.ts`
- Test: `browser-tests/transaction-release.spec.ts`
- Test: `browser-tests/interaction-conformance.spec.ts`

**Interfaces:**
- Consumes: Task 4 committed-world publication and Task 5/6 transaction and command seams.
- Produces: smaller bootstrap composition root with explicit presentation and per-domain application handlers.

- [ ] **Step 1: Choose one extraction from the audit order**

Start with presentation synchronization or Save/Load wiring already characterized. Do not extract arbitrary line ranges. The extraction must have one interface, one implementation owner, and one focused test surface.

- [ ] **Step 2: Write characterization tests before moving code**

For presentation synchronization, add tests equivalent to:

```ts
it('updates each presentation adapter only after committed-world publication', () => {
  const trace = runPresentationPublicationScenario(fixtures.worlds);
  expect(trace.adapterUpdates).toEqual(['after-publication']);
});
it('rebuilds all derived roots from the committed world after context restoration', () => {
  const result = restorePresentationContext(fixtures.committedWorld);
  expect(result.derivedRoots).toEqual(derivePresentationRoots(fixtures.committedWorld));
});
it('does not mutate tool or Undo state during background Growth presentation updates', () => {
  const before = cloneToolAndUndoState(fixtures.toolAndUndoState);
  runBackgroundGrowthPresentationUpdate(fixtures.committedWorld, fixtures.toolAndUndoState);
  expect(fixtures.toolAndUndoState).toEqual(before);
});
```

For tool/Undo application handlers, preserve separate Terraform, Road, Zone, and Building release semantics and test each existing controller contract.

- [ ] **Step 3: Extract one deep module**

The new module should accept explicit dependencies and committed-world callbacks. It must not import `interaction-evidence` as runtime authority, must not read renderer-global state, and must not move domain rules from core packages.

- [ ] **Step 4: Run the smallest affected loop**

Run the package test file first, then:

```bash
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
pnpm exec playwright test browser-tests/transaction-release.spec.ts browser-tests/interaction-conformance.spec.ts --project=chromium
```

- [ ] **Step 5: Inspect the diff for responsibility movement**

Confirm:

- `game-bootstrap.ts` remains a composition root rather than a second coordinator;
- no domain authority moved into `*-three`;
- no Save schema or tick ordering changed;
- no direct application read from `interaction-evidence` or renderer-global state was added;
- no generic event bus or framework dependency appeared.

- [ ] **Step 6: Commit one extraction**

```bash
git add apps/game/src/game-bootstrap.ts apps/game/src/application/presentation-coordinator.ts apps/game/src/application/presentation-coordinator.test.ts apps/game/src/application/undo-coordinator.ts apps/game/src/game-tool-hud-building.test.ts apps/game/src/game-tool-events.test.ts apps/game/src/game-tool-recovery.test.ts apps/game/src/game-tool-presentation.test.ts apps/game/src/game-tool-mode-building.test.ts apps/game/src/game-tool-hud-binding.test.ts apps/game/src/game-time-presentation.test.ts apps/game/src/zone-building-presentation.test.ts apps/game/src/game-transaction-presentation.test.ts browser-tests/transaction-release.spec.ts browser-tests/interaction-conformance.spec.ts
git commit -m "refactor(game): extract bounded presentation coordination"

set -euo pipefail
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git rev-parse HEAD
pnpm verify:full
```

Repeat this task as separate implementation commits or PRs for the next responsibility. Do not combine all bootstrap moves into one PR.

Final escalation: Level 4 for the final extraction PR because runtime and browser behavior are affected.

---

### Task 8: Constrain Browser Fixture Imports and Add Ownership Tags

**Files:**
- Create: `browser-tests/helpers/domain-fixtures.ts`
- Create: `tooling/architecture-fixtures/browser-imports/browser-tests/spec.ts`
- Modify: browser spec files currently importing `../packages/*/src` or `../apps/*/src`.
- Modify: `browser-tests/helpers/interaction.ts`
- Modify: `browser-tests/helpers/building-fixture.ts`
- Modify: `playwright.config.ts`
- Modify: `tooling/architecture-boundary.test.mjs`
- Test: all moved browser specs through targeted Playwright commands.

**Interfaces:**
- Consumes: current deterministic fixture construction from `interaction.ts`, `building-fixture.ts`, and direct-import browser specs.
- Produces: one explicit browser fixture seam and system ownership tags without changing application behavior.

- [ ] **Step 1: Add the failing direct-import location contract**

Extend the architecture test to reject direct package/app source imports from spec files. Use an exact importer allowlist during migration, not a `browser-tests/helpers/**` wildcard:

```js
const allowedBrowserSourceImportEdges = new Set([
  'browser-tests/helpers/domain-fixtures.ts -> packages/road-core/src/index.js',
  'browser-tests/helpers/domain-fixtures.ts -> packages/terrain-core/src/index.js',
  'browser-tests/helpers/domain-fixtures.ts -> packages/terrain-generator/src/index.js',
  'browser-tests/helpers/domain-fixtures.ts -> packages/water-core/src/index.js',
  'browser-tests/helpers/domain-fixtures.ts -> packages/world-core/src/index.js',
  'browser-tests/helpers/domain-fixtures.ts -> packages/zone-core/src/index.js',
  'browser-tests/helpers/domain-fixtures.ts -> apps/game/src/road-placement-environment.js',
  'browser-tests/helpers/domain-fixtures.ts -> apps/game/src/zone-placement-environment.js',
  'browser-tests/helpers/interaction.ts -> packages/camera-input/src/index.js',
  'browser-tests/helpers/interaction.ts -> packages/water-three/src/index.js',
  'browser-tests/helpers/interaction.ts -> apps/game/src/interaction-evidence.js',
  'browser-tests/terrain-lab.spec.ts -> apps/terrain-lab/src/fixture-registry.js',
  'browser-tests/terrain-lab-globals.d.ts -> apps/terrain-lab/src/bootstrap.js',
]);

test('browser specs do not construct fixtures through direct source imports', async () => {
  const imports = await readBrowserImports();
  assert.deepEqual(
    imports.filter(
      (entry) =>
        entry.isDirectSourceImport &&
        entry.path.startsWith('browser-tests/') &&
        !allowedBrowserSourceImportEdges.has(`${entry.path} -> ${entry.specifier}`),
    ),
    [],
  );
});

test('browser import scanner normalizes importer and target paths', async () => {
  const imports = await readBrowserImports({ root: fixtureRoot('browser-imports') });
  assert.deepEqual(imports, [
    {
      path: 'browser-tests/spec.ts',
      specifier: 'packages/world-core/src/index.js',
      isDirectSourceImport: true,
    },
  ]);
});
```

Use actual relative path classification and check both importer and imported module. `domain-fixtures.ts` is the only permitted owner for reusable domain fixture imports; `interaction.ts` may retain only the three explicitly listed browser harness edges; `building-fixture.ts` must retain no direct package/app source edge after Step 3; the terrain-lab fixture and `terrain-lab-globals.d.ts` ambient bootstrap edge remain explicit and isolated. Any new direct edge requires an allowlist change and reviewer-visible justification. The required behavior is that direct source imports are confined to these named seams, not that a text pattern merely disappears.

- [ ] **Step 2: Run RED**

Run:

```bash
node --test tooling/architecture-boundary.test.mjs
```

Expected: FAIL with the current spec files listed by path. Existing browser behavior is not run until the helper migration is complete.

- [ ] **Step 3: Centralize deterministic fixture construction**

Move pure fixture construction and projection helpers into `browser-tests/helpers/domain-fixtures.ts`. Move all current domain imports out of `interaction.ts` and `building-fixture.ts`; those files may retain only the exact harness edges in the contract. Keep the six package imports and two placement-environment imports listed above inside `domain-fixtures.ts` as the single reviewed integration-test seam. Do not add app implementation imports for reusable domain data; expose app browser evidence through `page.evaluate` APIs already used by the suite.

The helper must preserve these existing values and contracts:

- Game seed `1_464_156_977`.
- `WORLD_CONFIG` and deterministic Terrain/Water derivation.
- Road and Zone fixture planning.
- Camera projection and screen-cell selection behavior.
- Existing `InteractionEvidence` and `__WEB_THREE_CITY_TIME__` browser surfaces.

- [ ] **Step 4: Add title ownership tags**

Tag test titles with the approved vocabulary using Playwright's existing grep-compatible title tags:

```text
@smoke
@terrain
@water
@road
@zoning
@building
@rci
@interaction
@visual
@performance
@release
```

Every test must retain at least one domain tag. Release-only visual/performance tests receive `@release` in addition to their domain tag. Do not remove tests from the full suite.

- [ ] **Step 5: Add targeted command contract tests**

Extend tooling tests so these commands remain valid:

```bash
pnpm exec playwright test --grep @smoke --project=chromium
pnpm exec playwright test --grep @rci --project=chromium
pnpm exec playwright test --grep @release --project=chromium
pnpm exec playwright test --project=chromium
```

The full command must still collect all 121 current tests plus future additions.

Add static ownership contracts alongside the command checks:

```js
test('every browser test title has an approved ownership tag', async () => {
  const titles = await readBrowserTestTitles();
  assert.ok(titles.length >= 121);
  for (const title of titles) {
    assert.match(title, /@(terrain|water|road|zoning|building|rci|interaction)/);
    assert.match(title, /@(smoke|terrain|water|road|zoning|building|rci|interaction|visual|performance|release)/);
  }
});

test('full Chromium project has no tag exclusion', async () => {
  const project = await readPlaywrightProject('chromium');
  assert.equal(project.grep, undefined);
  assert.equal(project.grepInvert, undefined);
});

test('full Chromium list retains the current test inventory', async () => {
  const listed = await runPlaywrightList('--project=chromium');
  assert.equal(listed.testCount, 121);
});
```

`readBrowserTestTitles` must enumerate every `test`/`test.describe` title from the browser tree, and the current 121-title count must change only when the discovered test inventory changes. `readPlaywrightProject` must inspect the named full project rather than matching arbitrary config text. `runPlaywrightList` must execute Playwright `--list` against the full Chromium project; a grep subset must never be treated as full-suite evidence.

- [ ] **Step 6: Run GREEN browser verification**

Run:

```bash
node --test tooling/architecture-boundary.test.mjs
pnpm exec playwright test --grep @smoke --project=chromium
pnpm exec playwright test --grep @rci --project=chromium
pnpm exec playwright test --grep @release --project=chromium
```

The complete browser suite is the post-commit final gate below, not pre-commit evidence. Final escalation: Level 4.

- [ ] **Step 7: Commit the fixture/tag slice**

```bash
git add browser-tests/building.spec.ts browser-tests/building-visual-evidence.spec.ts browser-tests/game.spec.ts browser-tests/growth-reservation.spec.ts browser-tests/growth-visual-evidence.spec.ts browser-tests/growth.spec.ts browser-tests/interaction-conformance.spec.ts browser-tests/interaction.spec.ts browser-tests/road-operation-aware-interaction.spec.ts browser-tests/road-reversible-stroke.spec.ts browser-tests/road-visibility.spec.ts browser-tests/road-visual-evidence.spec.ts browser-tests/road.spec.ts browser-tests/rci.spec.ts browser-tests/terraform-visual-evidence.spec.ts browser-tests/terraform.spec.ts browser-tests/terrain-lab.spec.ts browser-tests/visual-evidence.spec.ts browser-tests/water.spec.ts browser-tests/zoning-visual-evidence.spec.ts browser-tests/zoning.spec.ts browser-tests/terrain-lab-globals.d.ts browser-tests/helpers/domain-fixtures.ts browser-tests/helpers/interaction.ts browser-tests/helpers/building-fixture.ts tooling/architecture-fixtures/browser-imports/browser-tests/spec.ts playwright.config.ts tooling/architecture-boundary.test.mjs
git commit -m "test(browser): add domain fixture seams and ownership tags"

set -euo pipefail
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git rev-parse HEAD
pnpm verify:full
```

---

### Task 9: Remove CI Verification Duplication Without Weakening Release Gates

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `playwright.config.ts` if project selection needs explicit names.
- Modify: `package.json` `scripts.test:deployment`
- Modify: `tooling/verification-scripts.test.mjs`
- Create or modify: `tooling/ci-topology.test.mjs`
- Modify: `docs/systems/architecture-infrastructure/verification/` timing record.

**Interfaces:**
- Consumes: Task 8 ownership tags, current Lean and Browser jobs, exact two-worker deterministic browser configuration.
- Produces: relevant browser CI selection and reusable Lean-built artifacts while preserving the full Level 4 release path.

- [ ] **Step 1: Add failing CI topology contracts**

Add assertions equivalent to:

```js
test('Lean remains the repository verification owner', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.lean.text, /pnpm check/);
  assert.match(jobs.lean.text, /node-version: 22/);
});

test('full-ci label event runs Lean before Browser', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.doesNotMatch(jobs.lean.text, /github\.event\.action\s*!=\s*['"]labeled['"]/);
  assert.match(jobs.browser.text, /contains\(github\.event\.pull_request\.labels\.\*\.name,\s*['"]full-ci['"]\)/);
  assert.match(jobs.browser.text, /needs:\s*lean/);
  assert.equal(evaluateWorkflowCondition(jobs.lean.if ?? 'true', { event: 'pull_request', action: 'labeled' }), true);
  assert.equal(
    evaluateWorkflowCondition(jobs.browser.if, {
      event: 'pull_request',
      action: 'labeled',
      labels: ['full-ci'],
    }),
    true,
  );
  assert.equal(evaluateWorkflowCondition(jobs.lean.if ?? 'true', { event: 'workflow_dispatch' }), true);
  assert.equal(evaluateWorkflowCondition(jobs.browser.if, { event: 'workflow_dispatch' }), true);
});

test('workflow triggers include labeled pull requests and manual dispatch', async () => {
  const workflow = await readRepoText('.github/workflows/ci.yml');
  assert.match(workflow, /pull_request:[\s\S]*types:\s*\[opened,\s*synchronize,\s*reopened,\s*labeled\]/);
  assert.match(workflow, /workflow_dispatch:/);
});

test('Browser job does not rerun full Lean verification after artifact reuse', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.browser.text, /needs:\s*lean/);
  assert.match(jobs.browser.text, /actions\/download-artifact@v4/);
  assert.match(jobs.browser.text, /name:\s*lean-builds/);
  assert.match(jobs.browser.text, /tar\s+-xzf\s+lean-builds\.tar\.gz/);
  assert.match(jobs.browser.text, /test\s+-d\s+apps\/game\/dist/);
  assert.match(jobs.browser.text, /test\s+-d\s+apps\/terrain-lab\/dist/);
  assert.doesNotMatch(jobs.browser.text, /pnpm verify:full/);
});

test('Lean uploads exactly the browser build artifacts', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.lean.text, /actions\/upload-artifact@v4/);
  assert.match(jobs.lean.text, /name:\s*lean-builds/);
  assert.match(jobs.lean.text, /tar\s+-czf\s+lean-builds\.tar\.gz\s+apps\/game\/dist\s+apps\/terrain-lab\/dist/);
  assert.match(jobs.lean.text, /path:\s*lean-builds\.tar\.gz/);
});

test('Browser job retains failure artifacts', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.browser.text, /if:\s*always\(\)/);
  assert.match(jobs.browser.text, /name:\s*browser-evidence/);
  assert.match(jobs.browser.text, /playwright-report/);
  assert.match(jobs.browser.text, /test-results/);
});

test('Browser job installs dependencies, restores builds, and runs browser tests', async () => {
  const jobs = await readWorkflowJobs('.github/workflows/ci.yml');
  assert.match(jobs.browser.text, /pnpm install --frozen-lockfile/);
  assert.match(jobs.browser.text, /pnpm exec playwright install chromium/);
  assert.match(jobs.browser.text, /pnpm test:browser:only/);
  assert.doesNotMatch(jobs.browser.text, /--grep/);
  assert.doesNotMatch(jobs.browser.text, /pnpm (verify|check|build(?:\b|:))/);
  assert.match(jobs.browser.text, /tar -xzf lean-builds\.tar\.gz/);
  assert.match(jobs.browser.text, /test -d apps\/game\/dist/);
  assert.match(jobs.browser.text, /test -d apps\/terrain-lab\/dist/);
});

test('Full browser release command remains available', async () => {
  const packageJson = await readRepoJson('package.json');
  assert.match(packageJson.scripts['verify:full'], /test:browser:only/);
});

test('CI topology contract runs in deployment verification', async () => {
  const packageJson = await readRepoJson('package.json');
  const deployment = packageJson.scripts['test:deployment'];
  assert.match(deployment, /tooling\/ci-topology\.test\.mjs/);
  assert.ok(deployment.indexOf('tooling/architecture-boundary.test.mjs') < deployment.indexOf('tooling/test-topology.test.mjs'));
  assert.ok(deployment.indexOf('tooling/test-topology.test.mjs') < deployment.indexOf('tooling/ci-topology.test.mjs'));
  assert.ok(deployment.indexOf('tooling/ci-topology.test.mjs') < deployment.indexOf('tooling/development-workflow.test.mjs'));
});
```

`readWorkflowJobs` must split YAML at `jobs.<name>` indentation before applying these assertions; do not use a whole-file regex that can satisfy a Browser assertion with a Lean step.

`readWorkflowJobs(path) -> { lean: { text: string, if?: string }, browser: { text: string, if?: string } }` must return only each named job block, preserving nested step text for artifact and condition assertions.
`evaluateWorkflowCondition(condition, context) -> boolean` must cover the two tested pull-request contexts and prove the labeled `full-ci` path has a successful Lean prerequisite.

- [ ] **Step 2: Run RED**

Run:

```bash
node --test tooling/ci-topology.test.mjs
```

Expected: FAIL because the current Browser job calls `pnpm verify:full` and does not download Lean artifacts.

- [ ] **Step 3: Define artifact contents**

First fix event topology: the Lean job must run when a `full-ci` label is added or updated. Remove the current Lean condition that skips `labeled` events, or move the Browser prerequisite into a workflow shape where the labeled Browser job has a successful Lean dependency. A `full-ci` label event must never run Browser with a skipped prerequisite.

Lean archives exactly the build outputs required by the two preview servers:

```text
tar -czf lean-builds.tar.gz apps/game/dist apps/terrain-lab/dist
```

Lean uploads `lean-builds.tar.gz` as artifact `lean-builds`. Browser downloads that artifact, extracts it at repository root, and asserts `apps/game/dist` and `apps/terrain-lab/dist` exist before starting preview servers. On a pull-request `full-ci` label event and on manual workflow dispatch, Browser then installs Chromium and runs exactly `pnpm test:browser:only` for all current tests. Tagged commands remain local/targeted developer loops and must not replace this release path. It must not skip package installation required to resolve Playwright.

This optimization removes duplicate Lean verification and browser builds; it does not claim to remove the Browser job's frozen dependency install. Node modules remain job-local unless a separate measured cache decision is approved.

- [ ] **Step 4: Preserve full release behavior**

Keep `pnpm verify:full` unchanged as the local Level 4 command. CI's optimized Browser job is an equivalent artifact-consuming execution path, not a replacement for local exact-head closure. The full browser job remains manually dispatchable and remains capable of running all 121 tests.

- [ ] **Step 5: Measure before and after**

Record for the same environment or CI run:

```text
Lean wall time
Browser wall time
combined wall time
install time
build time
browser test count
failure artifact availability
```

Reject the optimization if relevant coverage, build outputs, or failure artifacts are missing. Do not increase Playwright workers in this task.

- [ ] **Step 6: Run verification and commit**

Run:

```bash
node --test tooling/ci-topology.test.mjs tooling/verification-scripts.test.mjs
pnpm verify
pnpm build:browser
pnpm test:browser:only
```

Commit:

```bash
git add .github/workflows/ci.yml package.json tooling/ci-topology.test.mjs tooling/verification-scripts.test.mjs docs/systems/architecture-infrastructure/verification/2026-08-07-architecture-infrastructure-phase-1-baseline.md
git commit -m "ci: reuse lean builds for browser verification"

set -euo pipefail
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git rev-parse HEAD
pnpm verify:full
```

Final escalation: Level 4 because CI and browser release verification changed.

---

### Task 10: Record Before/After Architecture and Performance Closure

**Files:**
- Create: `docs/systems/architecture-infrastructure/verification/2026-08-07-architecture-infrastructure-v0-1-closure.md`
- Modify: `docs/systems/architecture-infrastructure/README.md`
- Modify: `docs/systems/architecture-infrastructure/specs/2026-08-07-architecture-infrastructure-upgrade-v0-1.md` only for delivery annotations; preserve design history.
- Modify: `docs/systems/architecture-infrastructure/tdd/2026-08-07-architecture-infrastructure-upgrade-v0-1.md` execution status only.

**Interfaces:**
- Consumes: completed implementation PR evidence and exact final candidate SHA.
- Produces: final architecture handoff and before/after measurements without a metadata-only post-verification tree mutation.

- [ ] **Step 1: Capture final architecture metrics**

Record actual values for:

```text
game-bootstrap.ts LOC and import count
application module LOC and interfaces
dependency cycles
forbidden layer violations
undeclared workspace imports
browser direct-import count outside helpers
normal Game test files and test count
pnpm verify wall time
relevant browser wall time
full browser wall time
```

Use command output or CI evidence. Do not insert estimates.

- [ ] **Step 2: Gather pre-candidate evidence**

Run before candidate commit:

```bash
pnpm --filter @web-three-city/rci-core test
pnpm --filter @web-three-city/rci-core typecheck
pnpm --filter @web-three-city/game test
pnpm --filter @web-three-city/game typecheck
pnpm verify
pnpm build:browser
pnpm test:browser:only
```

For Save-facing changes, record continuous-run versus Save/Load/resume equivalence and exact RCI/Building reference validation. Use this run to populate closure metrics before committing the final documentation candidate.

- [ ] **Step 3: Update closure and commit final candidate**

Run:

```bash
# Update closure record with actual Step 1/2 evidence and mark TDD execution status complete.
git diff --check
git add docs/systems/architecture-infrastructure
git commit -m "docs(architecture): record v0.1 closure plan"
```

Required living docs must already be correct before final verification starts. Do not make metadata-only edits after this commit.

- [ ] **Step 4: Establish exact candidate head**

Run:

```bash
set -euo pipefail
test -z "$(git status --porcelain=v1 --untracked-files=all)"
git rev-parse HEAD
```

Expected: clean worktree and one exact candidate SHA. This SHA is the only candidate eligible for final Level 4 verification.

- [ ] **Step 5: Run final verification on exact candidate**

Run the required Level 4 commands against the clean candidate SHA:

```bash
pnpm verify:full
```

If any command requires a source or documentation change, return to Step 3 and repeat the candidate-commit and exact-head checks before rerunning Level 4.

- [ ] **Step 6: Record post-run evidence outside the tree**

Record CI run IDs, artifact IDs, final counts, hashes, and merge evidence in the implementation PR body or comment. Do not create a metadata-only commit after successful exact-head verification.

- [ ] **Step 7: Confirm scope and merge tree**

Confirm no gameplay feature was added, no Save schema changed without approval, and the squash-merged content tree equals the verified candidate content tree.

---

## TDD and Verification Matrix

| Requirement | RED proof | GREEN inner loop | Final escalation |
|---|---|---|---|
| Layer import rules | `architecture-boundary.test.mjs` reports violations | focused Node contract test | Level 3 |
| Dependency cycles and manifest drift | graph contract fails on known drift | scanner plus package corrections | Level 3 |
| Core DOM ambient types | core config assertion fails | core package typechecks | Level 3 |
| Browser direct imports | spec path assertion lists 65 current matches | helper seam and scanner pass | Level 4 |
| Hidden Game tests | topology test sees missing `test/` include | 49 files / 204 tests pass | Level 3 |
| Complete committed world | store publication tests fail | application store tests | Level 3, Level 4 if browser behavior changes |
| RCI after-state fence | mismatched-after test commits incorrectly | `rci-core` tests | Level 2 plus final Level 3 |
| Building bulldoze Save | immediate Save/Load test fails or loads stale state | coordinator and Save tests | Level 4 |
| Building Undo dependency | tick/Undo test leaves retired inventory | Undo coordinator tests | Level 4 |
| Rollback | failure test leaves partial world | transaction coordinator tests | Level 4 |
| Duplicate Load ownership | instrumentation observes two decodes | one command path | Level 4 |
| Renderer-derived authority | application reads presentation global | committed projection tests | Level 4 |
| Browser ownership tags | tag/topology contract fails | relevant grep subsets | Level 4 |
| CI artifact reuse | workflow contract sees `verify:full` duplication | Lean/Browser artifact path | Level 4 |
| Closure metrics | missing baseline/final values | actual command evidence | exact-head Level 4 |

## Commit and PR Boundaries

Implementation PRs must remain independently reviewable:

1. Boundary scanner and manifest/type configuration (Tasks 1-2).
2. Complete committed-world seam (Task 4).
3. Transaction, Save, Undo, RCI consistency, and duplicate command/read authority removal (Tasks 5-6).
4. Bounded bootstrap extraction slices (Task 7).
5. Game test-discovery topology, browser fixture/tag, and CI artifact improvements (Tasks 3, 8-9; Task 3 may be stacked early but remains grouped here).
6. Final closure only when repository policy requires a separate artifact (Task 10).

Each commit ends with its own focused test command. Each PR updates `docs/systems/architecture-infrastructure/README.md` and affected system handoffs when behavior, ownership, persistence, or dependency direction changes.

## Final Verification

- [ ] Planning PR contains documentation only and is approved by ARB.
- [ ] Architecture contract tests pass before slow suites.
- [ ] `apps/game/test` is included in normal verification.
- [ ] Building bulldoze -> Save/Load is coherent.
- [ ] Building bulldoze -> tick -> Undo restores dependent RCI state.
- [ ] RCI validates exact Building after-state contracts.
- [ ] Complete-world failure leaves committed state unchanged.
- [ ] One Save/Load command owns storage and decode.
- [ ] Application no longer reads renderer-global Building authority.
- [ ] Browser direct imports are confined to the explicit fixture seam.
- [ ] Full browser suite remains available and passes.
- [ ] Lean/Browser timing comparison uses actual output.
- [ ] No gameplay or Save schema changes were introduced without separate approval.
- [ ] Final exact-head evidence is recorded without a metadata-only tree mutation.
- [ ] Squash-merged content tree matches the verified candidate tree.
