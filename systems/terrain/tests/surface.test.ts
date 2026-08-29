import { describe, expect, it } from "vitest";
import {
  Q16_ONE,
  evaluateSurface,
  type CellCorners,
} from "../src/domain/surface";
import { parseLogicalElevation } from "../src/index";

function elevation(value: number) {
  const parsed = parseLogicalElevation(value);
  if (parsed.status !== "success") {
    throw new Error(`invalid test elevation ${value}`);
  }
  return parsed.value;
}

function corners(sw: number, se: number, nw: number, ne: number): CellCorners {
  return {
    sw: elevation(sw),
    se: elevation(se),
    nw: elevation(nw),
    ne: elevation(ne),
  };
}

describe("exact Terrain surface", () => {
  const sampleCorners = corners(0, 8, 4, 20);

  it("uses the frozen NW→SE triangle identity and diagonal tie rule", () => {
    expect(evaluateSurface(sampleCorners, 0, 0)).toMatchObject({
      triangle: "SW_TRIANGLE",
      heightQ16: 0,
    });
    expect(evaluateSurface(sampleCorners, Q16_ONE, Q16_ONE)).toMatchObject({
      triangle: "NE_TRIANGLE",
      heightQ16: 20 * Q16_ONE,
    });
    expect(evaluateSurface(sampleCorners, 32768, 32767).triangle).toBe(
      "SW_TRIANGLE",
    );
    expect(evaluateSurface(sampleCorners, 32768, 32768).triangle).toBe(
      "SW_TRIANGLE",
    );
    expect(evaluateSurface(sampleCorners, 32768, 32769).triangle).toBe(
      "NE_TRIANGLE",
    );
  });

  it("returns exact frozen Q16 heights and slope facts", () => {
    expect(evaluateSurface(sampleCorners, 32768, 32768)).toEqual({
      triangle: "SW_TRIANGLE",
      heightQ16: 6 * Q16_ONE,
      riseX: 8,
      riseZ: 4,
      runUnits: 32,
    });
    expect(evaluateSurface(sampleCorners, 49152, 49152)).toEqual({
      triangle: "NE_TRIANGLE",
      heightQ16: 13 * Q16_ONE,
      riseX: 16,
      riseZ: 12,
      runUnits: 32,
    });
  });

  it("makes both triangle equations exactly continuous on the diagonal", () => {
    for (const u of [0, 8192, 16384, 32768, 49152, 65536]) {
      const v = Q16_ONE - u;
      const sample = evaluateSurface(sampleCorners, u, v);
      const swFormula = sampleCorners.se * u + sampleCorners.nw * v;
      const neFormula =
        sampleCorners.nw * (Q16_ONE - u) + sampleCorners.se * (Q16_ONE - v);

      expect(sample.triangle).toBe("SW_TRIANGLE");
      expect(swFormula).toBe(neFormula);
      expect(sample.heightQ16).toBe(swFormula);
    }
  });

  it("is exactly continuous across a shared Cell edge", () => {
    const westCell = corners(2, 10, 6, 14);
    const eastCell = corners(10, 18, 14, 22);

    for (const v of [0, 8192, 32768, 49152, 65536]) {
      const westEdge = evaluateSurface(westCell, Q16_ONE, v);
      const eastEdge = evaluateSurface(eastCell, 0, v);
      expect(eastEdge.heightQ16).toBe(westEdge.heightQ16);
    }
  });
});
