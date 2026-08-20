import type { CommittedWorld } from './committed-world.js';

const MEMOIZED_FINGERPRINTS = new WeakMap<CommittedWorld, string>();

/**
 * Transaction planning only handles immutable committed snapshots. Cache their large static
 * component serializations without changing the observational public fingerprint path below.
 */
export class ImmutableSnapshotJsonCache {
  readonly #serialized = new WeakMap<object, string>();

  serialize(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(stableValue(value));
    }
    const cached = this.#serialized.get(value);
    if (cached !== undefined) return cached;
    const serialized = JSON.stringify(stableValue(value));
    this.#serialized.set(value, serialized);
    return serialized;
  }
}

const TRANSACTION_COMPONENTS = new ImmutableSnapshotJsonCache();

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
  const cached = MEMOIZED_FINGERPRINTS.get(world);
  if (cached !== undefined) return cached;
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

function fingerprintCommittedWorldFromImmutableComponents(world: CommittedWorld): string {
  const values = {
    buildings: TRANSACTION_COMPONENTS.serialize(world.buildings),
    economy: TRANSACTION_COMPONENTS.serialize(world.economy),
    environments: TRANSACTION_COMPONENTS.serialize({
      building: {
        terrainRevision: world.environments.building.terrainRevision,
        waterSourceTerrainRevision: world.environments.building.waterSourceTerrainRevision,
        roadRevision: world.environments.building.roadRevision,
        zoneRevision: world.environments.building.zoneRevision,
      },
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
    }),
    mobility: TRANSACTION_COMPONENTS.serialize(world.mobility),
    rci: TRANSACTION_COMPONENTS.serialize(world.rci),
    revision: JSON.stringify(world.revision),
    roads: TRANSACTION_COMPONENTS.serialize(world.roads),
    simulation: TRANSACTION_COMPONENTS.serialize(world.simulation),
    terrain: TRANSACTION_COMPONENTS.serialize(world.terrain),
    traffic: TRANSACTION_COMPONENTS.serialize(world.traffic),
    water: TRANSACTION_COMPONENTS.serialize(world.water),
    zones: TRANSACTION_COMPONENTS.serialize(world.zones),
  };
  return `committed-world-v2:{${Object.entries(values)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([key, value]) => `${JSON.stringify(key)}:${value}`)
    .join(',')}}`;
}

/** Memoize only for authority-owned immutable planning/commit objects. */
export function memoizedFingerprintCommittedWorld(world: CommittedWorld): string {
  const cached = MEMOIZED_FINGERPRINTS.get(world);
  if (cached !== undefined) return cached;
  const fingerprint = fingerprintCommittedWorldFromImmutableComponents(world);
  MEMOIZED_FINGERPRINTS.set(world, fingerprint);
  return fingerprint;
}
