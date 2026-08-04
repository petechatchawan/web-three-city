import { describe, expect, it } from 'vitest';
import {
  createSimulationSnapshot,
  decodeSimulationSaveV1,
  encodeSimulationSaveV1,
} from '../src/index.js';

describe('SimulationSaveV1', () => {
  it('round trips authoritative tick and growth sequence', () => {
    const snapshot = createSimulationSnapshot({
      revision: 7,
      absoluteTick: 99,
      growthSequence: 4,
    });
    const decoded = decodeSimulationSaveV1(encodeSimulationSaveV1(snapshot));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value).toEqual({ revision: 0, absoluteTick: 99, growthSequence: 4 });
    }
  });

  it('fails closed for malformed authority', () => {
    expect(
      decodeSimulationSaveV1({
        kind: 'simulation-save',
        schemaVersion: 1,
        absoluteTick: -1,
        growthSequence: 0,
      }).ok,
    ).toBe(false);
  });
});
