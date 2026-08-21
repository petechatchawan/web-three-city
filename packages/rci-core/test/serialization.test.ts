import type { BuildingSnapshot } from '@web-three-city/building-core';
import { deriveMacroHourIndex, type SimulationSnapshot } from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import {
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  decodeRciSaveV1,
  encodeRciSaveV1,
} from '../src/index.js';

const buildings: BuildingSnapshot = Object.freeze({ revision: 0, instances: Object.freeze([]) });
const simulation: SimulationSnapshot = Object.freeze({
  revision: 0,
  absoluteGameMinute: 120 * 60,
  growthSequence: 0,
});
const registries = createFoundationRciRegistries();

describe('RciSaveV1', () => {
  it('round-trips the canonical empty snapshot losslessly', () => {
    const snapshot = createInitialRciSnapshot({
      absoluteTick: deriveMacroHourIndex(simulation.absoluteGameMinute),
    });
    const encoded = encodeRciSaveV1(snapshot);
    const decoded = decodeRciSaveV1(encoded, { buildings, simulation, registries });

    expect(encoded.kind).toBe('rci-save');
    expect(encoded.schemaVersion).toBe(1);
    expect(decoded).toEqual({ ok: true, value: snapshot });
  });

  it('encodes authoritative arrays in stable id order', () => {
    const snapshot = createInitialRciSnapshot({
      absoluteTick: deriveMacroHourIndex(simulation.absoluteGameMinute),
    });
    const encoded = encodeRciSaveV1({
      ...snapshot,
      population: {
        ...snapshot.population,
        citizens: [
          {
            citizenId: 'citizen:2',
            presence: 'emigrated',
            sexDefinitionId: 'sex.male',
            bornAtTick: -20_000,
            movedIntoCityAtTick: 0,
            movedOutOfCityAtTick: 100,
            diedAtTick: null,
          },
          {
            citizenId: 'citizen:1',
            presence: 'emigrated',
            sexDefinitionId: 'sex.female',
            bornAtTick: -30_000,
            movedIntoCityAtTick: 0,
            movedOutOfCityAtTick: 110,
            diedAtTick: null,
          },
        ],
      },
      sequences: { ...snapshot.sequences, nextCitizen: 3 },
    });

    expect(encoded.population.citizens.map((citizen) => citizen.citizenId)).toEqual([
      'citizen:1',
      'citizen:2',
    ]);
  });

  it('returns structured errors for invalid schema and definitions', () => {
    expect(
      decodeRciSaveV1(
        { kind: 'rci-save', schemaVersion: 2 },
        {
          buildings,
          simulation,
          registries,
        },
      ),
    ).toEqual({ ok: false, error: { code: 'rci-save:invalid-schema' } });

    const encoded = encodeRciSaveV1(
      createInitialRciSnapshot({
        absoluteTick: deriveMacroHourIndex(simulation.absoluteGameMinute),
      }),
    );
    const invalid = {
      ...encoded,
      population: {
        ...encoded.population,
        citizens: [
          {
            citizenId: 'citizen:1',
            presence: 'emigrated',
            sexDefinitionId: 'sex.unknown',
            bornAtTick: -20_000,
            movedIntoCityAtTick: 0,
            movedOutOfCityAtTick: 100,
            diedAtTick: null,
          },
        ],
      },
      sequences: { ...encoded.sequences, nextCitizen: 2 },
    };

    expect(decodeRciSaveV1(invalid, { buildings, simulation, registries })).toEqual({
      ok: false,
      error: { code: 'rci-save:unknown-definition' },
    });
  });
});
