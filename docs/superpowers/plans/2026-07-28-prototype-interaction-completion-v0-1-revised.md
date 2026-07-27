# Prototype Interaction Completion v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the browser prototype interaction layer with Unity-compatible pan, terrain-anchored zoom/yaw/pitch, Terrain-cell selection, terrain-conforming grid display, responsive fitted framing, and product lifecycle coverage.

**Architecture:** `packages/camera-input` owns serializable camera state, projected framing, gesture classification, terrain anchoring, and disposable DOM bindings. `packages/terrain-three` owns selection and grid overlays. `apps/game` remains a composition root that connects these packages without moving policy into application code or mutating authoritative Terrain data.

**Tech Stack:** Node.js 22+, pnpm 10.13.1, TypeScript 6 strict mode, Three.js 0.185.1 WebGL2, Vitest 4, happy-dom 20, Playwright 1.61, Vite 8, Pointer Events, GitHub Actions.

## Global Constraints

- Approved specification: `docs/superpowers/specs/2026-07-28-prototype-interaction-completion-v0-1-design.md`.
- Owner approval date: `2026-07-28`.
- Normative Unity behavior source: `petechatchawan/cityBuilder@19b29e32cb24ed7535fc08aafbd6a7ffe6b1daeb`, `docs/superpowers/specs/2026-07-24-camera-interaction-ux-v0-2-design.md`.
- Transcribe behavior contracts and authored constants only; do not copy Unity production source, scenes, serialized data, implementation structure, or third-party camera package code.
- Preserve the accepted vocabulary: one-finger tap selects Terrain, one-finger drag pans, two-finger pinch zooms, two-finger twist rotates yaw continuously, and two-finger parallel vertical drag tilts pitch.
- The first stable two-pointer pair owns the gesture until release/cancel; a third pointer suppresses world input until all contacts release.
- Contact transitions, cancellation, UI-origin sessions, drag, context loss, and multi-touch must never synthesize Terrain selection.
- Default yaw is `45°`; default pitch is `50°`; design pitch limits are `35°–65°`; hard pitch limits are `20°–80°`.
- Orthographic-size limits are `18..170`.
- Rotate buttons and `Q/E` apply exact `-90°/+90°` yaw steps; `Home` and Reset Camera restore the canonical fitted view.
- Initial/reset framing contains the complete Terrain and diorama vertical extent inside the usable viewport with an `8%` margin.
- Map bounds have priority over terrain-anchor preservation.
- Product grid defaults Off; Terrain Lab grid defaults On.
- Selected-cell offset is `0.02`; grid endpoint offset is `0.015` world units.
- Selection and grid remain presentation-only and are excluded from terrain save data.
- Do not add Water, shoreline, Terraform, Roads, Buildings, inertia, perspective projection, generic object selection, adaptive thresholds, OrbitControls, or another camera dependency.
- Every production task follows RED → verify RED → minimal GREEN → focused regression → commit.
- Keep implementation in a dedicated Draft PR and do not merge before automated verification and owner physical-feel approval.

---

## Planned File Map

```text
packages/camera-input/
  src/camera-state.ts
  src/camera-framing.ts
  src/orthographic-camera-rig.ts
  src/camera-interaction-controller.ts
  src/gesture-controller.ts
  src/dom-input-binding.ts
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

apps/game/src/
  main.ts
  game-bootstrap.ts
  game-input.ts
  game-ui.ts
  style.css

apps/terrain-lab/src/bootstrap.ts
browser-tests/game.spec.ts
browser-tests/interaction.spec.ts
browser-tests/visual-evidence.spec.ts
docs/evidence/prototype-interaction-completion-v0-1.md
```

---

### Task 1: Canonical camera state, limits, and projected fitted framing

**Files:**
- Create: `packages/camera-input/src/camera-state.ts`
- Create: `packages/camera-input/src/camera-framing.ts`
- Modify: `packages/camera-input/src/orthographic-camera-rig.ts`
- Modify: `packages/camera-input/src/index.ts`
- Create: `packages/camera-input/test/camera-framing.test.ts`
- Modify: `packages/camera-input/test/orthographic-camera-rig.test.ts`

**Interfaces:**
- Consumes: Three.js `OrthographicCamera`, map dimensions
- Produces: `CameraState`, `CameraLimits`, `ViewportInsets`, `WorldVerticalBounds`, `CameraFitRequest`, `CameraFitResult`, `calculateFittedOrthographicSize`, revised `OrthographicCameraRig`

- [ ] **Step 1: Write RED tests for exact defaults and limit validation**

```ts
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CAMERA_DEFAULTS, OrthographicCameraRig } from '../src/index.js';

const MAP = { mapWidth: 128, mapHeight: 128, cellSize: 1 } as const;

it('starts with the accepted Unity-derived defaults', () => {
  const rig = new OrthographicCameraRig(new THREE.OrthographicCamera(), MAP);
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
  expect(rig.state).toMatchObject({ targetX: 0, targetZ: 0, yawDegrees: 45, pitchDegrees: 50 });
});

it.each([
  [{ minimumPitchDegrees: 66, maximumPitchDegrees: 65 }, 'camera:invalid-pitch-limits'],
  [{ minimumPitchDegrees: 10, maximumPitchDegrees: 65 }, 'camera:pitch-limit-outside-hard-envelope'],
  [{ minimumOrthographicSize: 50, maximumOrthographicSize: 20 }, 'camera:invalid-zoom-limits'],
] as const)('rejects invalid limits', (overrides, code) => {
  expect(() => new OrthographicCameraRig(new THREE.OrthographicCamera(), MAP, overrides)).toThrowError(
    expect.objectContaining({ code }),
  );
});
```

- [ ] **Step 2: Write RED projected-fit tests**

```ts
it.each([
  ['desktop', 1440, 900, { top: 0, right: 0, bottom: 0, left: 372 }],
  ['tablet', 1024, 768, { top: 0, right: 0, bottom: 0, left: 340 }],
  ['mobile', 390, 844, { top: 168, right: 0, bottom: 0, left: 0 }],
  ['ultrawide', 2560, 1080, { top: 0, right: 0, bottom: 0, left: 372 }],
] as const)('fits all projected corners for %s', (_, width, height, insets) => {
  const fit = calculateFittedOrthographicSize({
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
  expect(fit.usableWidth).toBeGreaterThan(0);
  expect(fit.usableHeight).toBeGreaterThan(0);
  for (const corner of fit.projectedCorners) {
    expect(Math.abs(corner.x)).toBeLessThanOrEqual(fit.halfWidth + 1e-6);
    expect(Math.abs(corner.y)).toBeLessThanOrEqual(fit.halfHeight + 1e-6);
  }
});

it('rejects a viewport fully consumed by insets', () => {
  expect(() =>
    calculateFittedOrthographicSize({
      viewportWidth: 300,
      viewportHeight: 200,
      insets: { top: 100, right: 150, bottom: 100, left: 150 },
      targetX: 0,
      targetZ: 0,
      yawDegrees: 45,
      pitchDegrees: 50,
      worldHalfWidth: 64,
      worldHalfHeight: 64,
      minimumWorldY: -1.5,
      maximumWorldY: 2,
      marginRatio: 0.08,
    }),
  ).toThrowError(expect.objectContaining({ code: 'camera:invalid-usable-viewport' }));
});
```

- [ ] **Step 3: Run and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- camera-framing.test.ts orthographic-camera-rig.test.ts
```

Expected: FAIL because continuous state, limits, and fitted framing do not exist.

- [ ] **Step 4: Implement exact state contracts**

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

export interface WorldVerticalBounds {
  readonly minimumWorldY: number;
  readonly maximumWorldY: number;
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

`CameraContractError` exposes the stable codes used by tests. Reject all non-finite values.

- [ ] **Step 5: Implement projected framing**

Build eight corners from `±worldHalfWidth`, `±worldHalfHeight`, `minimumWorldY`, and `maximumWorldY`. Construct camera right/up/forward basis from yaw and pitch, project corners relative to target, subtract viewport insets, calculate horizontal/vertical extents, apply the `8%` margin, and return the larger required orthographic half-height.

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

- [ ] **Step 6: Replace quarter-turn/fixed-pitch rig state**

Required API:

```ts
get state(): CameraState;
get fittedOrthographicSize(): number;
get usableViewportHeight(): number;
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

Normalize yaw into `[0, 360)`, clamp pitch/size/target, and update projection plus pose atomically. `rotateLeft/Right` add exact `-90/+90` degrees. Relative resize zoom is `oldSize / oldFittedSize`, applied to the new fitted size and clamped.

- [ ] **Step 7: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/camera-input test -- camera-framing.test.ts orthographic-camera-rig.test.ts
pnpm --filter @web-three-city/camera-input typecheck
git add packages/camera-input
git commit -m "feat(input): add canonical camera state and fitted framing"
```

---

### Task 2: Camera-relative pan and terrain-anchored zoom, yaw, and pitch

**Files:**
- Create: `packages/camera-input/src/camera-interaction-controller.ts`
- Modify: `packages/camera-input/src/orthographic-camera-rig.ts`
- Modify: `packages/camera-input/src/index.ts`
- Create: `packages/camera-input/test/camera-interaction-controller.test.ts`

**Interfaces:**
- Consumes: `OrthographicCameraRig`, `TerrainPickResult`
- Produces: `ScreenPoint`, `TerrainAnchorResolver`, `CameraInteractionController`

- [ ] **Step 1: Write RED camera-relative pan tests**

```ts
it.each([
  [45, -1, 1],
  [135, -1, -1],
  [225, 1, -1],
  [315, 1, 1],
] as const)('maps rightward drag relative to yaw %s', (yaw, xSign, zSign) => {
  rig.setViewport(1000, 800, { top: 0, right: 0, bottom: 0, left: 0 });
  rig.setYawDegrees(yaw);
  controller.panScreen({ x: 20, y: 0 });
  expect(Math.sign(rig.state.targetX)).toBe(xSign);
  expect(Math.sign(rig.state.targetZ)).toBe(zSign);
});
```

- [ ] **Step 2: Write RED anchor tests**

```ts
it('corrects target to keep the same terrain point under zoom centroid', () => {
  resolver.queue(
    { cellX: 64, cellZ: 64, localU: 0.5, localV: 0.5, nearestVertexX: 64, nearestVertexZ: 64, worldPoint: { x: 3, y: 1, z: 5 } },
    { cellX: 64, cellZ: 64, localU: 0.5, localV: 0.5, nearestVertexX: 64, nearestVertexZ: 64, worldPoint: { x: 1, y: 1, z: 2 } },
  );
  controller.zoomAt({ x: 500, y: 300 }, 0.8);
  expect(rig.state.targetX).toBeCloseTo(2);
  expect(rig.state.targetZ).toBeCloseTo(3);
});

it('keeps bounded camera operation when anchor picking fails', () => {
  resolver.queue(null, null);
  controller.rotateYawAt({ x: 500, y: 300 }, 17);
  expect(rig.state.yawDegrees).toBe(62);
});

it('lets map bounds override full anchor correction', () => {
  resolver.queue(
    { cellX: 127, cellZ: 127, localU: 1, localV: 1, nearestVertexX: 128, nearestVertexZ: 128, worldPoint: { x: 64, y: 1, z: 64 } },
    { cellX: 0, cellZ: 0, localU: 0, localV: 0, nearestVertexX: 0, nearestVertexZ: 0, worldPoint: { x: -64, y: 1, z: -64 } },
  );
  controller.zoomAt({ x: 900, y: 700 }, 0.5);
  expect(Math.abs(rig.state.targetX)).toBeLessThanOrEqual(64);
  expect(Math.abs(rig.state.targetZ)).toBeLessThanOrEqual(64);
});
```

- [ ] **Step 3: Run and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- camera-interaction-controller.test.ts
```

Expected: FAIL because the controller does not exist.

- [ ] **Step 4: Implement exact controller contract**

```ts
export interface ScreenPoint { readonly x: number; readonly y: number }

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

`panScreen` derives world-units-per-CSS-pixel as `(2 * orthographicSize) / usableViewportHeight`, projects camera right and forward onto XZ, and moves target opposite the drag direction.

- [ ] **Step 5: Implement one anchor-correction path**

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

Locked sensitivity:

```ts
export const CAMERA_INTERACTION_SENSITIVITY = Object.freeze({
  wheelExponentPerDeltaY: -0.001,
  pitchDegreesPerCssPixel: -0.12,
});
```

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @web-three-city/camera-input test -- camera-interaction-controller.test.ts orthographic-camera-rig.test.ts
pnpm --filter @web-three-city/camera-input typecheck
git add packages/camera-input
git commit -m "feat(input): add anchored camera interaction controller"
```

---

### Task 3: Canonical pointer sessions and dominant-aware two-finger classification

**Files:**
- Modify: `packages/camera-input/src/gesture-controller.ts`
- Modify: `packages/camera-input/src/index.ts`
- Modify: `packages/camera-input/test/gesture-controller.test.ts`

**Interfaces:**
- Consumes: `PointerSample`
- Produces: `GestureSessionState`, `TwoFingerGestureFrame`, revised `GestureController`

- [ ] **Step 1: Write RED one-pointer safety tests**

```ts
it('emits tap only for an eligible release inside tap slop', () => {
  controller.pointerDown({ id: 1, x: 20, y: 20 });
  controller.pointerUp({ id: 1, x: 25, y: 24 });
  expect(events).toEqual([{ type: 'tap', point: { x: 25, y: 24 } }]);
});

it('does not emit tap after pan threshold or cancellation', () => {
  controller.pointerDown({ id: 1, x: 20, y: 20 });
  controller.pointerMove({ id: 1, x: 40, y: 20 });
  controller.pointerCancel(1);
  expect(events.some((event) => event.type === 'tap')).toBe(false);
});
```

- [ ] **Step 2: Write RED transition and suppression tests**

```ts
it('emits no delta on the one-to-two pointer transition frame', () => {
  controller.pointerDown({ id: 1, x: 100, y: 100 });
  controller.pointerDown({ id: 2, x: 200, y: 100 });
  expect(events).toEqual([]);
});

it('suppresses after a third contact until every contact releases', () => {
  controller.pointerDown({ id: 1, x: 100, y: 100 });
  controller.pointerDown({ id: 2, x: 200, y: 100 });
  controller.pointerDown({ id: 3, x: 150, y: 150 });
  controller.pointerMove({ id: 1, x: 90, y: 100 });
  controller.pointerUp({ id: 3, x: 150, y: 150 });
  controller.pointerMove({ id: 2, x: 220, y: 100 });
  expect(events).toEqual([]);
  controller.pointerUp({ id: 1, x: 90, y: 100 });
  controller.pointerUp({ id: 2, x: 220, y: 100 });
  expect(controller.state).toBe('idle');
});
```

- [ ] **Step 3: Write RED classifier tests**

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

Create exact two-frame samples and assert:

```ts
expect(runPairFrames(pinchFrames).at(-1)).toMatchObject({ dominant: 'pinch' });
expect(runPairFrames(twistFrames).at(-1)).toMatchObject({ dominant: 'yaw' });
expect(runPairFrames(parallelVerticalFrames).at(-1)).toMatchObject({ dominant: 'pitch' });
expect(runPairFrames(exactNormalizedTie).at(-1)).toMatchObject({ dominant: 'pinch' });
expect(runPairFrames(yawWithQualifiedPinch).at(-1)?.zoomScale).toBeCloseTo(Math.exp(rawPinch * 0.25));
```

- [ ] **Step 4: Run and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- gesture-controller.test.ts
```

Expected: current controller fails session ownership, suppression, stabilization, and pitch classification.

- [ ] **Step 5: Implement explicit session state**

```ts
export type GestureSessionState =
  | 'idle'
  | 'one-pointer-pending'
  | 'one-pointer-pan'
  | 'two-pointer-pending'
  | 'two-pointer-active'
  | 'suppressed';
```

Store first-pair IDs, prior positions, candidate dominant axis/count, and established dominant axis. Do not substitute a different pointer into the owning pair.

- [ ] **Step 6: Implement exact metrics and tie policy**

For frame deltas `d1`, `d2`:

```ts
const centroidDelta = { x: (d1.x + d2.x) / 2, y: (d1.y + d2.y) / 2 };
const pinchLogDelta = Math.log(afterDistance / beforeDistance);
const yawRadians = normalizeAngle(afterAngle - beforeAngle);
const sameVerticalDirection = Math.sign(d1.y) === Math.sign(d2.y) && Math.sign(d1.y) !== 0;
const verticalMismatch = Math.abs(d1.y - d2.y) / 2;
const horizontalNoise = Math.max(Math.abs(d1.x), Math.abs(d2.x)) * 0.25;
const rawParallelVertical = sameVerticalDirection ? centroidDelta.y : 0;
const pitchCssPixels = Math.sign(rawParallelVertical) * Math.max(
  0,
  Math.abs(rawParallelVertical) - verticalMismatch - horizontalNoise,
);
```

Scores are absolute delta divided by threshold. Activation requires two consecutive qualifying frames. Exact ties use `Pinch > Yaw > Pitch`.

- [ ] **Step 7: Emit deterministic semantic frames**

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

Dominant axis uses full delta. A secondary axis uses quarter scale only when its own score is `>= 1`; otherwise it is neutral. Pan emits centroid movement unless dominant pitch consumes parallel vertical movement.

- [ ] **Step 8: Verify and commit**

```bash
pnpm --filter @web-three-city/camera-input test -- gesture-controller.test.ts
pnpm --filter @web-three-city/camera-input typecheck
git add packages/camera-input/src/gesture-controller.ts packages/camera-input/src/index.ts packages/camera-input/test/gesture-controller.test.ts
git commit -m "feat(input): add canonical gesture session arbitration"
```

---

### Task 4: Disposable DOM input binding and UI-origin filtering

**Files:**
- Create: `packages/camera-input/src/dom-input-binding.ts`
- Modify: `packages/camera-input/src/index.ts`
- Create: `packages/camera-input/test/dom-input-binding.test.ts`

**Interfaces:**
- Consumes: `GestureController`, `CameraInteractionController`
- Produces: `WorldInputBinding`, `WorldInputBindingOptions`, `bindWorldInput`

- [ ] **Step 1: Add exact happy-dom event helper and RED tests**

```ts
function dispatchPointer(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  id: number,
  x: number,
  y: number,
): PointerEvent {
  const event = new window.PointerEvent(type, {
    pointerId: id,
    pointerType: 'touch',
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
    isPrimary: id === 1,
  });
  target.dispatchEvent(event);
  return event;
}

it('binds accepted world pointer pan and eligible tap', () => {
  const binding = bindWorldInput(options);
  dispatchPointer(canvas, 'pointerdown', 1, 20, 20);
  dispatchPointer(canvas, 'pointermove', 1, 40, 20);
  dispatchPointer(canvas, 'pointerup', 1, 40, 20);
  expect(camera.panScreen).toHaveBeenCalled();
  expect(onEligibleTap).not.toHaveBeenCalled();
  binding.dispose();
});

it.each(['button', 'select', 'input', 'label', '[data-world-input-block]'])('blocks sessions originating from %s', (selector) => {
  const target = document.querySelector<HTMLElement>(selector)!;
  const binding = bindWorldInput(options);
  dispatchPointer(target, 'pointerdown', 1, 20, 20);
  dispatchPointer(canvas, 'pointermove', 1, 60, 20);
  dispatchPointer(canvas, 'pointerup', 1, 60, 20);
  expect(camera.panScreen).not.toHaveBeenCalled();
  expect(onEligibleTap).not.toHaveBeenCalled();
  binding.dispose();
});

it('prevents wheel default and performs pointer-anchored zoom', () => {
  const binding = bindWorldInput(options);
  const event = new window.WheelEvent('wheel', {
    clientX: 100,
    clientY: 80,
    deltaY: -120,
    bubbles: true,
    cancelable: true,
  });
  canvas.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(camera.zoomAt).toHaveBeenCalledWith({ x: 100, y: 80 }, Math.exp(0.12));
  binding.dispose();
});

it('ignores shortcuts while a form control has focus', () => {
  const binding = bindWorldInput(options);
  input.focus();
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'e', bubbles: true }));
  expect(camera.rotateRight).not.toHaveBeenCalled();
  binding.dispose();
});

it('clearActiveSession prevents a later synthetic tap', () => {
  const binding = bindWorldInput(options);
  dispatchPointer(canvas, 'pointerdown', 1, 20, 20);
  binding.clearActiveSession();
  dispatchPointer(canvas, 'pointerup', 1, 20, 20);
  expect(onEligibleTap).not.toHaveBeenCalled();
  binding.dispose();
});
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- dom-input-binding.test.ts
```

Expected: FAIL because the binding does not exist.

- [ ] **Step 3: Implement binding contract**

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

Default selector:

```ts
'button, input, select, textarea, label, a, [data-world-input-block]'
```

Map callbacks exactly:

- one-pointer/two-pointer pan → `camera.panScreen`
- tap → `onEligibleTap`
- zoom → `camera.zoomAt(centroid, scale)`
- yaw → `camera.rotateYawAt(centroid, radians * 180 / Math.PI)`
- pitch → `camera.tiltPitchAt(centroid, pixels * -0.12)`
- wheel → `camera.zoomAt(pointer, Math.exp(deltaY * -0.001))`
- `Q/E/Home` → left/right/reset

Acquire pointer capture on accepted pointer-down. `pointercancel`, `lostpointercapture`, window blur, and `clearActiveSession` cancel without selection. `dispose()` removes all listeners and is idempotent.

- [ ] **Step 4: Verify and commit**

```bash
pnpm --filter @web-three-city/camera-input test -- dom-input-binding.test.ts gesture-controller.test.ts
pnpm --filter @web-three-city/camera-input typecheck
git add packages/camera-input
git commit -m "feat(input): bind canonical gestures to browser events"
```

---

### Task 5: Selected-cell and terrain-conforming grid presentations

**Files:**
- Create: `packages/terrain-three/src/selected-cell-presentation.ts`
- Create: `packages/terrain-three/src/terrain-grid-presentation.ts`
- Modify: `packages/terrain-three/src/index.ts`
- Create: `packages/terrain-three/test/selected-cell-presentation.test.ts`
- Create: `packages/terrain-three/test/terrain-grid-presentation.test.ts`
- Modify: `apps/terrain-lab/src/bootstrap.ts`

**Interfaces:**
- Consumes: `TerrainSnapshot`, `CellCoord`, `ChunkCoord`, accepted terrain topology
- Produces: `SelectedCellPresentation`, `TerrainGridPresentation`

- [ ] **Step 1: Write RED selected-overlay tests**

```ts
it('uses authoritative heights, accepted diagonal, and 0.02 offset', () => {
  const cell = { x: 4, z: 7 } as const;
  presentation.setSelection(snapshot, cell);
  const corners = [
    vertexToWorld({ x: 4, z: 7 }, height(snapshot, 4, 7), WORLD_CONFIG),
    vertexToWorld({ x: 5, z: 7 }, height(snapshot, 5, 7), WORLD_CONFIG),
    vertexToWorld({ x: 4, z: 8 }, height(snapshot, 4, 8), WORLD_CONFIG),
    vertexToWorld({ x: 5, z: 8 }, height(snapshot, 5, 8), WORLD_CONFIG),
  ];
  expect(presentation.debugPositions()).toEqual(
    corners.flatMap((corner) => [corner.x, corner.y + 0.02, corner.z]),
  );
  expect(presentation.debugIndices()).toEqual(expectedIndicesFor(snapshot, cell));
});

it('does not rebuild for the same revision and cell, then hides on clear', () => {
  presentation.setSelection(snapshot, { x: 4, z: 7 });
  const identity = presentation.debugGeometryIdentity();
  presentation.setSelection(snapshot, { x: 4, z: 7 });
  expect(presentation.debugGeometryIdentity()).toBe(identity);
  presentation.clear();
  expect(presentation.visible).toBe(false);
});
```

- [ ] **Step 2: Write RED grid tests**

```ts
it('emits every lattice edge once at terrain height plus 0.015', () => {
  grid.load(snapshot);
  expect(grid.debugSegmentCount()).toBe(2 * 128 * 129);
  const world = vertexToWorld({ x: 16, z: 8 }, height(snapshot, 16, 8), WORLD_CONFIG);
  expect(grid.debugEndpoint({ x: 16, z: 8 })).toEqual({ x: world.x, y: world.y + 0.015, z: world.z });
});

it('shares byte-identical endpoints on neighboring chunk boundaries', () => {
  grid.load(chunkSeamSnapshot);
  expect(grid.debugBoundaryEndpoints({ x: 0, z: 0 }, 'east')).toEqual(
    grid.debugBoundaryEndpoints({ x: 1, z: 0 }, 'west'),
  );
});

it('toggles visibility without geometry replacement', () => {
  grid.load(snapshot);
  const identity = grid.debugRootIdentity();
  grid.setVisible(false);
  grid.setVisible(true);
  expect(grid.debugRootIdentity()).toBe(identity);
});
```

- [ ] **Step 3: Run and verify RED**

```bash
pnpm --filter @web-three-city/terrain-three test -- selected-cell-presentation.test.ts terrain-grid-presentation.test.ts
```

Expected: FAIL because both presentations do not exist.

- [ ] **Step 4: Implement selected-cell presentation**

Own a `THREE.Group` with transparent fill mesh and border `LineSegments`. Sample four lattice corners; use exact `CELL_TRIANGLES`; offset every Y by `0.02`. Fill material: `transparent: true`, `opacity: 0.28`, `depthTest: true`, `depthWrite: false`. Border: `depthTest: true`, `depthWrite: false`.

```ts
constructor(scene: THREE.Scene, config: WorldConfig);
setSelection(snapshot: TerrainSnapshot, cell: CellCoord): void;
clear(): void;
get visible(): boolean;
dispose(): void;
```

Reject invalid cells with `selection:invalid-cell`. Rebuild only when cell or snapshot revision changes.

- [ ] **Step 5: Implement chunked grid ownership**

Each owned cell emits east and south edges. Emit north edges only for global row `0`; emit west edges only for global column `0`. Total segments are `33,024`. Partition lines by terrain chunk. Endpoint height is authoritative height plus `0.015`. No vertical connectors.

```ts
constructor(scene: THREE.Scene, config: WorldConfig);
load(snapshot: TerrainSnapshot): void;
rebuild(snapshot: TerrainSnapshot, chunks: readonly ChunkCoord[]): void;
setVisible(visible: boolean): void;
get visible(): boolean;
dispose(): void;
```

Stage all geometry before publish/swap. Material is transparent, depth-tested, and depth-write disabled.

- [ ] **Step 6: Replace Terrain Lab `GridHelper`**

Remove flat Y=0 `THREE.GridHelper`; create `TerrainGridPresentation`, load fixture snapshot, leave visible by default, and dispose on page hide.

- [ ] **Step 7: Verify and commit**

```bash
pnpm --filter @web-three-city/terrain-three test -- selected-cell-presentation.test.ts terrain-grid-presentation.test.ts
pnpm --filter @web-three-city/terrain-three typecheck
pnpm --filter @web-three-city/terrain-lab build
git add packages/terrain-three apps/terrain-lab/src/bootstrap.ts
git commit -m "feat(three): add selection and terrain grid overlays"
```

---

### Task 6: Integrate the responsive product shell

**Files:**
- Modify: `apps/game/src/main.ts`
- Create: `apps/game/src/game-bootstrap.ts`
- Create: `apps/game/src/game-input.ts`
- Create: `apps/game/src/game-ui.ts`
- Modify: `apps/game/src/style.css`
- Modify: `browser-tests/game.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–5 APIs
- Produces: interactive Game shell and `window.__WEB_THREE_CITY_INTERACTION__`

- [ ] **Step 1: Write RED desktop/mobile framing tests**

```ts
async function readInteractionEvidence(page: Page) {
  return page.evaluate(() => window.__WEB_THREE_CITY_INTERACTION__ ?? null);
}

test('desktop initial view contains complete world with margin', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/game/');
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  const evidence = await readInteractionEvidence(page);
  expect(evidence?.allWorldCornersInsideUsableViewport).toBe(true);
  expect(evidence?.framingMarginRatio).toBeCloseTo(0.08);
});

test('mobile portrait uses compact controls and fitted view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/game/');
  await expect(page.getByTestId('controls-mode')).toHaveText('compact');
  expect((await readInteractionEvidence(page))?.allWorldCornersInsideUsableViewport).toBe(true);
});
```

- [ ] **Step 2: Write RED interaction UI tests**

```ts
test('drag pans without selecting, tap selects, grid toggles, reset restores defaults', async ({ page }) => {
  await page.goto('/game/');
  await page.mouse.move(900, 500);
  await page.mouse.down();
  await page.mouse.move(980, 540, { steps: 3 });
  await page.mouse.up();
  let evidence = await readInteractionEvidence(page);
  expect(evidence?.camera.targetX === 0 && evidence?.camera.targetZ === 0).toBe(false);
  expect(evidence?.selectedCell).toBeNull();

  await page.mouse.click(900, 500);
  evidence = await readInteractionEvidence(page);
  expect(evidence?.selectedCell).not.toBeNull();
  await expect(page.getByTestId('selected-cell')).not.toHaveText('None');

  await page.getByRole('button', { name: 'Grid' }).click();
  expect((await readInteractionEvidence(page))?.gridVisible).toBe(true);

  await page.getByRole('button', { name: 'Reset camera' }).click();
  expect((await readInteractionEvidence(page))?.camera).toMatchObject({
    targetX: 0,
    targetZ: 0,
    yawDegrees: 45,
    pitchDegrees: 50,
  });
});
```

- [ ] **Step 3: Run and verify RED**

```bash
pnpm --filter @web-three-city/game build
pnpm test:browser -- game.spec.ts
```

Expected: FAIL because the current shell lacks gesture binding, overlays, reset, responsive inset framing, and diagnostics.

- [ ] **Step 4: Implement `game-ui.ts`**

`createGameUi(root)` renders typed references for status, quality, Save, Load, Rotate left/right, Reset camera, Grid toggle (`aria-pressed`), selected-cell text, and controls-mode evidence.

`measureViewportInsets(canvas, panel)`:

- desktop/tablet: `left = panel.right - canvas.left + 16`;
- mobile `max-width: 720px`: `top = panel.bottom - canvas.top + 8`, left `0`;
- add CSS safe-area insets;
- clamp insets to canvas bounds.

- [ ] **Step 5: Implement `game-input.ts`**

Create live `TerrainAnchorResolver` with `pickTerrain`, current camera, canvas bounds, current Terrain chunk meshes, and config. Bind `bindWorldInput`; eligible taps pick Terrain and call `onSelection(cell | null)`. Export `clearActiveSession()` and idempotent `dispose()`.

- [ ] **Step 6: Implement `game-bootstrap.ts` composition**

Order:

1. create UI/canvas;
2. detect WebGL2;
3. generate/restore snapshot;
4. create renderer, scene, lights, camera rig, Terrain, selection, and grid presentations;
5. measure viewport, set viewport, and fit world;
6. create camera controller and input binding;
7. wire UI;
8. render;
9. expose read-only interaction evidence;
10. register resize, context, and page-hide cleanup.

`main.ts` becomes:

```ts
import './style.css';
import { bootstrapGame } from './game-bootstrap.js';

const root = document.querySelector<HTMLElement>('#app');
if (root === null) throw new Error('game:missing-root');
bootstrapGame(root);
```

- [ ] **Step 7: Wire exact product actions**

- Rotate buttons: exact `±90°`.
- Reset: remeasure insets, then reset fitted state.
- Grid: toggle only grid visibility and `aria-pressed`.
- Eligible tap: set/clear selection presentation and coordinate.
- Camera movement never changes selection.
- Save/load stays Terrain-only; after load, republish Terrain/grid and reapply current selection against the loaded revision.
- `Q/E/Home` ignore focused form controls.

- [ ] **Step 8: Add responsive CSS**

Desktop panel remains top-left. At `max-width: 720px`, use compact top sheet, reduced padding, wrapping controls, and `env(safe-area-inset-*)`. Keep `canvas { touch-action: none; }`.

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

### Task 7: Multi-touch, cancellation, resize, and context-restoration acceptance

**Files:**
- Create: `browser-tests/interaction.spec.ts`
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `apps/game/src/game-input.ts`

**Interfaces:**
- Consumes: integrated shell
- Produces: complete browser acceptance

- [ ] **Step 1: Add exact Pointer Event helper**

```ts
async function dispatchPointer(
  page: Page,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  id: number,
  x: number,
  y: number,
): Promise<void> {
  await page.locator('#game-canvas').dispatchEvent(type, {
    pointerId: id,
    pointerType: 'touch',
    clientX: x,
    clientY: y,
    isPrimary: id === 1,
    bubbles: true,
    cancelable: true,
  });
}
```

- [ ] **Step 2: Add pinch, continuous twist, and tilt tests**

```ts
test('pinch zooms without selection', async ({ page }) => {
  await page.goto('/game/');
  const before = (await readInteractionEvidence(page))!.camera.orthographicSize;
  await dispatchPointer(page, 'pointerdown', 1, 500, 400);
  await dispatchPointer(page, 'pointerdown', 2, 700, 400);
  await dispatchPointer(page, 'pointermove', 1, 480, 400);
  await dispatchPointer(page, 'pointermove', 2, 720, 400);
  await dispatchPointer(page, 'pointermove', 1, 460, 400);
  await dispatchPointer(page, 'pointermove', 2, 740, 400);
  await dispatchPointer(page, 'pointerup', 1, 460, 400);
  await dispatchPointer(page, 'pointerup', 2, 740, 400);
  const after = await readInteractionEvidence(page);
  expect(after!.camera.orthographicSize).toBeLessThan(before);
  expect(after!.selectedCell).toBeNull();
});

test('twist produces non-quarter-turn continuous yaw', async ({ page }) => {
  await page.goto('/game/');
  await dispatchPointer(page, 'pointerdown', 1, 500, 400);
  await dispatchPointer(page, 'pointerdown', 2, 700, 400);
  await dispatchPointer(page, 'pointermove', 1, 510, 380);
  await dispatchPointer(page, 'pointermove', 2, 690, 420);
  await dispatchPointer(page, 'pointermove', 1, 525, 365);
  await dispatchPointer(page, 'pointermove', 2, 675, 435);
  const yaw = (await readInteractionEvidence(page))!.camera.yawDegrees;
  expect(yaw % 90).not.toBeCloseTo(0);
});

test('parallel upward drag increases pitch within design limits', async ({ page }) => {
  await page.goto('/game/');
  await dispatchPointer(page, 'pointerdown', 1, 500, 450);
  await dispatchPointer(page, 'pointerdown', 2, 700, 450);
  await dispatchPointer(page, 'pointermove', 1, 500, 430);
  await dispatchPointer(page, 'pointermove', 2, 700, 430);
  await dispatchPointer(page, 'pointermove', 1, 500, 410);
  await dispatchPointer(page, 'pointermove', 2, 700, 410);
  const pitch = (await readInteractionEvidence(page))!.camera.pitchDegrees;
  expect(pitch).toBeGreaterThan(50);
  expect(pitch).toBeLessThanOrEqual(65);
});
```

- [ ] **Step 3: Add suppression/cancellation tests**

Test all exact cases:

1. drag release does not select;
2. two-pointer release does not select;
3. third pointer suppresses until all release;
4. pointer cancel does not select;
5. pointer originating on UI cannot move camera;
6. context loss during active session followed by release cannot select.

For each case, assert `selectedCell === null` and `activePointerCount === 0` after cleanup.

- [ ] **Step 4: Add resize/context restoration tests**

Assert:

- Reset after desktop→mobile resize uses mobile insets and all corners fit;
- grid visibility survives context restore;
- selected cell and overlay survive context restore;
- scene contains exactly one Terrain root, one grid root, and one selection root after restore;
- no console errors.

- [ ] **Step 5: Run and commit**

```bash
pnpm test:browser -- interaction.spec.ts game.spec.ts
git add browser-tests/interaction.spec.ts apps/game/src
git commit -m "test(browser): verify canonical interaction lifecycle"
```

---

### Task 8: Visual evidence, performance observations, and exact-head acceptance

**Files:**
- Modify: `browser-tests/visual-evidence.spec.ts`
- Create: `docs/evidence/prototype-interaction-completion-v0-1.md`
- Modify: `.github/workflows/ci.yml` only if artifact paths require extension
- Modify: PR body

**Interfaces:**
- Consumes: all completed implementation
- Produces: visual artifact, trace/video, performance record, exact-head acceptance

- [ ] **Step 1: Capture exact screenshots**

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

Use deterministic viewports and coordinates. Record a Playwright trace or video showing pan, pinch, twist, tilt, selection, grid toggle, and reset.

- [ ] **Step 2: Add bounded development-only performance evidence**

```ts
interface InteractionPerformanceEvidence {
  readonly processedPointerFrames: number;
  readonly medianPointerFrameMs: number;
  readonly p95PointerFrameMs: number;
  readonly selectionRebuildCount: number;
  readonly gridRebuildCount: number;
}
```

Collect only in evidence mode. Target `< 1 ms` median per pointer frame on CI desktop; report deviations without a hard mobile gate.

- [ ] **Step 3: Run complete frozen-lock verification**

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

Every command must exit `0`; no PASS is inferred from source inspection.

- [ ] **Step 4: Record exact evidence**

Evidence document contains base/head SHA, Node/pnpm/Three.js/browser versions, unit/browser counts, camera constants, fitted-view evidence, gesture scenarios, performance values, screenshot/trace SHA-256 hashes, known limitations, physical-device status (`NOT RUN — device unavailable` unless run), and owner physical-feel status `PENDING`.

- [ ] **Step 5: Re-run after evidence changes**

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

PR body includes exact refs, task summary, Unity provenance/no-copy declaration, changed-file boundary, full gate results, browser evidence, known limitations, explicit Water exclusion, merge status `not performed`, and owner physical-feel approval `pending`.

---

## Final Acceptance Checklist

- [ ] Desktop and mobile initial views contain the full world with `8%` usable-viewport margin.
- [ ] One-finger/primary drag pans using camera-relative XZ axes.
- [ ] Eligible tap/click selects one Terrain cell and displays authoritative-height overlay.
- [ ] Wheel and pinch zoom within `18..170`.
- [ ] Twist rotates yaw continuously.
- [ ] Parallel vertical drag changes pitch within `35°..65°`.
- [ ] Anchored zoom/yaw/pitch preserves Terrain point best-effort.
- [ ] Map bounds override anchoring.
- [ ] Transitions, drag, cancellation, UI-origin, context loss, and third contact produce no synthetic selection.
- [ ] Buttons and `Q/E` apply exact `90°`; Reset and `Home` restore `(0,0)`, `45°`, `50°`, fitted size.
- [ ] Grid is terrain-conforming, seam-safe, and visibility-only on toggle.
- [ ] Product grid defaults Off; Terrain Lab grid defaults On.
- [ ] Selection/grid survive context restoration.
- [ ] Listeners, captures, geometry, and materials dispose idempotently.
- [ ] Frozen-lock format, lint, typecheck, provenance, unit, coverage, build, browser, and visual gates pass.
- [ ] Exact-head evidence is recorded.
- [ ] Owner approves physical interaction feel before merge.
- [ ] Water, shoreline, Terraform, Roads, Buildings, inertia, perspective mode, generic object selection, and third-party camera controls remain excluded.
