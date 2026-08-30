import type { VertexCoord, WorldSpatialRead } from "@web-three-city/world";
import { BufferAttribute, BufferGeometry } from "three";
import { logicalElevationToMeters } from "../../../domain/elevation";
import {
  TERRAIN_CELL_TRIANGLE_CORNERS,
  type TerrainCellCorner,
} from "../../../domain/surface";
import type { SectorSurfaceSnapshot } from "./read-sector-surface";
import { computePresentationNormal } from "./presentation-normal";
import type {
  RenderSectorCoord,
  RenderSectorLayout,
} from "../topology/render-sector";

export interface SectorGeometryData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint16Array;
}

const POSITION_COMPONENTS = 3;
const NORMAL_COMPONENTS = 3;

function localCornerIndices(
  sw: number,
  vertexAxisCount: number,
): Readonly<Record<TerrainCellCorner, number>> {
  const se = sw + 1;
  const nw = sw + vertexAxisCount;
  const ne = nw + 1;
  return { sw, se, nw, ne };
}

export function buildSectorGeometryData(input: {
  readonly layout: RenderSectorLayout;
  readonly sector: RenderSectorCoord;
  readonly snapshot: SectorSurfaceSnapshot;
  readonly world: WorldSpatialRead;
}): SectorGeometryData {
  if (
    input.snapshot.sector.x !== input.sector.x ||
    input.snapshot.sector.z !== input.sector.z
  ) {
    throw new Error(
      "Sector surface snapshot does not match requested render sector.",
    );
  }

  const vertexAxis = input.layout.vertexAxisCount;
  const vertexCount = vertexAxis * vertexAxis;
  const cellCount = input.layout.cellsPerSector * input.layout.cellsPerSector;
  const trianglesPerCell = Object.keys(TERRAIN_CELL_TRIANGLE_CORNERS).length;
  const triangleVertexCount = 3;
  const positions = new Float32Array(vertexCount * POSITION_COMPONENTS);
  const normals = new Float32Array(vertexCount * NORMAL_COMPONENTS);
  const indices = new Uint16Array(
    cellCount * trianglesPerCell * triangleVertexCount,
  );

  let vertexIndex = 0;
  for (
    let z = input.snapshot.visibleVertices.zStartInclusive;
    z <= input.snapshot.visibleVertices.zEndInclusive;
    z += 1
  ) {
    for (
      let x = input.snapshot.visibleVertices.xStartInclusive;
      x <= input.snapshot.visibleVertices.xEndInclusive;
      x += 1
    ) {
      const vertex: VertexCoord = { x, z };
      const positionOffset = vertexIndex * POSITION_COMPONENTS;
      const normalOffset = vertexIndex * NORMAL_COMPONENTS;
      positions[positionOffset] = x * input.layout.cellSizeMeters;
      positions[positionOffset + 1] = logicalElevationToMeters(
        input.snapshot.elevationAt(vertex),
      );
      positions[positionOffset + 2] = z * input.layout.cellSizeMeters;

      const normal = computePresentationNormal({
        snapshot: input.snapshot,
        world: input.world,
        vertex,
        cellSizeMeters: input.layout.cellSizeMeters,
      });
      normals[normalOffset] = normal.x;
      normals[normalOffset + 1] = normal.y;
      normals[normalOffset + 2] = normal.z;
      vertexIndex += 1;
    }
  }

  let indexOffset = 0;
  for (let localZ = 0; localZ < input.layout.cellsPerSector; localZ += 1) {
    for (let localX = 0; localX < input.layout.cellsPerSector; localX += 1) {
      const sw = localZ * vertexAxis + localX;
      const corners = localCornerIndices(sw, vertexAxis);
      for (const triangleCorners of Object.values(
        TERRAIN_CELL_TRIANGLE_CORNERS,
      )) {
        for (const corner of triangleCorners) {
          indices[indexOffset] = corners[corner];
          indexOffset += 1;
        }
      }
    }
  }

  return Object.freeze({ positions, normals, indices });
}

export function createSectorBufferGeometry(
  data: SectorGeometryData,
): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(data.positions, POSITION_COMPONENTS),
  );
  geometry.setAttribute(
    "normal",
    new BufferAttribute(data.normals, NORMAL_COMPONENTS),
  );
  geometry.setIndex(new BufferAttribute(data.indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
