import type {
  CityId,
  CitySaveSummary,
} from "@web-three-city/orchestration-city-session";

export interface LoadCityViewState {
  readonly cities: readonly CitySaveSummary[];
  readonly selectedCityId?: CityId;
  readonly phase: "idle" | "loading";
  readonly loadingCityId?: CityId;
  readonly error?: string;
}

export type LoadCityIntent =
  | { readonly type: "back" }
  | { readonly type: "select"; readonly cityId: CityId }
  | { readonly type: "load"; readonly cityId: CityId };
