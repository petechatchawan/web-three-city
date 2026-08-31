import { PerspectiveCamera } from "three";
import { describe, expect, it, vi } from "vitest";
import { createCityCamera } from "../src/presentation/camera/create-city-camera";
import { createCityInputController } from "../src/presentation/input/create-city-input-controller";

const map = { widthCells: 512, heightCells: 512, cellSizeMeters: 8 } as const;

class FakeViewport {
  readonly listeners = new Map<string, Set<EventListener>>();
  readonly captured = new Set<number>();
  readonly style = { touchAction: "" };
  clientHeight = 500;
  addEventListener(type: string, listener: EventListener): void {
    const set = this.listeners.get(type) ?? new Set<EventListener>();
    set.add(listener);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }
  setPointerCapture(id: number): void {
    this.captured.add(id);
  }
  releasePointerCapture(id: number): void {
    this.captured.delete(id);
  }
  hasPointerCapture(id: number): boolean {
    return this.captured.has(id);
  }
  emit(type: string, values: Record<string, unknown>): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ preventDefault: vi.fn(), ...values } as unknown as Event);
    }
  }
}

describe("City tool pointer forwarding", () => {
  it("forwards each DOM pointer lifecycle event exactly once in normalized form", () => {
    const viewport = new FakeViewport();
    const events: unknown[] = [];
    const controller = createCityInputController({
      viewport: viewport as unknown as HTMLElement,
      camera: createCityCamera({ camera: new PerspectiveCamera(), map }),
      requestRender: vi.fn(),
      onTap: vi.fn(),
      toolPointerSink: {
        onPointerEvent(event) {
          events.push(event);
        },
      },
    });

    viewport.emit("pointerdown", {
      pointerId: 7,
      pointerType: "mouse",
      button: 0,
      clientX: 10,
      clientY: 20,
    });
    viewport.emit("pointermove", {
      pointerId: 7,
      pointerType: "mouse",
      button: 0,
      clientX: 11,
      clientY: 22,
    });
    viewport.emit("pointerup", {
      pointerId: 7,
      pointerType: "mouse",
      button: 0,
      clientX: 11,
      clientY: 22,
    });
    viewport.emit("pointercancel", {
      pointerId: 9,
      pointerType: "touch",
      button: 0,
      clientX: 30,
      clientY: 40,
    });

    expect(events).toEqual([
      { type: "down", id: 7, pointerType: "mouse", button: 0, x: 10, y: 20 },
      { type: "move", id: 7, pointerType: "mouse", button: 0, x: 11, y: 22 },
      { type: "up", id: 7, pointerType: "mouse", button: 0, x: 11, y: 22 },
      { type: "cancel", id: 9, pointerType: "touch", button: 0, x: 30, y: 40 },
    ]);

    controller.dispose();
  });
});
