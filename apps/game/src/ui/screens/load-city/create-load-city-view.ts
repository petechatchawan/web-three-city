import { createSurface } from "../../components/surface";
import { createButton } from "../../primitives/button";
import { createEmptyState } from "../../primitives/empty-state";
import { formatCityTimestamp } from "../../format-city-timestamp";
import type { LoadCityIntent, LoadCityViewState } from "./load-city-view-state";

export interface LoadCityView {
  readonly element: HTMLElement;
  render(state: LoadCityViewState): void;
  dispose(): void;
}

export function createLoadCityView(input: {
  readonly onIntent: (intent: LoadCityIntent) => void;
}): LoadCityView {
  const element = document.createElement("section");
  element.className = "screen-shell load-city-screen";
  element.dataset.testid = "load-city-screen";

  const header = document.createElement("header");
  header.className = "screen-shell__header load-city-screen__header";
  const titleWrap = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "screen-shell__eyebrow";
  eyebrow.textContent = "Saved cities";
  const title = document.createElement("h1");
  title.textContent = "Load City";
  const description = document.createElement("p");
  description.textContent =
    "Choose a save, review its canonical metadata, then restore explicitly.";
  titleWrap.append(eyebrow, title, description);
  const back = createButton({
    label: "Back",
    variant: "ghost",
    onPress: () => input.onIntent({ type: "back" }),
  });
  header.append(back.element, titleWrap);

  const body = document.createElement("div");
  body.className = "load-city-browser";
  const list = document.createElement("div");
  list.className = "load-city-browser__list";
  list.setAttribute("aria-label", "Saved cities");
  const detail = document.createElement("aside");
  detail.className = "load-city-browser__detail";
  detail.dataset.testid = "load-city-detail";
  body.append(list, detail);

  const error = document.createElement("p");
  error.className = "city-screen__error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  element.append(header, error, body);

  let selectButtons: ReturnType<typeof createButton>[] = [];
  let loadButton: ReturnType<typeof createButton> | undefined;
  let disposed = false;

  const clearInteractive = (): void => {
    for (const button of selectButtons) button.dispose();
    selectButtons = [];
    loadButton?.dispose();
    loadButton = undefined;
  };

  const render = (state: LoadCityViewState): void => {
    if (disposed) return;
    clearInteractive();
    list.replaceChildren();
    detail.replaceChildren();
    const busy = state.phase === "loading";
    back.element.disabled = busy;
    error.hidden = state.error === undefined;
    error.textContent = state.error ?? "";
    element.dataset.phase = state.phase;

    if (state.cities.length === 0) {
      list.append(
        createEmptyState({
          title: "No saved cities",
          description: "Create a city before using the Load workflow.",
        }),
      );
      detail.append(
        createEmptyState({
          title: "Select a saved city",
          description:
            "Save details appear here without restoring gameplay state.",
        }),
      );
      return;
    }

    for (const city of state.cities) {
      const card = createSurface({
        tone: "panel",
        title: city.name,
        description: `Last played ${formatCityTimestamp(city.lastPlayedAt)}`,
      });
      const select = createButton({
        label: `Select ${city.name}`,
        variant: state.selectedCityId === city.cityId ? "primary" : "secondary",
        onPress: () => input.onIntent({ type: "select", cityId: city.cityId }),
      });
      select.element.disabled = busy;
      select.element.setAttribute(
        "aria-pressed",
        String(state.selectedCityId === city.cityId),
      );
      selectButtons.push(select);
      card.content.append(select.element);
      list.append(card.element);
    }

    const selected = state.cities.find(
      (city) => city.cityId === state.selectedCityId,
    );
    if (selected === undefined) {
      detail.append(
        createEmptyState({
          title: "Select a saved city",
          description:
            "Review seed, revision, starting Region and last played time before loading.",
        }),
      );
      const disabledLoad = createButton({
        label: "Load City",
        variant: "primary",
      });
      disabledLoad.element.disabled = true;
      loadButton = disabledLoad;
      detail.append(disabledLoad.element);
      return;
    }

    const detailCard = createSurface({
      tone: "panel",
      title: selected.name,
      description: "Canonical save summary",
    });
    const facts = document.createElement("div");
    facts.className = "city-save-facts load-city-browser__facts";
    const seed = document.createElement("span");
    seed.textContent = `Seed ${selected.selectedSeed64}`;
    const revision = document.createElement("span");
    revision.textContent = `Terrain revision ${selected.terrainRevision}`;
    const region = document.createElement("span");
    region.textContent = `Starting Region ${selected.startingRegionId}`;
    const played = document.createElement("span");
    played.textContent = `Last played ${formatCityTimestamp(selected.lastPlayedAt)}`;
    facts.append(seed, revision, region, played);
    const load = createButton({
      label: "Load City",
      variant: "primary",
      onPress: () => input.onIntent({ type: "load", cityId: selected.cityId }),
    });
    load.element.disabled = busy;
    loadButton = load;
    if (state.loadingCityId === selected.cityId) {
      load.element.textContent = `Loading ${selected.name}…`;
    }
    detailCard.content.append(facts, load.element);
    detail.append(detailCard.element);
  };

  return Object.freeze({
    element,
    render,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clearInteractive();
      back.dispose();
    },
  });
}
