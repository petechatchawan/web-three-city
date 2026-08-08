import {
  applyEconomyDelta,
  quoteEconomyCost,
  type EconomyMutationResult,
  type EconomyRulesV1,
  type EconomySnapshotV1,
} from '@web-three-city/economy-core';

export type PaidActionCategory = 'roadConstruction' | 'terraform' | 'bulldoze';
export interface PaidActionQuote {
  readonly category: PaidActionCategory;
  readonly totalMinor: number;
}
export interface PaidActionReceipt extends PaidActionQuote {
  readonly baseEconomyRevision: number;
  readonly paidEconomyRevision: number;
}
export type ActionQuoteResult =
  | Readonly<{ ok: true } & PaidActionQuote>
  | Readonly<{ ok: false; reason: 'invalid-plan' | 'invalid-input' | 'overflow' }>;

function quote(
  valid: boolean,
  count: number,
  unitCost: number,
  category: PaidActionCategory,
): ActionQuoteResult {
  if (!valid) return { ok: false, reason: 'invalid-plan' };
  const result = quoteEconomyCost(count, unitCost);
  return result.ok ? { ok: true, category, totalMinor: result.totalMinor } : result;
}

export function quoteRoadMutationCost(
  plan: Readonly<{ valid: boolean; addedCellCount: number; removedCellCount: number }>,
  rules: EconomyRulesV1,
): ActionQuoteResult {
  if (plan.addedCellCount > 0 && plan.removedCellCount > 0)
    return { ok: false, reason: 'invalid-plan' };
  return plan.addedCellCount > 0
    ? quote(
        plan.valid,
        plan.addedCellCount,
        rules.roadConstructionCostPerAddedCellMinor,
        'roadConstruction',
      )
    : quote(plan.valid, plan.removedCellCount, rules.bulldozeCostPerRemovedCellMinor, 'bulldoze');
}

export function quoteTerraformCost(
  plan: Readonly<{
    valid: boolean;
    operation: 'raise' | 'lower' | 'flatten';
    changedVertexCount: number;
  }>,
  rules: EconomyRulesV1,
): ActionQuoteResult {
  const unit =
    plan.operation === 'raise'
      ? rules.terraformRaiseCostPerChangedVertexMinor
      : plan.operation === 'lower'
        ? rules.terraformLowerCostPerChangedVertexMinor
        : rules.terraformFlattenCostPerChangedVertexMinor;
  return quote(plan.valid, plan.changedVertexCount, unit, 'terraform');
}

export function quoteBuildingBulldozeCost(
  plan: Readonly<{ valid: boolean; removedCellCount: number }>,
  rules: EconomyRulesV1,
): ActionQuoteResult {
  return quote(
    plan.valid,
    plan.removedCellCount,
    rules.bulldozeCostPerRemovedCellMinor,
    'bulldoze',
  );
}

const deltaFor = (quote: PaidActionQuote, refund: boolean) => ({
  taxRevenue: { residentialMinor: 0, commercialMinor: 0, industrialMinor: 0 },
  expenses: {
    roadConstructionMinor: refund
      ? 0
      : quote.category === 'roadConstruction'
        ? quote.totalMinor
        : 0,
    terraformMinor: refund ? 0 : quote.category === 'terraform' ? quote.totalMinor : 0,
    bulldozeMinor: refund ? 0 : quote.category === 'bulldoze' ? quote.totalMinor : 0,
    roadMaintenanceMinor: 0,
  },
  refundsMinor: refund ? quote.totalMinor : 0,
});

export type PaidActionResult =
  | Readonly<{ ok: true; snapshot: EconomySnapshotV1; receipt: PaidActionReceipt }>
  | Exclude<EconomyMutationResult, { readonly ok: true }>;

export function applyPaidActionCost(
  snapshot: EconomySnapshotV1,
  actionQuote: PaidActionQuote,
  rules: EconomyRulesV1,
): PaidActionResult {
  const result = applyEconomyDelta(
    snapshot,
    {
      baseRevision: snapshot.revision,
      affordability: 'require-non-negative',
      delta: deltaFor(actionQuote, false),
    },
    rules,
  );
  return result.ok
    ? {
        ok: true,
        snapshot: result.snapshot,
        receipt: {
          ...actionQuote,
          baseEconomyRevision: snapshot.revision,
          paidEconomyRevision: result.snapshot.revision,
        },
      }
    : result;
}

export function refundPaidActionCost(
  snapshot: EconomySnapshotV1,
  receipt: PaidActionReceipt,
  rules: EconomyRulesV1,
): EconomyMutationResult {
  return applyEconomyDelta(
    snapshot,
    {
      baseRevision: snapshot.revision,
      affordability: 'allow-negative',
      delta: deltaFor(receipt, true),
    },
    rules,
  );
}
