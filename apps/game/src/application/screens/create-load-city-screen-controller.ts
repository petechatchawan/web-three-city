import type {
  CityId,
  CitySaveSummary,
  CitySessionFailureCode,
  CitySessionService,
  LiveCitySession,
} from "@web-three-city/orchestration-city-session";
import { createLoadCityView } from "../../ui/screens/load-city/create-load-city-view";
import type { LoadCityViewState } from "../../ui/screens/load-city/load-city-view-state";
import type { ScreenController } from "../navigation/screen-controller";

export interface LoadCityScreenController extends ScreenController {
  start(): Promise<void>;
}

export function createLoadCityScreenController(input: {
  readonly service: Pick<CitySessionService, "listCities" | "loadCity">;
  readonly formatError: (code: CitySessionFailureCode) => string;
  readonly onBack: () => void;
  readonly onLoadSuccess: (session: LiveCitySession) => void;
}): LoadCityScreenController {
  let disposed = false;
  let state: LoadCityViewState = { cities: [], phase: "idle" };
  const view = createLoadCityView({
    onIntent: (intent) => {
      if (disposed || state.phase === "loading") return;
      if (intent.type === "back") {
        input.onBack();
        return;
      }
      if (intent.type === "select") {
        state = {
          cities: state.cities,
          selectedCityId: intent.cityId,
          phase: "idle",
        };
        view.render(state);
        return;
      }
      void load(intent.cityId);
    },
  });

  const load = async (cityId: CityId): Promise<void> => {
    const selected = state.cities.some((city) => city.cityId === cityId);
    if (disposed || state.phase === "loading" || !selected) return;
    state = {
      cities: state.cities,
      selectedCityId: cityId,
      phase: "loading",
      loadingCityId: cityId,
    };
    view.render(state);
    const result = await input.service.loadCity(cityId);
    if (disposed) return;
    if (result.status !== "success") {
      state = {
        cities: state.cities,
        selectedCityId: cityId,
        phase: "idle",
        error: input.formatError(result.code),
      };
      view.render(state);
      return;
    }
    input.onLoadSuccess(result.value);
  };

  const start = async (): Promise<void> => {
    const result = await input.service.listCities();
    if (disposed) return;
    if (result.status !== "success") {
      state = {
        cities: [],
        phase: "idle",
        error: input.formatError(result.code),
      };
      view.render(state);
      return;
    }
    const cities: readonly CitySaveSummary[] = result.value;
    state = { cities, phase: "idle" };
    view.render(state);
  };

  view.render(state);
  return Object.freeze({
    element: view.element,
    start,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      view.dispose();
    },
  });
}
