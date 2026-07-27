import type { WorldConfig } from '@web-three-city/world-core';
import { TerrainInvariantError } from './height-lattice.js';
import { validateTerrainInput } from './validation.js';

export interface TerrainMap {
  readonly width: number;
  readonly height: number;
  readonly heightLevels: Uint8Array;
  readonly seed: number;
  readonly generatorVersion: 'coastal-v1';
  readonly generationAttempt: number;
  readonly revision: number;
}

export type TerrainSnapshot = Readonly<TerrainMap>;

export interface CreateTerrainMapInput {
  readonly config: WorldConfig;
  readonly heightLevels: ArrayLike<number>;
  readonly seed: number;
  readonly generatorVersion: 'coastal-v1';
  readonly generationAttempt: number;
  readonly revision: number;
}

export function createTerrainMap(input: CreateTerrainMapInput): TerrainMap {
  const issues = validateTerrainInput(input.heightLevels, input.config);
  if (issues.length > 0) {
    throw new TerrainInvariantError('terrain:invalid-height-range', { issues });
  }

  const heightLevels = new Uint8Array(input.heightLevels.length);
  for (let index = 0; index < input.heightLevels.length; index += 1) {
    heightLevels[index] = input.heightLevels[index] ?? 0;
  }

  return Object.freeze({
    width: input.config.mapWidth,
    height: input.config.mapHeight,
    heightLevels,
    seed: input.seed,
    generatorVersion: input.generatorVersion,
    generationAttempt: input.generationAttempt,
    revision: input.revision,
  });
}
