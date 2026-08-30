import type {
  CityCameraConstraints,
  CityCameraIntent,
  CityCameraState,
} from "./camera-types";

const TAU = Math.PI * 2;
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
const wrapRadians = (value: number): number => ((value % TAU) + TAU) % TAU;

export function reduceCityCamera(
  state: CityCameraState,
  intent: CityCameraIntent,
  constraints: CityCameraConstraints,
): CityCameraState {
  if (intent.type === "reset") return Object.freeze({ ...intent.state });
  if (intent.type === "targetHeight")
    return Object.freeze({ ...state, targetY: intent.targetY });
  if (intent.type === "zoom") {
    if (intent.distanceFactor <= 0 || !Number.isFinite(intent.distanceFactor))
      return state;
    return Object.freeze({
      ...state,
      distance: clamp(
        state.distance * intent.distanceFactor,
        constraints.minDistanceMeters,
        constraints.maxDistanceMeters,
      ),
    });
  }
  if (intent.type === "rotate") {
    return Object.freeze({
      ...state,
      azimuthRadians: wrapRadians(
        state.azimuthRadians + intent.azimuthDeltaRadians,
      ),
      elevationRadians: clamp(
        state.elevationRadians + intent.elevationDeltaRadians,
        constraints.minElevationRadians,
        constraints.maxElevationRadians,
      ),
    });
  }

  const sin = Math.sin(state.azimuthRadians);
  const cos = Math.cos(state.azimuthRadians);
  const deltaX = intent.rightMeters * cos - intent.forwardMeters * sin;
  const deltaZ = -intent.rightMeters * sin - intent.forwardMeters * cos;
  return Object.freeze({
    ...state,
    targetX: clamp(
      state.targetX + deltaX,
      constraints.targetXMinMeters,
      constraints.targetXMaxMeters,
    ),
    targetZ: clamp(
      state.targetZ + deltaZ,
      constraints.targetZMinMeters,
      constraints.targetZMaxMeters,
    ),
  });
}
