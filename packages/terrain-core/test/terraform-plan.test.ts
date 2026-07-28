import { WORLD_CONFIG } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import {
  commitTerraformPlan,
  createTerrainMap,
  planTerraformStroke,
  type TerrainSnapshot,
} from '../src/index.js';

function latticeIndex(x: number, z: number): number {
  return z * (WORLD_CONFIG.mapWidth + 1) + x;
}

function flatTerrain(level: number, revision = 1): TerrainSnapshot {
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: new Uint8Array((WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1)).fill(
      level,
    ),
    seed: 17,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision,
  });
}

function terrainWithLevels(
  entries: readonly (readonly [x: number, z: number, level: number])[],
  baseLevel = 0,
  revision = 1,
): TerrainSnapshot {
  const levels = new Uint8Array((WORLD_CONFIG.mapWidth + 1) * (WORLD_CONFIG.mapHeight + 1)).fill(
    baseLevel,
  );
  for (const [x, z, level] of entries) levels[latticeIndex(x, z)] = level;
  return createTerrainMap({
    config: WORLD_CONFIG,
    heightLevels: levels,
    seed: 19,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision,
  });
}

describe('planTerraformStroke', () => {
  it('raises every unique shared vertex exactly once', () => {
    const terrain = flatTerrain(1);
    const plan = planTerraformStroke(
      terrain,
      {
        operation: 'raise',
        brushSize: 1,
        cells: [
          { x: 10, z: 10 },
          { x: 11, z: 10 },
          { x: 10, z: 10 },
        ],
      },
      WORLD_CONFIG,
    );

    expect(plan.valid).toBe(true);
    expect(plan.affectedCells).toHaveLength(2);
    expect(plan.affectedVertices).toHaveLength(6);
    expect(plan.changedVertexCount).toBe(6);
    expect(plan.proposedHeightLevels[latticeIndex(11, 10)]).toBe(2);
    expect(terrain.heightLevels[latticeIndex(11, 10)]).toBe(1);
  });

  it('expands every accumulated center through the selected brush', () => {
    const plan = planTerraformStroke(
      flatTerrain(1),
      {
        operation: 'raise',
        brushSize: 3,
        cells: [
          { x: 20, z: 20 },
          { x: 21, z: 20 },
        ],
      },
      WORLD_CONFIG,
    );

    expect(plan.valid).toBe(true);
    expect(plan.affectedCells).toHaveLength(12);
    expect(plan.affectedVertices).toHaveLength(20);
  });

  it('rejects Lower when any affected vertex is already minimum', () => {
    const plan = planTerraformStroke(
      flatTerrain(0),
      { operation: 'lower', brushSize: 1, cells: [{ x: 2, z: 2 }] },
      WORLD_CONFIG,
    );

    expect(plan).toMatchObject({
      valid: false,
      invalidReason: 'terraform:height-range',
    });
  });

  it('rejects Raise when any affected vertex is already maximum', () => {
    const plan = planTerraformStroke(
      flatTerrain(WORLD_CONFIG.maxHeightLevel),
      { operation: 'raise', brushSize: 1, cells: [{ x: 2, z: 2 }] },
      WORLD_CONFIG,
    );

    expect(plan).toMatchObject({
      valid: false,
      invalidReason: 'terraform:height-range',
    });
  });

  it('flattens every affected vertex to the locked target', () => {
    const terrain = terrainWithLevels(
      [
        [10, 10, 1],
        [11, 10, 2],
        [10, 11, 2],
        [11, 11, 1],
      ],
      1,
    );
    const plan = planTerraformStroke(
      terrain,
      {
        operation: 'flatten',
        brushSize: 1,
        cells: [{ x: 10, z: 10 }],
        flattenTargetLevel: 2,
      },
      WORLD_CONFIG,
    );

    expect(plan.valid).toBe(true);
    for (const vertex of plan.affectedVertices) {
      expect(plan.proposedHeightLevels[latticeIndex(vertex.x, vertex.z)]).toBe(2);
    }
  });

  it('rejects a resulting cardinal delta greater than one', () => {
    const terrain = terrainWithLevels(
      [
        [20, 20, 1],
        [21, 20, 1],
        [20, 21, 1],
        [21, 21, 1],
      ],
      0,
    );
    const plan = planTerraformStroke(
      terrain,
      { operation: 'raise', brushSize: 1, cells: [{ x: 20, z: 20 }] },
      WORLD_CONFIG,
    );

    expect(plan).toMatchObject({
      valid: false,
      invalidReason: 'terraform:cardinal-delta',
    });
  });

  it('rejects a no-op Flatten plan', () => {
    const plan = planTerraformStroke(
      flatTerrain(2),
      {
        operation: 'flatten',
        brushSize: 3,
        cells: [{ x: 20, z: 20 }],
        flattenTargetLevel: 2,
      },
      WORLD_CONFIG,
    );

    expect(plan).toMatchObject({ valid: false, invalidReason: 'terraform:no-change' });
  });

  it('records a tight vertex dirty region', () => {
    const plan = planTerraformStroke(
      flatTerrain(1),
      { operation: 'raise', brushSize: 3, cells: [{ x: 10, z: 20 }] },
      WORLD_CONFIG,
    );

    expect(plan.dirtyRegion).toEqual({
      minVertexX: 9,
      minVertexZ: 19,
      maxVertexX: 12,
      maxVertexZ: 22,
    });
  });
});

describe('commitTerraformPlan', () => {
  it('commits an immutable snapshot with one revision increment and receipt', () => {
    const terrain = flatTerrain(1, 7);
    const plan = planTerraformStroke(
      terrain,
      { operation: 'raise', brushSize: 1, cells: [{ x: 8, z: 9 }] },
      WORLD_CONFIG,
    );
    const result = commitTerraformPlan(terrain, plan, WORLD_CONFIG);

    expect(result.snapshot.revision).toBe(8);
    expect(result.snapshot.heightLevels).not.toBe(terrain.heightLevels);
    expect(terrain.heightLevels[latticeIndex(8, 9)]).toBe(1);
    expect(result.snapshot.heightLevels[latticeIndex(8, 9)]).toBe(2);
    expect(result.receipt).toMatchObject({
      beforeRevision: 7,
      afterRevision: 8,
      changedVertexCount: 4,
      affectedCellCount: 1,
    });
  });

  it('rejects a stale plan', () => {
    const terrain = flatTerrain(1, 4);
    const plan = planTerraformStroke(
      terrain,
      { operation: 'raise', brushSize: 1, cells: [{ x: 1, z: 1 }] },
      WORLD_CONFIG,
    );

    expect(() => commitTerraformPlan({ ...terrain, revision: 5 }, plan, WORLD_CONFIG)).toThrowError(
      'terraform:stale-plan',
    );
  });

  it('rejects an invalid plan', () => {
    const terrain = flatTerrain(0, 4);
    const plan = planTerraformStroke(
      terrain,
      { operation: 'lower', brushSize: 1, cells: [{ x: 1, z: 1 }] },
      WORLD_CONFIG,
    );

    expect(() => commitTerraformPlan(terrain, plan, WORLD_CONFIG)).toThrowError(
      'terraform:invalid-plan',
    );
  });
});
