import { FrontSide, MeshStandardMaterial } from "three";

const PHASE_1_TERRAIN_COLOR = 0x6f8f63;
const PHASE_1_TERRAIN_ROUGHNESS = 0.92;
const PHASE_1_TERRAIN_METALNESS = 0;

export function createTerrainMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: PHASE_1_TERRAIN_COLOR,
    roughness: PHASE_1_TERRAIN_ROUGHNESS,
    metalness: PHASE_1_TERRAIN_METALNESS,
    side: FrontSide,
  });
}
