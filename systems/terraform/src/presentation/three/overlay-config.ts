import type { TerraformThreeOverlayConfig } from "../../contracts/terraform-three";

export const TERRAFORM_THREE_DEFAULT_CONFIG: TerraformThreeOverlayConfig =
  Object.freeze({
    surfaceOffsetMeters: 0.04,
    flattenMarkerHalfSizeMeters: 2,
    gridColor: 0xd8e2ea,
    gridOpacity: 0.3,
    footprintColor: 0x38bdf8,
    footprintOpacity: 0.95,
    influenceColor: 0xfacc15,
    influenceOpacity: 0.8,
    invalidColor: 0xef4444,
    invalidOpacity: 0.95,
    flattenReferenceColor: 0xa78bfa,
    flattenReferenceOpacity: 1,
  });

export function resolveTerraformThreeOverlayConfig(
  value?: Partial<TerraformThreeOverlayConfig>,
): TerraformThreeOverlayConfig {
  return Object.freeze({
    ...TERRAFORM_THREE_DEFAULT_CONFIG,
    ...value,
  });
}
