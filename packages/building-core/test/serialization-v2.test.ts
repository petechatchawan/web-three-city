import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import {
  createBuildingSnapshot,
  decodeBuildingSaveV2,
  encodeBuildingSaveV2,
} from '../src/index.js';

describe('BuildingSaveV2', () => {
  it('round trips lifecycle authority', () => {
    const snapshot = createBuildingSnapshot(
      {
        revision: 3,
        instances: [
          {
            instanceId: 'building:growth:1',
            buildingDefinitionId: 'residential-cottage-1x1',
            buildingDefinitionVersion: 1,
            originCell: { x: 0, z: 0 },
            rotationQuarterTurns: 0,
            lifecycle: 'construction',
            constructionStartedAtTick: 24,
            constructionCompletesAtTick: 48,
          },
        ],
      },
      WORLD_CONFIG,
    );
    const decoded = decodeBuildingSaveV2(encodeBuildingSaveV2(snapshot), WORLD_CONFIG);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.value).toEqual(snapshot);
  });

  it('fails closed for lifecycle field mismatch', () => {
    const result = decodeBuildingSaveV2(
      {
        kind: 'building-save',
        schemaVersion: 2,
        revision: 1,
        instances: [
          {
            instanceId: 'bad',
            buildingDefinitionId: 'residential-cottage-1x1',
            buildingDefinitionVersion: 1,
            originCell: { x: 0, z: 0 },
            rotationQuarterTurns: 0,
            lifecycle: 'construction',
            activatedAtTick: 8,
          },
        ],
      },
      WORLD_CONFIG,
    );
    expect(result.ok).toBe(false);
  });
});
