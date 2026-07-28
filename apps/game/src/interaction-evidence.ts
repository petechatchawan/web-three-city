import {
  CAMERA_DEFAULTS,
  type CameraState,
  type OrthographicCameraRig,
} from '@web-three-city/camera-input';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import type { GameInput, GameRenderViewport } from './game-input.js';

export interface InteractionEvidence {
  readonly camera: CameraState;
  readonly selectedCell: CellCoord | null;
  readonly gridVisible: boolean;
  readonly activePointerCount: number;
  readonly allWorldCornersInsideUsableViewport: boolean;
  readonly framingMarginRatio: number;
  readonly sceneRootCounts: {
    readonly terrain: number;
    readonly grid: number;
    readonly selection: number;
  };
}

export interface InteractionEvidenceSource {
  readonly camera: THREE.OrthographicCamera;
  readonly cameraRig: OrthographicCameraRig;
  readonly config: WorldConfig;
  readonly scene: THREE.Scene;
  readonly input: GameInput;
  getViewport(): GameRenderViewport;
  getSelectedCell(): CellCoord | null;
  getGridVisible(): boolean;
}

declare global {
  interface Window {
    __WEB_THREE_CITY_INTERACTION__?: InteractionEvidence;
  }
}

function worldCorners(config: WorldConfig): readonly THREE.Vector3[] {
  const halfWidth = (config.mapWidth * config.cellSize) / 2;
  const halfHeight = (config.mapHeight * config.cellSize) / 2;
  const maximumY = config.maxHeightLevel * config.heightStep;
  const corners: THREE.Vector3[] = [];
  for (const y of [config.dioramaBaseY, maximumY]) {
    for (const x of [-halfWidth, halfWidth]) {
      for (const z of [-halfHeight, halfHeight]) corners.push(new THREE.Vector3(x, y, z));
    }
  }
  return corners;
}

function allCornersInside(
  camera: THREE.OrthographicCamera,
  config: WorldConfig,
  viewport: GameRenderViewport,
): boolean {
  camera.updateMatrixWorld(true);
  return worldCorners(config).every((corner) => {
    const projected = corner.project(camera);
    const x = viewport.left + ((projected.x + 1) / 2) * viewport.width;
    const y = viewport.top + (1 - (projected.y + 1) / 2) * viewport.height;
    return (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= viewport.left - 1e-4 &&
      x <= viewport.left + viewport.width + 1e-4 &&
      y >= viewport.top - 1e-4 &&
      y <= viewport.top + viewport.height + 1e-4
    );
  });
}

function countRoots(scene: THREE.Scene, name: string): number {
  return scene.children.filter((child) => child.name === name).length;
}

export function publishInteractionEvidence(source: InteractionEvidenceSource): void {
  const evidence: InteractionEvidence = {
    get camera(): CameraState {
      return source.cameraRig.state;
    },
    get selectedCell(): CellCoord | null {
      const cell = source.getSelectedCell();
      return cell === null ? null : { ...cell };
    },
    get gridVisible(): boolean {
      return source.getGridVisible();
    },
    get activePointerCount(): number {
      return source.input.activePointerCount;
    },
    get allWorldCornersInsideUsableViewport(): boolean {
      return allCornersInside(source.camera, source.config, source.getViewport());
    },
    framingMarginRatio: CAMERA_DEFAULTS.framingMarginRatio,
    get sceneRootCounts() {
      return {
        terrain: countRoots(source.scene, 'terrain-presentation-root'),
        grid: countRoots(source.scene, 'terrain-grid-presentation-root'),
        selection: countRoots(source.scene, 'selected-cell-presentation-root'),
      };
    },
  };
  window.__WEB_THREE_CITY_INTERACTION__ = evidence;
}
