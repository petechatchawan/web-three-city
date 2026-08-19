import type { PreparedTrafficRoute } from './route-geometry.js';

export interface VehicleMotionPresentationPolicy {
  readonly accelerationResponseSeconds: number;
  readonly decelerationResponseSeconds: number;
  readonly turnSpeedFactor: number;
  readonly turnApproachCellFraction: number;
  readonly maxCatchupSpeedMultiplier: number;
  readonly stopSpeedEpsilonMillimetersPerSecond: number;
}

export interface VehicleKinematicsState {
  visualDistanceMillimeters: number;
  visualSpeedMillimetersPerSecond: number;
  canonicalTargetDistanceMillimeters: number;
  baselineFollowerSpeedMillimetersPerSecond: number;
  lastFrameTimestampMs: number;
}

export const FOUNDATION_VEHICLE_MOTION_PRESENTATION_POLICY: VehicleMotionPresentationPolicy =
  Object.freeze({
    accelerationResponseSeconds: 0.45,
    decelerationResponseSeconds: 0.3,
    turnSpeedFactor: 0.55,
    turnApproachCellFraction: 0.35,
    maxCatchupSpeedMultiplier: 1.5,
    stopSpeedEpsilonMillimetersPerSecond: 10,
  });

function validateNonNegativeFinite(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError('traffic-three:invalid-vehicle-kinematics');
  }
}

function validatePolicy(policy: VehicleMotionPresentationPolicy): void {
  if (
    !Number.isFinite(policy.accelerationResponseSeconds) ||
    policy.accelerationResponseSeconds <= 0 ||
    !Number.isFinite(policy.decelerationResponseSeconds) ||
    policy.decelerationResponseSeconds <= 0 ||
    !Number.isFinite(policy.turnSpeedFactor) ||
    policy.turnSpeedFactor <= 0 ||
    policy.turnSpeedFactor > 1 ||
    !Number.isFinite(policy.turnApproachCellFraction) ||
    policy.turnApproachCellFraction <= 0 ||
    policy.turnApproachCellFraction > 1 ||
    !Number.isFinite(policy.maxCatchupSpeedMultiplier) ||
    policy.maxCatchupSpeedMultiplier < 1 ||
    policy.maxCatchupSpeedMultiplier > 2 ||
    !Number.isFinite(policy.stopSpeedEpsilonMillimetersPerSecond) ||
    policy.stopSpeedEpsilonMillimetersPerSecond < 0
  ) {
    throw new RangeError('traffic-three:invalid-vehicle-motion-policy');
  }
}

function isTurnMovement(value: string | undefined): boolean {
  return value === 'turn-left' || value === 'turn-right';
}

function turnSpeedFactorAt(
  preparedRoute: PreparedTrafficRoute,
  distanceMillimeters: number,
  cellPresentationLengthMillimeters: number,
  policy: VehicleMotionPresentationPolicy,
): number {
  const approachDistance = cellPresentationLengthMillimeters * policy.turnApproachCellFraction;
  for (const segment of preparedRoute.preparedSegments) {
    const movementKind = segment.source.movementKind;
    if (!isTurnMovement(movementKind)) continue;
    if (
      distanceMillimeters >= segment.startDistanceMillimeters &&
      distanceMillimeters <= segment.endDistanceMillimeters
    ) {
      return policy.turnSpeedFactor;
    }
    if (segment.startDistanceMillimeters <= distanceMillimeters) continue;
    const distanceToTurn = segment.startDistanceMillimeters - distanceMillimeters;
    if (distanceToTurn > approachDistance) return 1;
    const approachProgress = Math.max(0, Math.min(1, distanceToTurn / approachDistance));
    return policy.turnSpeedFactor + (1 - policy.turnSpeedFactor) * approachProgress;
  }
  return 1;
}

function desiredSpeedFor(
  state: VehicleKinematicsState,
  input: Readonly<{
    queued: boolean;
    preparedRoute: PreparedTrafficRoute;
    cellPresentationLengthMillimeters: number;
    policy: VehicleMotionPresentationPolicy;
  }>,
): number {
  const lag = Math.max(
    0,
    state.canonicalTargetDistanceMillimeters - state.visualDistanceMillimeters,
  );
  if (input.queued || lag <= input.policy.stopSpeedEpsilonMillimetersPerSecond) return 0;

  const baseline = state.baselineFollowerSpeedMillimetersPerSecond;
  if (baseline <= 0) return 0;
  const catchupRange = Math.max(1, input.cellPresentationLengthMillimeters);
  const catchupProgress = Math.max(0, Math.min(1, lag / catchupRange));
  const catchupMultiplier =
    1 + (input.policy.maxCatchupSpeedMultiplier - 1) * catchupProgress;
  return (
    baseline *
    catchupMultiplier *
    turnSpeedFactorAt(
      input.preparedRoute,
      state.visualDistanceMillimeters,
      input.cellPresentationLengthMillimeters,
      input.policy,
    )
  );
}

export function createVehicleKinematicsState(
  initialDistanceMillimeters: number,
  timestampMs: number,
): VehicleKinematicsState {
  validateNonNegativeFinite(initialDistanceMillimeters);
  validateNonNegativeFinite(timestampMs);
  return {
    visualDistanceMillimeters: initialDistanceMillimeters,
    visualSpeedMillimetersPerSecond: 0,
    canonicalTargetDistanceMillimeters: initialDistanceMillimeters,
    baselineFollowerSpeedMillimetersPerSecond: 0,
    lastFrameTimestampMs: timestampMs,
  };
}

export function setVehicleKinematicsTarget(
  state: VehicleKinematicsState,
  targetDistanceMillimeters: number,
  committedDeltaSeconds: number,
): void {
  validateNonNegativeFinite(targetDistanceMillimeters);
  if (!Number.isFinite(committedDeltaSeconds) || committedDeltaSeconds <= 0) {
    throw new RangeError('traffic-three:invalid-vehicle-kinematics');
  }
  const previousTarget = state.canonicalTargetDistanceMillimeters;
  state.canonicalTargetDistanceMillimeters = targetDistanceMillimeters;
  if (targetDistanceMillimeters > previousTarget) {
    state.baselineFollowerSpeedMillimetersPerSecond =
      (targetDistanceMillimeters - previousTarget) / committedDeltaSeconds;
  }
  if (state.visualDistanceMillimeters > targetDistanceMillimeters) {
    state.visualDistanceMillimeters = targetDistanceMillimeters;
    state.visualSpeedMillimetersPerSecond = 0;
  }
}

export function advanceVehicleKinematics(
  state: VehicleKinematicsState,
  input: Readonly<{
    timestampMs: number;
    queued: boolean;
    preparedRoute: PreparedTrafficRoute;
    cellPresentationLengthMillimeters: number;
    policy?: VehicleMotionPresentationPolicy;
  }>,
): void {
  validateNonNegativeFinite(input.timestampMs);
  if (!Number.isFinite(input.cellPresentationLengthMillimeters) || input.cellPresentationLengthMillimeters <= 0) {
    throw new RangeError('traffic-three:invalid-vehicle-kinematics');
  }
  const policy = input.policy ?? FOUNDATION_VEHICLE_MOTION_PRESENTATION_POLICY;
  validatePolicy(policy);
  if (input.timestampMs <= state.lastFrameTimestampMs) return;

  const deltaSeconds = (input.timestampMs - state.lastFrameTimestampMs) / 1_000;
  const previousSpeed = state.visualSpeedMillimetersPerSecond;
  const desiredSpeed = desiredSpeedFor(state, {
    queued: input.queued,
    preparedRoute: input.preparedRoute,
    cellPresentationLengthMillimeters: input.cellPresentationLengthMillimeters,
    policy,
  });
  const responseSeconds =
    desiredSpeed < previousSpeed
      ? policy.decelerationResponseSeconds
      : policy.accelerationResponseSeconds;
  const alpha = 1 - Math.exp(-deltaSeconds / responseSeconds);
  let nextSpeed = previousSpeed + (desiredSpeed - previousSpeed) * alpha;
  if (desiredSpeed === 0 && nextSpeed <= policy.stopSpeedEpsilonMillimetersPerSecond) {
    nextSpeed = 0;
  }

  const integratedDistance =
    state.visualDistanceMillimeters + ((previousSpeed + nextSpeed) / 2) * deltaSeconds;
  const targetDistance = Math.min(
    input.preparedRoute.totalLengthMillimeters,
    state.canonicalTargetDistanceMillimeters,
  );
  state.visualDistanceMillimeters = Math.max(0, Math.min(targetDistance, integratedDistance));
  if (state.visualDistanceMillimeters >= targetDistance) nextSpeed = 0;
  state.visualSpeedMillimetersPerSecond = nextSpeed;
  state.lastFrameTimestampMs = input.timestampMs;
}
