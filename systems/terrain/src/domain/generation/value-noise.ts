const Q16_ONE = 65536;

function u32(value: number): number {
  return value >>> 0;
}

export function hash32(seed: number, gx: number, gz: number): number {
  let hash = u32(seed ^ Math.imul(gx, 0x9e3779b1) ^ Math.imul(gz, 0x85ebca77));
  hash = u32(hash ^ (hash >>> 16));
  hash = u32(Math.imul(hash, 0x7feb352d));
  hash = u32(hash ^ (hash >>> 15));
  hash = u32(Math.imul(hash, 0x846ca68b));
  return u32(hash ^ (hash >>> 16));
}

export function latticeValue(seed: number, gx: number, gz: number): number {
  return ((hash32(seed, gx, gz) >>> 16) & 0xffff) - 32768;
}

export function truncTowardZeroDivision(
  numerator: number,
  denominator: number,
): number {
  return Math.trunc(numerator / denominator);
}

export function fadeQ16(t: number): number {
  const t2 = Math.floor((t * t) / Q16_ONE);
  return Math.floor((t2 * (3 * Q16_ONE - 2 * t)) / Q16_ONE);
}

export function lerpInt(a: number, b: number, t: number): number {
  return a + truncTowardZeroDivision((b - a) * t, Q16_ONE);
}

export function valueNoise(
  seed: number,
  x: number,
  z: number,
  period: number,
): number {
  const gx = Math.floor(x / period);
  const gz = Math.floor(z / period);
  const rx = x - gx * period;
  const rz = z - gz * period;
  const tx = Math.floor((rx * Q16_ONE) / period);
  const tz = Math.floor((rz * Q16_ONE) / period);
  const fx = fadeQ16(tx);
  const fz = fadeQ16(tz);

  const south = lerpInt(
    latticeValue(seed, gx, gz),
    latticeValue(seed, gx + 1, gz),
    fx,
  );
  const north = lerpInt(
    latticeValue(seed, gx, gz + 1),
    latticeValue(seed, gx + 1, gz + 1),
    fx,
  );

  return lerpInt(south, north, fz);
}
