import type { WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';

export interface TerrainPickResult {
  readonly cellX: number;
  readonly cellZ: number;
  readonly localU: number;
  readonly localV: number;
  readonly nearestVertexX: number;
  readonly nearestVertexZ: number;
  readonly worldPoint: Readonly<{ x: number; y: number; z: number }>;
}

export interface PickTerrainInput {
  readonly raycaster: THREE.Raycaster;
  readonly camera: THREE.Camera;
  readonly ndc: Readonly<{ x: number; y: number }>;
  readonly objects: readonly THREE.Object3D[];
  readonly config: WorldConfig;
}

export function terrainPickFromWorldPoint(
  point: Readonly<{ x: number; y: number; z: number }>,
  config: WorldConfig,
): TerrainPickResult | null {
  const gridX = point.x / config.cellSize + config.mapWidth / 2;
  const gridZ = point.z / config.cellSize + config.mapHeight / 2;
  if (gridX < 0 || gridZ < 0 || gridX >= config.mapWidth || gridZ >= config.mapHeight) {
    return null;
  }

  const cellX = Math.floor(gridX);
  const cellZ = Math.floor(gridZ);
  const localU = gridX - cellX;
  const localV = gridZ - cellZ;
  return {
    cellX,
    cellZ,
    localU,
    localV,
    nearestVertexX: cellX + (localU < 0.5 ? 0 : 1),
    nearestVertexZ: cellZ + (localV < 0.5 ? 0 : 1),
    worldPoint: { x: point.x, y: point.y, z: point.z },
  };
}

export function pickTerrain(input: PickTerrainInput): TerrainPickResult | null {
  input.raycaster.setFromCamera(new THREE.Vector2(input.ndc.x, input.ndc.y), input.camera);
  const intersection = input.raycaster.intersectObjects([...input.objects], true)[0];
  return intersection === undefined
    ? null
    : terrainPickFromWorldPoint(intersection.point, input.config);
}
