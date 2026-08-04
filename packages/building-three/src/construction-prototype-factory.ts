import * as THREE from 'three';
import type { BuildingMaterials } from './material-factory.js';

export type ConstructionVisualPhase = 'foundation' | 'frame' | 'shell';

export function constructionVisualPhase(progress: number): ConstructionVisualPhase {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped <= 1 / 3) return 'foundation';
  if (clamped <= 2 / 3) return 'frame';
  return 'shell';
}

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

export function createConstructionPrototype(input: {
  readonly footprintWidth: number;
  readonly footprintDepth: number;
  readonly prototypeHeight: number;
  readonly phase: ConstructionVisualPhase;
  readonly materials: BuildingMaterials;
}): THREE.Group {
  const group = new THREE.Group();
  group.name = `building-construction-${input.phase}`;
  const width = input.footprintWidth * 0.84;
  const depth = input.footprintDepth * 0.84;
  addBox(group, [width, 0.1, depth], [0, 0.05, 0], input.materials.accent, 'construction-foundation');
  if (input.phase === 'frame' || input.phase === 'shell') {
    const halfWidth = width / 2 - 0.06;
    const halfDepth = depth / 2 - 0.06;
    for (const x of [-halfWidth, halfWidth]) {
      for (const z of [-halfDepth, halfDepth]) {
        addBox(
          group,
          [0.1, input.prototypeHeight * 0.72, 0.1],
          [x, input.prototypeHeight * 0.36, z],
          input.materials.accent,
          'construction-column',
        );
      }
    }
    addBox(group, [width, 0.1, 0.1], [0, input.prototypeHeight * 0.72, -halfDepth], input.materials.accent, 'construction-beam');
    addBox(group, [width, 0.1, 0.1], [0, input.prototypeHeight * 0.72, halfDepth], input.materials.accent, 'construction-beam');
  }
  if (input.phase === 'shell') {
    addBox(
      group,
      [width * 0.9, input.prototypeHeight * 0.56, depth * 0.9],
      [0, input.prototypeHeight * 0.3, 0],
      input.materials.industrial,
      'construction-shell',
    );
  }
  return group;
}
