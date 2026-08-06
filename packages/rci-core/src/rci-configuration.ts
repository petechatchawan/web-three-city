export interface RciConfiguration {
  readonly populationRateProfileDefinitionId: string;
}

export const FOUNDATION_RCI_CONFIGURATION: RciConfiguration = Object.freeze({
  populationRateProfileDefinitionId: 'population-rate.synthetic.v1',
});
