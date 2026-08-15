import {
  deriveAccountingPeriodSummary,
  type EconomyPeriodTotals,
  type EconomySnapshotV1,
  type TaxPolicyInput,
} from '@web-three-city/economy-core';

export type EconomyTaxPolicy = TaxPolicyInput['policy'];
export type EconomyPolicyUiResult =
  Readonly<{ status: 'accepted' }> | Readonly<{ status: 'rejected'; reason: string }>;

export interface EconomyViewProjection {
  readonly treasury: string;
  readonly income: string;
  readonly expenses: string;
  readonly net: string;
  readonly currentPeriodLabel: string;
  readonly previousPeriodLabel: string;
  readonly residentialRevenue: string;
  readonly commercialRevenue: string;
  readonly industrialRevenue: string;
  readonly roadExpenses: string;
  readonly actionExpenses: string;
  readonly residentialTax: string;
  readonly commercialTax: string;
  readonly industrialTax: string;
  readonly residentialPercent: number;
  readonly commercialPercent: number;
  readonly industrialPercent: number;
}

function grouped(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatMoneyMinor(value: number, sign: 'auto' | 'always' = 'auto'): string {
  const negative = value < 0;
  const absolute = Math.abs(value);
  const units = Math.floor(absolute / 100);
  const minor = String(absolute % 100).padStart(2, '0');
  const prefix = negative ? '-' : sign === 'always' && value > 0 ? '+' : '';
  return `${prefix}${grouped(String(units))}.${minor}`;
}

function periodLabel(period: EconomyPeriodTotals | null): string {
  return period === null ? 'None' : `Year ${period.year} · Month ${period.month}`;
}

export function createEconomyViewProjection(snapshot: EconomySnapshotV1): EconomyViewProjection {
  const summary = deriveAccountingPeriodSummary(snapshot.currentPeriod);
  if (!summary.ok) throw new RangeError('economy-view:overflow');
  const period = snapshot.currentPeriod;
  return Object.freeze({
    treasury: formatMoneyMinor(snapshot.treasuryBalanceMinor),
    income: formatMoneyMinor(summary.summary.revenueMinor + summary.summary.refundsMinor, 'always'),
    expenses: formatMoneyMinor(-summary.summary.expensesMinor),
    net: formatMoneyMinor(summary.summary.netMinor, 'always'),
    currentPeriodLabel: periodLabel(period),
    previousPeriodLabel: periodLabel(snapshot.previousPeriod),
    residentialRevenue: formatMoneyMinor(period.taxRevenue.residentialMinor),
    commercialRevenue: formatMoneyMinor(period.taxRevenue.commercialMinor),
    industrialRevenue: formatMoneyMinor(period.taxRevenue.industrialMinor),
    roadExpenses: formatMoneyMinor(-period.expenses.roadMaintenanceMinor),
    actionExpenses: formatMoneyMinor(
      -(
        period.expenses.roadConstructionMinor +
        period.expenses.terraformMinor +
        period.expenses.bulldozeMinor
      ),
    ),
    residentialTax: `${snapshot.taxPolicy.residentialBp / 100}%`,
    commercialTax: `${snapshot.taxPolicy.commercialBp / 100}%`,
    industrialTax: `${snapshot.taxPolicy.industrialBp / 100}%`,
    residentialPercent: snapshot.taxPolicy.residentialBp / 100,
    commercialPercent: snapshot.taxPolicy.commercialBp / 100,
    industrialPercent: snapshot.taxPolicy.industrialBp / 100,
  });
}
