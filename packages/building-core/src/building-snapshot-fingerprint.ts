import { buildingInstances } from './building-snapshot.js';
import type { BuildingSnapshot } from './contracts.js';

export function fingerprintBuildingSnapshot(snapshot: BuildingSnapshot): string {
  const instances = buildingInstances(snapshot)
    .map((instance) => ({
      instanceId: instance.instanceId,
      buildingDefinitionId: instance.buildingDefinitionId,
      buildingDefinitionVersion: instance.buildingDefinitionVersion,
      originCell: { x: instance.originCell.x, z: instance.originCell.z },
      rotationQuarterTurns: instance.rotationQuarterTurns,
      lifecycle: instance.lifecycle,
      ...(instance.lifecycle === 'construction'
        ? {
            constructionStartedAtTick: instance.constructionStartedAtTick,
            constructionCompletesAtTick: instance.constructionCompletesAtTick,
          }
        : { activatedAtTick: instance.activatedAtTick }),
    }))
    .sort((first, second) => first.instanceId.localeCompare(second.instanceId));
  return `building-snapshot-v1:${JSON.stringify({ revision: snapshot.revision, instances })}`;
}
