import { describe, expect, it } from 'vitest';
import type { WorldConfig } from '@web-three-city/world-core';
import {
  createBuildingSnapshot,
  decodeBuildingSaveV1,
  encodeBuildingSaveV1,
} from '../src/index.js';

const CONFIG: WorldConfig = Object.freeze({
  mapWidth: 8,
  mapHeight: 8,
  chunkSize: 4,
  cellSize: 1,
  heightStep: 0.5,
  minHeightLevel: 0,
  maxHeightLevel: 4,
  seaLevel: 1,
  dioramaBaseY: -1.5,
});

describe('building serialization', () => {
  it('round-trips only authoritative instance fields', () => {
    const snapshot = createBuildingSnapshot(
      {
        revision: 4,
        instances: [
          Object.freeze({
            instanceId: 'building:4:1',
            buildingDefinitionId: 'industrial-workshop-1x2',
            buildingDefinitionVersion: 1,
            originCell: Object.freeze({ x: 2, z: 3 }),
            rotationQuarterTurns: 1,
          }),
        ],
      },
      CONFIG,
    );
    const encoded = encodeBuildingSaveV1(snapshot);
    expect(encoded.instances[0]).not.toHaveProperty('occupiedCells');
    expect(decodeBuildingSaveV1(encoded, CONFIG)).toEqual({ ok: true, value: snapshot });
  });

  it('rejects unknown content, invalid rotations, and overlapping footprints', () => {
    const base = {
      kind: 'building-save',
      schemaVersion: 1,
      revision: 1,
      instances: [],
    } as const;
    expect(
      decodeBuildingSaveV1(
        {
          ...base,
          instances: [{ instanceId: 'x', buildingDefinitionId: 'missing', buildingDefinitionVersion: 1, originCell: { x: 0, z: 0 }, rotationQuarterTurns: 0 }],
        },
        CONFIG,
      ),
    ).toMatchObject({ ok: false, error: { code: 'building-save:unknown-definition' } });
    expect(
      decodeBuildingSaveV1(
        {
          ...base,
          instances: [{ instanceId: 'x', buildingDefinitionId: 'residential-cottage-1x1', buildingDefinitionVersion: 1, originCell: { x: 0, z: 0 }, rotationQuarterTurns: 9 }],
        },
        CONFIG,
      ),
    ).toMatchObject({ ok: false, error: { code: 'building-save:invalid-rotation' } });
  });
});
