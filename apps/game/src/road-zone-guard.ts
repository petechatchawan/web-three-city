import {
  createRoadSnapshot,
  type RoadInvalidReason,
  type RoadMutationPlan,
  type RoadSnapshot,
} from '@web-three-city/road-core';
import type { TerrainSnapshot } from '@web-three-city/terrain-core';
import type { WaterSnapshot } from '@web-three-city/water-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import { zoneOccupiedAt, type ZoneSnapshot } from '@web-three-city/zone-core';
import {
  createZonePlacementEnvironment,
  type ZoneWorldOccupancy,
} from './zone-placement-environment.js';

export type GameRoadInvalidReason =
  RoadInvalidReason | 'road:zone-occupied' | 'road:zone-access-lost';

export interface GuardedRoadCandidate {
  readonly corePlan: RoadMutationPlan;
  readonly previewPlan: RoadMutationPlan;
  readonly valid: boolean;
  readonly invalidReason: GameRoadInvalidReason | null;
  readonly blockedZoneCells: readonly CellCoord[];
}

const EMPTY_ZONE_CELLS: readonly CellCoord[] = Object.freeze([]);

function frozenSortedCells(cells: Iterable<CellCoord>): readonly CellCoord[] {
  const unique = new Map<string, CellCoord>();
  for (const cell of cells) unique.set(`${cell.x}:${cell.z}`, cell);
  return Object.freeze(
    [...unique.values()]
      .map((cell) => Object.freeze({ x: cell.x, z: cell.z }))
      .sort((first, second) => first.z - second.z || first.x - second.x),
  );
}

function invalidCandidate(
  plan: RoadMutationPlan,
  reason: GameRoadInvalidReason,
  blockedZoneCells: readonly CellCoord[],
): GuardedRoadCandidate {
  const previewPlan: RoadMutationPlan = Object.freeze({
    ...plan,
    valid: false,
  });
  return Object.freeze({
    corePlan: plan,
    previewPlan,
    valid: false,
    invalidReason: reason,
    blockedZoneCells,
  });
}

export function guardRoadPlanWithZones(
  plan: RoadMutationPlan,
  baseRoads: RoadSnapshot,
  zones: ZoneSnapshot,
  terrain: TerrainSnapshot,
  water: WaterSnapshot,
  occupancy: ZoneWorldOccupancy,
  config: WorldConfig,
): GuardedRoadCandidate {
  if (!plan.valid) {
    return Object.freeze({
      corePlan: plan,
      previewPlan: plan,
      valid: false,
      invalidReason: plan.invalidReason,
      blockedZoneCells: EMPTY_ZONE_CELLS,
    });
  }

  const overlappingZones = frozenSortedCells(
    plan.addedCells.filter((cell) => zoneOccupiedAt(zones, cell)),
  );
  if (overlappingZones.length > 0) {
    return invalidCandidate(plan, 'road:zone-occupied', overlappingZones);
  }

  if (plan.operation === 'bulldoze' && plan.removedCells.length > 0) {
    const proposedRoads = createRoadSnapshot(
      {
        width: baseRoads.width,
        height: baseRoads.height,
        revision: baseRoads.revision + 1,
        definitionCodes: plan.proposedDefinitionCodes,
      },
      config,
    );
    const beforeEnvironment = createZonePlacementEnvironment(
      terrain,
      water,
      baseRoads,
      occupancy,
      config,
    );
    const afterEnvironment = createZonePlacementEnvironment(
      terrain,
      water,
      proposedRoads,
      occupancy,
      config,
    );
    const lostAccess: CellCoord[] = [];
    for (let z = 0; z < zones.height; z += 1) {
      for (let x = 0; x < zones.width; x += 1) {
        const cell = { x, z };
        if (!zoneOccupiedAt(zones, cell)) continue;
        if (
          beforeEnvironment.roadAccessAt(cell) !== null &&
          afterEnvironment.roadAccessAt(cell) === null
        ) {
          lostAccess.push(cell);
        }
      }
    }
    const blockedZoneCells = frozenSortedCells(lostAccess);
    if (blockedZoneCells.length > 0) {
      return invalidCandidate(plan, 'road:zone-access-lost', blockedZoneCells);
    }
  }

  return Object.freeze({
    corePlan: plan,
    previewPlan: plan,
    valid: true,
    invalidReason: null,
    blockedZoneCells: EMPTY_ZONE_CELLS,
  });
}
