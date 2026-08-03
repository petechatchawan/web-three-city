import { buildingOccupiedAt, type BuildingSnapshot } from '@web-three-city/building-core';
import { roadOccupiedAt, type RoadSnapshot } from '@web-three-city/road-core';
import type { TerraformInvalidReason, TerraformPlan } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';
import { zoneOccupiedAt, type ZoneSnapshot } from '@web-three-city/zone-core';

export type GameTerraformInvalidReason = TerraformInvalidReason | 'terraform:road-occupied' | 'terraform:zone-occupied' | 'terraform:building-occupied';
export interface GuardedTerraformCandidate {
  readonly corePlan: TerraformPlan;
  readonly previewPlan: TerraformPlan;
  readonly valid: boolean;
  readonly invalidReason: GameTerraformInvalidReason | null;
  readonly blockedRoadCells: readonly CellCoord[];
  readonly blockedZoneCells: readonly CellCoord[];
  readonly blockedBuildingCells: readonly CellCoord[];
}
export type GuardedTerraformPlan = GuardedTerraformCandidate;
const EMPTY_CELLS: readonly CellCoord[] = Object.freeze([]);

function blockedCellsFor(plan: TerraformPlan, width: number, height: number, occupiedAt: (cell: CellCoord) => boolean): readonly CellCoord[] {
  const blocked = new Map<string, CellCoord>();
  for (const vertex of plan.affectedVertices) {
    for (const cell of [{ x: vertex.x - 1, z: vertex.z - 1 }, { x: vertex.x, z: vertex.z - 1 }, { x: vertex.x - 1, z: vertex.z }, { x: vertex.x, z: vertex.z }]) {
      if (cell.x < 0 || cell.z < 0 || cell.x >= width || cell.z >= height || !occupiedAt(cell)) continue;
      blocked.set(`${cell.x}:${cell.z}`, cell);
    }
  }
  return Object.freeze([...blocked.values()].map((cell) => Object.freeze({ ...cell })).sort((a, b) => a.z - b.z || a.x - b.x));
}

export function guardTerraformPlanWithOccupancy(plan: TerraformPlan, roads: RoadSnapshot, zones: ZoneSnapshot, buildings: BuildingSnapshot): GuardedTerraformCandidate {
  const blockedRoadCells = blockedCellsFor(plan, roads.width, roads.height, (cell) => roadOccupiedAt(roads, cell));
  const blockedZoneCells = blockedCellsFor(plan, zones.width, zones.height, (cell) => zoneOccupiedAt(zones, cell));
  const blockedBuildingCells = blockedCellsFor(plan, zones.width, zones.height, (cell) => buildingOccupiedAt(buildings, cell));
  const occupancyReason: GameTerraformInvalidReason | null = blockedRoadCells.length > 0 ? 'terraform:road-occupied' : blockedBuildingCells.length > 0 ? 'terraform:building-occupied' : blockedZoneCells.length > 0 ? 'terraform:zone-occupied' : null;
  if (occupancyReason !== null) return Object.freeze({ corePlan: plan, previewPlan: plan.valid ? Object.freeze({ ...plan, valid: false }) : plan, valid: false, invalidReason: occupancyReason, blockedRoadCells, blockedZoneCells, blockedBuildingCells });
  if (!plan.valid) return Object.freeze({ corePlan: plan, previewPlan: plan, valid: false, invalidReason: plan.invalidReason, blockedRoadCells: EMPTY_CELLS, blockedZoneCells: EMPTY_CELLS, blockedBuildingCells: EMPTY_CELLS });
  return Object.freeze({ corePlan: plan, previewPlan: plan, valid: true, invalidReason: null, blockedRoadCells: EMPTY_CELLS, blockedZoneCells: EMPTY_CELLS, blockedBuildingCells: EMPTY_CELLS });
}
