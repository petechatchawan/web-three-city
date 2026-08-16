export interface TrafficVisualScalePolicy {
  readonly roadWidthWorldUnits: number;
  readonly vehicleWidthWorldUnits: number;
  readonly vehicleLengthWorldUnits: number;
  readonly vehicleHeightWorldUnits: number;
  readonly pedestrianWidthWorldUnits: number;
  readonly pedestrianDepthWorldUnits: number;
  readonly pedestrianHeightWorldUnits: number;
  readonly appearanceScaleVariation: number;
}

const VEHICLE_WIDTH_RATIO = 1 / 3;
const VEHICLE_LENGTH_RATIO = 25 / 36;
const VEHICLE_HEIGHT_RATIO = 5 / 18;
const PEDESTRIAN_WIDTH_RATIO = 1 / 9;
const PEDESTRIAN_DEPTH_RATIO = 1 / 12;
const PEDESTRIAN_HEIGHT_RATIO = 1 / 3;
const APPEARANCE_SCALE_VARIATION = 0.05;
const FOUNDATION_ROAD_WIDTH_WORLD_UNITS = 0.72;

export function createTrafficVisualScalePolicy(
  roadWidthWorldUnits: number,
): TrafficVisualScalePolicy {
  if (!Number.isFinite(roadWidthWorldUnits) || roadWidthWorldUnits <= 0) {
    throw new RangeError('traffic-three:invalid-road-visual-width');
  }
  return Object.freeze({
    roadWidthWorldUnits,
    vehicleWidthWorldUnits: roadWidthWorldUnits * VEHICLE_WIDTH_RATIO,
    vehicleLengthWorldUnits: roadWidthWorldUnits * VEHICLE_LENGTH_RATIO,
    vehicleHeightWorldUnits: roadWidthWorldUnits * VEHICLE_HEIGHT_RATIO,
    pedestrianWidthWorldUnits: roadWidthWorldUnits * PEDESTRIAN_WIDTH_RATIO,
    pedestrianDepthWorldUnits: roadWidthWorldUnits * PEDESTRIAN_DEPTH_RATIO,
    pedestrianHeightWorldUnits: roadWidthWorldUnits * PEDESTRIAN_HEIGHT_RATIO,
    appearanceScaleVariation: APPEARANCE_SCALE_VARIATION,
  });
}

export const FOUNDATION_TRAFFIC_VISUAL_SCALE_POLICY = createTrafficVisualScalePolicy(
  FOUNDATION_ROAD_WIDTH_WORLD_UNITS,
);
