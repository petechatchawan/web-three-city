import { LOGICAL_ELEVATION_METERS } from "@web-three-city/terrain";
import * as terraform from "@web-three-city/terraform";
import { describe, expect, it } from "vitest";

type StrengthDeltaMeters = (strength: terraform.TerraformStrength) => number;

describe("Terraform strength presentation metadata", () => {
  it("derives meter deltas from canonical strength levels and terrain elevation units", () => {
    const strengthDeltaMeters = (
      terraform as typeof terraform & {
        readonly strengthDeltaMeters?: StrengthDeltaMeters;
      }
    ).strengthDeltaMeters;

    expect(strengthDeltaMeters).toBeTypeOf("function");
    if (strengthDeltaMeters === undefined) return;

    for (const strength of ["fine", "normal", "strong"] as const) {
      expect(strengthDeltaMeters(strength)).toBe(
        terraform.strengthLevels(strength) * LOGICAL_ELEVATION_METERS,
      );
    }
  });
});
