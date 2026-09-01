import "../src/style.css";
import {
  parseCityId,
  parseCityName,
  type CitySaveSummary,
  type NewCityPreview,
} from "@web-three-city/orchestration-city-session";
import { createHomeView } from "../src/ui/screens/home/create-home-view";
import type { HomeViewState } from "../src/ui/screens/home/home-view-state";
import { createLoadCityView } from "../src/ui/screens/load-city/create-load-city-view";
import type { LoadCityViewState } from "../src/ui/screens/load-city/load-city-view-state";
import { createNewCityView } from "../src/ui/screens/new-city/create-new-city-view";
import type { NewCityViewState } from "../src/ui/screens/new-city/new-city-view-state";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null)
    throw new Error(`Required element ${selector} missing.`);
  return element;
}

function summary(
  cityIdValue: string,
  nameValue: string,
  lastPlayedAt: string,
): CitySaveSummary {
  const cityId = parseCityId(cityIdValue);
  const name = parseCityName(nameValue);
  if (cityId.status !== "success" || name.status !== "success") {
    throw new Error("Invalid test city summary.");
  }
  return {
    cityId: cityId.value,
    name: name.value,
    updatedAt: lastPlayedAt,
    lastPlayedAt,
    selectedSeed64: "0x1234567890ABCDEF",
    fingerprint: "0x1111222233334444",
    terrainRevision: 3,
    startingRegionId: "R06",
  };
}

function newCityPreview(name: string, seed64: string): NewCityPreview {
  return Object.freeze({
    name,
    seed64,
    fingerprint: "0xF2FA29BFD2AEB069",
    eligibleStartingRegionIds: Object.freeze(["R06", "R08", "R11"]),
    preparedWorld: Object.freeze({}),
    preparedTerrain: Object.freeze({}),
  }) as unknown as NewCityPreview;
}

const mount = requiredElement<HTMLElement>("#city-screens-test");
mount.className = "screen-test-root";
const mode = new URLSearchParams(location.search).get("screen") ?? "home-empty";
let dispose = (): void => undefined;

if (mode === "home-empty" || mode === "home-populated") {
  const calls: string[] = [];
  const latest =
    mode === "home-populated"
      ? summary("city-a", "Metro Alpha", "2026-08-30T04:00:00.000Z")
      : undefined;
  let homeState: HomeViewState = {
    ...(latest === undefined ? {} : { latest }),
    cityCount: latest === undefined ? 0 : 3,
    phase: "idle",
  };
  const view = createHomeView({
    onIntent: (intent) => {
      if (intent.type === "new-city") calls.push("new");
      else if (intent.type === "load-city") calls.push("load");
      else calls.push(`resume:${latest?.cityId ?? "none"}`);
      mount.dataset.calls = calls.join(",");
    },
  });
  view.render(homeState);
  mount.append(view.element);
  const screenHandle = {
    render: view.render,
    setBusy(value: boolean): void {
      homeState = { ...homeState, phase: value ? "resuming" : "idle" };
      view.render(homeState);
    },
    setError(value?: string): void {
      homeState =
        value === undefined
          ? {
              ...(homeState.latest === undefined
                ? {}
                : { latest: homeState.latest }),
              cityCount: homeState.cityCount,
              phase: homeState.phase,
            }
          : { ...homeState, error: value };
      view.render(homeState);
    },
  };
  (
    window as typeof window & { screenHandle?: typeof screenHandle }
  ).screenHandle = screenHandle;
  dispose = view.dispose;
} else if (mode === "new") {
  const calls: string[] = [];
  let state: NewCityViewState = {
    name: "",
    seed64: "0xAAAAAAAAAAAAAAAA",
    phase: "configuring",
    previewFresh: false,
  };
  const view = createNewCityView({
    onIntent: (intent) => {
      if (intent.type === "back") {
        calls.push("back");
      } else if (intent.type === "name-changed") {
        state = { ...state, name: intent.value, previewFresh: false };
      } else if (intent.type === "seed-changed") {
        state = { ...state, seed64: intent.value, previewFresh: false };
      } else if (intent.type === "randomize-seed") {
        state = {
          ...state,
          seed64: "0x0123456789ABCDEF",
          phase: "configuring",
          previewFresh: false,
        };
      } else if (intent.type === "generate") {
        if (state.name.trim().length === 0) {
          state = { ...state, error: "City name is required" };
        } else {
          calls.push(`generate:${state.name.trim()}:${state.seed64.trim()}`);
          const preview = newCityPreview(
            state.name.trim(),
            state.seed64.trim(),
          );
          state = {
            name: state.name.trim(),
            seed64: state.seed64.trim(),
            phase: "preview-ready",
            preview,
            previewFresh: true,
          };
        }
      } else if (intent.type === "select-region") {
        state = { ...state, selectedRegionId: intent.regionId };
      } else if (intent.type === "create") {
        if (state.selectedRegionId !== undefined) {
          calls.push(`create:${state.selectedRegionId}`);
        }
      }
      mount.dataset.calls = calls.join(",");
      view.render(state);
    },
  });
  view.render(state);
  mount.append(view.element);
  dispose = view.dispose;
} else if (mode === "load-empty" || mode === "load-populated") {
  const calls: string[] = [];
  const cities =
    mode === "load-populated"
      ? [
          summary("city-a", "Metro Alpha", "2026-08-30T04:00:00.000Z"),
          summary("city-b", "Metro Beta", "2026-08-30T03:00:00.000Z"),
        ]
      : [];
  let loadState: LoadCityViewState = { cities, phase: "idle" };
  const view = createLoadCityView({
    onIntent: (intent) => {
      if (intent.type === "back") {
        calls.push("back");
      } else if (intent.type === "select") {
        calls.push(`select:${intent.cityId}`);
        loadState = {
          cities,
          selectedCityId: intent.cityId,
          phase: "idle",
        };
        view.render(loadState);
      } else {
        calls.push(`load:${intent.cityId}`);
      }
      mount.dataset.calls = calls.join(",");
    },
  });
  view.render(loadState);
  mount.append(view.element);
  dispose = view.dispose;
} else {
  throw new Error(`Unsupported screen test mode ${mode}`);
}

mount.dataset.ready = "true";
window.addEventListener("pagehide", dispose, { once: true });
