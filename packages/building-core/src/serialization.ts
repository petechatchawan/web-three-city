import { err, ok, type Result, type WorldConfig } from '@web-three-city/world-core';
import { buildingDefinitionForId } from './building-definitions.js';
import { isBuildingRotationQuarterTurns } from './building-footprint.js';
import { createBuildingSnapshot } from './building-snapshot.js';
import type {
  BuildingDefinition,
  BuildingDefinitionId,
  BuildingInstance,
  BuildingRotationQuarterTurns,
  BuildingSnapshot,
} from './contracts.js';

export interface BuildingSaveInstanceV1 {
  readonly instanceId: string;
  readonly buildingDefinitionId: BuildingDefinitionId;
  readonly buildingDefinitionVersion: 1;
  readonly originCell: Readonly<{ readonly x: number; readonly z: number }>;
  readonly rotationQuarterTurns: BuildingRotationQuarterTurns;
}

export interface BuildingSaveV1 {
  readonly kind: 'building-save';
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly instances: readonly BuildingSaveInstanceV1[];
}

export type BuildingSaveErrorCode =
  | 'building-save:invalid-schema'
  | 'building-save:invalid-revision'
  | 'building-save:invalid-instance'
  | 'building-save:unknown-definition'
  | 'building-save:definition-version-mismatch'
  | 'building-save:invalid-rotation'
  | 'building-save:invalid-snapshot';

export interface BuildingSaveError {
  readonly code: BuildingSaveErrorCode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function encodeBuildingSaveV1(snapshot: BuildingSnapshot): BuildingSaveV1 {
  return Object.freeze({
    kind: 'building-save' as const,
    schemaVersion: 1 as const,
    revision: snapshot.revision,
    instances: Object.freeze(
      snapshot.instances.map((instance) =>
        Object.freeze({
          instanceId: instance.instanceId,
          buildingDefinitionId: instance.buildingDefinitionId,
          buildingDefinitionVersion: instance.buildingDefinitionVersion,
          originCell: Object.freeze({ x: instance.originCell.x, z: instance.originCell.z }),
          rotationQuarterTurns: instance.rotationQuarterTurns,
        }),
      ),
    ),
  });
}

export function decodeBuildingSaveV1(
  input: unknown,
  config: WorldConfig,
): Result<BuildingSnapshot, BuildingSaveError> {
  if (
    !isRecord(input) ||
    input.kind !== 'building-save' ||
    input.schemaVersion !== 1 ||
    !Array.isArray(input.instances)
  ) {
    return err({ code: 'building-save:invalid-schema' });
  }
  if (!Number.isSafeInteger(input.revision) || (input.revision as number) < 0) {
    return err({ code: 'building-save:invalid-revision' });
  }

  const instances: BuildingInstance[] = [];
  for (const candidate of input.instances) {
    if (
      !isRecord(candidate) ||
      typeof candidate.instanceId !== 'string' ||
      candidate.instanceId.length === 0 ||
      typeof candidate.buildingDefinitionId !== 'string' ||
      !Number.isSafeInteger(candidate.buildingDefinitionVersion) ||
      !isRecord(candidate.originCell) ||
      !Number.isInteger(candidate.originCell.x) ||
      !Number.isInteger(candidate.originCell.z) ||
      typeof candidate.rotationQuarterTurns !== 'number'
    ) {
      return err({ code: 'building-save:invalid-instance' });
    }

    let definition: BuildingDefinition;
    try {
      definition = buildingDefinitionForId(candidate.buildingDefinitionId as BuildingDefinitionId);
    } catch {
      return err({ code: 'building-save:unknown-definition' });
    }
    if (definition.version !== candidate.buildingDefinitionVersion) {
      return err({ code: 'building-save:definition-version-mismatch' });
    }
    if (
      !isBuildingRotationQuarterTurns(candidate.rotationQuarterTurns) ||
      !definition.allowedRotationQuarterTurns.includes(candidate.rotationQuarterTurns)
    ) {
      return err({ code: 'building-save:invalid-rotation' });
    }

    instances.push(
      Object.freeze({
        instanceId: candidate.instanceId,
        buildingDefinitionId: definition.id,
        buildingDefinitionVersion: definition.version,
        originCell: Object.freeze({
          x: candidate.originCell.x as number,
          z: candidate.originCell.z as number,
        }),
        rotationQuarterTurns: candidate.rotationQuarterTurns,
      }),
    );
  }

  try {
    return ok(
      createBuildingSnapshot(
        { revision: input.revision as number, instances: Object.freeze(instances) },
        config,
      ),
    );
  } catch {
    return err({ code: 'building-save:invalid-snapshot' });
  }
}
