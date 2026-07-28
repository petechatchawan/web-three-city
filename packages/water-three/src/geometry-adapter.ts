import type { WaterChunkMeshData, WaterWallMeshData } from '@web-three-city/water-core';
import * as THREE from 'three';

function assertIndexedGeometry(
  positions: Float32Array,
  colors: Float32Array,
  indices: Uint16Array,
  code: string,
  normals?: Float32Array,
): void {
  if (
    positions.length % 3 !== 0 ||
    colors.length !== positions.length ||
    (normals !== undefined && normals.length !== positions.length)
  ) {
    throw new Error(code);
  }
  const vertexCount = positions.length / 3;
  for (const index of indices) {
    if (index >= vertexCount) throw new Error(code);
  }
}

function finalize(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createWaterSurfaceGeometry(data: WaterChunkMeshData): THREE.BufferGeometry {
  assertIndexedGeometry(
    data.surfacePositions,
    data.surfaceColors,
    data.surfaceIndices,
    'water-three:invalid-surface-attributes',
    data.surfaceNormals,
  );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.surfacePositions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.surfaceNormals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.surfaceColors, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.surfaceIndices, 1));
  return finalize(geometry);
}

export function createWaterShorelineGeometry(data: WaterChunkMeshData): THREE.BufferGeometry {
  assertIndexedGeometry(
    data.shorelinePositions,
    data.shorelineColors,
    data.shorelineIndices,
    'water-three:invalid-shoreline-attributes',
  );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.shorelinePositions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.shorelineColors, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.shorelineIndices, 1));
  return finalize(geometry);
}

export function createWaterWallGeometry(data: WaterWallMeshData): THREE.BufferGeometry {
  assertIndexedGeometry(
    data.positions,
    data.colors,
    data.indices,
    'water-three:invalid-wall-attributes',
    data.normals,
  );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  return finalize(geometry);
}
