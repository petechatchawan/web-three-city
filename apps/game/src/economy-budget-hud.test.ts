import {
  createInitialEconomySnapshot,
  FOUNDATION_ECONOMY_RULES,
} from '@web-three-city/economy-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEconomyViewProjection, mountEconomyBudgetHud } from './economy-budget-hud.js';

afterEach(() => document.body.replaceChildren());

describe('Economy Budget HUD', () => {
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

  it('submits a typed whole-percent policy and renders accepted committed state', () => {
    const panel = document.createElement('aside');
    document.body.append(panel);
    const initial = createInitialEconomySnapshot(
      { year: 1, month: 1, latestDailySettlementTick: 8 },
      FOUNDATION_ECONOMY_RULES,
    );
    const onPolicy = vi.fn(() => ({ status: 'accepted' as const }));
    const hud = mountEconomyBudgetHud(panel, onPolicy);
    hud.update(initial);

    const residential = panel.querySelector<HTMLSelectElement>('[data-testid="tax-residential"]');
    const apply = panel.querySelector<HTMLButtonElement>('[data-testid="apply-tax-policy"]');
    expect(residential).not.toBeNull();
    expect(apply).not.toBeNull();
    if (residential === null || apply === null) return;
    residential.value = '8';
    residential.dispatchEvent(new Event('change'));
    hud.update(initial);
    expect(residential.value).toBe('8');
    apply.click();

    expect(onPolicy).toHaveBeenCalledWith({
      residentialBp: 800,
      commercialBp: 700,
      industrialBp: 700,
    });
    expect(panel.querySelector('[role="status"]')?.textContent).toBe('Tax policy updated');
  });
});
