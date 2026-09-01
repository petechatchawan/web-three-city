import { describe, expect, it } from "vitest";
import {
  logicalElevationToMeters,
  parseLogicalElevation,
} from "../src/domain/elevation";
import {
  buildSectorGeometryData,
  createSectorBufferGeometry,
} from "../src/presentation/three/geometry/build-sector-geometry";
import { readSectorSurface } from "../src/presentation/three/geometry/read-sector-surface";
import {
  RENDER_SECTOR_CELLS,
  allRenderSectorCoords,
  createRenderSectorLayout,
  renderSectorCellBounds,
  renderSectorForCell,
} from "../src/presentation/three/topology/render-sector";
import {
  TEST_MAP_DEFINITION,
  createFunctionalTerrainRead,
  createPresentationWorldSpatialRead,
} from "./helpers/presentation-fixture";

describe("render-sector topology", () => {
  it("derives the frozen production layout from the map definition", () => {
    const layout = createRenderSectorLayout(TEST_MAP_DEFINITION);

    expect(RENDER_SECTOR_CELLS).toBe(64);
    expect(layout).toEqual({
      widthCells: 512,
      heightCells: 512,
      cellSizeMeters: 8,
      cellsPerSector: 64,
      sectorCountX: 8,
      sectorCountZ: 8,
      totalSectors: 64,
      vertexAxisCount: 65,
    });
  });

  it("enumerates all sectors in canonical z,x order", () => {
    const sectors = allRenderSectorCoords(
      createRenderSectorLayout(TEST_MAP_DEFINITION),
    );

    expect(sectors).toHaveLength(64);
    expect(sectors[0]).toEqual({ x: 0, z: 0 });
    expect(sectors[1]).toEqual({ x: 1, z: 0 });
    expect(sectors[8]).toEqual({ x: 0, z: 1 });
    expect(sectors[63]).toEqual({ x: 7, z: 7 });
  });

  it("maps seam and outer-boundary Cells without clamping", () => {
    const layout = createRenderSectorLayout(TEST_MAP_DEFINITION);

    expect(renderSectorForCell(layout, { x: 63, z: 63 })).toEqual({
      x: 0,
      z: 0,
    });
    expect(renderSectorForCell(layout, { x: 64, z: 63 })).toEqual({
      x: 1,
      z: 0,
    });
    expect(renderSectorForCell(layout, { x: 63, z: 64 })).toEqual({
      x: 0,
      z: 1,
    });
    expect(renderSectorForCell(layout, { x: 64, z: 64 })).toEqual({
      x: 1,
      z: 1,
    });
    expect(renderSectorForCell(layout, { x: 511, z: 511 })).toEqual({
      x: 7,
      z: 7,
    });
    expect(renderSectorForCell(layout, { x: 512, z: 0 })).toBeUndefined();
    expect(renderSectorForCell(layout, { x: -1, z: 0 })).toBeUndefined();
    expect(renderSectorForCell(layout, { x: 0.5, z: 0 })).toBeUndefined();
  });

  it("derives exact half-open Cell bounds for a sector", () => {
    const layout = createRenderSectorLayout(TEST_MAP_DEFINITION);

    expect(renderSectorCellBounds(layout, { x: 2, z: 3 })).toEqual({
      xStartInclusive: 128,
      zStartInclusive: 192,
      xEndExclusive: 192,
      zEndExclusive: 256,
    });
  });

  it("covers every production Cell exactly once", () => {
    const layout = createRenderSectorLayout(TEST_MAP_DEFINITION);
    const counts = new Map<string, number>();
    let firstMissingCell:
      | { readonly x: number; readonly z: number }
      | undefined;

    outer: for (let z = 0; z < layout.heightCells; z += 1) {
      for (let x = 0; x < layout.widthCells; x += 1) {
        const sector = renderSectorForCell(layout, { x, z });
        if (sector === undefined) {
          firstMissingCell = { x, z };
          break outer;
        }
        const key = `${sector.x},${sector.z}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    expect(firstMissingCell).toBeUndefined();
    expect(counts.size).toBe(layout.totalSectors);
    for (const count of counts.values()) {
      expect(count).toBe(RENDER_SECTOR_CELLS * RENDER_SECTOR_CELLS);
    }
  });
});

describe("render-sector geometry", () => {
  const layout = createRenderSectorLayout(TEST_MAP_DEFINITION);
  const world = createPresentationWorldSpatialRead();

  function geometryFor(
    sector: { readonly x: number; readonly z: number },
    elevation: (x: number, z: number) => number,
  ) {
    const terrain = createFunctionalTerrainRead(elevation);
    const snapshot = readSectorSurface({ layout, sector, terrain });
    return buildSectorGeometryData({ layout, sector, snapshot, world });
  }

  it("builds the exact derived vertex/index counts and fixed diagonal", () => {
    const data = geometryFor({ x: 0, z: 0 }, () => 0);

    expect(data.positions.length).toBe(65 * 65 * 3);
    expect(data.normals.length).toBe(65 * 65 * 3);
    expect(data.indices.length).toBe(8192 * 3);
    expect([...data.indices.slice(0, 6)]).toEqual([0, 1, 65, 65, 1, 66]);
  });

  it("projects X/Z from MapDefinition and Y through Terrain elevation scale", () => {
    const elevation = 40;
    const parsedElevation = parseLogicalElevation(elevation);
    if (parsedElevation.status !== "success") {
      throw new Error("Expected valid test elevation.");
    }
    const data = geometryFor({ x: 0, z: 0 }, () => elevation);
    const localX = 10;
    const localZ = 20;
    const offset = (localZ * layout.vertexAxisCount + localX) * 3;

    expect([...data.positions.slice(offset, offset + 3)]).toEqual([
      localX * TEST_MAP_DEFINITION.cellSizeMeters,
      logicalElevationToMeters(parsedElevation.value),
      localZ * TEST_MAP_DEFINITION.cellSizeMeters,
    ]);
  });

  it("duplicates sector seam positions with numerically equal world coordinates", () => {
    const elevation = (x: number, z: number) => (x + z) % 100;
    const west = geometryFor({ x: 0, z: 0 }, elevation);
    const east = geometryFor({ x: 1, z: 0 }, elevation);
    const localZ = 32;
    const westOffset =
      (localZ * layout.vertexAxisCount + layout.cellsPerSector) * 3;
    const eastOffset = localZ * layout.vertexAxisCount * 3;

    expect([...west.positions.slice(westOffset, westOffset + 3)]).toEqual([
      ...east.positions.slice(eastOffset, eastOffset + 3),
    ]);
    expect([...west.normals.slice(westOffset, westOffset + 3)]).toEqual([
      ...east.normals.slice(eastOffset, eastOffset + 3),
    ]);
  });

  it("creates BufferGeometry with deterministic bounds", () => {
    const data = geometryFor({ x: 0, z: 0 }, () => 0);
    const geometry = createSectorBufferGeometry(data);

    expect(geometry.getAttribute("position").count).toBe(65 * 65);
    expect(geometry.getAttribute("normal").count).toBe(65 * 65);
    expect(geometry.index?.count).toBe(8192 * 3);
    expect(Array.from(geometry.index?.array.slice(0, 6) ?? [])).toEqual([
      0, 65, 1, 65, 66, 1,
    ]);

    const position = geometry.getAttribute("position");
    const index = geometry.index;
    if (index === null) throw new Error("Expected indexed Terrain geometry.");
    const a = index.getX(0);
    const b = index.getX(1);
    const c = index.getX(2);
    const ax = position.getX(a);
    const az = position.getZ(a);
    const abx = position.getX(b) - ax;
    const abz = position.getZ(b) - az;
    const acx = position.getX(c) - ax;
    const acz = position.getZ(c) - az;
    const geometricNormalY = abz * acx - abx * acz;
    expect(geometricNormalY).toBeGreaterThan(0);

    expect(geometry.boundingBox).not.toBeNull();
    expect(geometry.boundingSphere).not.toBeNull();

    geometry.dispose();
  });
});
