import { describe, expect, it } from "vitest";
import { fingerprintProductionTerrainField } from "../src/domain/generation/fingerprint";
import { generateProductionTerrainField } from "../src/domain/generation/production-field";

const PRODUCTION_SEED = 0x5eed5eed5eed5eedn;
const EXPECTED_FINGERPRINT = "0xF2FA29BFD2AEB069";

const FROZEN_SAMPLES = [
  [0, 0, 91],
  [256, 256, 213],
  [512, 512, 222],
  [153, 191, 164],
  [358, 191, 177],
  [153, 319, 154],
  [358, 319, 134],
] as const;

describe("production Terrain generation", () => {
  it("generates the exact 513x513 production field samples", () => {
    const field = generateProductionTerrainField(PRODUCTION_SEED);

    expect(field.vertexWidth).toBe(513);
    expect(field.vertexHeight).toBe(513);

    for (const [x, z, expectedElevation] of FROZEN_SAMPLES) {
      expect(field.elevationAt(x, z)).toBe(expectedElevation);
    }
  });

  it("keeps all 263,169 production elevations inside the frozen envelope", () => {
    const field = generateProductionTerrainField(PRODUCTION_SEED);
    let count = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (let z = 0; z <= 512; z += 1) {
      for (let x = 0; x <= 512; x += 1) {
        const elevation = field.elevationAt(x, z);
        count += 1;
        min = Math.min(min, elevation);
        max = Math.max(max, elevation);
        expect(elevation).toBeGreaterThanOrEqual(32);
        expect(elevation).toBeLessThanOrEqual(288);
      }
    }

    expect(count).toBe(263_169);
    expect(min).toBeGreaterThanOrEqual(32);
    expect(max).toBeLessThanOrEqual(288);
  });

  it("is bit-repeatable for independently generated fields", () => {
    const first = generateProductionTerrainField(PRODUCTION_SEED);
    const second = generateProductionTerrainField(PRODUCTION_SEED);

    for (let z = 0; z <= 512; z += 1) {
      for (let x = 0; x <= 512; x += 1) {
        expect(second.elevationAt(x, z)).toBe(first.elevationAt(x, z));
      }
    }
  });

  it("matches the frozen canonical FNV-1a fingerprint", () => {
    const field = generateProductionTerrainField(PRODUCTION_SEED);

    expect(fingerprintProductionTerrainField(field)).toBe(EXPECTED_FINGERPRINT);
  });
  it("is deterministic for an arbitrary valid Seed64 distinct from the golden vector", () => {
    const arbitrarySeed = 0x00000000000000abn;
    const first = generateProductionTerrainField(arbitrarySeed);
    const second = generateProductionTerrainField(arbitrarySeed);

    expect(fingerprintProductionTerrainField(second)).toBe(
      fingerprintProductionTerrainField(first),
    );
    expect(fingerprintProductionTerrainField(first)).not.toBe(
      EXPECTED_FINGERPRINT,
    );
  });
});
