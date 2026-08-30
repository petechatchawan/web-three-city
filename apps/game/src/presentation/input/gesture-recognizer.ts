import type { CityInputConfig } from "./input-config";

export type NormalizedPointerEvent = {
  readonly type: "down" | "move" | "up" | "cancel";
  readonly id: number;
  readonly pointerType: "mouse" | "touch";
  readonly button: number;
  readonly x: number;
  readonly y: number;
};

interface PointerSample {
  readonly id: number;
  readonly pointerType: "mouse" | "touch";
  readonly button: number;
  readonly startX: number;
  readonly startY: number;
  readonly x: number;
  readonly y: number;
  readonly moved: boolean;
}

export interface GestureState {
  readonly pointers: readonly PointerSample[];
}

export type GestureIntent =
  | {
      readonly type: "tap";
      readonly x: number;
      readonly y: number;
      readonly pointerType: "mouse" | "touch";
    }
  | {
      readonly type: "panPixels";
      readonly deltaX: number;
      readonly deltaY: number;
    }
  | {
      readonly type: "rotatePixels";
      readonly deltaX: number;
      readonly deltaY: number;
    }
  | {
      readonly type: "multiTouch";
      readonly panDeltaX: number;
      readonly panDeltaY: number;
      readonly distanceRatio: number;
      readonly rotationDeltaRadians: number;
    };

export interface GestureTransition {
  readonly state: GestureState;
  readonly intents: readonly GestureIntent[];
}

export const createInitialGestureState = (): GestureState =>
  Object.freeze({ pointers: Object.freeze([]) });

const freezePointers = (
  pointers: readonly PointerSample[],
): readonly PointerSample[] =>
  Object.freeze(pointers.map((pointer) => Object.freeze({ ...pointer })));

function movedBeyondThreshold(
  pointer: PointerSample,
  x: number,
  y: number,
  threshold: number,
): boolean {
  return (
    pointer.moved ||
    Math.hypot(x - pointer.startX, y - pointer.startY) > threshold
  );
}

function centroid(
  a: PointerSample,
  b: PointerSample,
): readonly [number, number] {
  return [(a.x + b.x) / 2, (a.y + b.y) / 2];
}
function distance(a: PointerSample, b: PointerSample): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
function angle(a: PointerSample, b: PointerSample): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}
function normalizeAngle(value: number): number {
  let result = value;
  while (result > Math.PI) result -= Math.PI * 2;
  while (result < -Math.PI) result += Math.PI * 2;
  return result;
}

export function reduceGesture(
  state: GestureState,
  event: NormalizedPointerEvent,
  config: CityInputConfig,
): GestureTransition {
  if (event.type === "cancel") {
    const remaining = state.pointers.filter(
      (pointer) => pointer.id !== event.id,
    );
    return {
      state: Object.freeze({ pointers: freezePointers(remaining) }),
      intents: [],
    };
  }

  if (event.type === "down") {
    const nextPointer: PointerSample = {
      id: event.id,
      pointerType: event.pointerType,
      button: event.button,
      startX: event.x,
      startY: event.y,
      x: event.x,
      y: event.y,
      moved: state.pointers.length > 0,
    };
    const prior = state.pointers.map((pointer) =>
      event.pointerType === "touch" ? { ...pointer, moved: true } : pointer,
    );
    return {
      state: Object.freeze({
        pointers: freezePointers([...prior, nextPointer]),
      }),
      intents: [],
    };
  }

  const index = state.pointers.findIndex((pointer) => pointer.id === event.id);
  if (index < 0) return { state, intents: [] };
  const current = state.pointers[index]!;

  if (event.type === "up") {
    const remaining = state.pointers.filter(
      (pointer) => pointer.id !== event.id,
    );
    const canTap =
      state.pointers.length === 1 &&
      current.button === 0 &&
      !movedBeyondThreshold(
        current,
        event.x,
        event.y,
        config.tapThresholdPixels,
      );
    return {
      state: Object.freeze({ pointers: freezePointers(remaining) }),
      intents: canTap
        ? [
            Object.freeze({
              type: "tap",
              x: event.x,
              y: event.y,
              pointerType: current.pointerType,
            }),
          ]
        : [],
    };
  }

  const previousPointers = state.pointers;
  const moved = movedBeyondThreshold(
    current,
    event.x,
    event.y,
    config.tapThresholdPixels,
  );
  const updated: PointerSample = { ...current, x: event.x, y: event.y, moved };
  const nextPointers = previousPointers.map((pointer, pointerIndex) =>
    pointerIndex === index ? updated : pointer,
  );

  if (nextPointers.length >= 2 && updated.pointerType === "touch") {
    const previousA = previousPointers[0]!;
    const previousB = previousPointers[1]!;
    const nextA = nextPointers[0]!;
    const nextB = nextPointers[1]!;
    const [previousCenterX, previousCenterY] = centroid(previousA, previousB);
    const [nextCenterX, nextCenterY] = centroid(nextA, nextB);
    const previousDistance = distance(previousA, previousB);
    const nextDistance = distance(nextA, nextB);
    const ratio =
      previousDistance > config.multiTouchDistanceEpsilonPixels
        ? previousDistance /
          Math.max(nextDistance, config.multiTouchDistanceEpsilonPixels)
        : 1;
    const intent: GestureIntent = Object.freeze({
      type: "multiTouch",
      panDeltaX: nextCenterX - previousCenterX,
      panDeltaY: nextCenterY - previousCenterY,
      distanceRatio: ratio,
      rotationDeltaRadians: normalizeAngle(
        angle(nextA, nextB) - angle(previousA, previousB),
      ),
    });
    return {
      state: Object.freeze({
        pointers: freezePointers(
          nextPointers.map((pointer) => ({ ...pointer, moved: true })),
        ),
      }),
      intents: [intent],
    };
  }

  if (!moved)
    return {
      state: Object.freeze({ pointers: freezePointers(nextPointers) }),
      intents: [],
    };
  const deltaX = event.x - current.x;
  const deltaY = event.y - current.y;
  const intent: GestureIntent =
    current.pointerType === "mouse" && current.button === 2
      ? Object.freeze({ type: "rotatePixels", deltaX, deltaY })
      : Object.freeze({ type: "panPixels", deltaX, deltaY });
  return {
    state: Object.freeze({ pointers: freezePointers(nextPointers) }),
    intents: [intent],
  };
}
