import { buildingAtCell } from '@web-three-city/building-core';
import { roadOccupiedAt } from '@web-three-city/road-core';
import type { CellCoord } from '@web-three-city/world-core';
import { zoneOccupiedAt } from '@web-three-city/zone-core';
import type { CommittedWorld } from '../../application/committed-world.js';

export interface InspectTarget {
  readonly kind: 'building' | 'road' | 'zone' | 'terrain';
  readonly cell: CellCoord;
}

export function pickInspectTarget(world: CommittedWorld, cell: CellCoord): InspectTarget {
  const frozenCell = Object.freeze({ ...cell });
  if (buildingAtCell(world.buildings, cell) !== null)
    return Object.freeze({ kind: 'building', cell: frozenCell });
  if (roadOccupiedAt(world.roads, cell)) return Object.freeze({ kind: 'road', cell: frozenCell });
  if (zoneOccupiedAt(world.zones, cell)) return Object.freeze({ kind: 'zone', cell: frozenCell });
  return Object.freeze({ kind: 'terrain', cell: frozenCell });
}
