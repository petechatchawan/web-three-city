# Terrain Seed + Snapshot Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Terrain generation accept any valid Seed64, preserve the golden regression vector, and add canonical World/Terrain snapshot restore round trips.

**Architecture:** World owns map/profile identity and MapState; Terrain owns Seed64 validation, deterministic generation, fingerprinting, canonical elevation snapshots, and restore validation. App/orchestration may construct/restore only through composition surfaces. No presentation state is persisted.

**Tech Stack:** TypeScript 5.9, Vitest 3.2, pnpm 10.15.1.

**Spec:** `docs/superpowers/specs/2026-08-30-terrain-product-integration-v1-design.md`

## Global Constraints

- Node 22.18.0.
- TDD before production behavior changes.
- No `acceptedTerrainSeeds` in World after this plan.
- Golden `0x5EED5EED5EED5EED -> 0xF2FA29BFD2AEB069` remains exact.
- No hardcoded map dimensions in new code; derive from MapDefinition/World topology owners.
- Snapshot restore never regenerates existing-city Terrain.
- Architecture checker must remain at zero violations.

---

### Task 1: Move Seed64 ownership fully into Terrain

**Files:**
- Modify: `systems/world/src/domain/map-definition.ts`
- Modify: `systems/world/src/application/prepare-world-definition.ts`
- Modify: `systems/world/src/contracts/world-read.ts`
- Modify: `systems/world/tests/map-region.test.ts`
- Modify: `systems/world/tests/composition.test.ts`
- Modify: `systems/terrain/src/contracts/generation.ts`
- Modify: `systems/terrain/src/application/prepare-production-terrain.ts`
- Modify: `systems/terrain/tests/suitability.test.ts`
- Modify: `systems/terrain/tests/generation-production.test.ts`

**Interfaces:**
- Produces: `prepareProductionTerrain({world, seed64})` accepting any canonical-valid 64-bit hex string.
- Removes: World seed whitelist and `TERRAIN_GENERATION_SEED_NOT_ACCEPTED` / fingerprint-as-global-constant rejection.

- [ ] **Step 1: Write RED World tests** asserting `MapDefinitionRead` no longer exposes `acceptedTerrainSeeds` and production definition does not validate a seed catalog.
- [ ] **Step 2: Write RED Terrain tests** for lowercase canonicalization, two independently generated arbitrary seeds producing deterministic repeatable fingerprints, invalid format rejection, no hidden retry, and golden fingerprint preservation.
- [ ] **Step 3: Run RED:** `pnpm --filter @web-three-city/world test && pnpm --filter @web-three-city/terrain exec vitest run tests/suitability.test.ts tests/generation-production.test.ts`.
- [ ] **Step 4: Implement minimal ownership change.** Keep `canonicalSeed64()` in Terrain; remove whitelist membership and global `EXPECTED_FINGERPRINT` runtime rejection. Return computed fingerprint for every successful seed. Preserve output-envelope/no-eligible-start rejection.
- [ ] **Step 5: GREEN:** rerun focused tests, both package typechecks, and `pnpm architecture:check`.
- [ ] **Step 6: Commit:** `feat(terrain): accept deterministic seed64 generation`.

### Task 2: Add deterministic World restore

**Files:**
- Modify: `systems/world/src/contracts/world-read.ts`
- Modify: `systems/world/src/application/create-map-state.ts`
- Modify/Create: `systems/world/src/application/restore-map-state.ts`
- Modify: `systems/world/src/composition/create-world.ts`
- Modify: `systems/world/src/composition.ts`
- Modify: `systems/world/tests/composition.test.ts`
- Modify: `systems/world/tests/public-surface.test.ts`

**Interfaces:**
```ts
export interface RestoreWorldInput {
  readonly prepared: PreparedWorldDefinition;
  readonly snapshot: MapStateSnapshot;
}
export function restoreWorldSystem(input: RestoreWorldInput): WorldConstructionResult<WorldSystem>;
```

- [ ] **Step 1: RED tests** for exact create->snapshot->restore->snapshot equality plus wrong map/profile, unknown/duplicate/unordered unlocked Regions, missing starting Region, and starting Region not unlocked.
- [ ] **Step 2: Run RED:** `pnpm --filter @web-three-city/world test`.
- [ ] **Step 3: Implement pure snapshot validation** using MapDefinition region order as canonical order. Reuse existing MapState read shape; do not mutate input arrays.
- [ ] **Step 4: Wire `restoreWorldSystem` through `./composition` only.** Root exports snapshot/input/result types but no construction function.
- [ ] **Step 5: GREEN:** World tests/typecheck + architecture.
- [ ] **Step 6: Commit:** `feat(world): restore canonical map state snapshots`.

### Task 3: Capture canonical Terrain snapshots

**Files:**
- Create: `systems/terrain/src/contracts/snapshot.ts`
- Create: `systems/terrain/src/application/capture-terrain-snapshot.ts`
- Modify: `systems/terrain/src/domain/terrain-state.ts`
- Modify: `systems/terrain/src/contracts/terrain-composition.ts`
- Modify: `systems/terrain/src/composition/create-terrain.ts`
- Modify: `systems/terrain/src/index.ts`
- Test: `systems/terrain/tests/snapshot.test.ts`

**Interfaces:**
```ts
TerrainStateSnapshotV1 {
  snapshotVersion: 1;
  mapDefinitionId: string;
  generationProfileId: string;
  generationProfileVersion: number;
  selectedSeed64: string;
  fingerprint: string;
  revision: number;
  completeness: "partial" | "full";
  chunks: readonly TerrainChunkSnapshot[];
}
TerrainSystem.captureSnapshot(): TerrainStateSnapshotV1;
```

- [ ] **Step 1: RED tests** for 256 canonical chunk order, exactly 263,169 full-map owned vertices serialized once, canonical `(z,x)` owner-window elevation order, mutation revision preservation, provenance fields, and JSON absence of Three/debug/camera keys.
- [ ] **Step 2: Run RED:** `pnpm --filter @web-three-city/terrain exec vitest run tests/snapshot.test.ts`.
- [ ] **Step 3: Add fingerprint to Terrain provenance/construction input** so snapshots do not recompute or infer provenance. Update preparation->construction callers/tests explicitly.
- [ ] **Step 4: Implement pure capture** from private TerrainState with explicit sorted copies and owner-window decoding helpers; no Map iteration-order authority.
- [ ] **Step 5: Expose `captureSnapshot()` on full `TerrainSystem`, not read-only `TerrainAuthoritySystem` unless required by tests.**
- [ ] **Step 6: GREEN:** snapshot + Terrain full regression/typecheck/architecture.
- [ ] **Step 7: Commit:** `feat(terrain): capture canonical terrain snapshots`.

### Task 4: Restore canonical Terrain without regeneration

**Files:**
- Modify: `systems/terrain/src/contracts/snapshot.ts`
- Create: `systems/terrain/src/application/restore-terrain.ts`
- Modify: `systems/terrain/src/domain/terrain-state.ts`
- Modify: `systems/terrain/src/composition/create-terrain.ts`
- Modify: `systems/terrain/src/composition.ts`
- Test: `systems/terrain/tests/snapshot.test.ts`
- Modify: `systems/terrain/tests/public-surface.test.ts`

**Interfaces:**
```ts
export interface RestoreTerrainInput {
  readonly world: WorldSpatialRead;
  readonly mapDefinitionId: string;
  readonly snapshot: TerrainStateSnapshotV1;
}
export function restoreTerrainSystem(input: RestoreTerrainInput): TerrainConstructionResult<TerrainSystem>;
```

- [ ] **Step 1: RED tests** for deep-equal snapshot round trip, representative surface-query equality, later mutation revision `savedRevision -> savedRevision+1`, and rejection of unsupported version/map/profile/seed/fingerprint format/revision/chunk duplicate/count/elevation corruption.
- [ ] **Step 2: Run RED** snapshot suite.
- [ ] **Step 3: Add a validated TerrainState constructor that accepts explicit revision** only for restore; ordinary materialization still starts at 0.
- [ ] **Step 4: Restore owner-window chunks directly from snapshot.** Validate complete input before publishing live read/commands; never call generator.
- [ ] **Step 5: Wire composition export** and keep restore out of Terrain root/commands.
- [ ] **Step 6: GREEN:** Terrain full regression/typecheck/architecture.
- [ ] **Step 7: Commit:** `feat(terrain): restore canonical terrain snapshots`.

### Task 5: Seed/snapshot release checkpoint

- [ ] Run `pnpm --filter @web-three-city/world test`.
- [ ] Run `pnpm --filter @web-three-city/terrain test`.
- [ ] Run `pnpm typecheck && pnpm architecture:check`.
- [ ] Audit no `acceptedTerrainSeeds` in production code/docs and no restore path calls `generateProductionTerrainField`.
- [ ] Record exact HEAD and clean worktree before moving to debug visualization.
