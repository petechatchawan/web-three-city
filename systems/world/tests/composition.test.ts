import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import {
  createInitialWorldSystem,
  prepareProductionWorldDefinition,
} from "../src/composition";

function expectPrepared() {
  const result = prepareProductionWorldDefinition();
  expect(result.status).toBe("success");
  if (result.status !== "success") {
    throw new Error(`expected prepared World definition: ${result.code}`);
  }
  return result.value;
}

describe("World initial composition", () => {
  it("constructs the explicitly eligible starting Region as the only unlocked Region", () => {
    const prepared = expectPrepared();
    const result = createInitialWorldSystem({
      prepared,
      selectedStartingRegionId: "R06",
      eligibleStartingRegionIds: ["R08", "R06"],
    });

    expect(result.status).toBe("success");
    if (result.status !== "success") {
      throw new Error(`expected initial World: ${result.code}`);
    }

    const world = result.value;
    expect(world.definition).toBe(prepared);
    expect(world.spatial).toBe(prepared.spatial);
    expect(world.mapState).toEqual({
      mapDefinitionId: "web-three-city-production",
      startingRegionId: "R06",
      unlockedRegionIds: ["R06"],
    });
    expect(world.captureSnapshot()).toEqual({
      mapDefinitionId: "web-three-city-production",
      mapProfileId: "production-v1",
      mapProfileVersion: 1,
      startingRegionId: "R06",
      unlockedRegionIds: ["R06"],
    });
  });

  it("rejects an unknown selected Region before candidate eligibility", () => {
    const result = createInitialWorldSystem({
      prepared: expectPrepared(),
      selectedStartingRegionId: "R99",
      eligibleStartingRegionIds: ["R99"],
    });

    expect(result).toMatchObject({
      status: "rejected",
      code: "WORLD_REGION_UNKNOWN",
    });
  });

  it("rejects a known Region that is not a starting candidate", () => {
    const result = createInitialWorldSystem({
      prepared: expectPrepared(),
      selectedStartingRegionId: "R00",
      eligibleStartingRegionIds: ["R00"],
    });

    expect(result).toMatchObject({
      status: "rejected",
      code: "WORLD_STARTING_CANDIDATE_INVALID",
    });
  });

  it("rejects a starting candidate absent from the caller-provided eligible set", () => {
    const result = createInitialWorldSystem({
      prepared: expectPrepared(),
      selectedStartingRegionId: "R08",
      eligibleStartingRegionIds: ["R06"],
    });

    expect(result).toMatchObject({
      status: "rejected",
      code: "WORLD_STARTING_REGION_NOT_ELIGIBLE",
    });
  });

  it("keeps construction off the root surface and exposes no command subpath", async () => {
    const root = await import("../src/index");
    const composition = await import("../src/composition");

    expect(Object.keys(root)).toEqual([]);
    expect(Object.keys(composition).sort()).toEqual([
      "createInitialWorldSystem",
      "prepareProductionWorldDefinition",
    ]);
    expect(packageJson.exports).toEqual({
      ".": "./src/index.ts",
      "./composition": "./src/composition.ts",
    });
    expect(packageJson.exports).not.toHaveProperty("./commands");
  });
});
