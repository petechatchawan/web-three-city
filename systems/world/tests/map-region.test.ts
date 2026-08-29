import { describe, expect, it } from "vitest";
import { prepareProductionWorldDefinition } from "../src/application/prepare-world-definition";
import type { CellCoord, RegionId, WorldSpatialRead } from "../src/index";

function expectPrepared() {
  const result = prepareProductionWorldDefinition();
  if (result.status !== "success") {
    const detail = JSON.stringify(result.detail ?? {});
    throw new Error(
      `expected production World definition: ${result.code} ${detail}`,
    );
  }
  return result.value;
}

function expectRegion(spatial: WorldSpatialRead, cell: CellCoord): RegionId {
  const result = spatial.regionAtCell(cell);
  expect(result.status).toBe("success");
  if (result.status !== "success") {
    throw new Error(`expected Region at ${cell.x},${cell.z}: ${result.code}`);
  }
  return result.value;
}

describe("production MapDefinition and Region partition", () => {
  it("publishes the exact immutable production-v1 map content", () => {
    const { mapDefinition } = expectPrepared();

    expect(mapDefinition).toMatchObject({
      mapDefinitionId: "web-three-city-production",
      profileId: "production-v1",
      profileVersion: 1,
      widthCells: 512,
      heightCells: 512,
      cellSizeMeters: 8,
      logicalChunkSizeCells: 32,
      terrainGenerationProfileId: "balanced-temperate-generation",
      terrainGenerationProfileVersion: 2,
    });
    expect(mapDefinition.regionIds).toEqual(
      Array.from(
        { length: 20 },
        (_, index) => `R${index.toString().padStart(2, "0")}`,
      ),
    );
    expect(mapDefinition.acceptedTerrainSeeds).toEqual(["0x5EED5EED5EED5EED"]);
    expect(mapDefinition.startingCandidates).toEqual([
      { regionId: "R06", anchor: { x: 153, z: 191 } },
      { regionId: "R08", anchor: { x: 358, z: 191 } },
      { regionId: "R11", anchor: { x: 153, z: 319 } },
      { regionId: "R13", anchor: { x: 358, z: 319 } },
    ]);
  });

  it("assigns every one of the 512x512 Cells to exactly one Region with exact non-uniform counts", () => {
    const { mapDefinition, spatial } = expectPrepared();
    const counts = new Map<RegionId, number>(
      mapDefinition.regionIds.map((id) => [id, 0]),
    );

    for (let z = 0; z < 512; z += 1) {
      for (let x = 0; x < 512; x += 1) {
        const regionId = expectRegion(spatial, { x, z });
        expect(counts.has(regionId)).toBe(true);
        counts.set(regionId, (counts.get(regionId) ?? 0) + 1);
      }
    }

    const regionCellCounts = mapDefinition.regionIds.map(
      (id) => counts.get(id) ?? 0,
    );
    const expectedRowCounts = [13056, 13184, 13056, 13184, 13056];
    expect(regionCellCounts).toEqual([
      ...expectedRowCounts,
      ...expectedRowCounts,
      ...expectedRowCounts,
      ...expectedRowCounts,
    ]);
    expect(regionCellCounts.reduce((sum, count) => sum + count, 0)).toBe(
      512 * 512,
    );
    expect(spatial.regionAtCell({ x: 512, z: 0 })).toEqual({
      status: "rejected",
      code: "WORLD_COORD_OUT_OF_BOUNDS",
    });
  });

  it("keeps all twenty Regions cardinally connected", () => {
    const { mapDefinition, spatial } = expectPrepared();
    const cellsByRegion = new Map<RegionId, CellCoord[]>(
      mapDefinition.regionIds.map((id) => [id, []]),
    );

    for (let z = 0; z < 512; z += 1) {
      for (let x = 0; x < 512; x += 1) {
        const cell = { x, z };
        cellsByRegion.get(expectRegion(spatial, cell))?.push(cell);
      }
    }

    for (const regionId of mapDefinition.regionIds) {
      const cells = cellsByRegion.get(regionId) ?? [];
      expect(cells.length).toBeGreaterThan(0);
      const first = cells[0];
      if (first === undefined) {
        throw new Error(`Region ${regionId} unexpectedly empty`);
      }

      const owned = new Set(cells.map((cell) => `${cell.x}:${cell.z}`));
      const visited = new Set<string>();
      const queue: CellCoord[] = [first];
      let cursor = 0;

      while (cursor < queue.length) {
        const cell = queue[cursor];
        cursor += 1;
        if (cell === undefined) {
          continue;
        }
        const key = `${cell.x}:${cell.z}`;
        if (visited.has(key)) {
          continue;
        }
        visited.add(key);

        const neighbors = spatial.cardinalNeighbors(cell);
        if (neighbors.status !== "success") {
          throw new Error(`expected neighbors for ${key}`);
        }
        for (const neighbor of neighbors.value) {
          const neighborKey = `${neighbor.x}:${neighbor.z}`;
          if (owned.has(neighborKey) && !visited.has(neighborKey)) {
            queue.push(neighbor);
          }
        }
      }

      expect(visited.size).toBe(cells.length);
    }
  });

  it("keeps every canonical 9x9 starting patch wholly inside its candidate Region", () => {
    const { mapDefinition, spatial } = expectPrepared();

    for (const candidate of mapDefinition.startingCandidates) {
      expect(expectRegion(spatial, candidate.anchor)).toBe(candidate.regionId);
      for (let dz = -4; dz <= 4; dz += 1) {
        for (let dx = -4; dx <= 4; dx += 1) {
          expect(
            expectRegion(spatial, {
              x: candidate.anchor.x + dx,
              z: candidate.anchor.z + dz,
            }),
          ).toBe(candidate.regionId);
        }
      }
    }
  });

  it("derives canonical symmetric irreflexive adjacency from cardinal Cell edges", () => {
    const { mapDefinition, spatial } = expectPrepared();

    expect(spatial.adjacentRegions("R00")).toEqual({
      status: "success",
      value: ["R01", "R05"],
    });
    expect(spatial.adjacentRegions("R06")).toEqual({
      status: "success",
      value: ["R01", "R05", "R07", "R11"],
    });

    for (const regionId of mapDefinition.regionIds) {
      const adjacency = spatial.adjacentRegions(regionId);
      expect(adjacency.status).toBe("success");
      if (adjacency.status !== "success") {
        throw new Error(`expected adjacency for ${regionId}`);
      }
      expect(adjacency.value).not.toContain(regionId);
      const canonicalOrder = [...adjacency.value].sort(
        (left, right) =>
          mapDefinition.regionIds.indexOf(left) -
          mapDefinition.regionIds.indexOf(right),
      );
      expect(adjacency.value).toEqual(canonicalOrder);

      for (const neighbor of adjacency.value) {
        const reverse = spatial.adjacentRegions(neighbor);
        expect(reverse.status).toBe("success");
        if (reverse.status === "success") {
          expect(reverse.value).toContain(regionId);
        }
      }
    }

    expect(spatial.adjacentRegions("R99")).toEqual({
      status: "rejected",
      code: "WORLD_REGION_UNKNOWN",
    });
  });
});