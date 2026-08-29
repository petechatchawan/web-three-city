import { describe, expect, it } from "vitest";
import type { ChunkCoord } from "@web-three-city/world";
import {
  parseLogicalElevation,
  type LogicalElevation,
  type TerrainCompleteness,
  type TerrainQueryResult,
  type TerrainRevision,
} from "../src/index";

describe("Terrain public authority values", () => {
  it("accepts the exact inclusive LogicalElevation product bounds", () => {
    expect(parseLogicalElevation(-4096)).toEqual({
      status: "success",
      value: -4096,
    });
    expect(parseLogicalElevation(4096)).toEqual({
      status: "success",
      value: 4096,
    });
  });

  it("rejects non-integer LogicalElevation values without clamping", () => {
    for (const value of [0.25, -1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(parseLogicalElevation(value)).toEqual({
        status: "rejected",
        code: "TERRAIN_ELEVATION_INVALID",
      });
    }
  });

  it("rejects integer elevations outside the product domain", () => {
    expect(parseLogicalElevation(-4097)).toEqual({
      status: "rejected",
      code: "TERRAIN_ELEVATION_OUT_OF_RANGE",
    });
    expect(parseLogicalElevation(4097)).toEqual({
      status: "rejected",
      code: "TERRAIN_ELEVATION_OUT_OF_RANGE",
    });
  });

  it("defines typed revision, completeness, and unavailable query outcomes", () => {
    const elevation = 0 as LogicalElevation;
    const revision: TerrainRevision = 0;
    const completeness: TerrainCompleteness = "partial";
    const chunk: ChunkCoord = { x: 3, z: 4 };
    const unavailable: TerrainQueryResult<LogicalElevation> = {
      status: "unavailable",
      code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE",
      chunk,
    };

    expect({ elevation, revision, completeness, unavailable }).toBeDefined();
  });
});
