import type { CityCameraConstraints, CityCameraState } from "./camera-types";

export interface CityCameraConfig {
  readonly initialDistanceFactor: number;
  readonly minDistanceFactor: number;
  readonly maxDistanceFactor: number;
  readonly initialAzimuthRadians: number;
  readonly initialElevationRadians: number;
  readonly minElevationRadians: number;
  readonly maxElevationRadians: number;
  readonly targetMarginFactor: number;
}

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const CITY_CAMERA_DEFAULT_CONFIG: CityCameraConfig = Object.freeze({
  initialDistanceFactor: 1.18,
  minDistanceFactor: 0.06,
  maxDistanceFactor: 2.8,
  initialAzimuthRadians: degreesToRadians(35),
  initialElevationRadians: degreesToRadians(55),
  minElevationRadians: degreesToRadians(22),
  maxElevationRadians: degreesToRadians(78),
  targetMarginFactor: 0.04,
});

interface MapCameraRead {
  readonly widthCells: number;
  readonly heightCells: number;
  readonly cellSizeMeters: number;
}

function mapMetrics(map: MapCameraRead) {
  const widthMeters = map.widthCells * map.cellSizeMeters;
  const depthMeters = map.heightCells * map.cellSizeMeters;
  return {
    widthMeters,
    depthMeters,
    maxSpanMeters: Math.max(widthMeters, depthMeters),
  };
}

export function createCityCameraConstraints(
  map: MapCameraRead,
  config: CityCameraConfig = CITY_CAMERA_DEFAULT_CONFIG,
): CityCameraConstraints {
  const { widthMeters, depthMeters, maxSpanMeters } = mapMetrics(map);
  const marginX = widthMeters * config.targetMarginFactor;
  const marginZ = depthMeters * config.targetMarginFactor;
  return Object.freeze({
    targetXMinMeters: -marginX,
    targetXMaxMeters: widthMeters + marginX,
    targetZMinMeters: -marginZ,
    targetZMaxMeters: depthMeters + marginZ,
    minDistanceMeters: maxSpanMeters * config.minDistanceFactor,
    maxDistanceMeters: maxSpanMeters * config.maxDistanceFactor,
    minElevationRadians: config.minElevationRadians,
    maxElevationRadians: config.maxElevationRadians,
  });
}

export function createInitialCityCameraState(
  map: MapCameraRead,
  config: CityCameraConfig = CITY_CAMERA_DEFAULT_CONFIG,
): CityCameraState {
  const { widthMeters, depthMeters, maxSpanMeters } = mapMetrics(map);
  return Object.freeze({
    targetX: widthMeters / 2,
    targetY: 0,
    targetZ: depthMeters / 2,
    distance: maxSpanMeters * config.initialDistanceFactor,
    azimuthRadians: config.initialAzimuthRadians,
    elevationRadians: config.initialElevationRadians,
  });
}
