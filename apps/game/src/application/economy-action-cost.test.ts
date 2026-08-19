import {
  createInitialEconomySnapshot,
  FOUNDATION_ECONOMY_RULES,
} from '@web-three-city/economy-core';
import { describe, expect, it } from 'vitest';
import {
  applyPaidActionCost,
  quoteBuildingBulldozeCost,
  quoteRoadMutationCost,
  quoteTerraformCost,
  refundPaidActionCost,
} from './economy-action-cost.js';

const rules = FOUNDATION_ECONOMY_RULES;
const snapshot = () =>
  createInitialEconomySnapshot({ year: 1, month: 1, latestDailySettlementTick: 8 }, rules);

describe('paid world-action Economy costs', () => {
  it('quotes validated plan counts and keeps road removal in bulldoze accounting', () => {
    expect(
      quoteRoadMutationCost({ valid: true, addedCellCount: 2, removedCellCount: 0 }, rules),
    ).toEqual({
      ok: true,
      category: 'roadConstruction',
      totalMinor: 100_000,
    });
    expect(
      quoteRoadMutationCost({ valid: true, addedCellCount: 0, removedCellCount: 3 }, rules),
    ).toEqual({
      ok: true,
      category: 'bulldoze',
      totalMinor: 30_000,
    });
    expect(
      quoteRoadMutationCost({ valid: true, addedCellCount: 0, removedCellCount: 0 }, rules),
    ).toEqual({
      ok: true,
      category: 'roadConstruction',
      totalMinor: 0,
    });
    expect(
      quoteRoadMutationCost({ valid: false, addedCellCount: 9, removedCellCount: 0 }, rules),
    ).toEqual({
      ok: false,
      reason: 'invalid-plan',
    });
  });

  it('quotes terraform operation and building footprint from validated receipts', () => {
    expect(
      quoteTerraformCost({ valid: true, operation: 'flatten', changedVertexCount: 4 }, rules),
    ).toEqual({
      ok: true,
      category: 'terraform',
      totalMinor: 14_000,
    });
    expect(quoteBuildingBulldozeCost({ valid: true, removedCellCount: 2 }, rules)).toEqual({
      ok: true,
      category: 'bulldoze',
      totalMinor: 20_000,
    });
  });

  it('rejects unaffordable actions without mutation and applies affordable categorized debits', () => {
    const poor = { ...snapshot(), treasuryBalanceMinor: 1 };
    expect(
      applyPaidActionCost(poor, { category: 'roadConstruction', totalMinor: 50_000 }, rules),
    ).toEqual({
      ok: false,
      reason: 'insufficient-funds',
      availableMinor: 1,
      requiredMinor: 50_000,
    });
    expect(poor.treasuryBalanceMinor).toBe(1);
    expect(
      applyPaidActionCost(snapshot(), { category: 'terraform', totalMinor: 2_500 }, rules),
    ).toMatchObject({
      ok: true,
      snapshot: {
        treasuryBalanceMinor: 9_997_500,
        currentPeriod: { expenses: { terraformMinor: 2_500 } },
      },
      receipt: { category: 'terraform', totalMinor: 2_500 },
    });
    expect(
      applyPaidActionCost(snapshot(), { category: 'roadConstruction', totalMinor: 0 }, rules),
    ).toMatchObject({
      ok: true,
      snapshot: {
        treasuryBalanceMinor: 10_000_000,
        currentPeriod: { expenses: { roadConstructionMinor: 0 } },
      },
      receipt: { category: 'roadConstruction', totalMinor: 0 },
    });
  });

  it('refunds an exact receipt into the current period without rewriting expenses', () => {
    const paid = applyPaidActionCost(
      snapshot(),
      { category: 'bulldoze', totalMinor: 10_000 },
      rules,
    );
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    const refunded = refundPaidActionCost(paid.snapshot, paid.receipt, rules);
    expect(refunded).toMatchObject({
      ok: true,
      snapshot: {
        treasuryBalanceMinor: 10_000_000,
        currentPeriod: { expenses: { bulldozeMinor: 10_000 }, refundsMinor: 10_000 },
      },
    });
  });
});
