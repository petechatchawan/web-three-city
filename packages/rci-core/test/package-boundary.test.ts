import { describe, expect, it } from 'vitest';
import * as rci from '../src/index.js';

describe('@web-three-city/rci-core public boundary', () => {
  it('exports only intentional foundation entry points', () => {
    expect(Object.keys(rci).sort()).toEqual([
      'ANNUAL_RATE_SCALE',
      'DEFAULT_RCI_DETERMINISTIC_SEED',
      'DETERMINISTIC_SAMPLE_ALGORITHM',
      'PROBABILITY_SCALE',
      'RCI_DAYS_PER_YEAR',
      'RCI_TICKS_PER_DAY',
      'RCI_TICKS_PER_YEAR',
      'RciContractError',
      'ageBandAtTick',
      'ageYearsAtTick',
      'compileAnnualRateToDailyHazard',
      'createFoundationRciRegistries',
      'createInitialRciSnapshot',
      'createRciCurrentStateIndex',
      'createRciSnapshot',
      'decodeRciSaveV1',
      'deterministicSample',
      'encodeRciSaveV1',
      'isDailyLifecycleTick',
      'sampleSucceeds',
      'validateRciSnapshot',
    ]);
  });
});
