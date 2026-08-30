import { describe, expect, it } from "vitest";
import * as terraform from "@web-three-city/terraform";
import * as composition from "@web-three-city/terraform/composition";

describe("terraform package", () => {
  it("exposes explicit root and composition surfaces", () => {
    expect(terraform).toBeDefined();
    expect(composition).toBeDefined();
  });
});
