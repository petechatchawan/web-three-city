import { createRoadSnapshot, type RoadSnapshot } from '@web-three-city/road-core';
import { createTerrainMap, type TerrainSnapshot } from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';

export type WorldUndoEntry =
  | Readonly<{ readonly kind: 'terraform'; readonly terrain: TerrainSnapshot }>
  | Readonly<{ readonly kind: 'road'; readonly roads: RoadSnapshot }>;

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

function copyEntry(entry: WorldUndoEntry, config: WorldConfig): WorldUndoEntry {
  return entry.kind === 'terraform'
    ? Object.freeze({ kind: 'terraform' as const, terrain: copyTerrain(entry.terrain, config) })
    : Object.freeze({ kind: 'road' as const, roads: copyRoads(entry.roads, config) });
}

function restoredEntry(entry: WorldUndoEntry, config: WorldConfig): WorldUndoEntry {
  return entry.kind === 'terraform'
    ? Object.freeze({
        kind: 'terraform' as const,
        terrain: copyTerrain(entry.terrain, config, entry.terrain.revision + 2),
      })
    : Object.freeze({
        kind: 'road' as const,
        roads: copyRoads(entry.roads, config, entry.roads.revision + 2),
      });
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
