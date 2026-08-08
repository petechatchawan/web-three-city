import type { BasisPoints, MoneyMinor } from './money.js';

export interface EconomyRulesV1 {
  readonly schemaVersion: 1;
  readonly rulesVersion: 'economy-rules.foundation.v1';
  readonly initialTreasuryMinor: MoneyMinor;
  readonly defaultResidentialTaxRateBp: BasisPoints;
  readonly defaultCommercialTaxRateBp: BasisPoints;
  readonly defaultIndustrialTaxRateBp: BasisPoints;
  readonly minimumTaxRateBp: BasisPoints;
  readonly maximumTaxRateBp: BasisPoints;
  readonly dailyResidentialBasePerOccupiedDwellingMinor: MoneyMinor;
  readonly dailyCommercialBasePerOccupiedPositionMinor: MoneyMinor;
  readonly dailyIndustrialBasePerOccupiedPositionMinor: MoneyMinor;
  readonly roadConstructionCostPerAddedCellMinor: MoneyMinor;
  readonly roadMaintenanceCostPerOccupiedCellMinor: MoneyMinor;
  readonly terraformRaiseCostPerChangedVertexMinor: MoneyMinor;
  readonly terraformLowerCostPerChangedVertexMinor: MoneyMinor;
  readonly terraformFlattenCostPerChangedVertexMinor: MoneyMinor;
  readonly bulldozeCostPerRemovedCellMinor: MoneyMinor;
  readonly neutralTaxRateBp: BasisPoints;
  readonly taxPressureFullSpanBp: BasisPoints;
  readonly rciTaxFactorWeightMilli: number;
}

export const FOUNDATION_ECONOMY_RULES: EconomyRulesV1 = Object.freeze({
  schemaVersion: 1,
  rulesVersion: 'economy-rules.foundation.v1',
  initialTreasuryMinor: 10_000_000,
  defaultResidentialTaxRateBp: 700,
  defaultCommercialTaxRateBp: 700,
  defaultIndustrialTaxRateBp: 700,
  minimumTaxRateBp: 0,
  maximumTaxRateBp: 2_000,
  dailyResidentialBasePerOccupiedDwellingMinor: 10_000,
  dailyCommercialBasePerOccupiedPositionMinor: 15_000,
  dailyIndustrialBasePerOccupiedPositionMinor: 12_000,
  roadConstructionCostPerAddedCellMinor: 50_000,
  roadMaintenanceCostPerOccupiedCellMinor: 100,
  terraformRaiseCostPerChangedVertexMinor: 2_500,
  terraformLowerCostPerChangedVertexMinor: 2_500,
  terraformFlattenCostPerChangedVertexMinor: 3_500,
  bulldozeCostPerRemovedCellMinor: 10_000,
  neutralTaxRateBp: 700,
  taxPressureFullSpanBp: 2_000,
  rciTaxFactorWeightMilli: 250,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const COST_KEYS = [
  'initialTreasuryMinor',
  'dailyResidentialBasePerOccupiedDwellingMinor',
  'dailyCommercialBasePerOccupiedPositionMinor',
  'dailyIndustrialBasePerOccupiedPositionMinor',
  'roadConstructionCostPerAddedCellMinor',
  'roadMaintenanceCostPerOccupiedCellMinor',
  'terraformRaiseCostPerChangedVertexMinor',
  'terraformLowerCostPerChangedVertexMinor',
  'terraformFlattenCostPerChangedVertexMinor',
  'bulldozeCostPerRemovedCellMinor',
] as const;

const RATE_KEYS = [
  'defaultResidentialTaxRateBp',
  'defaultCommercialTaxRateBp',
  'defaultIndustrialTaxRateBp',
  'minimumTaxRateBp',
  'maximumTaxRateBp',
  'neutralTaxRateBp',
] as const;

export const validateEconomyRules = (value: unknown): value is EconomyRulesV1 => {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.rulesVersion !== 'economy-rules.foundation.v1' ||
    !COST_KEYS.every((key) => isNonNegativeSafeInteger(value[key])) ||
    !RATE_KEYS.every((key) => isNonNegativeSafeInteger(value[key]) && value[key] <= 10_000) ||
    !isNonNegativeSafeInteger(value.taxPressureFullSpanBp) ||
    value.taxPressureFullSpanBp === 0 ||
    value.taxPressureFullSpanBp > 10_000 ||
    !isNonNegativeSafeInteger(value.rciTaxFactorWeightMilli) ||
    value.rciTaxFactorWeightMilli > 1_000
  ) {
    return false;
  }

  const minimum = value.minimumTaxRateBp as number;
  const maximum = value.maximumTaxRateBp as number;
  return (
    minimum <= maximum &&
    (value.defaultResidentialTaxRateBp as number) >= minimum &&
    (value.defaultResidentialTaxRateBp as number) <= maximum &&
    (value.defaultCommercialTaxRateBp as number) >= minimum &&
    (value.defaultCommercialTaxRateBp as number) <= maximum &&
    (value.defaultIndustrialTaxRateBp as number) >= minimum &&
    (value.defaultIndustrialTaxRateBp as number) <= maximum &&
    (value.neutralTaxRateBp as number) >= minimum &&
    (value.neutralTaxRateBp as number) <= maximum
  );
};
