import { createRoadSnapshot, type RoadSnapshot } from '@web-three-city/road-core';
import { createTerrainMap, type TerrainSnapshot } from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';

export type WorldUndoEntry =
  | Readonly<{ readonly kind: 'terraform'; readonly terrain: TerrainSnapshot }>
  | Readonly<{ readonly kind: 'road'; readonly roads: RoadSnapshot }>;

function copyTerrain(snapshot: TerrainSnapshot, config: WorldConfig): TerrainSnapshot {
  return createTerrainMap({
    config,
    heightLevels: snapshot.heightLevels,
    seed: snapshot.seed,
    generatorVersion: snapshot.generatorVersion,
    generationAttempt: snapshot.generationAttempt,
    revision: snapshot.revision,
  });
}

function copyRoads(snapshot: RoadSnapshot, config: WorldConfig): RoadSnapshot {
  return createRoadSnapshot(
    {
      width: snapshot.width,
      height: snapshot.height,
      revision: snapshot.revision,
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
    return copyEntry(entry, this.#config);
  }

  clear(): void {
    this.#entry = null;
  }
}
