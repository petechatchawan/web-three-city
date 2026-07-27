import type { GridVertexCoord, WorldConfig } from '@web-three-city/world-core';
import { vertexIndex } from '@web-three-city/world-core';

export type TerrainInvariantErrorCode =
  | 'terrain:invalid-lattice-length'
  | 'terrain:invalid-height-range';

export class TerrainInvariantError extends Error {
  readonly code: TerrainInvariantErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: TerrainInvariantErrorCode, details: Readonly<Record<string, unknown>> = {}) {
    super(code);
    this.name = 'TerrainInvariantError';
    this.code = code;
    this.details = details;
  }
}

function assertHeightLevel(level: number, config: WorldConfig): void {
  if (
    !Number.isInteger(level) ||
    level < config.minHeightLevel ||
    level > config.maxHeightLevel
  ) {
    throw new TerrainInvariantError('terrain:invalid-height-range', { level });
  }
}

export class HeightLattice {
  readonly #config: WorldConfig;
  readonly #levels: Uint8Array;

  private constructor(config: WorldConfig, levels: Uint8Array) {
    this.#config = config;
    this.#levels = levels;
  }

  static filled(config: WorldConfig, level: number): HeightLattice {
    assertHeightLevel(level, config);
    const length = (config.mapWidth + 1) * (config.mapHeight + 1);
    return new HeightLattice(config, new Uint8Array(length).fill(level));
  }

  static from(config: WorldConfig, levels: ArrayLike<number>): HeightLattice {
    const expected = (config.mapWidth + 1) * (config.mapHeight + 1);
    if (levels.length !== expected) {
      throw new TerrainInvariantError('terrain:invalid-lattice-length', {
        expected,
        actual: levels.length,
      });
    }

    const copy = new Uint8Array(expected);
    for (let index = 0; index < expected; index += 1) {
      const level = levels[index] ?? Number.NaN;
      assertHeightLevel(level, config);
      copy[index] = level;
    }
    return new HeightLattice(config, copy);
  }

  get length(): number {
    return this.#levels.length;
  }

  get(coord: GridVertexCoord): number {
    return this.#levels[vertexIndex(coord, this.#config)]!;
  }

  withHeight(coord: GridVertexCoord, level: number): HeightLattice {
    assertHeightLevel(level, this.#config);
    const copy = this.#levels.slice();
    copy[vertexIndex(coord, this.#config)] = level;
    return new HeightLattice(this.#config, copy);
  }

  toUint8Array(): Uint8Array {
    return this.#levels.slice();
  }
}
