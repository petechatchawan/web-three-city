import type { TerrainAuthorityRead } from "../src/contracts/terrain-read";
import { describe, expect, it } from "vitest";
import { readSectorSurface } from "../src/presentation/three/geometry/read-sector-surface";
import { createRenderSectorLayout } from "../src/presentation/three/topology/render-sector";
import {
  TEST_MAP_DEFINITION,
  createFunctionalTerrainRead,
} from "./helpers/presentation-fixture";

const layout = createRenderSectorLayout(TEST_MAP_DEFINITION);

describe("sector surface snapshot", () => {
  it("captures one coherent visible window plus one-vertex halo", () => {
    const reads: string[] = [];
    const terrain = createFunctionalTerrainRead(
      (x, z) => (x + z) % 200,
      7,
      (vertex) => reads.push(`${vertex.x}:${vertex.z}`),
    );

    const snapshot = readSectorSurface({
      layout,
      sector: { x: 1, z: 1 },
      terrain,
    });

    expect(snapshot.revision).toBe(7);
    expect(snapshot.visibleVertices).toEqual({
      xStartInclusive: 64,
      zStartInclusive: 64,
      xEndInclusive: 128,
      zEndInclusive: 128,
    });
    expect(snapshot.haloVertices).toEqual({
      xStartInclusive: 63,
      zStartInclusive: 63,
      xEndInclusive: 129,
      zEndInclusive: 129,
    });
    expect(reads).toHaveLength(67 * 67);
    expect(new Set(reads).size).toBe(reads.length);
    expect(snapshot.elevationAt({ x: 64, z: 64 })).toBe(128);
    expect(snapshot.elevationAt({ x: 129, z: 129 })).toBe(58);
  });

  it("clips halo bounds at the outer map vertices", () => {
    const terrain = createFunctionalTerrainRead((x, z) => (x + z) % 100);

    const southWest = readSectorSurface({
      layout,
      sector: { x: 0, z: 0 },
      terrain,
    });
    expect(southWest.haloVertices).toEqual({
      xStartInclusive: 0,
      zStartInclusive: 0,
      xEndInclusive: 65,
      zEndInclusive: 65,
    });

    const northEast = readSectorSurface({
      layout,
      sector: { x: 7, z: 7 },
      terrain,
    });
    expect(northEast.haloVertices).toEqual({
      xStartInclusive: 447,
      zStartInclusive: 447,
      xEndInclusive: 512,
      zEndInclusive: 512,
    });
  });

  it("rejects reads outside the captured snapshot instead of clamping", () => {
    const snapshot = readSectorSurface({
      layout,
      sector: { x: 1, z: 1 },
      terrain: createFunctionalTerrainRead(() => 10),
    });

    expect(() => snapshot.elevationAt({ x: 62, z: 64 })).toThrow(
      /outside the captured sector surface/i,
    );
    expect(() => snapshot.elevationAt({ x: 130, z: 64 })).toThrow(
      /outside the captured sector surface/i,
    );
  });

  it("fails if Terrain revision changes during snapshot capture", () => {
    const base = createFunctionalTerrainRead(() => 10, 3);
    let revisionCall = 0;
    const terrain: TerrainAuthorityRead = {
      ...base,
      revision: () => (revisionCall++ === 0 ? 3 : 4),
    };

    expect(() =>
      readSectorSurface({ layout, sector: { x: 2, z: 2 }, terrain }),
    ).toThrow(/revision changed during sector surface capture/i);
  });

  it("fails without publishing a snapshot when required authority is unavailable", () => {
    const base = createFunctionalTerrainRead(() => 10, 3);
    const terrain: TerrainAuthorityRead = {
      ...base,
      elevationAt(vertex) {
        if (vertex.x === 130 && vertex.z === 130) {
          return {
            status: "unavailable",
            code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE",
            chunk: { x: 4, z: 4 },
          };
        }
        return base.elevationAt(vertex);
      },
    };

    expect(() =>
      readSectorSurface({ layout, sector: { x: 2, z: 2 }, terrain }),
    ).toThrow(/terrain authority unavailable/i);
  });
});
