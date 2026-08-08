import type { CommittedWorld } from './application/committed-world.js';
import type { BuildingSnapshot } from '@web-three-city/building-core';
import type { RciSnapshot } from '@web-three-city/rci-core';
import type { SimulationSnapshot } from '@web-three-city/simulation-core';
import type { RoadSnapshot } from '@web-three-city/road-core';
import type { EconomySnapshotV1 } from '@web-three-city/economy-core';

export interface GameWorldState {
  readonly revision: number;
  readonly simulation: SimulationSnapshot;
  readonly buildings: BuildingSnapshot;
  readonly rci: RciSnapshot;
  readonly roads: RoadSnapshot;
  readonly economy: EconomySnapshotV1;
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
      roads?: RoadSnapshot;
      economy?: EconomySnapshotV1;
    }>,
  ): GameWorldState {
    const unchanged =
      this.#state.simulation === input.simulation &&
      this.#state.buildings === input.buildings &&
      (input.rci === undefined || this.#state.rci === input.rci) &&
      (input.roads === undefined || this.#state.roads === input.roads) &&
      (input.economy === undefined || this.#state.economy === input.economy);
    if (unchanged) return this.#state;
    this.#state = Object.freeze({
      revision: this.#state.revision + 1,
      simulation: input.simulation,
      buildings: input.buildings,
      rci: input.rci ?? this.#state.rci,
      roads: input.roads ?? this.#state.roads,
      economy: input.economy ?? this.#state.economy,
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
    roads: world.roads,
    economy: world.economy,
  });
}
