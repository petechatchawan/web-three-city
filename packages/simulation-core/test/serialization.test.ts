import { describe, expect, it } from 'vitest';
import {
  createSimulationSnapshot,
  decodeSimulationSaveV1,
  decodeSimulationSaveV2,
  decodeSimulationSaveV3,
  encodeSimulationSaveV3,
} from '../src/index.js';

describe('SimulationSaveV1', () => {
  it('decodes legacy ticks as macro-hour-aligned game minutes', () => {
    const decoded = decodeSimulationSaveV1({
      kind: 'simulation-save',
      schemaVersion: 1,
      absoluteTick: 99,
      growthSequence: 4,
    });
    expect(decoded).toEqual({
      ok: true,
      value: { revision: 0, absoluteGameMinute: 5940, growthSequence: 4 },
    });
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
  it('decodes legacy ticks as macro-hour-aligned game minutes', () => {
    const decoded = decodeSimulationSaveV2({
      kind: 'simulation-save',
      schemaVersion: 2,
      revision: 7,
      absoluteTick: 99,
      growthSequence: 4,
    });
    expect(decoded).toEqual({
      ok: true,
      value: { revision: 7, absoluteGameMinute: 5940, growthSequence: 4 },
    });
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

describe('SimulationSaveV3', () => {
  it('round trips the minute-resolution canonical snapshot', () => {
    const snapshot = createSimulationSnapshot({
      revision: 7,
      absoluteGameMinute: 5941,
      growthSequence: 4,
    });
    expect(decodeSimulationSaveV3(encodeSimulationSaveV3(snapshot))).toEqual({
      ok: true,
      value: snapshot,
    });
  });
});
