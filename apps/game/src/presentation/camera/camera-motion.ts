import type { CityCameraIntent } from "./camera-types";

export interface CityCameraDrive {
  readonly rightAxis: number;
  readonly forwardAxis: number;
  readonly rotateAxis: number;
  readonly fast: boolean;
}

export interface CityCameraMotionState {
  readonly rightVelocityMetersPerSecond: number;
  readonly forwardVelocityMetersPerSecond: number;
  readonly rotateVelocityRadiansPerSecond: number;
  readonly pendingZoomLog: number;
}

export interface CityCameraMotionConfig {
  readonly keyboardPanDistancePerSecondFactor: number;
  readonly keyboardRotateRadiansPerSecond: number;
  readonly fastMultiplier: number;
  readonly accelerationResponsePerSecond: number;
  readonly decelerationResponsePerSecond: number;
  readonly zoomResponsePerSecond: number;
  readonly maxFrameDeltaSeconds: number;
  readonly panSleepEpsilonMetersPerSecond: number;
  readonly rotateSleepEpsilonRadiansPerSecond: number;
  readonly zoomSleepEpsilonLog: number;
  readonly maxPendingZoomLogMagnitude: number;
}

export interface CityCameraMotionStep {
  readonly state: CityCameraMotionState;
  readonly intents: readonly CityCameraIntent[];
  readonly active: boolean;
}

export const CITY_CAMERA_MOTION_DEFAULT_CONFIG: CityCameraMotionConfig =
  Object.freeze({
    keyboardPanDistancePerSecondFactor: 0.18,
    keyboardRotateRadiansPerSecond: 0.9,
    fastMultiplier: 2.5,
    accelerationResponsePerSecond: 9,
    decelerationResponsePerSecond: 12,
    zoomResponsePerSecond: 14,
    maxFrameDeltaSeconds: 0.05,
    panSleepEpsilonMetersPerSecond: 0.01,
    rotateSleepEpsilonRadiansPerSecond: 0.0001,
    zoomSleepEpsilonLog: 0.0001,
    maxPendingZoomLogMagnitude: 1.2,
  });

export const createInitialCityCameraMotionState = (): CityCameraMotionState =>
  Object.freeze({
    rightVelocityMetersPerSecond: 0,
    forwardVelocityMetersPerSecond: 0,
    rotateVelocityRadiansPerSecond: 0,
    pendingZoomLog: 0,
  });

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

function normalizePlanarAxes(
  rightAxis: number,
  forwardAxis: number,
): readonly [number, number] {
  const length = Math.hypot(rightAxis, forwardAxis);
  if (length <= 1) return [rightAxis, forwardAxis];
  return [rightAxis / length, forwardAxis / length];
}

function integrateVelocity(input: {
  readonly current: number;
  readonly target: number;
  readonly responsePerSecond: number;
  readonly deltaSeconds: number;
}): { readonly next: number; readonly displacement: number } {
  if (input.deltaSeconds <= 0) {
    return { next: input.current, displacement: 0 };
  }
  const response = Math.max(input.responsePerSecond, Number.EPSILON);
  const decay = Math.exp(-response * input.deltaSeconds);
  const next = input.target + (input.current - input.target) * decay;
  const displacement =
    input.target * input.deltaSeconds +
    ((input.current - input.target) * (1 - decay)) / response;
  return { next, displacement };
}

function settle(value: number, epsilon: number, target: number): number {
  return target === 0 && Math.abs(value) < epsilon ? 0 : value;
}

export function queueWheelZoom(
  state: CityCameraMotionState,
  zoomLogImpulse: number,
  config: CityCameraMotionConfig = CITY_CAMERA_MOTION_DEFAULT_CONFIG,
): CityCameraMotionState {
  if (!Number.isFinite(zoomLogImpulse) || zoomLogImpulse === 0) return state;
  return Object.freeze({
    ...state,
    pendingZoomLog: clamp(
      state.pendingZoomLog + zoomLogImpulse,
      -config.maxPendingZoomLogMagnitude,
      config.maxPendingZoomLogMagnitude,
    ),
  });
}

export function stepCityCameraMotion(input: {
  readonly state: CityCameraMotionState;
  readonly drive: CityCameraDrive;
  readonly cameraDistanceMeters: number;
  readonly deltaSeconds: number;
  readonly config?: CityCameraMotionConfig;
}): CityCameraMotionStep {
  const config = input.config ?? CITY_CAMERA_MOTION_DEFAULT_CONFIG;
  const deltaSeconds = clamp(
    Number.isFinite(input.deltaSeconds) ? input.deltaSeconds : 0,
    0,
    config.maxFrameDeltaSeconds,
  );
  const [rightAxis, forwardAxis] = normalizePlanarAxes(
    input.drive.rightAxis,
    input.drive.forwardAxis,
  );
  const speedMultiplier = input.drive.fast ? config.fastMultiplier : 1;
  const panSpeed =
    Math.max(0, input.cameraDistanceMeters) *
    config.keyboardPanDistancePerSecondFactor *
    speedMultiplier;
  const rotateSpeed = config.keyboardRotateRadiansPerSecond * speedMultiplier;
  const rightTarget = rightAxis * panSpeed;
  const forwardTarget = forwardAxis * panSpeed;
  const rotateTarget = clamp(input.drive.rotateAxis, -1, 1) * rotateSpeed;

  const right = integrateVelocity({
    current: input.state.rightVelocityMetersPerSecond,
    target: rightTarget,
    responsePerSecond:
      rightTarget === 0
        ? config.decelerationResponsePerSecond
        : config.accelerationResponsePerSecond,
    deltaSeconds,
  });
  const forward = integrateVelocity({
    current: input.state.forwardVelocityMetersPerSecond,
    target: forwardTarget,
    responsePerSecond:
      forwardTarget === 0
        ? config.decelerationResponsePerSecond
        : config.accelerationResponsePerSecond,
    deltaSeconds,
  });
  const rotate = integrateVelocity({
    current: input.state.rotateVelocityRadiansPerSecond,
    target: rotateTarget,
    responsePerSecond:
      rotateTarget === 0
        ? config.decelerationResponsePerSecond
        : config.accelerationResponsePerSecond,
    deltaSeconds,
  });

  const zoomDecay = Math.exp(-config.zoomResponsePerSecond * deltaSeconds);
  const decayedPendingZoom = input.state.pendingZoomLog * zoomDecay;
  const zoomWillSleep =
    Math.abs(decayedPendingZoom) < config.zoomSleepEpsilonLog;
  const nextPendingZoom = zoomWillSleep ? 0 : decayedPendingZoom;
  const appliedZoomLog = input.state.pendingZoomLog - nextPendingZoom;

  const nextState: CityCameraMotionState = Object.freeze({
    rightVelocityMetersPerSecond: settle(
      right.next,
      config.panSleepEpsilonMetersPerSecond,
      rightTarget,
    ),
    forwardVelocityMetersPerSecond: settle(
      forward.next,
      config.panSleepEpsilonMetersPerSecond,
      forwardTarget,
    ),
    rotateVelocityRadiansPerSecond: settle(
      rotate.next,
      config.rotateSleepEpsilonRadiansPerSecond,
      rotateTarget,
    ),
    pendingZoomLog: nextPendingZoom,
  });

  const intents: CityCameraIntent[] = [];
  if (right.displacement !== 0 || forward.displacement !== 0) {
    intents.push({
      type: "pan",
      rightMeters: right.displacement,
      forwardMeters: forward.displacement,
    });
  }
  if (rotate.displacement !== 0) {
    intents.push({
      type: "rotate",
      azimuthDeltaRadians: rotate.displacement,
      elevationDeltaRadians: 0,
    });
  }
  if (appliedZoomLog !== 0) {
    intents.push({ type: "zoom", distanceFactor: Math.exp(appliedZoomLog) });
  }

  const active =
    rightTarget !== 0 ||
    forwardTarget !== 0 ||
    rotateTarget !== 0 ||
    nextState.rightVelocityMetersPerSecond !== 0 ||
    nextState.forwardVelocityMetersPerSecond !== 0 ||
    nextState.rotateVelocityRadiansPerSecond !== 0 ||
    nextState.pendingZoomLog !== 0;

  return Object.freeze({
    state: nextState,
    intents: Object.freeze(intents),
    active,
  });
}
