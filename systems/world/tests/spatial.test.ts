import { describe, expect, it } from "vitest";
import { createGridSpatialRead } from "../src/application/world-spatial-read";
import type { ChunkCoord, VertexCoord } from "../src/index";

const spatial = createGridSpatialRead();

function expectSuccess<T>(result: { readonly status: string; readonly value?: T }): T {
  expect(result.status).toBe("success");
  if (result.status !== "success" || result.value === undefined) {
    throw new Error("expected successful World spatial result");
  }
  return result.value;
}

function chunkKey(chunk: ChunkCoord): string {
  return `${chunk.z}:${chunk.x}`;
}

describe("World GridTopology", () => {
  it("maps valid Cells to logical Chunks and local Cells", () => {
    expect(spatial.cellToChunk({ x: 0, z: 0 })).toEqual({
      status: "success",
      value: { chunk: { x: 0, z: 0 }, local: { x: 0, z: 0 } },
    });
    expect(spatial.cellToChunk({ x: 31, z: 31 })).toEqual({
      status: "success",
      value: { chunk: { x: 0, z: 0 }, local: { x: 31, z: 31 } },
    });
    expect(spatial.cellToChunk({ x: 32, z: 32 })).toEqual({
      status: "success",
      value: { chunk: { x: 1, z: 1 }, local: { x: 0, z: 0 } },
    });
    expect(spatial.cellToChunk({ x: 511, z: 511 })).toEqual({
      status: "success",
      value: { chunk: { x: 15, z: 15 }, local: { x: 31, z: 31 } },
    });
    expect(spatial.cellToChunk({ x: 512, z: 0 })).toEqual({
      status: "rejected",
      code: "WORLD_COORD_OUT_OF_BOUNDS",
    });
    expect(spatial.cellToChunk({ x: -1, z: 0 })).toEqual({
      status: "rejected",
      code: "WORLD_COORD_OUT_OF_BOUNDS",
    });
    expect(spatial.cellToChunk({ x: 0.5, z: 0 })).toEqual({
      status: "rejected",
      code: "WORLD_COORD_OUT_OF_BOUNDS",
    });
  });

  it("applies the normative south-west owner rule at seams and outer boundaries", () => {
    const seamCases: readonly [VertexCoord, ChunkCoord][] = [
      [{ x: 0, z: 0 }, { x: 0, z: 0 }],
      [{ x: 32, z: 1 }, { x: 0, z: 0 }],
      [{ x: 33, z: 1 }, { x: 1, z: 0 }],
      [{ x: 32, z: 32 }, { x: 0, z: 0 }],
      [{ x: 64, z: 32 }, { x: 1, z: 0 }],
      [{ x: 512, z: 0 }, { x: 15, z: 0 }],
      [{ x: 0, z: 512 }, { x: 0, z: 15 }],
      [{ x: 512, z: 512 }, { x: 15, z: 15 }],
    ];

    for (const [vertex, owner] of seamCases) {
      expect(spatial.ownerChunk(vertex)).toEqual({ status: "success", value: owner });
    }

    for (let k = 1; k <= 15; k += 1) {
      const seam = k * 32;
      expect(spatial.ownerChunk({ x: seam, z: 1 })).toEqual({
        status: "success",
        value: { x: k - 1, z: 0 },
      });
      expect(spatial.ownerChunk({ x: 1, z: seam })).toEqual({
        status: "success",
        value: { x: 0, z: k - 1 },
      });
      expect(spatial.ownerChunk({ x: seam, z: seam })).toEqual({
        status: "success",
        value: { x: k - 1, z: k - 1 },
      });
    }
  });

  it("gives every one of the 513x513 valid Vertices exactly one valid owner that touches it", () => {
    const violations: string[] = [];
    let visited = 0;

    for (let z = 0; z <= 512; z += 1) {
      for (let x = 0; x <= 512; x += 1) {
        visited += 1;
        const vertex = { x, z };
        const ownerResult = spatial.ownerChunk(vertex);
        if (ownerResult.status !== "success") {
          violations.push(`missing-owner:${x},${z}`);
          continue;
        }
        const owner = ownerResult.value;
        if (owner.x < 0 || owner.x > 15 || owner.z < 0 || owner.z > 15) {
          violations.push(`owner-out-of-range:${x},${z}`);
        }
        const touchingResult = spatial.touchingChunks(vertex);
        if (touchingResult.status !== "success") {
          violations.push(`missing-touching:${x},${z}`);
          continue;
        }
        const matches = touchingResult.value.filter(
          (chunk) => chunk.x === owner.x && chunk.z === owner.z,
        );
        if (matches.length !== 1) {
          violations.push(`owner-touch-count:${x},${z}:${matches.length}`);
        }
      }
    }

    expect(visited).toBe(513 * 513);
    expect(violations).toEqual([]);
  });

  it("derives incident Cells and touching Chunks without duplicate seam authority", () => {
    expect(spatial.incidentCells({ x: 32, z: 32 })).toEqual({
      status: "success",
      value: [
        { x: 31, z: 31 },
        { x: 32, z: 31 },
        { x: 31, z: 32 },
        { x: 32, z: 32 },
      ],
    });
    expect(spatial.incidentCells({ x: 0, z: 0 })).toEqual({
      status: "success",
      value: [{ x: 0, z: 0 }],
    });
    expect(spatial.touchingChunks({ x: 32, z: 32 })).toEqual({
      status: "success",
      value: [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 1 },
        { x: 1, z: 1 },
      ],
    });
    expect(spatial.ownerChunk({ x: 513, z: 0 })).toEqual({
      status: "rejected",
      code: "WORLD_COORD_OUT_OF_BOUNDS",
    });
  });

  it("preserves North East South West cardinal order after boundary omissions", () => {
    expect(spatial.cardinalNeighbors({ x: 10, z: 10 })).toEqual({
      status: "success",
      value: [
        { x: 10, z: 11 },
        { x: 11, z: 10 },
        { x: 10, z: 9 },
        { x: 9, z: 10 },
      ],
    });
    expect(spatial.cardinalNeighbors({ x: 0, z: 0 })).toEqual({
      status: "success",
      value: [
        { x: 0, z: 1 },
        { x: 1, z: 0 },
      ],
    });
    expect(spatial.cardinalNeighbors({ x: 511, z: 511 })).toEqual({
      status: "success",
      value: [
        { x: 511, z: 510 },
        { x: 510, z: 511 },
      ],
    });
  });

  it("maps half-open Cell rectangles to canonical intersecting Chunk order", () => {
    expect(
      spatial.intersectingChunks({
        xStartInclusive: 31,
        zStartInclusive: 31,
        xEndExclusive: 33,
        zEndExclusive: 33,
      }),
    ).toEqual({
      status: "success",
      value: [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
        { x: 0, z: 1 },
        { x: 1, z: 1 },
      ],
    });
    expect(
      spatial.intersectingChunks({
        xStartInclusive: 0,
        zStartInclusive: 0,
        xEndExclusive: 32,
        zEndExclusive: 32,
      }),
    ).toEqual({ status: "success", value: [{ x: 0, z: 0 }] });
    expect(
      spatial.intersectingChunks({
        xStartInclusive: 5,
        zStartInclusive: 5,
        xEndExclusive: 5,
        zEndExclusive: 6,
      }),
    ).toEqual({ status: "rejected", code: "WORLD_COORD_OUT_OF_BOUNDS" });
  });

  it("maps World XZ into half-open Cells and returns exact Cell bounds", () => {
    expect(spatial.worldPositionToCell({ x: 0, z: 0 })).toEqual({
      status: "success",
      value: { x: 0, z: 0 },
    });
    expect(spatial.worldPositionToCell({ x: 7.999, z: 7.999 })).toEqual({
      status: "success",
      value: { x: 0, z: 0 },
    });
    expect(spatial.worldPositionToCell({ x: 8, z: 8 })).toEqual({
      status: "success",
      value: { x: 1, z: 1 },
    });
    expect(spatial.worldPositionToCell({ x: 4095.999, z: 4095.999 })).toEqual({
      status: "success",
      value: { x: 511, z: 511 },
    });
    expect(spatial.worldPositionToCell({ x: 4096, z: 0 })).toEqual({
      status: "rejected",
      code: "WORLD_COORD_OUT_OF_BOUNDS",
    });
    expect(spatial.worldPositionToCell({ x: Number.NaN, z: 0 })).toEqual({
      status: "rejected",
      code: "WORLD_COORD_OUT_OF_BOUNDS",
    });
    expect(spatial.cellBounds({ x: 511, z: 511 })).toEqual({
      status: "success",
      value: {
        xMinInclusive: 4088,
        zMinInclusive: 4088,
        xMaxExclusive: 4096,
        zMaxExclusive: 4096,
      },
    });
  });

  it("returns touching Chunk order as canonical z then x", () => {
    const touching = expectSuccess<readonly ChunkCoord[]>(
      spatial.touchingChunks({ x: 64, z: 64 }),
    );
    expect(touching.map(chunkKey)).toEqual(["1:1", "1:2", "2:1", "2:2"]);
  });
});
