import { describe, expect, it } from 'vitest';
import * as rci from '../src/index.js';

describe('@web-three-city/rci-core public boundary', () => {
  it('exports only intentional foundation entry points', () => {
    expect(Object.keys(rci).sort()).toEqual([
      'DEFAULT_RCI_DETERMINISTIC_SEED',
      'RciContractError',
      'createFoundationRciRegistries',
      'createInitialRciSnapshot',
      'createRciSnapshot',
      'decodeRciSaveV1',
      'encodeRciSaveV1',
      'validateRciSnapshot',
    ]);
  });
});
