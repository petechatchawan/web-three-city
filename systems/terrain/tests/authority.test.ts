import { beforeAll, describe, expect, it } from "vitest";
import type { VertexCoord, WorldSpatialRead } from "@web-three-city/world";
import {
  createTerrainAuthoritySystem,
  type TerrainFieldSource,
} from "../src/composition";
import {
  createTerrainState,
  type CanonicalVertexRecord,
} from "../src/domain/terrain-state";
import { createTerrainAuthorityRead } from "../src/application/terrain-read";
import { logicalElevationToMeters, parseLogicalElevation } from "../src/index";
import {
  TEST_CHUNK_AXIS_COUNT,
  TEST_TERRAIN_PROVENANCE,
  TEST_VERTEX_SIZE,
  createTestWorldSpatialRead,
  testWorldRejection,
} from "./helpers/world-spatial-fixture";

const TOTAL_VERTICES = TEST_VERTEX_SIZE * TEST_VERTEX_SIZE;

function expectedElevation(x: number, z: number): number {
  return ((x * 3 + z * 5) % 33) - 16;
}

function fullField(): TerrainFieldSource {
  return {
    vertexWidth: TEST_VERTEX_SIZE,
    vertexHeight: TEST_VERTEX_SIZE,
    elevationAt: expectedElevation,
  };
}

function constructionInput(world: WorldSpatialRead, source = fullField()) {
  return {
    world,
    ...TEST_TERRAIN_PROVENANCE,
    source,
  } as const;
}

describe("Terrain canonical authority", () => {
  let ownerLookups = 0;
  let authority: ReturnType<typeof createTerrainAuthoritySystem>;

  beforeAll(() => {
    const world = createTestWorldSpatialRead(() => {
      ownerLookups += 1;
    });
    authority = createTerrainAuthoritySystem(constructionInput(world));
  });

  it("materializes every production Vertex exactly once through World owner resolution", () => {
    expect(authority.status).toBe("success");
    expect(ownerLookups).toBe(TOTAL_VERTICES);
    if (authority.status !== "success") return;

    expect(authority.value.read.revision()).toBe(0);
    expect(authority.value.read.completeness()).toBe("full");

    const samples: readonly VertexCoord[] = [
      { x: 0, z: 0 },
      { x: 32, z: 32 },
      { x: 33, z: 32 },
      { x: 512, z: 512 },
    ];
    for (const vertex of samples) {
      expect(authority.value.read.elevationAt(vertex)).toEqual({
        status: "success",
        value: expectedElevation(vertex.x, vertex.z),
      });
    }
  });

  it("preserves the 0.25m product elevation unit without making float meters authority", () => {
    const parsed = parseLogicalElevation(8);
    expect(parsed).toEqual({ status: "success", value: 8 });
    if (parsed.status !== "success") return;
    expect(logicalElevationToMeters(parsed.value)).toBe(2);
  });

  it("distinguishes out-of-bounds from unavailable authority", () => {
    expect(authority.status).toBe("success");
    if (authority.status !== "success") return;
    expect(authority.value.read.elevationAt({ x: 513, z: 0 })).toEqual({
      status: "out-of-bounds",
      code: "TERRAIN_QUERY_OUT_OF_BOUNDS",
    });

    const elevation = parseLogicalElevation(12);
    expect(elevation.status).toBe("success");
    if (elevation.status !== "success") return;

    const record: CanonicalVertexRecord = {
      chunkKey: 0,
      vertexKey: 0,
      elevation: elevation.value,
    };
    const partial = createTerrainState({
      provenance: TEST_TERRAIN_PROVENANCE,
      records: [record],
      loadedChunkKeys: [0],
      expectedChunkCount: TEST_CHUNK_AXIS_COUNT * TEST_CHUNK_AXIS_COUNT,
    });
    expect(partial.provenance).toEqual(TEST_TERRAIN_PROVENANCE);

    const partialRead = createTerrainAuthorityRead({
      state: partial,
      world: createTestWorldSpatialRead(),
      vertexWidth: TEST_VERTEX_SIZE,
    });

    expect(partialRead.completeness()).toBe("partial");
    expect(partialRead.elevationAt({ x: 33, z: 1 })).toEqual({
      status: "unavailable",
      code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE",
      chunk: { x: 1, z: 0 },
    });
  });

  it("rejects invalid source dimensions before publishing TerrainState", () => {
    const result = createTerrainAuthoritySystem(
      constructionInput(createTestWorldSpatialRead(), {
        vertexWidth: 512,
        vertexHeight: 513,
        elevationAt: () => 0,
      }),
    );
    expect(result).toMatchObject({
      status: "rejected",
      reason: "invalid-source-dimensions",
    });
  });

  it("rejects an invalid elevation atomically without exposing a partial authority", () => {
    const result = createTerrainAuthoritySystem(
      constructionInput(createTestWorldSpatialRead(), {
        vertexWidth: TEST_VERTEX_SIZE,
        vertexHeight: TEST_VERTEX_SIZE,
        elevationAt(x, z) {
          return x === 512 && z === 512 ? 4097 : 0;
        },
      }),
    );
    expect(result).toMatchObject({
      status: "rejected",
      reason: "invalid-elevation",
    });
    expect("value" in result).toBe(false);
  });

  it("rejects unexpected World topology failures instead of inventing ownership", () => {
    const world = createTestWorldSpatialRead();
    const brokenWorld: WorldSpatialRead = {
      ...world,
      ownerChunk(vertex) {
        if (vertex.x === 64 && vertex.z === 64) return testWorldRejection();
        return world.ownerChunk(vertex);
      },
    };
    const result = createTerrainAuthoritySystem(constructionInput(brokenWorld));
    expect(result).toMatchObject({
      status: "rejected",
      reason: "world-topology-rejected",
    });
  });
});
