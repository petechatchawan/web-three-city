import type { BuildingSnapshot } from '@web-three-city/building-core';
import { describe, expect, it } from 'vitest';
import {
  createEmploymentIndex,
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  planEmploymentReconciliation,
  synchronizeWorkplaceInventory,
} from '../src/index.js';

const registries = createFoundationRciRegistries();
const buildings: BuildingSnapshot = Object.freeze({
  revision: 1,
  instances: Object.freeze([
    Object.freeze({
      instanceId: 'building:growth:office',
      buildingDefinitionId: 'commercial-office-2x2',
      buildingDefinitionVersion: 1,
      originCell: Object.freeze({ x: 2, z: 2 }),
      rotationQuarterTurns: 0,
      lifecycle: 'active',
      activatedAtTick: 24,
    }),
  ]),
});

function workforce() {
  const initial = createInitialRciSnapshot({ absoluteTick: 32, deterministicSeed: 11 });
  return {
    ...initial,
    population: {
      revision: 1,
      citizens: [
        {
          citizenId: 'citizen:1',
          presence: 'resident' as const,
          sexDefinitionId: 'sex.female',
          bornAtTick: 32 - 30 * 8_640,
          movedIntoCityAtTick: 0,
          movedOutOfCityAtTick: null,
          diedAtTick: null,
        },
        {
          citizenId: 'citizen:2',
          presence: 'resident' as const,
          sexDefinitionId: 'sex.male',
          bornAtTick: 32 - 40 * 8_640,
          movedIntoCityAtTick: 0,
          movedOutOfCityAtTick: null,
          diedAtTick: null,
        },
      ],
      qualifications: [
        {
          citizenQualificationId: 'citizen-qualification:1',
          citizenId: 'citizen:1',
          qualificationDefinitionId: 'qualification.professional',
          awardedAtTick: 0,
          endedAtTick: null,
          sourceDefinitionId: 'fixture',
        },
        {
          citizenQualificationId: 'citizen-qualification:2',
          citizenId: 'citizen:2',
          qualificationDefinitionId: 'qualification.entry',
          awardedAtTick: 0,
          endedAtTick: null,
          sourceDefinitionId: 'fixture',
        },
      ],
    },
    sequences: { ...initial.sequences, nextCitizen: 3, nextCitizenQualification: 3 },
  };
}

describe('Workplace and Employment foundation', () => {
  it('materializes one Workplace from an active C/I Building and retires it historically', () => {
    const activated = synchronizeWorkplaceInventory({
      snapshot: workforce(),
      buildingsBefore: { revision: 0, instances: [] },
      buildingsAfter: buildings,
      registries,
      evaluationTick: 32,
    });
    expect(activated.activatedWorkplaceIds).toEqual(['workplace:building:growth:office']);
    expect(activated.proposedSnapshot.employment.workplaces[0]?.capacityProfileDefinitionId).toBe(
      'capacity.commercial.office.v1',
    );
    const retired = synchronizeWorkplaceInventory({
      snapshot: activated.proposedSnapshot,
      buildingsBefore: buildings,
      buildingsAfter: { revision: 2, instances: [] },
      registries,
      evaluationTick: 40,
    });
    expect(retired.proposedSnapshot.employment.workplaces[0]?.retiredAtTick).toBe(40);
  });

  it('matches unemployed residents before controlled upgrades using stable best fit', () => {
    const withWorkplace = synchronizeWorkplaceInventory({
      snapshot: workforce(),
      buildingsBefore: { revision: 0, instances: [] },
      buildingsAfter: buildings,
      registries,
      evaluationTick: 32,
    }).proposedSnapshot;
    const plan = planEmploymentReconciliation({
      snapshot: withWorkplace,
      evaluationTick: 32,
      registries,
      allowControlledUpgrade: true,
    });
    expect(plan.startedAssignmentIds).toHaveLength(2);
    expect(
      plan.proposedSnapshot.employment.assignments.find((value) => value.citizenId === 'citizen:1'),
    ).toMatchObject({ positionGroupDefinitionId: 'position.professional' });
    expect(
      plan.proposedSnapshot.employment.assignments.find((value) => value.citizenId === 'citizen:2'),
    ).toMatchObject({ positionGroupDefinitionId: 'position.entry' });
    expect(createEmploymentIndex(plan.proposedSnapshot, registries, 32).projection).toMatchObject({
      employedResidentCount: 2,
      unemployedResidentCount: 0,
    });
  });

  it('is permutation deterministic and never displaces a valid worker', () => {
    const withWorkplace = synchronizeWorkplaceInventory({
      snapshot: workforce(),
      buildingsBefore: { revision: 0, instances: [] },
      buildingsAfter: buildings,
      registries,
      evaluationTick: 32,
    }).proposedSnapshot;
    const forward = planEmploymentReconciliation({
      snapshot: withWorkplace,
      evaluationTick: 32,
      registries,
    });
    const reversed = planEmploymentReconciliation({
      snapshot: {
        ...withWorkplace,
        population: {
          ...withWorkplace.population,
          citizens: [...withWorkplace.population.citizens].reverse(),
          qualifications: [...withWorkplace.population.qualifications].reverse(),
        },
      },
      evaluationTick: 32,
      registries,
    });
    expect(reversed.proposedSnapshot).toEqual(forward.proposedSnapshot);
  });
});
