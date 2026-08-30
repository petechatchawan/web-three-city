import { PerspectiveCamera } from "three";
import { describe, expect, it, vi } from "vitest";
import { createCityCamera } from "../src/presentation/camera/create-city-camera";
import { createCityInputController } from "../src/presentation/input/create-city-input-controller";

const map = { widthCells: 512, heightCells: 512, cellSizeMeters: 8 } as const;

class FakeEventTarget {
  readonly listeners = new Map<string, Set<EventListener>>();
  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }
  emit(type: string, event: Record<string, unknown> = {}): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ preventDefault: vi.fn(), ...event } as unknown as Event);
    }
  }
}

class FakeViewport extends FakeEventTarget {
  readonly captured = new Set<number>();
  readonly style = { touchAction: "" };
  clientHeight = 500;
  setPointerCapture(id: number): void {
    this.captured.add(id);
  }
  releasePointerCapture(id: number): void {
    this.captured.delete(id);
  }
  hasPointerCapture(id: number): boolean {
    return this.captured.has(id);
  }
}

class FakeAnimationEnvironment {
  nowMs = 1000;
  nextHandle = 1;
  readonly callbacks = new Map<number, FrameRequestCallback>();
  now = (): number => this.nowMs;
  requestFrame = (callback: FrameRequestCallback): number => {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  };
  cancelFrame = (handle: number): void => {
    this.callbacks.delete(handle);
  };
  tick(milliseconds: number): void {
    this.nowMs += milliseconds;
    const entries = [...this.callbacks.entries()];
    this.callbacks.clear();
    for (const [, callback] of entries) callback(this.nowMs);
  }
}

function controllerFixture() {
  const viewport = new FakeViewport();
  const keyboard = new FakeEventTarget();
  const visibility = new FakeEventTarget() as FakeEventTarget & {
    hidden: boolean;
  };
  visibility.hidden = false;
  const animation = new FakeAnimationEnvironment();
  const camera = new PerspectiveCamera();
  const cameraController = createCityCamera({ camera, map });
  const render = vi.fn();
  const controller = createCityInputController({
    viewport: viewport as unknown as HTMLElement,
    camera: cameraController,
    requestRender: render,
    onTap: vi.fn(),
    keyboardTarget: keyboard,
    visibilityTarget: visibility,
    animationEnvironment: animation,
  });
  return {
    viewport,
    keyboard,
    visibility,
    animation,
    cameraController,
    render,
    controller,
  };
}

function keyEvent(code: string, target: unknown = { tagName: "DIV" }) {
  return { code, target, repeat: false };
}

describe("PC camera input motion integration", () => {
  it("drives smooth camera-relative WASD motion and Q/E rotation", () => {
    const fixture = controllerFixture();
    const initial = fixture.cameraController.state();

    fixture.keyboard.emit("keydown", keyEvent("KeyW"));
    expect(fixture.animation.callbacks.size).toBe(1);
    fixture.animation.tick(16);
    const first = fixture.cameraController.state();
    fixture.animation.tick(16);
    const second = fixture.cameraController.state();
    expect(first.targetX).not.toBe(initial.targetX);
    expect(first.targetZ).not.toBe(initial.targetZ);
    expect(second.targetX).not.toBe(first.targetX);
    expect(second.targetZ).not.toBe(first.targetZ);

    fixture.keyboard.emit("keyup", keyEvent("KeyW"));
    const released = fixture.cameraController.state();
    fixture.animation.tick(16);
    const afterRelease = fixture.cameraController.state();
    expect(afterRelease.targetX).not.toBe(released.targetX);
    expect(afterRelease.targetZ).not.toBe(released.targetZ);

    for (let index = 0; index < 120; index += 1) fixture.animation.tick(16);
    expect(fixture.animation.callbacks.size).toBe(0);

    const beforeQ = fixture.cameraController.state().azimuthRadians;
    fixture.keyboard.emit("keydown", keyEvent("KeyQ"));
    fixture.animation.tick(16);
    fixture.keyboard.emit("keyup", keyEvent("KeyQ"));
    expect(fixture.cameraController.state().azimuthRadians).toBeGreaterThan(
      beforeQ,
    );

    for (let index = 0; index < 120; index += 1) fixture.animation.tick(16);
    const beforeE = fixture.cameraController.state().azimuthRadians;
    fixture.keyboard.emit("keydown", keyEvent("KeyE"));
    for (let index = 0; index < 12; index += 1) fixture.animation.tick(16);
    fixture.keyboard.emit("keyup", keyEvent("KeyE"));
    expect(fixture.cameraController.state().azimuthRadians).toBeLessThan(
      beforeE,
    );

    fixture.controller.dispose();
  });

  it("applies Shift as a faster keyboard camera modifier", () => {
    function displacement(fast: boolean): number {
      const fixture = controllerFixture();
      const before = fixture.cameraController.state();
      if (fast) fixture.keyboard.emit("keydown", keyEvent("ShiftLeft"));
      fixture.keyboard.emit("keydown", keyEvent("KeyW"));
      for (let index = 0; index < 8; index += 1) fixture.animation.tick(16);
      const after = fixture.cameraController.state();
      fixture.controller.dispose();
      return Math.hypot(
        after.targetX - before.targetX,
        after.targetZ - before.targetZ,
      );
    }

    expect(displacement(true)).toBeGreaterThan(displacement(false));
  });

  it("queues wheel zoom through damping instead of changing distance synchronously", () => {
    const fixture = controllerFixture();
    const before = fixture.cameraController.state().distance;
    fixture.viewport.emit("wheel", { deltaY: 200 });
    expect(fixture.cameraController.state().distance).toBe(before);
    expect(fixture.animation.callbacks.size).toBe(1);

    fixture.animation.tick(16);
    const first = fixture.cameraController.state().distance;
    expect(first).toBeGreaterThan(before);
    expect(first).toBeLessThan(before * Math.exp(200 * 0.0015));

    for (let index = 0; index < 120; index += 1) fixture.animation.tick(16);
    expect(fixture.animation.callbacks.size).toBe(0);
    fixture.controller.dispose();
  });

  it("ignores editable targets and clears held keys on blur or hidden visibility", () => {
    const fixture = controllerFixture();
    fixture.keyboard.emit(
      "keydown",
      keyEvent("KeyW", { tagName: "INPUT", isContentEditable: false }),
    );
    expect(fixture.animation.callbacks.size).toBe(0);

    fixture.keyboard.emit("keydown", keyEvent("KeyW"));
    fixture.animation.tick(16);
    const moving = fixture.cameraController.state();
    fixture.keyboard.emit("blur");
    for (let index = 0; index < 120; index += 1) fixture.animation.tick(16);
    expect(fixture.animation.callbacks.size).toBe(0);

    fixture.keyboard.emit("keydown", keyEvent("KeyD"));
    fixture.animation.tick(16);
    fixture.visibility.hidden = true;
    fixture.visibility.emit("visibilitychange");
    for (let index = 0; index < 120; index += 1) fixture.animation.tick(16);
    expect(fixture.animation.callbacks.size).toBe(0);
    expect(fixture.cameraController.state()).not.toEqual(moving);

    fixture.controller.dispose();
    expect(
      [...fixture.keyboard.listeners.values()].every(
        (listeners) => listeners.size === 0,
      ),
    ).toBe(true);
    expect(
      [...fixture.visibility.listeners.values()].every(
        (listeners) => listeners.size === 0,
      ),
    ).toBe(true);
  });
});
