import type { ZoneRoadDirection } from '@web-three-city/zone-core';
import { occupiedCellsForBuilding } from './building-footprint.js';
import type {
  BuildingDevelopmentEnvironment,
  BuildingFrontage,
  BuildingInstance,
} from './contracts.js';

const DIRECTION_ORDER: Readonly<Record<ZoneRoadDirection, number>> = Object.freeze({
  north: 0,
  east: 1,
  south: 2,
  west: 3,
});

export function resolveBuildingFrontage(
  instance: BuildingInstance,
  environment: BuildingDevelopmentEnvironment,
): BuildingFrontage | null {
  const candidates: BuildingFrontage[] = [];
  for (const cell of occupiedCellsForBuilding(instance)) {
    const access = environment.roadAccessAt(cell);
    if (access === null) continue;
    candidates.push(
      Object.freeze({
        direction: access.direction,
        distance: access.distance,
        frontageCell: Object.freeze({ x: cell.x, z: cell.z }),
        roadCell: Object.freeze({ x: access.roadCell.x, z: access.roadCell.z }),
      }),
    );
  }
  candidates.sort(
    (first, second) =>
      first.distance - second.distance ||
      DIRECTION_ORDER[first.direction] - DIRECTION_ORDER[second.direction] ||
      first.frontageCell.z - second.frontageCell.z ||
      first.frontageCell.x - second.frontageCell.x ||
      first.roadCell.z - second.roadCell.z ||
      first.roadCell.x - second.roadCell.x,
  );
  return candidates[0] ?? null;
}
