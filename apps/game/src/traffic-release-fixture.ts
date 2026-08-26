import {
  createBuildingSnapshot,
  createEmptyBuildingSnapshot,
  type BuildingInstance,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import {
  createEmptyMobilitySnapshot,
  deterministicScheduleOffset,
  reconcileMobilityCitizens,
  type MobilitySnapshotV1,
} from '@web-three-city/citizen-mobility-core';
import {
  createInitialEconomySnapshot,
  FOUNDATION_ECONOMY_RULES,
  type EconomySnapshotV1,
} from '@web-three-city/economy-core';
import {
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  createRciSnapshot,
  synchronizeDwellingInventory,
  synchronizeWorkplaceInventory,
  type RciSnapshot,
} from '@web-three-city/rci-core';
import { BASIC_ROAD_CODE, createRoadSnapshot, type RoadSnapshot } from '@web-three-city/road-core';
import {
  createSimulationSnapshot,
  deriveMacroHourIndex,
  macroHourIndex,
  macroHourValue,
  type SimulationSnapshot,
} from '@web-three-city/simulation-core';
import { createTerrainMap, type TerrainSnapshot } from '@web-three-city/terrain-core';
import { createEmptyTrafficSnapshot, type TrafficSnapshotV1 } from '@web-three-city/traffic-core';
import { WORLD_CONFIG, type CellCoord } from '@web-three-city/world-core';
import {
  COMMERCIAL_ZONE_CODE,
  INDUSTRIAL_ZONE_CODE,
  RESIDENTIAL_ZONE_CODE,
  createZoneSnapshot,
  type ZoneSnapshot,
} from '@web-three-city/zone-core';
import {
  createCommittedWorldFromDomainState,
  type CommittedWorld,
} from './application/committed-world.js';
import { createPresentCitizenMobilityProjection } from './mobility-source-projection.js';
import { encodeWorldSaveV7, type WorldSaveV7 } from './world-save.js';

export const TRAFFIC_RELEASE_FIXTURE_START_TICK = 9;
export const TRAFFIC_RELEASE_FIXTURE_PRIMARY_CUT_CELL: CellCoord = Object.freeze({ x: 64, z: 64 });

export interface TrafficReleaseFixtureSummary {
  readonly startAbsoluteGameMinute: number;
  readonly citizenIds: readonly string[];
  readonly walkCitizenIds: readonly string[];
  readonly driveCitizenIds: readonly string[];
  readonly departureGameMinutes: Readonly<Record<string, number>>;
  readonly homeBuildingByCitizen: Readonly<Record<string, string>>;
  readonly workBuildingByCitizen: Readonly<Record<string, string>>;
  readonly primaryRoadCutCell: CellCoord;
  readonly alternateRouteCells: readonly CellCoord[];
}

export interface TrafficReleaseFixture {
  readonly world: CommittedWorld;
  readonly save: WorldSaveV7;
  readonly summary: TrafficReleaseFixtureSummary;
}

interface FixtureCitizen {
  readonly citizenId: string;
  readonly homeBuildingId: string;
  readonly workBuildingId: string;
  readonly householdId: string;
  readonly dwellingUnitId: string;
  readonly workplaceId: string;
  readonly departureGameMinute: number;
  readonly expectedMode: 'Walk' | 'Drive';
}

function cellIndex(cell: CellCoord): number {
  return cell.z * WORLD_CONFIG.mapWidth + cell.x;
}

function createFixtureTerrain(): TerrainSnapshot {
  const latticeLength = (WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1);
  const levels = new Uint8Array(latticeLength);
  levels.fill(3);
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: levels,
    seed: 20260816,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 1,
  });
}

function setRoad(codes: Uint8Array, x: number, z: number): void {
  codes[cellIndex({ x, z })] = BASIC_ROAD_CODE;
}

function createFixtureRoads(): Readonly<{
  snapshot: RoadSnapshot;
  alternateRouteCells: readonly CellCoord[];
}> {
  const codes = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
  const alternate: CellCoord[] = [];
  for (let x = 40; x <= 90; x += 1) {
    setRoad(codes, x, 64);
    setRoad(codes, x, 68);
    alternate.push(Object.freeze({ x, z: 68 }));
  }
  for (const x of [40, 90]) {
    for (let z = 64; z <= 68; z += 1) {
      setRoad(codes, x, z);
      alternate.push(Object.freeze({ x, z }));
    }
  }
  return Object.freeze({
    snapshot: createRoadSnapshot(
      {
        width: WORLD_CONFIG.mapWidth,
        height: WORLD_CONFIG.mapHeight,
        revision: 1,
        definitionCodes: codes,
      },
      WORLD_CONFIG,
    ),
    alternateRouteCells: Object.freeze(alternate.sort((a, b) => a.z - b.z || a.x - b.x)),
  });
}

function building(
  instanceId: string,
  buildingDefinitionId: BuildingInstance['buildingDefinitionId'],
  originCell: CellCoord,
): BuildingInstance {
  return Object.freeze({
    instanceId,
    buildingDefinitionId,
    buildingDefinitionVersion: 1,
    originCell: Object.freeze({ ...originCell }),
    rotationQuarterTurns: 0,
    lifecycle: 'active' as const,
    activatedAtMacroHourIndex: macroHourIndex(0),
  });
}

function createFixtureBuildings(): BuildingSnapshot {
  const homes = [
    { x: 55, z: 63 },
    { x: 56, z: 63 },
    { x: 45, z: 65 },
    { x: 46, z: 65 },
    { x: 47, z: 65 },
    { x: 48, z: 65 },
    { x: 49, z: 65 },
    { x: 50, z: 65 },
  ].map((originCell, index) =>
    building(`fixture:home:${index + 1}`, 'residential-cottage-1x1', originCell),
  );
  return createBuildingSnapshot(
    {
      revision: 1,
      instances: Object.freeze([
        ...homes,
        building('fixture:work:shop', 'commercial-shop-1x1', { x: 58, z: 63 }),
        building('fixture:work:factory', 'industrial-factory-2x2', { x: 80, z: 62 }),
      ]),
    },
    WORLD_CONFIG,
  );
}

function createFixtureZones(): ZoneSnapshot {
  const codes = new Uint8Array(WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight);
  for (const cell of [
    { x: 55, z: 63 },
    { x: 56, z: 63 },
    { x: 45, z: 65 },
    { x: 46, z: 65 },
    { x: 47, z: 65 },
    { x: 48, z: 65 },
    { x: 49, z: 65 },
    { x: 50, z: 65 },
  ]) {
    codes[cellIndex(cell)] = RESIDENTIAL_ZONE_CODE;
  }
  codes[cellIndex({ x: 58, z: 63 })] = COMMERCIAL_ZONE_CODE;
  for (const cell of [
    { x: 80, z: 62 },
    { x: 81, z: 62 },
    { x: 80, z: 63 },
    { x: 81, z: 63 },
  ]) {
    codes[cellIndex(cell)] = INDUSTRIAL_ZONE_CODE;
  }
  return createZoneSnapshot(
    {
      width: WORLD_CONFIG.mapWidth,
      height: WORLD_CONFIG.mapHeight,
      revision: 1,
      definitionCodes: codes,
    },
    WORLD_CONFIG,
  );
}

function clusteredCitizenIds(count: number): readonly string[] {
  const selected: string[] = [];
  for (let numericId = 1; numericId <= 10_000 && selected.length < count; numericId += 1) {
    const citizenId = `citizen:${numericId}`;
    if (deterministicScheduleOffset(citizenId, 0) <= 18) selected.push(citizenId);
  }
  if (selected.length !== count)
    throw new Error('traffic-release-fixture:insufficient-citizen-ids');
  return Object.freeze(selected);
}

function fixtureCitizens(): readonly FixtureCitizen[] {
  const ids = clusteredCitizenIds(8);
  return Object.freeze(
    ids.map((citizenId, index) => {
      const homeBuildingId = `fixture:home:${index + 1}`;
      const expectedMode = index < 2 ? ('Walk' as const) : ('Drive' as const);
      const workBuildingId = expectedMode === 'Walk' ? 'fixture:work:shop' : 'fixture:work:factory';
      return Object.freeze({
        citizenId,
        homeBuildingId,
        workBuildingId,
        householdId: `household:${index + 1}`,
        dwellingUnitId: `dwelling:${homeBuildingId}:0`,
        workplaceId: `workplace:${workBuildingId}`,
        departureGameMinute: 420 + deterministicScheduleOffset(citizenId, 0),
        expectedMode,
      });
    }),
  );
}

function createFixtureSimulation(): SimulationSnapshot {
  return createSimulationSnapshot({
    revision: 1,
    absoluteGameMinute: TRAFFIC_RELEASE_FIXTURE_START_TICK * 60,
    growthSequence: 0,
  });
}

function createFixtureRci(
  buildings: BuildingSnapshot,
  simulation: SimulationSnapshot,
  citizens: readonly FixtureCitizen[],
): RciSnapshot {
  const registries = createFoundationRciRegistries();
  const initial = createInitialRciSnapshot({
    absoluteTick: deriveMacroHourIndex(simulation.absoluteGameMinute),
    deterministicSeed: 20260816,
  });
  const numericCitizenIds = citizens.map((citizen) =>
    Number(citizen.citizenId.slice('citizen:'.length)),
  );
  const base: RciSnapshot = {
    ...initial,
    revision: 1,
    population: {
      revision: 1,
      citizens: citizens.map((citizen, index) => ({
        citizenId: citizen.citizenId,
        presence: 'resident' as const,
        sexDefinitionId: index % 2 === 0 ? 'sex.female' : 'sex.male',
        bornAtTick:
          macroHourValue(deriveMacroHourIndex(simulation.absoluteGameMinute)) -
          (28 + index) * 8_640,
        movedIntoCityAtTick: 0,
        movedOutOfCityAtTick: null,
        diedAtTick: null,
      })),
      qualifications: citizens.map((citizen, index) => ({
        citizenQualificationId: `citizen-qualification:${index + 1}`,
        citizenId: citizen.citizenId,
        qualificationDefinitionId: 'qualification.entry',
        awardedAtTick: 0,
        endedAtTick: null,
        sourceDefinitionId: 'traffic-release-fixture',
      })),
    },
    households: {
      revision: 1,
      households: citizens.map((citizen) => ({
        householdId: citizen.householdId,
        foundedAtTick: 0,
        dissolvedAtTick: null,
      })),
      memberships: citizens.map((citizen, index) => ({
        membershipId: `household-membership:${index + 1}`,
        householdId: citizen.householdId,
        citizenId: citizen.citizenId,
        startedAtTick: 0,
        endedAtTick: null,
        endReasonDefinitionId: null,
      })),
    },
    sequences: {
      ...initial.sequences,
      nextCitizen: Math.max(...numericCitizenIds) + 1,
      nextHousehold: citizens.length + 1,
      nextHouseholdMembership: citizens.length + 1,
      nextCitizenQualification: citizens.length + 1,
      nextHousingAssignment: citizens.length + 1,
      nextEmploymentAssignment: citizens.length + 1,
    },
  };
  const emptyBuildings = createEmptyBuildingSnapshot(WORLD_CONFIG);
  const withDwellings = synchronizeDwellingInventory({
    snapshot: base,
    buildingsBefore: emptyBuildings,
    buildingsAfter: buildings,
    registries,
    evaluationTick: deriveMacroHourIndex(simulation.absoluteGameMinute),
  }).proposedSnapshot;
  const withWorkplaces = synchronizeWorkplaceInventory({
    snapshot: withDwellings,
    buildingsBefore: emptyBuildings,
    buildingsAfter: buildings,
    registries,
    evaluationTick: deriveMacroHourIndex(simulation.absoluteGameMinute),
  }).proposedSnapshot;
  const finalCandidate: RciSnapshot = {
    ...withWorkplaces,
    revision: withWorkplaces.revision + 1,
    housing: {
      ...withWorkplaces.housing,
      revision: withWorkplaces.housing.revision + 1,
      assignments: citizens.map((citizen, index) => ({
        housingAssignmentId: `housing-assignment:${index + 1}`,
        householdId: citizen.householdId,
        dwellingUnitId: citizen.dwellingUnitId,
        startedAtTick: 0,
        endedAtTick: null,
        endReasonDefinitionId: null,
      })),
    },
    employment: {
      ...withWorkplaces.employment,
      revision: withWorkplaces.employment.revision + 1,
      assignments: citizens.map((citizen, index) => ({
        employmentAssignmentId: `employment-assignment:${index + 1}`,
        citizenId: citizen.citizenId,
        workplaceId: citizen.workplaceId,
        positionGroupDefinitionId: 'position.entry',
        startedAtTick: 0,
        endedAtTick: null,
        endReasonDefinitionId: null,
      })),
    },
  };
  return createRciSnapshot(finalCandidate, { buildings, simulation, registries });
}

function createFixtureEconomy(): EconomySnapshotV1 {
  return createInitialEconomySnapshot(
    { year: 1, month: 1, latestDailySettlementTick: 0 },
    FOUNDATION_ECONOMY_RULES,
  );
}

function createFixtureMobility(
  rci: RciSnapshot,
  buildings: BuildingSnapshot,
  simulation: SimulationSnapshot,
): MobilitySnapshotV1 {
  return reconcileMobilityCitizens({
    snapshot: createEmptyMobilitySnapshot(),
    citizens: createPresentCitizenMobilityProjection(rci, buildings, simulation.absoluteGameMinute),
  }).snapshot;
}

export function createTrafficReleaseFixture(): TrafficReleaseFixture {
  const terrain = createFixtureTerrain();
  const roadsResult = createFixtureRoads();
  const roads = roadsResult.snapshot;
  const zones = createFixtureZones();
  const buildings = createFixtureBuildings();
  const simulation = createFixtureSimulation();
  const citizens = fixtureCitizens();
  const rci = createFixtureRci(buildings, simulation, citizens);
  const economy = createFixtureEconomy();
  const mobility = createFixtureMobility(rci, buildings, simulation);
  const traffic: TrafficSnapshotV1 = createEmptyTrafficSnapshot({
    roadRevision: roads.revision,
    buildingRevision: buildings.revision,
  });
  const world = createCommittedWorldFromDomainState({
    revision: 0,
    terrain,
    roads,
    zones,
    buildings,
    simulation,
    rci,
    economy,
    mobility,
    traffic,
  });
  const save = encodeWorldSaveV7(
    world.terrain,
    world.roads,
    world.zones,
    world.buildings,
    world.simulation,
    world.rci,
    world.economy,
    world.mobility,
    world.traffic,
  );
  const departureGameMinutes = Object.freeze(
    Object.fromEntries(citizens.map((citizen) => [citizen.citizenId, citizen.departureGameMinute])),
  );
  const homeBuildingByCitizen = Object.freeze(
    Object.fromEntries(citizens.map((citizen) => [citizen.citizenId, citizen.homeBuildingId])),
  );
  const workBuildingByCitizen = Object.freeze(
    Object.fromEntries(citizens.map((citizen) => [citizen.citizenId, citizen.workBuildingId])),
  );
  const summary: TrafficReleaseFixtureSummary = Object.freeze({
    startAbsoluteGameMinute: simulation.absoluteGameMinute,
    citizenIds: Object.freeze(citizens.map((citizen) => citizen.citizenId)),
    walkCitizenIds: Object.freeze(
      citizens
        .filter((citizen) => citizen.expectedMode === 'Walk')
        .map((citizen) => citizen.citizenId),
    ),
    driveCitizenIds: Object.freeze(
      citizens
        .filter((citizen) => citizen.expectedMode === 'Drive')
        .map((citizen) => citizen.citizenId),
    ),
    departureGameMinutes,
    homeBuildingByCitizen,
    workBuildingByCitizen,
    primaryRoadCutCell: TRAFFIC_RELEASE_FIXTURE_PRIMARY_CUT_CELL,
    alternateRouteCells: roadsResult.alternateRouteCells,
  });
  return Object.freeze({ world, save, summary });
}
