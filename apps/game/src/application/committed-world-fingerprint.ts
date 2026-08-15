import type { CommittedWorld } from './committed-world.js';

function stableValue(value: unknown): unknown {
  if (value instanceof Uint8Array) return [...value];
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => typeof entry !== 'function' && entry !== undefined)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

export function fingerprintCommittedWorld(world: CommittedWorld): string {
  return `committed-world-v2:${JSON.stringify(
    stableValue({
      revision: world.revision,
      terrain: world.terrain,
      water: world.water,
      roads: world.roads,
      zones: world.zones,
      buildings: world.buildings,
      simulation: world.simulation,
      rci: world.rci,
      economy: world.economy,
      mobility: world.mobility,
      traffic: world.traffic,
      environments: {
        road: {
          terrainRevision: world.environments.road.terrainRevision,
          waterSourceTerrainRevision: world.environments.road.waterSourceTerrainRevision,
        },
        zone: {
          terrainRevision: world.environments.zone.terrainRevision,
          waterSourceTerrainRevision: world.environments.zone.waterSourceTerrainRevision,
          roadRevision: world.environments.zone.roadRevision,
          occupancyRevision: world.environments.zone.occupancyRevision,
        },
        building: {
          terrainRevision: world.environments.building.terrainRevision,
          waterSourceTerrainRevision: world.environments.building.waterSourceTerrainRevision,
          roadRevision: world.environments.building.roadRevision,
          zoneRevision: world.environments.building.zoneRevision,
        },
      },
    }),
  )}`;
}
