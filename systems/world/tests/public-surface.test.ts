import { describe, expect, it } from "vitest";
import type {
  CellCoord,
  ChunkCoord,
  VertexCoord,
  WorldSpatialRead,
} from "../src/index";

describe("World public read surface", () => {
  it("defines World-owned coordinates without a command surface", () => {
    const cell: CellCoord = { x: 0, z: 0 };
    const vertex: VertexCoord = { x: 512, z: 512 };
    const chunk: ChunkCoord = { x: 15, z: 15 };
    const read: WorldSpatialRead | undefined = undefined;

    expect({ cell, vertex, chunk, read }).toBeDefined();
  });
});
