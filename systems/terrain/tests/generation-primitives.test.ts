import { describe, expect, it } from "vitest";
import { deriveLayerSeeds } from "../src/domain/generation/splitmix64";
import {
  fadeQ16,
  hash32,
  latticeValue,
  lerpInt,
  truncTowardZeroDivision,
  valueNoise,
} from "../src/domain/generation/value-noise";

const PRODUCTION_SEED = 0x5eed5eed5eed5eedn;

describe("deterministic Terrain generation primitives", () => {
  it("derives the frozen five SplitMix64 layer seeds", () => {
    expect(deriveLayerSeeds(PRODUCTION_SEED, 5)).toEqual([
      0xb6e4d3f7, 0x598b0c68, 0x2b21bfcf, 0x8eacdfe9, 0x9ef86ee7,
    ]);
  });

  it.each([
    [0xb6e4d3f7, 0, 0, 0x1b2dd25d, -25811],
    [0xb6e4d3f7, 1, 0, 0xf0005dae, 28672],
    [0xb6e4d3f7, 0, 1, 0x98d95ba6, 6361],
    [0x598b0c68, 2, 3, 0xe64d68dd, 26189],
    [0x9ef86ee7, 64, 64, 0xa940873b, 10560],
  ])(
    "hashes seed=%i lattice=(%i,%i) exactly",
    (seed, gx, gz, expectedHash, expectedValue) => {
      expect(hash32(seed, gx, gz)).toBe(expectedHash);
      expect(latticeValue(seed, gx, gz)).toBe(expectedValue);
    },
  );

  it.each([
    [0, 0],
    [16384, 10240],
    [32768, 32768],
    [49152, 55296],
    [65536, 65536],
  ])("evaluates fadeQ16(%i) exactly", (input, expected) => {
    expect(fadeQ16(input)).toBe(expected);
  });

  it("truncates signed divisions toward zero", () => {
    expect(truncTowardZeroDivision(7, 3)).toBe(2);
    expect(truncTowardZeroDivision(-7, 3)).toBe(-2);
    expect(truncTowardZeroDivision(7, -3)).toBe(-2);
    expect(truncTowardZeroDivision(-7, -3)).toBe(2);
  });

  it.each([
    [10, -10, 32768, 0],
    [-10, 10, 32768, 0],
    [100, 0, 21845, 67],
    [0, -100, 21845, -33],
    [-100, 0, 21845, -67],
  ])("interpolates (%i,%i,%i) exactly", (a, b, t, expected) => {
    expect(lerpInt(a, b, t)).toBe(expected);
  });

  it("uses exact lattice values at period boundaries and is repeatable", () => {
    const seed = 0xb6e4d3f7;
    expect(valueNoise(seed, 0, 0, 128)).toBe(latticeValue(seed, 0, 0));
    expect(valueNoise(seed, 128, 0, 128)).toBe(latticeValue(seed, 1, 0));
    expect(valueNoise(seed, 0, 128, 128)).toBe(latticeValue(seed, 0, 1));

    const first = valueNoise(seed, 73, 91, 128);
    expect(valueNoise(seed, 73, 91, 128)).toBe(first);
  });
});
