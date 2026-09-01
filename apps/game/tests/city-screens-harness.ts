import "../src/style.css";
import {
  parseCityId,
  parseCityName,
  type CitySaveSummary,
} from "@web-three-city/orchestration-city-session";
import { createHomeView } from "../src/ui/screens/home/create-home-view";
import type { HomeViewState } from "../src/ui/screens/home/home-view-state";
import { createLoadCityView } from "../src/ui/screens/load-city/create-load-city-view";
import type { LoadCityViewState } from "../src/ui/screens/load-city/load-city-view-state";
import { createNewCityScreen } from "../src/ui/screens/create-new-city-screen";

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
    phase: "idle" as const,
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
      if (value === undefined) {
        homeState = {
          ...(homeState.latest === undefined
            ? {}
            : { latest: homeState.latest }),
          cityCount: homeState.cityCount,
          phase: homeState.phase,
        };
      } else {
        homeState = { ...homeState, error: value };
      }
      view.render(homeState);
    },
  };
  (
    window as typeof window & {
      screenHandle?: typeof screenHandle;
    }
  ).screenHandle = screenHandle;
  dispose = view.dispose;
} else if (mode === "new") {
  const calls: string[] = [];
  const screen = createNewCityScreen({
    initialSeed64: "0xAAAAAAAAAAAAAAAA",
    onBack: () => calls.push("back"),
    onRandomizeSeed: () => "0x0123456789ABCDEF",
    onGenerate: (input) => {
      calls.push(`generate:${input.name}:${input.seed64}`);
      mount.dataset.calls = calls.join(",");
    },
    onCreateCity: (regionId) => {
      calls.push(`create:${regionId}`);
      mount.dataset.calls = calls.join(",");
    },
  });
  mount.append(screen.element);
  screen.element.addEventListener("click", () => {
    mount.dataset.calls = calls.join(",");
  });
  (
    window as typeof window & {
      screenHandle?: typeof screen;
    }
  ).screenHandle = screen;
  dispose = screen.dispose;
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
