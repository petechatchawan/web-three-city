import type {
  CellCoord,
  VertexCoord,
  WorldSpatialRead,
} from "@web-three-city/world";
import { describe, expect, it } from "vitest";
import { createTerrainAuthorityRead } from "../src/application/terrain-read";
import {
  createTerrainState,
  type CanonicalVertexRecord,
} from "../src/domain/terrain-state";
import {
  Q16_ONE,
  evaluateSurface,
  type CellCorners,
} from "../src/domain/surface";
import { parseLogicalElevation } from "../src/index";

const VERTEX_SIZE = 513;
const CELL_SIZE = 512;
const CHUNK_SIZE = 32;
const CHUNK_AXIS_COUNT = 16;

const PROVENANCE = {
  mapDefinitionId: "web-three-city-production",
  generationProfileId: "balanced-temperate-generation",
  generationProfileVersion: 2,
  selectedSeed64: "0x5EED5EED5EED5EED",
} as const;

function elevation(value: number) {
  const parsed = parseLogicalElevation(value);
  if (parsed.status !== "success") {
    throw new Error(`invalid test elevation ${value}`);
  }
  return parsed.value;
}

function corners(sw: number, se: number, nw: number, ne: number): CellCorners {
  return {
    sw: elevation(sw),
    se: elevation(se),
    nw: elevation(nw),
    ne: elevation(ne),
  };
}

function ownerAxis(axis: number): number {
  return axis === 0
    ? 0
    : Math.min(
        Math.floor((axis - 1) / CHUNK_SIZE),
        CHUNK_AXIS_COUNT - 1,
      );
}

function worldRejection() {
  return { status: "rejected", code: "WORLD_COORD_OUT_OF_BOUNDS" } as const;
}

function createWorldSpatialRead(): WorldSpatialRead {
  return {
    cellToChunk(cell: CellCoord) {
      if (
        !Number.isInteger(cell.x) ||
        !Number.isInteger(cell.z) ||
        cell.x < 0 ||
        cell.z < 0 ||
        cell.x >= CELL_SIZE ||
        cell.z >= CELL_SIZE
      ) {
        return worldRejection();
      }
      return {
        status: "success",
        value: {
          chunk: {
            x: Math.floor(cell.x / CHUNK_SIZE),
            z: Math.floor(cell.z / CHUNK_SIZE),
          },
          local: {
            x: cell.x % CHUNK_SIZE,
            z: cell.z % CHUNK_SIZE,
          },
        },
      };
    },
    ownerChunk(vertex: VertexCoord) {
      if (
        !Number.isInteger(vertex.x) ||
        !Number.isInteger(vertex.z) ||
        vertex.x < 0 ||
        vertex.z < 0 ||
        vertex.x >= VERTEX_SIZE ||
        vertex.z >= VERTEX_SIZE
      ) {
        return worldRejection();
      }
      return {
        status: "success",
        value: { x: ownerAxis(vertex.x), z: ownerAxis(vertex.z) },
      };
    },
    incidentCells() {
      return worldRejection();
    },
    touchingChunks() {
      return worldRejection();
    },
    cardinalNeighbors() {
      return worldRejection();
    },
    intersectingChunks() {
      return worldRejection();
    },
    worldPositionToCell() {
      return worldRejection();
    },
    cellBounds(cell: CellCoord) {
      if (
        !Number.isInteger(cell.x) ||
        !Number.isInteger(cell.z) ||
        cell.x < 0 ||
        cell.z < 0 ||
        cell.x >= CELL_SIZE ||
        cell.z >= CELL_SIZE
      ) {
        return worldRejection();
      }
      return {
        status: "success",
        value: {
          xMinInclusive: cell.x * 8,
          zMinInclusive: cell.z * 8,
          xMaxExclusive: (cell.x + 1) * 8,
          zMaxExclusive: (cell.z + 1) * 8,
        },
      };
    },
    regionAtCell() {
      return worldRejection();
    },
    adjacentRegions() {
      return worldRejection();
    },
  };
}

function record(vertex: VertexCoord, value: number): CanonicalVertexRecord {
  return {
    chunkKey:
      ownerAxis(vertex.z) * CHUNK_AXIS_COUNT + ownerAxis(vertex.x),
    vertexKey: vertex.z * VERTEX_SIZE + vertex.x,
    elevation: elevation(value),
  };
}

function createSurfaceRead(
  records: readonly CanonicalVertexRecord[],
  loadedChunkKeys: readonly number[],
  revision = 0,
) {
  const state = createTerrainState({
    provenance: PROVENANCE,
    records,
    loadedChunkKeys,
    expectedChunkCount: CHUNK_AXIS_COUNT * CHUNK_AXIS_COUNT,
  });

  return createTerrainAuthorityRead({
    state: revision === 0 ? state : { ...state, revision },
    world: createWorldSpatialRead(),
    vertexWidth: VERTEX_SIZE,
  });
}

function sampleCellRead(revision = 0) {
  return createSurfaceRead(
    [
      record({ x: 0, z: 0 }, 0),
      record({ x: 1, z: 0 }, 8),
      record({ x: 0, z: 1 }, 4),
      record({ x: 1, z: 1 }, 20),
    ],
    [0],
    revision,
  );
}

describe("exact Terrain surface", () => {
  const sampleCorners = corners(0, 8, 4, 20);

  it("uses the frozen NW→SE triangle identity and diagonal tie rule", () => {
    expect(evaluateSurface(sampleCorners, 0, 0)).toMatchObject({
      triangle: "SW_TRIANGLE",
      heightQ16: 0,
    });
    expect(evaluateSurface(sampleCorners, Q16_ONE, Q16_ONE)).toMatchObject({
      triangle: "NE_TRIANGLE",
      heightQ16: 20 * Q16_ONE,
    });
    expect(evaluateSurface(sampleCorners, 32768, 32767).triangle).toBe(
      "SW_TRIANGLE",
    );
    expect(evaluateSurface(sampleCorners, 32768, 32768).triangle).toBe(
      "SW_TRIANGLE",
    );
    expect(evaluateSurface(sampleCorners, 32768, 32769).triangle).toBe(
      "NE_TRIANGLE",
    );
  });

  it("returns exact frozen Q16 heights and slope facts", () => {
    expect(evaluateSurface(sampleCorners, 32768, 32768)).toEqual({
      triangle: "SW_TRIANGLE",
      heightQ16: 6 * Q16_ONE,
      riseX: 8,
      riseZ: 4,
      runUnits: 32,
    });
    expect(evaluateSurface(sampleCorners, 49152, 49152)).toEqual({
      triangle: "NE_TRIANGLE",
      heightQ16: 13 * Q16_ONE,
      riseX: 16,
      riseZ: 12,
      runUnits: 32,
    });
  });

  it("makes both triangle equations exactly continuous on the diagonal", () => {
    for (const u of [0, 8192, 16384, 32768, 49152, 65536]) {
      const v = Q16_ONE - u;
      const sample = evaluateSurface(sampleCorners, u, v);
      const swFormula = sampleCorners.se * u + sampleCorners.nw * v;
      const neFormula =
        sampleCorners.nw * (Q16_ONE - u) + sampleCorners.se * (Q16_ONE - v);

      expect(sample.triangle).toBe("SW_TRIANGLE");
      expect(swFormula).toBe(neFormula);
      expect(sample.heightQ16).toBe(swFormula);
    }
  });

  it("is exactly continuous across a shared Cell edge", () => {
    const westCell = corners(2, 10, 6, 14);
    const eastCell = corners(10, 18, 14, 22);

    for (const v of [0, 8192, 32768, 49152, 65536]) {
      const westEdge = evaluateSurface(westCell, Q16_ONE, v);
      const eastEdge = evaluateSurface(eastCell, 0, v);
      expect(eastEdge.heightQ16).toBe(westEdge.heightQ16);
    }
  });

  it("returns canonical Cell corners and propagates the Terrain revision", () => {
    const read = sampleCellRead(7);

    expect(read.cellSurface({ x: 0, z: 0 })).toEqual({
      status: "success",
      value: {
        cell: { x: 0, z: 0 },
        sw: 0,
        se: 8,
        nw: 4,
        ne: 20,
        revision: 7,
      },
    });
  });

  it("samples the exact semantic triangle surface and propagates revision", () => {
    const read = sampleCellRead(7);

    expect(read.sampleSurface({ x: 0, z: 0 }, 32768, 32768)).toEqual({
      status: "success",
      value: {
        triangle: "SW_TRIANGLE",
        heightQ16: 6 * Q16_ONE,
        riseX: 8,
        riseZ: 4,
        runUnits: 32,
        revision: 7,
      },
    });
  });

  it("returns unavailable when any required Cell corner authority is absent", () => {
    const read = createSurfaceRead(
      [
        record({ x: 32, z: 0 }, 3),
        record({ x: 32, z: 1 }, 5),
      ],
      [0],
    );

    expect(read.cellSurface({ x: 32, z: 0 })).toEqual({
      status: "unavailable",
      code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE",
      chunk: { x: 1, z: 0 },
    });
    expect(read.sampleSurface({ x: 32, z: 0 }, 1000, 2000)).toEqual({
      status: "unavailable",
      code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE",
      chunk: { x: 1, z: 0 },
    });
  });

  it("distinguishes invalid Cell/Q16 coordinates as out-of-bounds", () => {
    const read = sampleCellRead();
    const outOfBounds = {
      status: "out-of-bounds",
      code: "TERRAIN_QUERY_OUT_OF_BOUNDS",
    } as const;

    expect(read.cellSurface({ x: 512, z: 0 })).toEqual(outOfBounds);
    expect(read.sampleSurface({ x: 0, z: 0 }, -1, 0)).toEqual(outOfBounds);
    expect(read.sampleSurface({ x: 0, z: 0 }, Q16_ONE + 1, 0)).toEqual(
      outOfBounds,
    );
    expect(read.sampleSurface({ x: 0, z: 0 }, 0, -1)).toEqual(outOfBounds);
    expect(read.sampleSurface({ x: 0, z: 0 }, 0, Q16_ONE + 1)).toEqual(
      outOfBounds,
    );
  });
});
