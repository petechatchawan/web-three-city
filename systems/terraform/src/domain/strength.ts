import type { TerraformStrength } from "../contracts/terraform-types";

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
