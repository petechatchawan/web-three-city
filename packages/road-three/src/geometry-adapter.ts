import * as THREE from 'three';
import type { RoadMeshData } from './road-mesh-data.js';

function fail(code: string): never {
  throw new RangeError(`road-three:${code}`);
}

export function createRoadGeometry(data: RoadMeshData): THREE.BufferGeometry {
  if (data.positions.length % 3 !== 0 || data.positions.length === 0) fail('invalid-positions');
  if (data.normals.length !== data.positions.length) fail('invalid-normals');
  if (data.colors.length !== data.positions.length) fail('invalid-colors');
  if (data.indices.length % 3 !== 0) fail('invalid-indices');
  if (![...data.positions, ...data.normals, ...data.colors].every(Number.isFinite)) {
    fail('non-finite-attribute');
  }
  const vertexCount = data.positions.length / 3;
  for (const index of data.indices) {
    if (!Number.isInteger(index) || index < 0 || index >= vertexCount) fail('index-out-of-range');
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions.slice(), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals.slice(), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(data.colors.slice(), 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices.slice(), 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
