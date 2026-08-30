import type { CellCoord, VertexCoord } from "@web-three-city/world";
import type { TerraformBrushSize } from "../contracts/terraform-types";

export interface TerraformBrushFootprint {
  readonly cells: readonly CellCoord[];
  readonly vertices: readonly VertexCoord[];
}

export function buildBrushFootprint(
  target: CellCoord,
  size: TerraformBrushSize,
): TerraformBrushFootprint {
  const radius = (size - 1) / 2;
  const minX = target.x - radius;
  const maxX = target.x + radius;
  const minZ = target.z - radius;
  const maxZ = target.z + radius;

  const cells: CellCoord[] = [];
  for (let z = minZ; z <= maxZ; z += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      cells.push({ x, z });
    }
  }

  const vertices: VertexCoord[] = [];
  for (let z = minZ; z <= maxZ + 1; z += 1) {
    for (let x = minX; x <= maxX + 1; x += 1) {
      vertices.push({ x, z });
    }
  }

  return Object.freeze({
    cells: Object.freeze(cells),
    vertices: Object.freeze(vertices),
  });
}
