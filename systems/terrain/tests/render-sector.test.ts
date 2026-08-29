import type { MapDefinitionRead } from "@web-three-city/world";
import { describe, expect, it } from "vitest";
import {
  RENDER_SECTOR_CELLS,
  allRenderSectorCoords,
  createRenderSectorLayout,
  renderSectorCellBounds,
  renderSectorForCell,
} from "../src/presentation/three/topology/render-sector";

const TEST_MAP_DEFINITION: Pick<
  MapDefinitionRead,
  "widthCells" | "heightCells" | "cellSizeMeters"
> = {
  widthCells: 512,
  heightCells: 512,
  cellSizeMeters: 8,
};

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

    for (let z = 0; z < layout.heightCells; z += 1) {
      for (let x = 0; x < layout.widthCells; x += 1) {
        const sector = renderSectorForCell(layout, { x, z });
        expect(sector).toBeDefined();
        const key = `${sector!.x},${sector!.z}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    expect(counts.size).toBe(layout.totalSectors);
    for (const count of counts.values()) {
      expect(count).toBe(RENDER_SECTOR_CELLS * RENDER_SECTOR_CELLS);
    }
  });
});
