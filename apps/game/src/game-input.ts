import {
  CameraInteractionController,
  bindWorldInput,
  pickTerrain,
  type OrthographicCameraRig,
  type ScreenPoint,
  type TerrainAnchorResolver,
  type WorldInputBinding,
} from '@web-three-city/camera-input';
import { allChunkCoords } from '@web-three-city/terrain-core';
import type { TerrainPresentation } from '@web-three-city/terrain-three';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';

export interface GameRenderViewport {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
}

export interface GameInput {
  readonly controller: CameraInteractionController;
  readonly activePointerCount: number;
  setViewport(viewport: GameRenderViewport): void;
  refreshTerrainObjects(): void;
  clearActiveSession(): void;
  dispose(): void;
}

export interface CreateGameInputOptions {
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.OrthographicCamera;
  readonly cameraRig: OrthographicCameraRig;
  readonly terrain: TerrainPresentation;
  readonly config: WorldConfig;
  readonly onSelection: (cell: CellCoord | null) => void;
  readonly onReset: () => void;
}

export function createGameInput(options: CreateGameInputOptions): GameInput {
  const raycaster = new THREE.Raycaster();
  let terrainObjects: readonly THREE.Object3D[] = [];
  let viewport: GameRenderViewport = {
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    canvasWidth: 1,
    canvasHeight: 1,
  };

  const refreshTerrainObjects = (): void => {
    terrainObjects = allChunkCoords(options.config).map((chunk) => options.terrain.getChunkMesh(chunk));
  };

  const pick = (point: ScreenPoint) => {
    if (
      point.x < viewport.left ||
      point.y < viewport.top ||
      point.x >= viewport.left + viewport.width ||
      point.y >= viewport.top + viewport.height
    ) {
      return null;
    }
    return pickTerrain({
      raycaster,
      camera: options.camera,
      ndc: {
        x: ((point.x - viewport.left) / viewport.width) * 2 - 1,
        y: -((point.y - viewport.top) / viewport.height) * 2 + 1,
      },
      objects: terrainObjects,
      config: options.config,
    });
  };

  const resolver: TerrainAnchorResolver = { pick };
  const controller = new CameraInteractionController(options.cameraRig, resolver);
  let binding: WorldInputBinding | null = bindWorldInput({
    canvas: options.canvas,
    keyboardTarget: window,
    camera: controller,
    onEligibleTap: (point) => {
      const result = pick(point);
      options.onSelection(result === null ? null : { x: result.cellX, z: result.cellZ });
    },
    onReset: options.onReset,
  });

  refreshTerrainObjects();

  return {
    controller,
    get activePointerCount(): number {
      return binding?.activePointerCount ?? 0;
    },
    setViewport(value: GameRenderViewport): void {
      viewport = { ...value };
    },
    refreshTerrainObjects,
    clearActiveSession(): void {
      binding?.clearActiveSession();
    },
    dispose(): void {
      binding?.dispose();
      binding = null;
      terrainObjects = [];
    },
  };
}
