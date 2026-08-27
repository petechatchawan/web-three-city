import { describe, expect, it } from 'vitest';
import * as economy from '../src/index.js';
import { macroHourIndex } from '@web-three-city/simulation-core';

describe('EconomySnapshotV1', () => {
  it('exposes the snapshot lifecycle API', () => {
    expect(economy).toHaveProperty('createInitialEconomySnapshot');
    expect(economy).toHaveProperty('cloneEconomySnapshot');
    expect(economy).toHaveProperty('validateEconomySnapshot');
    expect(economy).toHaveProperty('fingerprintEconomySnapshot');
  });

  it('creates a zero-history snapshot from rules and canonical calendar input', () => {
    const snapshot = economy.createInitialEconomySnapshot(
      { year: 1, month: 1, latestCycleSettlementAtMacroHourIndex: macroHourIndex(8) },
      economy.FOUNDATION_ECONOMY_RULES,
    );

    expect(snapshot).toEqual({
      revision: 0,
      rulesVersion: 'economy-rules.foundation.v1',
      treasuryBalanceMinor: 10_000_000,
      taxPolicy: { residentialBp: 700, commercialBp: 700, industrialBp: 700 },
      currentPeriod: {
        year: 1,
        month: 1,
        taxRevenue: { residentialMinor: 0, commercialMinor: 0, industrialMinor: 0 },
        expenses: {
          roadConstructionMinor: 0,
          terraformMinor: 0,
          bulldozeMinor: 0,
          roadMaintenanceMinor: 0,
        },
        refundsMinor: 0,
      },
      previousPeriod: null,
      latestCycleSettlementAtMacroHourIndex: macroHourIndex(8),
      lastMonthlyCloseAtMacroHourIndex: null,
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.taxPolicy)).toBe(true);
    expect(Object.isFrozen(snapshot.currentPeriod)).toBe(true);
    expect(Object.isFrozen(snapshot.currentPeriod.taxRevenue)).toBe(true);
  });

  it('deep-clones snapshots and produces a stable structural fingerprint', () => {
    const snapshot = economy.createInitialEconomySnapshot(
      { year: 2, month: 3, latestCycleSettlementAtMacroHourIndex: macroHourIndex(800) },
      economy.FOUNDATION_ECONOMY_RULES,
    );
    const clone = economy.cloneEconomySnapshot(snapshot);

    expect(clone).toEqual(snapshot);
    expect(clone).not.toBe(snapshot);
    expect(clone.taxPolicy).not.toBe(snapshot.taxPolicy);
    expect(clone.currentPeriod).not.toBe(snapshot.currentPeriod);
    expect(Object.isFrozen(clone)).toBe(true);
    expect(economy.fingerprintEconomySnapshot(clone)).toBe(
      economy.fingerprintEconomySnapshot(snapshot),
    );
    expect(
      economy.fingerprintEconomySnapshot({ ...clone, treasuryBalanceMinor: 9_999_999 }),
    ).not.toBe(economy.fingerprintEconomySnapshot(snapshot));
  });

  it('refuses to construct a snapshot from invalid calendar input or rules', () => {
    expect(() =>
      economy.createInitialEconomySnapshot(
        { year: 1, month: 13, latestCycleSettlementAtMacroHourIndex: macroHourIndex(8) },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toThrow('economy:invalid-initial-snapshot');
    expect(() =>
      economy.createInitialEconomySnapshot(
        { year: 1, month: 1, latestCycleSettlementAtMacroHourIndex: macroHourIndex(8) },
        { ...economy.FOUNDATION_ECONOMY_RULES, initialTreasuryMinor: 0.5 },
      ),
    ).toThrow('economy:invalid-rules');
  });

  it('rejects invalid revisions, calendar values, rates, money, and rule versions', () => {
    const snapshot = economy.createInitialEconomySnapshot(
      { year: 1, month: 1, latestCycleSettlementAtMacroHourIndex: macroHourIndex(8) },
      economy.FOUNDATION_ECONOMY_RULES,
    );

    expect(economy.validateEconomySnapshot(snapshot, economy.FOUNDATION_ECONOMY_RULES)).toBe(true);
    expect(
      economy.validateEconomySnapshot(
        { ...snapshot, revision: -1 },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toBe(false);
    expect(
      economy.validateEconomySnapshot(
        { ...snapshot, treasuryBalanceMinor: 0.5 },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toBe(false);
    expect(
      economy.validateEconomySnapshot(
        { ...snapshot, taxPolicy: { ...snapshot.taxPolicy, residentialBp: 2_001 } },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toBe(false);
    expect(
      economy.validateEconomySnapshot(
        { ...snapshot, currentPeriod: { ...snapshot.currentPeriod, month: 13 } },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toBe(false);
    expect(
      economy.validateEconomySnapshot(
        { ...snapshot, rulesVersion: 'economy-rules.unknown' },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toBe(false);
  });
});
