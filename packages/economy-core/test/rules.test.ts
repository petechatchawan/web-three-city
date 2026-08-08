import { describe, expect, it } from 'vitest';
import * as economy from '../src/index.js';

describe('EconomyRulesV1', () => {
  it('exports one versioned foundation rules authority and validator', () => {
    expect(economy).toHaveProperty('FOUNDATION_ECONOMY_RULES');
    expect(economy).toHaveProperty('validateEconomyRules');
  });

  it('freezes the approved foundation values in one valid asset', () => {
    expect(economy.FOUNDATION_ECONOMY_RULES).toMatchObject({
      rulesVersion: 'economy-rules.foundation.v1',
      initialTreasuryMinor: 10_000_000,
      defaultResidentialTaxRateBp: 700,
      defaultCommercialTaxRateBp: 700,
      defaultIndustrialTaxRateBp: 700,
      roadConstructionCostPerAddedCellMinor: 50_000,
      roadMaintenanceCostPerOccupiedCellMinor: 100,
      terraformRaiseCostPerChangedVertexMinor: 2_500,
      terraformLowerCostPerChangedVertexMinor: 2_500,
      terraformFlattenCostPerChangedVertexMinor: 3_500,
      bulldozeCostPerRemovedCellMinor: 10_000,
    });
    expect(Object.isFrozen(economy.FOUNDATION_ECONOMY_RULES)).toBe(true);
    expect(economy.validateEconomyRules(economy.FOUNDATION_ECONOMY_RULES)).toBe(true);
  });

  it('rejects unknown versions, invalid tax bounds, and negative or fractional values', () => {
    expect(
      economy.validateEconomyRules({
        ...economy.FOUNDATION_ECONOMY_RULES,
        rulesVersion: 'economy-rules.unknown',
      }),
    ).toBe(false);
    expect(
      economy.validateEconomyRules({
        ...economy.FOUNDATION_ECONOMY_RULES,
        minimumTaxRateBp: 800,
        maximumTaxRateBp: 700,
      }),
    ).toBe(false);
    expect(
      economy.validateEconomyRules({
        ...economy.FOUNDATION_ECONOMY_RULES,
        roadMaintenanceCostPerOccupiedCellMinor: -1,
      }),
    ).toBe(false);
    expect(
      economy.validateEconomyRules({
        ...economy.FOUNDATION_ECONOMY_RULES,
        initialTreasuryMinor: 0.5,
      }),
    ).toBe(false);
    expect(
      economy.validateEconomyRules({
        ...economy.FOUNDATION_ECONOMY_RULES,
        taxPressureFullSpanBp: 10_001,
      }),
    ).toBe(false);
  });
});
