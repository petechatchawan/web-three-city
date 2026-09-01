import { describe, expect, it } from "vitest";
import type {
  CitySessionService,
  LiveCitySession,
  NewCityPreview,
} from "@web-three-city/orchestration-city-session";
import { createNewCityScreenController } from "../src/application/screens/create-new-city-screen-controller";
import type { NewCityView } from "../src/ui/screens/new-city/create-new-city-view";

function preview(seed64: string): NewCityPreview {
  return Object.freeze({
    name: "Preview City",
    seed64,
    fingerprint: "0x1111222233334444",
    eligibleStartingRegionIds: Object.freeze(["R06"]),
    preparedWorld: Object.freeze({}) as NewCityPreview["preparedWorld"],
    preparedTerrain: Object.freeze({}) as NewCityPreview["preparedTerrain"],
  }) as unknown as NewCityPreview;
}

function liveSession(): LiveCitySession {
  return Object.freeze({}) as LiveCitySession;
}

function fakeView(): NewCityView {
  const previewMount = {
    dataset: {} as DOMStringMap,
    querySelectorAll: () => [] as unknown as NodeListOf<HTMLCanvasElement>,
  } as unknown as HTMLElement;
  return {
    element: {} as HTMLElement,
    previewMount,
    render: () => undefined,
    dispose: () => undefined,
  };
}

describe("NewCityScreenController", () => {
  it("reuses the exact prepared preview object when creating the city", async () => {
    const preparedPreview = preview("0xAAAAAAAAAAAAAAAA");
    let createInput:
      | Parameters<CitySessionService["createNewCity"]>[0]
      | undefined;
    const controller = createNewCityScreenController({
      service: {
        prepareNewCity: () => ({ status: "success", value: preparedPreview }),
        createNewCity: async (input) => {
          createInput = input;
          return { status: "success", value: liveSession() };
        },
      },
      initialSeed64: "0xAAAAAAAAAAAAAAAA",
      randomSeed64: () => "0xBBBBBBBBBBBBBBBB",
      formatError: (code) => code,
      previewFactory: { create: () => undefined },
      createView: () => fakeView(),
      onBack: () => undefined,
      onCreateSuccess: () => undefined,
    });

    await controller.intent({ type: "name-changed", value: "Preview City" });
    await controller.intent({ type: "generate" });
    await controller.intent({ type: "select-region", regionId: "R06" });
    await controller.intent({ type: "create" });

    expect(createInput).toBeDefined();
    expect(createInput?.preview).toBe(preparedPreview);
    controller.dispose();
  });

  it("marks a prepared preview stale when seed changes and blocks create until regeneration", async () => {
    const previewA = preview("0xAAAAAAAAAAAAAAAA");
    const previewB = preview("0xBBBBBBBBBBBBBBBB");
    let prepareCount = 0;
    let createCount = 0;
    const controller = createNewCityScreenController({
      service: {
        prepareNewCity: () => ({
          status: "success",
          value: prepareCount++ === 0 ? previewA : previewB,
        }),
        createNewCity: async () => {
          createCount += 1;
          return { status: "success", value: liveSession() };
        },
      },
      initialSeed64: "0xAAAAAAAAAAAAAAAA",
      randomSeed64: () => "0xBBBBBBBBBBBBBBBB",
      formatError: (code) => code,
      previewFactory: { create: () => undefined },
      createView: () => fakeView(),
      onBack: () => undefined,
      onCreateSuccess: () => undefined,
    });

    await controller.intent({ type: "name-changed", value: "Preview City" });
    await controller.intent({ type: "generate" });
    expect(controller.state().previewFresh).toBe(true);

    await controller.intent({
      type: "seed-changed",
      value: "0xBBBBBBBBBBBBBBBB",
    });
    expect(controller.state().previewFresh).toBe(false);
    await controller.intent({ type: "select-region", regionId: "R06" });
    await controller.intent({ type: "create" });
    expect(createCount).toBe(0);

    await controller.intent({ type: "generate" });
    expect(controller.state().previewFresh).toBe(true);
    expect(controller.state().preview).toBe(previewB);
    await controller.intent({ type: "select-region", regionId: "R06" });
    await controller.intent({ type: "create" });
    expect(createCount).toBe(1);
    controller.dispose();
  });
});
