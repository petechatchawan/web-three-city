import { TRAFFIC_POSITION_Q_PER_METER } from './contracts.js';

/** Versioned physical policy expressed in Traffic world millimetres. */
export const TRAFFIC_VEHICLE_ENVELOPE_POLICY_V1 = Object.freeze({
  vehicleLengthMillimeters: 800,
  minimumGapMillimeters: 200,
  timeHeadwayMilliseconds: 120,
  version: 1,
});

export function requiredVehicleFrontHeadwayMillimeters(
  input: Readonly<{
    freeFlowSpeedMillimetersPerSecond: number;
    congestionMilli: number;
  }>,
): number {
  if (
    !Number.isSafeInteger(input.freeFlowSpeedMillimetersPerSecond) ||
    input.freeFlowSpeedMillimetersPerSecond <= 0 ||
    !Number.isSafeInteger(input.congestionMilli) ||
    input.congestionMilli < 0
  ) {
    throw new RangeError('traffic:invalid-envelope-policy-input');
  }
  const dynamicHeadway = Math.ceil(
    (input.freeFlowSpeedMillimetersPerSecond *
      TRAFFIC_VEHICLE_ENVELOPE_POLICY_V1.timeHeadwayMilliseconds) /
      1_000,
  );
  return Math.max(
    TRAFFIC_VEHICLE_ENVELOPE_POLICY_V1.vehicleLengthMillimeters +
      TRAFFIC_VEHICLE_ENVELOPE_POLICY_V1.minimumGapMillimeters,
    dynamicHeadway,
  );
}

export function millimetersToProgressQ(millimeters: number, edgeLengthQ: number): number {
  if (
    !Number.isSafeInteger(millimeters) ||
    millimeters < 0 ||
    !Number.isSafeInteger(edgeLengthQ) ||
    edgeLengthQ <= 0
  ) {
    throw new RangeError('traffic:invalid-envelope-distance');
  }
  return Math.max(
    0,
    Math.min(
      edgeLengthQ,
      Math.ceil((millimeters * edgeLengthQ) / (8 * TRAFFIC_POSITION_Q_PER_METER)),
    ),
  );
}
