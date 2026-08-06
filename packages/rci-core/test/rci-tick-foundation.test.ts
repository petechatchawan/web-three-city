import type { SimulationSnapshot } from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import {
  FOUNDATION_RCI_CONFIGURATION,
  RciContractError,
  commitRciTick,
  planRciTick,
} from '../src/index.js';
import {
  createSingleResidentSnapshot,
  testBuildings,
  testRegistries,
} from './population-fixtures.js';

const before: SimulationSnapshot = Object.freeze({
  revision: 8,
  absoluteTick: 32,
  growthSequence: 0,
});
const after: SimulationSnapshot = Object.freeze({
  revision: 9,
  absoluteTick: 33,
  growthSequence: 0,
});

describe('RCI tick plan and commit foundation', () => {
  it('returns an immutable no-op plan outside lifecycle boundaries', () => {
    const rci = createSingleResidentSnapshot();
    const plan = planRciTick({
      rci,
      simulationBefore: before,
      simulationAfter: after,
      buildingsBefore: testBuildings,
      buildingsAfter: testBuildings,
      registries: testRegistries,
      configuration: FOUNDATION_RCI_CONFIGURATION,
    });

    expect(plan.valid).toBe(true);
    expect(plan.proposedSnapshot).toBe(rci);
    expect(plan.emittedEvents).toEqual([]);
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it('commits the already-planned snapshot without recalculation', () => {
    const rci = createSingleResidentSnapshot();
    const plan = planRciTick({
      rci,
      simulationBefore: before,
      simulationAfter: after,
      buildingsBefore: testBuildings,
      buildingsAfter: testBuildings,
      registries: testRegistries,
      configuration: FOUNDATION_RCI_CONFIGURATION,
    });
    const result = commitRciTick({
      rci,
      simulationBefore: before,
      simulationAfter: after,
      buildingsBefore: testBuildings,
      buildingsAfter: testBuildings,
      plan,
    });

    expect(result.snapshot).toBe(rci);
    expect(result.receipt.beforeRevision).toBe(rci.revision);
    expect(result.receipt.afterRevision).toBe(rci.revision);
    expect(Object.isFrozen(result.receipt)).toBe(true);
  });

  it('rejects stale RCI, Simulation, and Building inputs', () => {
    const rci = createSingleResidentSnapshot();
    const plan = planRciTick({
      rci,
      simulationBefore: before,
      simulationAfter: after,
      buildingsBefore: testBuildings,
      buildingsAfter: testBuildings,
      registries: testRegistries,
      configuration: FOUNDATION_RCI_CONFIGURATION,
    });

    expect(() =>
      commitRciTick({
        rci: { ...rci, revision: rci.revision + 1 },
        simulationBefore: before,
        simulationAfter: after,
        buildingsBefore: testBuildings,
        buildingsAfter: testBuildings,
        plan,
      }),
    ).toThrowError(new RciContractError('rci:stale-rci-plan'));

    expect(() =>
      commitRciTick({
        rci,
        simulationBefore: { ...before, revision: before.revision + 1 },
        simulationAfter: after,
        buildingsBefore: testBuildings,
        buildingsAfter: testBuildings,
        plan,
      }),
    ).toThrowError(new RciContractError('rci:stale-simulation-plan'));

    expect(() =>
      commitRciTick({
        rci,
        simulationBefore: before,
        simulationAfter: after,
        buildingsBefore: { ...testBuildings, revision: 1 },
        buildingsAfter: testBuildings,
        plan,
      }),
    ).toThrowError(new RciContractError('rci:stale-building-plan'));
  });
});
