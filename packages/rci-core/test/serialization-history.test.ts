import type { BuildingSnapshot } from '@web-three-city/building-core';
import {
  absoluteGameMinute,
  deriveMacroHourIndex,
  type SimulationSnapshot,
} from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import {
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  createRciSnapshot,
  decodeRciSaveV1,
  encodeRciSaveV1,
  ageOriginForYearsAtMacroHour,
} from '../src/index.js';

const buildings: BuildingSnapshot = Object.freeze({ revision: 0, instances: Object.freeze([]) });
const simulation: SimulationSnapshot = Object.freeze({
  revision: 7,
  absoluteGameMinute: absoluteGameMinute(100 * 60),
  growthSequence: 0,
});
const registries = createFoundationRciRegistries();

function historicalSnapshot() {
  const initial = createInitialRciSnapshot({
    absoluteMacroHourIndex: deriveMacroHourIndex(simulation.absoluteGameMinute),
  });
  return createRciSnapshot(
    {
      ...initial,
      revision: 4,
      population: {
        revision: 2,
        citizens: [
          {
            citizenId: 'citizen:3',
            presence: 'emigrated',
            sexDefinitionId: 'sex.male',
            bornAtMacroHourIndex: ageOriginMacroHour(-5_000),
            movedIntoCityAtMacroHourIndex: macroHour(0),
            movedOutOfCityAtMacroHourIndex: macroHour(60),
            diedAtMacroHourIndex: null,
          },
          {
            citizenId: 'citizen:1',
            presence: 'deceased',
            sexDefinitionId: 'sex.female',
            bornAtMacroHourIndex: ageOriginMacroHour(-30_000),
            movedIntoCityAtMacroHourIndex: macroHour(0),
            movedOutOfCityAtMacroHourIndex: null,
            diedAtMacroHourIndex: macroHour(40),
          },
          {
            citizenId: 'citizen:2',
            presence: 'emigrated',
            sexDefinitionId: 'sex.male',
            bornAtMacroHourIndex: ageOriginMacroHour(-32_000),
            movedIntoCityAtMacroHourIndex: macroHour(0),
            movedOutOfCityAtMacroHourIndex: macroHour(50),
            diedAtMacroHourIndex: null,
          },
        ],
        qualifications: [
          {
            citizenQualificationId: 'citizen-qualification:1',
            citizenId: 'citizen:2',
            qualificationDefinitionId: 'qualification.skilled',
            awardedAtMacroHourIndex: macroHour(0),
            endedAtMacroHourIndex: macroHour(50),
            sourceDefinitionId: 'qualification-source.fixture',
          },
        ],
      },
      relationships: {
        revision: 2,
        relationships: [
          {
            relationshipId: 'relationship:3',
            orientation: 'directional',
            typeDefinitionId: 'relationship.parent.biological.father',
            sourceCitizenId: 'citizen:2',
            targetCitizenId: 'citizen:3',
            startedAtMacroHourIndex: macroHour(0),
            endedAtMacroHourIndex: null,
          },
          {
            relationshipId: 'relationship:1',
            orientation: 'undirected',
            typeDefinitionId: 'relationship.partner',
            participantCitizenIds: ['citizen:1', 'citizen:2'],
            startedAtMacroHourIndex: macroHour(0),
            endedAtMacroHourIndex: macroHour(40),
          },
          {
            relationshipId: 'relationship:2',
            orientation: 'directional',
            typeDefinitionId: 'relationship.parent.biological.mother',
            sourceCitizenId: 'citizen:1',
            targetCitizenId: 'citizen:3',
            startedAtMacroHourIndex: macroHour(0),
            endedAtMacroHourIndex: null,
          },
        ],
      },
      households: {
        revision: 2,
        households: [
          {
            householdId: 'household:1',
            foundedAtMacroHourIndex: macroHour(0),
            dissolvedAtMacroHourIndex: macroHour(60),
          },
        ],
        memberships: [
          {
            membershipId: 'household-membership:3',
            householdId: 'household:1',
            citizenId: 'citizen:3',
            startedAtMacroHourIndex: macroHour(0),
            endedAtMacroHourIndex: macroHour(60),
            endReasonDefinitionId: 'household-membership-ended.emigrated',
          },
          {
            membershipId: 'household-membership:1',
            householdId: 'household:1',
            citizenId: 'citizen:1',
            startedAtMacroHourIndex: macroHour(0),
            endedAtMacroHourIndex: macroHour(40),
            endReasonDefinitionId: 'household-membership-ended.deceased',
          },
          {
            membershipId: 'household-membership:2',
            householdId: 'household:1',
            citizenId: 'citizen:2',
            startedAtMacroHourIndex: macroHour(0),
            endedAtMacroHourIndex: macroHour(50),
            endReasonDefinitionId: 'household-membership-ended.emigrated',
          },
        ],
      },
      sequences: {
        ...initial.sequences,
        nextCitizen: 4,
        nextHousehold: 2,
        nextHouseholdMembership: 4,
        nextRelationship: 4,
        nextCitizenQualification: 2,
      },
    },
    { buildings, simulation, registries },
  );
}

describe('RciSaveV1 historical population regression', () => {
  it('round-trips historical Citizens, memberships, relationships, and qualifications', () => {
    const snapshot = historicalSnapshot();
    const encoded = encodeRciSaveV1(snapshot);
    const decoded = decodeRciSaveV1(encoded, { buildings, simulation, registries });

    expect(decoded).toEqual({ ok: true, value: snapshot });
    expect(encoded.population.citizens.map((citizen) => citizen.citizenId)).toEqual([
      'citizen:1',
      'citizen:2',
      'citizen:3',
    ]);
  });

  it('uses the current macro-hour to preserve a compressed age origin in the V1 wire format', () => {
    const original = historicalSnapshot();
    const snapshot = createRciSnapshot(
      {
        ...original,
        population: {
          ...original.population,
          citizens: original.population.citizens.map((citizen) =>
            citizen.citizenId === 'citizen:3'
              ? {
                  ...citizen,
                  bornAtMacroHourIndex: ageOriginForYearsAtMacroHour(macroHour(100), 18),
                }
              : citizen,
          ),
        },
      },
      { buildings, simulation, registries },
    );

    const encoded = encodeRciSaveV1(snapshot, macroHour(100));
    const encodedCitizen = encoded.population.citizens.find(
      (citizen) => citizen.citizenId === 'citizen:3',
    );

    expect(encodedCitizen?.bornAtTick).toBe(-155420);
    expect(decodeRciSaveV1(encoded, { buildings, simulation, registries })).toEqual({
      ok: true,
      value: snapshot,
    });
  });

  it('produces identical canonical Save output after authoritative array permutations', () => {
    const snapshot = historicalSnapshot();
    const permuted = {
      ...snapshot,
      population: {
        ...snapshot.population,
        citizens: [...snapshot.population.citizens].reverse(),
        qualifications: [...snapshot.population.qualifications].reverse(),
      },
      relationships: {
        ...snapshot.relationships,
        relationships: [...snapshot.relationships.relationships].reverse(),
      },
      households: {
        ...snapshot.households,
        households: [...snapshot.households.households].reverse(),
        memberships: [...snapshot.households.memberships].reverse(),
      },
    };

    expect(encodeRciSaveV1(permuted)).toEqual(encodeRciSaveV1(snapshot));
  });
});
import { ageOriginMacroHour, macroHour } from './temporal-fixtures.js';
