import { compareMacroHours, type MacroHourIndex } from '@web-three-city/simulation-core';
import { compareStableId } from '../contracts/ids.js';
import type { RciDefinitionRegistries } from '../definitions/contracts.js';
import { orderDisplacedHouseholds } from '../migration/displaced-queue.js';
import { planEmigrateHousehold } from '../migration/household-emigration.js';
import { planMaterializeIncomingHousehold } from '../migration/household-materialization.js';
import { orderIncomingHouseholdRequests } from '../migration/incoming-queue.js';
import { createFoundationQualificationResolver } from '../population/qualification-resolver.js';
import { canonicalizeRciSnapshot, type RciSnapshot } from '../rci-snapshot.js';
import { residentialCapacityProfileForId } from './capacity-profile.js';
import { planStartHousingAssignment } from './housing-assignment-plan.js';
import { createHousingIndex, type HousingProjection } from './housing-index.js';

export interface HousingReconciliationPlan {
  readonly baseRciRevision: number;
  readonly proposedSnapshot: RciSnapshot;
  readonly projection: HousingProjection;
  readonly relocatedHouseholdIds: readonly string[];
  readonly materializedRequestIds: readonly string[];
  readonly emigratedHouseholdIds: readonly string[];
  readonly valid: boolean;
  readonly invalidReason: string | null;
}

function suitableVacantUnits(
  snapshot: RciSnapshot,
  registries: RciDefinitionRegistries,
  minimumCapacity: number,
): readonly string[] {
  const occupied = new Set(
    snapshot.housing.assignments
      .filter((assignment) => assignment.endedAtMacroHourIndex === null)
      .map((assignment) => assignment.dwellingUnitId),
  );
  return Object.freeze(
    snapshot.housing.dwellingUnits
      .filter((unit) => {
        if (unit.retiredAtMacroHourIndex !== null || occupied.has(unit.dwellingUnitId))
          return false;
        return (
          residentialCapacityProfileForId(
            registries.capacityProfiles,
            unit.capacityProfileDefinitionId,
          ).residentCapacityPerUnit >= minimumCapacity
        );
      })
      .sort((a, b) => {
        const aCapacity = residentialCapacityProfileForId(
          registries.capacityProfiles,
          a.capacityProfileDefinitionId,
        ).residentCapacityPerUnit;
        const bCapacity = residentialCapacityProfileForId(
          registries.capacityProfiles,
          b.capacityProfileDefinitionId,
        ).residentCapacityPerUnit;
        return (
          aCapacity - minimumCapacity - (bCapacity - minimumCapacity) ||
          compareStableId(a.dwellingUnitId, b.dwellingUnitId)
        );
      })
      .map((unit) => unit.dwellingUnitId),
  );
}

export function planHousingReconciliation(
  input: Readonly<{
    snapshot: RciSnapshot;
    evaluationMacroHourIndex: MacroHourIndex;
    registries: RciDefinitionRegistries;
  }>,
): HousingReconciliationPlan {
  let snapshot = input.snapshot;
  const relocatedHouseholdIds: string[] = [];
  const materializedRequestIds: string[] = [];
  const emigratedHouseholdIds: string[] = [];

  for (const displaced of orderDisplacedHouseholds(snapshot.migration.displacedHouseholds)) {
    const unitId = suitableVacantUnits(
      snapshot,
      input.registries,
      displaced.minimumResidentCapacity,
    )[0];
    if (unitId !== undefined) {
      snapshot = planStartHousingAssignment({
        snapshot,
        householdId: displaced.householdId,
        dwellingUnitId: unitId,
        startedAtMacroHourIndex: input.evaluationMacroHourIndex,
      });
      snapshot = canonicalizeRciSnapshot({
        ...snapshot,
        revision: snapshot.revision + 1,
        migration: {
          ...snapshot.migration,
          revision: snapshot.migration.revision + 1,
          displacedHouseholds: snapshot.migration.displacedHouseholds.filter(
            (entry) => entry.householdId !== displaced.householdId,
          ),
        },
      });
      relocatedHouseholdIds.push(displaced.householdId);
      continue;
    }
    if (compareMacroHours(input.evaluationMacroHourIndex, displaced.expiresAtMacroHourIndex) >= 0) {
      snapshot = planEmigrateHousehold({
        snapshot,
        householdId: displaced.householdId,
        evaluationMacroHourIndex: input.evaluationMacroHourIndex,
        endReasonDefinitionId: 'household-membership-ended.household-emigrated',
      });
      emigratedHouseholdIds.push(displaced.householdId);
    }
  }

  const qualificationResolver = createFoundationQualificationResolver(input.registries);
  for (const request of orderIncomingHouseholdRequests(snapshot.migration.incomingRequests)) {
    const unitId = suitableVacantUnits(
      snapshot,
      input.registries,
      request.minimumResidentCapacity,
    )[0];
    if (unitId === undefined) continue;
    snapshot = planMaterializeIncomingHousehold({
      snapshot,
      requestId: request.requestId,
      dwellingUnitId: unitId,
      evaluationMacroHourIndex: input.evaluationMacroHourIndex,
      registries: input.registries,
      qualificationResolver,
    });
    materializedRequestIds.push(request.requestId);
  }

  return Object.freeze({
    baseRciRevision: input.snapshot.revision,
    proposedSnapshot: snapshot,
    projection: createHousingIndex(snapshot, input.registries).projection,
    relocatedHouseholdIds: Object.freeze(relocatedHouseholdIds),
    materializedRequestIds: Object.freeze(materializedRequestIds),
    emigratedHouseholdIds: Object.freeze(emigratedHouseholdIds),
    valid: true,
    invalidReason: null,
  });
}
