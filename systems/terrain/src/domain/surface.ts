import type { LogicalElevation } from "./elevation";

export const Q16_ONE = 65536;

export type TerrainTriangle = "SW_TRIANGLE" | "NE_TRIANGLE";

export interface CellCorners {
  readonly sw: LogicalElevation;
  readonly se: LogicalElevation;
  readonly nw: LogicalElevation;
  readonly ne: LogicalElevation;
}

export interface SurfaceSample {
  readonly triangle: TerrainTriangle;
  readonly heightQ16: number;
  readonly riseX: number;
  readonly riseZ: number;
  readonly runUnits: 32;
}

export function evaluateSurface(
  corners: CellCorners,
  uQ16: number,
  vQ16: number,
): SurfaceSample {
  if (uQ16 + vQ16 <= Q16_ONE) {
    return {
      triangle: "SW_TRIANGLE",
      heightQ16:
        corners.sw * (Q16_ONE - uQ16 - vQ16) +
        corners.se * uQ16 +
        corners.nw * vQ16,
      riseX: corners.se - corners.sw,
      riseZ: corners.nw - corners.sw,
      runUnits: 32,
    };
  }

  return {
    triangle: "NE_TRIANGLE",
    heightQ16:
      corners.nw * (Q16_ONE - uQ16) +
      corners.se * (Q16_ONE - vQ16) +
      corners.ne * (uQ16 + vQ16 - Q16_ONE),
    riseX: corners.ne - corners.nw,
    riseZ: corners.ne - corners.se,
    runUnits: 32,
  };
}
