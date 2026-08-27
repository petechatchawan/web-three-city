import { macroHourDuration, type MacroHourDuration } from '@web-three-city/simulation-core';

export interface RciConfiguration {
  readonly populationRateProfileDefinitionId: string;
  readonly displacedExpiryMacroHours?: MacroHourDuration;
  readonly incomingQueueCapacity?: number;
  readonly incomingBaselineMilli?: number;
  readonly incomingVacantJobContributionMilli?: number;
  readonly maxIncomingRequestsPerDay?: number;
}

export const FOUNDATION_RCI_CONFIGURATION: RciConfiguration = Object.freeze({
  populationRateProfileDefinitionId: 'population-rate.synthetic.v1',
  displacedExpiryMacroHours: macroHourDuration(720),
  incomingQueueCapacity: 64,
  incomingBaselineMilli: 350,
  incomingVacantJobContributionMilli: 50,
  maxIncomingRequestsPerDay: 2,
});
