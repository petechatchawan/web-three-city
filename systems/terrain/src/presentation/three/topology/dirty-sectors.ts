import type { CellCoord } from "@web-three-city/world";
import type { TerrainChangeSet } from "../../../contracts/mutation";
import {
  compareRenderSectorCoord,
  renderSectorForCell,
  renderSectorKey,
  type RenderSectorCoord,
  type RenderSectorLayout,
} from "./render-sector";

const MOORE_OFFSETS = [-1, 0, 1] as const;

function neighborCells(cell: CellCoord): readonly CellCoord[] {
  const neighbors: CellCoord[] = [];
  for (const dz of MOORE_OFFSETS) {
    for (const dx of MOORE_OFFSETS) {
      neighbors.push({ x: cell.x + dx, z: cell.z + dz });
    }
  }
  return neighbors;
}

export function computeDirtyRenderSectors(
  layout: RenderSectorLayout,
  changeSet: TerrainChangeSet,
): readonly RenderSectorCoord[] {
  const sectors = new Map<string, RenderSectorCoord>();

  for (const affectedCell of changeSet.affectedCells) {
    for (const candidate of neighborCells(affectedCell)) {
      const sector = renderSectorForCell(layout, candidate);
      if (sector === undefined) continue;
      sectors.set(renderSectorKey(sector), sector);
    }
  }

  return Object.freeze(
    [...sectors.values()]
      .sort(compareRenderSectorCoord)
      .map((sector) => Object.freeze(sector)),
  );
}
