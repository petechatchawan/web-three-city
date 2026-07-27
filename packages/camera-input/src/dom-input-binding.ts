import {
  CAMERA_INTERACTION_SENSITIVITY,
  type CameraInteractionController,
  type ScreenPoint,
} from './camera-interaction-controller.js';
import { GestureController, type PointerSample } from './gesture-controller.js';

const DEFAULT_UI_BLOCK_SELECTOR =
  'button, input, select, textarea, label, a, [data-world-input-block]';

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

  const clearActiveSession = (): void => {
    for (const pointerId of acceptedPointers) releaseCapture(pointerId);
    acceptedPointers.clear();
    gestures.clearActiveSession();
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (isBlockedTarget(event.target, selector)) return;
    acceptedPointers.add(event.pointerId);
    try {
      options.canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort on browsers that reject stale contacts.
    }
    gestures.pointerDown(toPointerSample(options.canvas, event));
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (!acceptedPointers.has(event.pointerId)) return;
    gestures.pointerMove(toPointerSample(options.canvas, event));
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (!acceptedPointers.has(event.pointerId)) return;
    gestures.pointerUp(toPointerSample(options.canvas, event));
    acceptedPointers.delete(event.pointerId);
    releaseCapture(event.pointerId);
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (!acceptedPointers.has(event.pointerId)) return;
    gestures.pointerCancel(event.pointerId);
    acceptedPointers.delete(event.pointerId);
    releaseCapture(event.pointerId);
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
      return gestures.activePointerCount;
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
