import type { CityCameraController } from "./create-city-camera";
import {
  CITY_CAMERA_MOTION_DEFAULT_CONFIG,
  createInitialCityCameraMotionState,
  queueWheelZoom,
  stepCityCameraMotion,
  type CityCameraDrive,
  type CityCameraMotionConfig,
  type CityCameraMotionState,
} from "./camera-motion";
import { createDemandAnimationLoop } from "./demand-animation-loop";

export interface CameraAnimationEnvironment {
  readonly now: () => number;
  readonly requestFrame: (callback: FrameRequestCallback) => number;
  readonly cancelFrame: (handle: number) => void;
}

export interface CityCameraMotionDriver {
  setDrive(drive: CityCameraDrive): void;
  clearDrive(): void;
  queueWheelZoom(zoomLogImpulse: number): void;
  state(): CityCameraMotionState;
  dispose(): void;
}

const IDLE_DRIVE: CityCameraDrive = Object.freeze({
  rightAxis: 0,
  forwardAxis: 0,
  rotateAxis: 0,
  fast: false,
});

export function createCityCameraMotionDriver(input: {
  readonly camera: CityCameraController;
  readonly requestRender: () => void;
  readonly animation: CameraAnimationEnvironment;
  readonly config?: CityCameraMotionConfig;
}): CityCameraMotionDriver {
  const config = input.config ?? CITY_CAMERA_MOTION_DEFAULT_CONFIG;
  let drive = IDLE_DRIVE;
  let state = createInitialCityCameraMotionState();
  let disposed = false;

  const loop = createDemandAnimationLoop({
    now: input.animation.now,
    requestFrame: input.animation.requestFrame,
    cancelFrame: input.animation.cancelFrame,
    onFrame(deltaSeconds): boolean {
      if (disposed) return false;
      const result = stepCityCameraMotion({
        state,
        drive,
        cameraDistanceMeters: input.camera.state().distance,
        deltaSeconds,
        config,
      });
      state = result.state;
      if (result.intents.length > 0) {
        for (const intent of result.intents) input.camera.dispatch(intent);
        input.requestRender();
      }
      return result.active;
    },
  });

  const driver: CityCameraMotionDriver = {
    setDrive(nextDrive): void {
      if (disposed) return;
      drive = nextDrive;
      loop.wake();
    },
    clearDrive(): void {
      if (disposed) return;
      drive = IDLE_DRIVE;
      loop.wake();
    },
    queueWheelZoom(zoomLogImpulse): void {
      if (disposed) return;
      state = queueWheelZoom(state, zoomLogImpulse, config);
      loop.wake();
    },
    state: () => state,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      drive = IDLE_DRIVE;
      state = createInitialCityCameraMotionState();
      loop.dispose();
    },
  };

  return Object.freeze(driver);
}
