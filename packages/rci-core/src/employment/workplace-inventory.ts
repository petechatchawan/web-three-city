import { buildingDefinitionForId, type BuildingSnapshot } from '@web-three-city/building-core';
import type { MacroHourIndex } from '@web-three-city/simulation-core';
import { compareStableId } from '../contracts/ids.js';
import type { EmploymentAssignmentId, WorkplaceId } from '../contracts/ids.js';
import type { WorkplaceRecord } from '../contracts/records.js';
import type { RciDefinitionRegistries } from '../definitions/contracts.js';
import { canonicalizeRciSnapshot, type RciSnapshot } from '../rci-snapshot.js';
import { isWorkplaceCapacityProfile } from './workplace-capacity.js';

export interface WorkplaceInventorySynchronizationResult {
  readonly proposedSnapshot: RciSnapshot;
  readonly activatedWorkplaceIds: readonly WorkplaceId[];
  readonly retiredWorkplaceIds: readonly WorkplaceId[];
  readonly endedEmploymentAssignmentIds: readonly EmploymentAssignmentId[];
}

export function synchronizeWorkplaceInventory(
  input: Readonly<{
    snapshot: RciSnapshot;
    buildingsBefore: BuildingSnapshot;
    buildingsAfter: BuildingSnapshot;
    registries: RciDefinitionRegistries;
    evaluationMacroHourIndex: MacroHourIndex;
  }>,
): WorkplaceInventorySynchronizationResult {
  const existingById = new Map(
    input.snapshot.employment.workplaces.map((workplace) => [workplace.workplaceId, workplace]),
  );
  const expected = new Map<string, WorkplaceRecord>();

  for (const building of [...input.buildingsAfter.instances].sort((a, b) =>
    compareStableId(a.instanceId, b.instanceId),
  )) {
    if (building.lifecycle !== 'active') continue;
    const definition = buildingDefinitionForId(building.buildingDefinitionId);
    const profile = input.registries.capacityProfiles.get(definition.capacityProfileDefinitionId);
    if (!isWorkplaceCapacityProfile(profile)) continue;
    const workplaceId = `workplace:${building.instanceId}`;
    expected.set(
      workplaceId,
      existingById.get(workplaceId) ??
        Object.freeze({
          workplaceId,
          buildingInstanceId: building.instanceId,
          capacityProfileDefinitionId: profile.id,
          activatedAtMacroHourIndex: building.activatedAtMacroHourIndex,
          retiredAtMacroHourIndex: null,
        }),
    );
  }

  const activatedWorkplaceIds: string[] = [];
  const retiredWorkplaceIds: string[] = [];
  const workplaces = input.snapshot.employment.workplaces.map((workplace) => {
    if (workplace.retiredAtMacroHourIndex !== null || expected.has(workplace.workplaceId))
      return workplace;
    retiredWorkplaceIds.push(workplace.workplaceId);
    return Object.freeze({ ...workplace, retiredAtMacroHourIndex: input.evaluationMacroHourIndex });
  });
  for (const [workplaceId, workplace] of expected) {
    if (existingById.has(workplaceId)) continue;
    workplaces.push(workplace);
    activatedWorkplaceIds.push(workplaceId);
  }

  const retiredSet = new Set(retiredWorkplaceIds);
  const endedEmploymentAssignmentIds: string[] = [];
  const assignments = input.snapshot.employment.assignments.map((assignment) => {
    if (assignment.endedAtMacroHourIndex !== null || !retiredSet.has(assignment.workplaceId)) {
      return assignment;
    }
    endedEmploymentAssignmentIds.push(assignment.employmentAssignmentId);
    return Object.freeze({
      ...assignment,
      endedAtMacroHourIndex: input.evaluationMacroHourIndex,
      endReasonDefinitionId: 'employment-ended.workplace-retired',
    });
  });

  if (activatedWorkplaceIds.length === 0 && retiredWorkplaceIds.length === 0) {
    return Object.freeze({
      proposedSnapshot: input.snapshot,
      activatedWorkplaceIds: Object.freeze([]),
      retiredWorkplaceIds: Object.freeze([]),
      endedEmploymentAssignmentIds: Object.freeze([]),
    });
  }

  return Object.freeze({
    proposedSnapshot: canonicalizeRciSnapshot({
      ...input.snapshot,
      revision: input.snapshot.revision + 1,
      employment: {
        revision: input.snapshot.employment.revision + 1,
        workplaces,
        assignments,
      },
    }),
    activatedWorkplaceIds: Object.freeze(activatedWorkplaceIds.sort(compareStableId)),
    retiredWorkplaceIds: Object.freeze(retiredWorkplaceIds.sort(compareStableId)),
    endedEmploymentAssignmentIds: Object.freeze(endedEmploymentAssignmentIds.sort(compareStableId)),
  });
}
