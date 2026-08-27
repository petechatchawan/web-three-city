import { createEmptyBuildingSnapshot } from '@web-three-city/building-core';
import { createEmptyMobilitySnapshot } from '@web-three-city/citizen-mobility-core';
import {
  createInitialEconomySnapshot,
  FOUNDATION_ECONOMY_RULES,
} from '@web-three-city/economy-core';
import { createInitialRciSnapshot } from '@web-three-city/rci-core';
import {
  BASIC_ROAD_CODE,
  EMPTY_ROAD_CODE,
  createEmptyRoadSnapshot,
  createRoadSnapshot,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import {
  addGameMinutes,
  createInitialSimulationSnapshot,
  createSimulationSnapshot,
  deriveMacroHourIndex,
  gameMinuteDuration,
} from '@web-three-city/simulation-core';
import { createTerrainMap } from '@web-three-city/terrain-core';
import { createEmptyTrafficSnapshot } from '@web-three-city/traffic-core';
import { deriveWaterSnapshot } from '@web-three-city/water-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createEmptyZoneSnapshot, type ZoneSnapshot } from '@web-three-city/zone-core';
import { describe, expect, it } from 'vitest';
import { createBuildingDevelopmentEnvironment } from '../building-development-environment.js';
import { createBuildingWorldOccupancy } from '../building-world-occupancy.js';
import {
  recallMobilityTrafficState,
  rememberMobilityTrafficState,
} from '../mobility-traffic-state-registry.js';
import { createRoadPlacementEnvironment } from '../road-placement-environment.js';
import { createZonePlacementEnvironment } from '../zone-placement-environment.js';
import {
  CommittedWorldStore,
  createCommittedWorld,
  createCommittedWorldFromDomainState,
  type CommittedWorldInput,
} from './committed-world.js';
import {
  fingerprintCommittedWorld,
  memoizedFingerprintCommittedWorld,
} from './committed-world-fingerprint.js';

const CELL_COUNT = WORLD_CONFIG.mapWidth * WORLD_CONFIG.mapHeight;

function sourceWorld(revision = 0): CommittedWorldInput {
  const terrain = createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array((WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1)).fill(
      WORLD_CONFIG.seaLevel + 1,
    ),
    seed: 17,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 0,
  });
  const waterResult = deriveWaterSnapshot(terrain, WORLD_CONFIG);
  if (!waterResult.ok) throw new Error(waterResult.error.code);
  const roadSnapshot = createEmptyRoadSnapshot(WORLD_CONFIG);
  const roads: RoadSnapshot = {
    width: roadSnapshot.width,
    height: roadSnapshot.height,
    revision: roadSnapshot.revision,
    definitionCodes: roadSnapshot.definitionCodes,
  };
  const zoneSnapshot = createEmptyZoneSnapshot(WORLD_CONFIG);
  const zones: ZoneSnapshot = {
    width: zoneSnapshot.width,
    height: zoneSnapshot.height,
    revision: zoneSnapshot.revision,
    definitionCodes: zoneSnapshot.definitionCodes,
  };
  const buildings = createEmptyBuildingSnapshot(WORLD_CONFIG);
  const simulation = createInitialSimulationSnapshot();
  const rci = createInitialRciSnapshot({
    absoluteMacroHourIndex: deriveMacroHourIndex(simulation.absoluteGameMinute),
  });
  const environments = Object.freeze({
    road: createRoadPlacementEnvironment(terrain, waterResult.value, WORLD_CONFIG),
    zone: createZonePlacementEnvironment(
      terrain,
      waterResult.value,
      roads,
      createBuildingWorldOccupancy(buildings),
      WORLD_CONFIG,
    ),
    building: createBuildingDevelopmentEnvironment(
      terrain,
      waterResult.value,
      roads,
      zones,
      WORLD_CONFIG,
    ),
  });
  return {
    revision,
    terrain,
    water: waterResult.value,
    roads,
    zones,
    buildings,
    simulation,
    rci,
    economy: createInitialEconomySnapshot(
      { year: 1, month: 1, latestDailySettlementTick: simulation.absoluteGameMinute },
      FOUNDATION_ECONOMY_RULES,
    ),
    environments,
  };
}

describe('CommittedWorldStore', () => {
  it('includes Economy in candidate validation and the committed-world fingerprint', () => {
    const source = sourceWorld(0);
    const world = createCommittedWorld(source);
    const changed = createCommittedWorld({
      ...source,
      economy: { ...source.economy, treasuryBalanceMinor: source.economy.treasuryBalanceMinor - 1 },
    });
    expect(fingerprintCommittedWorld(changed)).not.toBe(fingerprintCommittedWorld(world));
    expect(() =>
      createCommittedWorld({
        ...source,
        economy: { ...source.economy, treasuryBalanceMinor: 0.5 },
      }),
    ).toThrow('committed-world:invalid-economy');
  });

  it('publishes all domain snapshots and derived environments in one application revision', () => {
    const initial = createCommittedWorld(sourceWorld(0));
    const store = new CommittedWorldStore(initial);
    const next = createCommittedWorld(sourceWorld(1));
    const committed = store.replace(0, next);
    expect(committed.revision).toBe(1);
    expect(committed.terrain).toEqual(next.terrain);
    expect(committed.water).toEqual(next.water);
    expect(committed.roads).toEqual(next.roads);
    expect(committed.zones).toEqual(next.zones);
    expect(committed.buildings).toEqual(next.buildings);
    expect(committed.simulation).toEqual(next.simulation);
    expect(committed.rci).toEqual(next.rci);
    expect(committed.water.sourceTerrainRevision).toBe(committed.terrain.revision);
    expect(committed.environments.road.terrainRevision).toBe(committed.terrain.revision);
    expect(committed.environments.zone.roadRevision).toBe(committed.roads.revision);
    expect(committed.environments.zone.occupancyRevision).toBe(committed.buildings.revision);
    expect(committed.environments.building.zoneRevision).toBe(committed.zones.revision);
  });

  it('rejects stale or skipped application revisions without changing committed state', () => {
    const initial = createCommittedWorld(sourceWorld(0));
    const store = new CommittedWorldStore(initial);
    const before = store.snapshot();
    expect(() => store.replace(1, createCommittedWorld(sourceWorld(1)))).toThrow(
      'committed-world:stale-revision',
    );
    expect(() => store.replace(0, createCommittedWorld(sourceWorld(2)))).toThrow(
      'committed-world:invalid-next-revision',
    );
    expect(fingerprintCommittedWorld(store.snapshot())).toBe(fingerprintCommittedWorld(before));
  });

  it('keeps snapshot reads observational for pending Mobility/Traffic compatibility state', () => {
    const store = new CommittedWorldStore(sourceWorld(0));
    const committed = store.snapshot();
    const pendingMobility = createEmptyMobilitySnapshot();
    const pendingTraffic = createEmptyTrafficSnapshot({
      roadRevision: committed.roads.revision,
      buildingRevision: committed.buildings.revision,
    });
    rememberMobilityTrafficState(committed.rci, pendingMobility, pendingTraffic);

    store.snapshot();

    const recalled = recallMobilityTrafficState(committed.rci);
    expect(recalled?.mobility).toBe(pendingMobility);
    expect(recalled?.traffic).toBe(pendingTraffic);
  });

  it('copies authoritative typed arrays on publication and on read', () => {
    const source = sourceWorld(0);
    const terrainBefore = source.terrain.heightLevels[0]!;
    const waterBefore = source.water.seaTriangleMask[0]!;
    const roadBefore = source.roads.definitionCodes[0]!;
    const zoneBefore = source.zones.definitionCodes[0]!;
    const store = new CommittedWorldStore(source);
    source.terrain.heightLevels[0] = terrainBefore + 1;
    source.water.seaTriangleMask[0] = waterBefore === 0 ? 1 : 0;
    source.roads.definitionCodes[0] = roadBefore === 0 ? 1 : 0;
    source.zones.definitionCodes[0] = zoneBefore === 0 ? 1 : 0;
    expect(store.snapshot().terrain.heightLevels[0]).toBe(terrainBefore);
    expect(store.snapshot().water.seaTriangleMask[0]).toBe(waterBefore);
    expect(store.snapshot().roads.definitionCodes[0]).toBe(roadBefore);
    expect(store.snapshot().zones.definitionCodes[0]).toBe(zoneBefore);
    const exposed = store.snapshot();
    exposed.terrain.heightLevels[0] = terrainBefore + 2;
    exposed.water.seaTriangleMask[0] = waterBefore === 0 ? 1 : 0;
    exposed.roads.definitionCodes[0] = roadBefore === 0 ? 1 : 0;
    exposed.zones.definitionCodes[0] = zoneBefore === 0 ? 1 : 0;
    expect(store.snapshot().terrain.heightLevels[0]).toBe(terrainBefore);
    expect(store.snapshot().water.seaTriangleMask[0]).toBe(waterBefore);
    expect(store.snapshot().roads.definitionCodes[0]).toBe(roadBefore);
    expect(store.snapshot().zones.definitionCodes[0]).toBe(zoneBefore);
  });

  it('rejects candidate environment provenance that does not match candidate snapshots', () => {
    const input = sourceWorld(0);
    const invalid = {
      ...input,
      environments: {
        ...input.environments,
        road: Object.freeze({
          ...input.environments.road,
          terrainRevision: input.terrain.revision + 1,
        }),
      },
    };
    expect(() => createCommittedWorld(invalid)).toThrow(
      'committed-world:invalid-environment-provenance',
    );
  });

  it('fingerprints domain content and environment provenance rather than function identity', () => {
    const store = new CommittedWorldStore(createCommittedWorld(sourceWorld(0)));
    const first = store.snapshot();
    const second = store.snapshot();
    expect(fingerprintCommittedWorld(first)).toBe(fingerprintCommittedWorld(second));
    second.terrain.heightLevels[0] = (second.terrain.heightLevels[0] ?? 0) + 1;
    expect(fingerprintCommittedWorld(second)).not.toBe(fingerprintCommittedWorld(first));
  });

  it('keeps the authority fingerprint identical while reusing immutable static components', () => {
    const initial = createCommittedWorld(sourceWorld(0));
    const next = createCommittedWorld(
      {
        ...initial,
        revision: 1,
        simulation: createSimulationSnapshot({
          ...initial.simulation,
          revision: initial.simulation.revision + 1,
          absoluteGameMinute: addGameMinutes(
            initial.simulation.absoluteGameMinute,
            gameMinuteDuration(1),
          ),
        }),
      },
      { reuseStaticFrom: initial },
    );

    const initialRegular = fingerprintCommittedWorld(initial);
    expect(memoizedFingerprintCommittedWorld(initial)).toBe(initialRegular);
    const nextRegular = fingerprintCommittedWorld(next);
    expect(memoizedFingerprintCommittedWorld(next)).toBe(nextRegular);
    expect(memoizedFingerprintCommittedWorld(next)).not.toBe(
      memoizedFingerprintCommittedWorld(initial),
    );
  });

  it('reuses static authority only when a transport publication carries the same snapshots', () => {
    const initial = createCommittedWorld(sourceWorld(0));
    const next = createCommittedWorld(
      {
        ...initial,
        revision: 1,
        simulation: createSimulationSnapshot({
          ...initial.simulation,
          revision: initial.simulation.revision + 1,
          absoluteGameMinute: addGameMinutes(
            initial.simulation.absoluteGameMinute,
            gameMinuteDuration(1),
          ),
        }),
      },
      { reuseStaticFrom: initial },
    );

    expect(next.terrain).toBe(initial.terrain);
    expect(next.water).toBe(initial.water);
    expect(next.roads).toBe(initial.roads);
    expect(next.zones).toBe(initial.zones);
    expect(next.buildings).toBe(initial.buildings);
    expect(next.environments).toBe(initial.environments);
    expect(next.simulation).not.toBe(initial.simulation);
  });

  it('shares only immutable road projection inputs across defensive reads', () => {
    const store = new CommittedWorldStore(createCommittedWorld(sourceWorld(0)));
    const first = store.snapshot();
    const second = store.snapshot();

    expect(second.roads).toBe(first.roads);
    expect(second.environments.building).toBe(first.environments.building);
    expect(second.terrain).not.toBe(first.terrain);
    expect(second.water).not.toBe(first.water);
    expect(second.zones).not.toBe(first.zones);
    expect(second.buildings).not.toBe(first.buildings);
    expect(second.environments).not.toBe(first.environments);
    expect(Object.isFrozen(second.roads)).toBe(true);
    expect(Object.isFrozen(second.environments.building)).toBe(true);

    const exposedCodes = first.roads.definitionCodes;
    exposedCodes[0] = BASIC_ROAD_CODE;
    expect(store.snapshot().roads.definitionCodes[0]).toBe(EMPTY_ROAD_CODE);
  });

  it('installs a prepared batch only when every revision is contiguous', () => {
    const store = new CommittedWorldStore(sourceWorld(0));
    const validCandidates = [1, 2, 3, 4, 5].map((revision) =>
      createCommittedWorld(sourceWorld(revision)),
    );

    expect(() => store.replacePreparedBatch(0, validCandidates)).not.toThrow();
    expect(store.snapshot().revision).toBe(5);

    const invalidStore = new CommittedWorldStore(sourceWorld(0));
    const invalidCandidates = [1, 3, 4, 5, 6].map((revision) =>
      createCommittedWorld(sourceWorld(revision)),
    );
    expect(() => invalidStore.replacePreparedBatch(0, invalidCandidates)).toThrow(
      'committed-world:invalid-batch',
    );
    expect(invalidStore.snapshot().revision).toBe(0);
  });

  it('replaces shared road projection inputs when road authority changes', () => {
    const initial = createCommittedWorld(sourceWorld(0));
    const store = new CommittedWorldStore(initial);
    const nextCodes = initial.roads.definitionCodes;
    nextCodes[0] = BASIC_ROAD_CODE;
    const next = createCommittedWorldFromDomainState({
      revision: initial.revision + 1,
      terrain: initial.terrain,
      zones: initial.zones,
      buildings: initial.buildings,
      simulation: initial.simulation,
      rci: initial.rci,
      economy: initial.economy,
      mobility: initial.mobility,
      traffic: createEmptyTrafficSnapshot({
        roadRevision: initial.roads.revision + 1,
        buildingRevision: initial.buildings.revision,
      }),
      roads: createRoadSnapshot(
        {
          width: initial.roads.width,
          height: initial.roads.height,
          revision: initial.roads.revision + 1,
          definitionCodes: nextCodes,
        },
        WORLD_CONFIG,
      ),
    });

    const before = store.snapshot();
    store.replace(0, next);
    const after = store.snapshot();

    expect(after.roads).not.toBe(before.roads);
    expect(after.roads.revision).toBe(before.roads.revision + 1);
    expect(after.roads.definitionCodes[0]).toBe(BASIC_ROAD_CODE);
    expect(after.environments.building).not.toBe(before.environments.building);
  });

  it('does not reuse a read identity for different static content at the same revision', () => {
    const base = createCommittedWorld(sourceWorld(0));
    const firstCodes = new Uint8Array(CELL_COUNT);
    const secondCodes = new Uint8Array(CELL_COUNT);
    secondCodes[0] = BASIC_ROAD_CODE;
    const loadedWorld = (definitionCodes: Uint8Array) =>
      createCommittedWorldFromDomainState({
        revision: base.revision,
        terrain: base.terrain,
        zones: base.zones,
        buildings: base.buildings,
        simulation: base.simulation,
        rci: base.rci,
        economy: base.economy,
        mobility: base.mobility,
        traffic: createEmptyTrafficSnapshot({
          roadRevision: 7,
          buildingRevision: base.buildings.revision,
        }),
        roads: createRoadSnapshot(
          {
            width: WORLD_CONFIG.mapWidth,
            height: WORLD_CONFIG.mapHeight,
            revision: 7,
            definitionCodes,
          },
          WORLD_CONFIG,
        ),
      });
    const firstStore = new CommittedWorldStore(loadedWorld(firstCodes));
    const secondStore = new CommittedWorldStore(loadedWorld(secondCodes));

    const first = firstStore.snapshot();
    const second = secondStore.snapshot();
    expect(second.roads.revision).toBe(first.roads.revision);
    expect(second.roads).not.toBe(first.roads);
    expect(second.roads.definitionCodes[0]).not.toBe(first.roads.definitionCodes[0]);
  });
});
