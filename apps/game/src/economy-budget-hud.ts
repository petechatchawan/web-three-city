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

export interface EconomyBudgetHudAdapter {
  readonly element: HTMLElement;
  update(snapshot: EconomySnapshotV1): void;
  dispose(): void;
}

export function mountEconomyBudgetHud(
  panel: HTMLElement,
  submitPolicy: (policy: EconomyTaxPolicy) => EconomyPolicyUiResult,
): EconomyBudgetHudAdapter {
  const section = document.createElement('section');
  section.className = 'economy-hud';
  section.setAttribute('aria-label', 'Municipal budget');
  section.dataset.worldInputBlock = '';
  const options = Array.from(
    { length: 21 },
    (_, value) => `<option value="${value}">${value}%</option>`,
  ).join('');
  section.innerHTML = `
    <p class="control-label">Municipal budget</p>
    <div class="metrics-grid economy-summary">
      <div class="metrics-row"><span>Treasury</span><strong data-testid="economy-treasury">0.00</strong></div>
      <div class="metrics-row"><span>Income</span><strong data-testid="economy-income">0.00</strong></div>
      <div class="metrics-row"><span>Expenses</span><strong data-testid="economy-expenses">0.00</strong></div>
      <div class="metrics-row"><span>Net</span><strong data-testid="economy-net">0.00</strong></div>
    </div>
    <details class="budget-panel" data-testid="budget-panel">
      <summary>Budget and tax policy</summary>
      <p>Current: <strong data-testid="economy-current-period"></strong></p>
      <p>Previous: <strong data-testid="economy-previous-period"></strong></p>
      <div class="metrics-grid">
        <div class="metrics-row"><span>Residential revenue</span><strong data-testid="economy-revenue-residential"></strong></div>
        <div class="metrics-row"><span>Commercial revenue</span><strong data-testid="economy-revenue-commercial"></strong></div>
        <div class="metrics-row"><span>Industrial revenue</span><strong data-testid="economy-revenue-industrial"></strong></div>
        <div class="metrics-row"><span>Road maintenance</span><strong data-testid="economy-expense-roads"></strong></div>
        <div class="metrics-row"><span>Player actions</span><strong data-testid="economy-expense-actions"></strong></div>
      </div>
      <div class="tax-policy-controls">
        <label>Residential <select data-testid="tax-residential" aria-label="Residential tax rate">${options}</select></label>
        <label>Commercial <select data-testid="tax-commercial" aria-label="Commercial tax rate">${options}</select></label>
        <label>Industrial <select data-testid="tax-industrial" aria-label="Industrial tax rate">${options}</select></label>
        <button type="button" data-testid="apply-tax-policy">Apply tax policy</button>
        <p role="status" aria-live="polite"></p>
      </div>
    </details>`;
  panel.append(section);

  const value = (testId: string): HTMLElement => {
    const found = section.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    if (found === null) throw new Error(`economy-hud:missing:${testId}`);
    return found;
  };
  const select = (testId: string): HTMLSelectElement => value(testId) as HTMLSelectElement;
  const status = section.querySelector<HTMLElement>('[role="status"]');
  if (status === null) throw new Error('economy-hud:missing:status');
  let policyDraftDirty = false;
  for (const testId of ['tax-residential', 'tax-commercial', 'tax-industrial']) {
    select(testId).addEventListener('change', () => {
      policyDraftDirty = true;
    });
  }

  value('apply-tax-policy').addEventListener('click', () => {
    const result = submitPolicy({
      residentialBp: Number(select('tax-residential').value) * 100,
      commercialBp: Number(select('tax-commercial').value) * 100,
      industrialBp: Number(select('tax-industrial').value) * 100,
    });
    status.textContent =
      result.status === 'accepted' ? 'Tax policy updated' : 'Tax policy rejected';
    if (result.status === 'accepted') policyDraftDirty = false;
  });

  return Object.freeze({
    element: section,
    update(snapshot: EconomySnapshotV1): void {
      const model = createEconomyViewProjection(snapshot);
      const values = {
        'economy-treasury': model.treasury,
        'economy-income': model.income,
        'economy-expenses': model.expenses,
        'economy-net': model.net,
        'economy-current-period': model.currentPeriodLabel,
        'economy-previous-period': model.previousPeriodLabel,
        'economy-revenue-residential': model.residentialRevenue,
        'economy-revenue-commercial': model.commercialRevenue,
        'economy-revenue-industrial': model.industrialRevenue,
        'economy-expense-roads': model.roadExpenses,
        'economy-expense-actions': model.actionExpenses,
      } as const;
      for (const [testId, text] of Object.entries(values)) value(testId).textContent = text;
      if (!policyDraftDirty) {
        select('tax-residential').value = String(model.residentialPercent);
        select('tax-commercial').value = String(model.commercialPercent);
        select('tax-industrial').value = String(model.industrialPercent);
      }
    },
    dispose(): void {
      section.remove();
    },
  });
}
