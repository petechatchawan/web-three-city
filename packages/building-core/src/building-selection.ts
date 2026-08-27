import { macroHourValue, type MacroHourIndex } from '@web-three-city/simulation-core';
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
import {
  OPEN_BUILDING_GROWTH_POLICY,
  validateBuildingGrowthPolicy,
  type BuildingGrowthPolicy,
} from './growth-policy.js';

export interface BuildingSelectionCandidate {
  readonly definition: BuildingDefinition;
  readonly instance: BuildingInstance;
  readonly frontage: BuildingFrontage;
}

export interface BuildingSelectionContext {
  readonly macroHourIndex: MacroHourIndex;
  readonly growthSequence: number;
  readonly originCell: CellCoord;
  readonly zoneDefinitionId: string;
  readonly adjacentDefinitionIds: ReadonlySet<BuildingDefinitionId>;
}

interface PolicyCandidate {
  readonly candidate: BuildingSelectionCandidate;
  readonly zoneDefinitionId: string;
  readonly policyWeightMilli: number;
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
  const input = `${macroHourValue(context.macroHourIndex)}|${context.growthSequence}|${context.originCell.x},${context.originCell.z}|${context.zoneDefinitionId}`;
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
  const priorityTier = candidates.filter(
    (candidate) => candidate.definition.selectionPriority === highestPriority,
  );
  const bestByDefinition = new Map<BuildingDefinitionId, BuildingSelectionCandidate>();
  for (const candidate of [...priorityTier].sort(candidateOrder)) {
    if (!bestByDefinition.has(candidate.definition.id))
      bestByDefinition.set(candidate.definition.id, candidate);
  }
  const bestCandidates = [...bestByDefinition.values()];
  const nonAdjacent = bestCandidates.filter(
    (candidate) => !context.adjacentDefinitionIds.has(candidate.definition.id),
  );
  const eligibleTier = (nonAdjacent.length > 0 ? nonAdjacent : bestCandidates).sort((a, b) =>
    a.definition.id.localeCompare(b.definition.id),
  );
  const totalWeight = eligibleTier.reduce(
    (total, candidate) => total + candidate.definition.selectionWeight,
    0,
  );
  let cursor = stableBuildingSelectionHash(context) % totalWeight;
  for (const candidate of eligibleTier) {
    if (cursor < candidate.definition.selectionWeight) return candidate;
    cursor -= candidate.definition.selectionWeight;
  }
  return eligibleTier[eligibleTier.length - 1] ?? null;
}

function adjacentDefinitionIds(
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
  return adjacent;
}

export function selectGrowthBuildingPlacement(input: {
  readonly buildings: BuildingSnapshot;
  readonly environment: BuildingDevelopmentEnvironment;
  readonly config: WorldConfig;
  readonly macroHourIndex: MacroHourIndex;
  readonly growthSequence: number;
  readonly reservedCells?: readonly CellCoord[];
  readonly growthPolicy?: BuildingGrowthPolicy;
}): BuildingSelectionCandidate | null {
  const policy = input.growthPolicy ?? OPEN_BUILDING_GROWTH_POLICY;
  validateBuildingGrowthPolicy(policy);
  const occupied = new Set<string>();
  for (const instance of input.buildings.instances) {
    for (const cell of occupiedCellsForBuilding(instance)) occupied.add(key(cell));
  }
  const reserved = new Set((input.reservedCells ?? []).map(key));
  const policyCandidates: PolicyCandidate[] = [];

  for (let z = 0; z < input.config.mapHeight; z += 1) {
    for (let x = 0; x < input.config.mapWidth; x += 1) {
      const originCell = Object.freeze({ x, z });
      if (occupied.has(key(originCell))) continue;
      const zoneDefinitionId = input.environment.zoneDefinitionIdAt(originCell);
      if (zoneDefinitionId === null || !policy.allowsZone(zoneDefinitionId)) continue;
      const policyWeightMilli = policy.zoneWeightMilli(zoneDefinitionId);
      if (policyWeightMilli <= 0) continue;
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
                reserved.has(key(cell)) ||
                input.environment.zoneDefinitionIdAt(cell) !== zoneDefinitionId ||
                input.environment.isRoadOccupied(cell) ||
                !input.environment.isDry(cell) ||
                input.environment.surfaceAt(cell).shape !== 'flat',
            )
          )
            continue;
          const frontage = resolveBuildingFrontage(instance, input.environment);
          if (
            frontage !== null &&
            !reserved.has(key(frontage.frontageCell)) &&
            !reserved.has(key(frontage.roadCell))
          ) {
            candidates.push(Object.freeze({ definition, instance, frontage }));
          }
        }
      }
      if (candidates.length === 0) continue;
      const selected = selectBuildingCandidate(candidates, {
        macroHourIndex: input.macroHourIndex,
        growthSequence: input.growthSequence,
        originCell,
        zoneDefinitionId,
        adjacentDefinitionIds: adjacentDefinitionIds(
          occupiedCellsForBuilding(candidates[0]!.instance),
          input.buildings,
        ),
      });
      if (selected !== null)
        policyCandidates.push({ candidate: selected, zoneDefinitionId, policyWeightMilli });
    }
  }

  if (policyCandidates.length === 0) return null;
  const ordered = policyCandidates.sort(
    (a, b) =>
      a.candidate.instance.originCell.z - b.candidate.instance.originCell.z ||
      a.candidate.instance.originCell.x - b.candidate.instance.originCell.x ||
      a.candidate.definition.id.localeCompare(b.candidate.definition.id),
  );
  const totalWeight = ordered.reduce((sum, value) => sum + value.policyWeightMilli, 0);
  const seed = stableBuildingSelectionHash({
    macroHourIndex: input.macroHourIndex,
    growthSequence: input.growthSequence,
    originCell: ordered[0]!.candidate.instance.originCell,
    zoneDefinitionId: `policy:${policy.policyRevision}`,
  });
  let cursor = seed % totalWeight;
  for (const value of ordered) {
    if (cursor < value.policyWeightMilli) return value.candidate;
    cursor -= value.policyWeightMilli;
  }
  return ordered[ordered.length - 1]!.candidate;
}
