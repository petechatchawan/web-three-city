import { describe, expect, it } from 'vitest';
import { createInitialSimulationSnapshot, createSimulationSnapshot } from '../src/index.js';

describe('simulation snapshot', () => {
  it('creates immutable initial authority', () => {
    const snapshot = createInitialSimulationSnapshot();
    expect(snapshot).toEqual({ revision: 0, absoluteTick: 8, growthSequence: 0 });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('rejects invalid authority', () => {
    expect(() =>
      createSimulationSnapshot({ revision: -1, absoluteTick: 8, growthSequence: 0 }),
    ).toThrow();
    expect(() =>
      createSimulationSnapshot({ revision: 0, absoluteTick: -1, growthSequence: 0 }),
    ).toThrow();
    expect(() =>
      createSimulationSnapshot({ revision: 0, absoluteTick: 8, growthSequence: -1 }),
    ).toThrow();
  });
});
