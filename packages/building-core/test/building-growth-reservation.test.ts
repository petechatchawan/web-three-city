import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import { createSimulationSnapshot } from '@web-three-city/simulation-core';
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

describe('automatic Building Growth interaction reservations', () => {
  it('advances the evaluation tick without occupying a cell reserved by an active transaction', () => {
    const buildings = createEmptyBuildingSnapshot(CONFIG);
    const simulation = createSimulationSnapshot({
      revision: 0,
      absoluteTick: 23,
      growthSequence: 0,
    });
    const input = {
      buildings,
      simulation,
      environment: environment(),
      config: CONFIG,
      reservedCells: Object.freeze([Object.freeze({ x: 0, z: 0 })]),
    } as Parameters<typeof planBuildingGrowthTick>[0];

    const plan = planBuildingGrowthTick(input);
    const result = commitBuildingGrowthTick({
      buildings,
      simulation,
      environment: environment(),
      config: CONFIG,
      plan,
    });

    expect(result.simulation.absoluteTick).toBe(24);
    expect(result.simulation.growthSequence).toBe(0);
    expect(result.buildings.instances).toEqual([]);
    expect(result.receipt.startedInstanceIds).toEqual([]);
  });
});
