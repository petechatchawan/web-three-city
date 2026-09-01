import type {
  CitySaveSummary,
  CitySessionFailureCode,
  CitySessionService,
  LiveCitySession,
} from "@web-three-city/orchestration-city-session";
import type { SeedSource } from "../../environment/create-browser-seed-source";
import {
  createLiveCityExperience,
  type LiveCityExperience,
} from "../../composition/create-live-city-experience";
import { newCityTerrainPreviewFactory } from "../../presentation/preview/create-new-city-terrain-preview";
import { createHomeScreenController } from "../screens/create-home-screen-controller";
import {
  createLoadCityScreenController,
  type LoadCityScreenController,
} from "../screens/create-load-city-screen-controller";
import {
  createNewCityScreenController,
  type NewCityScreenController,
} from "../screens/create-new-city-screen-controller";
import type { ScreenController } from "./screen-controller";
import { createTransitionGuard } from "./transition-guard";

export interface CityNavigationCoordinator {
  start(): void;
  dispose(): void;
}

export function createCityNavigationCoordinator(input: {
  readonly mount: HTMLElement;
  readonly service: CitySessionService;
  readonly seedSource: SeedSource;
  readonly initialCities: readonly CitySaveSummary[];
  readonly formatError: (code: CitySessionFailureCode) => string;
}): CityNavigationCoordinator {
  const guard = createTransitionGuard();
  let home: ScreenController | undefined;
  let loadScreen: LoadCityScreenController | undefined;
  let newScreen: NewCityScreenController | undefined;
  let liveExperience: LiveCityExperience | undefined;
  let currentSession: LiveCitySession | undefined;
  let disposed = false;
  let initialCities = input.initialCities;

  const clearHome = (): void => {
    home?.dispose();
    home = undefined;
  };
  const clearLoad = (): void => {
    loadScreen?.dispose();
    loadScreen = undefined;
  };
  const clearNew = (): void => {
    newScreen?.dispose();
    newScreen = undefined;
  };
  const clearLive = (): void => {
    liveExperience?.dispose();
    liveExperience = undefined;
    currentSession = undefined;
  };
  const clearPresentation = (): void => {
    clearHome();
    clearLoad();
    clearNew();
    clearLive();
  };
  const mountHome = (cities: readonly CitySaveSummary[]): void => {
    if (disposed) return;
    guard.cancel();
    clearPresentation();
    delete input.mount.dataset.error;
    const controller = createHomeScreenController({
      service: input.service,
      cities,
      formatError: input.formatError,
      onNewCity: enterNew,
      onLoadCity: enterLoad,
      onResumeSuccess: enterLive,
      onResumeEmpty: () => void refreshHome(),
    });
    home = controller;
    input.mount.replaceChildren(controller.element);
    input.mount.dataset.screen = "home";
  };
  const refreshHome = async (): Promise<void> => {
    if (disposed) return;
    const token = guard.begin();
    if (token === undefined) return;
    clearPresentation();
    const result = await input.service.listCities();
    if (!guard.isCurrent(token)) return;
    guard.finish(token);
    if (result.status !== "success") {
      const message = input.formatError(result.code);
      input.mount.dataset.error = message;
      mountHome([]);
      return;
    }
    initialCities = result.value;
    mountHome(result.value);
  };
  function enterNew(): void {
    if (disposed) return;
    guard.cancel();
    clearPresentation();
    const controller = createNewCityScreenController({
      service: input.service,
      initialSeed64: input.seedSource.nextSeed64(),
      randomSeed64: () => input.seedSource.nextSeed64(),
      formatError: input.formatError,
      previewFactory: newCityTerrainPreviewFactory,
      onBack: () => void refreshHome(),
      onCreateSuccess: enterLive,
    });
    newScreen = controller;
    input.mount.replaceChildren(controller.element);
    input.mount.dataset.screen = "new-city";
  }
  function enterLoad(): void {
    if (disposed) return;
    guard.cancel();
    clearPresentation();
    const controller = createLoadCityScreenController({
      service: input.service,
      formatError: input.formatError,
      onBack: () => void refreshHome(),
      onLoadSuccess: enterLive,
    });
    loadScreen = controller;
    input.mount.replaceChildren(controller.element);
    input.mount.dataset.screen = "load-city";
    void controller.start();
  }
  function enterLive(session: LiveCitySession): void {
    if (disposed) return;
    guard.cancel();
    clearPresentation();
    currentSession = session;
    input.mount.dataset.screen = "live-city";
    const experience = createLiveCityExperience({
      mount: input.mount,
      session,
      onSave: async () => {
        const active = currentSession;
        if (disposed || active === undefined) {
          return { status: "error", message: "City session is unavailable." };
        }
        const result = await input.service.saveCity(active);
        if (result.status !== "success") {
          return { status: "error", message: input.formatError(result.code) };
        }
        currentSession = result.value;
        return { status: "success" };
      },
      onExit: () => {
        if (disposed) return;
        clearLive();
        void refreshHome();
      },
    });
    liveExperience = experience;
  }

  return Object.freeze({
    start(): void {
      if (disposed) throw new Error("City navigation coordinator is disposed.");
      mountHome(initialCities);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      guard.dispose();
      clearPresentation();
      input.mount.replaceChildren();
      delete input.mount.dataset.screen;
      delete input.mount.dataset.error;
    },
  });
}
