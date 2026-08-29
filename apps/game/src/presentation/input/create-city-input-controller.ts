import type { CityCameraController } from "../camera/create-city-camera";
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

export interface CityInputController {
  dispose(): void;
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

export function createCityInputController(input: {
  readonly viewport: HTMLElement;
  readonly camera: CityCameraController;
  readonly requestRender: () => void;
  readonly onTap: (clientX: number, clientY: number) => void;
  readonly config?: CityInputConfig;
}): CityInputController {
  const config = input.config ?? CITY_INPUT_DEFAULT_CONFIG;
  const previousTouchAction = input.viewport.style.touchAction;
  input.viewport.style.touchAction = "none";
  let gestureState = createInitialGestureState();
  let disposed = false;

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
      input.camera.dispatch({
        type: "pan",
        rightMeters: -intent.deltaX * panScale,
        forwardMeters: -intent.deltaY * panScale,
      });
    } else if (intent.type === "rotatePixels") {
      input.camera.dispatch({
        type: "rotate",
        azimuthDeltaRadians: -intent.deltaX * config.rotateRadiansPerPixel,
        elevationDeltaRadians: -intent.deltaY * config.rotateRadiansPerPixel,
      });
    } else {
      input.camera.dispatch({
        type: "pan",
        rightMeters: -intent.panDeltaX * panScale,
        forwardMeters: -intent.panDeltaY * panScale,
      });
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
    input.camera.dispatch({
      type: "zoom",
      distanceFactor: Math.exp(event.deltaY * config.zoomWheelExponentPerPixel),
    });
    input.requestRender();
  };
  const onContextMenu = (event: MouseEvent): void => event.preventDefault();

  input.viewport.addEventListener("pointerdown", onPointerDown);
  input.viewport.addEventListener("pointermove", onPointerMove);
  input.viewport.addEventListener("pointerup", onPointerUp);
  input.viewport.addEventListener("pointercancel", onPointerCancel);
  input.viewport.addEventListener("wheel", onWheel, { passive: false });
  input.viewport.addEventListener("contextmenu", onContextMenu);

  return Object.freeze({
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const pointer of gestureState.pointers) releaseCapture(pointer.id);
      gestureState = createInitialGestureState();
      input.viewport.removeEventListener("pointerdown", onPointerDown);
      input.viewport.removeEventListener("pointermove", onPointerMove);
      input.viewport.removeEventListener("pointerup", onPointerUp);
      input.viewport.removeEventListener("pointercancel", onPointerCancel);
      input.viewport.removeEventListener("wheel", onWheel);
      input.viewport.removeEventListener("contextmenu", onContextMenu);
      input.viewport.style.touchAction = previousTouchAction;
    },
  });
}
