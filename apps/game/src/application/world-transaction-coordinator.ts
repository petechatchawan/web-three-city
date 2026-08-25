import {
  buildingDefinitionForId,
  isBuildingConstructionCompleteAtMacroHour,
  occupiedCellsForBuilding,
  resolveBuildingFrontage,
} from '@web-three-city/building-core';
import { createFoundationRciRegistries, validateRciSnapshot } from '@web-three-city/rci-core';
import { roadCellPolicyInvalidReason, roadOccupiedAt } from '@web-three-city/road-core';
import { deriveMacroHourIndex } from '@web-three-city/simulation-core';
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
import {
  fingerprintCommittedWorld,
  memoizedFingerprintCommittedWorld,
} from './committed-world-fingerprint.js';

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
  /** Internal transaction read; only authority-owned planning code may consume it. */
  snapshotForTransaction(): CommittedWorld;
  publish(plan: WorldPublication): WorldPublicationResult;
  /** Internal stepping path; result.world must not escape authority-owned code. */
  publishForTransaction(plan: WorldPublication): WorldPublicationResult;
  /** Internal atomic temporal batch; no candidate may escape to observers before all validate. */
  publishBatchForTransaction(plans: readonly WorldPublication[]): WorldPublicationResult;
  replaceFromDecodedWorld(world: DecodedWorldState): WorldPublicationResult;
}

export interface WorldPresentationPort {
  synchronize(world: CommittedWorld): void;
  rebuildFromCommitted(world: CommittedWorld): void;
}

function validMobilityTraffic(world: CommittedWorld): boolean {
  const mobilityByTrip = new Map(world.mobility.trips.map((trip) => [trip.tripId, trip] as const));
  const trafficByTrip = new Map(
    world.traffic.activeTrips.map((trip) => [trip.tripId, trip] as const),
  );
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

function sameStaticAuthority(first: CommittedWorld, second: CommittedWorld): boolean {
  return (
    first.terrain === second.terrain &&
    first.water === second.water &&
    first.roads === second.roads &&
    first.zones === second.zones &&
    first.buildings === second.buildings &&
    first.environments === second.environments
  );
}

export class StaticWorldValidationCache {
  #validatedWorld: CommittedWorld | null = null;

  fork(): StaticWorldValidationCache {
    const fork = new StaticWorldValidationCache();
    fork.#validatedWorld = this.#validatedWorld;
    return fork;
  }

  shouldValidate(world: CommittedWorld): boolean {
    return this.#validatedWorld === null || !sameStaticAuthority(this.#validatedWorld, world);
  }

  markValidated(world: CommittedWorld): void {
    this.#validatedWorld = world;
  }
}

function validBuildingInstance(
  world: CommittedWorld,
  instance: CommittedWorld['buildings']['instances'][number],
  validateStaticAuthority: boolean,
): boolean {
  if (
    instance.lifecycle === 'construction' &&
    isBuildingConstructionCompleteAtMacroHour(
      instance,
      deriveMacroHourIndex(world.simulation.absoluteGameMinute),
    )
  ) {
    return false;
  }
  if (!validateStaticAuthority) return true;

  const definition = buildingDefinitionForId(instance.buildingDefinitionId);
  const cells = occupiedCellsForBuilding(instance);
  const firstCell = cells[0];
  const zoneId =
    firstCell === undefined ? null : world.environments.building.zoneDefinitionIdAt(firstCell);
  return !(
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
  );
}

function validStaticAuthority(world: CommittedWorld): boolean {
  for (let z = 0; z < WORLD_CONFIG.mapHeight; z += 1) {
    for (let x = 0; x < WORLD_CONFIG.mapWidth; x += 1) {
      const cell = { x, z };
      if (
        roadOccupiedAt(world.roads, cell) &&
        roadCellPolicyInvalidReason(world.roads, cell, world.environments.road, WORLD_CONFIG) !==
          null
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
  return true;
}

function validCandidate(
  world: CommittedWorld,
  options: Readonly<{ validateStaticAuthority: boolean }>,
): boolean {
  if (options.validateStaticAuthority && !validStaticAuthority(world)) return false;
  if (
    world.buildings.instances.some(
      (instance) => !validBuildingInstance(world, instance, options.validateStaticAuthority),
    )
  ) {
    return false;
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

function publicationStaleReason(
  plan: WorldPublication,
  current: CommittedWorld,
  currentFingerprint: string,
): WorldPublicationRejection | null {
  if (plan.baseRevision !== current.revision) return 'world:stale-revision';
  if (plan.baseFingerprint !== currentFingerprint) return 'world:stale-content';
  if (plan.nextWorld.revision !== current.revision + 1) return 'world:stale-content';
  return null;
}

function prepareCandidate(
  plan: WorldPublication,
  current: CommittedWorld,
  staticValidationCache: StaticWorldValidationCache,
  reusePreparedDynamic: boolean,
): CommittedWorld | null {
  try {
    const candidate = createCommittedWorld(plan.nextWorld, {
      reuseStaticFrom: current,
      ...(reusePreparedDynamic ? { reuseDynamicFrom: plan.nextWorld } : {}),
    });
    const candidateFingerprint = memoizedFingerprintCommittedWorld(candidate);
    if (candidateFingerprint !== plan.nextFingerprint) return null;
    const validateStaticAuthority = staticValidationCache.shouldValidate(candidate);
    const valid = validCandidate(candidate, { validateStaticAuthority });
    if (!valid) return null;
    return candidate;
  } catch {
    return null;
  }
}

function synchronizePresentation(
  presentation: WorldPresentationPort,
  candidate: CommittedWorld,
): 'synchronized' | 'degraded' {
  try {
    presentation.synchronize(candidate);
    return 'synchronized';
  } catch {
    try {
      presentation.rebuildFromCommitted(candidate);
    } catch {
      // Domain authority is already committed. Recovery can be retried from snapshot().
    }
    return 'degraded';
  }
}

function rejected(
  world: CommittedWorld,
  reason: WorldPublicationRejection,
): WorldPublicationResult {
  return Object.freeze({ status: 'rejected' as const, world, reason });
}

export class DefaultWorldTransactionCoordinator implements WorldTransactionCoordinator {
  readonly #worldStore: CommittedWorldStore;
  readonly #presentation: WorldPresentationPort | null;
  readonly #staticValidationCache = new StaticWorldValidationCache();

  constructor(input: { worldStore: CommittedWorldStore; presentation?: WorldPresentationPort }) {
    this.#worldStore = input.worldStore;
    this.#presentation = input.presentation ?? null;
  }

  snapshot(): CommittedWorld {
    return this.#worldStore.snapshot();
  }

  snapshotForTransaction(): CommittedWorld {
    return this.#worldStore.committedForTransaction();
  }

  publish(plan: WorldPublication): WorldPublicationResult {
    return this.#publish(plan, true);
  }

  publishForTransaction(plan: WorldPublication): WorldPublicationResult {
    return this.#publish(plan, false);
  }

  publishBatchForTransaction(plans: readonly WorldPublication[]): WorldPublicationResult {
    const original = this.#worldStore.committedForTransaction();
    if (plans.length !== 5) return rejected(this.#worldStore.snapshot(), 'world:invalid-candidate');

    let current = original;
    const candidates: CommittedWorld[] = [];
    const batchValidationCache = this.#staticValidationCache.fork();
    for (const plan of plans) {
      const currentFingerprint = fingerprintCommittedWorld(current);
      const staleReason = publicationStaleReason(plan, current, currentFingerprint);
      if (staleReason !== null) return rejected(this.#worldStore.snapshot(), staleReason);
      if (plan.nextFingerprint !== fingerprintCommittedWorld(plan.nextWorld)) {
        return rejected(this.#worldStore.snapshot(), 'world:stale-content');
      }
      const candidate = prepareCandidate(plan, current, batchValidationCache, true);
      if (candidate === null) {
        return rejected(this.#worldStore.snapshot(), 'world:invalid-candidate');
      }
      candidates.push(candidate);
      // The next quantum reuses this candidate's immutable static authority. Mark it
      // immediately so Q1–Q4 do not repeat the full map-wide static validation pass.
      batchValidationCache.markValidated(candidate);
      current = candidate;
    }

    try {
      this.#worldStore.replacePreparedBatch(original.revision, candidates);
      this.#staticValidationCache.markValidated(current);
    } catch {
      return rejected(this.#worldStore.snapshot(), 'world:invalid-candidate');
    }
    return Object.freeze({
      status: 'committed' as const,
      world: current,
      presentation: Object.freeze({ status: 'synchronized' as const }),
    });
  }

  #publish(plan: WorldPublication, copyResultWorld: boolean): WorldPublicationResult {
    const current = this.#worldStore.committedForTransaction();
    const currentFingerprint = fingerprintCommittedWorld(current);
    const readCurrent = (): CommittedWorld =>
      copyResultWorld ? this.#worldStore.snapshot() : current;
    const staleReason = publicationStaleReason(plan, current, currentFingerprint);
    if (staleReason !== null) return rejected(readCurrent(), staleReason);
    const candidateFingerprint = fingerprintCommittedWorld(plan.nextWorld);
    if (plan.nextFingerprint !== candidateFingerprint) {
      return rejected(readCurrent(), 'world:stale-content');
    }
    const candidate = prepareCandidate(
      plan,
      current,
      this.#staticValidationCache,
      !copyResultWorld,
    );
    if (candidate === null) return rejected(readCurrent(), 'world:invalid-candidate');
    try {
      this.#worldStore.replacePrepared(current.revision, candidate);
      this.#staticValidationCache.markValidated(candidate);
    } catch {
      return rejected(readCurrent(), 'world:invalid-candidate');
    }

    const presentation = plan.presentation ?? this.#presentation;
    if (presentation === null) {
      return Object.freeze({
        status: 'committed' as const,
        world: copyResultWorld ? this.#worldStore.snapshot() : candidate,
        presentation: Object.freeze({ status: 'synchronized' as const }),
      });
    }
    const presentationStatus = synchronizePresentation(presentation, candidate);
    return presentationStatus === 'synchronized'
      ? Object.freeze({
          status: 'committed' as const,
          world: copyResultWorld ? this.#worldStore.snapshot() : candidate,
          presentation: Object.freeze({ status: 'synchronized' as const }),
        })
      : Object.freeze({
          status: 'committed' as const,
          world: copyResultWorld ? this.#worldStore.snapshot() : candidate,
          presentation: Object.freeze({
            status: 'degraded' as const,
            recoveryRequired: true as const,
          }),
        });
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
