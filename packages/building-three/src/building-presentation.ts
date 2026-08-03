import {
  buildingDefinitionForId,
  occupiedCellsForBuilding,
  rotatedBuildingFootprint,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import { createBuildingMaterials, type BuildingMaterials } from './material-factory.js';
import { createBuildingPrototype } from './prototype-factory.js';

export type BuildingElevationResolver = (cell: CellCoord) => number;

export class BuildingPresentation {
  readonly #scene: THREE.Scene;
  readonly #config: WorldConfig;
  readonly #elevationAt: BuildingElevationResolver;
  readonly #materials: BuildingMaterials;
  readonly #root = new THREE.Group();
  #disposed = false;

  constructor(scene: THREE.Scene, elevationAt: BuildingElevationResolver, config: WorldConfig) {
    this.#scene = scene;
    this.#elevationAt = elevationAt;
    this.#config = config;
    this.#materials = createBuildingMaterials();
    this.#root.name = 'building-committed-root';
    scene.add(this.#root);
  }

  get root(): THREE.Group {
    return this.#root;
  }

  clear(): void {
    for (const child of [...this.#root.children]) {
      child.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      this.#root.remove(child);
    }
  }

  load(snapshot: BuildingSnapshot): void {
    if (this.#disposed) throw new Error('building-presentation:disposed');
    this.clear();
    for (const instance of snapshot.instances) {
      const definition = buildingDefinitionForId(instance.buildingDefinitionId);
      const footprint = rotatedBuildingFootprint(definition, instance.rotationQuarterTurns);
      const occupied = occupiedCellsForBuilding(instance);
      const elevation = Math.max(...occupied.map((cell) => this.#elevationAt(cell)));
      const group = createBuildingPrototype(instance, this.#materials, this.#config);
      group.position.set(
        (instance.originCell.x + footprint.width / 2) * this.#config.cellSize -
          (this.#config.mapWidth * this.#config.cellSize) / 2,
        elevation,
        (instance.originCell.z + footprint.depth / 2) * this.#config.cellSize -
          (this.#config.mapHeight * this.#config.cellSize) / 2,
      );
      group.rotation.y = -instance.rotationQuarterTurns * (Math.PI / 2);
      this.#root.add(group);
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.clear();
    this.#materials.dispose();
    this.#scene.remove(this.#root);
  }
}
