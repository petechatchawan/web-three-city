import { describe, expect, it } from 'vitest';
import * as economy from '../src/index.js';
import { macroHourIndex, macroHourValue } from '@web-three-city/simulation-core';

describe('EconomySaveV1', () => {
  const rules = economy.FOUNDATION_ECONOMY_RULES;
  const snapshot = economy.createInitialEconomySnapshot(
    { year: 2, month: 12, latestCycleSettlementAtMacroHourIndex: macroHourIndex(8_600) },
    rules,
  );

  it('round-trips every Economy-owned field', () => {
    const encoded = economy.encodeEconomySaveV1(snapshot);
    expect(economy.decodeEconomySaveV1(encoded, rules)).toEqual({ ok: true, value: snapshot });
  });

  it('keeps legacy V1 wire names while decoding markers as macro-hour values', () => {
    const closed = economy.closeAccountingPeriod(
      snapshot,
      {
        baseRevision: snapshot.revision,
        atMacroHourIndex: macroHourIndex(8_600),
        nextPeriod: { year: 3, month: 1 },
      },
      rules,
    );
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;

    const encoded = economy.encodeEconomySaveV1(closed.snapshot);
    expect(encoded).toMatchObject({
      schemaVersion: 1,
      lastDailySettlementTick: 8_600,
      lastMonthlyCloseTick: 8_600,
    });
    expect(encoded).not.toHaveProperty('latestCycleSettlementAtMacroHourIndex');
    expect(encoded).not.toHaveProperty('lastMonthlyCloseAtMacroHourIndex');

    const decoded = economy.decodeEconomySaveV1(encoded, rules);
    expect(decoded).toEqual({ ok: true, value: closed.snapshot });
    if (decoded.ok) {
      expect(macroHourValue(decoded.value.latestCycleSettlementAtMacroHourIndex)).toBe(8_600);
      expect(macroHourValue(decoded.value.lastMonthlyCloseAtMacroHourIndex!)).toBe(8_600);
    }
  });

  it('maps legacy marker values 1:1 without calendar-unit conversion', () => {
    const encoded = economy.encodeEconomySaveV1(snapshot);
    const decoded = economy.decodeEconomySaveV1(
      { ...encoded, lastDailySettlementTick: 287, lastMonthlyCloseTick: 288 },
      rules,
    );
    expect(decoded).toMatchObject({ ok: true });
    if (decoded.ok) {
      expect(macroHourValue(decoded.value.latestCycleSettlementAtMacroHourIndex)).toBe(287);
      expect(macroHourValue(decoded.value.lastMonthlyCloseAtMacroHourIndex!)).toBe(288);
    }
  });

  it.each([
    ['fractional treasury', { treasuryBalanceMinor: 0.5 }],
    ['unsafe treasury', { treasuryBalanceMinor: Number.MAX_SAFE_INTEGER + 1 }],
    ['unknown rules', { rulesVersion: 'unknown' }],
    ['negative settlement marker', { lastDailySettlementTick: -1 }],
    ['fractional settlement marker', { lastDailySettlementTick: 1.5 }],
    ['unsafe settlement marker', { lastDailySettlementTick: Number.MAX_SAFE_INTEGER + 1 }],
    ['fractional monthly close marker', { lastMonthlyCloseTick: 1.5 }],
    ['unsafe monthly close marker', { lastMonthlyCloseTick: Number.MAX_SAFE_INTEGER + 1 }],
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
