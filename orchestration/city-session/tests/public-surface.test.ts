import { describe, expect, it } from "vitest";
import packageJson from "../package.json";

const EXPECTED_EXPORTS = {
  ".": "./src/index.ts",
  "./composition": "./src/composition.ts",
} as const;

describe("city-session package boundary", () => {
  it("publishes only root contracts and a composition construction surface", async () => {
    const root = await import("../src/index");
    const composition = await import("../src/composition");

    expect(packageJson.exports).toEqual(EXPECTED_EXPORTS);
    expect(Object.keys(root).sort()).toEqual([
      "CITY_NAME_MAX_LENGTH",
      "CITY_SAVE_SCHEMA_VERSION",
      "parseCityId",
      "parseCityName",
    ]);
    expect(Object.keys(composition)).toEqual([]);
  });

  it("depends on system root contracts without acquiring app or system composition packages", () => {
    expect(packageJson.dependencies).toEqual({
      "@web-three-city/terrain": "workspace:*",
      "@web-three-city/world": "workspace:*",
    });
  });
});
