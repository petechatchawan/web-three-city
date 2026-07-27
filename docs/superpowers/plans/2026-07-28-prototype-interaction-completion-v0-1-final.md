# Prototype Interaction Completion v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the browser prototype interaction layer with Unity-compatible pan, terrain-anchored zoom/yaw/pitch, Terrain-cell selection, terrain-conforming grid display, responsive fitted framing, and lifecycle-safe browser integration.

**Architecture:** `packages/camera-input` owns camera state, projected framing, gesture arbitration, terrain anchoring, and disposable browser bindings. `packages/terrain-three` owns selected-cell and grid overlays. `apps/game` composes those units and exposes read-only diagnostics for browser acceptance without mutating authoritative Terrain data.

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
  interaction-evidence.ts
  style.css

apps/terrain-lab/src/bootstrap.ts
browser-tests/helpers/interaction.ts
browser-tests/game.spec.ts
browser-tests/interaction.spec.ts
browser-tests/visual-evidence.spec.ts
docs/evidence/prototype-interaction-completion-v0-1.md
```

---

### Task 1: Canonical camera state and fitted framing

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

- [ ] **Step 1: Write failing state and limit tests**

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

- [ ] **Step 2: Write failing projected-fit tests**

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
  expect(() => calculateFittedOrthographicSize({
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
  })).toThrowError(expect.objectContaining({ code: 'camera:invalid-usable-viewport' }));
});
```

- [ ] **Step 3: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- camera-framing.test.ts orthographic-camera-rig.test.ts
```

Expected: FAIL because continuous state and fitted framing do not exist.

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
```

Add `CameraContractError` with stable codes from tests and reject non-finite values.

- [ ] **Step 5: Implement projected fitting**

Build eight world corners from `±worldHalfWidth`, `±worldHalfHeight`, `minimumWorldY`, and `maximumWorldY`. Construct camera basis from yaw/pitch, project corners relative to target, subtract insets, calculate horizontal/vertical extents, add `8%`, and return required orthographic half-height.

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

```ts
get state(): CameraState;
get fittedOrthographicSize(): number;
get usableViewportHeight(): number;
setViewport(width: number, height: number, insets: ViewportInsets): void;
fitToWorld(bounds: WorldVerticalBounds): void;
resizePreservingRelativeZoom(width: number, height: number, insets: ViewportInsets, bounds: WorldVerticalBounds): void;
resetToFit(bounds: WorldVerticalBounds): void;
setOrthographicSize(size: number): void;
setYawDegrees(yawDegrees: number): void;
setPitchDegrees(pitchDegrees: number): void;
rotateLeft(): void;
rotateRight(): void;
panWorld(deltaX: number, deltaZ: number): void;
```

Normalize yaw into `[0,360)`, clamp pitch/size/target, and update pose/projection atomically. Relative resize zoom is `oldSize / oldFittedSize`, applied to the new fitted size and clamped.

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

- [ ] **Step 1: Write failing pan and anchor tests**

```ts
class QueueResolver implements TerrainAnchorResolver {
  readonly #values: Array<TerrainPickResult | null> = [];
  queue(...values: Array<TerrainPickResult | null>): void { this.#values.push(...values); }
  pick(_point: ScreenPoint): TerrainPickResult | null { return this.#values.shift() ?? null; }
}

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

it('corrects target to preserve the centroid Terrain point', () => {
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

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/camera-input test -- camera-interaction-controller.test.ts
```

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement the controller**

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

`panScreen` uses `(2 * orthographicSize) / usableViewportHeight`, camera-right and camera-forward projected onto XZ, and inverse drag.

- [ ] **Step 4: Implement one anchor-correction path**

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

- [ ] **Step 5: Verify GREEN and commit**

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

- [ ] **Step 1: Write failing session tests**

```ts
let events: Array<{ type: string; point?: { x: number; y: number } }>;
let controller: GestureController;

beforeEach(() => {
  events = [];
  controller = new GestureController({
    onTap: (point) => events.push({ type: 'tap', point }),
    onPan: () => events.push({ type: 'pan' }),
    onTwoFingerGesture: () => events.push({ type: 'two' }),
  });
});

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

it('suppresses a third-contact session until every contact releases', () => {
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

- [ ] **Step 2: Write failing classifier tests**

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

- [ ] **Step 4: Implement state and classifier**

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

Scores are absolute delta divided by threshold. Exact ties use `Pinch > Yaw > Pitch`. Dominant axis is full scale; independently qualified secondary axes use `0.25`.

- [ ] **Step 5: Implement frame metrics and stabilization**

```ts
const centroidDelta = { x: (d1.x + d2.x) / 2, y: (d1.y + d2.y) / 2 };
const pinchLogDelta = Math.log(afterDistance / beforeDistance);
const yawRadians = normalizeAngle(afterAngle - beforeAngle);
const sameVerticalDirection = Math.sign(d1.y) === Math.sign(d2.y) && Math.sign(d1.y) !== 0;
const verticalMismatch = Math.abs(d1.y - d2.y) / 2;
const horizontalNoise = Math.max(Math.abs(d1.x), Math.abs(d2.x)) * 0.25;
const rawVertical = sameVerticalDirection ? centroidDelta.y : 0;
const pitchCssPixels = Math.sign(rawVertical) * Math.max(0, Math.abs(rawVertical) - verticalMismatch - horizontalNoise);
```

Activation requires two consecutive qualifying frames. Transition from one pointer to two emits no delta.

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

### Task 4: Disposable browser binding and UI-origin filtering

**Files:**
- Create: `packages/camera-input/src/dom-input-binding.ts`
- Modify: `packages/camera-input/src/index.ts`
- Create: `packages/camera-input/test/dom-input-binding.test.ts`

**Interfaces:**
- Consumes: `GestureController`, `CameraInteractionController`
- Produces: `WorldInputBinding`, `WorldInputBindingOptions`, `bindWorldInput`

- [ ] **Step 1: Write failing binding tests with complete setup**

```ts
import { beforeEach, expect, it, vi } from 'vitest';

let canvas: HTMLCanvasElement;
let button: HTMLButtonElement;
let input: HTMLInputElement;
let onEligibleTap: ReturnType<typeof vi.fn>;
let onReset: ReturnType<typeof vi.fn>;
let camera: {
  panScreen: ReturnType<typeof vi.fn>;
  zoomAt: ReturnType<typeof vi.fn>;
  rotateYawAt: ReturnType<typeof vi.fn>;
  tiltPitchAt: ReturnType<typeof vi.fn>;
  rotateLeft: ReturnType<typeof vi.fn>;
  rotateRight: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  document.body.innerHTML = '<canvas id="world"></canvas><button>UI</button><input />';
  canvas = document.querySelector('#world')!;
  button = document.querySelector('button')!;
  input = document.querySelector('input')!;
  onEligibleTap = vi.fn();
  onReset = vi.fn();
  camera = {
    panScreen: vi.fn(), zoomAt: vi.fn(), rotateYawAt: vi.fn(), tiltPitchAt: vi.fn(),
    rotateLeft: vi.fn(), rotateRight: vi.fn(),
  };
});

function dispatchPointer(target: EventTarget, type: string, id: number, x: number, y: number): void {
  target.dispatchEvent(new window.PointerEvent(type, {
    pointerId: id, pointerType: 'touch', clientX: x, clientY: y,
    bubbles: true, cancelable: true, isPrimary: id === 1,
  }));
}

function createBinding(): WorldInputBinding {
  return bindWorldInput({
    canvas,
    keyboardTarget: window,
    camera: camera as unknown as CameraInteractionController,
    onEligibleTap,
    onReset,
  });
}

it('pans without tapping after drag', () => {
  const binding = createBinding();
  dispatchPointer(canvas, 'pointerdown', 1, 20, 20);
  dispatchPointer(canvas, 'pointermove', 1, 40, 20);
  dispatchPointer(canvas, 'pointerup', 1, 40, 20);
  expect(camera.panScreen).toHaveBeenCalled();
  expect(onEligibleTap).not.toHaveBeenCalled();
  binding.dispose();
});

it('blocks a session originating from UI', () => {
  const binding = createBinding();
  dispatchPointer(button, 'pointerdown', 1, 20, 20);
  dispatchPointer(canvas, 'pointermove', 1, 60, 20);
  dispatchPointer(canvas, 'pointerup', 1, 60, 20);
  expect(camera.panScreen).not.toHaveBeenCalled();
  expect(onEligibleTap).not.toHaveBeenCalled();
  binding.dispose();
});

it('anchors wheel zoom and prevents default', () => {
  const binding = createBinding();
  const event = new window.WheelEvent('wheel', {
    clientX: 100, clientY: 80, deltaY: -120, bubbles: true, cancelable: true,
  });
  canvas.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(camera.zoomAt).toHaveBeenCalledWith({ x: 100, y: 80 }, Math.exp(0.12));
  binding.dispose();
});

it('ignores shortcuts while a form control is focused', () => {
  const binding = createBinding();
  input.focus();
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'e', bubbles: true }));
  expect(camera.rotateRight).not.toHaveBeenCalled();
  binding.dispose();
});

it('clears active session without synthetic tap', () => {
  const binding = createBinding();
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

Default selector is `'button, input, select, textarea, label, a, [data-world-input-block]'`.

Map callbacks exactly: pan→`panScreen`; tap→`onEligibleTap`; zoom→`zoomAt`; yaw→`rotateYawAt`; pitch→`tiltPitchAt`; wheel scale=`Math.exp(deltaY * -0.001)`; `Q/E/Home`→left/right/reset. Acquire pointer capture on accepted pointer-down. Cancel on `pointercancel`, `lostpointercapture`, blur, or explicit clear. Disposal is idempotent.

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

- [ ] **Step 1: Write failing pure-data tests**

```ts
function latticeHeight(snapshot: TerrainSnapshot, x: number, z: number): number {
  return snapshot.heightLevels[z * (snapshot.width + 1) + x]!;
}

function corners(snapshot: TerrainSnapshot, cell: CellCoord): TerrainCorners {
  return {
    nw: latticeHeight(snapshot, cell.x, cell.z),
    ne: latticeHeight(snapshot, cell.x + 1, cell.z),
    sw: latticeHeight(snapshot, cell.x, cell.z + 1),
    se: latticeHeight(snapshot, cell.x + 1, cell.z + 1),
  };
}

it('builds selected overlay from authoritative heights and diagonal', () => {
  const cell = { x: 4, z: 7 } as const;
  const data = buildSelectedCellOverlayData(snapshot, cell, WORLD_CONFIG);
  const expectedPositions = [
    { x: 4, z: 7 }, { x: 5, z: 7 }, { x: 4, z: 8 }, { x: 5, z: 8 },
  ].flatMap((coord) => {
    const world = vertexToWorld(coord, latticeHeight(snapshot, coord.x, coord.z), WORLD_CONFIG);
    return [world.x, world.y + 0.02, world.z];
  });
  expect(Array.from(data.positions)).toEqual(expectedPositions);
  expect(Array.from(data.indices)).toEqual(
    selectTerrainDiagonal(corners(snapshot, cell)) === 'sw-ne'
      ? [2, 3, 1, 2, 1, 0]
      : [2, 3, 0, 3, 1, 0],
  );
});

function boundaryTriples(data: TerrainGridChunkData, worldX: number): string[] {
  const result = new Set<string>();
  for (let index = 0; index < data.positions.length; index += 3) {
    if (Math.abs(data.positions[index]! - worldX) <= 1e-6) {
      result.add(`${data.positions[index]!.toFixed(6)},${data.positions[index + 1]!.toFixed(6)},${data.positions[index + 2]!.toFixed(6)}`);
    }
  }
  return [...result].sort();
}

it('emits every lattice edge once and preserves seam endpoints', () => {
  const total = allChunkCoords(WORLD_CONFIG)
    .map((chunk) => buildTerrainGridChunkData(snapshot, chunk, WORLD_CONFIG).segmentCount)
    .reduce((sum, count) => sum + count, 0);
  expect(total).toBe(2 * 128 * 129);

  const west = buildTerrainGridChunkData(chunkSeamSnapshot, { x: 0, z: 0 }, WORLD_CONFIG);
  const east = buildTerrainGridChunkData(chunkSeamSnapshot, { x: 1, z: 0 }, WORLD_CONFIG);
  expect(boundaryTriples(west, -48)).toEqual(boundaryTriples(east, -48));
});
```

- [ ] **Step 2: Write failing lifecycle tests**

```ts
it('toggles grid without replacing its scene root', () => {
  grid.load(snapshot);
  const root = grid.object3d;
  grid.setVisible(false);
  grid.setVisible(true);
  expect(grid.object3d).toBe(root);
});

it('does not rebuild identical selection revision/cell', () => {
  selection.setSelection(snapshot, { x: 4, z: 7 });
  const root = selection.object3d;
  selection.setSelection(snapshot, { x: 4, z: 7 });
  expect(selection.object3d).toBe(root);
});
```

- [ ] **Step 3: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/terrain-three test -- selected-cell-presentation.test.ts terrain-grid-presentation.test.ts
```

Expected: FAIL because builders and presentations do not exist.

- [ ] **Step 4: Implement selected-cell overlay**

Sample four lattice corners, use exact `CELL_TRIANGLES`, offset Y by `0.02`, and render transparent fill plus border. Fill uses `opacity:0.28`, `depthTest:true`, `depthWrite:false`; border uses `depthTest:true`, `depthWrite:false`.

```ts
constructor(scene: THREE.Scene, config: WorldConfig);
setSelection(snapshot: TerrainSnapshot, cell: CellCoord): void;
clear(): void;
get visible(): boolean;
get object3d(): THREE.Object3D;
dispose(): void;
```

Reject invalid cells with `selection:invalid-cell`; rebuild only on cell/revision change.

- [ ] **Step 5: Implement chunked grid**

Each owned cell emits east and south edges. Emit north only for global row `0`; west only for global column `0`. Total segments are `33,024`. Endpoint Y is authoritative height + `0.015`; no vertical connectors. Stage load/rebuild before publish/swap.

```ts
constructor(scene: THREE.Scene, config: WorldConfig);
load(snapshot: TerrainSnapshot): void;
rebuild(snapshot: TerrainSnapshot, chunks: readonly ChunkCoord[]): void;
setVisible(visible: boolean): void;
get visible(): boolean;
get object3d(): THREE.Object3D;
dispose(): void;
```

- [ ] **Step 6: Replace Terrain Lab flat grid**

Remove `THREE.GridHelper`, load `TerrainGridPresentation`, keep visible by default, and dispose on page hide.

- [ ] **Step 7: Verify GREEN and commit**

```bash
pnpm --filter @web-three-city/terrain-three test -- selected-cell-presentation.test.ts terrain-grid-presentation.test.ts
pnpm --filter @web-three-city/terrain-three typecheck
pnpm --filter @web-three-city/terrain-lab build
git add packages/terrain-three apps/terrain-lab/src/bootstrap.ts
git commit -m "feat(three): add selection and terrain grid overlays"
```

---

### Task 6: Responsive Game composition and shared browser helpers

**Files:**
- Modify: `apps/game/src/main.ts`
- Create: `apps/game/src/game-bootstrap.ts`
- Create: `apps/game/src/game-input.ts`
- Create: `apps/game/src/game-ui.ts`
- Create: `apps/game/src/interaction-evidence.ts`
- Modify: `apps/game/src/style.css`
- Modify: `browser-tests/game.spec.ts`
- Create: `browser-tests/helpers/interaction.ts`

**Interfaces:**
- Consumes: Tasks 1–5 APIs
- Produces: interactive Game shell, `window.__WEB_THREE_CITY_INTERACTION__`, `GAME_URL`, `readEvidence`, `dispatchCanvasTouch`, `dispatchTouchOn`

- [ ] **Step 1: Create exact evidence contract and test helpers**

```ts
// apps/game/src/interaction-evidence.ts
export interface InteractionEvidence {
  readonly camera: CameraState;
  readonly selectedCell: CellCoord | null;
  readonly gridVisible: boolean;
  readonly activePointerCount: number;
  readonly allWorldCornersInsideUsableViewport: boolean;
  readonly framingMarginRatio: number;
  readonly sceneRootCounts: { readonly terrain: number; readonly grid: number; readonly selection: number };
}

declare global {
  interface Window { __WEB_THREE_CITY_INTERACTION__?: InteractionEvidence }
}
```

```ts
// browser-tests/helpers/interaction.ts
import type { Locator, Page } from '@playwright/test';
import type { InteractionEvidence } from '../../apps/game/src/interaction-evidence.js';

export const GAME_URL = 'http://127.0.0.1:4174/';

export async function readEvidence(page: Page): Promise<InteractionEvidence> {
  return page.evaluate(() => window.__WEB_THREE_CITY_INTERACTION__!);
}

export async function dispatchTouchOn(
  target: Locator,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  id: number,
  x: number,
  y: number,
): Promise<void> {
  await target.dispatchEvent(type, {
    pointerId: id,
    pointerType: 'touch',
    clientX: x,
    clientY: y,
    isPrimary: id === 1,
    bubbles: true,
    cancelable: true,
  });
}

export async function dispatchCanvasTouch(
  page: Page,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  id: number,
  x: number,
  y: number,
): Promise<void> {
  await dispatchTouchOn(page.locator('#game-canvas'), type, id, x, y);
}
```

- [ ] **Step 2: Write failing Game browser tests**

```ts
import { expect, test } from '@playwright/test';
import { GAME_URL, readEvidence } from './helpers/interaction.js';

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

test('drag pans, tap selects, grid toggles, and reset restores defaults', async ({ page }) => {
  await page.goto(GAME_URL);
  await page.mouse.move(900, 500);
  await page.mouse.down();
  await page.mouse.move(980, 540, { steps: 3 });
  await page.mouse.up();
  let evidence = await readEvidence(page);
  expect(evidence.camera.targetX === 0 && evidence.camera.targetZ === 0).toBe(false);
  expect(evidence.selectedCell).toBeNull();

  await page.mouse.click(900, 500);
  expect((await readEvidence(page)).selectedCell).not.toBeNull();
  await page.getByRole('button', { name: 'Grid' }).click();
  expect((await readEvidence(page)).gridVisible).toBe(true);
  await page.getByRole('button', { name: 'Reset camera' }).click();
  expect((await readEvidence(page)).camera).toMatchObject({
    targetX: 0, targetZ: 0, yawDegrees: 45, pitchDegrees: 50,
  });
});
```

- [ ] **Step 3: Run tests and verify RED**

```bash
pnpm --filter @web-three-city/game build
pnpm test:browser -- game.spec.ts
```

Expected: FAIL because the current shell lacks gestures, overlays, reset, and inset-aware framing.

- [ ] **Step 4: Implement UI and inset measurement**

Render status, quality, Save, Load, Rotate left/right, Reset, Grid (`aria-pressed`), selected-cell text, and controls mode. Define CSS `--safe-top/right/bottom/left` with `env(safe-area-inset-*, 0px)`. Measure panel/canvas rects plus parsed safe-area values. Desktop reserves panel right + `16px`; mobile `max-width:720px` reserves panel bottom + `8px`.

- [ ] **Step 5: Implement Game input adapter**

Create live `TerrainAnchorResolver` from `pickTerrain`, current camera, canvas rect, current chunk meshes, and config. Bind world input. Eligible taps call `onSelection(cell | null)`. Export `activePointerCount`, `clearActiveSession`, and idempotent `dispose`.

- [ ] **Step 6: Implement composition root**

Order: UI/canvas → WebGL2 → snapshot → renderer/scene/lights → camera/Terrain/selection/grid → viewport fit → controller/binding → UI actions → render → evidence → lifecycle.

```ts
// main.ts
import './style.css';
import { bootstrapGame } from './game-bootstrap.js';
const root = document.querySelector<HTMLElement>('#app');
if (root === null) throw new Error('game:missing-root');
bootstrapGame(root);
```

Actions: buttons rotate `±90°`; reset remeasures/fits; Grid changes visibility only; tap sets/clears selection; camera movement preserves selection; save/load remains Terrain-only and republishes grid/selection against loaded revision; shortcuts ignore form focus.

- [ ] **Step 7: Add responsive CSS and verify GREEN**

Desktop panel remains top-left. Mobile uses compact top sheet, safe-area padding, wrapping controls, and `canvas { touch-action:none; }`.

```bash
pnpm --filter @web-three-city/game typecheck
pnpm --filter @web-three-city/game build
pnpm test:browser -- game.spec.ts
pnpm lint
git add apps/game browser-tests
git commit -m "feat(game): integrate canonical terrain interaction shell"
```

---

### Task 7: Multi-touch, suppression, resize, and restoration acceptance

**Files:**
- Create: `browser-tests/interaction.spec.ts`
- Modify: `apps/game/src/game-bootstrap.ts`
- Modify: `apps/game/src/game-input.ts`

**Interfaces:**
- Consumes: `GAME_URL`, `readEvidence`, `dispatchCanvasTouch`, `dispatchTouchOn`
- Produces: complete browser acceptance

- [ ] **Step 1: Write pinch, twist, and tilt tests**

```ts
import { expect, test } from '@playwright/test';
import {
  GAME_URL,
  dispatchCanvasTouch,
  dispatchTouchOn,
  readEvidence,
} from './helpers/interaction.js';

test('pinch zooms without selection', async ({ page }) => {
  await page.goto(GAME_URL);
  const before = (await readEvidence(page)).camera.orthographicSize;
  await dispatchCanvasTouch(page, 'pointerdown', 1, 500, 400);
  await dispatchCanvasTouch(page, 'pointerdown', 2, 700, 400);
  await dispatchCanvasTouch(page, 'pointermove', 1, 480, 400);
  await dispatchCanvasTouch(page, 'pointermove', 2, 720, 400);
  await dispatchCanvasTouch(page, 'pointermove', 1, 460, 400);
  await dispatchCanvasTouch(page, 'pointermove', 2, 740, 400);
  await dispatchCanvasTouch(page, 'pointerup', 1, 460, 400);
  await dispatchCanvasTouch(page, 'pointerup', 2, 740, 400);
  const after = await readEvidence(page);
  expect(after.camera.orthographicSize).toBeLessThan(before);
  expect(after.selectedCell).toBeNull();
});

test('twist produces continuous yaw', async ({ page }) => {
  await page.goto(GAME_URL);
  await dispatchCanvasTouch(page, 'pointerdown', 1, 500, 400);
  await dispatchCanvasTouch(page, 'pointerdown', 2, 700, 400);
  await dispatchCanvasTouch(page, 'pointermove', 1, 510, 380);
  await dispatchCanvasTouch(page, 'pointermove', 2, 690, 420);
  await dispatchCanvasTouch(page, 'pointermove', 1, 525, 365);
  await dispatchCanvasTouch(page, 'pointermove', 2, 675, 435);
  expect((await readEvidence(page)).camera.yawDegrees % 90).not.toBeCloseTo(0);
});

test('parallel upward drag increases pitch within limits', async ({ page }) => {
  await page.goto(GAME_URL);
  await dispatchCanvasTouch(page, 'pointerdown', 1, 500, 450);
  await dispatchCanvasTouch(page, 'pointerdown', 2, 700, 450);
  await dispatchCanvasTouch(page, 'pointermove', 1, 500, 430);
  await dispatchCanvasTouch(page, 'pointermove', 2, 700, 430);
  await dispatchCanvasTouch(page, 'pointermove', 1, 500, 410);
  await dispatchCanvasTouch(page, 'pointermove', 2, 700, 410);
  const pitch = (await readEvidence(page)).camera.pitchDegrees;
  expect(pitch).toBeGreaterThan(50);
  expect(pitch).toBeLessThanOrEqual(65);
});
```

- [ ] **Step 2: Write suppression and cancellation tests**

```ts
test('third contact suppresses until all contacts release', async ({ page }) => {
  await page.goto(GAME_URL);
  await dispatchCanvasTouch(page, 'pointerdown', 1, 500, 400);
  await dispatchCanvasTouch(page, 'pointerdown', 2, 700, 400);
  await dispatchCanvasTouch(page, 'pointerdown', 3, 600, 500);
  await dispatchCanvasTouch(page, 'pointermove', 1, 450, 400);
  await dispatchCanvasTouch(page, 'pointerup', 3, 600, 500);
  await dispatchCanvasTouch(page, 'pointermove', 2, 750, 400);
  await dispatchCanvasTouch(page, 'pointerup', 1, 450, 400);
  await dispatchCanvasTouch(page, 'pointerup', 2, 750, 400);
  const evidence = await readEvidence(page);
  expect(evidence.selectedCell).toBeNull();
  expect(evidence.activePointerCount).toBe(0);
});

test('pointer cancellation cannot select', async ({ page }) => {
  await page.goto(GAME_URL);
  await dispatchCanvasTouch(page, 'pointerdown', 1, 500, 400);
  await dispatchCanvasTouch(page, 'pointercancel', 1, 500, 400);
  const evidence = await readEvidence(page);
  expect(evidence.selectedCell).toBeNull();
  expect(evidence.activePointerCount).toBe(0);
});
```

- [ ] **Step 3: Write UI-origin and context-interruption tests**

```ts
test('a pointer starting on UI never moves the world', async ({ page }) => {
  await page.goto(GAME_URL);
  const before = (await readEvidence(page)).camera;
  const saveButton = page.getByRole('button', { name: 'Save terrain' });
  const box = await saveButton.boundingBox();
  if (box === null) throw new Error('missing Save terrain bounds');
  await dispatchTouchOn(saveButton, 'pointerdown', 1, box.x + 5, box.y + 5);
  await dispatchTouchOn(saveButton, 'pointermove', 1, box.x + 80, box.y + 40);
  await dispatchTouchOn(saveButton, 'pointerup', 1, box.x + 80, box.y + 40);
  const after = await readEvidence(page);
  expect(after.camera).toEqual(before);
  expect(after.selectedCell).toBeNull();
});

test('context loss clears an active session before release', async ({ page }) => {
  await page.goto(GAME_URL);
  await dispatchCanvasTouch(page, 'pointerdown', 1, 500, 400);
  await page.locator('#game-canvas').evaluate((canvas) => {
    canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  });
  await dispatchCanvasTouch(page, 'pointerup', 1, 500, 400);
  const evidence = await readEvidence(page);
  expect(evidence.activePointerCount).toBe(0);
  expect(evidence.selectedCell).toBeNull();
});
```

- [ ] **Step 4: Write resize and restoration tests**

```ts
test('reset after resize uses new usable viewport', async ({ page }) => {
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
  await expect(page.getByTestId('game-status')).toHaveText('Ready');
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

### Task 8: Visual evidence and exact-head acceptance

**Files:**
- Modify: `browser-tests/visual-evidence.spec.ts`
- Create: `docs/evidence/prototype-interaction-completion-v0-1.md`
- Modify: `.github/workflows/ci.yml` only when artifact paths require extension
- Modify: PR body

**Interfaces:**
- Consumes: all completed implementation
- Produces: screenshots, trace/video, performance record, exact-head acceptance

- [ ] **Step 1: Capture required screenshots**

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

Use deterministic viewports/coordinates. Record a Playwright trace or video demonstrating pan, pinch, twist, tilt, selection, grid toggle, and reset.

- [ ] **Step 2: Add bounded evidence-mode timing**

```ts
export interface InteractionPerformanceEvidence {
  readonly processedPointerFrames: number;
  readonly medianPointerFrameMs: number;
  readonly p95PointerFrameMs: number;
  readonly selectionRebuildCount: number;
  readonly gridRebuildCount: number;
}
```

Collect only in evidence mode. Target `<1 ms` median per pointer frame on CI desktop; report deviations without a hard mobile gate.

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

Record base/head SHA, Node/pnpm/Three.js/browser versions, unit/browser counts, camera constants, fitted-view results, gesture scenarios, performance values, screenshot/trace SHA-256 hashes, known limitations, physical-device status (`NOT RUN — device unavailable` unless run), and owner physical-feel status `PENDING`.

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
