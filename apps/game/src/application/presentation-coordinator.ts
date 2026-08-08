import type { CommittedWorld } from './committed-world.js';
import type { WorldPresentationPort } from './world-transaction-coordinator.js';

export type CommittedWorldPresentationStep = (world: CommittedWorld) => void;

export interface PresentationCoordinatorOptions {
  readonly steps: readonly CommittedWorldPresentationStep[];
  readonly beforeSynchronize?: () => void;
  readonly afterSynchronize?: () => void;
}

export class PresentationCoordinator {
  readonly #steps: readonly CommittedWorldPresentationStep[];
  readonly #beforeSynchronize: () => void;
  readonly #afterSynchronize: () => void;

  constructor(options: PresentationCoordinatorOptions) {
    this.#steps = Object.freeze([...options.steps]);
    this.#beforeSynchronize = options.beforeSynchronize ?? (() => {});
    this.#afterSynchronize = options.afterSynchronize ?? (() => {});
  }

  synchronizeCommittedWorld(world: CommittedWorld): void {
    this.#beforeSynchronize();
    try {
      for (const step of this.#steps) step(world);
    } finally {
      this.#afterSynchronize();
    }
  }

  rebuildFromCommitted(world: CommittedWorld): void {
    this.synchronizeCommittedWorld(world);
  }

  completePort(): WorldPresentationPort {
    return Object.freeze({
      synchronize: (world: CommittedWorld) => this.synchronizeCommittedWorld(world),
      rebuildFromCommitted: (world: CommittedWorld) => this.rebuildFromCommitted(world),
    });
  }

  incrementalPort(synchronize: CommittedWorldPresentationStep): WorldPresentationPort {
    return Object.freeze({
      synchronize,
      rebuildFromCommitted: (world: CommittedWorld) => this.rebuildFromCommitted(world),
    });
  }

  noOpPort(): WorldPresentationPort {
    return Object.freeze({
      synchronize: () => {},
      rebuildFromCommitted: (world: CommittedWorld) => this.rebuildFromCommitted(world),
    });
  }
}
