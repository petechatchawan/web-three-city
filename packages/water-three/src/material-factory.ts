import * as THREE from 'three';

export interface WaterMaterials {
  readonly surface: THREE.MeshBasicMaterial;
  readonly shoreline: THREE.MeshBasicMaterial;
  readonly wall: THREE.MeshBasicMaterial;
}

export function createWaterMaterials(): WaterMaterials {
  return {
    surface: new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.78,
      depthTest: true,
      depthWrite: false,
      vertexColors: true,
      side: THREE.DoubleSide,
    }),
    shoreline: new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.82,
      depthTest: true,
      depthWrite: false,
      vertexColors: true,
      side: THREE.DoubleSide,
    }),
    wall: new THREE.MeshBasicMaterial({
      transparent: false,
      depthTest: true,
      depthWrite: true,
      vertexColors: true,
      side: THREE.DoubleSide,
    }),
  };
}
