import "../src/style.css";
import {
  parseCityId,
  parseCityName,
  type LiveCitySession,
} from "@web-three-city/orchestration-city-session";
import { createLiveCityExperience } from "../src/composition/create-live-city-experience";
import { createTerrainLifecycleAdapter } from "../src/composition/systems/terrain-lifecycle-adapter";
import { createWorldLifecycleAdapter } from "../src/composition/systems/world-lifecycle-adapter";

const mount = document.querySelector<HTMLElement>("#live-city-test");
if (mount === null) throw new Error("Live city test mount missing.");

function requiredId(value: string) {
  const parsed = parseCityId(value);
  if (parsed.status !== "success") throw new Error("Invalid test CityId.");
  return parsed.value;
}

function requiredName(value: string) {
  const parsed = parseCityName(value);
  if (parsed.status !== "success") throw new Error("Invalid test CityName.");
  return parsed.value;
}

const worldAdapter = createWorldLifecycleAdapter();
const terrainAdapter = createTerrainLifecycleAdapter();
const preparedWorld = worldAdapter.prepareDefinition();
if (preparedWorld.status !== "success") {
  throw new Error(`World prepare failed: ${preparedWorld.code}`);
}
const preparedTerrain = terrainAdapter.prepare(
  preparedWorld.value,
  "0x5EED5EED5EED5EED",
);
if (preparedTerrain.status !== "success") {
  throw new Error(`Terrain prepare failed: ${preparedTerrain.code}`);
}
const world = worldAdapter.createInitial({
  prepared: preparedWorld.value,
  selectedStartingRegionId: "R06",
  eligibleStartingRegionIds: preparedTerrain.value.eligibleStartingRegionIds,
});
if (world.status !== "success") {
  throw new Error(`World create failed: ${world.code}`);
}
const terrain = terrainAdapter.create(
  world.value.spatial,
  preparedTerrain.value,
);
if (terrain.status !== "success") {
  throw new Error(`Terrain create failed: ${terrain.code}`);
}

const session: LiveCitySession = {
  metadata: {
    cityId: requiredId("live-city-test"),
    name: requiredName("Live City"),
    createdAt: "2026-08-30T00:00:00.000Z",
    updatedAt: "2026-08-30T00:00:00.000Z",
    lastPlayedAt: "2026-08-30T00:00:00.000Z",
  },
  world: world.value,
  terrain: terrain.value,
};

let saveCount = 0;
let exitCount = 0;
const experience = createLiveCityExperience({
  mount,
  session,
  onSave: async () => {
    saveCount += 1;
    mount.dataset.saves = String(saveCount);
    return { status: "success" } as const;
  },
  onExit: () => {
    exitCount += 1;
    mount.dataset.exits = String(exitCount);
    experience?.dispose();
  },
});
mount.dataset.saves = "0";
mount.dataset.exits = "0";

window.addEventListener(
  "pagehide",
  () => {
    experience?.dispose();
  },
  { once: true },
);
