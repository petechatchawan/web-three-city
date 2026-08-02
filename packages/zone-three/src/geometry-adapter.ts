import * as THREE from 'three';
import type { ZoneMeshData } from './zone-mesh-data.js';

export function createZoneGeometry(
  data: ZoneMeshData,
  preserveMaterialGroups = true,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  geometry.clearGroups();
  if (preserveMaterialGroups) {
    for (const group of data.groups) {
      geometry.addGroup(group.start, group.count, group.materialIndex);
    }
  } else if (data.indices.length > 0) {
    geometry.addGroup(0, data.indices.length, 0);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
