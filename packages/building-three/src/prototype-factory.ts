import { buildingDefinitionForId, type BuildingInstance } from '@web-three-city/building-core';
import type { WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import type { BuildingMaterials } from './material-factory.js';

function addBox(
  group: THREE.Group,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  material: THREE.Material,
  name: string,
): void {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  group.add(mesh);
}

export function createBuildingPrototype(
  instance: BuildingInstance,
  materials: BuildingMaterials,
  config: WorldConfig,
): THREE.Group {
  const definition = buildingDefinitionForId(instance.buildingDefinitionId);
  const group = new THREE.Group();
  group.name = 'building-instance';
  group.userData.instanceId = instance.instanceId;
  group.userData.definitionId = definition.id;
  const bodyMaterial =
    definition.compatibleZoneDefinitionIds[0] === 'residential'
      ? materials.residential
      : definition.compatibleZoneDefinitionIds[0] === 'commercial'
        ? materials.commercial
        : materials.industrial;
  const h = definition.prototypeHeight;

  switch (definition.prototypeId) {
    case 'cottage':
      addBox(group, [0.72, h * 0.7, 0.72], [0, h * 0.35, 0], bodyMaterial, 'building-body');
      addBox(group, [0.82, h * 0.18, 0.82], [0, h * 0.79, 0], materials.roof, 'building-roof');
      addBox(group, [0.16, 0.28, 0.05], [0, 0.2, 0.385], materials.accent, 'building-door');
      break;
    case 'rowhouse':
      addBox(group, [0.76, h * 0.82, 1.7], [0, h * 0.41, 0], bodyMaterial, 'building-body');
      addBox(group, [0.84, h * 0.12, 1.78], [0, h * 0.88, 0], materials.roof, 'building-roof');
      addBox(group, [0.18, 0.34, 0.05], [0, 0.22, 0.875], materials.accent, 'building-door');
      break;
    case 'duplex':
      addBox(
        group,
        [0.78, h * 0.72, 0.82],
        [-0.42, h * 0.36, 0],
        bodyMaterial,
        'building-body-left',
      );
      addBox(
        group,
        [0.78, h * 0.72, 0.82],
        [0.42, h * 0.36, 0],
        bodyMaterial,
        'building-body-right',
      );
      addBox(group, [1.72, h * 0.14, 0.92], [0, h * 0.79, 0], materials.roof, 'building-roof');
      addBox(group, [0.14, 0.3, 0.05], [-0.42, 0.2, 0.435], materials.accent, 'building-door-left');
      addBox(group, [0.14, 0.3, 0.05], [0.42, 0.2, 0.435], materials.accent, 'building-door-right');
      break;
    case 'apartment':
      addBox(group, [1.62, h, 1.62], [0, h * 0.5, 0], bodyMaterial, 'building-body');
      for (const y of [0.45, 0.95, 1.45, 1.95])
        addBox(group, [1.7, 0.05, 1.7], [0, y, 0], materials.accent, 'building-window-band');
      addBox(group, [0.34, 0.44, 0.05], [0, 0.26, 0.835], materials.accent, 'building-entrance');
      break;
    case 'shop':
      addBox(group, [0.82, h * 0.7, 0.82], [0, h * 0.35, 0], bodyMaterial, 'building-body');
      addBox(group, [0.72, 0.18, 0.05], [0, 0.34, 0.435], materials.accent, 'building-storefront');
      break;
    case 'cafe':
      addBox(group, [0.78, h * 0.7, 0.78], [0, h * 0.35, 0], bodyMaterial, 'building-body');
      addBox(group, [0.86, 0.1, 0.24], [0, 0.48, 0.46], materials.roof, 'building-canopy');
      addBox(group, [0.34, 0.16, 0.06], [0, h * 0.72, 0.42], materials.accent, 'building-sign');
      break;
    case 'market':
      addBox(group, [0.82, h * 0.72, 1.68], [0, h * 0.36, 0], bodyMaterial, 'building-body');
      addBox(group, [0.9, 0.12, 0.32], [0, 0.5, 0.9], materials.roof, 'building-canopy');
      addBox(group, [0.56, 0.34, 0.05], [0, 0.28, 0.865], materials.accent, 'building-storefront');
      break;
    case 'office':
      addBox(group, [1.65, h, 1.65], [0, h * 0.5, 0], bodyMaterial, 'building-body');
      for (const y of [0.45, 0.95, 1.45])
        addBox(group, [1.72, 0.06, 1.72], [0, y, 0], materials.accent, 'building-floor-band');
      addBox(group, [0.36, 0.46, 0.05], [0, 0.28, 0.85], materials.accent, 'building-entrance');
      break;
    case 'workshop':
      addBox(group, [0.82, h * 0.75, 1.68], [0, h * 0.375, 0], bodyMaterial, 'building-body');
      addBox(group, [0.55, 0.42, 0.05], [0, 0.3, 0.865], materials.accent, 'building-bay-door');
      break;
    case 'depot':
      addBox(group, [0.8, h * 0.68, 0.8], [0, h * 0.34, 0], bodyMaterial, 'building-body');
      addBox(group, [0.6, 0.38, 0.05], [0, 0.25, 0.425], materials.accent, 'building-loading-door');
      addBox(group, [0.9, 0.1, 0.9], [0, h * 0.72, 0], materials.roof, 'building-roof');
      break;
    case 'warehouse':
      addBox(group, [1.72, h * 0.72, 1.72], [0, h * 0.36, 0], bodyMaterial, 'building-body');
      addBox(group, [1.82, h * 0.12, 1.82], [0, h * 0.78, 0], materials.roof, 'building-roof');
      addBox(group, [0.75, 0.48, 0.05], [0, 0.32, 0.885], materials.accent, 'building-bay-door');
      break;
    case 'factory':
      addBox(group, [1.72, h * 0.68, 1.72], [0, h * 0.34, 0], bodyMaterial, 'building-body');
      for (const x of [-0.55, 0, 0.55])
        addBox(group, [0.5, 0.2, 1.78], [x, h * 0.76, 0], materials.roof, 'building-stepped-roof');
      addBox(
        group,
        [0.22, h * 0.75, 0.22],
        [0.55, h * 0.8, -0.5],
        materials.accent,
        'building-chimney',
      );
      addBox(group, [0.72, 0.46, 0.05], [0, 0.3, 0.885], materials.accent, 'building-bay-door');
      break;
  }
  group.scale.setScalar(config.cellSize);
  return group;
}
