import type { SimulationSnapshot } from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import { FOUNDATION_RCI_CONFIGURATION, planRciTick } from '../src/index.js';
import {
  activeCottageBuildings,
  housingRegistries,
  residentHouseholdSnapshot,
} from './housing-fixtures.js';

const before: SimulationSnapshot = Object.freeze({
  revision: 10,
  absoluteTick: 24,
  growthSequence: 0,
});
const after: SimulationSnapshot = Object.freeze({
  revision: 11,
  absoluteTick: 25,
  growthSequence: 0,
});

describe('RCI housing tick phase', () => {
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
