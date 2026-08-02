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
  return Object.freeze({
    committed: Object.freeze([
      overlayMaterial(0x55c878, 0.48),
      overlayMaterial(0x4d8fe8, 0.48),
      overlayMaterial(0xe4c34f, 0.48),
    ]),
    paintValidPreview: overlayMaterial(0x64e58d, 0.7),
    paintInvalidPreview: overlayMaterial(0xef5b5b, 0.65),
    removeValidPreview: overlayMaterial(0xe98655, 0.65),
    removeInvalidPreview: overlayMaterial(0xb94b4b, 0.65),
    invalidMarker: new THREE.LineBasicMaterial({ color: 0xff3232, depthTest: false }),
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
