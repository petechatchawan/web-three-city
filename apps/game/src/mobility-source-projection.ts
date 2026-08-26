import type { BuildingSnapshot } from '@web-three-city/building-core';
import type { PresentCitizenMobilityProjection } from '@web-three-city/citizen-mobility-core';
import type { RciSnapshot } from '@web-three-city/rci-core';
import {
  macroHourIndex,
  macroHourValue,
  type MacroHourIndex,
} from '@web-three-city/simulation-core';

const MAX_CACHED_PROJECTIONS_PER_SOURCE = 4;
const PROJECTION_CACHE = new WeakMap<
  object,
  WeakMap<object, Map<number, readonly PresentCitizenMobilityProjection[]>>
>();

export function createPresentCitizenMobilityProjection(
  rci: RciSnapshot,
  buildings: BuildingSnapshot,
  evaluationMacroHourIndex: MacroHourIndex,
): readonly PresentCitizenMobilityProjection[] {
  const validatedEvaluationMacroHourIndex = macroHourIndex(
    macroHourValue(evaluationMacroHourIndex),
  );
  const evaluationMacroHourValue = macroHourValue(validatedEvaluationMacroHourIndex);
  const canReuse = Object.isFrozen(rci) && Object.isFrozen(buildings);
  let byBuilding:
    WeakMap<object, Map<number, readonly PresentCitizenMobilityProjection[]>> | undefined;
  let byTick: Map<number, readonly PresentCitizenMobilityProjection[]> | undefined;
  if (canReuse) {
    byBuilding = PROJECTION_CACHE.get(rci);
    if (byBuilding === undefined) {
      byBuilding = new WeakMap();
      PROJECTION_CACHE.set(rci, byBuilding);
    }
    byTick = byBuilding.get(buildings);
    if (byTick === undefined) {
      byTick = new Map();
      byBuilding.set(buildings, byTick);
    }
    const cached = byTick.get(evaluationMacroHourValue);
    if (cached !== undefined) return cached;
  }
  const validBuildingIds = new Set(
    buildings.instances
      .filter((instance) => instance.lifecycle === undefined || instance.lifecycle === 'active')
      .map((instance) => instance.instanceId),
  );
  const activeMembershipByCitizen = new Map(
    rci.households.memberships
      .filter((membership) => membership.endedAtMacroHourIndex === null)
      .map((membership) => [membership.citizenId, membership] as const),
  );
  const activeHousingByHousehold = new Map(
    rci.housing.assignments
      .filter((assignment) => assignment.endedAtMacroHourIndex === null)
      .map((assignment) => [assignment.householdId, assignment] as const),
  );
  const dwellingById = new Map(
    rci.housing.dwellingUnits.map((dwelling) => [dwelling.dwellingUnitId, dwelling] as const),
  );
  const activeEmploymentByCitizen = new Map(
    rci.employment.assignments
      .filter((assignment) => assignment.endedAtMacroHourIndex === null)
      .map((assignment) => [assignment.citizenId, assignment] as const),
  );
  const workplaceById = new Map(
    rci.employment.workplaces.map((workplace) => [workplace.workplaceId, workplace] as const),
  );

  const projection = Object.freeze(
    [...rci.population.citizens]
      .sort((a, b) => (a.citizenId < b.citizenId ? -1 : a.citizenId > b.citizenId ? 1 : 0))
      .map((citizen) => {
        const membership = activeMembershipByCitizen.get(citizen.citizenId);
        const housing =
          membership === undefined
            ? undefined
            : activeHousingByHousehold.get(membership.householdId);
        const dwelling =
          housing === undefined ? undefined : dwellingById.get(housing.dwellingUnitId);
        const employment = activeEmploymentByCitizen.get(citizen.citizenId);
        const workplace =
          employment === undefined ? undefined : workplaceById.get(employment.workplaceId);
        const homeBuildingId =
          dwelling !== undefined &&
          dwelling.retiredAtMacroHourIndex === null &&
          validBuildingIds.has(dwelling.buildingInstanceId)
            ? dwelling.buildingInstanceId
            : null;
        const workBuildingId =
          workplace !== undefined &&
          workplace.retiredAtMacroHourIndex === null &&
          validBuildingIds.has(workplace.buildingInstanceId)
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
  if (byTick !== undefined) {
    byTick.set(evaluationMacroHourValue, projection);
    if (byTick.size > MAX_CACHED_PROJECTIONS_PER_SOURCE) {
      const oldest = byTick.keys().next().value;
      if (oldest !== undefined) byTick.delete(oldest);
    }
  }
  return projection;
}
