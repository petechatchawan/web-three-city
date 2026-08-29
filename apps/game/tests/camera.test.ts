import { PerspectiveCamera } from "three";
import { describe, expect, it, vi } from "vitest";
import { createCityCamera } from "../src/presentation/camera/create-city-camera";
import { createCitySceneCameraConfig } from "../src/presentation/camera/create-city-scene-camera-config";
import { createCityInputController } from "../src/presentation/input/create-city-input-controller";
import {
  CITY_CAMERA_DEFAULT_CONFIG,
  createCityCameraConstraints,
  createInitialCityCameraState,
} from "../src/presentation/camera/camera-config";
import { reduceCityCamera } from "../src/presentation/camera/camera-reducer";

const map = { widthCells: 512, heightCells: 512, cellSizeMeters: 8 } as const;

describe("city scene camera projection", () => {
  it("derives clipping range and overview position from map metrics", () => {
    const config = createCitySceneCameraConfig(map);
    const span = map.widthCells * map.cellSizeMeters;
    expect(config.farMeters).toBeGreaterThan(span * 2.8);
    expect(config.nearMeters).toBeGreaterThan(0);
    expect(config.target).toEqual([span / 2, 0, span / 2]);
    expect(config.position[1]).toBeGreaterThan(0);
  });
});

describe("city camera functional core", () => {
  it("derives initial framing and constraints from the active map", () => {
    const constraints = createCityCameraConstraints(
      map,
      CITY_CAMERA_DEFAULT_CONFIG,
    );
    const state = createInitialCityCameraState(map, CITY_CAMERA_DEFAULT_CONFIG);
    expect(state.targetX).toBe((map.widthCells * map.cellSizeMeters) / 2);
    expect(state.targetZ).toBe((map.heightCells * map.cellSizeMeters) / 2);
    expect(state.distance).toBeGreaterThan(constraints.minDistanceMeters);
    expect(state.distance).toBeLessThan(constraints.maxDistanceMeters);
  });

  it("clamps pan, pitch and distance without mutating input state", () => {
    const constraints = createCityCameraConstraints(
      map,
      CITY_CAMERA_DEFAULT_CONFIG,
    );
    const initial = createInitialCityCameraState(
      map,
      CITY_CAMERA_DEFAULT_CONFIG,
    );
    const panned = reduceCityCamera(
      initial,
      { type: "pan", rightMeters: 99_999, forwardMeters: 99_999 },
      constraints,
    );
    expect(panned).not.toBe(initial);
    expect(initial.targetX).toBe((map.widthCells * map.cellSizeMeters) / 2);
    expect(panned.targetX).toBeGreaterThanOrEqual(constraints.targetXMinMeters);
    expect(panned.targetX).toBeLessThanOrEqual(constraints.targetXMaxMeters);
    expect(panned.targetZ).toBeGreaterThanOrEqual(constraints.targetZMinMeters);
    expect(panned.targetZ).toBeLessThanOrEqual(constraints.targetZMaxMeters);

    const rotated = reduceCityCamera(
      initial,
      { type: "rotate", azimuthDeltaRadians: 20, elevationDeltaRadians: 20 },
      constraints,
    );
    expect(rotated.elevationRadians).toBe(constraints.maxElevationRadians);

    const zoomed = reduceCityCamera(
      initial,
      { type: "zoom", distanceFactor: 1000 },
      constraints,
    );
    expect(zoomed.distance).toBe(constraints.maxDistanceMeters);
  });

  it("resets deterministically to an explicit state", () => {
    const constraints = createCityCameraConstraints(
      map,
      CITY_CAMERA_DEFAULT_CONFIG,
    );
    const initial = createInitialCityCameraState(
      map,
      CITY_CAMERA_DEFAULT_CONFIG,
    );
    const changed = reduceCityCamera(
      initial,
      { type: "rotate", azimuthDeltaRadians: 1, elevationDeltaRadians: -0.2 },
      constraints,
    );
    expect(
      reduceCityCamera(changed, { type: "reset", state: initial }, constraints),
    ).toEqual(initial);
  });
});

class FakeInputSurface {
  readonly listeners = new Map<string, Set<(event: any) => void>>();
  readonly captured = new Set<number>();
  readonly style = { touchAction: "" };
  clientHeight = 500;
  addEventListener(type: string, listener: (event: any) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type: string, listener: (event: any) => void): void {
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
  emit(type: string, event: Record<string, unknown>): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ preventDefault: vi.fn(), ...event });
    }
  }
}

describe("city camera imperative adapters", () => {
  it("maps plain camera state to a Three PerspectiveCamera", () => {
    const camera = new PerspectiveCamera();
    const controller = createCityCamera({
      camera,
      map,
      config: CITY_CAMERA_DEFAULT_CONFIG,
    });
    const before = camera.position.clone();
    controller.dispatch({
      type: "rotate",
      azimuthDeltaRadians: 0.5,
      elevationDeltaRadians: 0,
    });
    expect(camera.position.equals(before)).toBe(false);
    expect(controller.state().azimuthRadians).not.toBe(
      controller.initialState().azimuthRadians,
    );
    controller.reset();
    expect(controller.state()).toEqual(controller.initialState());
  });

  it("owns viewport input listeners, pointer capture, and disposal", () => {
    const surface = new FakeInputSurface();
    const camera = new PerspectiveCamera();
    const cameraController = createCityCamera({
      camera,
      map,
      config: CITY_CAMERA_DEFAULT_CONFIG,
    });
    const taps: Array<{ x: number; y: number }> = [];
    const render = vi.fn();
    const controller = createCityInputController({
      viewport: surface as unknown as HTMLElement,
      camera: cameraController,
      requestRender: render,
      onTap: (x, y) => taps.push({ x, y }),
    });

    expect(surface.style.touchAction).toBe("none");
    surface.emit("pointerdown", {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    expect(surface.captured.has(1)).toBe(true);
    surface.emit("pointerup", {
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX: 11,
      clientY: 11,
    });
    expect(taps).toEqual([{ x: 11, y: 11 }]);
    expect(surface.captured.has(1)).toBe(false);

    surface.emit("wheel", { deltaY: 120 });
    expect(render).toHaveBeenCalled();

    controller.dispose();
    controller.dispose();
    expect(surface.style.touchAction).toBe("");
    expect(
      [...surface.listeners.values()].every(
        (listeners) => listeners.size === 0,
      ),
    ).toBe(true);
  });
});
