import { describe, expect, it } from "vitest";
import {
  createTerraformToolViewState,
  type TerraformToolViewState,
} from "../src/ui/tools/terraform/terraform-tool-view-state";

describe("Terraform tool view state", () => {
  it("starts with frozen product defaults without duplicating active-tool authority", () => {
    const state = createTerraformToolViewState();

    expect(state).toEqual({
      operation: "raise",
      brushSize: 1,
      strength: "normal",
      undoDepth: 0,
      validity: "idle",
    } satisfies TerraformToolViewState);
    expect(Object.isFrozen(state)).toBe(true);
    expect("active" in state).toBe(false);
    expect("flattenTargetMeters" in state).toBe(false);
    expect("message" in state).toBe(false);
  });
});
