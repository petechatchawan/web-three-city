# Prototype Interaction Completion v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the browser prototype interaction layer with Unity-compatible pan, anchored zoom/yaw/pitch, terrain-cell selection, terrain-conforming grid display, responsive fitted framing, and product-shell lifecycle coverage.

**Architecture:** `packages/camera-input` remains the camera-state, gesture-classification, anchoring, and DOM-input authority; `packages/terrain-three` owns selection and grid overlays; `apps/game` composes these packages without moving policy into the application shell. Terrain data remains authoritative and immutable, while all camera, selection, and grid objects are disposable presentation state.

**Tech Stack:** Node.js 22+, pnpm 10.13.1, TypeScript 6 strict mode, Three.js 0.185.1 WebGL2, Vitest 4, Playwright 1.61, Vite 8, Pointer Events, GitHub Actions.

## Global Constraints

- Approved specification: `docs/superpowers/specs/2026-07-28-prototype-interaction-completion-v0-1-design.md`.
- Owner approval date: `2026-07-28`.
- Normative Unity behavior source: `petechatchawan/cityBuilder@19b29e32cb24ed7535fc08aafbd6a7ffe6b1daeb`, `docs/superpowers/specs/2026-07-24-camera-interaction-ux-v0-2-design.md`.
- Transcribe behavior contracts and authored constants only; do not copy Unity production source, scenes, serialized data, class structure, or third-party camera package code.
- Preserve the accepted mobile vocabulary: one-finger tap selects Terrain, one-finger drag pans, two-finger pinch zooms, two-finger twist rotates yaw continuously, and two-finger parallel vertical drag tilts pitch.
- The first stable two-pointer pair owns the gesture until release/cancel; a third pointer suppresses world input until all contacts release.
- Contact transitions, cancellation, UI-origin sessions, context loss, drag, and multi-touch must never synthesize Terrain selection.
- Default camera yaw is `45°`; default pitch is `50°`; design pitch limits are `35°–65°`; hard safety limits are `20°–80°`.
- Rotate buttons and `Q/E` apply exact `-90°/+90°` yaw steps; `Home` and Reset Camera restore the canonical fitted view.
- Initial and reset framing must contain the complete Terrain and diorama vertical extent inside the usable viewport with an `8%` margin.
- Map bounds have priority over terrain-anchor preservation.
- Product grid default is Off; Terrain Lab grid default is On.
- Selected-cell fill offset is `0.02` world units; grid endpoint offset is `0.015` world units.
- Selection and grid remain presentation-only and are excluded from terrain save data.
- Do not add Water, shoreline, Terraform, Roads, Buildings, inertia, perspective projection, generic object selection, adaptive thresholds, OrbitControls, or another camera dependency.
- Every production change follows RED → verify RED → minimal GREEN → focused regression → commit.
- Keep implementation in a dedicated Draft PR and do not merge before automated verification and owner physical-feel approval.

---

## Planned File Map

```text
packages/camera-input/
  src/camera-state.ts                         # camera limits, serializable state, viewport contracts
  src/camera-framing.ts                       # projected world-bounds fitted-view calculation
  src/orthographic-camera-rig.ts              # state authority and Three.js projection
  src/camera-interaction-controller.ts        # anchored pan/zoom/yaw/pitch operations
  src/gesture-controller.ts                   # pointer-session and dominant-axis classification
  src/dom-input-binding.ts                    # disposable Pointer/Wheel/Keyboard event binding
  src/index.ts
  test/camera-framing.test.ts
  test/orthographic-camera-rig.test.ts
  test/camera-interaction-controller.test.ts
  test/gesture-controller.test.ts
  test/dom-input-binding.test.ts

packages/terrain-three/
  src/selected-cell-presentation.ts
  src/terrain-grid-presentation.ts
  src/index.ts
  test/selected-cell-presentation.test.ts
  test/terrain-grid-presentation.test.ts

apps/game/
  src/main.ts
  src/game-bootstrap.ts
  src/game-input.ts
  src/game-ui.ts
  src/style.css

apps/terrain-lab/
  src/bootstrap.ts

browser-tests/
  game.spec.ts
  interaction.spec.ts
  visual-evidence.spec.ts

docs/evidence/
  prototype-interaction-completion-v0-1.md
```

---

### Task 1: Lock canonical camera state, limits, and projected fitted framing

**Files:**
- Create: `packages/camera-input/src/camera-state.ts`
- Create: `packages/camera-input/src/camera-framing.ts`
- Modify: `packages/camera-input/src/orthographic-camera-rig.ts`
- Modify: `packages/camera-input/src/index.ts`
- Create: `packages/camera-input/test/camera-framing.test.ts`
- Modify: `packages/camera-input/test/orthographic-camera-rig.test.ts`

**Interfaces:**
- Consumes: `CameraMapConfig`, Three.js `OrthographicCamera`
- Produces: `CameraState`, `CameraLimits`, `ViewportInsets`, `WorldVerticalBounds`, `CameraFitRequest`, `calculateFittedOrthographicSize`, revised `OrthographicCameraRig`

- [ ] **Step 1: Write RED tests for exact defaults and limit validation**

```ts
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  CAMERA_DEFAULTS,
  OrthographicCameraRig,
} from '../src/index.js';

it('starts with the accepted Unity-derived defaults', () => {
  const rig = new OrthographicCameraRig(new THREE.OrthographicCamera(), {
    mapWidth: 128,
    mapHeight: 128,
    cellSize: 1,
  });

  expect(CAMERA_DEFAULTS).toEqual({
    yawDegrees: 45,
    pitchDegrees: 50,
    minimumPitchDegrees: 35,
    maximumPitchDegrees: 65,
    hardMinimumPitchDegrees: 20,
    hardMaximumPitchDegrees: 80,
    minimumOrthographicSize: 18,
    maximumOrthographicSize: 170,
    framingMarginRatio: 0.08,
  });
  expect(rig.state).toMatchObject({
    targetX: 0,
    targetZ: 0,
    yawDegrees: 45,
    pitchDegrees: 50,
  });
});

it.each([
  [{ minimumPitchDegrees: 66, maximumPitchDegrees: 65 }, 'camera:invalid-pitch-limits'],
  [{ minimumPitchDegrees: 10, maximumPitchDegrees: 65 }, 'camera:pitch-limit-outside-hard-envelope'],
  [{ minimumOrthographicSize: 50, maximumOrthographicSize: 20 }, 'camera:invalid-zoom-limits'],
] as const)('rejects invalid camera limits', (overrides, code) => {
  expect(
    () =>
      new OrthographicCameraRig(
        new THREE.OrthographicCamera(),
        { mapWidth: 128, mapHeight: 128, cellSize: 1 },
        overrides,
      ),
  ).toThrowError(expect.objectContaining({ code }));
});
```

- [ ] **Step 2: Write RED projected-fit tests**

```ts
it.each([
  ['desktop', 1440, 900, { top: 0, right: 0, bottom: 0, left: 372 }],
  ['tablet', 1024, 768, { top: 0, right: 0, bottom: 0, left: 340 }],
  ['mobile-portrait', 390, 844, { top: 168, right: 0, bottom: 0, left: 0 }],
  ['ultrawide', 2560, 1080, { top: 0, right: 0, bottom: 0, left: 372 }],
] as const)('fits every projected world corner for %s', (_, width, height, insets) => {
  const result = calculateFittedOrthographicSize({
    viewportWidth: width,
    viewportHeight: height,
    insets,
    targetX: 0,
    targetZ: 0,
    yawDegrees: 45,
    pitchDegrees: 50,
    worldHalfWidth: 64,
    worldHalfHeight: 64,
    minimumWorldY: -1.5,
    maximumWorldY: 2,
    marginRatio: 0.08,
  });

  expect(result.usableWidth).toBeGreaterThan(0);
  expect(result.usableHeight).toBeGreaterThan(0);
  expect(result.orthographicSize).toBeGreaterThan(0);
  for (const corner of result.projectedCorners) {
    expect(Math.abs(corner.x)).toBeLessThanOrEqual(result.halfWidth + 1e-6);
    expect(Math.abs(corner.y)).toBeLessThanOrEqual(result.halfHeight + 1e-6);
  }
});
```

- [ ] **Step 3: Run focused tests and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- camera-framing.test.ts orthographic-camera-rig.test.ts
```

Expected: FAIL because continuous state, limit configuration, and fitted framing do not exist.

- [ ] **Step 4: Implement exact state and contracts**

```ts
export interface CameraState {
  readonly targetX: number;
  readonly targetZ: number;
  readonly yawDegrees: number;
  readonly pitchDegrees: number;
  readonly orthographicSize: number;
}

export interface CameraLimits {
  readonly minimumPitchDegrees: number;
  readonly maximumPitchDegrees: number;
  readonly hardMinimumPitchDegrees: number;
  readonly hardMaximumPitchDegrees: number;
  readonly minimumOrthographicSize: number;
  readonly maximumOrthographicSize: number;
}

export interface ViewportInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export const CAMERA_DEFAULTS = Object.freeze({
  yawDegrees: 45,
  pitchDegrees: 50,
  minimumPitchDegrees: 35,
  maximumPitchDegrees: 65,
  hardMinimumPitchDegrees: 20,
  hardMaximumPitchDegrees: 80,
  minimumOrthographicSize: 18,
  maximumOrthographicSize: 170,
  framingMarginRatio: 0.08,
});
```

`CameraContractError` uses stable codes from the tests. All constructor inputs must be finite.

- [ ] **Step 5: Implement `calculateFittedOrthographicSize`**

Build eight bounds corners from `±worldHalfWidth`, `±worldHalfHeight`, `minimumWorldY`, and `maximumWorldY`. Construct camera basis vectors from yaw/pitch without mutating a Three.js camera. Project each corner relative to target, resolve usable viewport width/height after insets, calculate horizontal and vertical extents, apply the `8%` margin, and return the larger required half-height.

```ts
export interface CameraFitResult {
  readonly orthographicSize: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
  readonly usableWidth: number;
  readonly usableHeight: number;
  readonly projectedCorners: readonly Readonly<{ x: number; y: number }>[];
}
```

Reject zero/negative usable viewport as `camera:invalid-usable-viewport`.

- [ ] **Step 6: Replace quarter-turn state in `OrthographicCameraRig`**

Required public methods:

```ts
get state(): CameraState;
get fittedOrthographicSize(): number;
setViewport(width: number, height: number, insets: ViewportInsets): void;
fitToWorld(bounds: WorldVerticalBounds): void;
resizePreservingRelativeZoom(
  width: number,
  height: number,
  insets: ViewportInsets,
  bounds: WorldVerticalBounds,
): void;
resetToFit(bounds: WorldVerticalBounds): void;
setOrthographicSize(size: number): void;
setYawDegrees(yawDegrees: number): void;
setPitchDegrees(pitchDegrees: number): void;
rotateLeft(): void;
rotateRight(): void;
panWorld(deltaX: number, deltaZ: number): void;
```

Normalize yaw into `[0, 360)`, clamp pitch and orthographic size, clamp target to map bounds, and apply camera pose atomically. `rotateLeft/Right` add exact `-90/+90` degrees.

- [ ] **Step 7: Verify GREEN and regression**

```bash
pnpm --filter @web-three-city/camera-input test -- camera-framing.test.ts orthographic-camera-rig.test.ts
pnpm --filter @web-three-city/camera-input typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/camera-input/src packages/camera-input/test
git commit -m "feat(input): add canonical camera state and fitted framing"
```

---

### Task 2: Implement camera-relative pan and terrain-anchored zoom, yaw, and pitch

**Files:**
- Create: `packages/camera-input/src/camera-interaction-controller.ts`
- Modify: `packages/camera-input/src/orthographic-camera-rig.ts`
- Modify: `packages/camera-input/src/index.ts`
- Create: `packages/camera-input/test/camera-interaction-controller.test.ts`
- Modify: `packages/camera-input/test/orthographic-camera-rig.test.ts`

**Interfaces:**
- Consumes: `OrthographicCameraRig`, `TerrainPickResult`
- Produces: `ScreenPoint`, `TerrainAnchorResolver`, `CameraInteractionController`

- [ ] **Step 1: Write RED pan-direction tests**

```ts
it.each([
  [45, { x: 20, y: 0 }, { xSign: -1, zSign: 1 }],
  [135, { x: 20, y: 0 }, { xSign: -1, zSign: -1 }],
  [225, { x: 20, y: 0 }, { xSign: 1, zSign: -1 }],
  [315, { x: 20, y: 0 }, { xSign: 1, zSign: 1 }],
] as const)('maps screen pan relative to yaw %s', (yaw, delta, expected) => {
  rig.setYawDegrees(yaw);
  controller.panScreen(delta);
  expect(Math.sign(rig.state.targetX)).toBe(expected.xSign);
  expect(Math.sign(rig.state.targetZ)).toBe(expected.zSign);
});
```

- [ ] **Step 2: Write RED anchoring tests**

```ts
it('keeps the same terrain point under the centroid while zooming', () => {
  resolver.queue(
    { cellX: 64, cellZ: 64, localU: 0.5, localV: 0.5, nearestVertexX: 64, nearestVertexZ: 64, worldPoint: { x: 3, y: 1, z: 5 } },
    { cellX: 64, cellZ: 64, localU: 0.5, localV: 0.5, nearestVertexX: 64, nearestVertexZ: 64, worldPoint: { x: 1, y: 1, z: 2 } },
  );

  controller.zoomAt({ x: 500, y: 300 }, 0.8);

  expect(rig.state.targetX).toBeCloseTo(2);
  expect(rig.state.targetZ).toBeCloseTo(3);
});

it('keeps bounded camera movement when anchor picking fails', () => {
  resolver.queue(null, null);
  expect(() => controller.rotateYawAt({ x: 500, y: 300 }, 17)).not.toThrow();
  expect(rig.state.yawDegrees).toBe(62);
});
```

- [ ] **Step 3: Run and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- camera-interaction-controller.test.ts
```

Expected: FAIL because the controller does not exist.

- [ ] **Step 4: Implement the controller contracts**

```ts
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface TerrainAnchorResolver {
  pick(point: ScreenPoint): TerrainPickResult | null;
}

export class CameraInteractionController {
  panScreen(delta: Readonly<{ x: number; y: number }>): void;
  zoomAt(point: ScreenPoint, scale: number): void;
  rotateYawAt(point: ScreenPoint, deltaDegrees: number): void;
  tiltPitchAt(point: ScreenPoint, deltaDegrees: number): void;
  rotateLeft(): void;
  rotateRight(): void;
  reset(bounds: WorldVerticalBounds): void;
}
```

`panScreen` calculates world-units-per-CSS-pixel from current orthographic size and usable viewport height, projects camera right and forward onto XZ, and moves target opposite the drag direction.

- [ ] **Step 5: Implement one anchored-operation path**

```ts
#applyAnchored(point: ScreenPoint, operation: () => void): void {
  const before = this.#resolver.pick(point)?.worldPoint ?? null;
  operation();
  if (before === null) return;
  const after = this.#resolver.pick(point)?.worldPoint ?? null;
  if (after === null) return;
  this.#rig.panWorld(before.x - after.x, before.z - after.z);
}
```

Map-bound clamping remains inside the rig and therefore overrides full anchor preservation.

- [ ] **Step 6: Lock input scales**

```ts
export const CAMERA_INTERACTION_SENSITIVITY = Object.freeze({
  wheelExponentPerDeltaY: -0.001,
  twistDegreesPerRadian: 180 / Math.PI,
  pitchDegreesPerCssPixel: -0.12,
});
```

Upward centroid movement has negative CSS Y delta and therefore increases pitch through the negative pitch scale.

- [ ] **Step 7: Verify and commit**

```bash
pnpm --filter @web-three-city/camera-input test -- camera-interaction-controller.test.ts orthographic-camera-rig.test.ts
pnpm --filter @web-three-city/camera-input typecheck
git add packages/camera-input
git commit -m "feat(input): add anchored camera interaction controller"
```

---

### Task 3: Replace simultaneous raw gestures with canonical session ownership and dominant-axis classification

**Files:**
- Modify: `packages/camera-input/src/gesture-controller.ts`
- Modify: `packages/camera-input/src/index.ts`
- Modify: `packages/camera-input/test/gesture-controller.test.ts`

**Interfaces:**
- Consumes: `PointerSample`
- Produces: `GestureHandlers`, `TwoFingerGestureFrame`, deterministic `GestureController`

- [ ] **Step 1: Write RED one-pointer safety tests**

```ts
it('emits tap only for an eligible release inside tap slop', () => {
  controller.pointerDown({ id: 1, x: 20, y: 20 });
  controller.pointerUp({ id: 1, x: 25, y: 24 });
  expect(events).toEqual([{ type: 'tap', point: { x: 25, y: 24 } }]);
});

it('does not emit tap after pan threshold', () => {
  controller.pointerDown({ id: 1, x: 20, y: 20 });
  controller.pointerMove({ id: 1, x: 40, y: 20 });
  controller.pointerUp({ id: 1, x: 40, y: 20 });
  expect(events.some((event) => event.type === 'tap')).toBe(false);
});

it('does not emit tap after cancellation', () => {
  controller.pointerDown({ id: 1, x: 20, y: 20 });
  controller.pointerCancel(1);
  expect(events).toEqual([]);
});
```

- [ ] **Step 2: Write RED multi-touch transition tests**

```ts
it('emits no delta on the one-to-two pointer transition frame', () => {
  controller.pointerDown({ id: 1, x: 100, y: 100 });
  controller.pointerDown({ id: 2, x: 200, y: 100 });
  expect(events).toEqual([]);
});

it('keeps the first pair and suppresses after a third contact until all release', () => {
  controller.pointerDown({ id: 1, x: 100, y: 100 });
  controller.pointerDown({ id: 2, x: 200, y: 100 });
  controller.pointerDown({ id: 3, x: 150, y: 150 });
  controller.pointerMove({ id: 1, x: 90, y: 100 });
  controller.pointerUp({ id: 3, x: 150, y: 150 });
  controller.pointerMove({ id: 2, x: 220, y: 100 });
  expect(events).toEqual([]);
});
```

- [ ] **Step 3: Write RED dominant-axis tests**

Use locked options:

```ts
export const DEFAULT_GESTURE_OPTIONS = Object.freeze({
  tapSlopCssPixels: 8,
  activationFrames: 2,
  pinchLogThreshold: 0.012,
  yawRadiansThreshold: 0.012,
  pitchCssPixelsThreshold: 3,
  panNoiseCssPixels: 0.75,
  secondaryScale: 0.25,
});
```

Tests must prove:

```ts
expect(classify(framesForPinch)).toMatchObject({ dominant: 'pinch' });
expect(classify(framesForTwist)).toMatchObject({ dominant: 'yaw' });
expect(classify(framesForParallelVertical)).toMatchObject({ dominant: 'pitch' });
expect(classify(exactScoreTie)).toMatchObject({ dominant: 'pinch' });
expect(qualifiedSecondary.yawRadians).toBeCloseTo(rawYaw * 0.25);
```

- [ ] **Step 4: Run and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- gesture-controller.test.ts
```

Expected: existing controller fails ownership, suppression, stabilization, and pitch tests.

- [ ] **Step 5: Implement explicit session states**

```ts
export type GestureSessionState =
  | 'idle'
  | 'one-pointer-pending'
  | 'one-pointer-pan'
  | 'two-pointer-pending'
  | 'two-pointer-active'
  | 'suppressed';
```

Store the first pair IDs, prior positions, baseline metrics, candidate dominant axis, candidate-frame count, and established dominant axis. A third pointer enters `suppressed`; suppression ends only after all pointers release/cancel.

- [ ] **Step 6: Implement exact frame metrics**

For the owning pair, calculate per-frame pointer deltas `d1` and `d2`:

```ts
const centroidDelta = {
  x: (d1.x + d2.x) / 2,
  y: (d1.y + d2.y) / 2,
};
const pinchLogDelta = Math.log(afterDistance / beforeDistance);
const yawRadians = normalizeAngle(afterAngle - beforeAngle);
const sameVerticalDirection = Math.sign(d1.y) === Math.sign(d2.y) && Math.sign(d1.y) !== 0;
const verticalMismatch = Math.abs(d1.y - d2.y) / 2;
const horizontalNoise = Math.max(Math.abs(d1.x), Math.abs(d2.x)) * 0.25;
const rawParallelVertical = sameVerticalDirection ? centroidDelta.y : 0;
const pitchCssPixels =
  Math.sign(rawParallelVertical) *
  Math.max(0, Math.abs(rawParallelVertical) - verticalMismatch - horizontalNoise);
```

Normalized scores are absolute delta divided by the corresponding threshold. Exact score ties use `Pinch > Yaw > Pitch`.

- [ ] **Step 7: Emit semantic frames only after two qualifying frames**

```ts
export interface TwoFingerGestureFrame {
  readonly centroid: PointDelta;
  readonly panDelta: PointDelta;
  readonly zoomScale: number;
  readonly yawRadians: number;
  readonly pitchCssPixels: number;
  readonly dominant: 'pinch' | 'yaw' | 'pitch';
}
```

The dominant axis receives full output. Other axes receive quarter-scale output only when their own normalized score is `>= 1`; otherwise they emit neutral values. Centroid pan is emitted unless dominant pitch consumes the parallel vertical movement.

- [ ] **Step 8: Verify and commit**

```bash
pnpm --filter @web-three-city/camera-input test -- gesture-controller.test.ts
pnpm --filter @web-three-city/camera-input typecheck
git add packages/camera-input/src/gesture-controller.ts packages/camera-input/src/index.ts packages/camera-input/test/gesture-controller.test.ts
git commit -m "feat(input): add canonical gesture session arbitration"
```

---

### Task 4: Add disposable DOM input binding with UI-origin filtering

**Files:**
- Create: `packages/camera-input/src/dom-input-binding.ts`
- Modify: `packages/camera-input/src/index.ts`
- Create: `packages/camera-input/test/dom-input-binding.test.ts`

**Interfaces:**
- Consumes: `GestureController`, `CameraInteractionController`, selection callback
- Produces: `bindWorldInput`, `WorldInputBinding`, `WorldInputBindingOptions`

- [ ] **Step 1: Write RED binding tests**

Using happy-dom, assert:

```ts
it('captures accepted world pointers and releases them on end', () => { /* exact pointer event dispatch */ });
it('does not start a world session from button, select, input, label, or data-world-input-block', () => { /* targets */ });
it('prevents wheel page scrolling only while the pointer is over the canvas', () => { /* wheel defaultPrevented */ });
it('ignores Q, E, and Home while a form control has focus', () => { /* keydown */ });
it('clearActiveSession prevents a later synthetic tap', () => { /* context-loss path */ });
it('dispose removes every listener and is idempotent', () => { /* listener spies */ });
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- dom-input-binding.test.ts
```

Expected: FAIL because no browser binding exists.

- [ ] **Step 3: Implement the binding contract**

```ts
export interface WorldInputBinding {
  clearActiveSession(): void;
  dispose(): void;
}

export interface WorldInputBindingOptions {
  readonly canvas: HTMLCanvasElement;
  readonly keyboardTarget: Window;
  readonly camera: CameraInteractionController;
  readonly onEligibleTap: (point: ScreenPoint) => void;
  readonly uiBlockSelector?: string;
}
```

Default UI selector:

```ts
'button, input, select, textarea, label, a, [data-world-input-block]'
```

- [ ] **Step 4: Wire semantic gesture callbacks**

- one-pointer pan → `camera.panScreen`
- tap → `onEligibleTap`
- two-finger pan → `camera.panScreen`
- zoom scale → `camera.zoomAt(centroid, scale)`
- yaw radians → `camera.rotateYawAt(centroid, radians * 180 / Math.PI)`
- pitch CSS pixels → `camera.tiltPitchAt(centroid, pixels * -0.12)`
- wheel → `camera.zoomAt(pointer, Math.exp(deltaY * -0.001))`
- `Q/E/Home` → left/right/reset

Acquire pointer capture on accepted pointer-down and release when possible. `pointercancel`, `lostpointercapture`, `blur`, and explicit `clearActiveSession()` cancel without tap.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @web-three-city/camera-input test -- dom-input-binding.test.ts gesture-controller.test.ts
pnpm --filter @web-three-city/camera-input typecheck
git add packages/camera-input
git commit -m "feat(input): bind canonical gestures to browser events"
```

---

### Task 5: Add selected-cell presentation using authoritative terrain topology

**Files:**
- Create: `packages/terrain-three/src/selected-cell-presentation.ts`
- Modify: `packages/terrain-three/src/index.ts`
- Create: `packages/terrain-three/test/selected-cell-presentation.test.ts`

**Interfaces:**
- Consumes: `TerrainSnapshot`, `CellCoord`, `selectTerrainDiagonal`, world coordinate conversion
- Produces: `SelectedCellPresentation`

- [ ] **Step 1: Write RED geometry and lifecycle tests**

```ts
it('samples the four authoritative lattice heights and accepted diagonal', () => {
  presentation.setSelection(snapshot, { x: 4, z: 7 });
  const geometry = presentation.debugGeometry();
  expect(Array.from(geometry.positions)).toEqual(expectedPositionsWithOffset002);
  expect(Array.from(geometry.indices)).toEqual(expectedIndicesForSelectedDiagonal);
});

it('hides when selection clears and does not rebuild for the same revision/cell', () => {
  presentation.setSelection(snapshot, { x: 4, z: 7 });
  const first = presentation.debugGeometryIdentity();
  presentation.setSelection(snapshot, { x: 4, z: 7 });
  expect(presentation.debugGeometryIdentity()).toBe(first);
  presentation.clear();
  expect(presentation.visible).toBe(false);
});

it('disposes geometry and materials exactly once', () => {
  presentation.dispose();
  presentation.dispose();
  expect(disposeCounts).toEqual({ geometry: 1, fill: 1, border: 1 });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-three test -- selected-cell-presentation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement overlay geometry**

`SelectedCellPresentation` owns a `THREE.Group` containing:

1. a transparent fill mesh using the exact cell triangles from `CELL_TRIANGLES`;
2. a border `THREE.LineSegments` around NW→NE→SE→SW→NW.

Every endpoint uses authoritative world X/Z and height plus `0.02`. Fill material uses `transparent: true`, `opacity: 0.28`, `depthTest: true`, `depthWrite: false`; border uses `depthTest: true`, `depthWrite: false`.

Required API:

```ts
constructor(scene: THREE.Scene, config: WorldConfig);
setSelection(snapshot: TerrainSnapshot, cell: CellCoord): void;
clear(): void;
get visible(): boolean;
dispose(): void;
```

Reject out-of-range cells with `selection:invalid-cell`.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-three test -- selected-cell-presentation.test.ts
pnpm --filter @web-three-city/terrain-three typecheck
git add packages/terrain-three
git commit -m "feat(three): add terrain-cell selection presentation"
```

---

### Task 6: Add chunked terrain-conforming grid presentation

**Files:**
- Create: `packages/terrain-three/src/terrain-grid-presentation.ts`
- Modify: `packages/terrain-three/src/index.ts`
- Create: `packages/terrain-three/test/terrain-grid-presentation.test.ts`
- Modify: `apps/terrain-lab/src/bootstrap.ts`

**Interfaces:**
- Consumes: `TerrainSnapshot`, chunk contracts, world conversion
- Produces: `TerrainGridPresentation`

- [ ] **Step 1: Write RED grid ownership tests**

```ts
it('emits each cell edge exactly once with terrain-conforming heights', () => {
  grid.load(snapshot);
  expect(grid.debugSegmentCount()).toBe(2 * 128 * 129);
  expect(grid.debugEndpoint({ x: 16, z: 8 })).toEqual({
    x: -48,
    y: snapshotHeightAt16_8 * 0.5 + 0.015,
    z: -56,
  });
});

it('uses identical seam endpoint bytes in neighboring chunk geometry', () => {
  grid.load(chunkSeamSnapshot);
  expect(grid.debugSeamEndpoints({ x: 1, z: 0 })).toEqual(
    grid.debugSeamEndpoints({ x: 0, z: 0 }),
  );
});

it('toggles group visibility without rebuilding geometry', () => {
  grid.load(snapshot);
  const identity = grid.debugRootIdentity();
  grid.setVisible(false);
  grid.setVisible(true);
  expect(grid.debugRootIdentity()).toBe(identity);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-three test -- terrain-grid-presentation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement deterministic edge ownership**

For every owned cell, emit its east and south edges. Emit north edges only for global row `0`; emit west edges only for global column `0`. This yields exactly:

```text
horizontal segments = 128 * 129
vertical segments   = 128 * 129
total               = 33,024
```

Partition line geometry by terrain chunk. Each endpoint derives from the shared height lattice plus `0.015`. Do not emit vertical connectors.

Required API:

```ts
constructor(scene: THREE.Scene, config: WorldConfig);
load(snapshot: TerrainSnapshot): void;
rebuild(snapshot: TerrainSnapshot, chunks: readonly ChunkCoord[]): void;
setVisible(visible: boolean): void;
get visible(): boolean;
dispose(): void;
```

`load` stages all chunk line geometries and publishes atomically. `rebuild` stages replacements before swapping. Material is transparent, depth-tested, and depth-write disabled.

- [ ] **Step 4: Replace Terrain Lab flat `GridHelper`**

Remove the Y=0 `THREE.GridHelper`. Instantiate `TerrainGridPresentation`, load the fixture snapshot, and keep visibility On. Dispose it on page hide.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-three test -- terrain-grid-presentation.test.ts
pnpm --filter @web-three-city/terrain-lab build
pnpm --filter @web-three-city/terrain-three typecheck
git add packages/terrain-three apps/terrain-lab/src/bootstrap.ts
git commit -m "feat(three): add terrain-conforming chunked grid"
```

---

### Task 7: Split and integrate the product shell without changing terrain ownership

**Files:**
- Modify: `apps/game/src/main.ts`
- Create: `apps/game/src/game-bootstrap.ts`
- Create: `apps/game/src/game-input.ts`
- Create: `apps/game/src/game-ui.ts`
- Modify: `apps/game/src/style.css`
- Modify: `browser-tests/game.spec.ts`

**Interfaces:**
- Consumes: all camera/input and terrain presentation APIs from Tasks 1–6
- Produces: interactive Game shell and test-facing diagnostics

- [ ] **Step 1: Write RED browser tests for initial fit and UI controls**

```ts
import { expect, test } from '@playwright/test';

test('desktop initial view contains the complete terrain inside usable viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/game/');
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  const evidence = await page.evaluate(() => window.__WEB_THREE_CITY_INTERACTION__);
  expect(evidence?.allWorldCornersInsideUsableViewport).toBe(true);
  expect(evidence?.framingMarginRatio).toBeCloseTo(0.08);
});

 test('mobile portrait uses compact controls and fitted view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/game/');
  await expect(page.getByTestId('controls-mode')).toHaveText('compact');
  const evidence = await page.evaluate(() => window.__WEB_THREE_CITY_INTERACTION__);
  expect(evidence?.allWorldCornersInsideUsableViewport).toBe(true);
});
```

- [ ] **Step 2: Write RED browser tests for interaction outcomes**

Cover exact product behaviors:

```ts
await dragCanvas(page, { x: 900, y: 500 }, { x: 980, y: 540 });
expect(await cameraState(page)).not.toMatchObject({ targetX: 0, targetZ: 0 });
expect(await selectedCell(page)).toBeNull();

await page.mouse.click(900, 500);
expect(await selectedCell(page)).toEqual(expect.objectContaining({ x: expect.any(Number), z: expect.any(Number) }));
await expect(page.getByTestId('selected-cell')).not.toHaveText('None');

await page.getByRole('button', { name: 'Grid' }).click();
expect(await gridVisible(page)).toBe(true);

await page.getByRole('button', { name: 'Reset camera' }).click();
expect(await cameraState(page)).toMatchObject({ yawDegrees: 45, pitchDegrees: 50, targetX: 0, targetZ: 0 });
```

- [ ] **Step 3: Run and verify RED**

```bash
pnpm --filter @web-three-city/game build
pnpm test:browser -- game.spec.ts
```

Expected: FAIL because the current shell has no gesture binding, selected overlay, terrain grid, reset, compact controls, or corrected framing.

- [ ] **Step 4: Implement `game-ui.ts`**

`createGameUi(root)` renders and returns typed element references for:

- status;
- quality select;
- Save, Load, Rotate left, Rotate right, Reset camera;
- Grid toggle with `aria-pressed`;
- selected-cell coordinate;
- compact/desktop mode indicator for browser evidence.

`measureViewportInsets(canvas, panel)` returns CSS-pixel insets:

- desktop/tablet: `left = panel.right - canvas.left + 16`, other insets from safe areas;
- mobile portrait at `max-width: 720px`: `top = panel.bottom - canvas.top + 8`, left `0`;
- clamp every inset to canvas dimensions.

- [ ] **Step 5: Implement `game-input.ts`**

Create a Three.js-backed `TerrainAnchorResolver` using the existing `pickTerrain`, live camera, current chunk meshes, canvas bounds, and world config. Bind `bindWorldInput`. Eligible taps resolve Terrain cells and call a supplied selection callback. Export one idempotent disposer plus `clearActiveSession`.

- [ ] **Step 6: Implement `game-bootstrap.ts`**

Composition order:

1. create UI and canvas;
2. detect WebGL2;
3. generate or restore Terrain snapshot;
4. create renderer, scene, lights, camera rig, Terrain presentation, selection presentation, and grid presentation;
5. measure viewport and call `setViewport` + `fitToWorld`;
6. create camera interaction controller and input binding;
7. wire UI commands;
8. start render loop;
9. expose read-only browser evidence;
10. register lifecycle cleanup.

`main.ts` becomes:

```ts
import './style.css';
import { bootstrapGame } from './game-bootstrap.js';

const root = document.querySelector<HTMLElement>('#app');
if (root === null) throw new Error('game:missing-root');
bootstrapGame(root);
```

- [ ] **Step 7: Implement exact UI actions**

- Rotate buttons call anchored-unaware exact `±90°` controller steps around current target.
- Reset measures current insets and calls `reset(bounds)`.
- Grid toggle changes only `TerrainGridPresentation.visible` and `aria-pressed`.
- Selection callback updates `SelectedCellPresentation` and coordinate text.
- Clicking outside Terrain on an eligible world tap clears selection.
- Save/load remain Terrain-only; load re-publishes Terrain, grid, and current selection against the new revision.

- [ ] **Step 8: Implement responsive CSS**

Desktop panel remains top-left. At `max-width: 720px` or portrait layout, use a compact top sheet with reduced padding and horizontally scrolling/wrapping controls. Apply `env(safe-area-inset-top/right/bottom/left)`. Keep `canvas { touch-action: none; }`.

- [ ] **Step 9: Verify and commit**

```bash
pnpm --filter @web-three-city/game typecheck
pnpm --filter @web-three-city/game build
pnpm test:browser -- game.spec.ts
pnpm lint
git add apps/game browser-tests/game.spec.ts
git commit -m "feat(game): integrate canonical terrain interaction shell"
```

---

### Task 8: Complete multi-touch, resize, and context-restoration browser acceptance

**Files:**
- Create: `browser-tests/interaction.spec.ts`
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `apps/game/src/game-input.ts`
- Modify: `browser-tests/game.spec.ts`

**Interfaces:**
- Consumes: product interaction shell
- Produces: automated browser acceptance for gesture and lifecycle invariants

- [ ] **Step 1: Add deterministic Pointer Event helpers**

```ts
async function dispatchPointer(
  page: Page,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  input: { id: number; x: number; y: number; pointerType?: 'touch' | 'mouse' },
): Promise<void> {
  await page.locator('#game-canvas').dispatchEvent(type, {
    pointerId: input.id,
    clientX: input.x,
    clientY: input.y,
    pointerType: input.pointerType ?? 'touch',
    isPrimary: input.id === 1,
    bubbles: true,
  });
}
```

- [ ] **Step 2: Add pinch acceptance**

Two pointers move apart for at least two qualifying frames. Assert orthographic size decreases, target remains bounded, and selected cell remains null.

- [ ] **Step 3: Add continuous twist acceptance**

Rotate the pair by approximately `20°` over two qualifying frames. Assert yaw changes continuously and is not rounded to a multiple of `90°`.

- [ ] **Step 4: Add tilt acceptance**

Move both pointers upward in parallel over two qualifying frames. Assert pitch increases but remains `<= 65°`. Repeat downward and assert `>= 35°`.

- [ ] **Step 5: Add suppression and cancellation acceptance**

Scenarios:

1. pointer down → move past slop → pointer up: no selection;
2. two-pointer gesture → release: no selection;
3. third pointer appears → all later movement ignored until all release;
4. pointer cancel: no selection;
5. pointer starts on a panel button then crosses canvas: no camera movement;
6. context loss during pointer session → restore → later release: no synthetic selection.

- [ ] **Step 6: Add resize and context restoration acceptance**

- initial fitted state resized desktop→mobile remains finite and valid;
- Reset after resize uses new insets;
- active grid visibility survives restore;
- selected overlay survives restore;
- Terrain, grid, and selection geometry are recreated without duplicate scene roots.

- [ ] **Step 7: Run and verify**

```bash
pnpm test:browser -- interaction.spec.ts game.spec.ts
```

Expected: PASS with no console errors.

- [ ] **Step 8: Commit**

```bash
git add browser-tests apps/game/src
git commit -m "test(browser): verify canonical interaction lifecycle"
```

---

### Task 9: Capture visual evidence, performance observations, and exact-head acceptance

**Files:**
- Modify: `browser-tests/visual-evidence.spec.ts`
- Create: `docs/evidence/prototype-interaction-completion-v0-1.md`
- Modify: `.github/workflows/ci.yml` only when artifact paths require extension
- Modify: PR body

**Interfaces:**
- Consumes: all completed implementation
- Produces: screenshot/trace artifact and exact-head acceptance record

- [ ] **Step 1: Add required screenshot scenarios**

Create exactly:

```text
interaction-desktop-initial-fit.png
interaction-mobile-portrait-initial-fit.png
interaction-grid-on.png
interaction-selected-cell.png
interaction-pan-result.png
interaction-zoom-in.png
interaction-yaw-continuous.png
interaction-pitch-top-down.png
interaction-pitch-horizon.png
interaction-reset.png
```

Use deterministic viewport sizes and interaction coordinates. Capture a Playwright trace or video containing pan, pinch, twist, tilt, selection, grid toggle, and reset.

- [ ] **Step 2: Record interaction performance**

Expose a bounded diagnostic accumulator:

```ts
interface InteractionPerformanceEvidence {
  readonly processedPointerFrames: number;
  readonly medianPointerFrameMs: number;
  readonly p95PointerFrameMs: number;
  readonly selectionRebuildCount: number;
  readonly gridRebuildCount: number;
}
```

Collect only in development/evidence mode. The target is `< 1 ms` median per pointer frame on the CI desktop browser; report deviations without introducing a hard mobile gate.

- [ ] **Step 3: Run the complete frozen-lock gate**

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm provenance:check
pnpm test:coverage
pnpm build
pnpm test:browser
git diff --check
git status --short
```

Every command must exit `0`. No PASS may be inferred from source inspection.

- [ ] **Step 4: Record exact evidence**

`docs/evidence/prototype-interaction-completion-v0-1.md` must contain:

- base SHA and exact implementation head SHA;
- Node, pnpm, browser, and Three.js versions;
- unit/browser test counts;
- camera defaults and limits;
- desktop/mobile fitted-view evidence;
- gesture scenarios passed;
- performance values;
- screenshot and trace SHA-256 hashes;
- known limitations;
- physical mobile-device status as `NOT RUN — device unavailable` unless actual evidence exists;
- owner physical-feel approval status as `PENDING` until explicitly granted.

- [ ] **Step 5: Re-run verification after evidence changes**

```bash
pnpm check
pnpm test:coverage
pnpm test:browser
git diff --check
```

Expected: all exit `0`.

- [ ] **Step 6: Commit and update Draft PR**

```bash
git add .github browser-tests docs/evidence apps packages
 git commit -m "ci: verify Prototype Interaction Completion v0.1"
```

PR body must include exact base/head refs, task summary, Unity behavior provenance, no-copy declaration, changed-file boundary, full gate results, browser evidence, known limitations, explicit Water exclusion, merge status `not performed`, and owner physical-feel approval `pending`.

---

## Final Acceptance Checklist

- [ ] Initial desktop and mobile views contain the full map with `8%` margin in the usable viewport.
- [ ] One-finger/primary drag pans using camera-relative XZ axes.
- [ ] Eligible tap/click selects one Terrain cell and displays the correct authoritative-height overlay.
- [ ] Wheel and two-finger pinch zoom within `18..170` orthographic-size limits.
- [ ] Two-finger twist rotates yaw continuously.
- [ ] Two-finger parallel vertical drag changes pitch within `35°..65°`.
- [ ] Two-finger zoom/yaw/pitch preserves the Terrain point under the centroid best-effort.
- [ ] Map bounds override anchoring without camera escape.
- [ ] Contact transitions, cancellation, UI-origin sessions, drag, context loss, and third-contact suppression produce no synthetic selection.
- [ ] Rotate buttons and `Q/E` apply exact `90°` yaw steps.
- [ ] Reset and `Home` restore target `(0,0)`, yaw `45°`, pitch `50°`, and fitted orthographic size.
- [ ] Grid toggle shows a terrain-conforming, seam-safe grid without rebuilding Terrain.
- [ ] Product grid defaults Off; Terrain Lab grid defaults On.
- [ ] Selection and grid presentations survive context restoration.
- [ ] Every event listener, capture, geometry, and material is disposed idempotently.
- [ ] Frozen-lock format, lint, typecheck, provenance, unit, coverage, build, browser, and visual-evidence gates pass.
- [ ] Exact-head evidence is recorded.
- [ ] Owner approves physical interaction feel before merge.
- [ ] Water, shoreline, Terraform, Roads, Buildings, inertia, perspective mode, generic object selection, and third-party camera controls remain excluded.
