import type { PerspectiveCamera } from "three";
import { Raycaster, Vector2 } from "three";
import type {
  TerrainSemanticPickResult,
  TerrainThreeProjection,
} from "@web-three-city/terrain/composition";
import { pointerToNdc } from "./pointer-to-ndc";

export type TerrainPointerPickResult =
  | TerrainSemanticPickResult
  | { readonly status: "miss"; readonly reason: "POINTER_OUTSIDE_VIEWPORT" };

export function createTerrainPointerPicker(input: {
  readonly viewport: HTMLElement;
  readonly camera: PerspectiveCamera;
  readonly projection: Pick<TerrainThreeProjection, "pick">;
}) {
  const raycaster = new Raycaster();
  return Object.freeze({
    pickClientPoint(
      clientX: number,
      clientY: number,
    ): TerrainPointerPickResult {
      const ndc = pointerToNdc(
        { clientX, clientY },
        input.viewport.getBoundingClientRect(),
      );
      if (ndc === undefined)
        return { status: "miss", reason: "POINTER_OUTSIDE_VIEWPORT" };
      raycaster.setFromCamera(new Vector2(ndc.x, ndc.y), input.camera);
      return input.projection.pick(raycaster);
    },
  });
}
