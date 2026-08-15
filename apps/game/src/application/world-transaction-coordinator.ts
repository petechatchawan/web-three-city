import {
  buildingDefinitionForId,
  occupiedCellsForBuilding,
  resolveBuildingFrontage,
} from '@web-three-city/building-core';
import { createFoundationRciRegistries, validateRciSnapshot } from '@web-three-city/rci-core';
import { roadCellPolicyInvalidReason, roadOccupiedAt } from '@web-three-city/road-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { zoneCellPolicyInvalidReason, zoneOccupiedAt } from '@web-three-city/zone-core';
import { createZonePlacementEnvironment } from '../zone-placement-environment.js';
import type { DecodedWorldState } from '../world-save.js';
import {
  CommittedWorldStore,
  createCommittedWorld,
  createCommittedWorldFromDomainState,
  type CommittedWorld,
} from './committed-world.js';
import { fingerprintCommittedWorld } from './committed-world-fingerprint.js';

export type WorldPublicationRejection =
  | 'world:stale-revision'
  | 'world:stale-content'
  | 'world:invalid-candidate'
  | 'world:no-save'
  | 'world:invalid-save';

export interface WorldPublication {
  readonly baseRevision: number;
  readonly baseFingerprint: string;
  readonly nextWorld: CommittedWorld;
  readonly nextFingerprint: string;
  readonly presentation?: WorldPresentationPort;
}

export type WorldPublicationResult =
  | Readonly<{
      status: 'rejected';
      world: CommittedWorld;
      reason: WorldPublicationRejection;
    }>
  | Readonly<{
      status: 'committed';
      world: CommittedWorld;
      presentation:
        | Readonly<{ status: 'synchronized' }>
        | Readonly<{ status: 'degraded'; recoveryRequired: true }>;
    }>;

export interface WorldTransactionCoordinator {
  snapshot(): CommittedWorld;
  publish(plan: WorldPublication): WorldPublicationResult;
  replaceFromDecodedWorld(world: DecodedWorldState): WorldPublicationResult;
}

export interface WorldPresentationPort {
  synchronize(world: CommittedWorld): void;
  rebuildFromCommitted(world: CommittedWorld): void;
}

function validMobilityTraffic(world: CommittedWorld): boolean {
  const mobilityByTrip = new Map(world.mobility.trips.map((trip) => [trip.tripId, trip] as const));
  const trafficByTrip = new Map(world.traffic.activeTrips.map((trip) => [trip.tripId, trip] as const));
  for (const trip of world.traffic.activeTrips) {
    const mobilityTrip = mobilityByTrip.get(trip.tripId);
    if (
      mobilityTrip === undefined ||
      mobilityTrip.status !== 'Active' ||
      mobilityTrip.citizenId !== trip.citizenId ||
      mobilityTrip.mode !== trip.mode
    ) {
      return false;
    }
  }
  for (const state of world.mobility.citizenStates) {
    if (state.activeTripId !== null && !trafficByTrip.has(state.activeTripId)) return false;
  }
  return true;
}

function validCandidate(world: CommittedWorld): boolean {
  for (let z = 0; z < WORLD_CONFIG.mapHeight; z += 1) {
    for (let x = 0; x < WORLD_CONFIG.mapWidth; x += 1) {
      const cell = { x, z };
      if (
        roadOccupiedAt(world.roads, cell) &&
        roadCellPolicyInvalidReason(world.roads, cell, world.environments.road, WORLD_CONFIG) !== null
      ) {
        return false;
      }
    }
  }

  const emptyOccupancy = Object.freeze({ revision: 0, isBlocked: () => false });
  const zoneEnvironment = createZonePlacementEnvironment(
    world.terrain,
    world.water,
    world.roads,
    emptyOccupancy,
    WORLD_CONFIG,
  );
  for (let z = 0; z < WORLD_CONFIG.mapHeight; z += 1) {
    for (let x = 0; x < WORLD_CONFIG.mapWidth; x += 1) {
      const cell = { x, z };
      if (
        zoneOccupiedAt(world.zones, cell) &&
        zoneCellPolicyInvalidReason(world.zones, cell, zoneEnvironment, WORLD_CONFIG) !== null
      ) {
        return false;
      }
    }
  }

  for (const instance of world.buildings.instances) {
    if (
      instance.lifecycle === 'construction' &&
      instance.constructionCompletesAtTick <= world.simulation.absoluteTick
    ) {
      return false;
    }
    const definition = buildingDefinitionForId(instance.buildingDefinitionId);
    const cells = occupiedCellsForBuilding(instance);
    const firstCell = cells[0];
    const zoneId = firstCell === undefined ? null : world.environments.building.zoneDefinitionIdAt(firstCell);
    if (
      zoneId === null ||
      !definition.compatibleZoneDefinitionIds.includes(zoneId) ||
      cells.some(
        (cell) =>
          world.environments.building.zoneDefinitionIdAt(cell) !== zoneId ||
          !world.environments.building.isDry(cell) ||
          world.environments.building.surfaceAt(cell).shape !== 'flat' ||
          world.environments.building.isRoadOccupied(cell),
      ) ||
      resolveBuildingFrontage(instance, world.environments.building) === null
    ) {
      return false;
    }
  }

  return (
    validateRciSnapshot(
      world.rci,
      world.buildings,
      world.simulation,
      createFoundationRciRegistries(),
    ).valid && validMobilityTraffic(world)
  );
}

function rejected(world: CommittedWorld, reason: WorldPublicationRejection): WorldPublicationResult {
  return Object.freeze({ status: 'rejected' as const, world, reason });
}

export class DefaultWorldTransactionCoordinator implements WorldTransactionCoordinator {
  readonly #worldStore: CommittedWorldStore;
  readonly #presentation: WorldPresentationPort | null;

  constructor(input: { worldStore: CommittedWorldStore; presentation?: WorldPresentationPort }) {
    this.#worldStore = input.worldStore;
    this.#presentation = input.presentation ?? null;
  }

  snapshot(): CommittedWorld {
    return this.#worldStore.snapshot();
  }

  publish(plan: WorldPublication): WorldPublicationResult {
    const current = this.#worldStore.snapshot();
    const currentFingerprint = fingerprintCommittedWorld(current);
    if (plan.baseRevision !== current.revision) return rejected(current, 'world:stale-revision');
    if (plan.baseFingerprint !== currentFingerprint) return rejected(current, 'world:stale-content');
    const candidateFingerprint = fingerprintCommittedWorld(plan.nextWorld);
    if (plan.nextFingerprint !== candidateFingerprint) return rejected(current, 'world:stale-content');
    if (plan.nextWorld.revision !== current.revision + 1) return rejected(current, 'world:stale-content');

    let candidate: CommittedWorld;
    try {
      candidate = createCommittedWorld(plan.nextWorld);
      if (!validCandidate(candidate)) return rejected(current, 'world:invalid-candidate');
      candidate = this.#worldStore.replace(current.revision, candidate);
    } catch {
      return rejected(current, 'world:invalid-candidate');
    }

    const presentation = plan.presentation ?? this.#presentation;
    if (presentation === null) {
      return Object.freeze({
        status: 'committed' as const,
        world: candidate,
        presentation: Object.freeze({ status: 'synchronized' as const }),
      });
    }
    try {
      presentation.synchronize(candidate);
      return Object.freeze({
        status: 'committed' as const,
        world: candidate,
        presentation: Object.freeze({ status: 'synchronized' as const }),
      });
    } catch {
      try {
        presentation.rebuildFromCommitted(candidate);
      } catch {
        // Domain authority is already committed. Recovery can be retried from snapshot().
      }
      return Object.freeze({
        status: 'committed' as const,
        world: candidate,
        presentation: Object.freeze({
          status: 'degraded' as const,
          recoveryRequired: true as const,
        }),
      });
    }
  }

  replaceFromDecodedWorld(world: DecodedWorldState): WorldPublicationResult {
    const current = this.#worldStore.snapshot();
    let candidate: CommittedWorld;
    try {
      candidate = createCommittedWorldFromDomainState({
        revision: current.revision + 1,
        terrain: world.terrain,
        roads: world.roads,
        zones: world.zones,
        buildings: world.buildings,
        simulation: world.simulation,
        rci: world.rci,
        economy: world.economy,
        mobility: world.mobility,
        traffic: world.traffic,
      });
    } catch {
      return rejected(current, 'world:invalid-candidate');
    }
    return this.publish({
      baseRevision: current.revision,
      baseFingerprint: fingerprintCommittedWorld(current),
      nextWorld: candidate,
      nextFingerprint: fingerprintCommittedWorld(candidate),
    });
  }
}
