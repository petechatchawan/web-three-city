import type { CityCameraController } from "../camera/create-city-camera";
import {
  createCityCameraMotionDriver,
  type CameraAnimationEnvironment,
} from "../camera/create-city-camera-motion-driver";
import type { CityCameraIntent } from "../camera/camera-types";
import {
  CITY_INPUT_DEFAULT_CONFIG,
  type CityInputConfig,
} from "./input-config";
import {
  createInitialGestureState,
  reduceGesture,
  type GestureIntent,
  type NormalizedPointerEvent,
} from "./gesture-recognizer";
import {
  clearKeyboardCameraState,
  createInitialKeyboardCameraState,
  deriveKeyboardCameraDrive,
  isCameraKeyCode,
  reduceKeyboardCameraState,
} from "./keyboard-camera-state";

export interface CityInputController {
  dispose(): void;
}

interface EventTargetLike {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

interface VisibilityTargetLike extends EventTargetLike {
  readonly hidden: boolean;
}

function screenPanToCameraIntent(
  deltaX: number,
  deltaY: number,
  metersPerPixel: number,
): Extract<CityCameraIntent, { readonly type: "pan" }> {
  return {
    type: "pan",
    rightMeters: -deltaX * metersPerPixel,
    forwardMeters: deltaY * metersPerPixel,
  };
}

function normalizePointerEvent(
  event: PointerEvent,
  type: NormalizedPointerEvent["type"],
): NormalizedPointerEvent {
  return {
    type,
    id: event.pointerId,
    pointerType: event.pointerType === "touch" ? "touch" : "mouse",
    button: event.button,
    x: event.clientX,
    y: event.clientY,
  };
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (target === null || typeof target !== "object") return false;
  const value = target as {
    readonly tagName?: unknown;
    readonly isContentEditable?: unknown;
  };
  if (value.isContentEditable === true) return true;
  const tagName =
    typeof value.tagName === "string" ? value.tagName.toUpperCase() : "";
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

function browserAnimationEnvironment(): CameraAnimationEnvironment {
  const environment: CameraAnimationEnvironment = {
    now: () => performance.now(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
  };
  return Object.freeze(environment);
}

export function createCityInputController(input: {
  readonly viewport: HTMLElement;
  readonly camera: CityCameraController;
  readonly requestRender: () => void;
  readonly onTap: (clientX: number, clientY: number) => void;
  readonly config?: CityInputConfig;
  readonly keyboardTarget?: EventTargetLike;
  readonly visibilityTarget?: VisibilityTargetLike;
  readonly animationEnvironment?: CameraAnimationEnvironment;
}): CityInputController {
  const config = input.config ?? CITY_INPUT_DEFAULT_CONFIG;
  const keyboardTarget =
    input.keyboardTarget ??
    (typeof window === "undefined" ? undefined : window);
  const visibilityTarget =
    input.visibilityTarget ??
    (typeof document === "undefined" ? undefined : document);
  const previousTouchAction = input.viewport.style.touchAction;
  input.viewport.style.touchAction = "none";
  let gestureState = createInitialGestureState();
  let keyboardState = createInitialKeyboardCameraState();
  let disposed = false;

  const motion = createCityCameraMotionDriver({
    camera: input.camera,
    requestRender: input.requestRender,
    animation: input.animationEnvironment ?? browserAnimationEnvironment(),
  });

  const syncKeyboardDrive = (): void => {
    motion.setDrive(deriveKeyboardCameraDrive(keyboardState));
  };
  const clearKeyboard = (): void => {
    keyboardState = clearKeyboardCameraState();
    motion.clearDrive();
  };

  const dispatchGestureIntent = (intent: GestureIntent): void => {
    if (intent.type === "tap") {
      input.onTap(intent.x, intent.y);
      return;
    }
    const viewportHeight = Math.max(input.viewport.clientHeight, 1);
    const panScale =
      (input.camera.state().distance *
        config.panDistancePerViewportHeightFactor) /
      viewportHeight;
    if (intent.type === "panPixels") {
      input.camera.dispatch(
        screenPanToCameraIntent(intent.deltaX, intent.deltaY, panScale),
      );
    } else if (intent.type === "rotatePixels") {
      input.camera.dispatch({
        type: "rotate",
        azimuthDeltaRadians: -intent.deltaX * config.rotateRadiansPerPixel,
        elevationDeltaRadians: -intent.deltaY * config.rotateRadiansPerPixel,
      });
    } else {
      input.camera.dispatch(
        screenPanToCameraIntent(intent.panDeltaX, intent.panDeltaY, panScale),
      );
      input.camera.dispatch({
        type: "zoom",
        distanceFactor: intent.distanceRatio,
      });
      input.camera.dispatch({
        type: "rotate",
        azimuthDeltaRadians: -intent.rotationDeltaRadians,
        elevationDeltaRadians: 0,
      });
    }
    input.requestRender();
  };

  const transition = (event: NormalizedPointerEvent): void => {
    const result = reduceGesture(gestureState, event, config);
    gestureState = result.state;
    for (const intent of result.intents) dispatchGestureIntent(intent);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (disposed) return;
    input.viewport.setPointerCapture(event.pointerId);
    transition(normalizePointerEvent(event, "down"));
  };
  const onPointerMove = (event: PointerEvent): void => {
    if (disposed) return;
    transition(normalizePointerEvent(event, "move"));
  };
  const releaseCapture = (pointerId: number): void => {
    if (input.viewport.hasPointerCapture(pointerId)) {
      input.viewport.releasePointerCapture(pointerId);
    }
  };
  const onPointerUp = (event: PointerEvent): void => {
    if (disposed) return;
    transition(normalizePointerEvent(event, "up"));
    releaseCapture(event.pointerId);
  };
  const onPointerCancel = (event: PointerEvent): void => {
    if (disposed) return;
    transition(normalizePointerEvent(event, "cancel"));
    releaseCapture(event.pointerId);
  };
  const onWheel = (event: WheelEvent): void => {
    if (disposed) return;
    event.preventDefault();
    motion.queueWheelZoom(event.deltaY * config.zoomWheelExponentPerPixel);
  };
  const onContextMenu = (event: MouseEvent): void => event.preventDefault();
  const onKeyDown = (event: KeyboardEvent): void => {
    if (
      disposed ||
      !isCameraKeyCode(event.code) ||
      isEditableKeyboardTarget(event.target)
    ) {
      return;
    }
    event.preventDefault();
    if (event.repeat && keyboardState.heldCodes.includes(event.code)) return;
    keyboardState = reduceKeyboardCameraState(keyboardState, {
      type: "down",
      code: event.code,
    });
    syncKeyboardDrive();
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    if (disposed || !isCameraKeyCode(event.code)) return;
    event.preventDefault();
    keyboardState = reduceKeyboardCameraState(keyboardState, {
      type: "up",
      code: event.code,
    });
    syncKeyboardDrive();
  };
  const onBlur = (): void => {
    if (!disposed) clearKeyboard();
  };
  const onVisibilityChange = (): void => {
    if (!disposed && visibilityTarget?.hidden === true) clearKeyboard();
  };

  input.viewport.addEventListener("pointerdown", onPointerDown);
  input.viewport.addEventListener("pointermove", onPointerMove);
  input.viewport.addEventListener("pointerup", onPointerUp);
  input.viewport.addEventListener("pointercancel", onPointerCancel);
  input.viewport.addEventListener("wheel", onWheel, { passive: false });
  input.viewport.addEventListener("contextmenu", onContextMenu);
  keyboardTarget?.addEventListener("keydown", onKeyDown as EventListener);
  keyboardTarget?.addEventListener("keyup", onKeyUp as EventListener);
  keyboardTarget?.addEventListener("blur", onBlur as EventListener);
  visibilityTarget?.addEventListener(
    "visibilitychange",
    onVisibilityChange as EventListener,
  );

  return Object.freeze({
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const pointer of gestureState.pointers) releaseCapture(pointer.id);
      gestureState = createInitialGestureState();
      keyboardState = clearKeyboardCameraState();
      motion.dispose();
      input.viewport.removeEventListener("pointerdown", onPointerDown);
      input.viewport.removeEventListener("pointermove", onPointerMove);
      input.viewport.removeEventListener("pointerup", onPointerUp);
      input.viewport.removeEventListener("pointercancel", onPointerCancel);
      input.viewport.removeEventListener("wheel", onWheel);
      input.viewport.removeEventListener("contextmenu", onContextMenu);
      keyboardTarget?.removeEventListener(
        "keydown",
        onKeyDown as EventListener,
      );
      keyboardTarget?.removeEventListener("keyup", onKeyUp as EventListener);
      keyboardTarget?.removeEventListener("blur", onBlur as EventListener);
      visibilityTarget?.removeEventListener(
        "visibilitychange",
        onVisibilityChange as EventListener,
      );
      input.viewport.style.touchAction = previousTouchAction;
    },
  });
}
