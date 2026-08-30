import type { TerrainAuthorityRead } from "../src/contracts/terrain-read";
import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";
import { Q16_ONE } from "../src/domain/surface";
import {
  buildSectorGeometryData,
  createSectorBufferGeometry,
} from "../src/presentation/three/geometry/build-sector-geometry";
import { readSectorSurface } from "../src/presentation/three/geometry/read-sector-surface";
import {
  pickSemanticTerrain,
  resolveSemanticTerrainCandidate,
} from "../src/presentation/three/picking/semantic-pick";
import { createRenderSectorLayout } from "../src/presentation/three/topology/render-sector";
import {
  TEST_MAP_DEFINITION,
  createFunctionalTerrainRead,
  createPresentationWorldSpatialRead,
} from "./helpers/presentation-fixture";

const world = createPresentationWorldSpatialRead();

describe("semantic Terrain picking", () => {
  it("ignores Raycaster candidate Y and re-queries semantic Terrain", () => {
    const terrain = createFunctionalTerrainRead((x, z) => x + z, 9);

    const low = resolveSemanticTerrainCandidate({
      candidate: { x: 4, y: -10_000, z: 4 },
      world,
      terrain,
    });
    const high = resolveSemanticTerrainCandidate({
      candidate: { x: 4, y: 10_000, z: 4 },
      world,
      terrain,
    });
    const semantic = terrain.sampleSurface(
      { x: 0, z: 0 },
      Q16_ONE / 2,
      Q16_ONE / 2,
    );

    expect(high).toEqual(low);
    expect(semantic.status).toBe("success");
    if (semantic.status !== "success") return;
    expect(low).toEqual({
      status: "hit",
      value: {
        cell: { x: 0, z: 0 },
        uQ16: Q16_ONE / 2,
        vQ16: Q16_ONE / 2,
        worldPosition: {
          x: 4,
          y: semantic.value.heightQ16 / Q16_ONE / 4,
          z: 4,
        },
        triangle: semantic.value.triangle,
        heightQ16: semantic.value.heightQ16,
        riseX: semantic.value.riseX,
        riseZ: semantic.value.riseZ,
        runUnits: semantic.value.runUnits,
        revision: semantic.value.revision,
      },
    });
  });

  it("uses half-open World Cell mapping and derives Q16 from cell bounds", () => {
    const base = createFunctionalTerrainRead((x, z) => x + z);
    const samples: Array<{
      cell: { x: number; z: number };
      u: number;
      v: number;
    }> = [];
    const terrain: TerrainAuthorityRead = {
      ...base,
      sampleSurface(cell, uQ16, vQ16) {
        samples.push({ cell, u: uQ16, v: vQ16 });
        return base.sampleSurface(cell, uQ16, vQ16);
      },
    };

    resolveSemanticTerrainCandidate({
      candidate: { x: 4, y: 123, z: 4 },
      world,
      terrain,
    });
    resolveSemanticTerrainCandidate({
      candidate: { x: TEST_MAP_DEFINITION.cellSizeMeters, y: 123, z: 4 },
      world,
      terrain,
    });

    expect(samples).toEqual([
      { cell: { x: 0, z: 0 }, u: Q16_ONE / 2, v: Q16_ONE / 2 },
      { cell: { x: 1, z: 0 }, u: 0, v: Q16_ONE / 2 },
    ]);
  });

  it("returns typed miss and unavailable outcomes", () => {
    const base = createFunctionalTerrainRead(() => 0);
    const unavailable: TerrainAuthorityRead = {
      ...base,
      sampleSurface() {
        return {
          status: "unavailable",
          code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE",
          chunk: { x: 2, z: 3 },
        };
      },
    };

    expect(
      resolveSemanticTerrainCandidate({
        candidate: { x: -1, y: 0, z: 0 },
        world,
        terrain: base,
      }),
    ).toEqual({ status: "miss", reason: "WORLD_POSITION_OUT_OF_BOUNDS" });

    expect(
      resolveSemanticTerrainCandidate({
        candidate: { x: 4, y: 0, z: 4 },
        world,
        terrain: unavailable,
      }),
    ).toEqual({
      status: "unavailable",
      code: "TERRAIN_QUERY_CHUNK_UNAVAILABLE",
      chunk: { x: 2, z: 3 },
    });

    expect(
      pickSemanticTerrain({
        raycaster: new Raycaster(),
        root: new Group(),
        world,
        terrain: base,
      }),
    ).toEqual({ status: "miss", reason: "NO_TERRAIN_INTERSECTION" });
  });

  it("uses a real Three.js Raycaster only to obtain a candidate", () => {
    const layout = createRenderSectorLayout(TEST_MAP_DEFINITION);
    const terrain = createFunctionalTerrainRead(() => 0, 5);
    const sector = { x: 0, z: 0 } as const;
    const snapshot = readSectorSurface({ layout, sector, terrain });
    const data = buildSectorGeometryData({ layout, sector, snapshot, world });
    const geometry = createSectorBufferGeometry(data);
    const material = new MeshBasicMaterial({ side: DoubleSide });
    const mesh = new Mesh(geometry, material);
    const root = new Group();
    root.add(mesh);
    root.updateMatrixWorld(true);

    const raycaster = new Raycaster(
      new Vector3(4, 100, 4),
      new Vector3(0, -1, 0),
    );
    const result = pickSemanticTerrain({ raycaster, root, world, terrain });

    expect(result.status).toBe("hit");
    if (result.status === "hit") {
      expect(result.value.cell).toEqual({ x: 0, z: 0 });
      expect(result.value.revision).toBe(5);
    }

    geometry.dispose();
    material.dispose();
  });
});
