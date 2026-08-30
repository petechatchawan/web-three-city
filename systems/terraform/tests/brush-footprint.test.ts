import { describe, expect, it } from "vitest";
import { buildBrushFootprint, strengthLevels } from "@web-three-city/terraform";

describe("Terraform strength", () => {
  it("maps Fine, Normal, and Strong to the frozen logical elevation deltas", () => {
    expect(strengthLevels("fine")).toBe(1);
    expect(strengthLevels("normal")).toBe(4);
    expect(strengthLevels("strong")).toBe(16);
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
      const footprint = buildBrushFootprint({ x: 100, z: 100 }, size);
      expect(footprint.cells).toHaveLength(expectedCells);
      expect(footprint.vertices).toHaveLength(expectedVertices);
    },
  );

  it("orders a 3x3 footprint deterministically by z then x", () => {
    const footprint = buildBrushFootprint({ x: 10, z: 20 }, 3);
    expect(footprint.cells).toEqual([
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
