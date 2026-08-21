import { describe, expect, it } from 'vitest';
import { migrateSimulationSaveV2ToV3, type SimulationSaveV2 } from '../src/index.js';

describe('SimulationSaveV3', () => {
  it('migrates the V2 macro-hour checkpoint to its exact game minute', () => {
    const v2: SimulationSaveV2 = {
      kind: 'simulation-save',
      schemaVersion: 2,
      revision: 7,
      absoluteTick: 8,
      growthSequence: 4,
    };

    expect(migrateSimulationSaveV2ToV3(v2)).toEqual({
      kind: 'simulation-save',
      schemaVersion: 3,
      revision: 7,
      absoluteGameMinute: 480,
      growthSequence: 4,
    });
  });

  it('rejects V2 ticks whose minute conversion exceeds safe integer precision', () => {
    const v2: SimulationSaveV2 = {
      kind: 'simulation-save',
      schemaVersion: 2,
      revision: 7,
      absoluteTick: Math.floor(Number.MAX_SAFE_INTEGER / 60) + 1,
      growthSequence: 4,
    };

    expect(() => migrateSimulationSaveV2ToV3(v2)).toThrow(
      new RangeError('simulation-save:minute-overflow'),
    );
  });
});
