import type { WorldConfig } from '@web-three-city/world-core';
import { createTerrainMap, type TerrainSnapshot } from './terrain-map.js';

interface UndoEntry {
  readonly heightLevels: Uint8Array;
  readonly seed: number;
  readonly generatorVersion: TerrainSnapshot['generatorVersion'];
  readonly generationAttempt: number;
}

export class TerraformUndoStore {
  #entry: UndoEntry | null = null;

  get available(): boolean {
    return this.#entry !== null;
  }

  captureBeforeCommit(snapshot: TerrainSnapshot): void {
    this.#entry = {
      heightLevels: snapshot.heightLevels.slice(),
      seed: snapshot.seed,
      generatorVersion: snapshot.generatorVersion,
      generationAttempt: snapshot.generationAttempt,
    };
  }

  clear(): void {
    this.#entry = null;
  }

  undo(current: TerrainSnapshot, config: WorldConfig): TerrainSnapshot | null {
    const entry = this.#entry;
    if (entry === null) return null;
    this.#entry = null;

    return createTerrainMap({
      config,
      heightLevels: entry.heightLevels,
      seed: entry.seed,
      generatorVersion: entry.generatorVersion,
      generationAttempt: entry.generationAttempt,
      revision: current.revision + 1,
    });
  }
}
