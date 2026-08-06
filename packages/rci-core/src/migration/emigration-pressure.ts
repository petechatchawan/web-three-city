import { compareStableId } from '../contracts/ids.js';

export interface EmigrationPressureContext {
  readonly displaced: boolean;
  readonly daysDisplaced: number;
  readonly overcrowdedMembers: number;
  readonly overcrowdingDurationDays: number;
  readonly unemployedMembers: number;
  readonly unemploymentDurationDays: number;
  readonly noCompatibleVacancies: boolean;
  readonly underemployedMembers: number;
}

export interface EmigrationPressureFactorDefinition {
  readonly id: string;
  readonly category: 'housing' | 'employment';
  readonly weightMilli: number;
  evaluate(context: EmigrationPressureContext): number;
}

function clampPressure(value: number): number {
  if (!Number.isSafeInteger(value)) throw new RangeError('rci:invalid-pressure');
  return Math.max(0, Math.min(100_000, value));
}

export const FOUNDATION_HOUSING_EMIGRATION_FACTORS: readonly EmigrationPressureFactorDefinition[] =
  Object.freeze([
    Object.freeze({
      id: 'emigration.housing.days-displaced',
      category: 'housing' as const,
      weightMilli: 250,
      evaluate: (context: EmigrationPressureContext) =>
        clampPressure(context.daysDisplaced * 3_334),
    }),
    Object.freeze({
      id: 'emigration.housing.displaced',
      category: 'housing' as const,
      weightMilli: 350,
      evaluate: (context: EmigrationPressureContext) => (context.displaced ? 100_000 : 0),
    }),
    Object.freeze({
      id: 'emigration.housing.overcrowded-members',
      category: 'housing' as const,
      weightMilli: 250,
      evaluate: (context: EmigrationPressureContext) =>
        clampPressure(context.overcrowdedMembers * 25_000),
    }),
    Object.freeze({
      id: 'emigration.housing.overcrowding-duration',
      category: 'housing' as const,
      weightMilli: 150,
      evaluate: (context: EmigrationPressureContext) =>
        clampPressure(context.overcrowdingDurationDays * 2_500),
    }),
  ]);

export function evaluateHouseholdEmigrationPressure(
  context: EmigrationPressureContext,
  factors: readonly EmigrationPressureFactorDefinition[],
): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const factor of [...factors].sort((a, b) => compareStableId(a.id, b.id))) {
    if (!Number.isSafeInteger(factor.weightMilli) || factor.weightMilli < 0) {
      throw new RangeError('rci:invalid-pressure');
    }
    weighted += clampPressure(factor.evaluate(context)) * factor.weightMilli;
    totalWeight += factor.weightMilli;
  }
  return totalWeight === 0 ? 0 : clampPressure(Math.round(weighted / totalWeight));
}
