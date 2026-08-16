import type { CommittedWorld } from './application/committed-world.js';
import type { BuildingSnapshot } from '@web-three-city/building-core';
import {
  createEmptyMobilitySnapshot,
  type MobilitySnapshotV1,
} from '@web-three-city/citizen-mobility-core';
import type { EconomySnapshotV1 } from '@web-three-city/economy-core';
import type { RciSnapshot } from '@web-three-city/rci-core';
import type { RoadSnapshot } from '@web-three-city/road-core';
import type { SimulationSnapshot } from '@web-three-city/simulation-core';
import { createEmptyTrafficSnapshot, type TrafficSnapshotV1 } from '@web-three-city/traffic-core';
import {
  recallMobilityTrafficState,
  rememberMobilityTrafficState,
} from './mobility-traffic-state-registry.js';

export interface GameWorldState {
  readonly revision: number;
  readonly simulation: SimulationSnapshot;
  readonly buildings: BuildingSnapshot;
  readonly rci: RciSnapshot;
  readonly roads: RoadSnapshot;
  readonly economy: EconomySnapshotV1;
  readonly mobility: MobilitySnapshotV1;
  readonly traffic: TrafficSnapshotV1;
}

export type GameWorldStateInput = Omit<GameWorldState, 'mobility' | 'traffic'> &
  Readonly<{
    mobility?: MobilitySnapshotV1;
    traffic?: TrafficSnapshotV1;
  }>;

function completeGameWorldState(input: GameWorldStateInput): GameWorldState {
  const recalled = recallMobilityTrafficState(input.rci);
  const mobility = input.mobility ?? recalled?.mobility ?? createEmptyMobilitySnapshot();
  const traffic =
    input.traffic ??
    recalled?.traffic ??
    createEmptyTrafficSnapshot({
      roadRevision: input.roads.revision,
      buildingRevision: input.buildings.revision,
    });
  const state = Object.freeze({
    ...input,
    mobility,
    traffic,
  });
  rememberMobilityTrafficState(state.rci, state.mobility, state.traffic);
  return state;
}

export class GameWorldStateStore {
  #state: GameWorldState;

  constructor(initialState: GameWorldStateInput) {
    this.#state = completeGameWorldState(initialState);
  }

  snapshot(): GameWorldState {
    return this.#state;
  }

  replace(expectedRevision: number, nextState: GameWorldState): GameWorldState {
    if (this.#state.revision !== expectedRevision)
      throw new Error('game-world-state:stale-revision');
    if (nextState.revision !== expectedRevision + 1)
      throw new Error('game-world-state:invalid-next-revision');
    this.#state = completeGameWorldState(nextState);
    return this.#state;
  }

  synchronizeExternal(
    input: Readonly<{
      simulation: SimulationSnapshot;
      buildings: BuildingSnapshot;
      rci?: RciSnapshot;
      roads?: RoadSnapshot;
      economy?: EconomySnapshotV1;
      mobility?: MobilitySnapshotV1;
      traffic?: TrafficSnapshotV1;
    }>,
  ): GameWorldState {
    const unchanged =
      this.#state.simulation === input.simulation &&
      this.#state.buildings === input.buildings &&
      (input.rci === undefined || this.#state.rci === input.rci) &&
      (input.roads === undefined || this.#state.roads === input.roads) &&
      (input.economy === undefined || this.#state.economy === input.economy) &&
      (input.mobility === undefined || this.#state.mobility === input.mobility) &&
      (input.traffic === undefined || this.#state.traffic === input.traffic);
    if (unchanged) return this.#state;
    this.#state = completeGameWorldState({
      revision: this.#state.revision + 1,
      simulation: input.simulation,
      buildings: input.buildings,
      rci: input.rci ?? this.#state.rci,
      roads: input.roads ?? this.#state.roads,
      economy: input.economy ?? this.#state.economy,
      mobility: input.mobility ?? this.#state.mobility,
      traffic: input.traffic ?? this.#state.traffic,
    });
    return this.#state;
  }
}

/** Compatibility projection while legacy runtime wiring migrates to CommittedWorldStore. */
export function gameWorldStateFromCommittedWorld(world: CommittedWorld): GameWorldState {
  const state = Object.freeze({
    revision: world.revision,
    simulation: world.simulation,
    buildings: world.buildings,
    rci: world.rci,
    roads: world.roads,
    economy: world.economy,
    mobility: world.mobility,
    traffic: world.traffic,
  });
  rememberMobilityTrafficState(state.rci, state.mobility, state.traffic);
  return state;
}
