import type { RciDefinitionRegistries } from '../definitions/contracts.js';
import { createEmploymentIndex, positionKey } from '../employment/employment-index.js';
import { workplaceCapacityProfileForId } from '../employment/workplace-capacity.js';
import { createHousingIndex, type HousingProjection } from '../housing/housing-index.js';
import type { RciSnapshot } from '../rci-snapshot.js';
import type { RciDemandFactorContext } from '../demand/demand-factor.js';
import type { EmploymentProjection } from '../employment/employment-index.js';

export interface RciProjection {
  readonly population: Readonly<{
    residentCount: number;
    householdCount: number;
    incomingHouseholdCount: number;
    displacedHouseholdCount: number;
  }>;
  readonly housing: HousingProjection;
  readonly employment: EmploymentProjection;
  readonly demand: RciSnapshot['demand'];
  readonly factorContext: RciDemandFactorContext;
}

export function createRciProjection(
  snapshot: RciSnapshot,
  registries: RciDefinitionRegistries,
  evaluationTick: number,
): RciProjection {
  const housing = createHousingIndex(snapshot, registries).projection;
  const employmentIndex = createEmploymentIndex(snapshot, registries, evaluationTick);
  let commercialPositionCapacity = 0;
  let industrialPositionCapacity = 0;
  let commercialOccupiedPositionCount = 0;
  let industrialOccupiedPositionCount = 0;
  for (const workplace of snapshot.employment.workplaces) {
    if (workplace.retiredAtTick !== null) continue;
    const profile = workplaceCapacityProfileForId(
      registries.capacityProfiles,
      workplace.capacityProfileDefinitionId,
    );
    for (const group of profile.positionGroups) {
      const occupied =
        employmentIndex.occupiedCountByPositionKey.get(
          positionKey(workplace.workplaceId, group.positionGroupDefinitionId),
        ) ?? 0;
      if (profile.kind === 'commercial') {
        commercialPositionCapacity += group.capacity;
        commercialOccupiedPositionCount += occupied;
      } else {
        industrialPositionCapacity += group.capacity;
        industrialOccupiedPositionCount += occupied;
      }
    }
  }
  const residentCount = snapshot.population.citizens.filter(
    (citizen) => citizen.presence === 'resident',
  ).length;
  const householdCount = snapshot.households.households.filter(
    (household) => household.dissolvedAtTick === null,
  ).length;
  const population = Object.freeze({
    residentCount,
    householdCount,
    incomingHouseholdCount: snapshot.migration.incomingRequests.length,
    displacedHouseholdCount: snapshot.migration.displacedHouseholds.length,
  });
  const factorContext: RciDemandFactorContext = Object.freeze({
    residentCount,
    householdCount,
    residentCapacity: housing.residentCapacity,
    vacantDwellingCount: housing.vacantDwellingCount,
    incomingHouseholdCount: population.incomingHouseholdCount,
    displacedHouseholdCount: population.displacedHouseholdCount,
    workingAgeResidentCount: employmentIndex.projection.workingAgeResidentCount,
    employedResidentCount: employmentIndex.projection.employedResidentCount,
    unemployedResidentCount: employmentIndex.projection.unemployedResidentCount,
    totalPositionCapacity: employmentIndex.projection.totalPositionCapacity,
    vacantPositionCount: employmentIndex.projection.vacantPositionCount,
    compatibleVacantPositionCount: employmentIndex.projection.compatibleVacantPositionCount,
    commercialPositionCapacity,
    commercialVacantPositionCount: Math.max(
      0,
      commercialPositionCapacity - commercialOccupiedPositionCount,
    ),
    industrialPositionCapacity,
    industrialVacantPositionCount: Math.max(
      0,
      industrialPositionCapacity - industrialOccupiedPositionCount,
    ),
  });
  return Object.freeze({
    population,
    housing,
    employment: employmentIndex.projection,
    demand: snapshot.demand,
    factorContext,
  });
}
