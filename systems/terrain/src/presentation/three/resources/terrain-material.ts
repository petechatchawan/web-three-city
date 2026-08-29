import { DoubleSide, MeshBasicMaterial } from "three";

const PHASE_1_TERRAIN_COLOR = 0x6f8f63;

export function createTerrainMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: PHASE_1_TERRAIN_COLOR,
    side: DoubleSide,
  });
}
