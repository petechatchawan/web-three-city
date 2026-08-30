import { Mesh, type BufferGeometry, type Material } from "three";
import {
  renderSectorKey,
  type RenderSectorCoord,
} from "../topology/render-sector";

export interface SectorResource {
  readonly coord: RenderSectorCoord;
  readonly geometry: BufferGeometry;
  readonly mesh: Mesh;
  dispose(): void;
}

export function createSectorResource(input: {
  readonly coord: RenderSectorCoord;
  readonly geometry: BufferGeometry;
  readonly material: Material;
}): SectorResource {
  const coord = Object.freeze({ ...input.coord });
  const mesh = new Mesh(input.geometry, input.material);
  mesh.name = `terrain-sector:${renderSectorKey(coord)}`;
  let disposed = false;

  return Object.freeze({
    coord,
    geometry: input.geometry,
    mesh,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      input.geometry.dispose();
    },
  });
}
