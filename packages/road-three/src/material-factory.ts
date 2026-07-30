import * as THREE from 'three';

export interface RoadMaterials {
  readonly committed: THREE.MeshStandardMaterial;
  readonly validPreview: THREE.MeshStandardMaterial;
  readonly invalidPreview: THREE.MeshStandardMaterial;
  readonly invalidMarker: THREE.LineBasicMaterial;
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
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  validPreview.name = 'road-material-preview-valid';

  const invalidPreview = new THREE.MeshStandardMaterial({
    color: 0xef5b5b,
    transparent: true,
    opacity: 0.76,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  invalidPreview.name = 'road-material-preview-invalid';

  const invalidMarker = new THREE.LineBasicMaterial({
    color: 0x7d1111,
    transparent: true,
    opacity: 0.96,
    depthTest: true,
    depthWrite: false,
  });
  invalidMarker.name = 'road-material-preview-invalid-marker';

  return Object.freeze({ committed, validPreview, invalidPreview, invalidMarker });
}
