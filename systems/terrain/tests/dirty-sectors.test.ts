import type { CellCoord } from "@web-three-city/world";
import { describe, expect, it } from "vitest";
import type { TerrainChangeSet } from "../src/contracts/mutation";
import { computeDirtyRenderSectors } from "../src/presentation/three/topology/dirty-sectors";
import { createRenderSectorLayout } from "../src/presentation/three/topology/render-sector";

const layout = createRenderSectorLayout({
  widthCells: 512,
  heightCells: 512,
  cellSizeMeters: 8,
});

function changeSetWithAffectedCells(
  affectedCells: readonly CellCoord[],
): TerrainChangeSet {
  return {
    previousRevision: 1,
    newRevision: 2,
    changedVertices: [],
    affectedCells,
    touchingLogicalChunks: [],
  };
}

describe("dirty render sectors", () => {
  it("keeps an interior mutation local to one sector", () => {
    expect(
      computeDirtyRenderSectors(
        layout,
        changeSetWithAffectedCells([{ x: 130, z: 130 }]),
      ),
    ).toEqual([{ x: 2, z: 2 }]);
  });

  it("expands across both sector seams at a sector corner", () => {
    expect(
      computeDirtyRenderSectors(
        layout,
        changeSetWithAffectedCells([{ x: 63, z: 63 }]),
      ),
    ).toEqual([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
      { x: 1, z: 1 },
    ]);
  });

  it("expands only across the required horizontal or vertical seam", () => {
    expect(
      computeDirtyRenderSectors(
        layout,
        changeSetWithAffectedCells([{ x: 63, z: 100 }]),
      ),
    ).toEqual([
      { x: 0, z: 1 },
      { x: 1, z: 1 },
    ]);

    expect(
      computeDirtyRenderSectors(
        layout,
        changeSetWithAffectedCells([{ x: 100, z: 63 }]),
      ),
    ).toEqual([
      { x: 1, z: 0 },
      { x: 1, z: 1 },
    ]);
  });

  it("clips Moore expansion at map boundaries", () => {
    expect(
      computeDirtyRenderSectors(
        layout,
        changeSetWithAffectedCells([{ x: 0, z: 0 }]),
      ),
    ).toEqual([{ x: 0, z: 0 }]);

    expect(
      computeDirtyRenderSectors(
        layout,
        changeSetWithAffectedCells([{ x: 511, z: 511 }]),
      ),
    ).toEqual([{ x: 7, z: 7 }]);
  });

  it("deduplicates and sorts independently of caller order", () => {
    const forward = computeDirtyRenderSectors(
      layout,
      changeSetWithAffectedCells([
        { x: 64, z: 64 },
        { x: 63, z: 63 },
        { x: 64, z: 64 },
      ]),
    );
    const reverse = computeDirtyRenderSectors(
      layout,
      changeSetWithAffectedCells(
        [
          { x: 64, z: 64 },
          { x: 63, z: 63 },
        ].reverse(),
      ),
    );

    expect(forward).toEqual([
      { x: 0, z: 0 },
      { x: 1, z: 0 },
      { x: 0, z: 1 },
      { x: 1, z: 1 },
    ]);
    expect(reverse).toEqual(forward);
    expect(forward.length).toBeLessThan(layout.totalSectors);
  });

  it("returns no dirty sectors for a no-op change set", () => {
    expect(
      computeDirtyRenderSectors(layout, changeSetWithAffectedCells([])),
    ).toEqual([]);
  });
});
