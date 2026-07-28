import * as THREE from 'three';
import { calculateFittedOrthographicSize } from './camera-framing.js';
import {
  CAMERA_DEFAULTS,
  CameraContractError,
  assertFiniteNumber,
  clamp,
  normalizeYawDegrees,
  type CameraLimits,
  type CameraRigOptions,
  type CameraState,
  type ViewportInsets,
  type WorldVerticalBounds,
} from './camera-state.js';

export interface CameraMapConfig {
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly cellSize: number;
}

interface LegacyCameraState {
  readonly yawQuarterTurns: 0 | 1 | 2 | 3;
  readonly zoom: number;
}

const ZERO_INSETS: ViewportInsets = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

function validateMapConfig(config: CameraMapConfig): void {
  assertFiniteNumber(config.mapWidth, 'camera:invalid-map-config', 'mapWidth');
  assertFiniteNumber(config.mapHeight, 'camera:invalid-map-config', 'mapHeight');
  assertFiniteNumber(config.cellSize, 'camera:invalid-map-config', 'cellSize');
  if (config.mapWidth <= 0 || config.mapHeight <= 0 || config.cellSize <= 0) {
    throw new CameraContractError(
      'camera:invalid-map-config',
      'Map dimensions and cellSize must be positive.',
    );
  }
}

function resolveLimits(options: CameraRigOptions): CameraLimits {
  const hardMinimumPitchDegrees =
    options.hardMinimumPitchDegrees ?? CAMERA_DEFAULTS.hardMinimumPitchDegrees;
  const hardMaximumPitchDegrees =
    options.hardMaximumPitchDegrees ?? CAMERA_DEFAULTS.hardMaximumPitchDegrees;
  const minimumPitchDegrees = options.minimumPitchDegrees ?? CAMERA_DEFAULTS.minimumPitchDegrees;
  const maximumPitchDegrees = options.maximumPitchDegrees ?? CAMERA_DEFAULTS.maximumPitchDegrees;
  const minimumOrthographicSize =
    options.minimumOrthographicSize ?? CAMERA_DEFAULTS.minimumOrthographicSize;
  const maximumOrthographicSize =
    options.maximumOrthographicSize ?? CAMERA_DEFAULTS.maximumOrthographicSize;

  for (const [field, value] of [
    ['hardMinimumPitchDegrees', hardMinimumPitchDegrees],
    ['hardMaximumPitchDegrees', hardMaximumPitchDegrees],
    ['minimumPitchDegrees', minimumPitchDegrees],
    ['maximumPitchDegrees', maximumPitchDegrees],
  ] as const) {
    assertFiniteNumber(value, 'camera:invalid-pitch-limits', field);
  }
  for (const [field, value] of [
    ['minimumOrthographicSize', minimumOrthographicSize],
    ['maximumOrthographicSize', maximumOrthographicSize],
  ] as const) {
    assertFiniteNumber(value, 'camera:invalid-zoom-limits', field);
  }

  if (
    hardMaximumPitchDegrees < hardMinimumPitchDegrees ||
    maximumPitchDegrees < minimumPitchDegrees
  ) {
    throw new CameraContractError('camera:invalid-pitch-limits', 'Pitch limits must be ordered.');
  }
  if (
    minimumPitchDegrees < hardMinimumPitchDegrees ||
    maximumPitchDegrees > hardMaximumPitchDegrees
  ) {
    throw new CameraContractError(
      'camera:pitch-limit-outside-hard-envelope',
      'Design pitch limits must remain inside the hard safety envelope.',
    );
  }
  if (minimumOrthographicSize <= 0 || maximumOrthographicSize < minimumOrthographicSize) {
    throw new CameraContractError(
      'camera:invalid-zoom-limits',
      'Orthographic-size limits must be positive and ordered.',
    );
  }

  return {
    minimumPitchDegrees,
    maximumPitchDegrees,
    hardMinimumPitchDegrees,
    hardMaximumPitchDegrees,
    minimumOrthographicSize,
    maximumOrthographicSize,
  };
}

function validateInsets(insets: ViewportInsets): void {
  for (const [field, value] of Object.entries(insets)) {
    assertFiniteNumber(value, 'camera:invalid-insets', `insets.${field}`);
    if (value < 0) {
      throw new CameraContractError('camera:invalid-insets', 'Viewport insets cannot be negative.');
    }
  }
}

export class OrthographicCameraRig {
  readonly #camera: THREE.OrthographicCamera;
  readonly #config: CameraMapConfig;
  readonly #limits: CameraLimits;
  readonly #framingMarginRatio: number;
  readonly #legacyBaseOrthographicSize: number;
  #state: CameraState;
  #viewportWidth = 1;
  #viewportHeight = 1;
  #insets: ViewportInsets = ZERO_INSETS;
  #usableViewportWidth = 1;
  #usableViewportHeight = 1;
  #aspect = 1;
  #fittedOrthographicSize: number;

  constructor(
    camera: THREE.OrthographicCamera,
    config: CameraMapConfig,
    options: CameraRigOptions = {},
  ) {
    validateMapConfig(config);
    this.#camera = camera;
    this.#config = config;
    this.#limits = resolveLimits(options);

    const yawDegrees = options.yawDegrees ?? CAMERA_DEFAULTS.yawDegrees;
    const pitchDegrees = options.pitchDegrees ?? CAMERA_DEFAULTS.pitchDegrees;
    const framingMarginRatio = options.framingMarginRatio ?? CAMERA_DEFAULTS.framingMarginRatio;
    assertFiniteNumber(yawDegrees, 'camera:invalid-state', 'yawDegrees');
    assertFiniteNumber(pitchDegrees, 'camera:invalid-state', 'pitchDegrees');
    assertFiniteNumber(framingMarginRatio, 'camera:invalid-fit-request', 'framingMarginRatio');
    if (framingMarginRatio < 0) {
      throw new CameraContractError(
        'camera:invalid-fit-request',
        'Framing margin cannot be negative.',
      );
    }

    this.#framingMarginRatio = framingMarginRatio;
    this.#legacyBaseOrthographicSize = clamp(
      (Math.max(config.mapWidth, config.mapHeight) * config.cellSize) / 2,
      this.#limits.minimumOrthographicSize,
      this.#limits.maximumOrthographicSize,
    );
    this.#fittedOrthographicSize = this.#legacyBaseOrthographicSize;
    this.#state = {
      targetX: 0,
      targetZ: 0,
      yawDegrees: normalizeYawDegrees(yawDegrees),
      pitchDegrees: clamp(
        pitchDegrees,
        this.#limits.minimumPitchDegrees,
        this.#limits.maximumPitchDegrees,
      ),
      orthographicSize: this.#legacyBaseOrthographicSize,
    };
    this.#apply();
  }

  get state(): CameraState & LegacyCameraState {
    const quarterTurns = Math.round((this.#state.yawDegrees - CAMERA_DEFAULTS.yawDegrees) / 90);
    return {
      ...this.#state,
      yawQuarterTurns: (((quarterTurns % 4) + 4) % 4) as 0 | 1 | 2 | 3,
      zoom: this.#legacyBaseOrthographicSize / this.#state.orthographicSize,
    };
  }

  get fittedOrthographicSize(): number {
    return this.#fittedOrthographicSize;
  }

  get usableViewportWidth(): number {
    return this.#usableViewportWidth;
  }

  get usableViewportHeight(): number {
    return this.#usableViewportHeight;
  }

  setViewport(width: number, height: number, insets: ViewportInsets): void {
    assertFiniteNumber(width, 'camera:invalid-viewport', 'width');
    assertFiniteNumber(height, 'camera:invalid-viewport', 'height');
    validateInsets(insets);
    if (width <= 0 || height <= 0) {
      throw new CameraContractError(
        'camera:invalid-viewport',
        'Viewport dimensions must be positive.',
      );
    }

    const usableWidth = width - insets.left - insets.right;
    const usableHeight = height - insets.top - insets.bottom;
    if (usableWidth <= 0 || usableHeight <= 0) {
      throw new CameraContractError(
        'camera:invalid-usable-viewport',
        'Viewport insets consume the usable viewport.',
      );
    }

    this.#viewportWidth = width;
    this.#viewportHeight = height;
    this.#insets = { ...insets };
    this.#usableViewportWidth = usableWidth;
    this.#usableViewportHeight = usableHeight;
    this.#aspect = usableWidth / usableHeight;
    this.#apply();
  }

  fitToWorld(bounds: WorldVerticalBounds): void {
    this.#setFit(bounds, true);
  }

  resizePreservingRelativeZoom(
    width: number,
    height: number,
    insets: ViewportInsets,
    bounds: WorldVerticalBounds,
  ): void {
    const relativeZoom = this.#state.orthographicSize / this.#fittedOrthographicSize;
    this.setViewport(width, height, insets);
    this.#setFit(bounds, false);
    this.#state = {
      ...this.#state,
      orthographicSize: clamp(
        this.#fittedOrthographicSize * relativeZoom,
        this.#limits.minimumOrthographicSize,
        this.#limits.maximumOrthographicSize,
      ),
    };
    this.#apply();
  }

  resetToFit(bounds: WorldVerticalBounds): void {
    this.#state = {
      ...this.#state,
      targetX: 0,
      targetZ: 0,
      yawDegrees: CAMERA_DEFAULTS.yawDegrees,
      pitchDegrees: CAMERA_DEFAULTS.pitchDegrees,
    };
    this.#setFit(bounds, true);
  }

  setOrthographicSize(size: number): void {
    assertFiniteNumber(size, 'camera:invalid-state', 'orthographicSize');
    this.#state = {
      ...this.#state,
      orthographicSize: clamp(
        size,
        this.#limits.minimumOrthographicSize,
        this.#limits.maximumOrthographicSize,
      ),
    };
    this.#apply();
  }

  setYawDegrees(yawDegrees: number): void {
    this.#state = { ...this.#state, yawDegrees: normalizeYawDegrees(yawDegrees) };
    this.#apply();
  }

  setPitchDegrees(pitchDegrees: number): void {
    assertFiniteNumber(pitchDegrees, 'camera:invalid-state', 'pitchDegrees');
    this.#state = {
      ...this.#state,
      pitchDegrees: clamp(
        pitchDegrees,
        this.#limits.minimumPitchDegrees,
        this.#limits.maximumPitchDegrees,
      ),
    };
    this.#apply();
  }

  rotateRight(): void {
    this.setYawDegrees(this.#state.yawDegrees + 90);
  }

  rotateLeft(): void {
    this.setYawDegrees(this.#state.yawDegrees - 90);
  }

  panWorld(deltaX: number, deltaZ: number): void {
    assertFiniteNumber(deltaX, 'camera:invalid-state', 'deltaX');
    assertFiniteNumber(deltaZ, 'camera:invalid-state', 'deltaZ');
    const halfWidth = (this.#config.mapWidth * this.#config.cellSize) / 2;
    const halfHeight = (this.#config.mapHeight * this.#config.cellSize) / 2;
    this.#state = {
      ...this.#state,
      targetX: clamp(this.#state.targetX + deltaX, -halfWidth, halfWidth),
      targetZ: clamp(this.#state.targetZ + deltaZ, -halfHeight, halfHeight),
    };
    this.#apply();
  }

  focus(targetX: number, targetZ: number): void {
    this.panWorld(targetX - this.#state.targetX, targetZ - this.#state.targetZ);
  }

  // Compatibility wrappers retained until the product shell is migrated in Task 6.
  setZoom(zoom: number): void {
    assertFiniteNumber(zoom, 'camera:invalid-state', 'zoom');
    if (zoom <= 0) {
      throw new CameraContractError('camera:invalid-state', 'zoom must be positive.');
    }
    this.setOrthographicSize(this.#legacyBaseOrthographicSize / zoom);
  }

  pan(deltaX: number, deltaZ: number): void {
    this.panWorld(deltaX, deltaZ);
  }

  reset(): void {
    this.#state = {
      targetX: 0,
      targetZ: 0,
      yawDegrees: CAMERA_DEFAULTS.yawDegrees,
      pitchDegrees: CAMERA_DEFAULTS.pitchDegrees,
      orthographicSize: this.#fittedOrthographicSize,
    };
    this.#apply();
  }

  resize(width: number, height: number): void {
    this.setViewport(width, height, ZERO_INSETS);
  }

  #setFit(bounds: WorldVerticalBounds, applySize: boolean): void {
    const fit = calculateFittedOrthographicSize({
      viewportWidth: this.#viewportWidth,
      viewportHeight: this.#viewportHeight,
      insets: this.#insets,
      targetX: this.#state.targetX,
      targetZ: this.#state.targetZ,
      yawDegrees: this.#state.yawDegrees,
      pitchDegrees: this.#state.pitchDegrees,
      worldHalfWidth: (this.#config.mapWidth * this.#config.cellSize) / 2,
      worldHalfHeight: (this.#config.mapHeight * this.#config.cellSize) / 2,
      minimumWorldY: bounds.minimumWorldY,
      maximumWorldY: bounds.maximumWorldY,
      marginRatio: this.#framingMarginRatio,
    });

    this.#fittedOrthographicSize = clamp(
      fit.orthographicSize,
      this.#limits.minimumOrthographicSize,
      this.#limits.maximumOrthographicSize,
    );
    if (applySize) {
      this.#state = { ...this.#state, orthographicSize: this.#fittedOrthographicSize };
    }
    this.#apply();
  }

  #apply(): void {
    const halfHeight = this.#state.orthographicSize;
    const halfWidth = halfHeight * this.#aspect;
    this.#camera.left = -halfWidth;
    this.#camera.right = halfWidth;
    this.#camera.top = halfHeight;
    this.#camera.bottom = -halfHeight;
    this.#camera.near = 0.1;
    this.#camera.far = 1_000;
    this.#camera.updateProjectionMatrix();

    const pitch = THREE.MathUtils.degToRad(this.#state.pitchDegrees);
    const yaw = THREE.MathUtils.degToRad(this.#state.yawDegrees);
    const distance = Math.max(this.#config.mapWidth, this.#config.mapHeight) * 1.5;
    const horizontal = Math.cos(pitch) * distance;
    this.#camera.position.set(
      this.#state.targetX + Math.sin(yaw) * horizontal,
      Math.sin(pitch) * distance,
      this.#state.targetZ + Math.cos(yaw) * horizontal,
    );
    this.#camera.up.set(0, 1, 0);
    this.#camera.lookAt(this.#state.targetX, 0, this.#state.targetZ);
    this.#camera.updateMatrixWorld(true);
  }
}
