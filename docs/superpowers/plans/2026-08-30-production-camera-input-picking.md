# Production Camera Input Picking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build maintainable production desktop/mobile camera controls and pointer-to-semantic Terrain picking for the game application.

**Architecture:** Camera state/reducer, gesture recognition, and pointer-to-NDC conversion are pure app presentation modules. DOM Pointer Events/wheel and Three.js camera/raycaster are thin adapters. Gesture arbitration guarantees camera gestures and tap picking are mutually exclusive.

**Tech Stack:** TypeScript, Pointer Events, Three.js 0.179.1, Vitest/Playwright.

**Spec:** `docs/apps/game/specs/CAMERA-AND-INPUT-DESIGN.md`

## Global Constraints

- Pointer Events are the only mouse/touch event model.
- `touch-action:none` applies only to the 3D viewport.
- No OrbitControls in production camera path.
- No Three.js vectors/classes in pure camera/gesture state contracts.
- Camera values derive from map/config; no 4096/512/8 literals in handlers.

---

### Task 1: Pure camera state/reducer/constraints

**Files:**
- Create: `apps/game/src/presentation/camera/camera-types.ts`
- Create: `apps/game/src/presentation/camera/camera-config.ts`
- Create: `apps/game/src/presentation/camera/camera-reducer.ts`
- Test: `apps/game/tests/camera.test.ts`

- [ ] RED for initial map framing, pan clamp, pitch/distance clamp, zoom direction, rotate wrapping, reset determinism.
- [ ] Implement named config + derived constraints + reducer.
- [ ] GREEN app typecheck.
- [ ] Commit `feat(game): add deterministic city camera state`.

### Task 2: Pure gesture recognizer

**Files:**
- Create: `apps/game/src/presentation/input/gesture-types.ts`
- Create: `apps/game/src/presentation/input/gesture-recognizer.ts`
- Test: `apps/game/tests/gesture-recognizer.test.ts`

- [ ] RED desktop click/pan/rotate/cancel and touch tap/pan/two-pointer takeover/pinch/twist/centroid cases.
- [ ] Implement immutable transition function returning `nextState + intents[]`; thresholds come from one input config.
- [ ] GREEN.
- [ ] Commit `feat(game): recognize desktop and touch gestures`.

### Task 3: Three camera + DOM controller

**Files:**
- Create: `apps/game/src/presentation/camera/create-city-camera.ts`
- Create: `apps/game/src/presentation/input/create-city-input-controller.ts`
- Modify: `apps/game/src/presentation/create-scene.ts`
- Test: app tests.

- [ ] RED for state->PerspectiveCamera mapping, viewport-only listeners, pointer capture/release, wheel preventDefault, dispose listener removal/idempotency.
- [ ] Implement adapter using `requestRender()` callback; no continuous animation loop.
- [ ] GREEN + lint/typecheck.
- [ ] Commit `feat(game): integrate production camera input`.

### Task 4: Production pointer picking adapter and richer Terrain semantic pick

**Files:**
- Modify: `systems/terrain/src/contracts/terrain-three.ts`
- Modify: `systems/terrain/src/presentation/three/picking/semantic-pick.ts`
- Modify: `systems/terrain/tests/semantic-pick.test.ts`
- Create: `apps/game/src/presentation/interaction/pointer-to-ndc.ts`
- Create: `apps/game/src/presentation/interaction/create-terrain-pointer-picker.ts`
- Test: `apps/game/tests/pointer-picking.test.ts`

- [ ] RED Terrain test requiring `uQ16/vQ16/worldPosition/runUnits` and proving returned Y ignores raw intersection Y.
- [ ] RED app NDC center/corners/outside and tap->Raycaster adapter tests.
- [ ] Implement richer semantic result from World cell bounds + Terrain sample; clamp valid local fractions only after World cell resolution.
- [ ] GREEN Terrain/app/typecheck/architecture.
- [ ] Commit `feat(game): route pointer taps to semantic terrain picks`.

### Task 5: Desktop + mobile browser acceptance

**Files:**
- Extend technical harness or dedicated page tests.
- Modify: `tests/browser/terrain-phase-1.spec.ts`
- Create/Modify mobile browser spec if clearer.

- [ ] Desktop E2E: primary drag changes camera/no pick, secondary drag rotates, wheel zooms, click picks.
- [ ] Mobile E2E with touch-enabled context: one-finger pan/no pick, tap picks, two-pointer pinch changes distance, twist changes azimuth, no accidental pick.
- [ ] Verify `touch-action:none`, no page errors, DPR=2 canvas sizing retained.
- [ ] Run browser + full app/terrain typechecks and architecture.
- [ ] Commit `test(game): verify cross-platform city camera input`.
