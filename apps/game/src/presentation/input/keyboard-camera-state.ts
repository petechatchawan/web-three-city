import type { CityCameraDrive } from "../camera/camera-motion";

export const CAMERA_KEY_CODES = Object.freeze([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyQ",
  "KeyE",
  "ShiftLeft",
  "ShiftRight",
] as const);

export type CameraKeyCode = (typeof CAMERA_KEY_CODES)[number];

export interface KeyboardCameraState {
  readonly heldCodes: readonly CameraKeyCode[];
}

export type KeyboardCameraEvent = {
  readonly type: "down" | "up";
  readonly code: string;
};

export function isCameraKeyCode(code: string): code is CameraKeyCode {
  return (CAMERA_KEY_CODES as readonly string[]).includes(code);
}

export const createInitialKeyboardCameraState = (): KeyboardCameraState =>
  Object.freeze({ heldCodes: Object.freeze([]) });

export function reduceKeyboardCameraState(
  state: KeyboardCameraState,
  event: KeyboardCameraEvent,
): KeyboardCameraState {
  if (!isCameraKeyCode(event.code)) return state;
  const next =
    event.type === "down"
      ? state.heldCodes.includes(event.code)
        ? state.heldCodes
        : [...state.heldCodes, event.code]
      : state.heldCodes.filter((code) => code !== event.code);
  if (next === state.heldCodes) return state;
  return Object.freeze({ heldCodes: Object.freeze(next) });
}

export function clearKeyboardCameraState(): KeyboardCameraState {
  return createInitialKeyboardCameraState();
}

export function deriveKeyboardCameraDrive(
  state: KeyboardCameraState,
): CityCameraDrive {
  const held = (code: CameraKeyCode): boolean => state.heldCodes.includes(code);
  const right = Number(held("KeyD")) - Number(held("KeyA"));
  const forward = Number(held("KeyW")) - Number(held("KeyS"));
  const length = Math.hypot(right, forward);
  const normalizedRight = length > 1 ? right / length : right;
  const normalizedForward = length > 1 ? forward / length : forward;
  const rotate = Number(held("KeyQ")) - Number(held("KeyE"));
  return Object.freeze({
    rightAxis: normalizedRight,
    forwardAxis: normalizedForward,
    rotateAxis: rotate,
    fast: held("ShiftLeft") || held("ShiftRight"),
  });
}
