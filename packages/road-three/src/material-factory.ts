import * as THREE from 'three';

export interface RoadMaterials {
  readonly committed: THREE.MeshStandardMaterial;
  readonly validPreview: THREE.MeshStandardMaterial;
  readonly invalidPreview: THREE.MeshStandardMaterial;
}

export function createRoadMaterials(): RoadMaterials {
  const committed = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  committed.name = 'road-material-committed';

  const validPreview = new THREE.MeshStandardMaterial({
    color: 0x56d681,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  validPreview.name = 'road-material-preview-valid';

  const invalidPreview = new THREE.MeshStandardMaterial({
    color: 0xef5b5b,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  invalidPreview.name = 'road-material-preview-invalid';

  return Object.freeze({ committed, validPreview, invalidPreview });
}
