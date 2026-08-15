import {
  createRciProjection,
  type RciDefinitionRegistries,
  type RciSnapshot,
} from '@web-three-city/rci-core';

export interface RciHudModel {
  readonly population: number;
  readonly households: number;
  readonly housing: string;
  readonly employment: string;
  readonly residentialDemand: number;
  readonly commercialDemand: number;
  readonly industrialDemand: number;
  readonly residentialGateOpen: boolean;
  readonly commercialGateOpen: boolean;
  readonly industrialGateOpen: boolean;
}

function demandPoints(valueMilli: number): number {
  return Math.round(valueMilli / 1_000);
}

export function createRciHudModel(
  snapshot: RciSnapshot,
  registries: RciDefinitionRegistries,
  evaluationTick: number,
): RciHudModel {
  const projection = createRciProjection(snapshot, registries, evaluationTick);
  return Object.freeze({
    population: projection.population.residentCount,
    households: projection.population.householdCount,
    housing: `${projection.housing.occupiedDwellingCount}/${projection.housing.activeDwellingCount}`,
    employment: `${projection.employment.employedResidentCount}/${projection.employment.workingAgeResidentCount}`,
    residentialDemand: demandPoints(snapshot.demand.demand.residentialMilli),
    commercialDemand: demandPoints(snapshot.demand.demand.commercialMilli),
    industrialDemand: demandPoints(snapshot.demand.demand.industrialMilli),
    residentialGateOpen: snapshot.demand.growthGates.residentialOpen,
    commercialGateOpen: snapshot.demand.growthGates.commercialOpen,
    industrialGateOpen: snapshot.demand.growthGates.industrialOpen,
  });
}
