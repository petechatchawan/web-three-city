import type {
  CityId,
  CitySaveSummary,
  CitySessionService,
  LiveCitySession,
  NewCityPreview,
} from "@web-three-city/orchestration-city-session";
import type { RegionId } from "@web-three-city/world";
import type { SeedSource } from "../environment/create-browser-seed-source";
import {
  createLiveCityExperience,
  type LiveCityExperience,
} from "./create-live-city-experience";
import { citySessionErrorMessage } from "./city-session-error-message";
import { createHomeScreen } from "../ui/screens/create-home-screen";
import {
  createLoadCityScreen,
  type LoadCityScreenHandle,
} from "../ui/screens/create-load-city-screen";
import {
  createNewCityScreen,
  type NewCityScreenHandle,
} from "../ui/screens/create-new-city-screen";
import type { ScreenHandle } from "../ui/screens/screen-types";

export interface CityLifecycleCoordinator {
  start(): Promise<void>;
  dispose(): void;
}

export function createCityLifecycleCoordinator(input: {
  readonly mount: HTMLElement;
  readonly service: CitySessionService;
  readonly seedSource: SeedSource;
  readonly initialCities?: readonly CitySaveSummary[];
}): CityLifecycleCoordinator {
  let disposed = false;
  let transition = 0;
  let activeScreen: ScreenHandle | undefined;
  let liveExperience: LiveCityExperience | undefined;
  let currentSession: LiveCitySession | undefined;

  const nextTransition = (): number => {
    transition += 1;
    return transition;
  };
  const isCurrent = (token: number): boolean =>
    !disposed && transition === token;
  const clearPresentation = (): void => {
    activeScreen?.dispose();
    activeScreen = undefined;
    liveExperience?.dispose();
    liveExperience = undefined;
    input.mount.replaceChildren();
  };
  const showScreen = (name: string, screen: ScreenHandle): void => {
    clearPresentation();
    activeScreen = screen;
    input.mount.replaceChildren(screen.element);
    input.mount.dataset.screen = name;
  };
  const setMountError = (message?: string): void => {
    if (message === undefined) delete input.mount.dataset.error;
    else input.mount.dataset.error = message;
  };

  const enterLive = (session: LiveCitySession): void => {
    nextTransition();
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
          return {
            status: "error",
            message: citySessionErrorMessage(result.code),
          };
        }
        currentSession = result.value;
        return { status: "success" };
      },
      onExit: () => {
        if (disposed) return;
        liveExperience?.dispose();
        liveExperience = undefined;
        currentSession = undefined;
        void renderHome();
      },
    });
    liveExperience = experience;
  };

  const loadCity = async (
    cityId: CityId,
    screen: LoadCityScreenHandle,
    token: number,
  ): Promise<void> => {
    screen.setError(undefined);
    const result = await input.service.loadCity(cityId);
    if (!isCurrent(token)) return;
    if (result.status !== "success") {
      screen.setError(citySessionErrorMessage(result.code));
      return;
    }
    enterLive(result.value);
  };

  const renderLoad = async (): Promise<void> => {
    const token = nextTransition();
    const screen = createLoadCityScreen({
      cities: [],
      onBack: () => void renderHome(),
      onLoad: (cityId) => void loadCity(cityId, screen, token),
    });
    showScreen("load-city", screen);
    const listed = await input.service.listCities();
    if (!isCurrent(token)) return;
    if (listed.status !== "success") {
      screen.setError(citySessionErrorMessage(listed.code));
      return;
    }
    screen.setCities(listed.value);
  };

  const createFromPreview = async (
    screen: NewCityScreenHandle,
    preview: NewCityPreview,
    regionId: RegionId,
    token: number,
  ): Promise<void> => {
    screen.setBusy(true);
    screen.setError(undefined);
    const result = await input.service.createNewCity({
      preview,
      selectedStartingRegionId: regionId,
    });
    if (!isCurrent(token)) return;
    screen.setBusy(false);
    if (result.status !== "success") {
      screen.setError(citySessionErrorMessage(result.code));
      return;
    }
    enterLive(result.value);
  };

  const renderNew = (): void => {
    const token = nextTransition();
    let preview: NewCityPreview | undefined;
    const screen = createNewCityScreen({
      initialSeed64: input.seedSource.nextSeed64(),
      onBack: () => void renderHome(),
      onRandomizeSeed: () => input.seedSource.nextSeed64(),
      onGenerate: (request) => {
        if (!isCurrent(token)) return;
        screen.setError(undefined);
        screen.setBusy(true);
        const result = input.service.prepareNewCity(request);
        if (!isCurrent(token)) return;
        screen.setBusy(false);
        if (result.status !== "success") {
          preview = undefined;
          screen.setPreview(undefined);
          screen.setError(citySessionErrorMessage(result.code));
          return;
        }
        preview = result.value;
        screen.setPreview(preview);
      },
      onCreateCity: (regionId) => {
        if (!isCurrent(token) || preview === undefined) return;
        void createFromPreview(screen, preview, regionId, token);
      },
    });
    showScreen("new-city", screen);
  };

  const resumeLatest = async (token: number): Promise<void> => {
    const result = await input.service.resumeCity();
    if (!isCurrent(token)) return;
    if (result.status === "empty") {
      await renderHome();
      return;
    }
    if (result.status !== "success") {
      setMountError(citySessionErrorMessage(result.code));
      return;
    }
    enterLive(result.value);
  };

  const mountHome = (
    cities: readonly CitySaveSummary[],
    token: number,
  ): void => {
    if (!isCurrent(token)) return;
    const screen = createHomeScreen({
      latest: cities[0],
      cityCount: cities.length,
      onNewCity: renderNew,
      onLoadCity: () => void renderLoad(),
      onResume: () => void resumeLatest(token),
    });
    activeScreen = screen;
    input.mount.replaceChildren(screen.element);
    input.mount.dataset.screen = "home";
  };

  async function renderHome(): Promise<void> {
    const token = nextTransition();
    clearPresentation();
    setMountError(undefined);
    const listed = await input.service.listCities();
    if (!isCurrent(token)) return;
    if (listed.status !== "success") {
      setMountError(citySessionErrorMessage(listed.code));
      mountHome([], token);
      return;
    }
    mountHome(listed.value, token);
  }

  function renderInitialHome(cities: readonly CitySaveSummary[]): void {
    const token = nextTransition();
    clearPresentation();
    setMountError(undefined);
    mountHome(cities, token);
  }

  const coordinator: CityLifecycleCoordinator = {
    async start(): Promise<void> {
      if (disposed) throw new Error("City lifecycle coordinator is disposed.");
      if (input.initialCities !== undefined) {
        renderInitialHome(input.initialCities);
        return;
      }
      await renderHome();
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      nextTransition();
      currentSession = undefined;
      clearPresentation();
      delete input.mount.dataset.screen;
      delete input.mount.dataset.error;
    },
  };
  return Object.freeze(coordinator);
}
