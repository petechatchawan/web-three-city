import type {
  CitySaveSummary,
  CitySessionFailureCode,
  CitySessionService,
  LiveCitySession,
} from "@web-three-city/orchestration-city-session";
import { createHomeView } from "../../ui/screens/home/create-home-view";
import type { HomeViewState } from "../../ui/screens/home/home-view-state";
import type { ScreenController } from "../navigation/screen-controller";

export type HomeScreenController = ScreenController;

export function createHomeScreenController(input: {
  readonly service: Pick<CitySessionService, "resumeCity">;
  readonly cities: readonly CitySaveSummary[];
  readonly formatError: (code: CitySessionFailureCode) => string;
  readonly onNewCity: () => void;
  readonly onLoadCity: () => void;
  readonly onResumeSuccess: (session: LiveCitySession) => void;
  readonly onResumeEmpty: () => void;
}): HomeScreenController {
  let disposed = false;
  let state: HomeViewState = {
    ...(input.cities[0] === undefined ? {} : { latest: input.cities[0] }),
    cityCount: input.cities.length,
    phase: "idle",
  };

  const render = (): void => view.render(state);
  const resume = async (): Promise<void> => {
    if (disposed || state.phase !== "idle") return;
    state = {
      ...(state.latest === undefined ? {} : { latest: state.latest }),
      cityCount: state.cityCount,
      phase: "resuming",
    };
    render();
    const result = await input.service.resumeCity();
    if (disposed) return;
    if (result.status === "empty") {
      state = { cityCount: 0, phase: "idle" };
      render();
      input.onResumeEmpty();
      return;
    }
    if (result.status !== "success") {
      state = {
        ...state,
        phase: "idle",
        error: input.formatError(result.code),
      };
      render();
      return;
    }
    input.onResumeSuccess(result.value);
  };

  const view = createHomeView({
    onIntent: (intent) => {
      if (disposed || state.phase !== "idle") return;
      if (intent.type === "new-city") {
        input.onNewCity();
        return;
      }
      if (intent.type === "load-city") {
        input.onLoadCity();
        return;
      }
      void resume();
    },
  });

  render();
  return Object.freeze({
    element: view.element,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      view.dispose();
    },
  });
}
