import { describe, expect, it } from "vitest";
import { CITY_INPUT_DEFAULT_CONFIG } from "../src/presentation/input/input-config";
import {
  createInitialGestureState,
  reduceGesture,
} from "../src/presentation/input/gesture-recognizer";

function event(
  type: "down" | "move" | "up" | "cancel",
  input: {
    id?: number;
    pointerType?: "mouse" | "touch";
    button?: number;
    x: number;
    y: number;
  },
) {
  return {
    type,
    id: input.id ?? 1,
    pointerType: input.pointerType ?? "mouse",
    button: input.button ?? 0,
    x: input.x,
    y: input.y,
  } as const;
}

function transition(events: ReturnType<typeof event>[]) {
  let state = createInitialGestureState();
  const intents = [];
  for (const item of events) {
    const result = reduceGesture(state, item, CITY_INPUT_DEFAULT_CONFIG);
    state = result.state;
    intents.push(...result.intents);
  }
  return { state, intents };
}

describe("gesture recognizer", () => {
  it("emits a tap only when primary movement stays under threshold", () => {
    const result = transition([
      event("down", { x: 10, y: 10 }),
      event("up", { x: 12, y: 11 }),
    ]);
    expect(result.intents).toContainEqual({
      type: "tap",
      x: 12,
      y: 11,
      pointerType: "mouse",
    });
  });

  it("turns primary mouse/touch drag into pan and cancels tap", () => {
    for (const pointerType of ["mouse", "touch"] as const) {
      const result = transition([
        event("down", { pointerType, x: 10, y: 10 }),
        event("move", { pointerType, x: 40, y: 25 }),
        event("up", { pointerType, x: 40, y: 25 }),
      ]);
      expect(result.intents.some((intent) => intent.type === "panPixels")).toBe(
        true,
      );
      expect(result.intents.some((intent) => intent.type === "tap")).toBe(
        false,
      );
    }
  });

  it("maps secondary mouse drag to rotate", () => {
    const result = transition([
      event("down", { button: 2, x: 20, y: 20 }),
      event("move", { button: 2, x: 40, y: 35 }),
      event("up", { button: 2, x: 40, y: 35 }),
    ]);
    expect(
      result.intents.some((intent) => intent.type === "rotatePixels"),
    ).toBe(true);
    expect(result.intents.some((intent) => intent.type === "tap")).toBe(false);
  });

  it("two-touch takeover cancels tap and emits pan/zoom/rotate components", () => {
    const events = [
      event("down", { id: 1, pointerType: "touch", x: 100, y: 100 }),
      event("down", { id: 2, pointerType: "touch", x: 200, y: 100 }),
      event("move", { id: 1, pointerType: "touch", x: 90, y: 110 }),
      event("move", { id: 2, pointerType: "touch", x: 220, y: 130 }),
      event("up", { id: 1, pointerType: "touch", x: 90, y: 110 }),
      event("up", { id: 2, pointerType: "touch", x: 220, y: 130 }),
    ];
    const result = transition(events);
    expect(result.intents.some((intent) => intent.type === "multiTouch")).toBe(
      true,
    );
    expect(result.intents.some((intent) => intent.type === "tap")).toBe(false);
  });

  it("pointer cancel clears pending gesture without tap", () => {
    const result = transition([
      event("down", { x: 10, y: 10 }),
      event("cancel", { x: 10, y: 10 }),
    ]);
    expect(result.state).toEqual(createInitialGestureState());
    expect(result.intents).toEqual([]);
  });
});
