export interface CameraState {
  readonly targetX: number;
  readonly targetZ: number;
  readonly yawDegrees: number;
  readonly pitchDegrees: number;
  readonly orthographicSize: number;
}

export interface CameraLimits {
  readonly minimumPitchDegrees: number;
  readonly maximumPitchDegrees: number;
  readonly hardMinimumPitchDegrees: number;
  readonly hardMaximumPitchDegrees: number;
  readonly minimumOrthographicSize: number;
  readonly maximumOrthographicSize: number;
}

export interface CameraRigOptions extends Partial<CameraLimits> {
  readonly yawDegrees?: number;
  readonly pitchDegrees?: number;
  readonly framingMarginRatio?: number;
}

export interface ViewportInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface WorldVerticalBounds {
  readonly minimumWorldY: number;
  readonly maximumWorldY: number;
}

export type CameraContractErrorCode =
  | 'camera:invalid-map-config'
  | 'camera:invalid-pitch-limits'
  | 'camera:pitch-limit-outside-hard-envelope'
  | 'camera:invalid-zoom-limits'
  | 'camera:invalid-viewport'
  | 'camera:invalid-usable-viewport'
  | 'camera:invalid-insets'
  | 'camera:invalid-world-bounds'
  | 'camera:invalid-fit-request'
  | 'camera:invalid-state';

export class CameraContractError extends Error {
  readonly code: CameraContractErrorCode;

  constructor(code: CameraContractErrorCode, message: string) {
    super(message);
    this.name = 'CameraContractError';
    this.code = code;
  }
}

export const CAMERA_DEFAULTS = Object.freeze({
  yawDegrees: 45,
  pitchDegrees: 50,
  minimumPitchDegrees: 35,
  maximumPitchDegrees: 65,
  hardMinimumPitchDegrees: 20,
  hardMaximumPitchDegrees: 80,
  minimumOrthographicSize: 18,
  maximumOrthographicSize: 170,
  framingMarginRatio: 0.08,
});

export function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

export function assertFiniteNumber(
  value: number,
  code: CameraContractErrorCode,
  field: string,
): void {
  if (!isFiniteNumber(value)) {
    throw new CameraContractError(code, `${field} must be finite.`);
  }
}

export function normalizeYawDegrees(yawDegrees: number): number {
  assertFiniteNumber(yawDegrees, 'camera:invalid-state', 'yawDegrees');
  return ((yawDegrees % 360) + 360) % 360;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
