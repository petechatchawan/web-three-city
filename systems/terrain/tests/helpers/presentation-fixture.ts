import type {
  CellCoord,
  CellRect,
  MapDefinitionRead,
  VertexCoord,
  WorldSpatialRead,
} from "@web-three-city/world";
import type {
  CellSurfaceRead,
  TerrainAuthorityRead,
  TerrainQueryResult,
  TerrainRevision,
} from "../../src/contracts/terrain-read";
import {
  parseLogicalElevation,
  type LogicalElevation,
} from "../../src/domain/elevation";
import { Q16_ONE, evaluateSurface } from "../../src/domain/surface";

export const TEST_MAP_DEFINITION: Pick<
  MapDefinitionRead,
  "widthCells" | "heightCells" | "cellSizeMeters"
> = {
  widthCells: 512,
  heightCells: 512,
  cellSizeMeters: 8,
};

const TEST_CHUNK_CELLS = 32;

function worldRejected() {
  return { status: "rejected", code: "WORLD_COORD_OUT_OF_BOUNDS" } as const;
}

function isValidCell(cell: CellCoord): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.z) &&
    cell.x >= 0 &&
    cell.z >= 0 &&
    cell.x < TEST_MAP_DEFINITION.widthCells &&
    cell.z < TEST_MAP_DEFINITION.heightCells
  );
}

function isValidVertex(vertex: VertexCoord): boolean {
  return (
    Number.isInteger(vertex.x) &&
    Number.isInteger(vertex.z) &&
    vertex.x >= 0 &&
    vertex.z >= 0 &&
    vertex.x <= TEST_MAP_DEFINITION.widthCells &&
    vertex.z <= TEST_MAP_DEFINITION.heightCells
  );
}

function ownerAxis(axis: number): number {
  return axis === 0
    ? 0
    : Math.min(
        Math.floor((axis - 1) / TEST_CHUNK_CELLS),
        TEST_MAP_DEFINITION.widthCells / TEST_CHUNK_CELLS - 1,
      );
}

function compareCell(left: CellCoord, right: CellCoord): number {
  return left.z - right.z || left.x - right.x;
}

export function createPresentationWorldSpatialRead(): WorldSpatialRead {
  return {
    cellToChunk(cell) {
      if (!isValidCell(cell)) return worldRejected();
      return {
        status: "success",
        value: {
          chunk: {
            x: Math.floor(cell.x / TEST_CHUNK_CELLS),
            z: Math.floor(cell.z / TEST_CHUNK_CELLS),
          },
          local: {
            x: cell.x % TEST_CHUNK_CELLS,
            z: cell.z % TEST_CHUNK_CELLS,
          },
        },
      };
    },
    ownerChunk(vertex) {
      if (!isValidVertex(vertex)) return worldRejected();
      return {
        status: "success",
        value: { x: ownerAxis(vertex.x), z: ownerAxis(vertex.z) },
      };
    },
    incidentCells(vertex) {
      if (!isValidVertex(vertex)) return worldRejected();
      const cells = [
        { x: vertex.x - 1, z: vertex.z - 1 },
        { x: vertex.x, z: vertex.z - 1 },
        { x: vertex.x - 1, z: vertex.z },
        { x: vertex.x, z: vertex.z },
      ].filter(isValidCell);
      return { status: "success", value: cells.sort(compareCell) };
    },
    touchingChunks(vertex) {
      if (!isValidVertex(vertex)) return worldRejected();
      const chunks = new Map<string, { x: number; z: number }>();
      const incident = this.incidentCells(vertex);
      if (incident.status !== "success") return incident;
      for (const cell of incident.value) {
        const mapped = this.cellToChunk(cell);
        if (mapped.status !== "success") continue;
        const chunk = mapped.value.chunk;
        chunks.set(`${chunk.z}:${chunk.x}`, chunk);
      }
      if (chunks.size === 0) {
        const owner = this.ownerChunk(vertex);
        if (owner.status !== "success") return owner;
        chunks.set(`${owner.value.z}:${owner.value.x}`, owner.value);
      }
      return {
        status: "success",
        value: [...chunks.values()].sort(
          (left, right) => left.z - right.z || left.x - right.x,
        ),
      };
    },
    cardinalNeighbors(cell) {
      if (!isValidCell(cell)) return worldRejected();
      const candidates = [
        { x: cell.x, z: cell.z + 1 },
        { x: cell.x + 1, z: cell.z },
        { x: cell.x, z: cell.z - 1 },
        { x: cell.x - 1, z: cell.z },
      ].filter(isValidCell);
      return { status: "success", value: candidates };
    },
    intersectingChunks(rect: CellRect) {
      if (
        !Number.isInteger(rect.xStartInclusive) ||
        !Number.isInteger(rect.zStartInclusive) ||
        !Number.isInteger(rect.xEndExclusive) ||
        !Number.isInteger(rect.zEndExclusive) ||
        rect.xStartInclusive < 0 ||
        rect.zStartInclusive < 0 ||
        rect.xEndExclusive > TEST_MAP_DEFINITION.widthCells ||
        rect.zEndExclusive > TEST_MAP_DEFINITION.heightCells ||
        rect.xStartInclusive >= rect.xEndExclusive ||
        rect.zStartInclusive >= rect.zEndExclusive
      ) {
        return worldRejected();
      }
      const chunks = [];
      for (
        let z = Math.floor(rect.zStartInclusive / TEST_CHUNK_CELLS);
        z <= Math.floor((rect.zEndExclusive - 1) / TEST_CHUNK_CELLS);
        z += 1
      ) {
        for (
          let x = Math.floor(rect.xStartInclusive / TEST_CHUNK_CELLS);
          x <= Math.floor((rect.xEndExclusive - 1) / TEST_CHUNK_CELLS);
          x += 1
        ) {
          chunks.push({ x, z });
        }
      }
      return { status: "success", value: chunks };
    },
    worldPositionToCell(position) {
      if (
        !Number.isFinite(position.x) ||
        !Number.isFinite(position.z) ||
        position.x < 0 ||
        position.z < 0 ||
        position.x >=
          TEST_MAP_DEFINITION.widthCells * TEST_MAP_DEFINITION.cellSizeMeters ||
        position.z >=
          TEST_MAP_DEFINITION.heightCells * TEST_MAP_DEFINITION.cellSizeMeters
      ) {
        return worldRejected();
      }
      return {
        status: "success",
        value: {
          x: Math.floor(position.x / TEST_MAP_DEFINITION.cellSizeMeters),
          z: Math.floor(position.z / TEST_MAP_DEFINITION.cellSizeMeters),
        },
      };
    },
    cellBounds(cell) {
      if (!isValidCell(cell)) return worldRejected();
      const xMinInclusive = cell.x * TEST_MAP_DEFINITION.cellSizeMeters;
      const zMinInclusive = cell.z * TEST_MAP_DEFINITION.cellSizeMeters;
      return {
        status: "success",
        value: {
          xMinInclusive,
          zMinInclusive,
          xMaxExclusive: xMinInclusive + TEST_MAP_DEFINITION.cellSizeMeters,
          zMaxExclusive: zMinInclusive + TEST_MAP_DEFINITION.cellSizeMeters,
        },
      };
    },
    regionAtCell() {
      return worldRejected();
    },
    adjacentRegions() {
      return worldRejected();
    },
  };
}

function parseTestElevation(value: number): LogicalElevation {
  const parsed = parseLogicalElevation(value);
  if (parsed.status !== "success") {
    throw new Error(`Invalid test elevation ${value}.`);
  }
  return parsed.value;
}

export function createFunctionalTerrainRead(
  elevation: (x: number, z: number) => number,
  revision: TerrainRevision = 0,
  onElevationRead?: (vertex: VertexCoord) => void,
): TerrainAuthorityRead {
  const elevationAt = (
    vertex: VertexCoord,
  ): TerrainQueryResult<LogicalElevation> => {
    if (!isValidVertex(vertex)) {
      return {
        status: "out-of-bounds",
        code: "TERRAIN_QUERY_OUT_OF_BOUNDS",
      };
    }
    onElevationRead?.(vertex);
    return {
      status: "success",
      value: parseTestElevation(elevation(vertex.x, vertex.z)),
    };
  };

  const cellSurface = (
    cell: CellCoord,
  ): TerrainQueryResult<CellSurfaceRead> => {
    if (!isValidCell(cell)) {
      return {
        status: "out-of-bounds",
        code: "TERRAIN_QUERY_OUT_OF_BOUNDS",
      };
    }
    const sw = elevationAt({ x: cell.x, z: cell.z });
    const se = elevationAt({ x: cell.x + 1, z: cell.z });
    const nw = elevationAt({ x: cell.x, z: cell.z + 1 });
    const ne = elevationAt({ x: cell.x + 1, z: cell.z + 1 });
    if (sw.status !== "success") return sw;
    if (se.status !== "success") return se;
    if (nw.status !== "success") return nw;
    if (ne.status !== "success") return ne;
    return {
      status: "success",
      value: {
        cell,
        sw: sw.value,
        se: se.value,
        nw: nw.value,
        ne: ne.value,
        revision,
      },
    };
  };

  return {
    revision: () => revision,
    completeness: () => "full",
    elevationAt,
    cellSurface,
    sampleSurface(cell, uQ16, vQ16) {
      if (
        !Number.isInteger(uQ16) ||
        !Number.isInteger(vQ16) ||
        uQ16 < 0 ||
        vQ16 < 0 ||
        uQ16 > Q16_ONE ||
        vQ16 > Q16_ONE
      ) {
        return {
          status: "out-of-bounds",
          code: "TERRAIN_QUERY_OUT_OF_BOUNDS",
        };
      }
      const surface = cellSurface(cell);
      if (surface.status !== "success") return surface;
      return {
        status: "success",
        value: {
          ...evaluateSurface(surface.value, uQ16, vQ16),
          revision,
        },
      };
    },
  };
}
