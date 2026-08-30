import { describe, expect, it } from "vitest";
import {
  CITY_CAMERA_MOTION_DEFAULT_CONFIG,
  createInitialCityCameraMotionState,
  queueWheelZoom,
  stepCityCameraMotion,
} from "../src/presentation/camera/camera-motion";
import {
  createInitialKeyboardCameraState,
  deriveKeyboardCameraDrive,
  reduceKeyboardCameraState,
} from "../src/presentation/input/keyboard-camera-state";
import { createDemandAnimationLoop } from "../src/presentation/camera/demand-animation-loop";

const config = CITY_CAMERA_MOTION_DEFAULT_CONFIG;

function key(
  state: ReturnType<typeof createInitialKeyboardCameraState>,
  type: "down" | "up",
  code: string,
) {
  return reduceKeyboardCameraState(state, { type, code });
}

describe("keyboard camera state", () => {
  it("maps WASD to normalized camera-relative axes and Shift to fast mode", () => {
    let state = createInitialKeyboardCameraState();
    state = key(state, "down", "KeyW");
    state = key(state, "down", "KeyD");
    state = key(state, "down", "ShiftLeft");

    const drive = deriveKeyboardCameraDrive(state);
    expect(Math.hypot(drive.rightAxis, drive.forwardAxis)).toBeCloseTo(1, 12);
    expect(drive.rightAxis).toBeGreaterThan(0);
    expect(drive.forwardAxis).toBeGreaterThan(0);
    expect(drive.fast).toBe(true);
  });

  it("maps every WASD key to the expected camera-relative axis", () => {
    const expected = {
      KeyW: { rightAxis: 0, forwardAxis: 1 },
      KeyS: { rightAxis: 0, forwardAxis: -1 },
      KeyA: { rightAxis: -1, forwardAxis: 0 },
      KeyD: { rightAxis: 1, forwardAxis: 0 },
    } as const;

    for (const [code, axes] of Object.entries(expected)) {
      const state = key(createInitialKeyboardCameraState(), "down", code);
      const drive = deriveKeyboardCameraDrive(state);
      expect({
        rightAxis: drive.rightAxis,
        forwardAxis: drive.forwardAxis,
      }).toEqual(axes);
    }
  });

  it("maps Q/E to opposite rotation and cancels opposing keys", () => {
    let q = key(createInitialKeyboardCameraState(), "down", "KeyQ");
    const e = key(createInitialKeyboardCameraState(), "down", "KeyE");
    expect(deriveKeyboardCameraDrive(q).rotateAxis).toBeGreaterThan(0);
    expect(deriveKeyboardCameraDrive(e).rotateAxis).toBeLessThan(0);

    q = key(q, "down", "KeyE");
    expect(deriveKeyboardCameraDrive(q).rotateAxis).toBe(0);
  });
});

describe("camera motion", () => {
  it("integrates keyboard acceleration frame-rate independently", () => {
    const drive = {
      rightAxis: 0.6,
      forwardAxis: 0.8,
      rotateAxis: 0.5,
      fast: false,
    } as const;

    function simulate(stepSeconds: number) {
      let state = createInitialCityCameraMotionState();
      let right = 0;
      let forward = 0;
      let rotation = 0;
      const steps = Math.round(1 / stepSeconds);
      for (let index = 0; index < steps; index += 1) {
        const result = stepCityCameraMotion({
          state,
          drive,
          cameraDistanceMeters: 4000,
          deltaSeconds: stepSeconds,
          config,
        });
        state = result.state;
        for (const intent of result.intents) {
          if (intent.type === "pan") {
            right += intent.rightMeters;
            forward += intent.forwardMeters;
          } else if (intent.type === "rotate") {
            rotation += intent.azimuthDeltaRadians;
          }
        }
      }
      return { state, right, forward, rotation };
    }

    const at60 = simulate(1 / 60);
    const at120 = simulate(1 / 120);
    expect(at60.right).toBeCloseTo(at120.right, 8);
    expect(at60.forward).toBeCloseTo(at120.forward, 8);
    expect(at60.rotation).toBeCloseTo(at120.rotation, 8);
    expect(at60.state.rightVelocityMetersPerSecond).toBeCloseTo(
      at120.state.rightVelocityMetersPerSecond,
      8,
    );
  });

  it("accelerates while held, decelerates after release, and Shift is faster", () => {
    const held = {
      rightAxis: 0,
      forwardAxis: 1,
      rotateAxis: 0,
      fast: false,
    } as const;
    const fastHeld = { ...held, fast: true } as const;
    const idle = {
      rightAxis: 0,
      forwardAxis: 0,
      rotateAxis: 0,
      fast: false,
    } as const;

    const normal = stepCityCameraMotion({
      state: createInitialCityCameraMotionState(),
      drive: held,
      cameraDistanceMeters: 4000,
      deltaSeconds: 0.1,
      config,
    });
    const fast = stepCityCameraMotion({
      state: createInitialCityCameraMotionState(),
      drive: fastHeld,
      cameraDistanceMeters: 4000,
      deltaSeconds: 0.1,
      config,
    });
    expect(fast.state.forwardVelocityMetersPerSecond).toBeGreaterThan(
      normal.state.forwardVelocityMetersPerSecond,
    );

    const released = stepCityCameraMotion({
      state: normal.state,
      drive: idle,
      cameraDistanceMeters: 4000,
      deltaSeconds: 0.1,
      config,
    });
    expect(released.state.forwardVelocityMetersPerSecond).toBeGreaterThan(0);
    expect(released.state.forwardVelocityMetersPerSecond).toBeLessThan(
      normal.state.forwardVelocityMetersPerSecond,
    );
  });

  it("smooths wheel zoom as a finite logarithmic impulse", () => {
    let state = queueWheelZoom(createInitialCityCameraMotionState(), 0.24);
    const first = stepCityCameraMotion({
      state,
      drive: { rightAxis: 0, forwardAxis: 0, rotateAxis: 0, fast: false },
      cameraDistanceMeters: 4000,
      deltaSeconds: 1 / 60,
      config,
    });
    const firstZoom = first.intents.find((intent) => intent.type === "zoom");
    expect(firstZoom?.distanceFactor).toBeGreaterThan(1);
    expect(firstZoom?.distanceFactor).toBeLessThan(Math.exp(0.24));
    expect(first.state.pendingZoomLog).toBeGreaterThan(0);
    expect(first.state.pendingZoomLog).toBeLessThan(0.24);

    state = first.state;
    let appliedLog = Math.log(firstZoom?.distanceFactor ?? 1);
    for (let index = 0; index < 240; index += 1) {
      const result = stepCityCameraMotion({
        state,
        drive: { rightAxis: 0, forwardAxis: 0, rotateAxis: 0, fast: false },
        cameraDistanceMeters: 4000,
        deltaSeconds: 1 / 60,
        config,
      });
      state = result.state;
      for (const intent of result.intents) {
        if (intent.type === "zoom")
          appliedLog += Math.log(intent.distanceFactor);
      }
    }
    expect(appliedLog).toBeCloseTo(0.24, 4);
    expect(state.pendingZoomLog).toBeLessThan(config.zoomSleepEpsilonLog);
  });
});

describe("demand animation loop", () => {
  it("runs only while motion reports active and cancels on dispose", () => {
    let now = 1000;
    let handle = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const frames: number[] = [];
    let activeFrames = 2;
    const loop = createDemandAnimationLoop({
      now: () => now,
      requestFrame(callback) {
        handle += 1;
        callbacks.set(handle, callback);
        return handle;
      },
      cancelFrame(id) {
        callbacks.delete(id);
      },
      onFrame(deltaSeconds) {
        frames.push(deltaSeconds);
        activeFrames -= 1;
        return activeFrames > 0;
      },
    });

    loop.wake();
    loop.wake();
    expect(callbacks.size).toBe(1);

    const first = [...callbacks.entries()][0]!;
    callbacks.delete(first[0]);
    now += 16;
    first[1](now);
    expect(callbacks.size).toBe(1);

    const second = [...callbacks.entries()][0]!;
    callbacks.delete(second[0]);
    now += 16;
    second[1](now);
    expect(callbacks.size).toBe(0);
    expect(frames).toHaveLength(2);
    expect(frames[0]).toBeCloseTo(0.016, 3);

    loop.wake();
    expect(callbacks.size).toBe(1);
    loop.dispose();
    expect(callbacks.size).toBe(0);
  });
});
