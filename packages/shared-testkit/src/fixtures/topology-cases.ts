import type { TerrainCorners, TerrainDiagonal } from '@web-three-city/terrain-core';

export interface TopologyCase {
  readonly id: string;
  readonly corners: TerrainCorners;
  readonly expected: TerrainDiagonal;
}

export const TOPOLOGY_CASES: readonly TopologyCase[] = Object.freeze([
  { id: 'sole-equal-sw-ne', corners: { nw: 0, ne: 1, sw: 1, se: 2 }, expected: 'sw-ne' },
  { id: 'sole-equal-nw-se', corners: { nw: 2, ne: 1, sw: 0, se: 2 }, expected: 'nw-se' },
  { id: 'both-equal-ridge', corners: { nw: 1, ne: 0, sw: 0, se: 1 }, expected: 'sw-ne' },
  { id: 'both-equal-valley', corners: { nw: 0, ne: 1, sw: 1, se: 0 }, expected: 'sw-ne' },
  { id: 'smaller-nw-se', corners: { nw: 0, ne: 4, sw: 1, se: 2 }, expected: 'nw-se' },
  { id: 'equal-delta-tie', corners: { nw: 0, ne: 3, sw: 1, se: 2 }, expected: 'sw-ne' },
]);
