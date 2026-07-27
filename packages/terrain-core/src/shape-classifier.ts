import type { TerrainCorners } from './topology.js';

export type TerrainShape =
  | 'flat'
  | 'ramp-north'
  | 'ramp-south'
  | 'ramp-east'
  | 'ramp-west'
  | 'single-corner-high-nw'
  | 'single-corner-high-ne'
  | 'single-corner-high-sw'
  | 'single-corner-high-se'
  | 'single-corner-low-nw'
  | 'single-corner-low-ne'
  | 'single-corner-low-sw'
  | 'single-corner-low-se'
  | 'diagonal-ridge'
  | 'diagonal-valley'
  | 'saddle-or-twist'
  | 'severe-delta';

const SIGNATURE_TO_SHAPE = new Map<string, TerrainShape>([
  ['0,0,0,0', 'flat'],
  ['1,1,0,0', 'ramp-north'],
  ['0,0,1,1', 'ramp-south'],
  ['0,1,0,1', 'ramp-east'],
  ['1,0,1,0', 'ramp-west'],
  ['1,0,0,0', 'single-corner-high-nw'],
  ['0,1,0,0', 'single-corner-high-ne'],
  ['0,0,1,0', 'single-corner-high-sw'],
  ['0,0,0,1', 'single-corner-high-se'],
  ['0,1,1,1', 'single-corner-low-nw'],
  ['1,0,1,1', 'single-corner-low-ne'],
  ['1,1,0,1', 'single-corner-low-sw'],
  ['1,1,1,0', 'single-corner-low-se'],
  ['1,0,0,1', 'diagonal-ridge'],
  ['0,1,1,0', 'diagonal-valley'],
]);

export function normalizeTerrainCorners(corners: TerrainCorners): TerrainCorners {
  const minimum = Math.min(corners.nw, corners.ne, corners.sw, corners.se);
  return {
    nw: corners.nw - minimum,
    ne: corners.ne - minimum,
    sw: corners.sw - minimum,
    se: corners.se - minimum,
  };
}

export function classifyTerrainShape(corners: TerrainCorners): TerrainShape {
  const normalized = normalizeTerrainCorners(corners);
  const range = Math.max(normalized.nw, normalized.ne, normalized.sw, normalized.se);
  if (range > 1) return 'severe-delta';

  const signature = `${normalized.nw},${normalized.ne},${normalized.sw},${normalized.se}`;
  return SIGNATURE_TO_SHAPE.get(signature) ?? 'saddle-or-twist';
}
