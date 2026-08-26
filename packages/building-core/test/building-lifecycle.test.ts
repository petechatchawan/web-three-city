import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import {
  buildingLifecycleCounts,
  constructionProgressAtMacroHour,
  constructionProgressAtTick,
  createBuildingSnapshot,
} from '../src/index.js';
import * as buildingLifecycle from '../src/index.js';

describe('Building lifecycle authority', () => {
  it('validates Construction and derives counts and progress', () => {
    const snapshot = createBuildingSnapshot(
      {
        revision: 1,
        instances: [
          {
            instanceId: 'building:growth:1',
            buildingDefinitionId: 'residential-cottage-1x1',
            buildingDefinitionVersion: 1,
            originCell: { x: 0, z: 0 },
            rotationQuarterTurns: 0,
            lifecycle: 'construction',
            constructionStartedAtTick: 10,
            constructionCompletesAtTick: 34,
          },
        ],
      },
      WORLD_CONFIG,
    );
    const instance = snapshot.instances[0];
    expect(buildingLifecycleCounts(snapshot)).toEqual({
      construction: 1,
      active: 0,
      total: 1,
    });
    if (instance?.lifecycle !== 'construction') throw new Error('expected construction');
    expect(constructionProgressAtTick(instance, 22)).toBe(0.5);
    expect(constructionProgressAtMacroHour(instance, 22)).toBe(0.5);
  });

  it('rejects an end tick that is not after start', () => {
    expect(() =>
      createBuildingSnapshot(
        {
          revision: 1,
          instances: [
            {
              instanceId: 'bad',
              buildingDefinitionId: 'residential-cottage-1x1',
              buildingDefinitionVersion: 1,
              originCell: { x: 0, z: 0 },
              rotationQuarterTurns: 0,
              lifecycle: 'construction',
              constructionStartedAtTick: 10,
              constructionCompletesAtTick: 10,
            },
          ],
        },
        WORLD_CONFIG,
      ),
    ).toThrow('building-lifecycle:invalid-construction');
  });

  it('exposes a lifecycle progress API named for the macro-hour authority', () => {
    expect('constructionProgressAtMacroHour' in buildingLifecycle).toBe(true);
  });

  it('migrates a legacy instance to Active at the initial tick', () => {
    const snapshot = createBuildingSnapshot(
      {
        revision: 1,
        instances: [
          {
            instanceId: 'legacy',
            buildingDefinitionId: 'commercial-shop-1x1',
            buildingDefinitionVersion: 1,
            originCell: { x: 0, z: 0 },
            rotationQuarterTurns: 0,
          },
        ],
      },
      WORLD_CONFIG,
    );
    expect(snapshot.instances[0]).toMatchObject({ lifecycle: 'active', activatedAtTick: 8 });
  });
});
