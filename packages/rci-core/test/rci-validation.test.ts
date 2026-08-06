import type { BuildingSnapshot } from '@web-three-city/building-core';
import type { SimulationSnapshot } from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import {
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  validateRciSnapshot,
} from '../src/index.js';

const buildings: BuildingSnapshot = Object.freeze({ revision: 0, instances: Object.freeze([]) });
const simulation: SimulationSnapshot = Object.freeze({
  revision: 0,
  absoluteTick: 120,
  growthSequence: 0,
});
const registries = createFoundationRciRegistries();

describe('RCI validation', () => {
  it('accepts the empty coherent state', () => {
    const snapshot = createInitialRciSnapshot({ absoluteTick: simulation.absoluteTick });
    expect(validateRciSnapshot(snapshot, buildings, simulation, registries)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('reports sorted dangling and duplicate active references', () => {
    const initial = createInitialRciSnapshot({ absoluteTick: simulation.absoluteTick });
    const snapshot = {
      ...initial,
      population: {
        ...initial.population,
        citizens: [
          {
            citizenId: 'citizen:1',
            presence: 'resident' as const,
            sexDefinitionId: 'sex.female',
            bornAtTick: -20_000,
            movedIntoCityAtTick: 0,
            movedOutOfCityAtTick: null,
            diedAtTick: null,
          },
        ],
      },
      households: {
        ...initial.households,
        households: [{ householdId: 'household:1', foundedAtTick: 0, dissolvedAtTick: null }],
        memberships: [
          {
            membershipId: 'household-membership:1',
            householdId: 'household:1',
            citizenId: 'citizen:1',
            startedAtTick: 0,
            endedAtTick: null,
            endReasonDefinitionId: null,
          },
          {
            membershipId: 'household-membership:2',
            householdId: 'household:missing',
            citizenId: 'citizen:1',
            startedAtTick: 1,
            endedAtTick: null,
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

  it('rejects an unknown definition and a future demand tick', () => {
    const initial = createInitialRciSnapshot({ absoluteTick: simulation.absoluteTick });
    const snapshot = {
      ...initial,
      population: {
        ...initial.population,
        citizens: [
          {
            citizenId: 'citizen:1',
            presence: 'emigrated' as const,
            sexDefinitionId: 'sex.unknown',
            bornAtTick: -20_000,
            movedIntoCityAtTick: 0,
            movedOutOfCityAtTick: 100,
            diedAtTick: null,
          },
        ],
      },
      demand: {
        ...initial.demand,
        demand: { ...initial.demand.demand, evaluatedAtTick: 121 },
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
