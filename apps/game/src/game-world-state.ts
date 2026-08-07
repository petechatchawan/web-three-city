import type { CommittedWorld } from './application/committed-world.js';
import type { BuildingSnapshot } from '@web-three-city/building-core';
import type { RciSnapshot } from '@web-three-city/rci-core';
import type { SimulationSnapshot } from '@web-three-city/simulation-core';

export interface GameWorldState {
  readonly revision: number;
  readonly simulation: SimulationSnapshot;
  readonly buildings: BuildingSnapshot;
  readonly rci: RciSnapshot;
}

export class GameWorldStateStore {
  #state: GameWorldState;

  constructor(initialState: GameWorldState) {
    this.#state = Object.freeze(initialState);
  }

  snapshot(): GameWorldState {
    return this.#state;
  }

  replace(expectedRevision: number, nextState: GameWorldState): GameWorldState {
    if (this.#state.revision !== expectedRevision) {
      throw new Error('game-world-state:stale-revision');
    }
    if (nextState.revision !== expectedRevision + 1) {
      throw new Error('game-world-state:invalid-next-revision');
    }
    this.#state = Object.freeze(nextState);
    return this.#state;
  }

  synchronizeExternal(
    input: Readonly<{
      simulation: SimulationSnapshot;
      buildings: BuildingSnapshot;
      rci?: RciSnapshot;
    }>,
  ): GameWorldState {
    const unchanged =
      this.#state.simulation === input.simulation &&
      this.#state.buildings === input.buildings &&
      (input.rci === undefined || this.#state.rci === input.rci);
    if (unchanged) return this.#state;
    this.#state = Object.freeze({
      revision: this.#state.revision + 1,
      simulation: input.simulation,
      buildings: input.buildings,
      rci: input.rci ?? this.#state.rci,
    });
    return this.#state;
  }
}

/** Compatibility projection while legacy runtime wiring migrates to CommittedWorldStore. */
export function gameWorldStateFromCommittedWorld(world: CommittedWorld): GameWorldState {
  return Object.freeze({
    revision: world.revision,
    simulation: world.simulation,
    buildings: world.buildings,
    rci: world.rci,
  });
}
