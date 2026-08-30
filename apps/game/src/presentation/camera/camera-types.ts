export interface CityCameraState {
  readonly targetX: number;
  readonly targetY: number;
  readonly targetZ: number;
  readonly distance: number;
  readonly azimuthRadians: number;
  readonly elevationRadians: number;
}

export interface CityCameraConstraints {
  readonly targetXMinMeters: number;
  readonly targetXMaxMeters: number;
  readonly targetZMinMeters: number;
  readonly targetZMaxMeters: number;
  readonly minDistanceMeters: number;
  readonly maxDistanceMeters: number;
  readonly minElevationRadians: number;
  readonly maxElevationRadians: number;
}

export type CityCameraIntent =
  | {
      readonly type: "pan";
      readonly rightMeters: number;
      readonly forwardMeters: number;
    }
  | {
      readonly type: "rotate";
      readonly azimuthDeltaRadians: number;
      readonly elevationDeltaRadians: number;
    }
  | { readonly type: "zoom"; readonly distanceFactor: number }
  | { readonly type: "targetHeight"; readonly targetY: number }
  | { readonly type: "reset"; readonly state: CityCameraState };
