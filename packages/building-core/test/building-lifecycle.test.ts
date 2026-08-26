import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { macroHourDuration, macroHourIndex, macroHourValue } from '@web-three-city/simulation-core';
import {
  buildingLifecycleCounts,
  constructionProgressAtMacroHour,
  constructionProgressAtTick,
  createBuildingSnapshot,
  isBuildingConstructionCompleteAtMacroHour,
} from '../src/index.js';
import * as buildingLifecycle from '../src/index.js';

const LEGACY_LIFECYCLE_GOLDEN = Object.freeze({
  start: 12,
  duration: 6,
  completion: 18,
});

function constructionSnapshot() {
  return createBuildingSnapshot(
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
          constructionStartedAtTick: LEGACY_LIFECYCLE_GOLDEN.start,
          constructionCompletesAtTick: LEGACY_LIFECYCLE_GOLDEN.completion,
        },
      ],
    },
    WORLD_CONFIG,
  );
}

describe('Building lifecycle authority', () => {
  it('validates a six-macro-hour construction from 12 through 18', () => {
    const snapshot = constructionSnapshot();
    const instance = snapshot.instances[0];
    expect(buildingLifecycleCounts(snapshot)).toEqual({
      construction: 1,
      active: 0,
      total: 1,
    });
    if (instance?.lifecycle !== 'construction') throw new Error('expected construction');
    expect(instance.constructionCompletesAtTick - instance.constructionStartedAtTick).toBe(6);
    expect(constructionProgressAtMacroHour(instance, 12)).toBe(0);
    expect(constructionProgressAtMacroHour(instance, 15)).toBe(0.5);
    expect(constructionProgressAtMacroHour(instance, 18)).toBe(1);
    expect(constructionProgressAtTick(instance, 15)).toBe(0.5);
    expect(isBuildingConstructionCompleteAtMacroHour(instance, 12)).toBe(false);
    expect(isBuildingConstructionCompleteAtMacroHour(instance, 15)).toBe(false);
    expect(isBuildingConstructionCompleteAtMacroHour(instance, 18)).toBe(true);
  });

  it('records legacy lifecycle values as a 1:1 macro-hour golden fixture', () => {
    const snapshot = constructionSnapshot();
    const instance = snapshot.instances[0];
    if (instance?.lifecycle !== 'construction') throw new Error('expected construction');

    const macroHourValues = {
      start: macroHourValue(macroHourIndex(12)),
      duration: macroHourValue(macroHourDuration(6)),
      completion: macroHourValue(macroHourIndex(18)),
    };

    expect({
      start: instance.constructionStartedAtTick,
      duration: instance.constructionCompletesAtTick - instance.constructionStartedAtTick,
      completion: instance.constructionCompletesAtTick,
    }).toEqual(LEGACY_LIFECYCLE_GOLDEN);
    expect(macroHourValues).toEqual(LEGACY_LIFECYCLE_GOLDEN);
  });

  it.each([11, 12])(
    'rejects construction completion before or at its macro-hour start (%s)',
    (completionAtTick) => {
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
                constructionStartedAtTick: 12,
                constructionCompletesAtTick: completionAtTick,
              },
            ],
          },
          WORLD_CONFIG,
        ),
      ).toThrow('building-lifecycle:invalid-construction');
    },
  );

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
