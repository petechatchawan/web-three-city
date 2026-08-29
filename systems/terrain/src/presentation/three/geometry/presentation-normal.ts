import type {
  CellCoord,
  VertexCoord,
  WorldSpatialRead,
} from "@web-three-city/world";
import { logicalElevationToMeters } from "../../../domain/elevation";
import {
  TERRAIN_CELL_TRIANGLE_CORNERS,
  type TerrainCellCorner,
} from "../../../domain/surface";
import type { SectorSurfaceSnapshot } from "./read-sector-surface";

export interface PresentationNormal {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function sameVertex(left: VertexCoord, right: VertexCoord): boolean {
  return left.x === right.x && left.z === right.z;
}

function cellCornerVertices(
  cell: CellCoord,
): Readonly<Record<TerrainCellCorner, VertexCoord>> {
  return {
    sw: { x: cell.x, z: cell.z },
    se: { x: cell.x + 1, z: cell.z },
    nw: { x: cell.x, z: cell.z + 1 },
    ne: { x: cell.x + 1, z: cell.z + 1 },
  };
}

function point(
  snapshot: SectorSurfaceSnapshot,
  vertex: VertexCoord,
  cellSizeMeters: number,
): readonly [number, number, number] {
  return [
    vertex.x * cellSizeMeters,
    logicalElevationToMeters(snapshot.elevationAt(vertex)),
    vertex.z * cellSizeMeters,
  ];
}

function accumulateFaceNormal(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  c: readonly [number, number, number],
): readonly [number, number, number] {
  const abX = b[0] - a[0];
  const abY = b[1] - a[1];
  const abZ = b[2] - a[2];
  const acX = c[0] - a[0];
  const acY = c[1] - a[1];
  const acZ = c[2] - a[2];

  let x = abY * acZ - abZ * acY;
  let y = abZ * acX - abX * acZ;
  let z = abX * acY - abY * acX;

  if (y < 0) {
    x = -x;
    y = -y;
    z = -z;
  }

  return [x, y, z];
}

export function computePresentationNormal(input: {
  readonly snapshot: SectorSurfaceSnapshot;
  readonly world: WorldSpatialRead;
  readonly vertex: VertexCoord;
  readonly cellSizeMeters: number;
}): PresentationNormal {
  const incident = input.world.incidentCells(input.vertex);
  if (incident.status !== "success") {
    throw new Error(
      `World rejected incident Cells for Terrain presentation vertex ${input.vertex.x},${input.vertex.z}.`,
    );
  }

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;

  for (const cell of incident.value) {
    const corners = cellCornerVertices(cell);
    for (const triangleCorners of Object.values(
      TERRAIN_CELL_TRIANGLE_CORNERS,
    )) {
      const vertices = triangleCorners.map((corner) => corners[corner]);
      if (!vertices.some((vertex) => sameVertex(vertex, input.vertex)))
        continue;

      const first = vertices[0];
      const second = vertices[1];
      const third = vertices[2];
      if (first === undefined || second === undefined || third === undefined) {
        throw new Error("Terrain triangle corner invariant failed.");
      }

      const [faceX, faceY, faceZ] = accumulateFaceNormal(
        point(input.snapshot, first, input.cellSizeMeters),
        point(input.snapshot, second, input.cellSizeMeters),
        point(input.snapshot, third, input.cellSizeMeters),
      );
      sumX += faceX;
      sumY += faceY;
      sumZ += faceZ;
    }
  }

  const length = Math.hypot(sumX, sumY, sumZ);
  if (length === 0) {
    throw new Error(
      `Presentation normal is degenerate at Terrain vertex ${input.vertex.x},${input.vertex.z}.`,
    );
  }

  return Object.freeze({
    x: sumX / length,
    y: sumY / length,
    z: sumZ / length,
  });
}
