import * as THREE from 'three';

export interface RoadMaterials {
  readonly committed: THREE.MeshStandardMaterial;
  readonly buildValidPreview: THREE.MeshStandardMaterial;
  readonly buildInvalidPreview: THREE.MeshStandardMaterial;
  readonly bulldozeValidPreview: THREE.MeshStandardMaterial;
  readonly bulldozeInvalidPreview: THREE.MeshStandardMaterial;
  readonly invalidMarker: THREE.LineBasicMaterial;
  readonly bulldozeMarker: THREE.LineBasicMaterial;
}

function previewMaterial(name: string, color: number, opacity: number): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });
  material.name = name;
  return material;
}

export function createRoadMaterials(): RoadMaterials {
  const committed = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  committed.name = 'road-material-committed';

  const buildValidPreview = previewMaterial('road-material-preview-build-valid', 0x37d67a, 0.78);
  const buildInvalidPreview = previewMaterial('road-material-preview-build-invalid', 0xef4d4d, 0.8);
  const bulldozeValidPreview = previewMaterial(
    'road-material-preview-bulldoze-valid',
    0xff7043,
    0.82,
  );
  const bulldozeInvalidPreview = previewMaterial(
    'road-material-preview-bulldoze-invalid',
    0xb71c1c,
    0.84,
  );

  const invalidMarker = new THREE.LineBasicMaterial({
    color: 0x7d1111,
    transparent: true,
    opacity: 0.96,
    depthTest: true,
    depthWrite: false,
  });
  invalidMarker.name = 'road-material-preview-build-invalid-marker';

  const bulldozeMarker = new THREE.LineBasicMaterial({
    color: 0x7a1f0e,
    transparent: true,
    opacity: 1,
    depthTest: true,
    depthWrite: false,
  });
  bulldozeMarker.name = 'road-material-preview-bulldoze-marker';

  return Object.freeze({
    committed,
    buildValidPreview,
    buildInvalidPreview,
    bulldozeValidPreview,
    bulldozeInvalidPreview,
    invalidMarker,
    bulldozeMarker,
  });
}
