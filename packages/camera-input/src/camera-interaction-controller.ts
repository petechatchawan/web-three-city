import type { WorldVerticalBounds } from './camera-state.js';
import type { OrthographicCameraRig } from './orthographic-camera-rig.js';
import type { TerrainPickResult } from './terrain-picker.js';

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

export interface TerrainAnchorResolver {
  pick(point: ScreenPoint): TerrainPickResult | null;
}

export const CAMERA_INTERACTION_SENSITIVITY = Object.freeze({
  wheelExponentPerDeltaY: -0.001,
  twistDegreesPerRadian: 180 / Math.PI,
  pitchDegreesPerCssPixel: -0.12,
});

function isFinitePoint(point: ScreenPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export class CameraInteractionController {
  readonly #rig: OrthographicCameraRig;
  readonly #resolver: TerrainAnchorResolver;

  constructor(rig: OrthographicCameraRig, resolver: TerrainAnchorResolver) {
    this.#rig = rig;
    this.#resolver = resolver;
  }

  panScreen(delta: Readonly<{ x: number; y: number }>): void {
    if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return;
    const worldUnitsPerPixel =
      (2 * this.#rig.state.orthographicSize) / this.#rig.usableViewportHeight;
    const basis = this.#rig.screenBasisXZ();
    if (basis === null) return;
    const deltaX = (-delta.x * basis.rightX + delta.y * basis.upX) * worldUnitsPerPixel;
    const deltaZ = (-delta.x * basis.rightZ + delta.y * basis.upZ) * worldUnitsPerPixel;
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaZ)) return;
    this.#rig.panWorld(deltaX, deltaZ);
  }

  zoomAt(point: ScreenPoint, scale: number): void {
    if (!isFinitePoint(point) || !Number.isFinite(scale) || scale <= 0) return;
    this.#applyAnchored(point, () => {
      this.#rig.setOrthographicSize(this.#rig.state.orthographicSize / scale);
    });
  }

  zoomWheelAt(point: ScreenPoint, deltaY: number): void {
    if (!Number.isFinite(deltaY)) return;
    this.zoomAt(point, Math.exp(deltaY * CAMERA_INTERACTION_SENSITIVITY.wheelExponentPerDeltaY));
  }

  rotateYawAt(point: ScreenPoint, deltaDegrees: number): void {
    if (!isFinitePoint(point) || !Number.isFinite(deltaDegrees)) return;
    this.#applyAnchored(point, () => {
      this.#rig.setYawDegrees(this.#rig.state.yawDegrees + deltaDegrees);
    });
  }

  tiltPitchAt(point: ScreenPoint, deltaDegrees: number): void {
    if (!isFinitePoint(point) || !Number.isFinite(deltaDegrees)) return;
    this.#applyAnchored(point, () => {
      this.#rig.setPitchDegrees(this.#rig.state.pitchDegrees + deltaDegrees);
    });
  }

  rotateLeft(): void {
    this.#rig.rotateLeft();
  }

  rotateRight(): void {
    this.#rig.rotateRight();
  }

  reset(bounds: WorldVerticalBounds): void {
    this.#rig.resetToFit(bounds);
  }

  #applyAnchored(point: ScreenPoint, operation: () => void): void {
    const before = this.#resolver.pick(point)?.worldPoint ?? null;
    operation();
    if (before === null) return;
    const after = this.#resolver.pick(point)?.worldPoint ?? null;
    if (after === null) return;
    this.#rig.panWorld(before.x - after.x, before.z - after.z);
  }
}
