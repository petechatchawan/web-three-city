import {
  CameraContractError,
  assertFiniteNumber,
  type ViewportInsets,
} from './camera-state.js';

export interface CameraFitRequest {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly insets: ViewportInsets;
  readonly targetX: number;
  readonly targetZ: number;
  readonly yawDegrees: number;
  readonly pitchDegrees: number;
  readonly worldHalfWidth: number;
  readonly worldHalfHeight: number;
  readonly minimumWorldY: number;
  readonly maximumWorldY: number;
  readonly marginRatio: number;
}

export interface ProjectedCameraPoint {
  readonly x: number;
  readonly y: number;
}

export interface CameraFitResult {
  readonly orthographicSize: number;
  readonly halfWidth: number;
  readonly halfHeight: number;
  readonly usableWidth: number;
  readonly usableHeight: number;
  readonly projectedCorners: readonly ProjectedCameraPoint[];
}

interface Vector3Like {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function validateInsets(insets: ViewportInsets): void {
  for (const [field, value] of Object.entries(insets)) {
    assertFiniteNumber(value, 'camera:invalid-insets', `insets.${field}`);
    if (value < 0) {
      throw new CameraContractError('camera:invalid-insets', 'Viewport insets cannot be negative.');
    }
  }
}

function validateRequest(request: CameraFitRequest): void {
  const finiteFields = [
    ['viewportWidth', request.viewportWidth],
    ['viewportHeight', request.viewportHeight],
    ['targetX', request.targetX],
    ['targetZ', request.targetZ],
    ['yawDegrees', request.yawDegrees],
    ['pitchDegrees', request.pitchDegrees],
    ['worldHalfWidth', request.worldHalfWidth],
    ['worldHalfHeight', request.worldHalfHeight],
    ['minimumWorldY', request.minimumWorldY],
    ['maximumWorldY', request.maximumWorldY],
    ['marginRatio', request.marginRatio],
  ] as const;

  for (const [field, value] of finiteFields) {
    assertFiniteNumber(value, 'camera:invalid-fit-request', field);
  }

  validateInsets(request.insets);

  if (request.viewportWidth <= 0 || request.viewportHeight <= 0) {
    throw new CameraContractError('camera:invalid-viewport', 'Viewport dimensions must be positive.');
  }
  if (request.worldHalfWidth <= 0 || request.worldHalfHeight <= 0) {
    throw new CameraContractError(
      'camera:invalid-fit-request',
      'World half-extents must be positive.',
    );
  }
  if (request.maximumWorldY < request.minimumWorldY) {
    throw new CameraContractError(
      'camera:invalid-world-bounds',
      'maximumWorldY cannot be below minimumWorldY.',
    );
  }
  if (request.marginRatio < 0) {
    throw new CameraContractError(
      'camera:invalid-fit-request',
      'Framing margin cannot be negative.',
    );
  }
}

function dot(left: Vector3Like, right: Vector3Like): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function buildWorldCorners(request: CameraFitRequest): readonly Vector3Like[] {
  const corners: Vector3Like[] = [];
  for (const y of [request.minimumWorldY, request.maximumWorldY]) {
    for (const x of [-request.worldHalfWidth, request.worldHalfWidth]) {
      for (const z of [-request.worldHalfHeight, request.worldHalfHeight]) {
        corners.push({ x, y, z });
      }
    }
  }
  return corners;
}

export function calculateFittedOrthographicSize(request: CameraFitRequest): CameraFitResult {
  validateRequest(request);

  const usableWidth = request.viewportWidth - request.insets.left - request.insets.right;
  const usableHeight = request.viewportHeight - request.insets.top - request.insets.bottom;
  if (usableWidth <= 0 || usableHeight <= 0) {
    throw new CameraContractError(
      'camera:invalid-usable-viewport',
      'Viewport insets consume the usable viewport.',
    );
  }

  const yaw = (request.yawDegrees * Math.PI) / 180;
  const pitch = (request.pitchDegrees * Math.PI) / 180;
  const right = {
    x: Math.cos(yaw),
    y: 0,
    z: -Math.sin(yaw),
  };
  const up = {
    x: -Math.sin(yaw) * Math.sin(pitch),
    y: Math.cos(pitch),
    z: -Math.cos(yaw) * Math.sin(pitch),
  };

  const projectedCorners = buildWorldCorners(request).map((corner) => {
    const relative = {
      x: corner.x - request.targetX,
      y: corner.y,
      z: corner.z - request.targetZ,
    };
    return {
      x: dot(relative, right),
      y: dot(relative, up),
    };
  });

  const maximumAbsoluteX = Math.max(...projectedCorners.map((corner) => Math.abs(corner.x)));
  const maximumAbsoluteY = Math.max(...projectedCorners.map((corner) => Math.abs(corner.y)));
  const usableAspect = usableWidth / usableHeight;
  const requiredHalfHeight = Math.max(maximumAbsoluteY, maximumAbsoluteX / usableAspect);
  const halfHeight = requiredHalfHeight * (1 + request.marginRatio);
  const halfWidth = halfHeight * usableAspect;

  return {
    orthographicSize: halfHeight,
    halfWidth,
    halfHeight,
    usableWidth,
    usableHeight,
    projectedCorners,
  };
}
