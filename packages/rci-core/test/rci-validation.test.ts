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
  validateRciSnapshot,
} from '../src/index.js';
import { ageOriginMacroHour, macroHour } from './temporal-fixtures.js';

const buildings: BuildingSnapshot = Object.freeze({ revision: 0, instances: Object.freeze([]) });
const simulation: SimulationSnapshot = Object.freeze({
  revision: 0,
  absoluteGameMinute: absoluteGameMinute(120 * 60),
  growthSequence: 0,
});
const registries = createFoundationRciRegistries();

describe('RCI validation', () => {
  it('accepts the empty coherent state', () => {
    const snapshot = createInitialRciSnapshot({
      absoluteMacroHourIndex: deriveMacroHourIndex(simulation.absoluteGameMinute),
    });
    expect(validateRciSnapshot(snapshot, buildings, simulation, registries)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('reports sorted dangling and duplicate active references', () => {
    const initial = createInitialRciSnapshot({
      absoluteMacroHourIndex: deriveMacroHourIndex(simulation.absoluteGameMinute),
    });
    const snapshot = {
      ...initial,
      population: {
        ...initial.population,
        citizens: [
          {
            citizenId: 'citizen:1',
            presence: 'resident' as const,
            sexDefinitionId: 'sex.female',
            bornAtMacroHourIndex: ageOriginMacroHour(-20_000),
            movedIntoCityAtMacroHourIndex: macroHour(0),
            movedOutOfCityAtMacroHourIndex: null,
            diedAtMacroHourIndex: null,
          },
        ],
      },
      households: {
        ...initial.households,
        households: [
          {
            householdId: 'household:1',
            foundedAtMacroHourIndex: macroHour(0),
            dissolvedAtMacroHourIndex: null,
          },
        ],
        memberships: [
          {
            membershipId: 'household-membership:1',
            householdId: 'household:1',
            citizenId: 'citizen:1',
            startedAtMacroHourIndex: macroHour(0),
            endedAtMacroHourIndex: null,
            endReasonDefinitionId: null,
          },
          {
            membershipId: 'household-membership:2',
            householdId: 'household:missing',
            citizenId: 'citizen:1',
            startedAtMacroHourIndex: macroHour(1),
            endedAtMacroHourIndex: null,
            endReasonDefinitionId: null,
          },
        ],
      },
      sequences: {
        ...initial.sequences,
        nextCitizen: 2,
        nextHousehold: 2,
        nextHouseholdMembership: 3,
      },
    };

    const result = validateRciSnapshot(snapshot, buildings, simulation, registries);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'rci:dangling-household',
      'rci:duplicate-active-membership',
      'rci:invalid-state',
    ]);
  });

  it('rejects an unknown definition and a future demand macroHourIndex', () => {
    const initial = createInitialRciSnapshot({
      absoluteMacroHourIndex: deriveMacroHourIndex(simulation.absoluteGameMinute),
    });
    const snapshot = {
      ...initial,
      population: {
        ...initial.population,
        citizens: [
          {
            citizenId: 'citizen:1',
            presence: 'emigrated' as const,
            sexDefinitionId: 'sex.unknown',
            bornAtMacroHourIndex: ageOriginMacroHour(-20_000),
            movedIntoCityAtMacroHourIndex: macroHour(0),
            movedOutOfCityAtMacroHourIndex: macroHour(100),
            diedAtMacroHourIndex: null,
          },
        ],
      },
      demand: {
        ...initial.demand,
        demand: { ...initial.demand.demand, evaluatedAtMacroHourIndex: macroHour(121) },
      },
      sequences: { ...initial.sequences, nextCitizen: 2 },
    };

    const result = validateRciSnapshot(snapshot, buildings, simulation, registries);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'rci:invalid-demand',
      'rci:unknown-definition',
    ]);
  });
});
