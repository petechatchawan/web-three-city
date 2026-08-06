export type RciDemandChannel = 'residential' | 'commercial' | 'industrial';

export interface RciDemandFactorContext {
  readonly residentCount: number;
  readonly householdCount: number;
  readonly residentCapacity: number;
  readonly vacantDwellingCount: number;
  readonly incomingHouseholdCount: number;
  readonly displacedHouseholdCount: number;
  readonly workingAgeResidentCount: number;
  readonly employedResidentCount: number;
  readonly unemployedResidentCount: number;
  readonly totalPositionCapacity: number;
  readonly vacantPositionCount: number;
  readonly compatibleVacantPositionCount: number;
  readonly commercialPositionCapacity: number;
  readonly commercialVacantPositionCount: number;
  readonly industrialPositionCapacity: number;
  readonly industrialVacantPositionCount: number;
}

export interface RciDemandFactorDefinition {
  readonly id: string;
  readonly channel: RciDemandChannel;
  readonly weightMilli: number;
  evaluate(context: RciDemandFactorContext): number;
}

export interface RciDemandFactorContribution {
  readonly factorDefinitionId: string;
  readonly channel: RciDemandChannel;
  readonly valueMilli: number;
  readonly weightMilli: number;
}

export function clampDemandMilli(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('rci:invalid-demand');
  return Math.max(-100_000, Math.min(100_000, Math.round(value)));
}

function ratioPressure(numerator: number, denominator: number): number {
  if (denominator <= 0) return numerator > 0 ? 100_000 : 0;
  return clampDemandMilli((numerator * 100_000) / denominator);
}

export const FOUNDATION_RCI_DEMAND_FACTORS: readonly RciDemandFactorDefinition[] = Object.freeze([
  Object.freeze({
    id: 'demand.commercial.labor-shortage',
    channel: 'commercial' as const,
    weightMilli: 300,
    evaluate: (context: RciDemandFactorContext) =>
      clampDemandMilli(
        ratioPressure(
          context.unemployedResidentCount,
          Math.max(1, context.workingAgeResidentCount),
        ) -
          ratioPressure(
            context.commercialVacantPositionCount,
            Math.max(1, context.commercialPositionCapacity),
          ),
      ),
  }),
  Object.freeze({
    id: 'demand.commercial.target-buffer',
    channel: 'commercial' as const,
    weightMilli: 700,
    evaluate: (context: RciDemandFactorContext) =>
      clampDemandMilli(
        20_000 -
          ratioPressure(
            context.commercialVacantPositionCount,
            Math.max(1, context.commercialPositionCapacity),
          ),
      ),
  }),
  Object.freeze({
    id: 'demand.industrial.labor-shortage',
    channel: 'industrial' as const,
    weightMilli: 300,
    evaluate: (context: RciDemandFactorContext) =>
      clampDemandMilli(
        ratioPressure(
          context.unemployedResidentCount,
          Math.max(1, context.workingAgeResidentCount),
        ) -
          ratioPressure(
            context.industrialVacantPositionCount,
            Math.max(1, context.industrialPositionCapacity),
          ),
      ),
  }),
  Object.freeze({
    id: 'demand.industrial.target-buffer',
    channel: 'industrial' as const,
    weightMilli: 700,
    evaluate: (context: RciDemandFactorContext) =>
      clampDemandMilli(
        20_000 -
          ratioPressure(
            context.industrialVacantPositionCount,
            Math.max(1, context.industrialPositionCapacity),
          ),
      ),
  }),
  Object.freeze({
    id: 'demand.residential.displacement',
    channel: 'residential' as const,
    weightMilli: 250,
    evaluate: (context: RciDemandFactorContext) =>
      clampDemandMilli(context.displacedHouseholdCount * 25_000),
  }),
  Object.freeze({
    id: 'demand.residential.incoming-queue',
    channel: 'residential' as const,
    weightMilli: 250,
    evaluate: (context: RciDemandFactorContext) =>
      clampDemandMilli(context.incomingHouseholdCount * 12_500),
  }),
  Object.freeze({
    id: 'demand.residential.target-buffer',
    channel: 'residential' as const,
    weightMilli: 500,
    evaluate: (context: RciDemandFactorContext) => {
      const desiredVacantDwellingBuffer = Math.max(
        1,
        Math.ceil(context.householdCount * 0.1),
      );
      return clampDemandMilli(
        ((desiredVacantDwellingBuffer - context.vacantDwellingCount) * 100_000) /
          desiredVacantDwellingBuffer,
      );
    },
  }),
]);
