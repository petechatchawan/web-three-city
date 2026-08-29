import type {
  CityId,
  CitySaveSummary,
} from "@web-three-city/orchestration-city-session";
import { createButton } from "../primitives/button";
import { createCard } from "../primitives/card";
import { createEmptyState } from "../primitives/empty-state";
import { createScreenFrame, type ScreenHandle } from "./screen-types";

export interface LoadCityScreenHandle extends ScreenHandle {
  setCities(cities: readonly CitySaveSummary[]): void;
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
  const list = document.createElement("div");
  list.className = "city-save-list";
  frame.body.append(error, list);

  let cityButtons: ReturnType<typeof createButton>[] = [];
  const render = (cities: readonly CitySaveSummary[]): void => {
    for (const button of cityButtons) button.dispose();
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
      facts.append(revision, region);
      const load = createButton({
        label: `Load ${city.name}`,
        variant: "primary",
        onPress: () => input.onLoad(city.cityId),
      });
      cityButtons.push(load);
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
    setError(message): void {
      error.hidden = message === undefined;
      error.textContent = message ?? "";
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      backButton.dispose();
      for (const button of cityButtons) button.dispose();
      cityButtons = [];
    },
  };
  return Object.freeze(handle);
}
