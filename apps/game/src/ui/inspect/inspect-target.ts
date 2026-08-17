import { buildingAtCell } from '@web-three-city/building-core';
import { roadOccupiedAt } from '@web-three-city/road-core';
import type { CellCoord } from '@web-three-city/world-core';
import { zoneOccupiedAt } from '@web-three-city/zone-core';
import type { CommittedWorld } from '../../application/committed-world.js';

export type CellInspectTarget = Readonly<{
  readonly kind: 'building' | 'road' | 'zone' | 'terrain';
  readonly cell: CellCoord;
}>;

export type CitizenInspectTarget = Readonly<{
  readonly kind: 'citizen';
  readonly citizenId: string;
  readonly tripId: string | null;
}>;

export type VehicleInspectTarget = Readonly<{
  readonly kind: 'vehicle';
  readonly citizenId: string;
  readonly tripId: string;
}>;

export type InspectTarget = CellInspectTarget | CitizenInspectTarget | VehicleInspectTarget;

export function pickInspectTarget(world: CommittedWorld, cell: CellCoord): CellInspectTarget {
  const frozenCell = Object.freeze({ ...cell });
  if (buildingAtCell(world.buildings, cell) !== null) {
    return Object.freeze({ kind: 'building', cell: frozenCell });
  }
  if (roadOccupiedAt(world.roads, cell)) return Object.freeze({ kind: 'road', cell: frozenCell });
  if (zoneOccupiedAt(world.zones, cell)) return Object.freeze({ kind: 'zone', cell: frozenCell });
  return Object.freeze({ kind: 'terrain', cell: frozenCell });
}
