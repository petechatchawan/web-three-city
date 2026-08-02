import { rasterizeTerraformCellLine } from '@web-three-city/terrain-core';
import type { CellCoord } from '@web-three-city/world-core';

export interface ReversibleCellTrace {
  extendTo(cell: CellCoord): boolean;
  cells(): readonly CellCoord[];
}

function copyCell(cell: CellCoord): CellCoord {
  return { x: cell.x, z: cell.z };
}

function sameCell(first: CellCoord, second: CellCoord): boolean {
  return first.x === second.x && first.z === second.z;
}

function cellKey(cell: CellCoord): string {
  return `${cell.x}:${cell.z}`;
}

export function createReversibleCellTrace(initialCell: CellCoord): ReversibleCellTrace {
  const trace: CellCoord[] = [copyCell(initialCell)];
  let lastCell = copyCell(initialCell);

  const processCell = (cell: CellCoord): boolean => {
    const tail = trace.at(-1);
    if (tail !== undefined && sameCell(tail, cell)) return false;

    const previous = trace.at(-2);
    if (previous !== undefined && sameCell(previous, cell)) {
      trace.pop();
      return true;
    }

    trace.push(copyCell(cell));
    return true;
  };

  return Object.freeze({
    extendTo(cell: CellCoord): boolean {
      let changed = false;
      for (const traversed of rasterizeTerraformCellLine(lastCell, cell)) {
        changed = processCell(traversed) || changed;
      }
      lastCell = copyCell(cell);
      return changed;
    },
    cells(): readonly CellCoord[] {
      const unique = new Map<string, CellCoord>();
      for (const cell of trace) {
        if (!unique.has(cellKey(cell))) unique.set(cellKey(cell), copyCell(cell));
      }
      return Object.freeze([...unique.values()].map(copyCell));
    },
  });
}
