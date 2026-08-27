import { describe, expect, it } from 'vitest';
import { absoluteGameMinute } from '../../simulation-core/src/temporal-units.js';
import {
  TRANSPORT_QUANTA_PER_GAME_MINUTE,
  absoluteTransportSecond,
  addTransportSeconds,
  compareTransportSeconds,
  createTrafficTimeCursor,
  legacyGameSecondAtTransportSecond,
  transportSecondAtLegacyGameSecond,
  transportSecondAtGameMinute,
  transportSecondDuration,
  transportSecondDurationBetween,
  transportSecondValue,
} from '../src/transport-time.js';

describe('Traffic transport temporal contracts', () => {
  it('accepts only non-negative safe-integer transport seconds and durations', () => {
    expect(transportSecondValue(absoluteTransportSecond(0))).toBe(0);
    expect(transportSecondValue(transportSecondDuration(12))).toBe(12);

    for (const value of [
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(() => absoluteTransportSecond(value)).toThrow('traffic:invalid-state');
      expect(() => transportSecondDuration(value)).toThrow('traffic:invalid-state');
    }
  });

  it('converts an absolute game minute through the Traffic-owned four-quanta policy', () => {
    expect(TRANSPORT_QUANTA_PER_GAME_MINUTE).toBe(4);
    expect(transportSecondValue(transportSecondAtGameMinute(absoluteGameMinute(0)))).toBe(0);
    expect(transportSecondValue(transportSecondAtGameMinute(absoluteGameMinute(1)))).toBe(4);
    expect(transportSecondValue(transportSecondAtGameMinute(absoluteGameMinute(480)))).toBe(1_920);
    expect(() =>
      transportSecondAtGameMinute(absoluteGameMinute(Math.floor(Number.MAX_SAFE_INTEGER / 4) + 1)),
    ).toThrow('traffic:invalid-state');
  });

  it('supports checked same-unit point arithmetic and comparison', () => {
    const point = absoluteTransportSecond(1_920);
    expect(transportSecondValue(addTransportSeconds(point, transportSecondDuration(4)))).toBe(
      1_924,
    );
    expect(compareTransportSeconds(point, absoluteTransportSecond(1_919))).toBe(1);
    expect(compareTransportSeconds(point, absoluteTransportSecond(1_920))).toBe(0);
    expect(compareTransportSeconds(point, absoluteTransportSecond(1_921))).toBe(-1);
    expect(() =>
      addTransportSeconds(
        absoluteTransportSecond(Number.MAX_SAFE_INTEGER),
        transportSecondDuration(1),
      ),
    ).toThrow('traffic:invalid-state');
  });

  it('derives a non-negative duration between ordered transport points', () => {
    expect(
      transportSecondValue(
        transportSecondDurationBetween(absoluteTransportSecond(25), absoluteTransportSecond(12)),
      ),
    ).toBe(13);
    expect(
      transportSecondValue(
        transportSecondDurationBetween(absoluteTransportSecond(12), absoluteTransportSecond(12)),
      ),
    ).toBe(0);
    expect(() =>
      transportSecondDurationBetween(absoluteTransportSecond(11), absoluteTransportSecond(12)),
    ).toThrow('traffic:invalid-state');
  });

  it('keeps the cursor source minute and transport point explicitly typed', () => {
    const cursor = createTrafficTimeCursor({
      sourceGameMinute: absoluteGameMinute(480),
      completedTransportQuantaWithinMinute: 0,
      absoluteTransportSecond: transportSecondAtGameMinute(absoluteGameMinute(480)),
      temporalPolicyVersion: 1,
    });

    expect(cursor.sourceGameMinute).toBe(480);
    expect(transportSecondValue(cursor.absoluteTransportSecond)).toBe(1_920);
  });

  it('keeps legacy GameSecond compatibility conversions inside Traffic authority', () => {
    expect(transportSecondValue(transportSecondAtLegacyGameSecond(998))).toBe(3_992);
    expect(legacyGameSecondAtTransportSecond(absoluteTransportSecond(3_999))).toBe(999);
    expect(() => transportSecondAtLegacyGameSecond(-1)).toThrow('traffic:invalid-state');
  });
});
