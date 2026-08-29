import type { VertexCoord } from "@web-three-city/world";
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
import {
  TEST_CHUNK_AXIS_COUNT,
  TEST_TERRAIN_PROVENANCE,
  TEST_VERTEX_SIZE,
  createTestWorldSpatialRead,
  testOwnerAxis,
} from "./helpers/world-spatial-fixture";

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

function record(vertex: VertexCoord, value: number): CanonicalVertexRecord {
  return {
    chunkKey:
      testOwnerAxis(vertex.z) * TEST_CHUNK_AXIS_COUNT + testOwnerAxis(vertex.x),
    vertexKey: vertex.z * TEST_VERTEX_SIZE + vertex.x,
    elevation: elevation(value),
  };
}

function createSurfaceRead(
  records: readonly CanonicalVertexRecord[],
  loadedChunkKeys: readonly number[],
  revision = 0,
) {
  const state = createTerrainState({
    provenance: TEST_TERRAIN_PROVENANCE,
    records,
    loadedChunkKeys,
    expectedChunkCount: TEST_CHUNK_AXIS_COUNT * TEST_CHUNK_AXIS_COUNT,
  });

  return createTerrainAuthorityRead({
    state: revision === 0 ? state : { ...state, revision },
    world: createTestWorldSpatialRead(),
    vertexWidth: TEST_VERTEX_SIZE,
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
      [record({ x: 32, z: 0 }, 3), record({ x: 32, z: 1 }, 5)],
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
