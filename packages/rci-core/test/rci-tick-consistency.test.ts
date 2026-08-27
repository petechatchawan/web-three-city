import { createBuildingSnapshot, type ActiveBuildingInstance } from '@web-three-city/building-core';
import {
  absoluteGameMinute,
  deriveMacroHourIndex,
  macroHourIndex,
  type SimulationSnapshot,
} from '@web-three-city/simulation-core';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  FOUNDATION_RCI_CONFIGURATION,
  RciContractError,
  commitRciTick,
  createFoundationRciRegistries,
  createInitialRciSnapshot,
  planRciTick,
} from '../src/index.js';

const before: SimulationSnapshot = Object.freeze({
  revision: 0,
  absoluteGameMinute: absoluteGameMinute(32 * 60),
  growthSequence: 0,
});
const after: SimulationSnapshot = Object.freeze({
  revision: 1,
  absoluteGameMinute: absoluteGameMinute(33 * 60),
  growthSequence: 0,
});

function active(x: number): ActiveBuildingInstance {
  return Object.freeze({
    instanceId: 'building:1',
    buildingDefinitionId: 'residential-cottage-1x1',
    buildingDefinitionVersion: 1,
    originCell: Object.freeze({ x, z: 2 }),
    rotationQuarterTurns: 0,
    lifecycle: 'active',
    activatedAtMacroHourIndex: macroHourIndex(0),
  });
}

describe('RCI exact Building after-state fence', () => {
  it('rejects same-revision Building content changed after planning', () => {
    const buildingsBefore = createBuildingSnapshot({ revision: 0, instances: [] }, WORLD_CONFIG);
    const buildingsAfter = createBuildingSnapshot(
      { revision: 1, instances: [active(2)] },
      WORLD_CONFIG,
    );
    const changedAfter = createBuildingSnapshot(
      { revision: 1, instances: [active(3)] },
      WORLD_CONFIG,
    );
    const rci = createInitialRciSnapshot({
      absoluteMacroHourIndex: deriveMacroHourIndex(before.absoluteGameMinute),
    });
    const registries = createFoundationRciRegistries();
    const plan = planRciTick({
      rci,
      simulationBefore: before,
      simulationAfter: after,
      buildingsBefore,
      buildingsAfter,
      registries,
      configuration: FOUNDATION_RCI_CONFIGURATION,
    });

    expect(plan.valid).toBe(true);
    expect(() =>
      commitRciTick({
        rci,
        simulationBefore: before,
        simulationAfter: after,
        buildingsBefore,
        buildingsAfter: changedAfter,
        plan,
      }),
    ).toThrowError(new RciContractError('rci:stale-building-plan'));
  });

  it('rejects an after Building revision changed after planning', () => {
    const buildingsBefore = createBuildingSnapshot({ revision: 0, instances: [] }, WORLD_CONFIG);
    const buildingsAfter = createBuildingSnapshot(
      { revision: 1, instances: [active(2)] },
      WORLD_CONFIG,
    );
    const changedAfter = createBuildingSnapshot(
      { revision: 2, instances: [active(2)] },
      WORLD_CONFIG,
    );
    const rci = createInitialRciSnapshot({
      absoluteMacroHourIndex: deriveMacroHourIndex(before.absoluteGameMinute),
    });
    const registries = createFoundationRciRegistries();
    const plan = planRciTick({
      rci,
      simulationBefore: before,
      simulationAfter: after,
      buildingsBefore,
      buildingsAfter,
      registries,
      configuration: FOUNDATION_RCI_CONFIGURATION,
    });

    expect(() =>
      commitRciTick({
        rci,
        simulationBefore: before,
        simulationAfter: after,
        buildingsBefore,
        buildingsAfter: changedAfter,
        plan,
      }),
    ).toThrowError(new RciContractError('rci:stale-building-plan'));
  });
});
