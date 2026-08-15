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
    residential: new THREE.MeshLambertMaterial({ color: 0xf0c060 }),
    commercial: new THREE.MeshLambertMaterial({ color: 0x5b9bd4 }),
    industrial: new THREE.MeshLambertMaterial({ color: 0x8b93a3 }),
    roof: new THREE.MeshLambertMaterial({ color: 0xb5563e }),
    accent: new THREE.MeshLambertMaterial({ color: 0x3d5874 }),
  };
  return Object.freeze({
    ...materials,
    dispose(): void {
      for (const material of Object.values(materials)) material.dispose();
    },
  });
}
