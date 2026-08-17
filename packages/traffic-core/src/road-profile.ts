import { TrafficContractError } from './errors.js';

export interface TrafficRoadProfileV1 {
  readonly definitionCode: number;
  readonly freeFlowSpeedMillimetersPerSecond: number;
  readonly edgeCapacityUnits: number;
  readonly intersectionServiceUnitsPerSecondQ: number;
  readonly pedestrianOffsetMillimeters: number;
  readonly vehicleOffsetMillimeters: number;
}

function validateProfile(profile: TrafficRoadProfileV1): void {
  if (
    !Number.isSafeInteger(profile.definitionCode) ||
    profile.definitionCode < 1 ||
    !Number.isSafeInteger(profile.freeFlowSpeedMillimetersPerSecond) ||
    profile.freeFlowSpeedMillimetersPerSecond <= 0 ||
    !Number.isSafeInteger(profile.edgeCapacityUnits) ||
    profile.edgeCapacityUnits <= 0 ||
    !Number.isSafeInteger(profile.intersectionServiceUnitsPerSecondQ) ||
    profile.intersectionServiceUnitsPerSecondQ <= 0 ||
    !Number.isSafeInteger(profile.pedestrianOffsetMillimeters) ||
    profile.pedestrianOffsetMillimeters <= 0 ||
    !Number.isSafeInteger(profile.vehicleOffsetMillimeters) ||
    profile.vehicleOffsetMillimeters < 0 ||
    profile.vehicleOffsetMillimeters >= profile.pedestrianOffsetMillimeters
  ) {
    throw new TrafficContractError('traffic:invalid-road-profile');
  }
}

export function createTrafficRoadProfiles(
  profiles: readonly TrafficRoadProfileV1[],
): readonly TrafficRoadProfileV1[] {
  const seen = new Set<number>();
  const result = profiles.map((profile) => {
    validateProfile(profile);
    if (seen.has(profile.definitionCode)) {
      throw new TrafficContractError('traffic:invalid-road-profile');
    }
    seen.add(profile.definitionCode);
    return Object.freeze({ ...profile });
  });
  result.sort((a, b) => a.definitionCode - b.definitionCode);
  return Object.freeze(result);
}

export const FOUNDATION_TRAFFIC_ROAD_PROFILES: readonly TrafficRoadProfileV1[] =
  createTrafficRoadProfiles([
    {
      definitionCode: 1,
      freeFlowSpeedMillimetersPerSecond: 13_889,
      edgeCapacityUnits: 24,
      intersectionServiceUnitsPerSecondQ: 250_000,
      pedestrianOffsetMillimeters: 3_000,
      vehicleOffsetMillimeters: 1_200,
    },
  ]);

export function resolveTrafficRoadProfile(
  definitionCode: number,
  profiles: readonly TrafficRoadProfileV1[] = FOUNDATION_TRAFFIC_ROAD_PROFILES,
): TrafficRoadProfileV1 {
  const profile = profiles.find((entry) => entry.definitionCode === definitionCode);
  if (profile === undefined) throw new TrafficContractError('traffic:unknown-road-profile');
  validateProfile(profile);
  return profile;
}
