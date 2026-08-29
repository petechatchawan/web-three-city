import { deriveLayerSeeds } from "./splitmix64";
import { truncTowardZeroDivision, valueNoise } from "./value-noise";

const VERTEX_WIDTH = 513;
const VERTEX_HEIGHT = 513;
const BASE_ELEVATION = 160;
const OCTAVES = [
  [128, 64],
  [64, 32],
  [32, 16],
  [16, 8],
  [8, 4],
] as const;

export interface ProductionTerrainField {
  readonly vertexWidth: number;
  readonly vertexHeight: number;
  elevationAt(x: number, z: number): number;
}

export function generateProductionTerrainField(
  seed64: bigint,
): ProductionTerrainField {
  const layerSeeds = deriveLayerSeeds(seed64, OCTAVES.length);
  const values = new Int32Array(VERTEX_WIDTH * VERTEX_HEIGHT);

  for (let z = 0; z < VERTEX_HEIGHT; z += 1) {
    for (let x = 0; x < VERTEX_WIDTH; x += 1) {
      let weighted = 0;

      for (const [index, [period, amplitude]] of OCTAVES.entries()) {
        weighted += valueNoise(layerSeeds[index]!, x, z, period) * amplitude;
      }

      values[z * VERTEX_WIDTH + x] =
        BASE_ELEVATION + truncTowardZeroDivision(weighted, 32768);
    }
  }

  return Object.freeze({
    vertexWidth: VERTEX_WIDTH,
    vertexHeight: VERTEX_HEIGHT,
    elevationAt(x: number, z: number): number {
      return values[z * VERTEX_WIDTH + x]!;
    },
  });
}
