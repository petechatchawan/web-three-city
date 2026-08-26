import { describe, expect, it } from 'vitest';
import {
  createInitialSimulationSnapshot,
  createSimulationSnapshot,
  gameMinuteValue,
  type AbsoluteGameMinute,
} from '../src/index.js';

describe('simulation snapshot', () => {
  it('creates immutable initial authority', () => {
    const snapshot = createInitialSimulationSnapshot();
    const minute: AbsoluteGameMinute = snapshot.absoluteGameMinute;
    expect(gameMinuteValue(minute)).toBe(480);
    expect(snapshot).toEqual({ revision: 0, absoluteGameMinute: 480, growthSequence: 0 });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('rejects invalid authority', () => {
    expect(() =>
      createSimulationSnapshot({ revision: -1, absoluteGameMinute: 480, growthSequence: 0 }),
    ).toThrow();
    expect(() =>
      createSimulationSnapshot({ revision: 0, absoluteGameMinute: -1, growthSequence: 0 }),
    ).toThrow();
    expect(() =>
      createSimulationSnapshot({ revision: 0, absoluteGameMinute: 480, growthSequence: -1 }),
    ).toThrow();
  });
});
