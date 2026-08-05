import {
  consumeAutomaticBuildingUndoSuppression,
  createBuildingSnapshot,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import { createRoadSnapshot, type RoadSnapshot } from '@web-three-city/road-core';
import { createTerrainMap, type TerrainSnapshot } from '@web-three-city/terrain-core';
import { createZoneSnapshot, type ZoneSnapshot } from '@web-three-city/zone-core';
import type { WorldConfig } from '@web-three-city/world-core';

export type WorldUndoEntry =
  | Readonly<{ readonly kind: 'terraform'; readonly terrain: TerrainSnapshot }>
  | Readonly<{ readonly kind: 'road'; readonly roads: RoadSnapshot }>
  | Readonly<{ readonly kind: 'zone'; readonly zones: ZoneSnapshot }>
  | Readonly<{ readonly kind: 'building'; readonly buildings: BuildingSnapshot }>;

function copyTerrain(
  snapshot: TerrainSnapshot,
  config: WorldConfig,
  revision = snapshot.revision,
): TerrainSnapshot {
  return createTerrainMap({
    config,
    heightLevels: snapshot.heightLevels,
    seed: snapshot.seed,
    generatorVersion: snapshot.generatorVersion,
    generationAttempt: snapshot.generationAttempt,
    revision,
  });
}

function copyRoads(
  snapshot: RoadSnapshot,
  config: WorldConfig,
  revision = snapshot.revision,
): RoadSnapshot {
  return createRoadSnapshot(
    {
      width: snapshot.width,
      height: snapshot.height,
      revision,
      definitionCodes: snapshot.definitionCodes,
    },
    config,
  );
}

function copyZones(
  snapshot: ZoneSnapshot,
  config: WorldConfig,
  revision = snapshot.revision,
): ZoneSnapshot {
  return createZoneSnapshot(
    {
      width: snapshot.width,
      height: snapshot.height,
      revision,
      definitionCodes: snapshot.definitionCodes,
    },
    config,
  );
}

function copyBuildings(
  snapshot: BuildingSnapshot,
  config: WorldConfig,
  revision = snapshot.revision,
): BuildingSnapshot {
  return createBuildingSnapshot({ revision, instances: snapshot.instances }, config);
}

function copyEntry(entry: WorldUndoEntry, config: WorldConfig): WorldUndoEntry {
  switch (entry.kind) {
    case 'terraform':
      return Object.freeze({
        kind: 'terraform' as const,
        terrain: copyTerrain(entry.terrain, config),
      });
    case 'road':
      return Object.freeze({ kind: 'road' as const, roads: copyRoads(entry.roads, config) });
    case 'zone':
      return Object.freeze({ kind: 'zone' as const, zones: copyZones(entry.zones, config) });
    case 'building':
      return Object.freeze({
        kind: 'building' as const,
        buildings: copyBuildings(entry.buildings, config),
      });
  }
}

function restoredEntry(entry: WorldUndoEntry, config: WorldConfig): WorldUndoEntry {
  switch (entry.kind) {
    case 'terraform':
      return Object.freeze({
        kind: 'terraform' as const,
        terrain: copyTerrain(entry.terrain, config, entry.terrain.revision + 2),
      });
    case 'road':
      return Object.freeze({
        kind: 'road' as const,
        roads: copyRoads(entry.roads, config, entry.roads.revision + 2),
      });
    case 'zone':
      return Object.freeze({
        kind: 'zone' as const,
        zones: copyZones(entry.zones, config, entry.zones.revision + 2),
      });
    case 'building':
      return Object.freeze({
        kind: 'building' as const,
        buildings: copyBuildings(entry.buildings, config, entry.buildings.revision + 2),
      });
  }
}

export class WorldUndoStore {
  readonly #config: WorldConfig;
  #entry: WorldUndoEntry | null = null;

  constructor(config: WorldConfig) {
    this.#config = config;
  }

  get available(): boolean {
    return this.#entry !== null;
  }

  get kind(): WorldUndoEntry['kind'] | null {
    return this.#entry?.kind ?? null;
  }

  replace(entry: WorldUndoEntry): void {
    if (entry.kind === 'building' && consumeAutomaticBuildingUndoSuppression()) return;
    this.#entry = copyEntry(entry, this.#config);
  }

  consume(): WorldUndoEntry | null {
    const entry = this.#entry;
    if (entry === null) return null;
    this.#entry = null;
    return restoredEntry(entry, this.#config);
  }

  clear(): void {
    this.#entry = null;
  }
}
