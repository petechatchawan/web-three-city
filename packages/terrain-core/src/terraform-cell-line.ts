import type { CellCoord } from '@web-three-city/world-core';

function compareCells(first: CellCoord, second: CellCoord): number {
  return first.x === second.x ? first.z - second.z : first.x - second.x;
}

function pushCell(cells: CellCoord[], x: number, z: number): void {
  const previous = cells.at(-1);
  if (previous?.x === x && previous.z === z) return;
  cells.push(Object.freeze({ x, z }));
}

function rasterizeCanonical(from: CellCoord, to: CellCoord): readonly CellCoord[] {
  let x = from.x;
  let z = from.z;
  const deltaX = Math.abs(to.x - from.x);
  const deltaZ = Math.abs(to.z - from.z);
  const stepX = Math.sign(to.x - from.x);
  const stepZ = Math.sign(to.z - from.z);
  const cells: CellCoord[] = [];
  pushCell(cells, x, z);

  if (deltaX >= deltaZ) {
    let error = deltaX / 2;
    while (x !== to.x) {
      x += stepX;
      error -= deltaZ;
      if (error < 0) {
        pushCell(cells, x, z);
        z += stepZ;
        error += deltaX;
      }
      pushCell(cells, x, z);
    }
  } else {
    let error = deltaZ / 2;
    while (z !== to.z) {
      z += stepZ;
      error -= deltaX;
      if (error < 0) {
        pushCell(cells, x, z);
        x += stepX;
        error += deltaZ;
      }
      pushCell(cells, x, z);
    }
  }

  return Object.freeze(cells);
}

export function rasterizeTerraformCellLine(from: CellCoord, to: CellCoord): readonly CellCoord[] {
  if (
    !Number.isInteger(from.x) ||
    !Number.isInteger(from.z) ||
    !Number.isInteger(to.x) ||
    !Number.isInteger(to.z)
  ) {
    throw new RangeError('terraform:invalid-cell-line');
  }

  if (compareCells(from, to) <= 0) return rasterizeCanonical(from, to);
  return Object.freeze([...rasterizeCanonical(to, from)].reverse());
}
