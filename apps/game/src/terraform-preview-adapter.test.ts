import {
  createTerrainMap,
  planTerraformStroke,
  type TerrainSnapshot,
  type TerraformPlan,
} from '@web-three-city/terrain-core';
import type { WorldConfig } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createTerraformPreviewSceneModel } from './terraform-preview-adapter.js';
import type { TerraformStrokeSessionState } from './terraform-stroke-session.js';

const TEST_CONFIG: WorldConfig = Object.freeze({
  mapWidth: 4,
  mapHeight: 4,
  chunkSize: 2,
  cellSize: 1,
  heightStep: 0.5,
  minHeightLevel: 0,
  maxHeightLevel: 4,
  seaLevel: 1,
  dioramaBaseY: -1,
});

function flatTerrain(level: number): TerrainSnapshot {
  return createTerrainMap({
    config: TEST_CONFIG,
    heightLevels: new Uint8Array(25).fill(level),
    seed: 53,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 3,
  });
}

function acceptedState(plan: TerraformPlan): TerraformStrokeSessionState {
  return Object.freeze({
    operation: plan.operation,
    brushSize: plan.brushSize,
    strokeActive: true,
    flattenTargetLevel: null,
    acceptedAnchors: Object.freeze([{ x: 1, z: 1 }]),
    acceptedPlan: plan,
    currentStamp: Object.freeze({ kind: 'accepted', anchor: Object.freeze({ x: 1, z: 1 }) }),
  });
}

describe('createTerraformPreviewSceneModel', () => {
  it('keeps accepted core visible while exposing the current rejected stamp separately', () => {
    const terrain = flatTerrain(2);
    const acceptedPlan = planTerraformStroke(
      terrain,
      { operation: 'raise', brushSize: 1, cells: [{ x: 1, z: 1 }] },
      TEST_CONFIG,
    );
    const rejectedPlan = planTerraformStroke(
      terrain,
      {
        operation: 'raise',
        brushSize: 1,
        cells: [
          { x: 1, z: 1 },
          { x: 3, z: 1 },
        ],
      },
      TEST_CONFIG,
    );
    const state: TerraformStrokeSessionState = Object.freeze({
      ...acceptedState(acceptedPlan),
      currentStamp: Object.freeze({
        kind: 'rejected',
        anchor: Object.freeze({ x: 3, z: 1 }),
        reason: 'terraform:road-occupied',
        preview: Object.freeze({
          corePlan: rejectedPlan,
          previewPlan: Object.freeze({ ...rejectedPlan, valid: false }),
          valid: false,
          invalidReason: 'terraform:road-occupied',
          blockedRoadCells: Object.freeze([{ x: 3, z: 1 }]),
          blockedZoneCells: Object.freeze([]),
        }),
      }),
    });

    const model = createTerraformPreviewSceneModel(state, terrain, TEST_CONFIG);

    expect(model.acceptedCoreCells).toHaveLength(1);
    expect(model.rejectedStampCells).toHaveLength(1);
    expect(model.acceptedCoreCells[0]!.cell).toEqual({ x: 1, z: 1 });
    expect(model.rejectedStampCells[0]!.cell).toEqual({ x: 3, z: 1 });
  });

  it('maps support and projected shoreline independently', () => {
    const terrain = flatTerrain(1);
    const basePlan = planTerraformStroke(
      terrain,
      { operation: 'raise', brushSize: 1, cells: [{ x: 1, z: 3 }] },
      TEST_CONFIG,
    );
    const plan: TerraformPlan = Object.freeze({
      ...basePlan,
      coreCells: Object.freeze([{ x: 1, z: 3 }]),
      supportCells: Object.freeze([{ x: 2, z: 3 }]),
      affectedCells: Object.freeze([
        { x: 1, z: 3 },
        { x: 2, z: 3 },
      ]),
    });

    const model = createTerraformPreviewSceneModel(acceptedState(plan), terrain, TEST_CONFIG);

    expect(model.propagatedSupportCells).toHaveLength(1);
    expect(model.projectedShorelineCells.length).toBeGreaterThan(0);
    expect(model.projectedDryCells).toContainEqual({ x: 1, z: 3 });
  });

  it('maps a no-change stamp to the neutral layer without accepted output', () => {
    const terrain = flatTerrain(2);
    const plan = planTerraformStroke(
      terrain,
      {
        operation: 'flatten',
        brushSize: 1,
        cells: [{ x: 2, z: 2 }],
        flattenTargetLevel: 2,
      },
      TEST_CONFIG,
    );
    const state: TerraformStrokeSessionState = Object.freeze({
      operation: 'flatten',
      brushSize: 1,
      strokeActive: true,
      flattenTargetLevel: 2,
      acceptedAnchors: Object.freeze([]),
      acceptedPlan: null,
      currentStamp: Object.freeze({
        kind: 'no-change',
        anchor: Object.freeze({ x: 2, z: 2 }),
        preview: Object.freeze({
          corePlan: plan,
          previewPlan: plan,
          valid: false,
          invalidReason: 'terraform:no-change',
          blockedRoadCells: Object.freeze([]),
          blockedZoneCells: Object.freeze([]),
        }),
      }),
    });

    const model = createTerraformPreviewSceneModel(state, terrain, TEST_CONFIG);

    expect(model.acceptedCoreCells).toEqual([]);
    expect(model.noChangeCells).toHaveLength(1);
    expect(model.noChangeCells[0]!.cell).toEqual({ x: 2, z: 2 });
  });
});
