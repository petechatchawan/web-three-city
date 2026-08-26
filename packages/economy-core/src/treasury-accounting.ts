import { compareMacroHours, macroHourIndex, macroHourValue } from '@web-three-city/simulation-core';
import type { MacroHourIndex } from '@web-three-city/simulation-core';
import {
  cloneEconomySnapshot,
  type EconomyPeriodTotals,
  type EconomySnapshotV1,
  validateEconomySnapshot,
} from './economy-snapshot.js';
import type { BasisPoints, MoneyMinor } from './money.js';
import type { EconomyRulesV1 } from './rules.js';

export type EconomyMutationRejectionReason =
  | 'stale-revision'
  | 'invalid-policy'
  | 'invalid-delta'
  | 'insufficient-funds'
  | 'overflow'
  | 'invalid-period';

export type EconomyMutationResult =
  | { readonly ok: true; readonly snapshot: EconomySnapshotV1 }
  | {
      readonly ok: false;
      readonly reason: EconomyMutationRejectionReason;
      readonly availableMinor?: MoneyMinor;
      readonly requiredMinor?: MoneyMinor;
    };

export interface TaxPolicyInput {
  readonly baseRevision: number;
  readonly policy: {
    readonly residentialBp: BasisPoints;
    readonly commercialBp: BasisPoints;
    readonly industrialBp: BasisPoints;
  };
}

export interface EconomyAccountingDelta {
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

export interface ApplyEconomyDeltaInput {
  readonly baseRevision: number;
  readonly affordability: 'require-non-negative' | 'allow-negative';
  readonly delta: EconomyAccountingDelta;
}

export interface CloseAccountingPeriodInput {
  readonly baseRevision: number;
  readonly atMacroHourIndex: MacroHourIndex;
  readonly nextPeriod: { readonly year: number; readonly month: number };
}

export type EconomyCostQuoteResult =
  | { readonly ok: true; readonly totalMinor: MoneyMinor }
  | { readonly ok: false; readonly reason: 'invalid-input' | 'overflow' };

export interface AccountingPeriodSummary {
  readonly revenueMinor: MoneyMinor;
  readonly expensesMinor: MoneyMinor;
  readonly refundsMinor: MoneyMinor;
  readonly netMinor: MoneyMinor;
}

export type AccountingPeriodSummaryResult =
  | { readonly ok: true; readonly summary: AccountingPeriodSummary }
  | { readonly ok: false; readonly reason: 'overflow' };

export const applyTaxPolicy = (
  snapshot: EconomySnapshotV1,
  input: TaxPolicyInput,
  rules: EconomyRulesV1,
): EconomyMutationResult => {
  if (input.baseRevision !== snapshot.revision) {
    return { ok: false, reason: 'stale-revision' };
  }
  const rates = [input.policy.residentialBp, input.policy.commercialBp, input.policy.industrialBp];
  if (
    !rates.every(
      (rate) =>
        Number.isSafeInteger(rate) &&
        rate >= rules.minimumTaxRateBp &&
        rate <= rules.maximumTaxRateBp,
    )
  ) {
    return { ok: false, reason: 'invalid-policy' };
  }
  const candidate: EconomySnapshotV1 = {
    ...snapshot,
    revision: snapshot.revision + 1,
    taxPolicy: { ...input.policy },
  };
  if (!validateEconomySnapshot(candidate, rules)) {
    return { ok: false, reason: 'overflow' };
  }
  return { ok: true, snapshot: cloneEconomySnapshot(candidate) };
};

export const applyEconomyDelta = (
  snapshot: EconomySnapshotV1,
  input: ApplyEconomyDeltaInput,
  rules: EconomyRulesV1,
): EconomyMutationResult => {
  if (input.baseRevision !== snapshot.revision) {
    return { ok: false, reason: 'stale-revision' };
  }
  const deltaValues = [
    input.delta.taxRevenue.residentialMinor,
    input.delta.taxRevenue.commercialMinor,
    input.delta.taxRevenue.industrialMinor,
    input.delta.expenses.roadConstructionMinor,
    input.delta.expenses.terraformMinor,
    input.delta.expenses.bulldozeMinor,
    input.delta.expenses.roadMaintenanceMinor,
    input.delta.refundsMinor,
  ];
  if (!deltaValues.every(isNonNegativeSafeInteger)) {
    return { ok: false, reason: 'invalid-delta' };
  }

  const revenue = sumBigInt([
    input.delta.taxRevenue.residentialMinor,
    input.delta.taxRevenue.commercialMinor,
    input.delta.taxRevenue.industrialMinor,
    input.delta.refundsMinor,
  ]);
  const expenses = sumBigInt([
    input.delta.expenses.roadConstructionMinor,
    input.delta.expenses.terraformMinor,
    input.delta.expenses.bulldozeMinor,
    input.delta.expenses.roadMaintenanceMinor,
  ]);
  const netDelta = revenue - expenses;
  const nextTreasury = BigInt(snapshot.treasuryBalanceMinor) + netDelta;
  const required = expenses > revenue ? expenses - revenue : 0n;
  if (!isSafeIntegerBigInt(nextTreasury) || !isSafeIntegerBigInt(required)) {
    return { ok: false, reason: 'overflow' };
  }
  if (input.affordability === 'require-non-negative' && nextTreasury < 0n) {
    return {
      ok: false,
      reason: 'insufficient-funds',
      availableMinor: snapshot.treasuryBalanceMinor,
      requiredMinor: Number(required),
    };
  }

  const nextValues = {
    treasury: nextTreasury,
    residential: addBigInt(
      snapshot.currentPeriod.taxRevenue.residentialMinor,
      input.delta.taxRevenue.residentialMinor,
    ),
    commercial: addBigInt(
      snapshot.currentPeriod.taxRevenue.commercialMinor,
      input.delta.taxRevenue.commercialMinor,
    ),
    industrial: addBigInt(
      snapshot.currentPeriod.taxRevenue.industrialMinor,
      input.delta.taxRevenue.industrialMinor,
    ),
    roadConstruction: addBigInt(
      snapshot.currentPeriod.expenses.roadConstructionMinor,
      input.delta.expenses.roadConstructionMinor,
    ),
    terraform: addBigInt(
      snapshot.currentPeriod.expenses.terraformMinor,
      input.delta.expenses.terraformMinor,
    ),
    bulldoze: addBigInt(
      snapshot.currentPeriod.expenses.bulldozeMinor,
      input.delta.expenses.bulldozeMinor,
    ),
    roadMaintenance: addBigInt(
      snapshot.currentPeriod.expenses.roadMaintenanceMinor,
      input.delta.expenses.roadMaintenanceMinor,
    ),
    refunds: addBigInt(snapshot.currentPeriod.refundsMinor, input.delta.refundsMinor),
  };
  if (
    !Number.isSafeInteger(snapshot.revision + 1) ||
    !Object.values(nextValues).every(isSafeIntegerBigInt)
  ) {
    return { ok: false, reason: 'overflow' };
  }

  const candidate: EconomySnapshotV1 = {
    ...snapshot,
    revision: snapshot.revision + 1,
    treasuryBalanceMinor: Number(nextValues.treasury),
    currentPeriod: {
      ...snapshot.currentPeriod,
      taxRevenue: {
        residentialMinor: Number(nextValues.residential),
        commercialMinor: Number(nextValues.commercial),
        industrialMinor: Number(nextValues.industrial),
      },
      expenses: {
        roadConstructionMinor: Number(nextValues.roadConstruction),
        terraformMinor: Number(nextValues.terraform),
        bulldozeMinor: Number(nextValues.bulldoze),
        roadMaintenanceMinor: Number(nextValues.roadMaintenance),
      },
      refundsMinor: Number(nextValues.refunds),
    },
  };
  if (!validateEconomySnapshot(candidate, rules)) {
    return { ok: false, reason: 'overflow' };
  }
  return { ok: true, snapshot: cloneEconomySnapshot(candidate) };
};

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_INTEGER_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);

const isNonNegativeSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

const isSafeIntegerBigInt = (value: bigint): boolean =>
  value >= MIN_SAFE_INTEGER_BIGINT && value <= MAX_SAFE_INTEGER_BIGINT;

const sumBigInt = (values: readonly number[]): bigint =>
  values.reduce((total, value) => total + BigInt(value), 0n);

const addBigInt = (left: number, right: number): bigint => BigInt(left) + BigInt(right);

export const closeAccountingPeriod = (
  snapshot: EconomySnapshotV1,
  input: CloseAccountingPeriodInput,
  rules: EconomyRulesV1,
): EconomyMutationResult => {
  if (input.baseRevision !== snapshot.revision) {
    return { ok: false, reason: 'stale-revision' };
  }
  let atMacroHourIndex: MacroHourIndex;
  try {
    atMacroHourIndex = macroHourIndex(macroHourValue(input.atMacroHourIndex));
  } catch {
    return { ok: false, reason: 'invalid-period' };
  }
  if (
    !isNonNegativeSafeInteger(input.nextPeriod.year) ||
    input.nextPeriod.year < 1 ||
    !isNonNegativeSafeInteger(input.nextPeriod.month) ||
    input.nextPeriod.month < 1 ||
    input.nextPeriod.month > 12
  ) {
    return { ok: false, reason: 'invalid-period' };
  }
  if (
    snapshot.lastMonthlyCloseAtMacroHourIndex !== null &&
    compareMacroHours(snapshot.lastMonthlyCloseAtMacroHourIndex, atMacroHourIndex) === 0
  ) {
    return snapshot.currentPeriod.year === input.nextPeriod.year &&
      snapshot.currentPeriod.month === input.nextPeriod.month
      ? { ok: true, snapshot }
      : { ok: false, reason: 'invalid-period' };
  }

  const expectedNext =
    snapshot.currentPeriod.month === 12
      ? { year: snapshot.currentPeriod.year + 1, month: 1 }
      : { year: snapshot.currentPeriod.year, month: snapshot.currentPeriod.month + 1 };
  if (
    input.nextPeriod.year !== expectedNext.year ||
    input.nextPeriod.month !== expectedNext.month ||
    (snapshot.lastMonthlyCloseAtMacroHourIndex !== null &&
      compareMacroHours(atMacroHourIndex, snapshot.lastMonthlyCloseAtMacroHourIndex) < 0) ||
    !Number.isSafeInteger(snapshot.revision + 1)
  ) {
    return { ok: false, reason: 'invalid-period' };
  }

  const candidate: EconomySnapshotV1 = {
    ...snapshot,
    revision: snapshot.revision + 1,
    currentPeriod: createEmptyPeriod(input.nextPeriod.year, input.nextPeriod.month),
    previousPeriod: snapshot.currentPeriod,
    lastMonthlyCloseAtMacroHourIndex: atMacroHourIndex,
  };
  if (!validateEconomySnapshot(candidate, rules)) {
    return { ok: false, reason: 'invalid-period' };
  }
  return { ok: true, snapshot: cloneEconomySnapshot(candidate) };
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

export const quoteEconomyCost = (
  unitCount: number,
  costPerUnitMinor: MoneyMinor,
): EconomyCostQuoteResult => {
  if (!isNonNegativeSafeInteger(unitCount) || !isNonNegativeSafeInteger(costPerUnitMinor)) {
    return { ok: false, reason: 'invalid-input' };
  }
  const total = BigInt(unitCount) * BigInt(costPerUnitMinor);
  return isSafeIntegerBigInt(total)
    ? { ok: true, totalMinor: Number(total) }
    : { ok: false, reason: 'overflow' };
};

export const deriveAccountingPeriodSummary = (
  period: EconomyPeriodTotals,
): AccountingPeriodSummaryResult => {
  const revenue = sumBigInt([
    period.taxRevenue.residentialMinor,
    period.taxRevenue.commercialMinor,
    period.taxRevenue.industrialMinor,
  ]);
  const expenses = sumBigInt([
    period.expenses.roadConstructionMinor,
    period.expenses.terraformMinor,
    period.expenses.bulldozeMinor,
    period.expenses.roadMaintenanceMinor,
  ]);
  const net = revenue + BigInt(period.refundsMinor) - expenses;
  if (![revenue, expenses, net].every(isSafeIntegerBigInt)) {
    return { ok: false, reason: 'overflow' };
  }
  return {
    ok: true,
    summary: {
      revenueMinor: Number(revenue),
      expensesMinor: Number(expenses),
      refundsMinor: period.refundsMinor,
      netMinor: Number(net),
    },
  };
};
