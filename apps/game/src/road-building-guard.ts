import {
  buildingOccupiedAt,
  resolveBuildingFrontage,
  type BuildingSnapshot,
} from '@web-three-city/building-core';
import { createRoadSnapshot, type RoadSnapshot } from '@web-three-city/road-core';
import type { TerrainSnapshot } from '@web-three-city/terrain-core';
import type { WaterSnapshot } from '@web-three-city/water-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import type { ZoneSnapshot } from '@web-three-city/zone-core';
import { createBuildingDevelopmentEnvironment } from './building-development-environment.js';
import type { GuardedRoadCandidate, GameRoadInvalidReason } from './road-zone-guard.js';

export type GameRoadBuildingInvalidReason =
  GameRoadInvalidReason | 'road:building-occupied' | 'road:building-access-lost';

export interface GuardedRoadBuildingCandidate extends Omit<GuardedRoadCandidate, 'invalidReason'> {
  readonly invalidReason: GameRoadBuildingInvalidReason | null;
  readonly blockedBuildingCells: readonly CellCoord[];
}

function sorted(cells: Iterable<CellCoord>): readonly CellCoord[] {
  const unique = new Map<string, CellCoord>();
  for (const cell of cells) unique.set(`${cell.x}:${cell.z}`, cell);
  return Object.freeze(
    [...unique.values()]
      .map((cell) => Object.freeze({ ...cell }))
      .sort((a, b) => a.z - b.z || a.x - b.x),
  );
}

export function guardRoadPlanWithBuildings(
  candidate: GuardedRoadCandidate,
  baseRoads: RoadSnapshot,
  buildings: BuildingSnapshot,
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  zones: ZoneSnapshot,
  config: WorldConfig,
): GuardedRoadBuildingCandidate {
  if (!candidate.valid && candidate.invalidReason !== 'road:zone-access-lost') {
    return Object.freeze({ ...candidate, blockedBuildingCells: Object.freeze([]) });
  }

  const overlaps = sorted(
    candidate.corePlan.addedCells.filter((cell) => buildingOccupiedAt(buildings, cell)),
  );
  if (overlaps.length > 0) {
    return Object.freeze({
      ...candidate,
      valid: false,
      previewPlan: Object.freeze({ ...candidate.previewPlan, valid: false }),
      invalidReason: 'road:building-occupied',
      blockedBuildingCells: overlaps,
    });
  }

  if (candidate.corePlan.operation === 'bulldoze' && buildings.instances.length > 0) {
    const proposedRoads = createRoadSnapshot(
      {
        width: baseRoads.width,
        height: baseRoads.height,
        revision: baseRoads.revision + 1,
        definitionCodes: candidate.corePlan.proposedDefinitionCodes,
      },
      config,
    );
    const before = createBuildingDevelopmentEnvironment(terrain, water, baseRoads, zones, config);
    const after = createBuildingDevelopmentEnvironment(
      terrain,
      water,
      proposedRoads,
      zones,
      config,
    );
    const lost: CellCoord[] = [];
    for (const instance of buildings.instances) {
      if (
        resolveBuildingFrontage(instance, before) !== null &&
        resolveBuildingFrontage(instance, after) === null
      ) {
        lost.push(instance.originCell);
      }
    }
    const blocked = sorted(lost);
    if (blocked.length > 0) {
      return Object.freeze({
        ...candidate,
        valid: false,
        previewPlan: Object.freeze({ ...candidate.previewPlan, valid: false }),
        invalidReason: 'road:building-access-lost',
        blockedBuildingCells: blocked,
      });
    }
  }

  return Object.freeze({ ...candidate, blockedBuildingCells: Object.freeze([]) });
}
