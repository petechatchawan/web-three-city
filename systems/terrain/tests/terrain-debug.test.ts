import { BufferGeometry, Material } from "three";
import { describe, expect, it, vi } from "vitest";
import { createTerrainThreeDebugOverlay } from "../src/composition";
import { TERRAIN_DEBUG_DEFAULT_CONFIG } from "../src/presentation/three/debug/debug-config";
import { buildCellGridLineData } from "../src/presentation/three/debug/debug-geometry";
import { readSectorSurface } from "../src/presentation/three/geometry/read-sector-surface";
import { createRenderSectorLayout } from "../src/presentation/three/topology/render-sector";
import {
  TEST_MAP_DEFINITION,
  createFunctionalTerrainRead,
  createPresentationWorldSpatialRead,
} from "./helpers/presentation-fixture";

const world = createPresentationWorldSpatialRead();
const terrain = createFunctionalTerrainRead((x, z) => x + z, 0);
const mapDefinition = {
  ...TEST_MAP_DEFINITION,
  mapDefinitionId: "web-three-city-production",
  profileId: "production-v1",
  profileVersion: 1,
  logicalChunkSizeCells: 32,
  terrainGenerationProfileId: "balanced-temperate-generation",
  terrainGenerationProfileVersion: 2,
  regionIds: [],
  startingCandidates: [],
} as const;

function changeSet(previousRevision: number, newRevision: number) {
  return {
    previousRevision,
    newRevision,
    changedVertices: [{ x: 96, z: 96 }],
    affectedCells: [
      { x: 95, z: 95 },
      { x: 96, z: 96 },
    ],
    touchingLogicalChunks: [],
  } as const;
}

describe("Terrain debug geometry", () => {
  it("keeps every debug layer hidden by default and owns diagnostic constants once", () => {
    expect(TERRAIN_DEBUG_DEFAULT_CONFIG.visibility).toEqual({
      cellGrid: false,
      renderSectors: false,
      vertices: false,
      triangles: false,
      normals: false,
      elevation: false,
    });
    expect(
      TERRAIN_DEBUG_DEFAULT_CONFIG.normalSampleStrideCells,
    ).toBeGreaterThan(0);
    expect(TERRAIN_DEBUG_DEFAULT_CONFIG.surfaceOffsetMeters).toBeGreaterThan(0);
  });

  it("derives gameplay grid line spacing and heights from MapDefinition and Terrain", () => {
    const layout = createRenderSectorLayout(TEST_MAP_DEFINITION);
    const sector = { x: 0, z: 0 } as const;
    const snapshot = readSectorSurface({ layout, sector, terrain });
    const data = buildCellGridLineData({
      layout,
      sector,
      snapshot,
      config: TERRAIN_DEBUG_DEFAULT_CONFIG,
    });

    expect(data.positions.length).toBeGreaterThan(0);
    expect(data.positions[0]).toBe(0);
    expect(data.positions[3]).toBe(TEST_MAP_DEFINITION.cellSizeMeters);
    expect(data.positions[1]).not.toBe(data.positions[4]);
  });
});

describe("TerrainThreeDebugOverlay", () => {
  it("allocates nothing while hidden then lazily builds every requested layer", () => {
    const result = createTerrainThreeDebugOverlay({
      mapDefinition,
      world,
      terrain,
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.value.root.children).toHaveLength(0);
    result.value.setVisibility({
      cellGrid: true,
      renderSectors: true,
      vertices: true,
      triangles: true,
      normals: true,
      elevation: true,
    });
    expect(result.value.root.children).toHaveLength(6);
    for (const layer of result.value.root.children) {
      expect(layer.children).toHaveLength(64);
    }

    result.value.dispose();
  });

  it("rebuilds only dirty sector resources and preserves unaffected identities", () => {
    let revision = 0;
    const liveTerrain = createFunctionalTerrainRead(
      (x, z) => x + z,
      () => revision,
    );
    const result = createTerrainThreeDebugOverlay({
      mapDefinition,
      world,
      terrain: liveTerrain,
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    result.value.setVisibility({ cellGrid: true });
    const layer = result.value.root.children[0];
    expect(layer).toBeDefined();
    if (layer === undefined) return;
    const before = new Map(layer.children.map((child) => [child.name, child]));

    revision = 1;
    result.value.rebuild(changeSet(0, 1));
    const after = new Map(layer.children.map((child) => [child.name, child]));

    expect(after.get("terrain-debug:cellGrid:0:0")).toBe(
      before.get("terrain-debug:cellGrid:0:0"),
    );
    expect(after.get("terrain-debug:cellGrid:1:1")).not.toBe(
      before.get("terrain-debug:cellGrid:1:1"),
    );
    expect(after.size).toBe(before.size);
    result.value.dispose();
  });

  it("disposes disabled and final debug resources exactly once", () => {
    const geometryDispose = vi.spyOn(BufferGeometry.prototype, "dispose");
    const materialDispose = vi.spyOn(Material.prototype, "dispose");
    const result = createTerrainThreeDebugOverlay({
      mapDefinition,
      world,
      terrain,
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    result.value.setVisibility({ cellGrid: true });
    result.value.setVisibility({ cellGrid: false });
    expect(geometryDispose).toHaveBeenCalled();
    expect(materialDispose).toHaveBeenCalled();
    const geometryCount = geometryDispose.mock.calls.length;
    const materialCount = materialDispose.mock.calls.length;
    result.value.dispose();
    result.value.dispose();
    expect(geometryDispose.mock.calls).toHaveLength(geometryCount);
    expect(materialDispose.mock.calls).toHaveLength(materialCount);

    geometryDispose.mockRestore();
    materialDispose.mockRestore();
  });
});
