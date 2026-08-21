import { describe, expect, it } from 'vitest';
import { RCI_TICKS_PER_YEAR, createFoundationRciRegistries, planRciTick } from '../src/index.js';
import {
  createPartneredHouseholdSnapshot,
  createSingleResidentSnapshot,
  testBuildings,
  testSimulationAfter,
  testSimulationBefore,
} from './population-fixtures.js';

const guaranteedBirthRegistries = createFoundationRciRegistries({
  populationRateProfiles: [
    {
      id: 'population-rate.fixture.birth.v1',
      fertilityEligibleSexDefinitionIds: ['sex.female'],
      fertilityBands: [{ minAge: 0, maxAge: null, annualRateMillionth: 1_000_000 }],
      mortalityBands: [{ minAge: 0, maxAge: null, annualRateMillionth: 0 }],
    },
  ],
});

const guaranteedDeathRegistries = createFoundationRciRegistries({
  populationRateProfiles: [
    {
      id: 'population-rate.fixture.death.v1',
      fertilityEligibleSexDefinitionIds: [],
      fertilityBands: [{ minAge: 0, maxAge: null, annualRateMillionth: 0 }],
      mortalityBands: [{ minAge: 0, maxAge: null, annualRateMillionth: 1_000_000 }],
    },
  ],
});

const zeroRateRegistries = createFoundationRciRegistries({
  populationRateProfiles: [
    {
      id: 'population-rate.fixture.zero.v1',
      fertilityEligibleSexDefinitionIds: ['sex.female'],
      fertilityBands: [{ minAge: 0, maxAge: null, annualRateMillionth: 0 }],
      mortalityBands: [{ minAge: 0, maxAge: null, annualRateMillionth: 0 }],
    },
  ],
});

describe('RCI daily population lifecycle', () => {
  it('does not run daily lifecycle work during 08:00 to 08:01', () => {
    const snapshot = createPartneredHouseholdSnapshot();
    const plan = planRciTick({
      rci: snapshot,
      simulationBefore: testSimulationBefore,
      simulationAfter: testSimulationAfter,
      macroHourTransition: {
        beforeAbsoluteGameMinute: 8 * 60,
        afterAbsoluteGameMinute: 8 * 60 + 1,
        beforeMacroHourIndex: 8,
        afterMacroHourIndex: 8,
        crossed: false,
      },
      buildingsBefore: testBuildings,
      buildingsAfter: testBuildings,
      registries: guaranteedBirthRegistries,
      configuration: { populationRateProfileDefinitionId: 'population-rate.fixture.birth.v1' },
    });

    expect(plan.valid).toBe(true);
    expect(plan.proposedSnapshot).toBe(snapshot);
    expect(plan.emittedEvents).toEqual([]);
  });

  it('creates a child, Household membership, and biological parent relationships atomically', () => {
    const snapshot = createPartneredHouseholdSnapshot();
    const plan = planRciTick({
      rci: snapshot,
      simulationBefore: testSimulationBefore,
      simulationAfter: testSimulationAfter,
      buildingsBefore: testBuildings,
      buildingsAfter: testBuildings,
      registries: guaranteedBirthRegistries,
      configuration: {
        populationRateProfileDefinitionId: 'population-rate.fixture.birth.v1',
      },
    });

    expect(plan.valid).toBe(true);
    const child = plan.proposedSnapshot.population.citizens.find(
      (citizen) => citizen.citizenId === 'citizen:3',
    );
    expect(child).toMatchObject({
      presence: 'resident',
      bornAtTick: 32,
      movedIntoCityAtTick: 32,
    });
    expect(['sex.female', 'sex.male']).toContain(child?.sexDefinitionId);
    expect(plan.proposedSnapshot.households.memberships).toContainEqual({
      membershipId: 'household-membership:3',
      householdId: 'household:1',
      citizenId: 'citizen:3',
      startedAtTick: 32,
      endedAtTick: null,
      endReasonDefinitionId: null,
    });
    expect(plan.proposedSnapshot.relationships.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          typeDefinitionId: 'relationship.parent.biological.mother',
          sourceCitizenId: 'citizen:1',
          targetCitizenId: 'citizen:3',
        }),
        expect.objectContaining({
          typeDefinitionId: 'relationship.parent.biological.father',
          sourceCitizenId: 'citizen:2',
          targetCitizenId: 'citizen:3',
        }),
      ]),
    );
    expect(plan.emittedEvents.map((event) => event.type)).toContain('citizen.born');
  });

  it('marks death, closes membership and partner history, and dissolves an empty Household', () => {
    const snapshot = createSingleResidentSnapshot();
    const plan = planRciTick({
      rci: snapshot,
      simulationBefore: testSimulationBefore,
      simulationAfter: testSimulationAfter,
      buildingsBefore: testBuildings,
      buildingsAfter: testBuildings,
      registries: guaranteedDeathRegistries,
      configuration: {
        populationRateProfileDefinitionId: 'population-rate.fixture.death.v1',
      },
    });

    expect(plan.valid).toBe(true);
    expect(plan.proposedSnapshot.population.citizens[0]).toMatchObject({
      presence: 'deceased',
      diedAtTick: 32,
    });
    expect(plan.proposedSnapshot.households.memberships[0]?.endedAtTick).toBe(32);
    expect(plan.proposedSnapshot.households.households[0]?.dissolvedAtTick).toBe(32);
    expect(plan.emittedEvents.map((event) => event.type)).toContain('citizen.died');
  });

  it('awards a deterministic qualification at the exact working-age boundary', () => {
    const snapshot = createSingleResidentSnapshot();
    const reachingWorkingAge = {
      ...snapshot,
      population: {
        ...snapshot.population,
        citizens: [
          {
            ...snapshot.population.citizens[0]!,
            bornAtTick: 32 - 18 * RCI_TICKS_PER_YEAR,
          },
        ],
      },
    };
    const plan = planRciTick({
      rci: reachingWorkingAge,
      simulationBefore: testSimulationBefore,
      simulationAfter: testSimulationAfter,
      buildingsBefore: testBuildings,
      buildingsAfter: testBuildings,
      registries: zeroRateRegistries,
      configuration: {
        populationRateProfileDefinitionId: 'population-rate.fixture.zero.v1',
      },
    });

    expect(plan.valid).toBe(true);
    expect(plan.proposedSnapshot.population.qualifications).toHaveLength(1);
    expect([
      'qualification.entry',
      'qualification.skilled',
      'qualification.professional',
    ]).toContain(plan.proposedSnapshot.population.qualifications[0]?.qualificationDefinitionId);
    expect(plan.emittedEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining(['citizen.reached-age-band', 'qualification.awarded']),
    );
  });

  it('is independent of Citizen, Relationship, and Membership array order', () => {
    const snapshot = createPartneredHouseholdSnapshot();
    const reversed = {
      ...snapshot,
      population: {
        ...snapshot.population,
        citizens: [...snapshot.population.citizens].reverse(),
      },
      relationships: {
        ...snapshot.relationships,
        relationships: [...snapshot.relationships.relationships].reverse(),
      },
      households: {
        ...snapshot.households,
        memberships: [...snapshot.households.memberships].reverse(),
      },
    };
    const input = {
      simulationBefore: testSimulationBefore,
      simulationAfter: testSimulationAfter,
      buildingsBefore: testBuildings,
      buildingsAfter: testBuildings,
      registries: guaranteedBirthRegistries,
      configuration: {
        populationRateProfileDefinitionId: 'population-rate.fixture.birth.v1',
      },
    } as const;

    const first = planRciTick({ ...input, rci: snapshot });
    const second = planRciTick({ ...input, rci: reversed });
    expect(first.proposedSnapshot).toEqual(second.proposedSnapshot);
    expect(first.emittedEvents).toEqual(second.emittedEvents);
  });
});
