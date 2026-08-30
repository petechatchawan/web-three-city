import type { CityCameraState } from "./camera-types";

export interface CityCameraPose {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

export function resolveCityCameraPose(state: CityCameraState): CityCameraPose {
  const horizontalDistance = state.distance * Math.cos(state.elevationRadians);
  return Object.freeze({
    position: [
      state.targetX + horizontalDistance * Math.sin(state.azimuthRadians),
      state.targetY + state.distance * Math.sin(state.elevationRadians),
      state.targetZ + horizontalDistance * Math.cos(state.azimuthRadians),
    ] as const,
    target: [state.targetX, state.targetY, state.targetZ] as const,
  });
}
