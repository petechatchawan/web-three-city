import {
  createEmptyMobilitySnapshot,
  decodeMobilitySaveV1,
  decodeMobilitySaveV2,
  encodeMobilitySaveV1,
  encodeMobilitySaveV2,
  migrateMobilitySaveV1ToV2,
  reconcileMobilityCitizens,
  type MobilitySaveV1,
  type MobilitySaveV2,
  type MobilitySnapshotV1,
} from '@web-three-city/citizen-mobility-core';
import {
  createInitialEconomySnapshot,
  decodeEconomySaveV1,
  encodeEconomySaveV1,
  FOUNDATION_ECONOMY_RULES,
  type EconomySaveV1,
  type EconomySnapshotV1,
} from '@web-three-city/economy-core';
import {
  createFoundationRciRegistries,
  createRciMigrationInventory,
  decodeRciSaveV1,
  encodeRciSaveV1,
  type RciSaveV1,
  type RciSnapshot,
} from '@web-three-city/rci-core';
import {
  decodeSimulationSaveV2,
  decodeSimulationSaveV3,
  deriveGameCalendarFromGameMinute,
  deriveMacroHourIndex,
  encodeSimulationSaveV1,
  encodeSimulationSaveV2,
  encodeSimulationSaveV3,
  absoluteGameMinute,
  gameMinuteValue,
  macroHourIndex,
  macroHourValue,
  type SimulationSaveV2,
  type SimulationSaveV3,
} from '@web-three-city/simulation-core';
import {
  createEmptyTrafficSnapshot,
  decodeTrafficSaveV1,
  decodeTrafficSaveV2,
  derivePedestrianTrafficGraph,
  deriveVehicleTrafficGraph,
  encodeTrafficSaveV1,
  encodeTrafficSaveV2,
  transportSecondAtGameMinute,
  migrateTrafficSaveV1ToV2,
  type TrafficGraph,
  type TrafficSaveV1,
  type TrafficSaveV2,
  type TrafficSnapshotV1,
  type TrafficSnapshotV2,
} from '@web-three-city/traffic-core';
import { deriveWaterSnapshot } from '@web-three-city/water-core';
import { err, ok, WORLD_CONFIG, type Result, type WorldConfig } from '@web-three-city/world-core';
import { createBuildingDevelopmentEnvironment } from './building-development-environment.js';
import { createPresentCitizenMobilityProjection } from './mobility-source-projection.js';
import {
  createBuildingTrafficAccessProjection,
  createRoadTrafficSourceProjection,
} from './traffic-source-projection.js';
import * as legacy from './world-save-legacy.js';

export {
  encodeWorldSaveV1,
  encodeWorldSaveV2,
  encodeWorldSaveV3,
  encodeWorldSaveV4,
} from './world-save-legacy.js';
export type { WorldSaveV1, WorldSaveV2, WorldSaveV3, WorldSaveV4 } from './world-save-legacy.js';

export interface WorldSaveV5 {
  readonly kind: 'world-save';
  readonly schemaVersion: 5;
  readonly terrain: legacy.WorldSaveV4['terrain'];
  readonly roads: legacy.WorldSaveV4['roads'];
  readonly zones: legacy.WorldSaveV4['zones'];
  readonly buildings: legacy.WorldSaveV4['buildings'];
  readonly simulation: legacy.WorldSaveV4['simulation'];
  readonly rci: RciSaveV1;
}

export interface WorldSaveV6 extends Omit<WorldSaveV5, 'schemaVersion' | 'simulation'> {
  readonly schemaVersion: 6;
  readonly simulation: SimulationSaveV2;
  readonly economy: EconomySaveV1;
}

export interface WorldSaveV7 extends Omit<WorldSaveV6, 'schemaVersion'> {
  readonly schemaVersion: 7;
  readonly mobility: MobilitySaveV1;
  readonly traffic: TrafficSaveV1;
}

export interface WorldSaveV8 extends Omit<
  WorldSaveV7,
  'schemaVersion' | 'simulation' | 'mobility' | 'traffic'
> {
  readonly schemaVersion: 8;
  readonly simulation: SimulationSaveV3;
  readonly mobility: MobilitySaveV2;
  readonly traffic: TrafficSaveV2;
}

export interface DecodedWorldState extends legacy.DecodedWorldState {
  readonly rci: RciSnapshot;
  readonly economy: EconomySnapshotV1;
  readonly mobility: MobilitySnapshotV1;
  readonly traffic: TrafficSnapshotV1;
}

export type WorldSaveErrorCode =
  | legacy.WorldSaveErrorCode
  | 'world-save:invalid-rci'
  | 'world-save:invalid-economy'
  | 'world-save:invalid-mobility'
  | 'world-save:invalid-traffic';

export interface WorldSaveError {
  readonly code: WorldSaveErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function encodeWorldSaveV5(
  terrain: Parameters<typeof legacy.encodeWorldSaveV4>[0],
  roads: Parameters<typeof legacy.encodeWorldSaveV4>[1],
  zones: Parameters<typeof legacy.encodeWorldSaveV4>[2],
  buildings: Parameters<typeof legacy.encodeWorldSaveV4>[3],
  simulation: Parameters<typeof legacy.encodeWorldSaveV4>[4],
  rci: RciSnapshot,
): WorldSaveV5 {
  const base = legacy.encodeWorldSaveV4(terrain, roads, zones, buildings, simulation);
  return Object.freeze({
    ...base,
    schemaVersion: 5,
    rci: encodeRciSaveV1(rci, deriveMacroHourIndex(simulation.absoluteGameMinute)),
  });
}

export function encodeWorldSaveV6(
  terrain: Parameters<typeof encodeWorldSaveV5>[0],
  roads: Parameters<typeof encodeWorldSaveV5>[1],
  zones: Parameters<typeof encodeWorldSaveV5>[2],
  buildings: Parameters<typeof encodeWorldSaveV5>[3],
  simulation: Parameters<typeof encodeWorldSaveV5>[4],
  rci: RciSnapshot,
  economy: EconomySnapshotV1,
): WorldSaveV6 {
  return Object.freeze({
    ...encodeWorldSaveV5(terrain, roads, zones, buildings, simulation, rci),
    schemaVersion: 6,
    simulation: encodeSimulationSaveV2(simulation),
    economy: encodeEconomySaveV1(economy),
  });
}

export function encodeWorldSaveV7(
  terrain: Parameters<typeof encodeWorldSaveV6>[0],
  roads: Parameters<typeof encodeWorldSaveV6>[1],
  zones: Parameters<typeof encodeWorldSaveV6>[2],
  buildings: Parameters<typeof encodeWorldSaveV6>[3],
  simulation: Parameters<typeof encodeWorldSaveV6>[4],
  rci: RciSnapshot,
  economy: EconomySnapshotV1,
  mobility: MobilitySnapshotV1,
  traffic: TrafficSnapshotV1,
): WorldSaveV7 {
  return Object.freeze({
    ...encodeWorldSaveV6(terrain, roads, zones, buildings, simulation, rci, economy),
    schemaVersion: 7,
    mobility: encodeMobilitySaveV1(mobility),
    traffic: encodeTrafficSaveV1(traffic),
  });
}

export function encodeWorldSaveV8(
  terrain: Parameters<typeof encodeWorldSaveV7>[0],
  roads: Parameters<typeof encodeWorldSaveV7>[1],
  zones: Parameters<typeof encodeWorldSaveV7>[2],
  buildings: Parameters<typeof encodeWorldSaveV7>[3],
  simulation: Parameters<typeof encodeWorldSaveV7>[4],
  rci: RciSnapshot,
  economy: EconomySnapshotV1,
  mobility: MobilitySnapshotV1,
  traffic: TrafficSnapshotV1 | TrafficSnapshotV2,
): WorldSaveV8 {
  const trafficGraph = trafficValidationGraph(
    {
      terrain,
      roads,
      zones,
      buildings,
      simulation,
      rci,
      economy,
      mobility,
      traffic: traffic as TrafficSnapshotV1,
    } as DecodedWorldState,
    WORLD_CONFIG,
  );
  if (trafficGraph === null) throw new RangeError('world-save:invalid-traffic');
  const currentTraffic =
    (traffic as { schemaVersion: number }).schemaVersion === 2
      ? (traffic as TrafficSnapshotV2)
      : migrateTrafficSaveV1ToV2({
          snapshot: traffic as TrafficSnapshotV1,
          graph: trafficGraph,
          legacyCurrentGameSecond: gameMinuteValue(simulation.absoluteGameMinute),
          timeCursor: Object.freeze({
            sourceGameMinute: simulation.absoluteGameMinute,
            completedTransportQuantaWithinMinute: 0,
            absoluteTransportSecond: transportSecondAtGameMinute(simulation.absoluteGameMinute),
            temporalPolicyVersion: 1,
          }),
        });
  return Object.freeze({
    ...encodeWorldSaveV6(terrain, roads, zones, buildings, simulation, rci, economy),
    schemaVersion: 8,
    simulation: encodeSimulationSaveV3(simulation),
    mobility: encodeMobilitySaveV2(mobility),
    traffic: encodeTrafficSaveV2(currentTraffic),
  });
}

function migratedEconomy(simulation: legacy.DecodedWorldState['simulation']): EconomySnapshotV1 {
  const currentMacroHourIndex = deriveMacroHourIndex(simulation.absoluteGameMinute);
  const calendar = deriveGameCalendarFromGameMinute(simulation.absoluteGameMinute);
  const dayStart = macroHourValue(currentMacroHourIndex) - calendar.hour;
  const latestBoundary = Math.max(0, calendar.hour >= 8 ? dayStart + 8 : dayStart - 16);
  return createInitialEconomySnapshot(
    {
      year: calendar.year,
      month: calendar.month,
      latestCycleSettlementAtMacroHourIndex: macroHourIndex(latestBoundary),
    },
    FOUNDATION_ECONOMY_RULES,
  );
}

function migratedMobility(
  rci: RciSnapshot,
  buildings: DecodedWorldState['buildings'],
  absoluteGameMinuteValue: number,
): MobilitySnapshotV1 {
  return reconcileMobilityCitizens({
    snapshot: createEmptyMobilitySnapshot(),
    citizens: createPresentCitizenMobilityProjection(
      rci,
      buildings,
      deriveMacroHourIndex(absoluteGameMinute(absoluteGameMinuteValue)),
    ),
  }).snapshot;
}

function migratedTraffic(
  roads: DecodedWorldState['roads'],
  buildings: DecodedWorldState['buildings'],
): TrafficSnapshotV1 {
  return createEmptyTrafficSnapshot({
    roadRevision: roads.revision,
    buildingRevision: buildings.revision,
  });
}

function trafficValidationGraph(
  world: DecodedWorldState,
  config: WorldConfig,
): TrafficGraph | null {
  const water = deriveWaterSnapshot(world.terrain, config);
  if (!water.ok) return null;
  const environment = createBuildingDevelopmentEnvironment(
    world.terrain,
    water.value,
    world.roads,
    world.zones,
    config,
  );
  const roadSource = createRoadTrafficSourceProjection(world.roads, world.terrain);
  const buildingAccess = createBuildingTrafficAccessProjection(
    world.buildings,
    world.roads,
    environment,
  );
  const walkBase = derivePedestrianTrafficGraph(roadSource);
  const driveBase = deriveVehicleTrafficGraph(roadSource);
  const walk = Object.freeze({
    ...walkBase,
    sourceBuildingRevision: buildingAccess.buildingRevision,
  });
  const drive = Object.freeze({
    ...driveBase,
    sourceBuildingRevision: buildingAccess.buildingRevision,
  });
  const nodeMap = new Map(
    [...walk.nodes, ...drive.nodes].map((node) => [node.nodeId, node] as const),
  );
  return Object.freeze({
    sourceRoadRevision: roadSource.roadRevision,
    sourceBuildingRevision: buildingAccess.buildingRevision,
    nodes: Object.freeze([...nodeMap.values()]),
    edges: Object.freeze([...walk.edges, ...drive.edges]),
  });
}

function validMobilityTrafficReferences(
  mobility: MobilitySnapshotV1,
  traffic: TrafficSnapshotV1,
): boolean {
  const mobilityByTrip = new Map(mobility.trips.map((trip) => [trip.tripId, trip] as const));
  const trafficByTrip = new Map(traffic.activeTrips.map((trip) => [trip.tripId, trip] as const));
  for (const trip of traffic.activeTrips) {
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
  for (const state of mobility.citizenStates) {
    if (state.activeTripId !== null && !trafficByTrip.has(state.activeTripId)) return false;
  }
  return true;
}

function withMigratedMobilityTraffic(
  base: Omit<DecodedWorldState, 'mobility' | 'traffic'>,
): DecodedWorldState {
  const mobility = migratedMobility(base.rci, base.buildings, base.simulation.absoluteGameMinute);
  return Object.freeze({
    ...base,
    mobility,
    traffic: migratedTraffic(base.roads, base.buildings),
  });
}

export function decodeWorldSave(
  input: unknown,
  config: WorldConfig,
): Result<DecodedWorldState, WorldSaveError> {
  const isV8 = isRecord(input) && input.kind === 'world-save' && input.schemaVersion === 8;
  if (isV8) {
    if (!('simulation' in input) || !('mobility' in input) || !('traffic' in input)) {
      return err({ code: 'world-save:invalid-schema' });
    }
    const decodedSimulation = decodeSimulationSaveV3(input.simulation);
    if (!decodedSimulation.ok) return err({ code: 'world-save:invalid-simulation' });
    const v6Envelope = Object.freeze({
      ...input,
      schemaVersion: 6,
      simulation: encodeSimulationSaveV2(decodedSimulation.value),
    });
    const upstream = decodeWorldSave(v6Envelope, config);
    if (!upstream.ok) return upstream;
    const base = Object.freeze({ ...upstream.value, simulation: decodedSimulation.value });
    const decodedMobility = decodeMobilitySaveV2(input.mobility);
    if (!decodedMobility.ok) return err({ code: 'world-save:invalid-mobility' });
    const graph = trafficValidationGraph(base, config);
    if (graph === null) return err({ code: 'world-save:invalid-traffic' });
    const decodedTraffic = decodeTrafficSaveV2(input.traffic, graph);
    if (!decodedTraffic.ok) return err({ code: 'world-save:invalid-traffic' });
    if (
      !validMobilityTrafficReferences(
        decodedMobility.value,
        decodedTraffic.value as unknown as TrafficSnapshotV1,
      )
    ) {
      return err({ code: 'world-save:invalid-traffic' });
    }
    return ok(
      Object.freeze({
        ...base,
        mobility: decodedMobility.value,
        traffic: decodedTraffic.value as unknown as TrafficSnapshotV1,
      }),
    );
  }

  const isV7 = isRecord(input) && input.kind === 'world-save' && input.schemaVersion === 7;
  if (isV7) {
    const upstreamInput = Object.freeze({ ...input, schemaVersion: 6 });
    const upstream = decodeWorldSave(upstreamInput, config);
    if (!upstream.ok) return upstream;
    if (!('mobility' in input) || !('traffic' in input))
      return err({ code: 'world-save:invalid-schema' });
    const decodedMobility = decodeMobilitySaveV1(input.mobility);
    if (!decodedMobility.ok) return err({ code: 'world-save:invalid-mobility' });
    const graph = trafficValidationGraph(upstream.value, config);
    if (graph === null) return err({ code: 'world-save:invalid-traffic' });
    const decodedTraffic = decodeTrafficSaveV1(input.traffic, graph);
    if (!decodedTraffic.ok) return err({ code: 'world-save:invalid-traffic' });
    if (!validMobilityTrafficReferences(decodedMobility.value, decodedTraffic.value)) {
      return err({ code: 'world-save:invalid-traffic' });
    }
    const migratedMobility = decodeMobilitySaveV2(
      migrateMobilitySaveV1ToV2(input.mobility as MobilitySaveV1),
    );
    if (!migratedMobility.ok) return err({ code: 'world-save:invalid-mobility' });
    const migratedTraffic = migrateTrafficSaveV1ToV2({
      snapshot: decodedTraffic.value,
      graph,
      legacyCurrentGameSecond: gameMinuteValue(upstream.value.simulation.absoluteGameMinute),
      timeCursor: Object.freeze({
        sourceGameMinute: upstream.value.simulation.absoluteGameMinute,
        completedTransportQuantaWithinMinute: 0,
        absoluteTransportSecond: transportSecondAtGameMinute(
          upstream.value.simulation.absoluteGameMinute,
        ),
        temporalPolicyVersion: 1,
      }),
    });
    return ok(
      Object.freeze({
        ...upstream.value,
        mobility: migratedMobility.value,
        traffic: migratedTraffic as unknown as TrafficSnapshotV1,
      }),
    );
  }

  const isV6 = isRecord(input) && input.kind === 'world-save' && input.schemaVersion === 6;
  const isV5 = isRecord(input) && input.kind === 'world-save' && input.schemaVersion === 5;
  const decodedV6Simulation =
    isV6 && 'simulation' in input ? decodeSimulationSaveV2(input.simulation) : null;
  if (decodedV6Simulation && !decodedV6Simulation.ok) {
    return err({ code: 'world-save:invalid-simulation' });
  }
  const legacyInput =
    isV6 || isV5
      ? Object.freeze({
          ...input,
          schemaVersion: 4,
          ...(decodedV6Simulation?.ok
            ? { simulation: encodeSimulationSaveV1(decodedV6Simulation.value) }
            : {}),
        })
      : input;
  const base = legacy.decodeWorldSave(legacyInput, config);
  if (!base.ok) return base;

  const registries = createFoundationRciRegistries();
  if (!isV6 && !isV5) {
    const rci = createRciMigrationInventory({
      buildings: base.value.buildings,
      absoluteMacroHourIndex: deriveMacroHourIndex(base.value.simulation.absoluteGameMinute),
      registries,
    });
    return ok(
      withMigratedMobilityTraffic(
        Object.freeze({ ...base.value, rci, economy: migratedEconomy(base.value.simulation) }),
      ),
    );
  }

  if (!('rci' in input)) return err({ code: 'world-save:invalid-schema' });
  const decodedRci = decodeRciSaveV1(input.rci, {
    buildings: base.value.buildings,
    simulation: base.value.simulation,
    registries,
  });
  if (!decodedRci.ok) {
    return err({
      code: 'world-save:invalid-rci',
      details: Object.freeze({ rciCode: decodedRci.error.code }),
    });
  }

  if (!isV6) {
    return ok(
      withMigratedMobilityTraffic(
        Object.freeze({
          ...base.value,
          rci: decodedRci.value,
          economy: migratedEconomy(base.value.simulation),
        }),
      ),
    );
  }
  if (!('economy' in input)) return err({ code: 'world-save:invalid-schema' });
  const decodedEconomy = decodeEconomySaveV1(input.economy, FOUNDATION_ECONOMY_RULES);
  if (!decodedEconomy.ok) return err({ code: 'world-save:invalid-economy' });
  return ok(
    withMigratedMobilityTraffic(
      Object.freeze({
        ...base.value,
        simulation: decodedV6Simulation?.ok ? decodedV6Simulation.value : base.value.simulation,
        rci: decodedRci.value,
        economy: decodedEconomy.value,
      }),
    ),
  );
}
