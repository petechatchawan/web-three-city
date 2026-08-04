import type { WorldConfig } from '@web-three-city/world-core';
import { buildingDefinitionForId } from './building-definitions.js';
import { isBuildingRotationQuarterTurns } from './building-footprint.js';
import { createBuildingSnapshot } from './building-snapshot.js';
import type {
  AuthoritativeBuildingInstance,
  BuildingDefinitionId,
  BuildingRotationQuarterTurns,
  BuildingSnapshot,
} from './contracts.js';

interface BuildingSaveInstanceBaseV2 {
  readonly instanceId: string;
  readonly buildingDefinitionId: BuildingDefinitionId;
  readonly buildingDefinitionVersion: 1;
  readonly originCell: Readonly<{ readonly x: number; readonly z: number }>;
  readonly rotationQuarterTurns: BuildingRotationQuarterTurns;
}

export type BuildingSaveInstanceV2 =
  | (BuildingSaveInstanceBaseV2 &
      Readonly<{
        readonly lifecycle: 'construction';
        readonly constructionStartedAtTick: number;
        readonly constructionCompletesAtTick: number;
      }>)
  | (BuildingSaveInstanceBaseV2 &
      Readonly<{
        readonly lifecycle: 'active';
        readonly activatedAtTick: number;
      }>);

export interface BuildingSaveV2 {
  readonly kind: 'building-save';
  readonly schemaVersion: 2;
  readonly revision: number;
  readonly instances: readonly BuildingSaveInstanceV2[];
}

export type BuildingSaveV2Result =
  | Readonly<{ readonly ok: true; readonly value: BuildingSnapshot }>
  | Readonly<{
      readonly ok: false;
      readonly error: Readonly<{
        readonly code:
          | 'building-save:invalid-schema'
          | 'building-save:invalid-instance'
          | 'building-save:unknown-definition'
          | 'building-save:invalid-snapshot';
      }>;
    }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function encodeBuildingSaveV2(snapshot: BuildingSnapshot): BuildingSaveV2 {
  return Object.freeze({
    kind: 'building-save',
    schemaVersion: 2,
    revision: snapshot.revision,
    instances: Object.freeze(
      snapshot.instances.map((instance) =>
        Object.freeze(
          instance.lifecycle === 'construction'
            ? {
                instanceId: instance.instanceId,
                buildingDefinitionId: instance.buildingDefinitionId,
                buildingDefinitionVersion: instance.buildingDefinitionVersion,
                originCell: Object.freeze({ ...instance.originCell }),
                rotationQuarterTurns: instance.rotationQuarterTurns,
                lifecycle: 'construction' as const,
                constructionStartedAtTick: instance.constructionStartedAtTick,
                constructionCompletesAtTick: instance.constructionCompletesAtTick,
              }
            : {
                instanceId: instance.instanceId,
                buildingDefinitionId: instance.buildingDefinitionId,
                buildingDefinitionVersion: instance.buildingDefinitionVersion,
                originCell: Object.freeze({ ...instance.originCell }),
                rotationQuarterTurns: instance.rotationQuarterTurns,
                lifecycle: 'active' as const,
                activatedAtTick: instance.activatedAtTick,
              },
        ),
      ),
    ),
  });
}

export function decodeBuildingSaveV2(
  input: unknown,
  config: WorldConfig,
): BuildingSaveV2Result {
  if (
    !isRecord(input) ||
    input.kind !== 'building-save' ||
    input.schemaVersion !== 2 ||
    !Number.isSafeInteger(input.revision) ||
    (input.revision as number) < 0 ||
    !Array.isArray(input.instances)
  ) {
    return Object.freeze({
      ok: false,
      error: Object.freeze({ code: 'building-save:invalid-schema' }),
    });
  }

  const instances: AuthoritativeBuildingInstance[] = [];
  for (const candidate of input.instances) {
    if (
      !isRecord(candidate) ||
      typeof candidate.instanceId !== 'string' ||
      typeof candidate.buildingDefinitionId !== 'string' ||
      candidate.buildingDefinitionVersion !== 1 ||
      !isRecord(candidate.originCell) ||
      !Number.isInteger(candidate.originCell.x) ||
      !Number.isInteger(candidate.originCell.z) ||
      typeof candidate.rotationQuarterTurns !== 'number' ||
      !isBuildingRotationQuarterTurns(candidate.rotationQuarterTurns)
    ) {
      return Object.freeze({
        ok: false,
        error: Object.freeze({ code: 'building-save:invalid-instance' }),
      });
    }
    try {
      buildingDefinitionForId(candidate.buildingDefinitionId as BuildingDefinitionId);
    } catch {
      return Object.freeze({
        ok: false,
        error: Object.freeze({ code: 'building-save:unknown-definition' }),
      });
    }
    const base = {
      instanceId: candidate.instanceId,
      buildingDefinitionId: candidate.buildingDefinitionId as BuildingDefinitionId,
      buildingDefinitionVersion: 1 as const,
      originCell: Object.freeze({
        x: candidate.originCell.x as number,
        z: candidate.originCell.z as number,
      }),
      rotationQuarterTurns: candidate.rotationQuarterTurns,
    } as const;
    if (
      candidate.lifecycle === 'construction' &&
      typeof candidate.constructionStartedAtTick === 'number' &&
      typeof candidate.constructionCompletesAtTick === 'number'
    ) {
      instances.push(
        Object.freeze({
          ...base,
          lifecycle: 'construction',
          constructionStartedAtTick: candidate.constructionStartedAtTick,
          constructionCompletesAtTick: candidate.constructionCompletesAtTick,
        }),
      );
    } else if (
      candidate.lifecycle === 'active' &&
      typeof candidate.activatedAtTick === 'number'
    ) {
      instances.push(
        Object.freeze({
          ...base,
          lifecycle: 'active',
          activatedAtTick: candidate.activatedAtTick,
        }),
      );
    } else {
      return Object.freeze({
        ok: false,
        error: Object.freeze({ code: 'building-save:invalid-instance' }),
      });
    }
  }

  try {
    return Object.freeze({
      ok: true,
      value: createBuildingSnapshot(
        { revision: input.revision as number, instances },
        config,
      ),
    });
  } catch {
    return Object.freeze({
      ok: false,
      error: Object.freeze({ code: 'building-save:invalid-snapshot' }),
    });
  }
}
