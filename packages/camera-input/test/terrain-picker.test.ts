import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { pickTerrain } from '../src/terrain-picker.js';

const CONFIG = {
  mapWidth: 1,
  mapHeight: 1,
  chunkSize: 1,
  cellSize: 1,
  heightStep: 0.5,
  minHeightLevel: 0,
  maxHeightLevel: 4,
  seaLevel: 1,
  dioramaBaseY: -1.5,
};

function mesh(indices: readonly number[]): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5],
      3,
    ),
  );
  geometry.setIndex(indices);
  const terrain = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  terrain.name = 'arbitrary-presentation-name';
  terrain.updateMatrixWorld(true);
  return terrain;
}

function camera(): THREE.OrthographicCamera {
  const result = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  result.position.set(0, 10, 0);
  result.up.set(0, 0, -1);
  result.lookAt(0, 0, 0);
  result.updateProjectionMatrix();
  result.updateMatrixWorld(true);
  return result;
}

describe('terrain picking', () => {
  it.each([
    [2, 3, 1, 2, 1, 0],
    [2, 3, 0, 3, 1, 0],
  ])('derives the same cell from world coordinates for legal topology %o', (...indices) => {
    const result = pickTerrain({
      raycaster: new THREE.Raycaster(),
      camera: camera(),
      ndc: { x: 0.25, y: 0.25 },
      objects: [mesh(indices)],
      config: CONFIG,
    });

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      cellX: 0,
      cellZ: 0,
      nearestVertexX: 1,
      nearestVertexZ: 0,
    });
    expect(result?.localU).toBeCloseTo(0.75);
    expect(result?.localV).toBeCloseTo(0.25);
  });
});
