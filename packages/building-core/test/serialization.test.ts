import type { WorldConfig } from '@web-three-city/world-core';
import { describe, expect, it } from 'vitest';
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
const BASE_SAVE = Object.freeze({
  kind: 'building-save' as const,
  schemaVersion: 1 as const,
  revision: 1,
  instances: Object.freeze([]),
});

function savedInstance(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    instanceId: 'building:1:1',
    buildingDefinitionId: 'residential-cottage-1x1',
    buildingDefinitionVersion: 1,
    originCell: { x: 0, z: 0 },
    rotationQuarterTurns: 0,
    ...overrides,
  };
}

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
    expect(encoded.instances[0]).toEqual({
      instanceId: 'building:4:1',
      buildingDefinitionId: 'industrial-workshop-1x2',
      buildingDefinitionVersion: 1,
      originCell: { x: 2, z: 3 },
      rotationQuarterTurns: 1,
    });
    expect(encoded.instances[0]).not.toHaveProperty('occupiedCells');
    expect(encoded.instances[0]).not.toHaveProperty('roadFrontage');
    expect(decodeBuildingSaveV1(encoded, CONFIG)).toEqual({ ok: true, value: snapshot });
  });

  it('distinguishes unknown content from definition-version mismatch', () => {
    expect(
      decodeBuildingSaveV1(
        {
          ...BASE_SAVE,
          instances: [savedInstance({ buildingDefinitionId: 'missing' })],
        },
        CONFIG,
      ),
    ).toMatchObject({ ok: false, error: { code: 'building-save:unknown-definition' } });
    expect(
      decodeBuildingSaveV1(
        {
          ...BASE_SAVE,
          instances: [savedInstance({ buildingDefinitionVersion: 2 })],
        },
        CONFIG,
      ),
    ).toMatchObject({
      ok: false,
      error: { code: 'building-save:definition-version-mismatch' },
    });
  });

  it('rejects invalid rotations, overlapping footprints, and out-of-bounds origins', () => {
    expect(
      decodeBuildingSaveV1(
        {
          ...BASE_SAVE,
          instances: [savedInstance({ rotationQuarterTurns: 9 })],
        },
        CONFIG,
      ),
    ).toMatchObject({ ok: false, error: { code: 'building-save:invalid-rotation' } });

    expect(
      decodeBuildingSaveV1(
        {
          ...BASE_SAVE,
          instances: [
            savedInstance(),
            savedInstance({
              instanceId: 'building:1:2',
              buildingDefinitionId: 'commercial-office-2x2',
            }),
          ],
        },
        CONFIG,
      ),
    ).toMatchObject({ ok: false, error: { code: 'building-save:invalid-snapshot' } });

    expect(
      decodeBuildingSaveV1(
        {
          ...BASE_SAVE,
          instances: [
            savedInstance({
              buildingDefinitionId: 'commercial-office-2x2',
              originCell: { x: 7, z: 7 },
            }),
          ],
        },
        CONFIG,
      ),
    ).toMatchObject({ ok: false, error: { code: 'building-save:invalid-snapshot' } });
  });
});
