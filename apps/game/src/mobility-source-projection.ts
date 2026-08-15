import type { BuildingSnapshot } from '@web-three-city/building-core';
import type { PresentCitizenMobilityProjection } from '@web-three-city/citizen-mobility-core';
import type { RciSnapshot } from '@web-three-city/rci-core';

export function createPresentCitizenMobilityProjection(
  rci: RciSnapshot,
  buildings: BuildingSnapshot,
  _absoluteTick: number,
): readonly PresentCitizenMobilityProjection[] {
  const validBuildingIds = new Set(
    buildings.instances
      .filter((instance) => instance.lifecycle === undefined || instance.lifecycle === 'active')
      .map((instance) => instance.instanceId),
  );
  const activeMembershipByCitizen = new Map(
    rci.households.memberships
      .filter((membership) => membership.endedAtTick === null)
      .map((membership) => [membership.citizenId, membership] as const),
  );
  const activeHousingByHousehold = new Map(
    rci.housing.assignments
      .filter((assignment) => assignment.endedAtTick === null)
      .map((assignment) => [assignment.householdId, assignment] as const),
  );
  const dwellingById = new Map(
    rci.housing.dwellingUnits.map((dwelling) => [dwelling.dwellingUnitId, dwelling] as const),
  );
  const activeEmploymentByCitizen = new Map(
    rci.employment.assignments
      .filter((assignment) => assignment.endedAtTick === null)
      .map((assignment) => [assignment.citizenId, assignment] as const),
  );
  const workplaceById = new Map(
    rci.employment.workplaces.map((workplace) => [workplace.workplaceId, workplace] as const),
  );

  return Object.freeze(
    [...rci.population.citizens]
      .sort((a, b) => (a.citizenId < b.citizenId ? -1 : a.citizenId > b.citizenId ? 1 : 0))
      .map((citizen) => {
        const membership = activeMembershipByCitizen.get(citizen.citizenId);
        const housing = membership === undefined ? undefined : activeHousingByHousehold.get(membership.householdId);
        const dwelling = housing === undefined ? undefined : dwellingById.get(housing.dwellingUnitId);
        const employment = activeEmploymentByCitizen.get(citizen.citizenId);
        const workplace = employment === undefined ? undefined : workplaceById.get(employment.workplaceId);
        const homeBuildingId =
          dwelling !== undefined && dwelling.retiredAtTick === null && validBuildingIds.has(dwelling.buildingInstanceId)
            ? dwelling.buildingInstanceId
            : null;
        const workBuildingId =
          workplace !== undefined && workplace.retiredAtTick === null && validBuildingIds.has(workplace.buildingInstanceId)
            ? workplace.buildingInstanceId
            : null;
        return Object.freeze({
          citizenId: citizen.citizenId,
          homeBuildingId,
          workBuildingId,
          present: citizen.presence === 'resident',
        });
      }),
  );
}
