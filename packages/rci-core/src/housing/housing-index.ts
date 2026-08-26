import type { HouseholdId } from '../contracts/ids.js';
import type { RciDefinitionRegistries } from '../definitions/contracts.js';
import type { RciSnapshot } from '../rci-snapshot.js';
import { residentialCapacityProfileForId } from './capacity-profile.js';

export interface HousingProjection {
  readonly activeDwellingCount: number;
  readonly occupiedDwellingCount: number;
  readonly vacantDwellingCount: number;
  readonly residentCapacity: number;
  readonly residentCount: number;
  readonly overcrowdedResidentCount: number;
}

export interface HousingIndex {
  readonly activeAssignmentByHouseholdId: ReadonlyMap<string, string>;
  readonly activeAssignmentByDwellingUnitId: ReadonlyMap<string, string>;
  readonly residentCountByHouseholdId: ReadonlyMap<string, number>;
  readonly projection: HousingProjection;
}

export function createHousingIndex(
  snapshot: RciSnapshot,
  registries: RciDefinitionRegistries,
): HousingIndex {
  const residentCitizens = new Set(
    snapshot.population.citizens
      .filter((citizen) => citizen.presence === 'resident')
      .map((citizen) => citizen.citizenId),
  );
  const residentCountByHouseholdId = new Map<HouseholdId, number>();
  for (const membership of snapshot.households.memberships) {
    if (membership.endedAtMacroHourIndex !== null || !residentCitizens.has(membership.citizenId))
      continue;
    residentCountByHouseholdId.set(
      membership.householdId,
      (residentCountByHouseholdId.get(membership.householdId) ?? 0) + 1,
    );
  }

  const activeAssignmentByHouseholdId = new Map<string, string>();
  const activeAssignmentByDwellingUnitId = new Map<string, string>();
  const assignmentById = new Map(
    snapshot.housing.assignments.map((assignment) => [assignment.housingAssignmentId, assignment]),
  );
  for (const assignment of snapshot.housing.assignments) {
    if (assignment.endedAtMacroHourIndex !== null) continue;
    activeAssignmentByHouseholdId.set(assignment.householdId, assignment.housingAssignmentId);
    activeAssignmentByDwellingUnitId.set(assignment.dwellingUnitId, assignment.housingAssignmentId);
  }

  let residentCapacity = 0;
  let overcrowdedResidentCount = 0;
  const activeUnits = snapshot.housing.dwellingUnits.filter(
    (unit) => unit.retiredAtMacroHourIndex === null,
  );
  for (const unit of activeUnits) {
    const profile = residentialCapacityProfileForId(
      registries.capacityProfiles,
      unit.capacityProfileDefinitionId,
    );
    residentCapacity += profile.residentCapacityPerUnit;
    const assignmentId = activeAssignmentByDwellingUnitId.get(unit.dwellingUnitId);
    if (assignmentId === undefined) continue;
    const assignment = assignmentById.get(assignmentId);
    if (assignment === undefined) continue;
    const count = residentCountByHouseholdId.get(assignment.householdId) ?? 0;
    overcrowdedResidentCount += Math.max(0, count - profile.residentCapacityPerUnit);
  }

  const occupiedDwellingCount = activeAssignmentByDwellingUnitId.size;
  return Object.freeze({
    activeAssignmentByHouseholdId,
    activeAssignmentByDwellingUnitId,
    residentCountByHouseholdId,
    projection: Object.freeze({
      activeDwellingCount: activeUnits.length,
      occupiedDwellingCount,
      vacantDwellingCount: Math.max(0, activeUnits.length - occupiedDwellingCount),
      residentCapacity,
      residentCount: residentCitizens.size,
      overcrowdedResidentCount,
    }),
  });
}
