# Terrain Debug Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add disposable, local-rebuild Terrain debug layers for gameplay grid, sectors, vertices, triangles, normals, and elevation visualization.

**Architecture:** Reuse Terrain render-sector topology and coherent sector snapshots. Geometry-data functions are pure; Three.js resources/registry/visibility/disposal are an imperative shell separate from the production Terrain projection.

**Tech Stack:** TypeScript, Three.js 0.179.1, Vitest.

**Spec:** `docs/systems/terrain/specs/TERRAIN-DEBUG-VISUALIZATION-CONTRACT.md`

## Global Constraints

- All layers hidden by default.
- Map spacing derives from `MapDefinitionRead`; sector size from existing owner.
- No Terrain mutation from debug code.
- No full-world rebuild for local TerrainChangeSet when sector-local layer resources exist.
- Explicit disposal and idempotent teardown.

---

### Task 1: Define debug configuration, visibility, and pure geometry contracts

**Files:**
- Create: `systems/terrain/src/contracts/terrain-debug.ts`
- Create: `systems/terrain/src/presentation/three/debug/debug-config.ts`
- Create: `systems/terrain/src/presentation/three/debug/debug-geometry.ts`
- Test: `systems/terrain/tests/terrain-debug.test.ts`

**Interfaces:** `TerrainDebugVisibility`, `TerrainDebugConfig`, immutable line/point/colored-surface data arrays.

- [ ] RED tests for defaults hidden, named single owner config, map-cell spacing, canonical triangle-edge reuse, sampled normal stride, deterministic elevation normalization.
- [ ] Run RED.
- [ ] Implement pure builders over `RenderSectorLayout + SectorSurfaceSnapshot + WorldSpatialRead`.
- [ ] GREEN + typecheck.
- [ ] Commit `feat(terrain): derive terrain debug geometry`.

### Task 2: Add Three.js debug sector resources and registry

**Files:**
- Create: `systems/terrain/src/presentation/three/debug/debug-sector-resource.ts`
- Create: `systems/terrain/src/presentation/three/debug/debug-registry.ts`
- Extend: `systems/terrain/tests/terrain-debug.test.ts`

- [ ] RED tests for material sharing by layer, sector resource identity, replaced geometry disposal, hidden layer no allocation, and idempotent resource dispose.
- [ ] Implement closures/factories; no classes/modules singletons.
- [ ] GREEN + architecture.
- [ ] Commit `feat(terrain): own terrain debug resources`.

### Task 3: Orchestrate TerrainThreeDebugOverlay

**Files:**
- Create: `systems/terrain/src/presentation/three/debug/terrain-debug-overlay.ts`
- Modify: `systems/terrain/src/contracts/terrain-debug.ts`
- Modify: `systems/terrain/src/composition/create-terrain.ts`
- Modify: `systems/terrain/src/composition.ts`
- Extend tests.

**Interfaces:**
```ts
TerrainThreeDebugOverlay {
  readonly root: Group;
  visibility(): TerrainDebugVisibility;
  setVisibility(next: Partial<TerrainDebugVisibility>): void;
  rebuild(changeSet: TerrainChangeSet): void;
  dispose(): void;
}
```

- [ ] RED: creation allocates no hidden geometry; enabling one layer builds canonical 64 sectors as applicable; local mutation replaces only dirty enabled resources; disabling disposes that layer; unrelated enabled layer identities survive; stale revision rejected; dispose idempotent.
- [ ] Implement revision continuity matching production projection semantics.
- [ ] GREEN full Terrain suite/typecheck/architecture.
- [ ] Commit `feat(terrain): add terrain debug overlay lifecycle`.

### Task 4: Browser diagnostic acceptance

**Files:**
- Modify: `apps/game/tests/terrain-phase-1-harness.ts`
- Modify: `tests/browser/terrain-phase-1.spec.ts`

- [ ] RED browser assertions for debug root, cell grid visibility toggle, sector boundary toggle, representative normal/elevation mode, and no page errors through rebuild/dispose.
- [ ] Wire overlay only in technical harness at this step.
- [ ] GREEN Chromium DPR=2.
- [ ] Run Terrain test/typecheck/architecture.
- [ ] Commit `test(terrain): verify terrain debug visualization`.
