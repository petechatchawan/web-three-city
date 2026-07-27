import * as THREE from 'three';

export interface CameraMapConfig {
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly cellSize: number;
}

export interface CameraState {
  readonly targetX: number;
  readonly targetZ: number;
  readonly yawQuarterTurns: 0 | 1 | 2 | 3;
  readonly pitchDegrees: 55;
  readonly zoom: number;
}

const INITIAL_STATE: CameraState = {
  targetX: 0,
  targetZ: 0,
  yawQuarterTurns: 0,
  pitchDegrees: 55,
  zoom: 1,
};

export class OrthographicCameraRig {
  readonly #camera: THREE.OrthographicCamera;
  readonly #config: CameraMapConfig;
  #state: CameraState = INITIAL_STATE;
  #aspect = 1;

  constructor(camera: THREE.OrthographicCamera, config: CameraMapConfig) {
    this.#camera = camera;
    this.#config = config;
    this.#apply();
  }

  get state(): CameraState {
    return { ...this.#state };
  }

  rotateRight(): void {
    this.#state = {
      ...this.#state,
      yawQuarterTurns: ((this.#state.yawQuarterTurns + 1) % 4) as 0 | 1 | 2 | 3,
    };
    this.#apply();
  }

  rotateLeft(): void {
    this.#state = {
      ...this.#state,
      yawQuarterTurns: ((this.#state.yawQuarterTurns + 3) % 4) as 0 | 1 | 2 | 3,
    };
    this.#apply();
  }

  setZoom(zoom: number): void {
    this.#state = { ...this.#state, zoom: Math.min(4, Math.max(0.5, zoom)) };
    this.#apply();
  }

  pan(deltaX: number, deltaZ: number): void {
    const halfWidth = (this.#config.mapWidth * this.#config.cellSize) / 2;
    const halfHeight = (this.#config.mapHeight * this.#config.cellSize) / 2;
    this.#state = {
      ...this.#state,
      targetX: Math.min(halfWidth, Math.max(-halfWidth, this.#state.targetX + deltaX)),
      targetZ: Math.min(halfHeight, Math.max(-halfHeight, this.#state.targetZ + deltaZ)),
    };
    this.#apply();
  }

  focus(targetX: number, targetZ: number): void {
    const deltaX = targetX - this.#state.targetX;
    const deltaZ = targetZ - this.#state.targetZ;
    this.pan(deltaX, deltaZ);
  }

  reset(): void {
    this.#state = INITIAL_STATE;
    this.#apply();
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) throw new RangeError('camera:invalid-viewport');
    this.#aspect = width / height;
    this.#apply();
  }

  #apply(): void {
    const verticalSpan =
      (Math.max(this.#config.mapWidth, this.#config.mapHeight) * this.#config.cellSize) /
      this.#state.zoom;
    const halfHeight = verticalSpan / 2;
    const halfWidth = halfHeight * this.#aspect;
    this.#camera.left = -halfWidth;
    this.#camera.right = halfWidth;
    this.#camera.top = halfHeight;
    this.#camera.bottom = -halfHeight;
    this.#camera.near = 0.1;
    this.#camera.far = 1_000;
    this.#camera.updateProjectionMatrix();

    const pitch = THREE.MathUtils.degToRad(this.#state.pitchDegrees);
    const yaw = THREE.MathUtils.degToRad(45 + this.#state.yawQuarterTurns * 90);
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
