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
import { parseLogicalElevation } from "../src/index";

const VERTEX_SIZE = 513;
const CHUNK_SIZE = 32;
const CHUNK_AXIS_COUNT = 16;
const TOTAL_VERTICES = VERTEX_SIZE * VERTEX_SIZE;

function ownerAxis(axis: number): number {
  return axis === 0
    ? 0
    : Math.min(Math.floor((axis - 1) / CHUNK_SIZE), CHUNK_AXIS_COUNT - 1);
}

function worldRejection() {
  return { status: "rejected", code: "WORLD_COORD_OUT_OF_BOUNDS" } as const;
}

function createWorldSpatialRead(onOwnerLookup?: () => void): WorldSpatialRead {
  return {
    cellToChunk() {
      return worldRejection();
    },
    ownerChunk(vertex: VertexCoord) {
      onOwnerLookup?.();
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
    cellBounds() {
      return worldRejection();
    },
    regionAtCell() {
      return worldRejection();
    },
    adjacentRegions() {
      return worldRejection();
    },
  };
}

function expectedElevation(x: number, z: number): number {
  return ((x * 3 + z * 5) % 33) - 16;
}

function fullField(): TerrainFieldSource {
  return {
    vertexWidth: VERTEX_SIZE,
    vertexHeight: VERTEX_SIZE,
    elevationAt: expectedElevation,
  };
}

function constructionInput(world: WorldSpatialRead, source = fullField()) {
  return {
    world,
    mapDefinitionId: "web-three-city-production",
    generationProfileId: "balanced-temperate-generation",
    generationProfileVersion: 2,
    selectedSeed64: "0x5EED5EED5EED5EED",
    source,
  } as const;
}

describe("Terrain canonical authority", () => {
  let ownerLookups = 0;
  let authority: ReturnType<typeof createTerrainAuthoritySystem>;

  beforeAll(() => {
    const world = createWorldSpatialRead(() => {
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
    expect(parsed.value * 0.25).toBe(2);
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
      records: [record],
      loadedChunkKeys: [0],
      expectedChunkCount: CHUNK_AXIS_COUNT * CHUNK_AXIS_COUNT,
    });
    const partialRead = createTerrainAuthorityRead({
      state: partial,
      world: createWorldSpatialRead(),
      vertexWidth: VERTEX_SIZE,
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
      constructionInput(createWorldSpatialRead(), {
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
      constructionInput(createWorldSpatialRead(), {
        vertexWidth: VERTEX_SIZE,
        vertexHeight: VERTEX_SIZE,
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
    const world = createWorldSpatialRead();
    const brokenWorld: WorldSpatialRead = {
      ...world,
      ownerChunk(vertex) {
        if (vertex.x === 64 && vertex.z === 64) return worldRejection();
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
