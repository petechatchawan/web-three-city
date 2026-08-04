import {
  buildingDefinitionForId,
  constructionProgressAtTick,
  occupiedCellsForBuilding,
  rotatedBuildingFootprint,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import * as THREE from 'three';
import {
  constructionVisualPhase,
  createConstructionPrototype,
} from './construction-prototype-factory.js';
import { createBuildingMaterials, type BuildingMaterials } from './material-factory.js';
import { createBuildingPrototype } from './prototype-factory.js';

export type BuildingElevationResolver = (cell: CellCoord) => number;

let defaultAbsoluteTick = 8;
let latestSnapshot: BuildingSnapshot | null = null;
let latestPresentation: BuildingPresentation | null = null;

export function setBuildingPresentationAbsoluteTick(absoluteTick: number): void {
  if (!Number.isSafeInteger(absoluteTick) || absoluteTick < 0) {
    throw new RangeError('building-presentation:invalid-tick');
  }
  defaultAbsoluteTick = absoluteTick;
}

export function latestPresentedBuildingSnapshot(): BuildingSnapshot | null {
  return latestSnapshot;
}

export function reloadLatestBuildingPresentation(): void {
  if (latestPresentation !== null && latestSnapshot !== null) {
    latestPresentation.load(latestSnapshot, defaultAbsoluteTick);
  }
}

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
    latestPresentation = this;
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

  load(snapshot: BuildingSnapshot, absoluteTick = defaultAbsoluteTick): void {
    if (this.#disposed) throw new Error('building-presentation:disposed');
    latestSnapshot = snapshot;
    this.clear();
    for (const instance of snapshot.instances) {
      const definition = buildingDefinitionForId(instance.buildingDefinitionId);
      const footprint = rotatedBuildingFootprint(definition, instance.rotationQuarterTurns);
      const occupied = occupiedCellsForBuilding(instance);
      const first = occupied[0];
      if (first === undefined) throw new Error('building-presentation:empty-footprint');
      const elevation = occupied
        .slice(1)
        .reduce(
          (maximum, cell) => Math.max(maximum, this.#elevationAt(cell)),
          this.#elevationAt(first),
        );
      const group =
        instance.lifecycle === 'construction'
          ? createConstructionPrototype({
              footprintWidth: definition.footprintWidth,
              footprintDepth: definition.footprintDepth,
              prototypeHeight: definition.prototypeHeight,
              phase: constructionVisualPhase(
                constructionProgressAtTick(instance, absoluteTick),
              ),
              materials: this.#materials,
            })
          : createBuildingPrototype(instance, this.#materials, this.#config);
      group.userData.instanceId = instance.instanceId;
      group.userData.lifecycle = instance.lifecycle;
      if (instance.lifecycle === 'construction') {
        group.userData.constructionPhase = constructionVisualPhase(
          constructionProgressAtTick(instance, absoluteTick),
        );
        group.scale.setScalar(this.#config.cellSize);
      }
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
    if (latestPresentation === this) latestPresentation = null;
    latestSnapshot = null;
  }
}
