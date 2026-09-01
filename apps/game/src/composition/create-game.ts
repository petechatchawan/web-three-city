import { createCitySessionService } from "@web-three-city/orchestration-city-session/composition";
import {
  createCityNavigationCoordinator,
  type CityNavigationCoordinator,
} from "../application/navigation/create-city-navigation-coordinator";
import { createBrowserClock } from "../environment/create-browser-clock";
import { createBrowserIdSource } from "../environment/create-browser-id-source";
import { createBrowserSeedSource } from "../environment/create-browser-seed-source";
import { createIndexedDbCitySaveRepository } from "../persistence/create-indexeddb-city-save-repository";
import { createStartupErrorScreen } from "../ui/screens/create-startup-error-screen";
import type { ScreenHandle } from "../ui/screens/screen-types";
import { citySessionErrorMessage } from "./city-session-error-message";
import { createTerrainLifecycleAdapter } from "./systems/terrain-lifecycle-adapter";
import { createWorldLifecycleAdapter } from "./systems/world-lifecycle-adapter";

export interface GameApplication {
  dispose(): void;
}

function unknownStartupMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? `Application startup failed: ${error.message}`
    : "Application startup failed.";
}

export async function createGame(mount: HTMLElement): Promise<GameApplication> {
  mount.dataset.bootstrap = "booting";
  delete mount.dataset.screen;
  delete mount.dataset.error;
  mount.replaceChildren();

  const repository = createIndexedDbCitySaveRepository();
  const service = createCitySessionService({
    world: createWorldLifecycleAdapter(),
    terrain: createTerrainLifecycleAdapter(),
    repository,
    clock: createBrowserClock(),
    ids: createBrowserIdSource(),
  });
  const seedSource = createBrowserSeedSource();

  let coordinator: CityNavigationCoordinator | undefined;
  let startupError: ScreenHandle | undefined;
  let disposed = false;

  const showStartupError = (message: string): void => {
    coordinator?.dispose();
    coordinator = undefined;
    startupError?.dispose();
    startupError = createStartupErrorScreen(message);
    mount.replaceChildren(startupError.element);
    mount.dataset.screen = "startup-error";
    mount.dataset.bootstrap = "error";
  };

  try {
    const initialCities = await service.listCities();
    if (initialCities.status !== "success") {
      showStartupError(citySessionErrorMessage(initialCities.code));
    } else {
      coordinator = createCityNavigationCoordinator({
        mount,
        service,
        seedSource,
        initialCities: initialCities.value,
        formatError: citySessionErrorMessage,
      });
      coordinator.start();
      mount.dataset.bootstrap = "ready";
    }
  } catch (error) {
    showStartupError(unknownStartupMessage(error));
  }

  return Object.freeze({
    dispose(): void {
      if (disposed) return;
      disposed = true;
      coordinator?.dispose();
      coordinator = undefined;
      startupError?.dispose();
      startupError = undefined;
      repository.dispose();
      mount.replaceChildren();
      delete mount.dataset.bootstrap;
      delete mount.dataset.screen;
      delete mount.dataset.error;
    },
  });
}
