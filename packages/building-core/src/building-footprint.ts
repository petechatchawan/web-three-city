import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import type { ZoneRoadDirection } from '@web-three-city/zone-core';
import { buildingDefinitionForId } from './building-definitions.js';
import type {
  BuildingDefinition,
  BuildingInstance,
  BuildingRotationQuarterTurns,
  RotatedBuildingFootprint,
} from './contracts.js';

export function isBuildingRotationQuarterTurns(
  value: number,
): value is BuildingRotationQuarterTurns {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

export function buildingEntranceDirection(
  rotationQuarterTurns: BuildingRotationQuarterTurns,
): ZoneRoadDirection {
  switch (rotationQuarterTurns) {
    case 0:
      return 'south';
    case 1:
      return 'west';
    case 2:
      return 'north';
    case 3:
      return 'east';
  }
}

export function rotatedBuildingFootprint(
  definition: BuildingDefinition,
  rotationQuarterTurns: BuildingRotationQuarterTurns,
): RotatedBuildingFootprint {
  if (!definition.allowedRotationQuarterTurns.includes(rotationQuarterTurns)) {
    throw new RangeError('building-footprint:rotation-not-allowed');
  }
  const swap = rotationQuarterTurns === 1 || rotationQuarterTurns === 3;
  return Object.freeze({
    width: swap ? definition.footprintDepth : definition.footprintWidth,
    depth: swap ? definition.footprintWidth : definition.footprintDepth,
  });
}

export function occupiedCellsForBuilding(instance: BuildingInstance): readonly CellCoord[] {
  const definition = buildingDefinitionForId(instance.buildingDefinitionId);
  if (definition.version !== instance.buildingDefinitionVersion) {
    throw new RangeError('building-footprint:definition-version-mismatch');
  }
  const footprint = rotatedBuildingFootprint(definition, instance.rotationQuarterTurns);
  const cells: CellCoord[] = [];
  for (let z = 0; z < footprint.depth; z += 1) {
    for (let x = 0; x < footprint.width; x += 1) {
      cells.push(Object.freeze({ x: instance.originCell.x + x, z: instance.originCell.z + z }));
    }
  }
  return Object.freeze(cells);
}

export function buildingFootprintInsideWorld(
  instance: BuildingInstance,
  config: WorldConfig,
): boolean {
  if (
    !Number.isInteger(instance.originCell.x) ||
    !Number.isInteger(instance.originCell.z) ||
    instance.originCell.x < 0 ||
    instance.originCell.z < 0
  ) {
    return false;
  }
  const definition = buildingDefinitionForId(instance.buildingDefinitionId);
  const footprint = rotatedBuildingFootprint(definition, instance.rotationQuarterTurns);
  return (
    instance.originCell.x + footprint.width <= config.mapWidth &&
    instance.originCell.z + footprint.depth <= config.mapHeight
  );
}

export function buildingContainsCell(instance: BuildingInstance, cell: CellCoord): boolean {
  return occupiedCellsForBuilding(instance).some(
    (candidate) => candidate.x === cell.x && candidate.z === cell.z,
  );
}
