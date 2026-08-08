import { createEmptyBuildingSnapshot } from '@web-three-city/building-core';
import { createInitialRciSnapshot } from '@web-three-city/rci-core';
import { createEmptyRoadSnapshot, type RoadSnapshot } from '@web-three-city/road-core';
import { createInitialSimulationSnapshot } from '@web-three-city/simulation-core';
import { createTerrainMap } from '@web-three-city/terrain-core';
import { deriveWaterSnapshot } from '@web-three-city/water-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { createEmptyZoneSnapshot, type ZoneSnapshot } from '@web-three-city/zone-core';
import { describe, expect, it } from 'vitest';
import { createBuildingDevelopmentEnvironment } from '../building-development-environment.js';
import { createBuildingWorldOccupancy } from '../building-world-occupancy.js';
import { createRoadPlacementEnvironment } from '../road-placement-environment.js';
import { createZonePlacementEnvironment } from '../zone-placement-environment.js';
import {
  CommittedWorldStore,
  createCommittedWorld,
  type CommittedWorldInput,
} from './committed-world.js';
import { fingerprintCommittedWorld } from './committed-world-fingerprint.js';

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
  const rci = createInitialRciSnapshot({ absoluteTick: simulation.absoluteTick });
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
    environments,
  };
}

describe('CommittedWorldStore', () => {
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
});
