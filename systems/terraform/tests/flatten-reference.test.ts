import { describe, expect, it } from "vitest";
import type {
  MapDefinitionRead,
  MapStateRead,
  RegionId,
  VertexCoord,
  WorldSpatialRead,
} from "@web-three-city/world";
import {
  parseLogicalElevation,
  type LogicalElevation,
  type TerrainAuthorityRead,
} from "@web-three-city/terrain";
import {
  resolveFlattenCorner,
  selectFlattenReference,
} from "@web-three-city/terraform";

const UNLOCKED = "region-unlocked" as RegionId;
const LOCKED = "region-locked" as RegionId;

const mapDefinition: MapDefinitionRead = {
  mapDefinitionId: "web-three-city-production",
  profileId: "production-v1",
  profileVersion: 1,
  widthCells: 512,
  heightCells: 512,
  cellSizeMeters: 8,
  logicalChunkSizeCells: 32,
  terrainGenerationProfileId: "balanced-temperate-generation",
  terrainGenerationProfileVersion: 2,
  regionIds: [UNLOCKED, LOCKED],
  startingCandidates: [],
};

const mapState: MapStateRead = {
  mapDefinitionId: "web-three-city-production",
  startingRegionId: UNLOCKED,
  unlockedRegionIds: [UNLOCKED],
};

function elevation(value: number): LogicalElevation {
  const parsed = parseLogicalElevation(value);
  if (parsed.status !== "success")
    throw new Error(`invalid test elevation ${value}`);
  return parsed.value;
}

function spatial(region: RegionId = UNLOCKED): WorldSpatialRead {
  return {
    regionAtCell: () => ({ status: "success", value: region }),
  } as unknown as WorldSpatialRead;
}

function terrain(options?: {
  readonly unavailable?: boolean;
}): TerrainAuthorityRead {
  return {
    elevationAt: (vertex: VertexCoord) =>
      options?.unavailable
        ? {
            status: "unavailable" as const,
            code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE" as const,
            chunk: { x: 0, z: 0 },
          }
        : { status: "success" as const, value: elevation(vertex.x + vertex.z) },
  } as unknown as TerrainAuthorityRead;
}

describe("Flatten nearest canonical corner", () => {
  it.each([
    [
      { cell: { x: 5, z: 7 }, uQ16: 0, vQ16: 0 },
      { x: 5, z: 7 },
    ],
    [
      { cell: { x: 5, z: 7 }, uQ16: 65535, vQ16: 0 },
      { x: 6, z: 7 },
    ],
    [
      { cell: { x: 5, z: 7 }, uQ16: 0, vQ16: 65535 },
      { x: 5, z: 8 },
    ],
    [
      { cell: { x: 5, z: 7 }, uQ16: 32768, vQ16: 32768 },
      { x: 6, z: 8 },
    ],
  ] as const)("resolves deterministic corner %#", (pick, expected) => {
    expect(resolveFlattenCorner(pick)).toEqual(expected);
  });
});

describe("Flatten reference selection", () => {
  it("returns the exact LogicalElevation from the selected canonical corner", () => {
    expect(
      selectFlattenReference({
        pick: { cell: { x: 5, z: 7 }, uQ16: 65535, vQ16: 0 },
        mapDefinition,
        mapState,
        spatial: spatial(),
        terrain: terrain(),
      }),
    ).toEqual({ status: "success", value: 13, vertex: { x: 6, z: 7 } });
  });

  it("rejects an out-of-world picked cell before selecting a corner", () => {
    expect(
      selectFlattenReference({
        pick: { cell: { x: -1, z: 7 }, uQ16: 0, vQ16: 0 },
        mapDefinition,
        mapState,
        spatial: spatial(),
        terrain: terrain(),
      }),
    ).toMatchObject({ status: "rejected", reason: "OUT_OF_WORLD" });
  });

  it("rejects a locked reference cell before reading Terrain", () => {
    expect(
      selectFlattenReference({
        pick: { cell: { x: 5, z: 7 }, uQ16: 0, vQ16: 0 },
        mapDefinition,
        mapState,
        spatial: spatial(LOCKED),
        terrain: terrain(),
      }),
    ).toMatchObject({ status: "rejected", reason: "LOCKED_REGION" });
  });

  it("rejects when the selected canonical corner is unavailable", () => {
    expect(
      selectFlattenReference({
        pick: { cell: { x: 5, z: 7 }, uQ16: 0, vQ16: 0 },
        mapDefinition,
        mapState,
        spatial: spatial(),
        terrain: terrain({ unavailable: true }),
      }),
    ).toMatchObject({ status: "rejected", reason: "TERRAIN_UNAVAILABLE" });
  });
});
