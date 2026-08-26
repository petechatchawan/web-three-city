import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import { macroHourIndex } from '@web-three-city/simulation-core';
import { describe, expect, it } from 'vitest';
import {
  commitBuildingMutation,
  configureAutomaticBuildingGrowth,
  consumeAutomaticBuildingUndoSuppression,
  createEmptyBuildingSnapshot,
  planBuildingDevelopment,
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
const FLAT = Object.freeze({ shape: 'flat' }) as TerrainCellSurfaceProfile;
const environment: BuildingDevelopmentEnvironment = Object.freeze({
  terrainRevision: 0,
  waterSourceTerrainRevision: 0,
  roadRevision: 0,
  zoneRevision: 0,
  surfaceAt: () => FLAT,
  isDry: () => true,
  isRoadOccupied: () => false,
  zoneDefinitionIdAt: (cell: CellCoord) => (cell.x === 0 && cell.z === 0 ? 'residential' : null),
  roadAccessAt: (cell: CellCoord) =>
    cell.x === 0 && cell.z === 0
      ? Object.freeze({
          direction: 'south' as const,
          distance: 1 as const,
          roadCell: { x: 0, z: 1 },
        })
      : null,
});

describe('automatic Growth runtime bridge', () => {
  it('commits one Construction and suppresses the following Undo write', () => {
    const before = createEmptyBuildingSnapshot(CONFIG);
    configureAutomaticBuildingGrowth({
      macroHourIndex: macroHourIndex(24),
      growthSequence: 0,
      evaluation: true,
    });
    const plan = planBuildingDevelopment(before, environment, CONFIG);
    const committed = commitBuildingMutation(before, plan, environment, CONFIG);
    configureAutomaticBuildingGrowth(null);
    expect(committed.snapshot.instances).toHaveLength(1);
    expect(committed.snapshot.instances[0]).toMatchObject({
      lifecycle: 'construction',
      constructionStartedAtMacroHourIndex: macroHourIndex(24),
    });
    expect(consumeAutomaticBuildingUndoSuppression()).toBe(true);
  });
});
