import { describe, expect, it } from "vitest";
import { createTerrainLifecycleAdapter } from "../src/composition/systems/terrain-lifecycle-adapter";
import { createWorldLifecycleAdapter } from "../src/composition/systems/world-lifecycle-adapter";

const GOLDEN_SEED = "0x5EED5EED5EED5EED";

describe("game lifecycle adapters", () => {
  it("adapts World prepare/create/restore without changing owner snapshot semantics", () => {
    const world = createWorldLifecycleAdapter();
    const prepared = world.prepareDefinition();
    expect(prepared.status).toBe("success");
    if (prepared.status !== "success") return;

    const created = world.createInitial({
      prepared: prepared.value,
      selectedStartingRegionId: "R06",
      eligibleStartingRegionIds: ["R06", "R08"],
    });
    expect(created.status).toBe("success");
    if (created.status !== "success") return;

    const snapshot = created.value.captureSnapshot();
    const restored = world.restore(snapshot);
    expect(restored.status).toBe("success");
    if (restored.status !== "success") return;
    expect(restored.value.captureSnapshot()).toEqual(snapshot);
  });

  it("adapts Terrain prepare/create/restore and preserves exact canonical snapshot", () => {
    const world = createWorldLifecycleAdapter();
    const preparedWorld = world.prepareDefinition();
    expect(preparedWorld.status).toBe("success");
    if (preparedWorld.status !== "success") return;

    const terrain = createTerrainLifecycleAdapter();
    const preparedTerrain = terrain.prepare(preparedWorld.value, GOLDEN_SEED);
    expect(preparedTerrain.status).toBe("success");
    if (preparedTerrain.status !== "success") return;
    expect(preparedTerrain.value.selectedSeed64).toBe(GOLDEN_SEED);
    expect(preparedTerrain.value.eligibleStartingRegionIds).toEqual([
      "R06",
      "R08",
      "R11",
      "R13",
    ]);

    const created = terrain.create(
      preparedWorld.value.spatial,
      preparedTerrain.value,
    );
    expect(created.status).toBe("success");
    if (created.status !== "success") return;
    const snapshot = created.value.captureSnapshot();

    const restored = terrain.restore(preparedWorld.value.spatial, snapshot);
    expect(restored.status).toBe("success");
    if (restored.status !== "success") return;
    expect(restored.value.captureSnapshot()).toEqual(snapshot);
  });
});
