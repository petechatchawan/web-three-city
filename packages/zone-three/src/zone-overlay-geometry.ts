import type { TerrainCellSurfaceProfile } from '@web-three-city/terrain-core';
import type { CellCoord, WorldConfig } from '@web-three-city/world-core';
import {
  EMPTY_ZONE_CODE,
  zoneDefinitionCodeAt,
  type ZoneSnapshot,
} from '@web-three-city/zone-core';
import type { ZoneMeshBounds, ZoneMeshData, ZoneMeshGroup } from './zone-mesh-data.js';

export type ZoneSurfaceAt = (cell: CellCoord) => TerrainCellSurfaceProfile;

const INSET_RATIO = 0.08;
const SURFACE_OFFSET = 0.03;

function emptyMesh(): ZoneMeshData {
  return Object.freeze({
    positions: new Float32Array(),
    indices: new Uint32Array(),
    groups: Object.freeze([]),
    cellCount: 0,
    bounds: null,
  });
}

function extendBounds(
  bounds: ZoneMeshBounds | null,
  minX: number,
  maxX: number,
  y: number,
  minZ: number,
  maxZ: number,
): ZoneMeshBounds {
  if (bounds === null) {
    return { minX, maxX, minY: y, maxY: y, minZ, maxZ };
  }
  return {
    minX: Math.min(bounds.minX, minX),
    maxX: Math.max(bounds.maxX, maxX),
    minY: Math.min(bounds.minY, y),
    maxY: Math.max(bounds.maxY, y),
    minZ: Math.min(bounds.minZ, minZ),
    maxZ: Math.max(bounds.maxZ, maxZ),
  };
}

export function buildZoneOverlayMesh(
  zones: ZoneSnapshot,
  cells: readonly CellCoord[],
  surfaceAt: ZoneSurfaceAt,
  config: WorldConfig,
): ZoneMeshData {
  if (cells.length === 0) return emptyMesh();

  const positions: number[] = [];
  const indices: number[] = [];
  const groups: ZoneMeshGroup[] = [];
  const seen = new Set<string>();
  let cellCount = 0;
  let bounds: ZoneMeshBounds | null = null;

  for (const cell of cells) {
    const key = `${cell.x}:${cell.z}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const code = zoneDefinitionCodeAt(zones, cell);
    if (code === EMPTY_ZONE_CODE) continue;
    const surface = surfaceAt(cell);
    if (surface.shape !== 'flat' || surface.minimumLevel !== surface.maximumLevel) {
      throw new Error('zone-geometry:unsupported-surface');
    }

    const inset = config.cellSize * INSET_RATIO;
    const minX = (cell.x - config.mapWidth / 2) * config.cellSize + inset;
    const maxX = (cell.x - config.mapWidth / 2 + 1) * config.cellSize - inset;
    const minZ = (cell.z - config.mapHeight / 2) * config.cellSize + inset;
    const maxZ = (cell.z - config.mapHeight / 2 + 1) * config.cellSize - inset;
    const y = surface.minimumLevel * config.heightStep + SURFACE_OFFSET;
    if (![minX, maxX, minZ, maxZ, y].every(Number.isFinite)) {
      throw new Error('zone-geometry:non-finite');
    }

    const vertexOffset = positions.length / 3;
    positions.push(minX, y, minZ, maxX, y, minZ, minX, y, maxZ, maxX, y, maxZ);
    const indexStart = indices.length;
    indices.push(
      vertexOffset,
      vertexOffset + 2,
      vertexOffset + 1,
      vertexOffset + 1,
      vertexOffset + 2,
      vertexOffset + 3,
    );
    groups.push(Object.freeze({ start: indexStart, count: 6, materialIndex: Number(code) - 1 }));
    bounds = extendBounds(bounds, minX, maxX, y, minZ, maxZ);
    cellCount += 1;
  }

  if (cellCount === 0) return emptyMesh();
  return Object.freeze({
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    groups: Object.freeze(groups),
    cellCount,
    bounds: Object.freeze(bounds!),
  });
}
