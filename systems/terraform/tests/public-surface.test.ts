import { describe, expect, it } from "vitest";
import * as terraform from "@web-three-city/terraform";
import * as composition from "@web-three-city/terraform/composition";

describe("terraform package", () => {
  it("exposes the frozen TF1 root and composition surfaces", () => {
    expect(typeof terraform.buildBrushFootprint).toBe("function");
    expect(typeof terraform.strengthLevels).toBe("function");
    expect(typeof terraform.resolveFlattenCorner).toBe("function");
    expect(typeof terraform.selectFlattenReference).toBe("function");
    expect(typeof composition.planTerraform).toBe("function");
    expect(typeof composition.createTerraformUndoHistory).toBe("function");
  });
});
