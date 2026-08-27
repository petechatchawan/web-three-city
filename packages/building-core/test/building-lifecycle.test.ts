import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import {
  macroHourDuration,
  macroHourIndex,
  macroHourValue,
  type MacroHourDuration,
} from '@web-three-city/simulation-core';
import {
  buildingLifecycleCounts,
  createBuildingSnapshot,
  deriveConstructionProgressAtMacroHour,
  deriveConstructionStateAtMacroHour,
  isBuildingConstructionCompleteAtMacroHour,
  validateBuildingLifecycleAtMacroHour,
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
          constructionStartedAtMacroHourIndex: macroHourIndex(LEGACY_LIFECYCLE_GOLDEN.start),
          constructionCompletesAtMacroHourIndex: macroHourIndex(LEGACY_LIFECYCLE_GOLDEN.completion),
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
    const duration: MacroHourDuration = macroHourDuration(
      macroHourValue(instance.constructionCompletesAtMacroHourIndex) -
        macroHourValue(instance.constructionStartedAtMacroHourIndex),
    );
    expect(macroHourValue(duration)).toBe(6);
    expect(deriveConstructionProgressAtMacroHour(instance, macroHourIndex(12))).toBe(0);
    expect(deriveConstructionProgressAtMacroHour(instance, macroHourIndex(15))).toBe(0.5);
    expect(deriveConstructionProgressAtMacroHour(instance, macroHourIndex(18))).toBe(1);
    expect(deriveConstructionStateAtMacroHour(instance, macroHourIndex(15))).toBe('construction');
    expect(deriveConstructionStateAtMacroHour(instance, macroHourIndex(18))).toBe('active');
    expect(() => validateBuildingLifecycleAtMacroHour(instance, macroHourIndex(17))).not.toThrow();
    expect(() => validateBuildingLifecycleAtMacroHour(instance, macroHourIndex(18))).toThrow(
      'building-lifecycle:invalid-construction',
    );
    expect(isBuildingConstructionCompleteAtMacroHour(instance, macroHourIndex(12))).toBe(false);
    expect(isBuildingConstructionCompleteAtMacroHour(instance, macroHourIndex(15))).toBe(false);
    expect(isBuildingConstructionCompleteAtMacroHour(instance, macroHourIndex(18))).toBe(true);
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
      start: macroHourValue(instance.constructionStartedAtMacroHourIndex),
      duration:
        macroHourValue(instance.constructionCompletesAtMacroHourIndex) -
        macroHourValue(instance.constructionStartedAtMacroHourIndex),
      completion: macroHourValue(instance.constructionCompletesAtMacroHourIndex),
    }).toEqual(LEGACY_LIFECYCLE_GOLDEN);
    expect(macroHourValues).toEqual(LEGACY_LIFECYCLE_GOLDEN);
  });

  it.each([11, 12])(
    'rejects construction completion before or at its macro-hour start (%s)',
    (completionAtMacroHourIndex) => {
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
                constructionStartedAtMacroHourIndex: macroHourIndex(12),
                constructionCompletesAtMacroHourIndex: macroHourIndex(completionAtMacroHourIndex),
              },
            ],
          },
          WORLD_CONFIG,
        ),
      ).toThrow('building-lifecycle:invalid-construction');
    },
  );

  it('exposes lifecycle APIs named for the macro-hour authority', () => {
    expect('validateBuildingLifecycleAtMacroHour' in buildingLifecycle).toBe(true);
    expect('deriveConstructionStateAtMacroHour' in buildingLifecycle).toBe(true);
    expect('deriveConstructionProgressAtMacroHour' in buildingLifecycle).toBe(true);
  });

  it('migrates a legacy instance to Active at the initial macro-hour index', () => {
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
    expect(snapshot.instances[0]).toMatchObject({
      lifecycle: 'active',
      activatedAtMacroHourIndex: macroHourIndex(8),
    });
  });
});
