import {
  CAMERA_INTERACTION_SENSITIVITY,
  type CameraInteractionController,
  type ScreenPoint,
} from './camera-interaction-controller.js';
import { GestureController, type PointerSample } from './gesture-controller.js';

const DEFAULT_UI_BLOCK_SELECTOR =
  'button, input, select, textarea, label, a, [data-world-input-block]';

export interface PrimaryPointerToolDelegate {
  isEnabled(): boolean;
  begin(pointerId: number, point: ScreenPoint): boolean;
  move(pointerId: number, point: ScreenPoint): void;
  end(pointerId: number, point: ScreenPoint): void;
  cancel(pointerId: number): void;
  cancelAll(): void;
}

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
  readonly tool?: PrimaryPointerToolDelegate;
  readonly uiBlockSelector?: string;
}

function toCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): ScreenPoint {
  const bounds = canvas.getBoundingClientRect();
  const left = Number.isFinite(bounds.left) ? bounds.left : 0;
  const top = Number.isFinite(bounds.top) ? bounds.top : 0;
  return { x: clientX - left, y: clientY - top };
}

function toPointerSample(canvas: HTMLCanvasElement, event: PointerEvent): PointerSample {
  const point = toCanvasPoint(canvas, event.clientX, event.clientY);
  return { id: event.pointerId, x: point.x, y: point.y };
}

function toScreenPoint(sample: PointerSample): ScreenPoint {
  return { x: sample.x, y: sample.y };
}

function isBlockedTarget(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

function isFormControlFocused(): boolean {
  const active = document.activeElement;
  return (
    active instanceof Element &&
    active.matches('input, select, textarea, button, [contenteditable="true"]')
  );
}

export function bindWorldInput(options: WorldInputBindingOptions): WorldInputBinding {
  const selector = options.uiBlockSelector ?? DEFAULT_UI_BLOCK_SELECTOR;
  const acceptedPointers = new Set<number>();
  let toolPointerId: number | null = null;
  let toolLatestSample: PointerSample | null = null;
  let gestureOnlyUntilEmpty = false;
  let disposed = false;

  const gestures = new GestureController({
    onTap: options.onEligibleTap,
    onPan: (delta) => options.camera.panScreen(delta),
    onTwoFingerGesture: (frame) => {
      if (frame.panDelta.x !== 0 || frame.panDelta.y !== 0) {
        options.camera.panScreen(frame.panDelta);
      }
      if (frame.zoomScale !== 1) options.camera.zoomAt(frame.centroid, frame.zoomScale);
      if (frame.yawRadians !== 0) {
        options.camera.rotateYawAt(
          frame.centroid,
          frame.yawRadians * CAMERA_INTERACTION_SENSITIVITY.twistDegreesPerRadian,
        );
      }
      if (frame.pitchCssPixels !== 0) {
        options.camera.tiltPitchAt(
          frame.centroid,
          frame.pitchCssPixels * CAMERA_INTERACTION_SENSITIVITY.pitchDegreesPerCssPixel,
        );
      }
    },
  });

  const releaseCapture = (pointerId: number): void => {
    if (options.canvas.hasPointerCapture?.(pointerId)) {
      try {
        options.canvas.releasePointerCapture(pointerId);
      } catch {
        // Capture can already be released by the browser during interruption.
      }
    }
  };

  const resetOwnershipWhenEmpty = (): void => {
    if (acceptedPointers.size !== 0) return;
    toolPointerId = null;
    toolLatestSample = null;
    gestureOnlyUntilEmpty = false;
  };

  const clearActiveSession = (): void => {
    if (toolPointerId !== null) options.tool?.cancelAll();
    for (const pointerId of acceptedPointers) releaseCapture(pointerId);
    acceptedPointers.clear();
    gestures.clearActiveSession();
    toolPointerId = null;
    toolLatestSample = null;
    gestureOnlyUntilEmpty = false;
  };

  const transferToolToGestures = (second: PointerSample): void => {
    const first = toolLatestSample;
    options.tool?.cancelAll();
    toolPointerId = null;
    toolLatestSample = null;
    gestureOnlyUntilEmpty = true;
    gestures.clearActiveSession();
    if (first !== null) gestures.pointerDown(first);
    gestures.pointerDown(second);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (isBlockedTarget(event.target, selector)) return;
    const sample = toPointerSample(options.canvas, event);
    acceptedPointers.add(event.pointerId);
    try {
      options.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort on browsers that reject stale contacts.
    }

    if (toolPointerId !== null) {
      transferToolToGestures(sample);
      return;
    }

    if (gestureOnlyUntilEmpty) {
      gestures.pointerDown(sample);
      return;
    }

    if (
      acceptedPointers.size === 1 &&
      options.tool?.isEnabled() === true &&
      options.tool.begin(sample.id, toScreenPoint(sample))
    ) {
      toolPointerId = sample.id;
      toolLatestSample = sample;
      return;
    }

    gestures.pointerDown(sample);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!acceptedPointers.has(event.pointerId)) return;
    const sample = toPointerSample(options.canvas, event);
    if (event.pointerId === toolPointerId) {
      toolLatestSample = sample;
      options.tool?.move(sample.id, toScreenPoint(sample));
      return;
    }
    gestures.pointerMove(sample);
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!acceptedPointers.has(event.pointerId)) return;
    const sample = toPointerSample(options.canvas, event);
    if (event.pointerId === toolPointerId) {
      options.tool?.end(sample.id, toScreenPoint(sample));
      toolPointerId = null;
      toolLatestSample = null;
    } else {
      gestures.pointerUp(sample);
    }
    acceptedPointers.delete(event.pointerId);
    releaseCapture(event.pointerId);
    resetOwnershipWhenEmpty();
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (!acceptedPointers.has(event.pointerId)) return;
    if (event.pointerId === toolPointerId) {
      options.tool?.cancel(event.pointerId);
      toolPointerId = null;
      toolLatestSample = null;
    } else {
      gestures.pointerCancel(event.pointerId);
    }
    acceptedPointers.delete(event.pointerId);
    releaseCapture(event.pointerId);
    resetOwnershipWhenEmpty();
  };

  const onLostPointerCapture = (event: PointerEvent): void => {
    if (acceptedPointers.has(event.pointerId)) clearActiveSession();
  };

  const onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const point = toCanvasPoint(options.canvas, event.clientX, event.clientY);
    const scale = Math.exp(event.deltaY * CAMERA_INTERACTION_SENSITIVITY.wheelExponentPerDeltaY);
    options.camera.zoomAt(point, scale);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (isFormControlFocused()) return;
    const key = event.key.toLowerCase();
    if (key === 'q') {
      event.preventDefault();
      options.camera.rotateLeft();
    } else if (key === 'e') {
      event.preventDefault();
      options.camera.rotateRight();
    } else if (event.key === 'Home') {
      event.preventDefault();
      options.onReset();
    }
  };

  options.canvas.addEventListener('pointerdown', onPointerDown);
  options.canvas.addEventListener('pointermove', onPointerMove);
  options.canvas.addEventListener('pointerup', onPointerUp);
  options.canvas.addEventListener('pointercancel', onPointerCancel);
  options.canvas.addEventListener('lostpointercapture', onLostPointerCapture);
  options.canvas.addEventListener('wheel', onWheel, { passive: false });
  options.keyboardTarget.addEventListener('keydown', onKeyDown);
  options.keyboardTarget.addEventListener('blur', clearActiveSession);

  return {
    get activePointerCount(): number {
      return acceptedPointers.size;
    },
    clearActiveSession,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clearActiveSession();
      options.canvas.removeEventListener('pointerdown', onPointerDown);
      options.canvas.removeEventListener('pointermove', onPointerMove);
      options.canvas.removeEventListener('pointerup', onPointerUp);
      options.canvas.removeEventListener('pointercancel', onPointerCancel);
      options.canvas.removeEventListener('lostpointercapture', onLostPointerCapture);
      options.canvas.removeEventListener('wheel', onWheel);
      options.keyboardTarget.removeEventListener('keydown', onKeyDown);
      options.keyboardTarget.removeEventListener('blur', clearActiveSession);
    },
  };
}
