import { vertexIndex, type WorldConfig } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
import { createTerrainMap, planTerraformStroke, propagateTerraformSupport } from '../src/index.js';

const TEST_CONFIG: WorldConfig = Object.freeze({
  mapWidth: 8,
  mapHeight: 8,
  chunkSize: 4,
  cellSize: 1,
  heightStep: 0.5,
  minHeightLevel: 0,
  maxHeightLevel: 6,
  seaLevel: 1,
  dioramaBaseY: -1,
});

function terrainFromLevels(config: WorldConfig, levelAt: (x: number, z: number) => number) {
  const levels = new Uint8Array((config.mapWidth + 1) * (config.mapHeight + 1));
  for (let z = 0; z <= config.mapHeight; z += 1) {
    for (let x = 0; x <= config.mapWidth; x += 1) {
      levels[vertexIndex({ x, z }, config)] = levelAt(x, z);
    }
  }
  return createTerrainMap({
    config,
    heightLevels: levels,
    seed: 31,
    generatorVersion: 'coastal-v1',
    generationAttempt: 0,
    revision: 2,
  });
}

describe('propagateTerraformSupport', () => {
  it('returns a stable invalid-cell result for an out-of-bounds core cell', () => {
    const terrain = terrainFromLevels(TEST_CONFIG, () => 0);
    expect(
      propagateTerraformSupport(
        terrain,
        { operation: 'raise', brushSize: 1, cells: [{ x: -1, z: 0 }] },
        [{ x: -1, z: 0 }],
        TEST_CONFIG,
      ),
    ).toMatchObject({ valid: false, invalidReason: 'terraform:invalid-cell' });
  });

  it('raises the smallest deterministic support set needed for canonical continuity', () => {
    const terrain = terrainFromLevels(TEST_CONFIG, (x, z) =>
      x >= 1 && x <= 2 && z >= 1 && z <= 2 ? 1 : 0,
    );
    const plan = planTerraformStroke(
      terrain,
      { operation: 'raise', brushSize: 1, cells: [{ x: 1, z: 1 }] },
      TEST_CONFIG,
    );

    expect(plan.valid).toBe(true);
    expect(plan.supportVertices).toEqual([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 2, z: 0 },
      { x: 3, z: 0 },
      { x: 0, z: 1 },
      { x: 3, z: 1 },
      { x: 0, z: 2 },
      { x: 3, z: 2 },
      { x: 0, z: 3 },
      { x: 1, z: 3 },
      { x: 2, z: 3 },
      { x: 3, z: 3 },
    ]);
    expect(
      plan.supportCells.every(
        (cell) => !plan.coreCells.some((core) => core.x === cell.x && core.z === cell.z),
      ),
    ).toBe(true);
  });

  it('rejects support that would exceed four rings', () => {
    const config: WorldConfig = Object.freeze({ ...TEST_CONFIG, mapWidth: 14, mapHeight: 6 });
    const columns = [0, 0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0, 0, 0] as const;
    const terrain = terrainFromLevels(config, (x) => columns[x]!);
    const result = propagateTerraformSupport(
      terrain,
      { operation: 'raise', brushSize: 1, cells: [{ x: 6, z: 2 }] },
      [{ x: 6, z: 2 }],
      config,
    );

    expect(result).toMatchObject({
      valid: false,
      invalidReason: 'terraform:propagation-limit',
    });
  });

  it('rejects a projected diagonal ridge', () => {
    const terrain = terrainFromLevels(TEST_CONFIG, (x, z) =>
      (x === 2 && z === 2) || (x === 3 && z === 3) ? 1 : 0,
    );
    const result = propagateTerraformSupport(
      terrain,
      { operation: 'raise', brushSize: 1, cells: [{ x: 2, z: 2 }] },
      [{ x: 2, z: 2 }],
      TEST_CONFIG,
    );

    expect(result).toMatchObject({
      valid: false,
      invalidReason: 'terraform:non-canonical-shape',
    });
  });

  it('never changes a core or support vertex more than one level from baseline', () => {
    const terrain = terrainFromLevels(TEST_CONFIG, (x, z) =>
      x >= 1 && x <= 2 && z >= 1 && z <= 2 ? 1 : 0,
    );
    const plan = planTerraformStroke(
      terrain,
      { operation: 'raise', brushSize: 1, cells: [{ x: 1, z: 1 }] },
      TEST_CONFIG,
    );

    for (const vertex of plan.affectedVertices) {
      const index = vertexIndex(vertex, TEST_CONFIG);
      expect(
        Math.abs(plan.proposedHeightLevels[index]! - terrain.heightLevels[index]!),
      ).toBeLessThanOrEqual(1);
    }
  });
});
