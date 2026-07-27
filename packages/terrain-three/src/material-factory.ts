import * as THREE from 'three';

export interface TerrainMaterials {
  readonly terrain: THREE.MeshStandardMaterial;
  readonly skirt: THREE.MeshStandardMaterial;
}

export function createTerrainMaterials(): TerrainMaterials {
  return {
    terrain: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0,
    }),
    skirt: new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
    }),
  };
}
