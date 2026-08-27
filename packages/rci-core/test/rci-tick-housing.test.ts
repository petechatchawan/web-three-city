import {
  absoluteGameMinute,
  macroHourIndex,
  type SimulationSnapshot,
} from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import { FOUNDATION_RCI_CONFIGURATION, planRciTick } from '../src/index.js';
import {
  activeCottageBuildings,
  housingRegistries,
  residentHouseholdSnapshot,
} from './housing-fixtures.js';

const before: SimulationSnapshot = Object.freeze({
  revision: 10,
  absoluteGameMinute: absoluteGameMinute(24 * 60),
  growthSequence: 0,
});
const after: SimulationSnapshot = Object.freeze({
  revision: 11,
  absoluteGameMinute: absoluteGameMinute(25 * 60),
  growthSequence: 0,
});

describe('RCI housing macroHourIndex phase', () => {
  it('runs hourly reconciliation once when 08:59 crosses into 09:00', () => {
    const plan = planRciTick({
      rci: residentHouseholdSnapshot(8),
      simulationBefore: {
        revision: 8,
        absoluteGameMinute: absoluteGameMinute(8 * 60),
        growthSequence: 0,
      },
      simulationAfter: {
        revision: 9,
        absoluteGameMinute: absoluteGameMinute(9 * 60),
        growthSequence: 0,
      },
      macroHourTransition: {
        beforeAbsoluteGameMinute: absoluteGameMinute(8 * 60 + 59),
        afterAbsoluteGameMinute: absoluteGameMinute(9 * 60),
        beforeMacroHourIndex: macroHourIndex(8),
        afterMacroHourIndex: macroHourIndex(9),
        crossed: true,
      },
      buildingsBefore: { revision: 0, instances: [] },
      buildingsAfter: activeCottageBuildings,
      registries: housingRegistries,
      configuration: FOUNDATION_RCI_CONFIGURATION,
    });

    expect(plan.valid).toBe(true);
    expect(plan.proposedSnapshot.housing.dwellingUnits.map((unit) => unit.dwellingUnitId)).toEqual([
      'dwelling:building:growth:1:0',
    ]);
  });

  it('synchronizes Building lifecycle before housing reconciliation', () => {
    const plan = planRciTick({
      rci: residentHouseholdSnapshot(24),
      simulationBefore: before,
      simulationAfter: after,
      buildingsBefore: { revision: 0, instances: [] },
      buildingsAfter: activeCottageBuildings,
      registries: housingRegistries,
      configuration: FOUNDATION_RCI_CONFIGURATION,
    });
    expect(plan.valid).toBe(true);
    expect(plan.proposedSnapshot.housing.dwellingUnits.map((unit) => unit.dwellingUnitId)).toEqual([
      'dwelling:building:growth:1:0',
    ]);
  });
});
