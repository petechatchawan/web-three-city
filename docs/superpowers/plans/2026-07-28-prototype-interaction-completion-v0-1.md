# Prototype Interaction Completion v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the browser prototype interaction layer with Unity-compatible pan, terrain-anchored zoom/yaw/pitch, Terrain-cell selection, terrain-conforming grid display, responsive fitted framing, and product lifecycle coverage.

**Architecture:** `packages/camera-input` owns serializable camera state, fitted-view calculation, gesture classification, terrain anchoring, and disposable browser bindings. `packages/terrain-three` owns selected-cell and grid overlays. `apps/game` remains a composition root that connects those packages without mutating authoritative Terrain data or moving interaction policy into application code.

**Tech Stack:** Node.js 22+, pnpm 10.13.1, TypeScript 6 strict mode, Three.js 0.185.1 WebGL2, Vitest 4, happy-dom 20, Playwright 1.61, Vite 8, Pointer Events, GitHub Actions.

## Global Constraints

- Approved specification: `docs/superpowers/specs/2026-07-28-prototype-interaction-completion-v0-1-design.md`.
- Owner approval date: `2026-07-28`.
- Normative Unity behavior source: `petechatchawan/cityBuilder@19b29e32cb24ed7535fc08aafbd6a7ffe6b1daeb`, `docs/superpowers/specs/2026-07-24-camera-interaction-ux-v0-2-design.md`.
- Transcribe behavior contracts and authored constants only; do not copy Unity production source, scenes, serialized data, implementation structure, or third-party camera package code.
- One-finger tap selects Terrain; one-finger drag pans; two-finger pinch zooms; two-finger twist rotates yaw continuously; two-finger parallel vertical drag tilts pitch.
- The first stable two-pointer pair owns the gesture until release/cancel. A third pointer suppresses world input until every contact releases.
- Contact transitions, cancellation, UI-origin sessions, drag, context loss, and multi-touch never synthesize Terrain selection.
- Default yaw is `45°`; default pitch is `50°`; design pitch limits are `35°–65°`; hard pitch limits are `20°–80°`.
- Orthographic-size limits are `18..170`.
- Rotate buttons and `Q/E` apply exact `-90°/+90°` yaw steps. `Home` and Reset Camera restore the canonical fitted view.
- Initial/reset framing contains the complete Terrain and diorama vertical extent inside the usable viewport with an `8%` margin.
- Map bounds have priority over terrain-anchor preservation.
- Product grid defaults Off; Terrain Lab grid defaults On.
- Selected-cell offset is `0.02`; grid endpoint offset is `0.015` world units.
- Selection and grid are presentation-only and excluded from Terrain save data.
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

### Task 1: Canonical camera state, limits, and fitted framing

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

- [ ] **Step 1: Write failing tests for exact defaults and limits**

```ts
import { expect, it } from 'vitest';
import * as THREE from 'three';
import { CAMERA_DEFAULTS, OrthographicCameraRig } from '../src/index.js';

const MAP = { mapWidth: 128, mapHeight: 128, cellSize: 1 } as const;

it('starts with accepted defaults', () => {
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

- [ ] **Step 2: Write failing fitted-view tests**

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
  for (const corner of fit.projectedCorners) {
    expect(Math.abs(corner.x)).toBeLessThanOrEqual(fit.halfWidth + 1e-6);
    expect(Math.abs(corner.y)).toBeLessThanOrEqual(fit.halfHeight + 1e-6);
  }
});

it('rejects a viewport consumed by insets', () => {
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

- [ ] **Step 3: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- camera-framing.test.ts orthographic-camera-rig.test.ts
```

Expected: FAIL because continuous camera state and fitted framing do not exist.

- [ ] **Step 4: Implement state contracts**

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
```

Add `CameraContractError` with stable codes from the tests. Reject non-finite values.

- [ ] **Step 5: Implement projected fitting**

Build eight world corners from `±worldHalfWidth`, `±worldHalfHeight`, `minimumWorldY`, and `maximumWorldY`. Construct camera basis vectors from yaw/pitch, project corners relative to target, subtract insets from viewport, calculate horizontal/vertical extents, add `8%`, and return required orthographic half-height.

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

Normalize yaw into `[0,360)`, clamp pitch/size/target, and apply projection plus pose atomically. Relative resize zoom is `oldSize / oldFittedSize`, applied to the new fitted size and clamped.

- [ ] **Step 7: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/camera-input test -- camera-framing.test.ts orthographic-camera-rig.test.ts
pnpm --filter @web-three-city/camera-input typecheck
git add packages/camera-input
git commit -m "feat(input): add canonical camera state and fitted framing"
```

---

### Task 2: Camera-relative pan and terrain anchoring

**Files:**
- Create: `packages/camera-input/src/camera-interaction-controller.ts`
- Modify: `packages/camera-input/src/orthographic-camera-rig.ts`
- Modify: `packages/camera-input/src/index.ts`
- Create: `packages/camera-input/test/camera-interaction-controller.test.ts`

**Interfaces:**
- Consumes: `OrthographicCameraRig`, `TerrainPickResult`
- Produces: `ScreenPoint`, `TerrainAnchorResolver`, `CameraInteractionController`

- [ ] **Step 1: Write failing pan-direction tests**

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

- [ ] **Step 2: Write failing anchoring tests**

```ts
class QueueResolver implements TerrainAnchorResolver {
  readonly #values: Array<TerrainPickResult | null> = [];
  queue(...values: Array<TerrainPickResult | null>): void { this.#values.push(...values); }
  pick(): TerrainPickResult | null { return this.#values.shift() ?? null; }
}

it('corrects target to preserve centroid terrain point', () => {
  resolver.queue(
    { cellX: 64, cellZ: 64, localU: 0.5, localV: 0.5, nearestVertexX: 64, nearestVertexZ: 64, worldPoint: { x: 3, y: 1, z: 5 } },
    { cellX: 64, cellZ: 64, localU: 0.5, localV: 0.5, nearestVertexX: 64, nearestVertexZ: 64, worldPoint: { x: 1, y: 1, z: 2 } },
  );
  controller.zoomAt({ x: 500, y: 300 }, 0.8);
  expect(rig.state.targetX).toBeCloseTo(2);
  expect(rig.state.targetZ).toBeCloseTo(3);
});

it('keeps bounded operation when picking fails', () => {
  resolver.queue(null, null);
  controller.rotateYawAt({ x: 500, y: 300 }, 17);
  expect(rig.state.yawDegrees).toBe(62);
});
```

- [ ] **Step 3: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- camera-interaction-controller.test.ts
```

Expected: FAIL because the controller does not exist.

- [ ] **Step 4: Implement controller API**

```ts
export interface ScreenPoint { readonly x: number; readonly y: number }
export interface TerrainAnchorResolver { pick(point: ScreenPoint): TerrainPickResult | null }

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

`panScreen` uses `(2 * orthographicSize) / usableViewportHeight`, camera-right and camera-forward projected onto XZ, and direct-manipulation inverse drag.

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

Map clamping remains in the rig. Lock wheel exponent `-0.001` and pitch scale `-0.12°/CSS px`.

- [ ] **Step 6: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/camera-input test -- camera-interaction-controller.test.ts orthographic-camera-rig.test.ts
pnpm --filter @web-three-city/camera-input typecheck
git add packages/camera-input
git commit -m "feat(input): add anchored camera interaction controller"
```

---

### Task 3: Pointer sessions and dominant-aware classification

**Files:**
- Modify: `packages/camera-input/src/gesture-controller.ts`
- Modify: `packages/camera-input/src/index.ts`
- Modify: `packages/camera-input/test/gesture-controller.test.ts`

**Interfaces:**
- Consumes: `PointerSample`
- Produces: `GestureSessionState`, `TwoFingerAxisInput`, `TwoFingerAxisResult`, `classifyTwoFingerAxes`, `TwoFingerGestureFrame`, revised `GestureController`

- [ ] **Step 1: Write failing session-safety tests**

```ts
it('emits tap only inside tap slop', () => {
  controller.pointerDown({ id: 1, x: 20, y: 20 });
  controller.pointerUp({ id: 1, x: 25, y: 24 });
  expect(events).toEqual([{ type: 'tap', point: { x: 25, y: 24 } }]);
});

it('does not tap after pan or cancellation', () => {
  controller.pointerDown({ id: 1, x: 20, y: 20 });
  controller.pointerMove({ id: 1, x: 40, y: 20 });
  controller.pointerCancel(1);
  expect(events.some((event) => event.type === 'tap')).toBe(false);
});

it('emits nothing on one-to-two transition', () => {
  controller.pointerDown({ id: 1, x: 100, y: 100 });
  controller.pointerDown({ id: 2, x: 200, y: 100 });
  expect(events).toEqual([]);
});

it('suppresses after third contact until all release', () => {
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

- [ ] **Step 2: Write failing pure-classifier tests**

```ts
const OPTIONS = {
  tapSlopCssPixels: 8,
  activationFrames: 2,
  pinchLogThreshold: 0.012,
  yawRadiansThreshold: 0.012,
  pitchCssPixelsThreshold: 3,
  panNoiseCssPixels: 0.75,
  secondaryScale: 0.25,
} as const;

it.each([
  [{ pinchLogDelta: 0.024, yawRadians: 0.006, pitchCssPixels: 0 }, 'pinch'],
  [{ pinchLogDelta: 0.006, yawRadians: 0.024, pitchCssPixels: 0 }, 'yaw'],
  [{ pinchLogDelta: 0, yawRadians: 0.006, pitchCssPixels: 6 }, 'pitch'],
  [{ pinchLogDelta: 0.012, yawRadians: 0.012, pitchCssPixels: 3 }, 'pinch'],
] as const)('classifies %o as %s', (input, dominant) => {
  expect(classifyTwoFingerAxes(input, OPTIONS).dominant).toBe(dominant);
});

it('quarter-scales an independently qualified secondary axis', () => {
  const result = classifyTwoFingerAxes(
    { pinchLogDelta: 0.012, yawRadians: 0.024, pitchCssPixels: 0 },
    OPTIONS,
  );
  expect(result.dominant).toBe('yaw');
  expect(result.zoomScale).toBeCloseTo(Math.exp(0.012 * 0.25));
});
```

- [ ] **Step 3: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- gesture-controller.test.ts
```

Expected: current controller fails suppression, stabilization, pitch, and tie-priority tests.

- [ ] **Step 4: Implement session state and pure classifier**

```ts
export type GestureSessionState =
  | 'idle'
  | 'one-pointer-pending'
  | 'one-pointer-pan'
  | 'two-pointer-pending'
  | 'two-pointer-active'
  | 'suppressed';

export interface TwoFingerAxisInput {
  readonly pinchLogDelta: number;
  readonly yawRadians: number;
  readonly pitchCssPixels: number;
}
```

Scores are absolute delta divided by threshold. Exact ties use `Pinch > Yaw > Pitch`. Dominant axis is full scale; independently qualified secondary axes are `0.25` scale.

- [ ] **Step 5: Implement frame metrics**

For frame deltas `d1`, `d2`:

```ts
const centroidDelta = { x: (d1.x + d2.x) / 2, y: (d1.y + d2.y) / 2 };
const pinchLogDelta = Math.log(afterDistance / beforeDistance);
const yawRadians = normalizeAngle(afterAngle - beforeAngle);
const sameVerticalDirection = Math.sign(d1.y) === Math.sign(d2.y) && Math.sign(d1.y) !== 0;
const verticalMismatch = Math.abs(d1.y - d2.y) / 2;
const horizontalNoise = Math.max(Math.abs(d1.x), Math.abs(d2.x)) * 0.25;
const rawVertical = sameVerticalDirection ? centroidDelta.y : 0;
const pitchCssPixels = Math.sign(rawVertical) * Math.max(
  0,
  Math.abs(rawVertical) - verticalMismatch - horizontalNoise,
);
```

Activation requires two consecutive qualifying frames. Do not emit a delta when switching from one pointer to two.

- [ ] **Step 6: Emit semantic frames**

```ts
export interface TwoFingerGestureFrame {
  readonly centroid: Readonly<{ x: number; y: number }>;
  readonly panDelta: Readonly<{ x: number; y: number }>;
  readonly zoomScale: number;
  readonly yawRadians: number;
  readonly pitchCssPixels: number;
  readonly dominant: 'pinch' | 'yaw' | 'pitch';
}
```

Pan uses centroid movement unless dominant pitch consumes parallel vertical movement.

- [ ] **Step 7: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/camera-input test -- gesture-controller.test.ts
pnpm --filter @web-three-city/camera-input typecheck
git add packages/camera-input/src/gesture-controller.ts packages/camera-input/src/index.ts packages/camera-input/test/gesture-controller.test.ts
git commit -m "feat(input): add canonical gesture session arbitration"
```

---

### Task 4: Disposable DOM binding and UI-origin filtering

**Files:**
- Create: `packages/camera-input/src/dom-input-binding.ts`
- Modify: `packages/camera-input/src/index.ts`
- Create: `packages/camera-input/test/dom-input-binding.test.ts`

**Interfaces:**
- Consumes: `GestureController`, `CameraInteractionController`
- Produces: `WorldInputBinding`, `WorldInputBindingOptions`, `bindWorldInput`

- [ ] **Step 1: Write exact failing binding tests**

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

it('pans without tapping after drag', () => {
  const binding = bindWorldInput(options);
  dispatchPointer(canvas, 'pointerdown', 1, 20, 20);
  dispatchPointer(canvas, 'pointermove', 1, 40, 20);
  dispatchPointer(canvas, 'pointerup', 1, 40, 20);
  expect(camera.panScreen).toHaveBeenCalled();
  expect(onEligibleTap).not.toHaveBeenCalled();
  binding.dispose();
});

it.each(['button', 'select', 'input', 'label', '[data-world-input-block]'])('blocks %s origins', (selector) => {
  const target = document.querySelector<HTMLElement>(selector)!;
  const binding = bindWorldInput(options);
  dispatchPointer(target, 'pointerdown', 1, 20, 20);
  dispatchPointer(canvas, 'pointermove', 1, 60, 20);
  dispatchPointer(canvas, 'pointerup', 1, 60, 20);
  expect(camera.panScreen).not.toHaveBeenCalled();
  expect(onEligibleTap).not.toHaveBeenCalled();
  binding.dispose();
});

it('anchors wheel zoom and prevents default', () => {
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

it('ignores shortcuts while a form control is focused', () => {
  const binding = bindWorldInput(options);
  input.focus();
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'e', bubbles: true }));
  expect(camera.rotateRight).not.toHaveBeenCalled();
  binding.dispose();
});

it('clears active session without synthetic tap', () => {
  const binding = bindWorldInput(options);
  dispatchPointer(canvas, 'pointerdown', 1, 20, 20);
  binding.clearActiveSession();
  dispatchPointer(canvas, 'pointerup', 1, 20, 20);
  expect(onEligibleTap).not.toHaveBeenCalled();
  binding.dispose();
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- dom-input-binding.test.ts
```

Expected: FAIL because the binding does not exist.

- [ ] **Step 3: Implement binding contract**

```ts
export interface WorldInputBinding {
  readonly activePointerCount: number;
  clearActiveSession(): void;
  dispose(): void;
}

export interface WorldInputBindingOptions {
  readonly canvas: HTMLCanvasElement;
  readonly keyboardTarget: Window;
  readonly camera: CameraInteractionController;
  readonly onEligibleTap: (point: ScreenPoint) => void;
  readonly onReset: () => void;
  readonly uiBlockSelector?: string;
}
```

Default selector:

```ts
'button, input, select, textarea, label, a, [data-world-input-block]'
```

Map callbacks exactly:

- one-/two-pointer pan → `camera.panScreen`
- tap → `onEligibleTap`
- zoom → `camera.zoomAt(centroid, scale)`
- yaw → `camera.rotateYawAt(centroid, radians * 180 / Math.PI)`
- pitch → `camera.tiltPitchAt(centroid, pixels * -0.12)`
- wheel → `camera.zoomAt(pointer, Math.exp(deltaY * -0.001))`
- `Q/E/Home` → left/right/`onReset`

Acquire pointer capture on accepted pointer-down. `pointercancel`, `lostpointercapture`, window blur, and `clearActiveSession` cancel without selection. `dispose()` removes all listeners and is idempotent.

- [ ] **Step 4: Verify GREEN and commit**

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
- Consumes: `TerrainSnapshot`, `CellCoord`, `ChunkCoord`, accepted topology
- Produces: `SelectedCellOverlayData`, `buildSelectedCellOverlayData`, `SelectedCellPresentation`, `TerrainGridChunkData`, `buildTerrainGridChunkData`, `TerrainGridPresentation`

- [ ] **Step 1: Write failing selected-overlay data tests**

```ts
function latticeHeight(snapshot: TerrainSnapshot, x: number, z: number): number {
  return snapshot.heightLevels[z * (snapshot.width + 1) + x]!;
}

it('uses authoritative heights, accepted diagonal, and 0.02 offset', () => {
  const cell = { x: 4, z: 7 } as const;
  const data = buildSelectedCellOverlayData(snapshot, cell, WORLD_CONFIG);
  const vertices = [
    { x: 4, z: 7 },
    { x: 5, z: 7 },
    { x: 4, z: 8 },
    { x: 5, z: 8 },
  ].flatMap((coord) => {
    const world = vertexToWorld(coord, latticeHeight(snapshot, coord.x, coord.z), WORLD_CONFIG);
    return [world.x, world.y + 0.02, world.z];
  });
  expect(Array.from(data.positions)).toEqual(vertices);
  expect(Array.from(data.indices)).toEqual(
    selectTerrainDiagonal(readCellCorners(snapshot, cell)) === 'sw-ne'
      ? [2, 3, 1, 2, 1, 0]
      : [2, 3, 0, 3, 1, 0],
  );
});
```

- [ ] **Step 2: Write failing grid-data tests**

```ts
function boundaryTriples(data: TerrainGridChunkData, worldX: number): string[] {
  const result = new Set<string>();
  for (let index = 0; index < data.positions.length; index += 3) {
    const x = data.positions[index]!;
    if (Math.abs(x - worldX) <= 1e-6) {
      result.add(`${x.toFixed(6)},${data.positions[index + 1]!.toFixed(6)},${data.positions[index + 2]!.toFixed(6)}`);
    }
  }
  return [...result].sort();
}

it('emits all lattice edges once across the full grid', () => {
  const total = allChunkCoords(WORLD_CONFIG)
    .map((chunk) => buildTerrainGridChunkData(snapshot, chunk, WORLD_CONFIG).segmentCount)
    .reduce((sum, count) => sum + count, 0);
  expect(total).toBe(2 * 128 * 129);
});

it('uses byte-equivalent seam endpoint coordinates', () => {
  const west = buildTerrainGridChunkData(chunkSeamSnapshot, { x: 0, z: 0 }, WORLD_CONFIG);
  const east = buildTerrainGridChunkData(chunkSeamSnapshot, { x: 1, z: 0 }, WORLD_CONFIG);
  expect(boundaryTriples(west, -48)).toEqual(boundaryTriples(east, -48));
});
```

- [ ] **Step 3: Write failing presentation lifecycle tests**

```ts
it('toggles grid visibility without replacing geometry', () => {
  grid.load(snapshot);
  const root = grid.rootForTesting;
  grid.setVisible(false);
  grid.setVisible(true);
  expect(grid.rootForTesting).toBe(root);
});

it('does not rebuild selection for the same cell and revision', () => {
  selection.setSelection(snapshot, { x: 4, z: 7 });
  const geometry = selection.geometryForTesting;
  selection.setSelection(snapshot, { x: 4, z: 7 });
  expect(selection.geometryForTesting).toBe(geometry);
});
```

- [ ] **Step 4: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/terrain-three test -- selected-cell-presentation.test.ts terrain-grid-presentation.test.ts
```

Expected: FAIL because data builders and presentations do not exist.

- [ ] **Step 5: Implement selected-cell overlay**

`buildSelectedCellOverlayData` samples four lattice corners, uses exact `CELL_TRIANGLES`, and offsets Y by `0.02`. `SelectedCellPresentation` owns a transparent fill mesh and border line group.

```ts
constructor(scene: THREE.Scene, config: WorldConfig);
setSelection(snapshot: TerrainSnapshot, cell: CellCoord): void;
clear(): void;
get visible(): boolean;
dispose(): void;
```

Fill: `opacity: 0.28`, `depthTest: true`, `depthWrite: false`. Border: `depthTest: true`, `depthWrite: false`. Reject invalid cell with `selection:invalid-cell`. Rebuild only on cell/revision change.

- [ ] **Step 6: Implement grid data and presentation**

Each owned cell emits east and south edges. Emit north edges only for global row `0`; west edges only for global column `0`. Total segments: `33,024`. Endpoint Y is authoritative height plus `0.015`. Do not emit vertical connectors.

```ts
constructor(scene: THREE.Scene, config: WorldConfig);
load(snapshot: TerrainSnapshot): void;
rebuild(snapshot: TerrainSnapshot, chunks: readonly ChunkCoord[]): void;
setVisible(visible: boolean): void;
get visible(): boolean;
dispose(): void;
```

Stage all geometries before publish/swap. Material is transparent, depth-tested, depth-write disabled.

- [ ] **Step 7: Replace Terrain Lab flat grid**

Remove `THREE.GridHelper`, load `TerrainGridPresentation`, keep visible by default, and dispose on page hide.

- [ ] **Step 8: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/terrain-three test -- selected-cell-presentation.test.ts terrain-grid-presentation.test.ts
pnpm --filter @web-three-city/terrain-three typecheck
pnpm --filter @web-three-city/terrain-lab build
git add packages/terrain-three apps/terrain-lab/src/bootstrap.ts
git commit -m "feat(three): add selection and terrain grid overlays"
```

---

### Task 6: Integrate the responsive Game shell

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

- [ ] **Step 1: Write failing browser tests against the actual Game URL**

```ts
import { expect, test, type Page } from '@playwright/test';

const GAME_URL = 'http://127.0.0.1:4174/';

interface InteractionEvidence {
  readonly camera: {
    readonly targetX: number;
    readonly targetZ: number;
    readonly yawDegrees: number;
    readonly pitchDegrees: number;
    readonly orthographicSize: number;
  };
  readonly selectedCell: { readonly x: number; readonly z: number } | null;
  readonly gridVisible: boolean;
  readonly activePointerCount: number;
  readonly allWorldCornersInsideUsableViewport: boolean;
  readonly framingMarginRatio: number;
}

async function readEvidence(page: Page): Promise<InteractionEvidence> {
  return page.evaluate(() => window.__WEB_THREE_CITY_INTERACTION__!);
}

test('desktop and mobile initial views fit the whole world', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
  expect((await readEvidence(page)).allWorldCornersInsideUsableViewport).toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByTestId('controls-mode')).toHaveText('compact');
  expect((await readEvidence(page)).allWorldCornersInsideUsableViewport).toBe(true);
});

test('drag pans without selection, tap selects, grid toggles, reset restores defaults', async ({ page }) => {
  await page.goto(GAME_URL);
  await page.mouse.move(900, 500);
  await page.mouse.down();
  await page.mouse.move(980, 540, { steps: 3 });
  await page.mouse.up();
  let evidence = await readEvidence(page);
  expect(evidence.camera.targetX === 0 && evidence.camera.targetZ === 0).toBe(false);
  expect(evidence.selectedCell).toBeNull();

  await page.mouse.click(900, 500);
  evidence = await readEvidence(page);
  expect(evidence.selectedCell).not.toBeNull();
  await expect(page.getByTestId('selected-cell')).not.toHaveText('None');

  await page.getByRole('button', { name: 'Grid' }).click();
  expect((await readEvidence(page)).gridVisible).toBe(true);

  await page.getByRole('button', { name: 'Reset camera' }).click();
  expect((await readEvidence(page)).camera).toMatchObject({
    targetX: 0,
    targetZ: 0,
    yawDegrees: 45,
    pitchDegrees: 50,
  });
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/game build
pnpm test:browser -- game.spec.ts
```

Expected: FAIL because the current shell lacks gestures, overlays, reset, and inset-aware framing.

- [ ] **Step 3: Implement `game-ui.ts`**

Render typed references for status, quality, Save, Load, Rotate left/right, Reset camera, Grid toggle (`aria-pressed`), selected cell, and controls mode.

Define CSS safe-area variables:

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
}
```

`measureViewportInsets` reads panel/canvas rects and parsed safe-area custom properties. Desktop: left is `panel.right - canvas.left + 16`. Mobile `max-width: 720px`: top is `panel.bottom - canvas.top + 8`, left is safe-left only. Clamp all insets.

- [ ] **Step 4: Implement `game-input.ts`**

Create live `TerrainAnchorResolver` using `pickTerrain`, current camera, canvas rect, current chunk meshes, and config. Bind `bindWorldInput`. Eligible taps pick Terrain and call `onSelection(cell | null)`. Export `activePointerCount`, `clearActiveSession`, and idempotent `dispose`.

- [ ] **Step 5: Implement `game-bootstrap.ts`**

Composition order:

1. create UI/canvas;
2. detect WebGL2;
3. generate/restore snapshot;
4. create renderer, scene, lights, rig, Terrain, selection, and grid presentations;
5. measure viewport, set viewport, fit world;
6. create interaction controller and input binding;
7. wire UI;
8. render;
9. expose read-only evidence;
10. register resize/context/page-hide cleanup.

`main.ts`:

```ts
import './style.css';
import { bootstrapGame } from './game-bootstrap.js';

const root = document.querySelector<HTMLElement>('#app');
if (root === null) throw new Error('game:missing-root');
bootstrapGame(root);
```

- [ ] **Step 6: Wire exact actions**

- Rotate buttons: exact `±90°`.
- Reset: remeasure insets, then reset fitted state.
- Grid: visibility and `aria-pressed` only.
- Eligible tap: set/clear selection overlay and coordinate.
- Camera movement never changes selection.
- Save/load remains Terrain-only. After load, republish Terrain/grid and reapply current selection against loaded revision.
- `Q/E/Home` ignore form focus.

- [ ] **Step 7: Add responsive CSS**

Desktop panel stays top-left. At `max-width: 720px`, use compact top sheet, reduced padding, wrapping controls, safe-area padding, and `canvas { touch-action: none; }`.

- [ ] **Step 8: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/game typecheck
pnpm --filter @web-three-city/game build
pnpm test:browser -- game.spec.ts
pnpm lint
git add apps/game browser-tests/game.spec.ts
git commit -m "feat(game): integrate canonical terrain interaction shell"
```

---

### Task 7: Multi-touch, cancellation, resize, and context restoration

**Files:**
- Create: `browser-tests/interaction.spec.ts`
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `apps/game/src/game-input.ts`

**Interfaces:**
- Consumes: integrated Game shell
- Produces: complete browser acceptance

- [ ] **Step 1: Add exact Pointer Event helper**

```ts
const GAME_URL = 'http://127.0.0.1:4174/';

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

- [ ] **Step 2: Write pinch, twist, and tilt tests**

```ts
test('pinch zooms without selection', async ({ page }) => {
  await page.goto(GAME_URL);
  const before = (await readEvidence(page)).camera.orthographicSize;
  await dispatchPointer(page, 'pointerdown', 1, 500, 400);
  await dispatchPointer(page, 'pointerdown', 2, 700, 400);
  await dispatchPointer(page, 'pointermove', 1, 480, 400);
  await dispatchPointer(page, 'pointermove', 2, 720, 400);
  await dispatchPointer(page, 'pointermove', 1, 460, 400);
  await dispatchPointer(page, 'pointermove', 2, 740, 400);
  await dispatchPointer(page, 'pointerup', 1, 460, 400);
  await dispatchPointer(page, 'pointerup', 2, 740, 400);
  const after = await readEvidence(page);
  expect(after.camera.orthographicSize).toBeLessThan(before);
  expect(after.selectedCell).toBeNull();
});

test('twist produces continuous yaw', async ({ page }) => {
  await page.goto(GAME_URL);
  await dispatchPointer(page, 'pointerdown', 1, 500, 400);
  await dispatchPointer(page, 'pointerdown', 2, 700, 400);
  await dispatchPointer(page, 'pointermove', 1, 510, 380);
  await dispatchPointer(page, 'pointermove', 2, 690, 420);
  await dispatchPointer(page, 'pointermove', 1, 525, 365);
  await dispatchPointer(page, 'pointermove', 2, 675, 435);
  expect((await readEvidence(page)).camera.yawDegrees % 90).not.toBeCloseTo(0);
});

test('parallel upward drag increases pitch within limits', async ({ page }) => {
  await page.goto(GAME_URL);
  await dispatchPointer(page, 'pointerdown', 1, 500, 450);
  await dispatchPointer(page, 'pointerdown', 2, 700, 450);
  await dispatchPointer(page, 'pointermove', 1, 500, 430);
  await dispatchPointer(page, 'pointermove', 2, 700, 430);
  await dispatchPointer(page, 'pointermove', 1, 500, 410);
  await dispatchPointer(page, 'pointermove', 2, 700, 410);
  const pitch = (await readEvidence(page)).camera.pitchDegrees;
  expect(pitch).toBeGreaterThan(50);
  expect(pitch).toBeLessThanOrEqual(65);
});
```

- [ ] **Step 3: Write suppression and cancellation tests**

```ts
test('third contact suppresses until all pointers release', async ({ page }) => {
  await page.goto(GAME_URL);
  await dispatchPointer(page, 'pointerdown', 1, 500, 400);
  await dispatchPointer(page, 'pointerdown', 2, 700, 400);
  await dispatchPointer(page, 'pointerdown', 3, 600, 500);
  await dispatchPointer(page, 'pointermove', 1, 450, 400);
  await dispatchPointer(page, 'pointerup', 3, 600, 500);
  await dispatchPointer(page, 'pointermove', 2, 750, 400);
  await dispatchPointer(page, 'pointerup', 1, 450, 400);
  await dispatchPointer(page, 'pointerup', 2, 750, 400);
  const evidence = await readEvidence(page);
  expect(evidence.selectedCell).toBeNull();
  expect(evidence.activePointerCount).toBe(0);
});

test('pointer cancel cannot synthesize selection', async ({ page }) => {
  await page.goto(GAME_URL);
  await dispatchPointer(page, 'pointerdown', 1, 500, 400);
  await dispatchPointer(page, 'pointercancel', 1, 500, 400);
  expect((await readEvidence(page)).selectedCell).toBeNull();
  expect((await readEvidence(page)).activePointerCount).toBe(0);
});
```

Also add exact tests for UI-origin drag and context-loss during active pointer session; both assert unchanged camera/selection and zero active pointers after cleanup.

- [ ] **Step 4: Write resize and restoration tests**

```ts
test('reset after resize uses new insets', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(GAME_URL);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Reset camera' }).click();
  expect((await readEvidence(page)).allWorldCornersInsideUsableViewport).toBe(true);
});

test('context restore preserves grid and selection with one root each', async ({ page }) => {
  await page.goto(GAME_URL);
  await page.mouse.click(900, 500);
  await page.getByRole('button', { name: 'Grid' }).click();
  await page.locator('#game-canvas').evaluate((canvas) => {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new Event('webglcontextrestored'));
  });
  const evidence = await readEvidence(page);
  expect(evidence.gridVisible).toBe(true);
  expect(evidence.selectedCell).not.toBeNull();
  expect(evidence.sceneRootCounts).toEqual({ terrain: 1, grid: 1, selection: 1 });
});
```

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
- Modify: `.github/workflows/ci.yml` only when artifact paths require extension
- Modify: PR body

**Interfaces:**
- Consumes: all completed implementation
- Produces: screenshot/trace artifact, performance record, exact-head acceptance

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

Use deterministic viewports and coordinates. Record a Playwright trace or video demonstrating pan, pinch, twist, tilt, selection, grid toggle, and reset.

- [ ] **Step 2: Add bounded evidence-mode timing**

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

Every command must exit `0`. No PASS is inferred from source inspection.

- [ ] **Step 4: Record exact evidence**

The evidence document records base/head SHA, Node/pnpm/Three.js/browser versions, unit/browser counts, camera constants, fitted-view results, gesture scenarios, performance values, screenshot/trace SHA-256 hashes, known limitations, physical-device status (`NOT RUN — device unavailable` unless run), and owner physical-feel status `PENDING`.

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
