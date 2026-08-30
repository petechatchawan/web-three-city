import { Vector3, type PerspectiveCamera } from "three";
import { resolveCityCameraPose } from "./camera-pose";
import {
  CITY_CAMERA_DEFAULT_CONFIG,
  createCityCameraConstraints,
  createInitialCityCameraState,
  type CityCameraConfig,
} from "./camera-config";
import { reduceCityCamera } from "./camera-reducer";
import type { CityCameraIntent, CityCameraState } from "./camera-types";

interface CameraMapRead {
  readonly widthCells: number;
  readonly heightCells: number;
  readonly cellSizeMeters: number;
}

export interface CityCameraController {
  state(): CityCameraState;
  initialState(): CityCameraState;
  dispatch(intent: CityCameraIntent): CityCameraState;
  reset(): CityCameraState;
}

export function createCityCamera(input: {
  readonly camera: PerspectiveCamera;
  readonly map: CameraMapRead;
  readonly config?: CityCameraConfig;
}): CityCameraController {
  const config = input.config ?? CITY_CAMERA_DEFAULT_CONFIG;
  const constraints = createCityCameraConstraints(input.map, config);
  const initial = createInitialCityCameraState(input.map, config);
  let state = initial;

  const apply = (): void => {
    const pose = resolveCityCameraPose(state);
    input.camera.position.set(...pose.position);
    input.camera.lookAt(new Vector3(...pose.target));
    input.camera.updateMatrixWorld(true);
  };

  apply();

  const controller: CityCameraController = {
    state: () => state,
    initialState: () => initial,
    dispatch(intent): CityCameraState {
      state = reduceCityCamera(state, intent, constraints);
      apply();
      return state;
    },
    reset(): CityCameraState {
      state = reduceCityCamera(
        state,
        { type: "reset", state: initial },
        constraints,
      );
      apply();
      return state;
    },
  };
  return Object.freeze(controller);
}
