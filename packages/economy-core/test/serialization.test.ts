import { describe, expect, it } from 'vitest';
import * as economy from '../src/index.js';

describe('EconomySaveV1', () => {
  const rules = economy.FOUNDATION_ECONOMY_RULES;
  const snapshot = economy.createInitialEconomySnapshot(
    { year: 2, month: 12, latestDailySettlementTick: 8_600 },
    rules,
  );

  it('round-trips every Economy-owned field', () => {
    const encoded = economy.encodeEconomySaveV1(snapshot);
    expect(economy.decodeEconomySaveV1(encoded, rules)).toEqual({ ok: true, value: snapshot });
  });

  it.each([
    ['fractional treasury', { treasuryBalanceMinor: 0.5 }],
    ['unsafe treasury', { treasuryBalanceMinor: Number.MAX_SAFE_INTEGER + 1 }],
    ['unknown rules', { rulesVersion: 'unknown' }],
    ['negative settlement marker', { lastDailySettlementTick: -1 }],
  ])('rejects malformed %s', (_name, change) => {
    const encoded = economy.encodeEconomySaveV1(snapshot);
    expect(economy.decodeEconomySaveV1({ ...encoded, ...change }, rules)).toEqual({
      ok: false,
      reason: 'invalid-save',
    });
  });

  it('validates rules before attempting to trust or decode JSON', () => {
    expect(economy.decodeEconomySaveV1({}, { ...rules, taxPressureFullSpanBp: 0 })).toEqual({
      ok: false,
      reason: 'invalid-rules',
    });
  });
});
