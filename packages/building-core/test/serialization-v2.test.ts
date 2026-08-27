import { describe, expect, it } from 'vitest';
import { WORLD_CONFIG } from '@web-three-city/world-core';
import { macroHourIndex } from '@web-three-city/simulation-core';
import {
  createBuildingSnapshot,
  decodeBuildingSaveV2,
  encodeBuildingSaveV2,
} from '../src/index.js';

const legacyBuildingBase = {
  buildingDefinitionId: 'residential-cottage-1x1',
  buildingDefinitionVersion: 1,
  originCell: { x: 0, z: 0 },
  rotationQuarterTurns: 0,
} as const;

const legacySaveBase = {
  kind: 'building-save',
  schemaVersion: 2,
  revision: 1,
} as const;

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
            constructionStartedAtMacroHourIndex: macroHourIndex(24),
            constructionCompletesAtMacroHourIndex: macroHourIndex(48),
          },
        ],
      },
      WORLD_CONFIG,
    );
    const decoded = decodeBuildingSaveV2(encodeBuildingSaveV2(snapshot), WORLD_CONFIG);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.value).toEqual(snapshot);
  });

  it('decodes legacy construction timestamps into macro-hour runtime fields 1:1', () => {
    const result = decodeBuildingSaveV2(
      {
        ...legacySaveBase,
        instances: [
          {
            ...legacyBuildingBase,
            instanceId: 'building:legacy-construction',
            lifecycle: 'construction',
            constructionStartedAtTick: 12,
            constructionCompletesAtTick: 18,
          },
        ],
      },
      WORLD_CONFIG,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.instances).toEqual([
        {
          ...legacyBuildingBase,
          instanceId: 'building:legacy-construction',
          lifecycle: 'construction',
          constructionStartedAtMacroHourIndex: macroHourIndex(12),
          constructionCompletesAtMacroHourIndex: macroHourIndex(18),
        },
      ]);
    }
  });

  it('decodes a legacy active timestamp into a macro-hour runtime field 1:1', () => {
    const result = decodeBuildingSaveV2(
      {
        ...legacySaveBase,
        instances: [
          {
            ...legacyBuildingBase,
            instanceId: 'building:legacy-active',
            lifecycle: 'active',
            activatedAtTick: 24,
          },
        ],
      },
      WORLD_CONFIG,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.instances).toEqual([
        {
          ...legacyBuildingBase,
          instanceId: 'building:legacy-active',
          lifecycle: 'active',
          activatedAtMacroHourIndex: macroHourIndex(24),
        },
      ]);
    }
  });

  it('keeps legacy V2 wire field names and numbers when encoding macro-hour runtime fields', () => {
    const snapshot = createBuildingSnapshot(
      {
        revision: 7,
        instances: [
          {
            ...legacyBuildingBase,
            instanceId: 'building:wire-1-construction',
            lifecycle: 'construction',
            constructionStartedAtMacroHourIndex: macroHourIndex(12),
            constructionCompletesAtMacroHourIndex: macroHourIndex(18),
          },
          {
            ...legacyBuildingBase,
            instanceId: 'building:wire-2-active',
            originCell: { x: 2, z: 0 },
            lifecycle: 'active',
            activatedAtMacroHourIndex: macroHourIndex(24),
          },
        ],
      },
      WORLD_CONFIG,
    );

    expect(encodeBuildingSaveV2(snapshot)).toEqual({
      kind: 'building-save',
      schemaVersion: 2,
      revision: 7,
      instances: [
        {
          ...legacyBuildingBase,
          instanceId: 'building:wire-1-construction',
          lifecycle: 'construction',
          constructionStartedAtTick: 12,
          constructionCompletesAtTick: 18,
        },
        {
          ...legacyBuildingBase,
          instanceId: 'building:wire-2-active',
          originCell: { x: 2, z: 0 },
          lifecycle: 'active',
          activatedAtTick: 24,
        },
      ],
    });
  });

  it.each([
    {
      name: 'negative construction start',
      instance: {
        ...legacyBuildingBase,
        instanceId: 'building:invalid-negative-construction-start',
        lifecycle: 'construction',
        constructionStartedAtTick: -1,
        constructionCompletesAtTick: 18,
      },
    },
    {
      name: 'fractional construction start',
      instance: {
        ...legacyBuildingBase,
        instanceId: 'building:invalid-fractional-construction-start',
        lifecycle: 'construction',
        constructionStartedAtTick: 12.5,
        constructionCompletesAtTick: 18,
      },
    },
    {
      name: 'unsafe construction start',
      instance: {
        ...legacyBuildingBase,
        instanceId: 'building:invalid-unsafe-construction-start',
        lifecycle: 'construction',
        constructionStartedAtTick: Number.MAX_SAFE_INTEGER + 1,
        constructionCompletesAtTick: 18,
      },
    },
    {
      name: 'negative construction completion',
      instance: {
        ...legacyBuildingBase,
        instanceId: 'building:invalid-negative-construction-completion',
        lifecycle: 'construction',
        constructionStartedAtTick: 12,
        constructionCompletesAtTick: -1,
      },
    },
    {
      name: 'fractional construction completion',
      instance: {
        ...legacyBuildingBase,
        instanceId: 'building:invalid-fractional-construction-completion',
        lifecycle: 'construction',
        constructionStartedAtTick: 12,
        constructionCompletesAtTick: 18.5,
      },
    },
    {
      name: 'unsafe construction completion',
      instance: {
        ...legacyBuildingBase,
        instanceId: 'building:invalid-unsafe-construction-completion',
        lifecycle: 'construction',
        constructionStartedAtTick: 12,
        constructionCompletesAtTick: Number.MAX_SAFE_INTEGER + 1,
      },
    },
    {
      name: 'negative activation',
      instance: {
        ...legacyBuildingBase,
        instanceId: 'building:invalid-negative-activation',
        lifecycle: 'active',
        activatedAtTick: -1,
      },
    },
    {
      name: 'fractional activation',
      instance: {
        ...legacyBuildingBase,
        instanceId: 'building:invalid-fractional-activation',
        lifecycle: 'active',
        activatedAtTick: 24.5,
      },
    },
    {
      name: 'unsafe activation',
      instance: {
        ...legacyBuildingBase,
        instanceId: 'building:invalid-unsafe-activation',
        lifecycle: 'active',
        activatedAtTick: Number.MAX_SAFE_INTEGER + 1,
      },
    },
  ])('rejects $name legacy lifecycle values', ({ instance }) => {
    const result = decodeBuildingSaveV2({ ...legacySaveBase, instances: [instance] }, WORLD_CONFIG);

    expect(result).toEqual({
      ok: false,
      error: { code: 'building-save:invalid-instance' },
    });
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
