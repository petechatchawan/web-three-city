import { describe, expect, it } from "vitest";
import { createTerraformToolbarState } from "../src/ui/create-terraform-toolbar";

describe("Terraform toolbar defaults", () => {
  it("opens with frozen product defaults", () => {
    expect(createTerraformToolbarState()).toEqual({
      active: false,
      operation: "raise",
      brushSize: 1,
      strength: "normal",
      flattenTargetMeters: undefined,
      undoDepth: 0,
    });
  });
});
