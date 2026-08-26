import type { BuildingSnapshot } from '@web-three-city/building-core';
import { absoluteGameMinute, type SimulationSnapshot } from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import {
  FOUNDATION_RCI_CONFIGURATION,
  commitRciTick,
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  decodeRciSaveV1,
  encodeRciSaveV1,
  planRciTick,
  type RciSnapshot,
  type RciTickReceipt,
} from '../src/index.js';

const buildings: BuildingSnapshot = Object.freeze({ revision: 0, instances: Object.freeze([]) });
const registries = createFoundationRciRegistries();

function lifecycleFixture(): RciSnapshot {
  const initial = createInitialRciSnapshot({
    absoluteMacroHourIndex: macroHour(31),
    deterministicSeed: 37,
  });
  return {
    ...initial,
    population: {
      revision: 1,
      citizens: [
        {
          citizenId: 'citizen:1',
          presence: 'resident',
          sexDefinitionId: 'sex.male',
          bornAtMacroHourIndex: ageOriginMacroHour(32 - 18 * 288),
          movedIntoCityAtMacroHourIndex: macroHour(0),
          movedOutOfCityAtMacroHourIndex: null,
          diedAtMacroHourIndex: null,
        },
      ],
      qualifications: [],
    },
    households: {
      revision: 1,
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
      ],
    },
    sequences: {
      ...initial.sequences,
      nextCitizen: 2,
      nextHousehold: 2,
      nextHouseholdMembership: 2,
    },
  };
}

function advance(
  snapshot: RciSnapshot,
  beforeMacroHourIndex: number,
  simulationRevision: number,
): Readonly<{ snapshot: RciSnapshot; receipt: RciTickReceipt; events: readonly string[] }> {
  const simulationBefore: SimulationSnapshot = Object.freeze({
    revision: simulationRevision,
    absoluteGameMinute: absoluteGameMinute(beforeMacroHourIndex * 60),
    growthSequence: 0,
  });
  const simulationAfter: SimulationSnapshot = Object.freeze({
    revision: simulationRevision + 1,
    absoluteGameMinute: absoluteGameMinute((beforeMacroHourIndex + 1) * 60),
    growthSequence: 0,
  });
  const plan = planRciTick({
    rci: snapshot,
    simulationBefore,
    simulationAfter,
    buildingsBefore: buildings,
    buildingsAfter: buildings,
    registries,
    configuration: FOUNDATION_RCI_CONFIGURATION,
  });
  expect(plan.valid).toBe(true);
  const committed = commitRciTick({
    rci: snapshot,
    simulationBefore,
    simulationAfter,
    buildingsBefore: buildings,
    buildingsAfter: buildings,
    plan,
  });
  return Object.freeze({
    snapshot: committed.snapshot,
    receipt: committed.receipt,
    events: Object.freeze(plan.emittedEvents.map((event) => event.type)),
  });
}

describe('population lifecycle save/load determinism', () => {
  it('matches continuous execution across repeated save/decode/resume boundaries', () => {
    const firstContinuous = advance(lifecycleFixture(), 31, 4);
    const continuous = advance(firstContinuous.snapshot, 55, 5);

    const firstResumed = advance(lifecycleFixture(), 31, 4);
    const encoded = encodeRciSaveV1(firstResumed.snapshot);
    const decoded = decodeRciSaveV1(encoded, {
      buildings,
      simulation: {
        revision: 5,
        absoluteGameMinute: absoluteGameMinute(32 * 60),
        growthSequence: 0,
      },
      registries,
    });
    if (!decoded.ok) throw new Error(decoded.error.code);
    const resumed = advance(decoded.value, 55, 5);

    expect(resumed.snapshot).toEqual(continuous.snapshot);
    expect(resumed.receipt).toEqual(continuous.receipt);
    expect(resumed.events).toEqual(continuous.events);
    expect(encodeRciSaveV1(resumed.snapshot)).toEqual(encodeRciSaveV1(continuous.snapshot));
  });
});
import { ageOriginMacroHour, macroHour } from './temporal-fixtures.js';
