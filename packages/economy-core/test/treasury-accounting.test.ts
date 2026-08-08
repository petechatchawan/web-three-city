import { describe, expect, it } from 'vitest';
import * as economy from '../src/index.js';

describe('treasury, policy, and accounting commands', () => {
  const createSnapshot = () =>
    economy.createInitialEconomySnapshot(
      { year: 1, month: 1, latestDailySettlementTick: 8 },
      economy.FOUNDATION_ECONOMY_RULES,
    );

  const createDelta = (): economy.EconomyAccountingDelta => ({
    taxRevenue: { residentialMinor: 0, commercialMinor: 0, industrialMinor: 0 },
    expenses: {
      roadConstructionMinor: 0,
      terraformMinor: 0,
      bulldozeMinor: 0,
      roadMaintenanceMinor: 0,
    },
    refundsMinor: 0,
  });

  it('exposes the approved pure command surface', () => {
    expect(economy).toHaveProperty('applyTaxPolicy');
    expect(economy).toHaveProperty('applyEconomyDelta');
    expect(economy).toHaveProperty('closeAccountingPeriod');
    expect(economy).toHaveProperty('quoteEconomyCost');
    expect(economy).toHaveProperty('deriveAccountingPeriodSummary');
  });

  it('applies a valid tax policy immutably and increments revision once', () => {
    const before = createSnapshot();
    const result = economy.applyTaxPolicy(
      before,
      {
        baseRevision: 0,
        policy: { residentialBp: 650, commercialBp: 750, industrialBp: 800 },
      },
      economy.FOUNDATION_ECONOMY_RULES,
    );

    expect(result).toMatchObject({
      ok: true,
      snapshot: {
        revision: 1,
        taxPolicy: { residentialBp: 650, commercialBp: 750, industrialBp: 800 },
      },
    });
    expect(economy.fingerprintEconomySnapshot(before)).toBe(
      economy.fingerprintEconomySnapshot(createSnapshot()),
    );
    if (result.ok) {
      expect(Object.isFrozen(result.snapshot)).toBe(true);
      expect(Object.isFrozen(result.snapshot.taxPolicy)).toBe(true);
    }
  });

  it('rejects stale revisions and out-of-rules policy without changing input', () => {
    const before = createSnapshot();
    const fingerprint = economy.fingerprintEconomySnapshot(before);

    expect(
      economy.applyTaxPolicy(
        before,
        {
          baseRevision: 1,
          policy: { residentialBp: 700, commercialBp: 700, industrialBp: 700 },
        },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toEqual({ ok: false, reason: 'stale-revision' });
    expect(
      economy.applyTaxPolicy(
        before,
        {
          baseRevision: 0,
          policy: { residentialBp: 2_001, commercialBp: 700, industrialBp: 700 },
        },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toEqual({ ok: false, reason: 'invalid-policy' });
    expect(economy.fingerprintEconomySnapshot(before)).toBe(fingerprint);
  });

  it('derives an affordable debit from categorized accounting and updates both authorities', () => {
    const before = createSnapshot();
    const result = economy.applyEconomyDelta(
      before,
      {
        baseRevision: 0,
        affordability: 'require-non-negative',
        delta: {
          ...createDelta(),
          expenses: { ...createDelta().expenses, roadConstructionMinor: 50_000 },
        },
      },
      economy.FOUNDATION_ECONOMY_RULES,
    );

    expect(result).toMatchObject({
      ok: true,
      snapshot: {
        revision: 1,
        treasuryBalanceMinor: 9_950_000,
        currentPeriod: { expenses: { roadConstructionMinor: 50_000 } },
      },
    });
    expect(before.treasuryBalanceMinor).toBe(10_000_000);
  });

  it('rejects an unaffordable immediate delta but allows recurring accounting to go negative', () => {
    const before = { ...createSnapshot(), treasuryBalanceMinor: 100 };
    const delta = {
      ...createDelta(),
      expenses: { ...createDelta().expenses, roadMaintenanceMinor: 200 },
    };

    expect(
      economy.applyEconomyDelta(
        before,
        { baseRevision: 0, affordability: 'require-non-negative', delta },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toEqual({
      ok: false,
      reason: 'insufficient-funds',
      availableMinor: 100,
      requiredMinor: 200,
    });
    const recurring = economy.applyEconomyDelta(
      before,
      { baseRevision: 0, affordability: 'allow-negative', delta },
      economy.FOUNDATION_ECONOMY_RULES,
    );
    expect(recurring).toMatchObject({
      ok: true,
      snapshot: {
        treasuryBalanceMinor: -100,
        currentPeriod: { expenses: { roadMaintenanceMinor: 200 } },
      },
    });
  });

  it('adds tax revenue and refunds as credits without rewriting expense totals', () => {
    const result = economy.applyEconomyDelta(
      createSnapshot(),
      {
        baseRevision: 0,
        affordability: 'allow-negative',
        delta: {
          ...createDelta(),
          taxRevenue: {
            residentialMinor: 100,
            commercialMinor: 200,
            industrialMinor: 300,
          },
          refundsMinor: 50,
        },
      },
      economy.FOUNDATION_ECONOMY_RULES,
    );
    expect(result).toMatchObject({
      ok: true,
      snapshot: {
        treasuryBalanceMinor: 10_000_650,
        currentPeriod: {
          taxRevenue: {
            residentialMinor: 100,
            commercialMinor: 200,
            industrialMinor: 300,
          },
          refundsMinor: 50,
        },
      },
    });
  });

  it('rejects stale, negative, fractional, and overflowing deltas without mutation', () => {
    const before = createSnapshot();
    const invalid = { ...createDelta(), refundsMinor: -1 };
    expect(
      economy.applyEconomyDelta(
        before,
        { baseRevision: 1, affordability: 'allow-negative', delta: createDelta() },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toEqual({ ok: false, reason: 'stale-revision' });
    expect(
      economy.applyEconomyDelta(
        before,
        { baseRevision: 0, affordability: 'allow-negative', delta: invalid },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toEqual({ ok: false, reason: 'invalid-delta' });
    expect(
      economy.applyEconomyDelta(
        before,
        {
          baseRevision: 0,
          affordability: 'allow-negative',
          delta: { ...createDelta(), refundsMinor: 0.5 },
        },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toEqual({ ok: false, reason: 'invalid-delta' });
    expect(
      economy.applyEconomyDelta(
        before,
        {
          baseRevision: 0,
          affordability: 'allow-negative',
          delta: { ...createDelta(), refundsMinor: Number.MAX_SAFE_INTEGER },
        },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toEqual({ ok: false, reason: 'overflow' });
    expect(
      economy.applyEconomyDelta(
        { ...before, treasuryBalanceMinor: 0 },
        {
          baseRevision: 0,
          affordability: 'require-non-negative',
          delta: {
            ...createDelta(),
            expenses: {
              roadConstructionMinor: Number.MAX_SAFE_INTEGER,
              terraformMinor: Number.MAX_SAFE_INTEGER,
              bulldozeMinor: 0,
              roadMaintenanceMinor: 0,
            },
          },
        },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toEqual({ ok: false, reason: 'overflow' });
    expect(before).toEqual(createSnapshot());
  });

  it('closes the current month into immutable previous history and opens an empty next month', () => {
    const accounted = economy.applyEconomyDelta(
      createSnapshot(),
      {
        baseRevision: 0,
        affordability: 'allow-negative',
        delta: {
          ...createDelta(),
          taxRevenue: { ...createDelta().taxRevenue, residentialMinor: 1_000 },
          expenses: { ...createDelta().expenses, roadMaintenanceMinor: 250 },
        },
      },
      economy.FOUNDATION_ECONOMY_RULES,
    );
    expect(accounted.ok).toBe(true);
    if (!accounted.ok) return;

    const closed = economy.closeAccountingPeriod(
      accounted.snapshot,
      { baseRevision: 1, atTick: 728, nextPeriod: { year: 1, month: 2 } },
      economy.FOUNDATION_ECONOMY_RULES,
    );
    expect(closed).toMatchObject({
      ok: true,
      snapshot: {
        revision: 2,
        treasuryBalanceMinor: 10_000_750,
        currentPeriod: {
          year: 1,
          month: 2,
          taxRevenue: { residentialMinor: 0, commercialMinor: 0, industrialMinor: 0 },
          expenses: {
            roadConstructionMinor: 0,
            terraformMinor: 0,
            bulldozeMinor: 0,
            roadMaintenanceMinor: 0,
          },
          refundsMinor: 0,
        },
        previousPeriod: {
          year: 1,
          month: 1,
          taxRevenue: { residentialMinor: 1_000 },
          expenses: { roadMaintenanceMinor: 250 },
        },
        lastMonthlyCloseTick: 728,
      },
    });
  });

  it('makes the same monthly close tick idempotent without another revision', () => {
    const first = economy.closeAccountingPeriod(
      createSnapshot(),
      { baseRevision: 0, atTick: 728, nextPeriod: { year: 1, month: 2 } },
      economy.FOUNDATION_ECONOMY_RULES,
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const duplicate = economy.closeAccountingPeriod(
      first.snapshot,
      { baseRevision: 1, atTick: 728, nextPeriod: { year: 1, month: 2 } },
      economy.FOUNDATION_ECONOMY_RULES,
    );
    expect(duplicate).toEqual({ ok: true, snapshot: first.snapshot });
    expect(
      economy.closeAccountingPeriod(
        first.snapshot,
        { baseRevision: 1, atTick: 728, nextPeriod: { year: 1, month: 3 } },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toEqual({ ok: false, reason: 'invalid-period' });
  });

  it('rejects stale close commands and non-sequential calendar periods', () => {
    const before = createSnapshot();
    expect(
      economy.closeAccountingPeriod(
        before,
        { baseRevision: 1, atTick: 728, nextPeriod: { year: 1, month: 2 } },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toEqual({ ok: false, reason: 'stale-revision' });
    expect(
      economy.closeAccountingPeriod(
        before,
        { baseRevision: 0, atTick: 728, nextPeriod: { year: 1, month: 3 } },
        economy.FOUNDATION_ECONOMY_RULES,
      ),
    ).toEqual({ ok: false, reason: 'invalid-period' });
  });

  it('rolls December into the next year and records later refunds only in the open period', () => {
    const december = economy.createInitialEconomySnapshot(
      { year: 1, month: 12, latestDailySettlementTick: 7_928 },
      economy.FOUNDATION_ECONOMY_RULES,
    );
    const closed = economy.closeAccountingPeriod(
      december,
      { baseRevision: 0, atTick: 8_648, nextPeriod: { year: 2, month: 1 } },
      economy.FOUNDATION_ECONOMY_RULES,
    );
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;

    const refunded = economy.applyEconomyDelta(
      closed.snapshot,
      {
        baseRevision: 1,
        affordability: 'allow-negative',
        delta: { ...createDelta(), refundsMinor: 500 },
      },
      economy.FOUNDATION_ECONOMY_RULES,
    );
    expect(refunded).toMatchObject({
      ok: true,
      snapshot: {
        currentPeriod: { year: 2, month: 1, refundsMinor: 500 },
        previousPeriod: { year: 1, month: 12, refundsMinor: 0 },
      },
    });
  });

  it('quotes unit costs with checked integer multiplication', () => {
    expect(economy.quoteEconomyCost(3, 50_000)).toEqual({ ok: true, totalMinor: 150_000 });
    expect(economy.quoteEconomyCost(-1, 50_000)).toEqual({
      ok: false,
      reason: 'invalid-input',
    });
    expect(economy.quoteEconomyCost(1.5, 50_000)).toEqual({
      ok: false,
      reason: 'invalid-input',
    });
    expect(economy.quoteEconomyCost(Number.MAX_SAFE_INTEGER, 2)).toEqual({
      ok: false,
      reason: 'overflow',
    });
  });

  it('derives period totals and net without storing duplicate aggregate state', () => {
    const period = {
      ...createSnapshot().currentPeriod,
      taxRevenue: { residentialMinor: 100, commercialMinor: 200, industrialMinor: 300 },
      expenses: {
        roadConstructionMinor: 100,
        terraformMinor: 50,
        bulldozeMinor: 25,
        roadMaintenanceMinor: 75,
      },
      refundsMinor: 50,
    };
    expect(economy.deriveAccountingPeriodSummary(period)).toEqual({
      ok: true,
      summary: { revenueMinor: 600, expensesMinor: 250, refundsMinor: 50, netMinor: 400 },
    });
    expect(
      economy.deriveAccountingPeriodSummary({
        ...period,
        taxRevenue: {
          residentialMinor: Number.MAX_SAFE_INTEGER,
          commercialMinor: Number.MAX_SAFE_INTEGER,
          industrialMinor: 0,
        },
      }),
    ).toEqual({ ok: false, reason: 'overflow' });
  });

  it('replays the same command sequence to the same snapshot and fingerprint', () => {
    const replay = (): economy.EconomySnapshotV1 => {
      const policy = economy.applyTaxPolicy(
        createSnapshot(),
        {
          baseRevision: 0,
          policy: { residentialBp: 650, commercialBp: 750, industrialBp: 800 },
        },
        economy.FOUNDATION_ECONOMY_RULES,
      );
      if (!policy.ok) throw new Error(policy.reason);

      const settlement = economy.applyEconomyDelta(
        policy.snapshot,
        {
          baseRevision: 1,
          affordability: 'allow-negative',
          delta: {
            ...createDelta(),
            taxRevenue: {
              residentialMinor: 1_000,
              commercialMinor: 500,
              industrialMinor: 250,
            },
            expenses: { ...createDelta().expenses, roadMaintenanceMinor: 300 },
          },
        },
        economy.FOUNDATION_ECONOMY_RULES,
      );
      if (!settlement.ok) throw new Error(settlement.reason);

      const refund = economy.applyEconomyDelta(
        settlement.snapshot,
        {
          baseRevision: 2,
          affordability: 'allow-negative',
          delta: { ...createDelta(), refundsMinor: 125 },
        },
        economy.FOUNDATION_ECONOMY_RULES,
      );
      if (!refund.ok) throw new Error(refund.reason);

      const close = economy.closeAccountingPeriod(
        refund.snapshot,
        { baseRevision: 3, atTick: 728, nextPeriod: { year: 1, month: 2 } },
        economy.FOUNDATION_ECONOMY_RULES,
      );
      if (!close.ok) throw new Error(close.reason);
      return close.snapshot;
    };

    const finalA = replay();
    const finalB = replay();

    expect(finalA).toEqual(finalB);
    expect(economy.fingerprintEconomySnapshot(finalA)).toBe(
      economy.fingerprintEconomySnapshot(finalB),
    );
  });
});
