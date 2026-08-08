import type { EconomySnapshotV1 } from './economy-snapshot.js';
import { cloneEconomySnapshot, validateEconomySnapshot } from './economy-snapshot.js';
import type { BasisPoints, MoneyMinor } from './money.js';
import type { EconomyRulesV1 } from './rules.js';
import {
  applyEconomyDelta,
  closeAccountingPeriod,
  type EconomyAccountingDelta,
  type EconomyMutationRejectionReason,
} from './treasury-accounting.js';

export interface TaxableActivityProjection {
  readonly occupiedResidentialDwellings: number;
  readonly occupiedCommercialPositions: number;
  readonly occupiedIndustrialPositions: number;
}

export interface RoadMaintenanceProjection {
  readonly occupiedRoadCells: number;
}

export interface SettlementTaxPolicy {
  readonly residentialBp: BasisPoints;
  readonly commercialBp: BasisPoints;
  readonly industrialBp: BasisPoints;
}

export type DailySettlementCalculation =
  | Readonly<{ ok: true; delta: EconomyAccountingDelta }>
  | Readonly<{ ok: false; reason: 'invalid-projection' | 'overflow' }>;

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const validCount = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

function calculateChannel(
  count: number,
  baseMinor: MoneyMinor,
  rateBp: BasisPoints,
): MoneyMinor | null {
  const numerator = BigInt(count) * BigInt(baseMinor) * BigInt(rateBp);
  const denominator = 10_000n;
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
  return rounded <= MAX_SAFE ? Number(rounded) : null;
}

export function calculateDailySettlement(
  taxable: TaxableActivityProjection,
  roads: RoadMaintenanceProjection,
  policy: SettlementTaxPolicy,
  rules: EconomyRulesV1,
): DailySettlementCalculation {
  const counts = [
    taxable.occupiedResidentialDwellings,
    taxable.occupiedCommercialPositions,
    taxable.occupiedIndustrialPositions,
    roads.occupiedRoadCells,
  ];
  if (!counts.every(validCount)) return { ok: false, reason: 'invalid-projection' };
  const residential = calculateChannel(
    taxable.occupiedResidentialDwellings,
    rules.dailyResidentialBasePerOccupiedDwellingMinor,
    policy.residentialBp,
  );
  const commercial = calculateChannel(
    taxable.occupiedCommercialPositions,
    rules.dailyCommercialBasePerOccupiedPositionMinor,
    policy.commercialBp,
  );
  const industrial = calculateChannel(
    taxable.occupiedIndustrialPositions,
    rules.dailyIndustrialBasePerOccupiedPositionMinor,
    policy.industrialBp,
  );
  const maintenance =
    BigInt(roads.occupiedRoadCells) * BigInt(rules.roadMaintenanceCostPerOccupiedCellMinor);
  if (
    residential === null ||
    commercial === null ||
    industrial === null ||
    maintenance > MAX_SAFE
  ) {
    return { ok: false, reason: 'overflow' };
  }
  return {
    ok: true,
    delta: {
      taxRevenue: {
        residentialMinor: residential,
        commercialMinor: commercial,
        industrialMinor: industrial,
      },
      expenses: {
        roadConstructionMinor: 0,
        terraformMinor: 0,
        bulldozeMinor: 0,
        roadMaintenanceMinor: Number(maintenance),
      },
      refundsMinor: 0,
    },
  };
}

export interface ScheduledSettlementInput {
  readonly beforeTick: number;
  readonly afterTick: number;
  readonly calendar: Readonly<{ year: number; month: number; day: number; hour: number }>;
  readonly taxableActivity: TaxableActivityProjection;
  readonly roadMaintenance: RoadMaintenanceProjection;
}

export type ScheduledSettlementResult =
  | Readonly<{ ok: true; status: 'not-due' | 'settled'; snapshot: EconomySnapshotV1 }>
  | Readonly<{
      ok: false;
      reason: 'invalid-transition' | 'invalid-projection' | EconomyMutationRejectionReason;
    }>;

export function settleScheduledEconomy(
  snapshot: EconomySnapshotV1,
  input: ScheduledSettlementInput,
  rules: EconomyRulesV1,
): ScheduledSettlementResult {
  if (
    !Number.isSafeInteger(input.beforeTick) ||
    !Number.isSafeInteger(input.afterTick) ||
    input.beforeTick < 0 ||
    input.afterTick !== input.beforeTick + 1
  ) {
    return { ok: false, reason: 'invalid-transition' };
  }
  if (input.calendar.hour !== 8 || snapshot.lastDailySettlementTick >= input.afterTick) {
    return { ok: true, status: 'not-due', snapshot };
  }
  const calculation = calculateDailySettlement(
    input.taxableActivity,
    input.roadMaintenance,
    snapshot.taxPolicy,
    rules,
  );
  if (!calculation.ok) return calculation;

  let staged = snapshot;
  if (
    staged.currentPeriod.year !== input.calendar.year ||
    staged.currentPeriod.month !== input.calendar.month
  ) {
    const close = closeAccountingPeriod(
      staged,
      {
        baseRevision: staged.revision,
        atTick: input.afterTick,
        nextPeriod: { year: input.calendar.year, month: input.calendar.month },
      },
      rules,
    );
    if (!close.ok) return close;
    staged = close.snapshot;
  }
  const applied = applyEconomyDelta(
    staged,
    {
      baseRevision: staged.revision,
      affordability: 'allow-negative',
      delta: calculation.delta,
    },
    rules,
  );
  if (!applied.ok) return applied;
  const candidate = { ...applied.snapshot, lastDailySettlementTick: input.afterTick };
  if (!validateEconomySnapshot(candidate, rules)) return { ok: false, reason: 'overflow' };
  return { ok: true, status: 'settled', snapshot: cloneEconomySnapshot(candidate) };
}
