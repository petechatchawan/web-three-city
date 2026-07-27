import type { Xoshiro128StarStar } from './prng.js';
import { COASTAL_V1 } from './coastal-config.js';

function gaussian(x: number, center: number, spread: number): number {
  const normalized = (x - center) / spread;
  return Math.exp(-(normalized * normalized));
}

export function createCoastProfile(width: number, rng: Xoshiro128StarStar): Int16Array {
  const phaseA = rng.nextFloat() * Math.PI * 2;
  const phaseB = rng.nextFloat() * Math.PI * 2;
  const profile = new Int16Array(width + 1);

  for (let x = 0; x <= width; x += 1) {
    profile[x] = Math.round(
      COASTAL_V1.baseCoastZ +
        COASTAL_V1.coastAmplitudeA * Math.sin((Math.PI * 2 * x) / width + phaseA) +
        COASTAL_V1.coastAmplitudeB * Math.sin((Math.PI * 6 * x) / width + phaseB) -
        2 * gaussian(x, 40, 18) +
        2 * gaussian(x, 92, 14),
    );
  }

  return profile;
}

export function createInitialCoastalLevels(
  width: number,
  height: number,
  profile: Int16Array,
): Uint8Array {
  const latticeWidth = width + 1;
  const levels = new Uint8Array(latticeWidth * (height + 1));

  for (let z = 0; z <= height; z += 1) {
    for (let x = 0; x <= width; x += 1) {
      const coastZ = profile[x]!;
      let level: number;
      if (z >= coastZ + COASTAL_V1.deepWaterOffset) level = 0;
      else if (z >= coastZ) level = 1;
      else if (z <= COASTAL_V1.hilltopEndZ) level = 4;
      else if (z <= COASTAL_V1.inlandEndZ) level = 3;
      else level = 2;
      levels[z * latticeWidth + x] = level;
    }
  }

  return levels;
}
