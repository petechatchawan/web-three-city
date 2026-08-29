import type {
  CellCoord,
  VertexCoord,
  WorldSpatialRead,
} from "@web-three-city/world";

export const TEST_VERTEX_SIZE = 513;
export const TEST_CELL_SIZE = 512;
export const TEST_CHUNK_SIZE = 32;
export const TEST_CHUNK_AXIS_COUNT = 16;

export const TEST_TERRAIN_PROVENANCE = {
  mapDefinitionId: "web-three-city-production",
  generationProfileId: "balanced-temperate-generation",
  generationProfileVersion: 2,
  selectedSeed64: "0x5EED5EED5EED5EED",
} as const;

export function testOwnerAxis(axis: number): number {
  return axis === 0
    ? 0
    : Math.min(
        Math.floor((axis - 1) / TEST_CHUNK_SIZE),
        TEST_CHUNK_AXIS_COUNT - 1,
      );
}

export function testWorldRejection() {
  return { status: "rejected", code: "WORLD_COORD_OUT_OF_BOUNDS" } as const;
}

function isValidCell(cell: CellCoord): boolean {
  return (
    Number.isInteger(cell.x) &&
    Number.isInteger(cell.z) &&
    cell.x >= 0 &&
    cell.z >= 0 &&
    cell.x < TEST_CELL_SIZE &&
    cell.z < TEST_CELL_SIZE
  );
}

export function createTestWorldSpatialRead(
  onOwnerLookup?: () => void,
): WorldSpatialRead {
  return {
    cellToChunk(cell) {
      if (!isValidCell(cell)) return testWorldRejection();
      return {
        status: "success",
        value: {
          chunk: {
            x: Math.floor(cell.x / TEST_CHUNK_SIZE),
            z: Math.floor(cell.z / TEST_CHUNK_SIZE),
          },
          local: {
            x: cell.x % TEST_CHUNK_SIZE,
            z: cell.z % TEST_CHUNK_SIZE,
          },
        },
      };
    },
    ownerChunk(vertex: VertexCoord) {
      onOwnerLookup?.();
      if (
        !Number.isInteger(vertex.x) ||
        !Number.isInteger(vertex.z) ||
        vertex.x < 0 ||
        vertex.z < 0 ||
        vertex.x >= TEST_VERTEX_SIZE ||
        vertex.z >= TEST_VERTEX_SIZE
      ) {
        return testWorldRejection();
      }
      return {
        status: "success",
        value: { x: testOwnerAxis(vertex.x), z: testOwnerAxis(vertex.z) },
      };
    },
    incidentCells() {
      return testWorldRejection();
    },
    touchingChunks() {
      return testWorldRejection();
    },
    cardinalNeighbors() {
      return testWorldRejection();
    },
    intersectingChunks() {
      return testWorldRejection();
    },
    worldPositionToCell() {
      return testWorldRejection();
    },
    cellBounds(cell) {
      if (!isValidCell(cell)) return testWorldRejection();
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
      return testWorldRejection();
    },
    adjacentRegions() {
      return testWorldRejection();
    },
  };
}
