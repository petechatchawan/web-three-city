import type {
  EmigrationPressureContext,
  EmigrationPressureFactorDefinition,
} from '../migration/emigration-pressure.js';

function clamp(value: number): number {
  return Math.max(0, Math.min(100_000, Math.round(value)));
}

export const FOUNDATION_EMPLOYMENT_EMIGRATION_FACTORS: readonly EmigrationPressureFactorDefinition[] =
  Object.freeze([
    Object.freeze({
      id: 'emigration.employment.no-compatible-vacancy',
      category: 'employment' as const,
      weightMilli: 250,
      evaluate: (context: EmigrationPressureContext) =>
        context.noCompatibleVacancies ? 100_000 : 0,
    }),
    Object.freeze({
      id: 'emigration.employment.underemployment',
      category: 'employment' as const,
      weightMilli: 200,
      evaluate: (context: EmigrationPressureContext) =>
        clamp(context.underemployedMembers * 25_000),
    }),
    Object.freeze({
      id: 'emigration.employment.unemployed-members',
      category: 'employment' as const,
      weightMilli: 350,
      evaluate: (context: EmigrationPressureContext) =>
        clamp(context.unemployedMembers * 35_000),
    }),
    Object.freeze({
      id: 'emigration.employment.unemployment-duration',
      category: 'employment' as const,
      weightMilli: 200,
      evaluate: (context: EmigrationPressureContext) =>
        clamp(context.unemploymentDurationDays * 2_000),
    }),
  ]);
