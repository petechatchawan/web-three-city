import type { BuildingSnapshot } from '@web-three-city/building-core';
import {
  absoluteGameMinute,
  deriveMacroHourIndex,
  type SimulationSnapshot,
} from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RCI_DETERMINISTIC_SEED,
  RciContractError,
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  createRciSnapshot,
} from '../src/index.js';

const buildings: BuildingSnapshot = Object.freeze({ revision: 0, instances: Object.freeze([]) });
const simulation: SimulationSnapshot = Object.freeze({
  revision: 0,
  absoluteGameMinute: absoluteGameMinute(120 * 60),
  growthSequence: 0,
});
const registries = createFoundationRciRegistries();

describe('RCI snapshots', () => {
  it('creates an empty immutable foundation snapshot', () => {
    const snapshot = createInitialRciSnapshot({
      absoluteTick: deriveMacroHourIndex(simulation.absoluteGameMinute),
    });

    expect(snapshot.revision).toBe(0);
    expect(snapshot.deterministicSeed).toBe(DEFAULT_RCI_DETERMINISTIC_SEED);
    expect(snapshot.population.citizens).toEqual([]);
    expect(snapshot.relationships.relationships).toEqual([]);
    expect(snapshot.households.households).toEqual([]);
    expect(snapshot.housing.dwellingUnits).toEqual([]);
    expect(snapshot.employment.workplaces).toEqual([]);
    expect(snapshot.migration.incomingRequests).toEqual([]);
    expect(snapshot.demand.demand).toEqual({
      residentialMilli: 0,
      commercialMilli: 0,
      industrialMilli: 0,
      evaluatedAtTick: 120,
    });
    expect(snapshot.demand.growthGates).toEqual({
      residentialOpen: false,
      commercialOpen: false,
      industrialOpen: false,
      evaluatedAtTick: 120,
    });
    expect(Object.values(snapshot.sequences).every((value) => value === 1)).toBe(true);
    expect(Object.isFrozen(snapshot.sequences)).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('canonicalizes records without mutating caller arrays', () => {
    const initial = createInitialRciSnapshot({
      absoluteTick: deriveMacroHourIndex(simulation.absoluteGameMinute),
    });
    const citizens = [
      {
        citizenId: 'citizen:2',
        presence: 'emigrated' as const,
        sexDefinitionId: 'sex.male',
        bornAtTick: -20_000,
        movedIntoCityAtTick: 0,
        movedOutOfCityAtTick: 100,
        diedAtTick: null,
      },
      {
        citizenId: 'citizen:1',
        presence: 'emigrated' as const,
        sexDefinitionId: 'sex.female',
        bornAtTick: -30_000,
        movedIntoCityAtTick: 0,
        movedOutOfCityAtTick: 110,
        diedAtTick: null,
      },
    ];

    const snapshot = createRciSnapshot(
      {
        ...initial,
        population: { ...initial.population, citizens },
        sequences: { ...initial.sequences, nextCitizen: 3 },
      },
      { buildings, simulation, registries },
    );

    expect(snapshot.population.citizens.map((citizen) => citizen.citizenId)).toEqual([
      'citizen:1',
      'citizen:2',
    ]);
    expect(citizens.map((citizen) => citizen.citizenId)).toEqual(['citizen:2', 'citizen:1']);
    expect(Object.isFrozen(snapshot.population.citizens)).toBe(true);
  });

  it('rejects unsafe revisions and sequence reuse', () => {
    const initial = createInitialRciSnapshot({
      absoluteTick: deriveMacroHourIndex(simulation.absoluteGameMinute),
    });
    expect(() =>
      createRciSnapshot({ ...initial, revision: -1 }, { buildings, simulation, registries }),
    ).toThrowError(new RciContractError('rci:invalid-state'));

    expect(() =>
      createRciSnapshot(
        {
          ...initial,
          population: {
            ...initial.population,
            citizens: [
              {
                citizenId: 'citizen:1',
                presence: 'emigrated',
                sexDefinitionId: 'sex.female',
                bornAtTick: -20_000,
                movedIntoCityAtTick: 0,
                movedOutOfCityAtTick: 100,
                diedAtTick: null,
              },
            ],
          },
          sequences: { ...initial.sequences, nextCitizen: 1 },
        },
        { buildings, simulation, registries },
      ),
    ).toThrowError(new RciContractError('rci:invalid-state'));
  });
});
