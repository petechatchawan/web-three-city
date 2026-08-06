export interface RciConfiguration {
  readonly populationRateProfileDefinitionId: string;
  readonly displacedExpiryTicks?: number;
  readonly incomingQueueCapacity?: number;
  readonly incomingBaselineMilli?: number;
  readonly incomingVacantJobContributionMilli?: number;
  readonly maxIncomingRequestsPerDay?: number;
}

export const FOUNDATION_RCI_CONFIGURATION: RciConfiguration = Object.freeze({
  populationRateProfileDefinitionId: 'population-rate.synthetic.v1',
  displacedExpiryTicks: 720,
  incomingQueueCapacity: 64,
  incomingBaselineMilli: 350,
  incomingVacantJobContributionMilli: 50,
  maxIncomingRequestsPerDay: 2,
});
