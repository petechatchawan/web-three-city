import { describe, expect, it } from 'vitest';
import * as rci from '../src/index.js';

describe('@web-three-city/rci-core public boundary', () => {
  it('exports only intentional foundation entry points', () => {
    expect(Object.keys(rci).sort()).toEqual([
      'DEFAULT_RCI_DETERMINISTIC_SEED',
      'RCI_DAYS_PER_YEAR',
      'RCI_TICKS_PER_DAY',
      'RCI_TICKS_PER_YEAR',
      'RciContractError',
      'ageBandAtTick',
      'ageYearsAtTick',
      'createFoundationRciRegistries',
      'createInitialRciSnapshot',
      'createRciCurrentStateIndex',
      'createRciSnapshot',
      'decodeRciSaveV1',
      'encodeRciSaveV1',
      'isDailyLifecycleTick',
      'validateRciSnapshot',
    ]);
  });
});
