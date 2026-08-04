import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import { buildingDefinitions } from './building-definitions.js';
import { buildingEntranceDirection, occupiedCellsForBuilding } from './building-footprint.js';
import { resolveBuildingFrontage } from './building-frontage.js';
import type {
  BuildingDefinition,
  BuildingDefinitionId,
  BuildingDevelopmentEnvironment,
  BuildingFrontage,
  BuildingInstance,
  BuildingSnapshot,
} from './contracts.js';

export interface BuildingSelectionCandidate {
  readonly definition: BuildingDefinition;
  readonly instance: BuildingInstance;
  readonly frontage: BuildingFrontage;
}

export interface BuildingSelectionContext {
  readonly absoluteTick: number;
  readonly growthSequence: number;
  readonly originCell: CellCoord;
  readonly zoneDefinitionId: string;
  readonly adjacentDefinitionIds: ReadonlySet<BuildingDefinitionId>;
}

function key(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

function inside(cell: CellCoord, config: WorldConfig): boolean {
  return cell.x >= 0 && cell.z >= 0 && cell.x < config.mapWidth && cell.z < config.mapHeight;
}

function frontageOrder(direction: BuildingFrontage['direction']): number {
  return direction === 'north' ? 0 : direction === 'east' ? 1 : direction === 'south' ? 2 : 3;
}

function candidateOrder(a: BuildingSelectionCandidate, b: BuildingSelectionCandidate): number {
  const aMisaligned =
    buildingEntranceDirection(a.instance.rotationQuarterTurns) === a.frontage.direction ? 0 : 1;
  const bMisaligned =
    buildingEntranceDirection(b.instance.rotationQuarterTurns) === b.frontage.direction ? 0 : 1;
  return (
    aMisaligned - bMisaligned ||
    a.frontage.distance - b.frontage.distance ||
    frontageOrder(a.frontage.direction) - frontageOrder(b.frontage.direction) ||
    a.frontage.frontageCell.z - b.frontage.frontageCell.z ||
    a.frontage.frontageCell.x - b.frontage.frontageCell.x ||
    a.instance.rotationQuarterTurns - b.instance.rotationQuarterTurns
  );
}

export function stableBuildingSelectionHash(
  context: Omit<BuildingSelectionContext, 'adjacentDefinitionIds'>,
): number {
  const input = `${context.absoluteTick}|${context.growthSequence}|${context.originCell.x},${context.originCell.z}|${context.zoneDefinitionId}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function selectBuildingCandidate(
  candidates: readonly BuildingSelectionCandidate[],
  context: BuildingSelectionContext,
): BuildingSelectionCandidate | null {
  if (candidates.length === 0) return null;
  const highestPriority = Math.max(
    ...candidates.map((candidate) => candidate.definition.selectionPriority),
  );
  let tier = candidates.filter(
    (candidate) => candidate.definition.selectionPriority === highestPriority,
  );
  const bestByDefinition = new Map<BuildingDefinitionId, BuildingSelectionCandidate>();
  for (const candidate of [...tier].sort(candidateOrder)) {
    if (!bestByDefinition.has(candidate.definition.id))
      bestByDefinition.set(candidate.definition.id, candidate);
  }
  tier = [...bestByDefinition.values()];
  const nonAdjacent = tier.filter(
    (candidate) => !context.adjacentDefinitionIds.has(candidate.definition.id),
  );
  if (nonAdjacent.length > 0) tier = nonAdjacent;
  tier.sort((a, b) => a.definition.id.localeCompare(b.definition.id));
  const totalWeight = tier.reduce(
    (total, candidate) => total + candidate.definition.selectionWeight,
    0,
  );
  let cursor = stableBuildingSelectionHash(context) % totalWeight;
  for (const candidate of tier) {
    if (cursor < candidate.definition.selectionWeight) return candidate;
    cursor -= candidate.definition.selectionWeight;
  }
  return tier[tier.length - 1] ?? null;
}

function adjacentDefinitionIds(
  origin: CellCoord,
  footprintCells: readonly CellCoord[],
  buildings: BuildingSnapshot,
): ReadonlySet<BuildingDefinitionId> {
  const footprintKeys = new Set(footprintCells.map(key));
  const adjacent = new Set<BuildingDefinitionId>();
  for (const instance of buildings.instances) {
    for (const cell of occupiedCellsForBuilding(instance)) {
      for (const delta of [
        { x: -1, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: -1 },
        { x: 0, z: 1 },
      ]) {
        if (footprintKeys.has(key({ x: cell.x + delta.x, z: cell.z + delta.z }))) {
          adjacent.add(instance.buildingDefinitionId);
        }
      }
    }
  }
  void origin;
  return adjacent;
}

export function selectGrowthBuildingPlacement(input: {
  readonly buildings: BuildingSnapshot;
  readonly environment: BuildingDevelopmentEnvironment;
  readonly config: WorldConfig;
  readonly absoluteTick: number;
  readonly growthSequence: number;
}): BuildingSelectionCandidate | null {
  const occupied = new Set<string>();
  for (const instance of input.buildings.instances) {
    for (const cell of occupiedCellsForBuilding(instance)) occupied.add(key(cell));
  }

  for (let z = 0; z < input.config.mapHeight; z += 1) {
    for (let x = 0; x < input.config.mapWidth; x += 1) {
      const originCell = Object.freeze({ x, z });
      if (occupied.has(key(originCell))) continue;
      const zoneDefinitionId = input.environment.zoneDefinitionIdAt(originCell);
      if (zoneDefinitionId === null) continue;
      const candidates: BuildingSelectionCandidate[] = [];
      for (const definition of buildingDefinitions()) {
        if (!definition.compatibleZoneDefinitionIds.includes(zoneDefinitionId)) continue;
        for (const rotationQuarterTurns of definition.allowedRotationQuarterTurns) {
          const instance: BuildingInstance = Object.freeze({
            instanceId: 'building:growth:candidate',
            buildingDefinitionId: definition.id,
            buildingDefinitionVersion: definition.version,
            originCell,
            rotationQuarterTurns,
          });
          const cells = occupiedCellsForBuilding(instance);
          if (
            cells.some(
              (cell) =>
                !inside(cell, input.config) ||
                occupied.has(key(cell)) ||
                input.environment.zoneDefinitionIdAt(cell) !== zoneDefinitionId ||
                input.environment.isRoadOccupied(cell) ||
                !input.environment.isDry(cell) ||
                input.environment.surfaceAt(cell).shape !== 'flat',
            )
          ) {
            continue;
          }
          const frontage = resolveBuildingFrontage(instance, input.environment);
          if (frontage !== null) candidates.push(Object.freeze({ definition, instance, frontage }));
        }
      }
      if (candidates.length === 0) continue;
      const sampleCells = occupiedCellsForBuilding(candidates[0]!.instance);
      return selectBuildingCandidate(candidates, {
        absoluteTick: input.absoluteTick,
        growthSequence: input.growthSequence,
        originCell,
        zoneDefinitionId,
        adjacentDefinitionIds: adjacentDefinitionIds(originCell, sampleCells, input.buildings),
      });
    }
  }
  return null;
}
