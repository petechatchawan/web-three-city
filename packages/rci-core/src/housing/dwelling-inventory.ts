import { buildingDefinitionForId, type BuildingSnapshot } from '@web-three-city/building-core';
import { compareStableId } from '../contracts/ids.js';
import type { DwellingUnitId, HousingAssignmentId } from '../contracts/ids.js';
import type { DisplacedHouseholdEntry, DwellingUnitRecord } from '../contracts/records.js';
import type { RciDefinitionRegistries } from '../definitions/contracts.js';
import { canonicalizeRciSnapshot, type RciSnapshot } from '../rci-snapshot.js';
import { residentialCapacityProfileForId } from './capacity-profile.js';

export interface DwellingInventorySynchronizationResult {
  readonly proposedSnapshot: RciSnapshot;
  readonly activatedDwellingUnitIds: readonly DwellingUnitId[];
  readonly retiredDwellingUnitIds: readonly DwellingUnitId[];
  readonly endedHousingAssignmentIds: readonly HousingAssignmentId[];
}

export function synchronizeDwellingInventory(
  input: Readonly<{
    snapshot: RciSnapshot;
    buildingsBefore: BuildingSnapshot;
    buildingsAfter: BuildingSnapshot;
    registries: RciDefinitionRegistries;
    evaluationTick: number;
    displacedExpiryTicks?: number;
  }>,
): DwellingInventorySynchronizationResult {
  const existingById = new Map(
    input.snapshot.housing.dwellingUnits.map((unit) => [unit.dwellingUnitId, unit]),
  );
  const expected = new Map<string, DwellingUnitRecord>();

  for (const building of [...input.buildingsAfter.instances].sort((a, b) =>
    compareStableId(a.instanceId, b.instanceId),
  )) {
    if (building.lifecycle !== 'active') continue;
    const definition = buildingDefinitionForId(building.buildingDefinitionId);
    const profile = input.registries.capacityProfiles.get(definition.capacityProfileDefinitionId);
    if (profile.kind !== 'residential') continue;
    const residential = residentialCapacityProfileForId(
      input.registries.capacityProfiles,
      definition.capacityProfileDefinitionId,
    );
    for (let unitIndex = 0; unitIndex < residential.dwellingUnitCount; unitIndex += 1) {
      const dwellingUnitId = `dwelling:${building.instanceId}:${unitIndex}`;
      expected.set(
        dwellingUnitId,
        existingById.get(dwellingUnitId) ??
          Object.freeze({
            dwellingUnitId,
            buildingInstanceId: building.instanceId,
            capacityProfileDefinitionId: residential.id,
            unitIndex,
            activatedAtTick: building.activatedAtTick,
            retiredAtTick: null,
          }),
      );
    }
  }

  const activatedDwellingUnitIds: string[] = [];
  const retiredDwellingUnitIds: string[] = [];
  const units = input.snapshot.housing.dwellingUnits.map((unit) => {
    if (unit.retiredAtTick !== null || expected.has(unit.dwellingUnitId)) return unit;
    retiredDwellingUnitIds.push(unit.dwellingUnitId);
    return Object.freeze({ ...unit, retiredAtTick: input.evaluationTick });
  });
  for (const [id, unit] of expected) {
    if (existingById.has(id)) continue;
    units.push(unit);
    activatedDwellingUnitIds.push(id);
  }

  const retiredSet = new Set(retiredDwellingUnitIds);
  const endedHousingAssignmentIds: string[] = [];
  const displacedByHousehold = new Map(
    input.snapshot.migration.displacedHouseholds.map((entry) => [entry.householdId, entry]),
  );
  const assignments = input.snapshot.housing.assignments.map((assignment) => {
    if (assignment.endedAtTick !== null || !retiredSet.has(assignment.dwellingUnitId)) {
      return assignment;
    }
    endedHousingAssignmentIds.push(assignment.housingAssignmentId);
    if (!displacedByHousehold.has(assignment.householdId)) {
      const memberCount = input.snapshot.households.memberships.filter(
        (membership) =>
          membership.householdId === assignment.householdId && membership.endedAtTick === null,
      ).length;
      const entry: DisplacedHouseholdEntry = Object.freeze({
        householdId: assignment.householdId,
        displacedAtTick: input.evaluationTick,
        expiresAtTick: input.evaluationTick + (input.displacedExpiryTicks ?? 720),
        minimumResidentCapacity: Math.max(1, memberCount),
        displacementPressure: 100_000,
        deterministicSequence: input.snapshot.sequences.nextDomainEvent + displacedByHousehold.size,
      });
      displacedByHousehold.set(entry.householdId, entry);
    }
    return Object.freeze({
      ...assignment,
      endedAtTick: input.evaluationTick,
      endReasonDefinitionId: 'housing-ended.dwelling-retired',
    });
  });

  const changed = activatedDwellingUnitIds.length > 0 || retiredDwellingUnitIds.length > 0;
  if (!changed) {
    return Object.freeze({
      proposedSnapshot: input.snapshot,
      activatedDwellingUnitIds: Object.freeze([]),
      retiredDwellingUnitIds: Object.freeze([]),
      endedHousingAssignmentIds: Object.freeze([]),
    });
  }

  const migrationChanged =
    displacedByHousehold.size !== input.snapshot.migration.displacedHouseholds.length;
  const proposedSnapshot = canonicalizeRciSnapshot({
    ...input.snapshot,
    revision: input.snapshot.revision + 1,
    housing: {
      revision: input.snapshot.housing.revision + 1,
      dwellingUnits: units,
      assignments,
    },
    migration: {
      ...input.snapshot.migration,
      revision: migrationChanged
        ? input.snapshot.migration.revision + 1
        : input.snapshot.migration.revision,
      displacedHouseholds: [...displacedByHousehold.values()],
    },
    sequences: migrationChanged
      ? {
          ...input.snapshot.sequences,
          nextDomainEvent:
            input.snapshot.sequences.nextDomainEvent +
            (displacedByHousehold.size - input.snapshot.migration.displacedHouseholds.length),
        }
      : input.snapshot.sequences,
  });
  return Object.freeze({
    proposedSnapshot,
    activatedDwellingUnitIds: Object.freeze(activatedDwellingUnitIds.sort(compareStableId)),
    retiredDwellingUnitIds: Object.freeze(retiredDwellingUnitIds.sort(compareStableId)),
    endedHousingAssignmentIds: Object.freeze(endedHousingAssignmentIds.sort(compareStableId)),
  });
}
