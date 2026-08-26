import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import {
  absoluteGameMinute,
  createSimulationSnapshot,
  macroHourIndex,
  type MacroHourTransition,
} from '@web-three-city/simulation-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  commitBuildingGrowthTick,
  createEmptyBuildingSnapshot,
  planBuildingGrowthTick,
  type BuildingDevelopmentEnvironment,
} from '../src/index.js';

const CONFIG: WorldConfig = Object.freeze({
  mapWidth: 4,
  mapHeight: 4,
  chunkSize: 2,
  cellSize: 1,
  heightStep: 0.5,
  minHeightLevel: 0,
  maxHeightLevel: 4,
  seaLevel: 1,
  dioramaBaseY: -1.5,
});
const FLAT = Object.freeze({
  cell: Object.freeze({ x: 0, z: 0 }),
  corners: Object.freeze({ nw: 2, ne: 2, sw: 2, se: 2 }),
  shape: 'flat',
  minimumLevel: 2,
  maximumLevel: 2,
  slopeAxis: null,
}) as TerrainCellSurfaceProfile;

function environment(): BuildingDevelopmentEnvironment {
  return Object.freeze({
    terrainRevision: 0,
    waterSourceTerrainRevision: 0,
    roadRevision: 0,
    zoneRevision: 0,
    surfaceAt: () => FLAT,
    isDry: () => true,
    isRoadOccupied: () => false,
    zoneDefinitionIdAt(cell: CellCoord) {
      return cell.x === 0 && cell.z === 0 ? 'residential' : null;
    },
    roadAccessAt(cell: CellCoord) {
      return cell.x === 0 && cell.z === 0
        ? Object.freeze({
            direction: 'south' as const,
            distance: 1 as const,
            roadCell: Object.freeze({ x: 0, z: 1 }),
          })
        : null;
    },
  });
}

function macroHourTransition(
  beforeAbsoluteGameMinute: number,
  afterAbsoluteGameMinute: number,
): MacroHourTransition {
  return Object.freeze({
    beforeAbsoluteGameMinute: absoluteGameMinute(beforeAbsoluteGameMinute),
    afterAbsoluteGameMinute: absoluteGameMinute(afterAbsoluteGameMinute),
    beforeMacroHourIndex: macroHourIndex(Math.floor(beforeAbsoluteGameMinute / 60)),
    afterMacroHourIndex: macroHourIndex(Math.floor(afterAbsoluteGameMinute / 60)),
    crossed: Math.floor(beforeAbsoluteGameMinute / 60) !== Math.floor(afterAbsoluteGameMinute / 60),
  });
}

describe('automatic Building Growth tick', () => {
  it.each([
    { label: '00', before: 24 * 60 - 1, after: 24 * 60, expectedStart: 24 },
    { label: '06', before: 6 * 60 - 1, after: 6 * 60, expectedStart: 6 },
    { label: '12', before: 12 * 60 - 1, after: 12 * 60, expectedStart: 12 },
    { label: '18', before: 18 * 60 - 1, after: 18 * 60, expectedStart: 18 },
  ])('starts Growth at the $label macro-hour boundary', ({ before, after, expectedStart }) => {
    const buildings = createEmptyBuildingSnapshot(CONFIG);
    const simulation = createSimulationSnapshot({
      revision: 0,
      absoluteGameMinute: before,
      growthSequence: 0,
    });

    const plan = planBuildingGrowthTick({
      buildings,
      simulation,
      macroHourTransition: macroHourTransition(before, after),
      environment: environment(),
      config: CONFIG,
    });

    expect(plan.valid).toBe(true);
    expect(plan.startedInstanceIds).toEqual(['building:growth:1']);
    expect(plan.proposedInstances).toHaveLength(1);
    expect(plan.proposedInstances[0]).toMatchObject({
      lifecycle: 'construction',
      constructionStartedAtTick: expectedStart,
    });
  });

  it('does not advance Construction during a minute that remains in macro hour 08', () => {
    const buildings = {
      revision: 0,
      instances: [
        {
          instanceId: 'building:construction:1',
          buildingDefinitionId: 'residential-cottage-1x1' as const,
          buildingDefinitionVersion: 1 as const,
          originCell: { x: 0, z: 0 },
          rotationQuarterTurns: 0 as const,
          lifecycle: 'construction' as const,
          constructionStartedAtTick: 8,
          constructionCompletesAtTick: 9,
        },
      ],
    };
    const simulation = createSimulationSnapshot({
      revision: 0,
      absoluteGameMinute: 8 * 60,
      growthSequence: 0,
    });

    const plan = planBuildingGrowthTick({
      buildings,
      simulation,
      macroHourTransition: macroHourTransition(8 * 60, 8 * 60 + 1),
      environment: environment(),
      config: CONFIG,
    });

    expect(plan.completedInstanceIds).toEqual([]);
    expect(plan.proposedInstances[0]?.lifecycle).toBe('construction');
  });

  it('advances Construction once when 08:59 crosses into macro hour 09', () => {
    const buildings = {
      revision: 0,
      instances: [
        {
          instanceId: 'building:construction:1',
          buildingDefinitionId: 'residential-cottage-1x1' as const,
          buildingDefinitionVersion: 1 as const,
          originCell: { x: 0, z: 0 },
          rotationQuarterTurns: 0 as const,
          lifecycle: 'construction' as const,
          constructionStartedAtTick: 8,
          constructionCompletesAtTick: 9,
        },
      ],
    };
    const simulation = createSimulationSnapshot({
      revision: 0,
      absoluteGameMinute: 8 * 60,
      growthSequence: 0,
    });

    const plan = planBuildingGrowthTick({
      buildings,
      simulation,
      macroHourTransition: macroHourTransition(8 * 60 + 59, 9 * 60),
      environment: environment(),
      config: CONFIG,
    });

    expect(plan.completedInstanceIds).toEqual(['building:construction:1']);
    expect(plan.proposedInstances[0]?.lifecycle).toBe('active');
  });

  it('starts at most one Construction on an evaluation tick', () => {
    const buildings = createEmptyBuildingSnapshot(CONFIG);
    const simulation = createSimulationSnapshot({
      revision: 0,
      absoluteGameMinute: 24 * 60 - 1,
      growthSequence: 0,
    });
    const plan = planBuildingGrowthTick({
      buildings,
      simulation,
      environment: environment(),
      config: CONFIG,
    });
    const result = commitBuildingGrowthTick({
      buildings,
      simulation,
      environment: environment(),
      config: CONFIG,
      plan,
    });
    expect(result.simulation.absoluteGameMinute).toBe(24 * 60);
    expect(result.buildings.instances).toHaveLength(1);
    expect(result.buildings.instances[0]?.lifecycle).toBe('construction');
    expect(result.receipt.startedInstanceIds).toEqual(['building:growth:1']);
  });

  it('starts Growth when 11:59 crosses into 12:00', () => {
    const buildings = createEmptyBuildingSnapshot(CONFIG);
    const simulation = createSimulationSnapshot({
      revision: 0,
      absoluteGameMinute: 11 * 60 + 59,
      growthSequence: 0,
    });
    const plan = planBuildingGrowthTick({
      buildings,
      simulation,
      macroHourTransition: macroHourTransition(11 * 60 + 59, 12 * 60),
      environment: environment(),
      config: CONFIG,
    });

    expect(plan.valid).toBe(true);
    expect(plan.proposedInstances).toHaveLength(1);
    expect(plan.proposedInstances[0]?.lifecycle).toBe('construction');
    expect(plan.proposedInstances[0]).toMatchObject({
      constructionStartedAtTick: 12,
    });
  });

  it('advances an idle non-evaluation tick without changing Buildings', () => {
    const buildings = createEmptyBuildingSnapshot(CONFIG);
    const simulation = createSimulationSnapshot({
      revision: 0,
      absoluteGameMinute: 8 * 60,
      growthSequence: 0,
    });
    const plan = planBuildingGrowthTick({
      buildings,
      simulation,
      environment: environment(),
      config: CONFIG,
    });
    const result = commitBuildingGrowthTick({
      buildings,
      simulation,
      environment: environment(),
      config: CONFIG,
      plan,
    });
    expect(result.simulation.absoluteGameMinute).toBe(8 * 60 + 1);
    expect(result.buildings).toBe(buildings);
  });
});
