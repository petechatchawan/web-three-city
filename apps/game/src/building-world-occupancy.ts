import { buildingOccupiedAt, type BuildingSnapshot } from '@web-three-city/building-core';
import type { ZoneWorldOccupancy } from './zone-placement-environment.js';

export function createBuildingWorldOccupancy(buildings: BuildingSnapshot): ZoneWorldOccupancy {
  return Object.freeze({
    revision: buildings.revision,
    isBlocked: (cell) => buildingOccupiedAt(buildings, cell),
  });
}
