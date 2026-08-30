import type { SceneCameraConfig } from "../create-scene";
import {
  CITY_CAMERA_DEFAULT_CONFIG,
  createInitialCityCameraState,
  type CityCameraConfig,
} from "./camera-config";
import { resolveCityCameraPose } from "./camera-pose";

interface CameraMapRead {
  readonly widthCells: number;
  readonly heightCells: number;
  readonly cellSizeMeters: number;
}

export interface CitySceneProjectionConfig {
  readonly fovDegrees: number;
  readonly nearCellFactor: number;
  readonly farSpanFactor: number;
}

export const CITY_SCENE_PROJECTION_DEFAULT_CONFIG: CitySceneProjectionConfig =
  Object.freeze({
    fovDegrees: 50,
    nearCellFactor: 0.125,
    farSpanFactor: 4,
  });

export function createCitySceneCameraConfig(
  map: CameraMapRead,
  cameraConfig: CityCameraConfig = CITY_CAMERA_DEFAULT_CONFIG,
  projectionConfig: CitySceneProjectionConfig = CITY_SCENE_PROJECTION_DEFAULT_CONFIG,
): SceneCameraConfig {
  const maxSpanMeters =
    Math.max(map.widthCells, map.heightCells) * map.cellSizeMeters;
  const initialState = createInitialCityCameraState(map, cameraConfig);
  const pose = resolveCityCameraPose(initialState);
  return Object.freeze({
    fovDegrees: projectionConfig.fovDegrees,
    nearMeters: Math.max(
      Number.EPSILON,
      map.cellSizeMeters * projectionConfig.nearCellFactor,
    ),
    farMeters: maxSpanMeters * projectionConfig.farSpanFactor,
    position: pose.position,
    target: pose.target,
  });
}
