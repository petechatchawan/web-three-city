export type TerrainCorner = 'nw' | 'ne' | 'sw' | 'se';
export type TerrainDiagonal = 'sw-ne' | 'nw-se';

export interface TerrainCorners {
  readonly nw: number;
  readonly ne: number;
  readonly sw: number;
  readonly se: number;
}

export const CELL_TRIANGLES = {
  'sw-ne': [
    ['sw', 'se', 'ne'],
    ['sw', 'ne', 'nw'],
  ],
  'nw-se': [
    ['sw', 'se', 'nw'],
    ['se', 'ne', 'nw'],
  ],
} as const satisfies Readonly<Record<TerrainDiagonal, readonly (readonly TerrainCorner[])[]>>;

export function selectTerrainDiagonal(corners: TerrainCorners): TerrainDiagonal {
  const swNeEqual = corners.sw === corners.ne;
  const nwSeEqual = corners.nw === corners.se;

  if (swNeEqual !== nwSeEqual) {
    return swNeEqual ? 'sw-ne' : 'nw-se';
  }

  const swNeDelta = Math.abs(corners.sw - corners.ne);
  const nwSeDelta = Math.abs(corners.nw - corners.se);

  if (swNeDelta < nwSeDelta) return 'sw-ne';
  if (nwSeDelta < swNeDelta) return 'nw-se';
  return 'sw-ne';
}
