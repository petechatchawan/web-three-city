import * as THREE from 'three';

export interface BuildingMaterials {
  readonly residential: THREE.MeshLambertMaterial;
  readonly commercial: THREE.MeshLambertMaterial;
  readonly industrial: THREE.MeshLambertMaterial;
  readonly roof: THREE.MeshLambertMaterial;
  readonly accent: THREE.MeshLambertMaterial;
  dispose(): void;
}

export function createBuildingMaterials(): BuildingMaterials {
  const materials = {
    residential: new THREE.MeshLambertMaterial({ color: 0xe9c98f }),
    commercial: new THREE.MeshLambertMaterial({ color: 0x8db6d9 }),
    industrial: new THREE.MeshLambertMaterial({ color: 0xb2a58c }),
    roof: new THREE.MeshLambertMaterial({ color: 0x9e5f4b }),
    accent: new THREE.MeshLambertMaterial({ color: 0x40566b }),
  };
  return Object.freeze({
    ...materials,
    dispose(): void {
      for (const material of Object.values(materials)) material.dispose();
    },
  });
}
