import { macroHourIndex, macroHourValue } from '@web-three-city/simulation-core';
import type { MacroHourIndex } from '@web-three-city/simulation-core';
import type { BasisPoints, MoneyMinor } from './money.js';
import type { EconomyRulesV1 } from './rules.js';
import { validateEconomyRules } from './rules.js';

export interface EconomyPeriodTotals {
  readonly year: number;
  readonly month: number;
  readonly taxRevenue: {
    readonly residentialMinor: MoneyMinor;
    readonly commercialMinor: MoneyMinor;
    readonly industrialMinor: MoneyMinor;
  };
  readonly expenses: {
    readonly roadConstructionMinor: MoneyMinor;
    readonly terraformMinor: MoneyMinor;
    readonly bulldozeMinor: MoneyMinor;
    readonly roadMaintenanceMinor: MoneyMinor;
  };
  readonly refundsMinor: MoneyMinor;
}

export interface EconomySnapshotV1 {
  readonly revision: number;
  readonly rulesVersion: EconomyRulesV1['rulesVersion'];
  readonly treasuryBalanceMinor: MoneyMinor;
  readonly taxPolicy: {
    readonly residentialBp: BasisPoints;
    readonly commercialBp: BasisPoints;
    readonly industrialBp: BasisPoints;
  };
  readonly currentPeriod: EconomyPeriodTotals;
  readonly previousPeriod: EconomyPeriodTotals | null;
  readonly latestCycleSettlementAtMacroHourIndex: MacroHourIndex;
  readonly lastMonthlyCloseAtMacroHourIndex: MacroHourIndex | null;
}

export interface InitialEconomyInput {
  readonly year: number;
  readonly month: number;
  readonly latestCycleSettlementAtMacroHourIndex: MacroHourIndex;
}

export const createInitialEconomySnapshot = (
  input: InitialEconomyInput,
  rules: EconomyRulesV1,
): EconomySnapshotV1 => {
  if (!validateEconomyRules(rules)) {
    throw new RangeError('economy:invalid-rules');
  }
  const candidate: EconomySnapshotV1 = {
    revision: 0,
    rulesVersion: rules.rulesVersion,
    treasuryBalanceMinor: rules.initialTreasuryMinor,
    taxPolicy: {
      residentialBp: rules.defaultResidentialTaxRateBp,
      commercialBp: rules.defaultCommercialTaxRateBp,
      industrialBp: rules.defaultIndustrialTaxRateBp,
    },
    currentPeriod: createEmptyPeriod(input.year, input.month),
    previousPeriod: null,
    latestCycleSettlementAtMacroHourIndex: macroHourIndex(
      macroHourValue(input.latestCycleSettlementAtMacroHourIndex),
    ),
    lastMonthlyCloseAtMacroHourIndex: null,
  };
  if (!validateEconomySnapshot(candidate, rules)) {
    throw new RangeError('economy:invalid-initial-snapshot');
  }
  return freezeSnapshot(candidate);
};

const createEmptyPeriod = (year: number, month: number): EconomyPeriodTotals => ({
  year,
  month,
  taxRevenue: { residentialMinor: 0, commercialMinor: 0, industrialMinor: 0 },
  expenses: {
    roadConstructionMinor: 0,
    terraformMinor: 0,
    bulldozeMinor: 0,
    roadMaintenanceMinor: 0,
  },
  refundsMinor: 0,
});

const clonePeriod = (period: EconomyPeriodTotals): EconomyPeriodTotals => ({
  ...period,
  taxRevenue: { ...period.taxRevenue },
  expenses: { ...period.expenses },
});

const freezePeriod = (period: EconomyPeriodTotals): EconomyPeriodTotals => {
  Object.freeze(period.taxRevenue);
  Object.freeze(period.expenses);
  return Object.freeze(period);
};

const freezeSnapshot = (snapshot: EconomySnapshotV1): EconomySnapshotV1 => {
  Object.freeze(snapshot.taxPolicy);
  freezePeriod(snapshot.currentPeriod);
  if (snapshot.previousPeriod !== null) {
    freezePeriod(snapshot.previousPeriod);
  }
  return Object.freeze(snapshot);
};

export const cloneEconomySnapshot = (snapshot: EconomySnapshotV1): EconomySnapshotV1 =>
  freezeSnapshot({
    ...snapshot,
    taxPolicy: { ...snapshot.taxPolicy },
    currentPeriod: clonePeriod(snapshot.currentPeriod),
    previousPeriod: snapshot.previousPeriod === null ? null : clonePeriod(snapshot.previousPeriod),
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isPeriod = (value: unknown): value is EconomyPeriodTotals => {
  if (!isRecord(value) || !isRecord(value.taxRevenue) || !isRecord(value.expenses)) {
    return false;
  }
  return (
    isNonNegativeSafeInteger(value.year) &&
    value.year >= 1 &&
    isNonNegativeSafeInteger(value.month) &&
    value.month >= 1 &&
    value.month <= 12 &&
    isNonNegativeSafeInteger(value.taxRevenue.residentialMinor) &&
    isNonNegativeSafeInteger(value.taxRevenue.commercialMinor) &&
    isNonNegativeSafeInteger(value.taxRevenue.industrialMinor) &&
    isNonNegativeSafeInteger(value.expenses.roadConstructionMinor) &&
    isNonNegativeSafeInteger(value.expenses.terraformMinor) &&
    isNonNegativeSafeInteger(value.expenses.bulldozeMinor) &&
    isNonNegativeSafeInteger(value.expenses.roadMaintenanceMinor) &&
    isNonNegativeSafeInteger(value.refundsMinor)
  );
};

export const validateEconomySnapshot = (
  value: unknown,
  rules: EconomyRulesV1,
): value is EconomySnapshotV1 => {
  if (!isRecord(value) || !isRecord(value.taxPolicy)) {
    return false;
  }
  const rates = [
    value.taxPolicy.residentialBp,
    value.taxPolicy.commercialBp,
    value.taxPolicy.industrialBp,
  ];
  return (
    isNonNegativeSafeInteger(value.revision) &&
    value.rulesVersion === rules.rulesVersion &&
    typeof value.treasuryBalanceMinor === 'number' &&
    Number.isSafeInteger(value.treasuryBalanceMinor) &&
    rates.every(
      (rate) =>
        isNonNegativeSafeInteger(rate) &&
        rate >= rules.minimumTaxRateBp &&
        rate <= rules.maximumTaxRateBp,
    ) &&
    isPeriod(value.currentPeriod) &&
    (value.previousPeriod === null || isPeriod(value.previousPeriod)) &&
    isNonNegativeSafeInteger(value.latestCycleSettlementAtMacroHourIndex) &&
    (value.lastMonthlyCloseAtMacroHourIndex === null ||
      isNonNegativeSafeInteger(value.lastMonthlyCloseAtMacroHourIndex))
  );
};

const periodFingerprint = (period: EconomyPeriodTotals | null): readonly unknown[] | null =>
  period === null
    ? null
    : [
        period.year,
        period.month,
        period.taxRevenue.residentialMinor,
        period.taxRevenue.commercialMinor,
        period.taxRevenue.industrialMinor,
        period.expenses.roadConstructionMinor,
        period.expenses.terraformMinor,
        period.expenses.bulldozeMinor,
        period.expenses.roadMaintenanceMinor,
        period.refundsMinor,
      ];

export const fingerprintEconomySnapshot = (snapshot: EconomySnapshotV1): string =>
  JSON.stringify([
    snapshot.revision,
    snapshot.rulesVersion,
    snapshot.treasuryBalanceMinor,
    snapshot.taxPolicy.residentialBp,
    snapshot.taxPolicy.commercialBp,
    snapshot.taxPolicy.industrialBp,
    periodFingerprint(snapshot.currentPeriod),
    periodFingerprint(snapshot.previousPeriod),
    macroHourValue(snapshot.latestCycleSettlementAtMacroHourIndex),
    snapshot.lastMonthlyCloseAtMacroHourIndex === null
      ? null
      : macroHourValue(snapshot.lastMonthlyCloseAtMacroHourIndex),
  ]);
