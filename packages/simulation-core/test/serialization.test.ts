import { describe, expect, it } from 'vitest';
import {
  createSimulationSnapshot,
  decodeSimulationSaveV1,
  decodeSimulationSaveV2,
  encodeSimulationSaveV1,
  encodeSimulationSaveV2,
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

describe('SimulationSaveV2', () => {
  it('round trips the authoritative revision for deterministic continuation', () => {
    const snapshot = createSimulationSnapshot({
      revision: 7,
      absoluteTick: 99,
      growthSequence: 4,
    });
    const decoded = decodeSimulationSaveV2(encodeSimulationSaveV2(snapshot));
    expect(decoded).toEqual({ ok: true, value: snapshot });
  });

  it('fails closed for malformed revisions', () => {
    expect(
      decodeSimulationSaveV2({
        kind: 'simulation-save',
        schemaVersion: 2,
        revision: -1,
        absoluteTick: 99,
        growthSequence: 4,
      }).ok,
    ).toBe(false);
  });
});
