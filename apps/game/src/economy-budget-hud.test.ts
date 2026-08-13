import {
  createInitialEconomySnapshot,
  FOUNDATION_ECONOMY_RULES,
} from '@web-three-city/economy-core';
import { describe, expect, it } from 'vitest';
import { createEconomyViewProjection } from './economy-budget-hud.js';

describe('Economy budget projection', () => {
  it('projects immutable accounting into deterministic display values', () => {
    const initial = createInitialEconomySnapshot(
      { year: 1, month: 2, latestDailySettlementTick: 728 },
      FOUNDATION_ECONOMY_RULES,
    );
    const snapshot = {
      ...initial,
      treasuryBalanceMinor: 9_245_000,
      currentPeriod: {
        ...initial.currentPeriod,
        taxRevenue: {
          residentialMinor: 100_000,
          commercialMinor: 20_000,
          industrialMinor: 4_000,
        },
        expenses: {
          roadConstructionMinor: 30_000,
          terraformMinor: 10_000,
          bulldozeMinor: 2_000,
          roadMaintenanceMinor: 10_000,
        },
      },
    };

    expect(createEconomyViewProjection(snapshot)).toMatchObject({
      treasury: '92,450.00',
      income: '+1,240.00',
      expenses: '-520.00',
      net: '+720.00',
      currentPeriodLabel: 'Year 1 · Month 2',
      residentialTax: '7%',
    });
    expect(snapshot).toEqual(expect.objectContaining({ treasuryBalanceMinor: 9_245_000 }));
  });
});
