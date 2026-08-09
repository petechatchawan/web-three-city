import * as THREE from 'three';

export interface ZoneMaterials {
  readonly committed: readonly [
    THREE.MeshBasicMaterial,
    THREE.MeshBasicMaterial,
    THREE.MeshBasicMaterial,
  ];
  readonly paintValidPreview: THREE.MeshBasicMaterial;
  readonly paintInvalidPreview: THREE.MeshBasicMaterial;
  readonly removeValidPreview: THREE.MeshBasicMaterial;
  readonly removeInvalidPreview: THREE.MeshBasicMaterial;
  readonly invalidMarker: THREE.LineBasicMaterial;
}

function overlayMaterial(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export function createZoneMaterials(): ZoneMaterials {
  const committed: ZoneMaterials['committed'] = Object.freeze([
    overlayMaterial(0x16a34a, 0.48),
    overlayMaterial(0x2563eb, 0.48),
    overlayMaterial(0xd97706, 0.48),
  ]);
  return Object.freeze({
    committed,
    paintValidPreview: overlayMaterial(0x22c55e, 0.7),
    paintInvalidPreview: overlayMaterial(0xf87171, 0.65),
    removeValidPreview: overlayMaterial(0xfb923c, 0.65),
    removeInvalidPreview: overlayMaterial(0xef4444, 0.65),
    invalidMarker: new THREE.LineBasicMaterial({ color: 0xef4444, depthTest: false }),
  });
}

export function disposeZoneMaterials(materials: ZoneMaterials): void {
  for (const material of materials.committed) material.dispose();
  materials.paintValidPreview.dispose();
  materials.paintInvalidPreview.dispose();
  materials.removeValidPreview.dispose();
  materials.removeInvalidPreview.dispose();
  materials.invalidMarker.dispose();
}
