import { describe, expect, it } from "vitest";
import { createTransitionGuard } from "../src/application/navigation/transition-guard";

describe("TransitionGuard", () => {
  it("rejects duplicate transitions until the active transition finishes", () => {
    const guard = createTransitionGuard();
    const first = guard.begin();
    expect(first).not.toBeUndefined();
    expect(guard.begin()).toBeUndefined();
    guard.finish(first!);
    const second = guard.begin();
    expect(second).not.toBeUndefined();
    expect(guard.isCurrent(second!)).toBe(true);
  });

  it("cancel invalidates the current token and clears the pending transition", () => {
    const guard = createTransitionGuard();
    const first = guard.begin();
    expect(first).not.toBeUndefined();
    guard.cancel();
    expect(guard.isCurrent(first!)).toBe(false);
    expect(guard.isPending()).toBe(false);
    expect(guard.begin()).not.toBeUndefined();
  });

  it("dispose invalidates the current token and permanently rejects begin", () => {
    const guard = createTransitionGuard();
    const first = guard.begin();
    expect(first).not.toBeUndefined();
    guard.dispose();
    expect(guard.isCurrent(first!)).toBe(false);
    expect(guard.isPending()).toBe(false);
    expect(guard.begin()).toBeUndefined();
  });
});
