import type {
  CityId,
  CitySaveSummary,
} from "@web-three-city/orchestration-city-session";
import { createButton } from "../primitives/button";
import { createCard } from "../primitives/card";
import { createEmptyState } from "../primitives/empty-state";
import { formatCityTimestamp } from "../format-city-timestamp";
import { createScreenFrame, type ScreenHandle } from "./screen-types";

export interface LoadCityScreenHandle extends ScreenHandle {
  setCities(cities: readonly CitySaveSummary[]): void;
  setBusy(cityId: CityId | undefined): void;
  setError(message: string | undefined): void;
}

export function createLoadCityScreen(input: {
  readonly cities: readonly CitySaveSummary[];
  readonly onBack: () => void;
  readonly onLoad: (cityId: CityId) => void;
}): LoadCityScreenHandle {
  const frame = createScreenFrame({
    eyebrow: "Saved cities",
    title: "Load City",
    description: "Restore World and Terrain from canonical saved authority.",
  });
  const backButton = createButton({
    label: "Back",
    variant: "ghost",
    onPress: input.onBack,
  });
  frame.header.prepend(backButton.element);

  const error = document.createElement("p");
  error.className = "city-screen__error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  const status = document.createElement("p");
  status.className = "city-screen__status";
  status.setAttribute("aria-live", "polite");
  const list = document.createElement("div");
  list.className = "city-save-list";
  frame.body.append(error, status, list);

  let cityButtons: Array<{
    readonly city: CitySaveSummary;
    readonly button: ReturnType<typeof createButton>;
  }> = [];
  const render = (cities: readonly CitySaveSummary[]): void => {
    for (const entry of cityButtons) entry.button.dispose();
    cityButtons = [];
    list.replaceChildren();

    if (cities.length === 0) {
      list.append(
        createEmptyState({
          title: "No saved cities",
          description: "Create a new city before using the Load workflow.",
        }),
      );
      return;
    }

    for (const city of cities) {
      const card = createCard({
        title: city.name,
        description: `Seed ${city.selectedSeed64}`,
      });
      const facts = document.createElement("div");
      facts.className = "city-save-facts";
      const revision = document.createElement("span");
      revision.textContent = `Revision ${city.terrainRevision}`;
      const region = document.createElement("span");
      region.textContent = `Start ${city.startingRegionId}`;
      const played = document.createElement("span");
      played.textContent = `Last played ${formatCityTimestamp(city.lastPlayedAt)}`;
      facts.append(revision, region, played);
      const load = createButton({
        label: `Load ${city.name}`,
        variant: "primary",
        onPress: () => input.onLoad(city.cityId),
      });
      cityButtons.push({ city, button: load });
      card.content.append(facts, load.element);
      list.append(card.element);
    }
  };
  render(input.cities);

  let disposed = false;
  const handle: LoadCityScreenHandle = {
    element: frame.element,
    setCities(cities): void {
      render(cities);
    },
    setBusy(cityId): void {
      const active = cityId !== undefined;
      backButton.element.disabled = active;
      for (const entry of cityButtons) entry.button.element.disabled = active;
      const selected = cityButtons.find(
        (entry) => entry.city.cityId === cityId,
      );
      status.textContent =
        selected === undefined ? "" : `Loading ${selected.city.name}…`;
      frame.element.dataset.busy = String(active);
    },
    setError(message): void {
      error.hidden = message === undefined;
      error.textContent = message ?? "";
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      backButton.dispose();
      for (const entry of cityButtons) entry.button.dispose();
      cityButtons = [];
    },
  };
  return Object.freeze(handle);
}
