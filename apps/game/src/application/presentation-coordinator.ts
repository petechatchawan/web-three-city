import type { CommittedWorld } from './committed-world.js';
import type { WorldPresentationPort } from './world-transaction-coordinator.js';

export interface PresentationCoordinatorDependencies {
  readonly setReplacingWorld: (value: boolean) => void;
  readonly loadTerrain: (world: CommittedWorld) => void;
  readonly loadWater: (world: CommittedWorld) => void;
  readonly loadGrid: (world: CommittedWorld) => void;
  readonly loadRoads: (world: CommittedWorld) => void;
  readonly loadZones: (world: CommittedWorld) => void;
  readonly loadBuildings: (world: CommittedWorld) => void;
  readonly rebuildSelection: (world: CommittedWorld) => void;
  readonly refreshTerrainObjects: (world: CommittedWorld) => void;
}

export class PresentationCoordinator {
  readonly #dependencies: PresentationCoordinatorDependencies;
  readonly completeWorld: WorldPresentationPort;
  readonly noOp: WorldPresentationPort;

  constructor(dependencies: PresentationCoordinatorDependencies) {
    this.#dependencies = dependencies;
    this.completeWorld = Object.freeze({
      synchronize: (world: CommittedWorld) => this.synchronizeCompleteWorld(world),
      rebuildFromCommitted: (world: CommittedWorld) => this.synchronizeCompleteWorld(world),
    });
    this.noOp = Object.freeze({
      synchronize: () => {},
      rebuildFromCommitted: (world: CommittedWorld) => this.synchronizeCompleteWorld(world),
    });
  }

  incremental(synchronize: (world: CommittedWorld) => void): WorldPresentationPort {
    return Object.freeze({
      synchronize,
      rebuildFromCommitted: (world: CommittedWorld) => this.synchronizeCompleteWorld(world),
    });
  }

  rebuildCommittedWorld(world: CommittedWorld): void {
    this.synchronizeCompleteWorld(world);
  }

  private synchronizeCompleteWorld(world: CommittedWorld): void {
    this.#dependencies.setReplacingWorld(true);
    try {
      this.#dependencies.loadTerrain(world);
      this.#dependencies.loadWater(world);
      this.#dependencies.loadGrid(world);
      this.#dependencies.loadRoads(world);
      this.#dependencies.loadZones(world);
      this.#dependencies.loadBuildings(world);
      this.#dependencies.rebuildSelection(world);
      this.#dependencies.refreshTerrainObjects(world);
    } finally {
      this.#dependencies.setReplacingWorld(false);
    }
  }
}
