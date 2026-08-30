import { describe, expect, it } from "vitest";
import type { CellCoord, VertexCoord } from "@web-three-city/world";
import * as terraform from "@web-three-city/terraform";

type TerraformCoreApiUnderTest = {
  strengthLevels?: (strength: "fine" | "normal" | "strong") => number;
  buildBrushFootprint?: (
    target: CellCoord,
    size: 1 | 3 | 5,
  ) => {
    readonly cells: readonly CellCoord[];
    readonly vertices: readonly VertexCoord[];
  };
};

const api = terraform as TerraformCoreApiUnderTest;

describe("Terraform strength", () => {
  it("maps Fine, Normal, and Strong to the frozen logical elevation deltas", () => {
    expect(api.strengthLevels?.("fine")).toBe(1);
    expect(api.strengthLevels?.("normal")).toBe(4);
    expect(api.strengthLevels?.("strong")).toBe(16);
  });
});

describe("Terraform brush footprint", () => {
  it.each([
    [1, 1, 4],
    [3, 9, 16],
    [5, 25, 36],
  ] as const)(
    "maps a %ix%i Gameplay Cell brush to %i cells and the matching shared vertices",
    (size, expectedCells, expectedVertices) => {
      const footprint = api.buildBrushFootprint?.({ x: 100, z: 100 }, size);
      expect(footprint?.cells).toHaveLength(expectedCells);
      expect(footprint?.vertices).toHaveLength(expectedVertices);
    },
  );

  it("orders a 3x3 footprint deterministically by z then x", () => {
    const footprint = api.buildBrushFootprint?.({ x: 10, z: 20 }, 3);
    expect(footprint?.cells).toEqual([
      { x: 9, z: 19 },
      { x: 10, z: 19 },
      { x: 11, z: 19 },
      { x: 9, z: 20 },
      { x: 10, z: 20 },
      { x: 11, z: 20 },
      { x: 9, z: 21 },
      { x: 10, z: 21 },
      { x: 11, z: 21 },
    ]);
  });
});
