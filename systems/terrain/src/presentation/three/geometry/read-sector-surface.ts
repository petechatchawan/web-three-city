import type { VertexCoord } from "@web-three-city/world";
import type {
  TerrainAuthorityRead,
  TerrainRevision,
} from "../../../contracts/terrain-read";
import type { LogicalElevation } from "../../../domain/elevation";
import {
  renderSectorCellBounds,
  type RenderSectorCoord,
  type RenderSectorLayout,
} from "../topology/render-sector";

export interface VertexBounds {
  readonly xStartInclusive: number;
  readonly zStartInclusive: number;
  readonly xEndInclusive: number;
  readonly zEndInclusive: number;
}

export interface SectorSurfaceSnapshot {
  readonly sector: RenderSectorCoord;
  readonly revision: TerrainRevision;
  readonly visibleVertices: VertexBounds;
  readonly haloVertices: VertexBounds;
  elevationAt(vertex: VertexCoord): LogicalElevation;
}

function freezeBounds(bounds: VertexBounds): VertexBounds {
  return Object.freeze(bounds);
}

function contains(bounds: VertexBounds, vertex: VertexCoord): boolean {
  return (
    Number.isInteger(vertex.x) &&
    Number.isInteger(vertex.z) &&
    vertex.x >= bounds.xStartInclusive &&
    vertex.x <= bounds.xEndInclusive &&
    vertex.z >= bounds.zStartInclusive &&
    vertex.z <= bounds.zEndInclusive
  );
}

export function readSectorSurface(input: {
  readonly layout: RenderSectorLayout;
  readonly sector: RenderSectorCoord;
  readonly terrain: TerrainAuthorityRead;
}): SectorSurfaceSnapshot {
  const cellBounds = renderSectorCellBounds(input.layout, input.sector);
  const visibleVertices = freezeBounds({
    xStartInclusive: cellBounds.xStartInclusive,
    zStartInclusive: cellBounds.zStartInclusive,
    xEndInclusive: cellBounds.xEndExclusive,
    zEndInclusive: cellBounds.zEndExclusive,
  });
  const haloVertices = freezeBounds({
    xStartInclusive: Math.max(0, visibleVertices.xStartInclusive - 1),
    zStartInclusive: Math.max(0, visibleVertices.zStartInclusive - 1),
    xEndInclusive: Math.min(
      input.layout.widthCells,
      visibleVertices.xEndInclusive + 1,
    ),
    zEndInclusive: Math.min(
      input.layout.heightCells,
      visibleVertices.zEndInclusive + 1,
    ),
  });

  const width = haloVertices.xEndInclusive - haloVertices.xStartInclusive + 1;
  const height = haloVertices.zEndInclusive - haloVertices.zStartInclusive + 1;
  const values = new Int32Array(width * height);
  const beforeRevision = input.terrain.revision();

  for (
    let z = haloVertices.zStartInclusive;
    z <= haloVertices.zEndInclusive;
    z += 1
  ) {
    for (
      let x = haloVertices.xStartInclusive;
      x <= haloVertices.xEndInclusive;
      x += 1
    ) {
      const result = input.terrain.elevationAt({ x, z });
      if (result.status === "unavailable") {
        throw new Error(
          `Terrain authority unavailable while capturing render sector ${input.sector.x},${input.sector.z}.`,
        );
      }
      if (result.status !== "success") {
        throw new Error(
          `Terrain authority rejected a valid render-sector vertex ${x},${z}.`,
        );
      }
      const localX = x - haloVertices.xStartInclusive;
      const localZ = z - haloVertices.zStartInclusive;
      values[localZ * width + localX] = result.value;
    }
  }

  const afterRevision = input.terrain.revision();
  if (afterRevision !== beforeRevision) {
    throw new Error(
      `Terrain revision changed during sector surface capture: ${beforeRevision} -> ${afterRevision}.`,
    );
  }

  const elevationAt = (vertex: VertexCoord): LogicalElevation => {
    if (!contains(haloVertices, vertex)) {
      throw new Error(
        `Vertex ${vertex.x},${vertex.z} is outside the captured sector surface.`,
      );
    }
    const localX = vertex.x - haloVertices.xStartInclusive;
    const localZ = vertex.z - haloVertices.zStartInclusive;
    const value = values[localZ * width + localX];
    if (value === undefined) {
      throw new Error("Captured sector surface storage invariant failed.");
    }
    return value as LogicalElevation;
  };

  return Object.freeze({
    sector: Object.freeze({ ...input.sector }),
    revision: beforeRevision,
    visibleVertices,
    haloVertices,
    elevationAt,
  });
}
