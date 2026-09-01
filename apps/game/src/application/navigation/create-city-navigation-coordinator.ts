import type {
  CitySaveSummary,
  CitySessionFailureCode,
  CitySessionService,
  LiveCitySession,
} from "@web-three-city/orchestration-city-session";
import type { SeedSource } from "../../environment/create-browser-seed-source";
import {
  createCityLifecycleCoordinator,
  type CityLifecycleCoordinator,
} from "../../composition/create-city-lifecycle-coordinator";
import { createHomeScreenController } from "../screens/create-home-screen-controller";
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
  let legacy: CityLifecycleCoordinator | undefined;
  let disposed = false;
  let initialCities = input.initialCities;

  const clearHome = (): void => {
    home?.dispose();
    home = undefined;
  };
  const clearLegacy = (): void => {
    legacy?.dispose();
    legacy = undefined;
  };
  const mountHome = (cities: readonly CitySaveSummary[]): void => {
    if (disposed) return;
    guard.cancel();
    clearLegacy();
    clearHome();
    delete input.mount.dataset.error;
    const controller = createHomeScreenController({
      service: input.service,
      cities,
      formatError: input.formatError,
      onNewCity: () => enterLegacy("new"),
      onLoadCity: () => enterLegacy("load"),
      onResumeSuccess: (session) => enterLive(session),
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
    clearLegacy();
    clearHome();
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
  const createLegacy = (): CityLifecycleCoordinator => {
    clearHome();
    clearLegacy();
    const coordinator = createCityLifecycleCoordinator({
      mount: input.mount,
      service: input.service,
      seedSource: input.seedSource,
      onHomeRequested: () => void refreshHome(),
    });
    legacy = coordinator;
    return coordinator;
  };
  const enterLegacy = (screen: "new" | "load"): void => {
    if (disposed) return;
    guard.cancel();
    const coordinator = createLegacy();
    if (screen === "new") coordinator.showNewCity();
    else coordinator.showLoadCity();
  };
  const enterLive = (session: LiveCitySession): void => {
    if (disposed) return;
    guard.cancel();
    createLegacy().showLive(session);
  };

  return Object.freeze({
    start(): void {
      if (disposed) throw new Error("City navigation coordinator is disposed.");
      mountHome(initialCities);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      guard.dispose();
      clearHome();
      clearLegacy();
      input.mount.replaceChildren();
      delete input.mount.dataset.screen;
      delete input.mount.dataset.error;
    },
  });
}
