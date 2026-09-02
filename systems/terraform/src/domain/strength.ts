import { LOGICAL_ELEVATION_METERS } from "@web-three-city/terrain";

export type TerraformStrength = "fine" | "normal" | "strong";

export function strengthLevels(strength: TerraformStrength): 1 | 4 | 16 {
  switch (strength) {
    case "fine":
      return 1;
    case "normal":
      return 4;
    case "strong":
      return 16;
  }
}

export function strengthDeltaMeters(strength: TerraformStrength): number {
  return strengthLevels(strength) * LOGICAL_ELEVATION_METERS;
}
