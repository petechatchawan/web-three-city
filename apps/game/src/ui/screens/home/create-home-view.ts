import { createSurface } from "../../components/surface";
import { formatCityTimestamp } from "../../format-city-timestamp";
import { createButton } from "../../primitives/button";
import { createEmptyState } from "../../primitives/empty-state";
import type { StatefulUiHandle } from "../../primitives/types";
import type { HomeIntent, HomeViewState } from "./home-view-state";

export type HomeViewHandle = StatefulUiHandle<HomeViewState>;

export function createHomeView(input: {
  readonly onIntent: (intent: HomeIntent) => void;
}): HomeViewHandle {
  const element = document.createElement("main");
  element.className = "home-screen-v1";
  element.dataset.testid = "home-screen";

  const backdrop = document.createElement("div");
  backdrop.className = "home-screen-v1__backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  const glowA = document.createElement("div");
  glowA.className = "home-screen-v1__glow home-screen-v1__glow--a";
  const glowB = document.createElement("div");
  glowB.className = "home-screen-v1__glow home-screen-v1__glow--b";
  backdrop.append(glowA, glowB);

  const shell = document.createElement("section");
  shell.className = "home-screen-v1__shell";
  const eyebrow = document.createElement("p");
  eyebrow.className = "home-screen-v1__eyebrow";
  eyebrow.textContent = "Deterministic city builder";
  const title = document.createElement("h1");
  title.className = "home-screen-v1__title";
  title.textContent = "Web Three City";
  const description = document.createElement("p");
  description.className = "home-screen-v1__description";
  description.textContent =
    "Shape the terrain, plan the network, and grow a city from one persistent world.";

  const actions = document.createElement("div");
  actions.className = "home-screen-v1__actions";
  const newCity = createButton({
    label: "New City",
    variant: "primary",
    onPress: () => input.onIntent({ type: "new-city" }),
  });
  const loadCity = createButton({
    label: "Load City",
    variant: "secondary",
    onPress: () => input.onIntent({ type: "load-city" }),
  });
  actions.append(newCity.element, loadCity.element);

  const resumeRegion = document.createElement("div");
  resumeRegion.className = "home-screen-v1__resume";
  const error = document.createElement("p");
  error.className = "city-screen__error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  shell.append(eyebrow, title, description, resumeRegion, actions, error);
  element.append(backdrop, shell);

  let resumeButton: ReturnType<typeof createButton> | undefined;
  let disposed = false;

  const clearResume = (): void => {
    resumeButton?.dispose();
    resumeButton = undefined;
    resumeRegion.replaceChildren();
  };

  return Object.freeze({
    element,
    render(state: HomeViewState): void {
      if (disposed) return;
      clearResume();
      const busy = state.phase === "resuming";
      newCity.element.disabled = busy;
      loadCity.element.disabled = busy;
      element.dataset.phase = state.phase;
      error.hidden = state.error === undefined;
      error.textContent = state.error ?? "";

      if (state.latest === undefined) {
        resumeRegion.append(
          createEmptyState({
            title: "No saved cities yet",
            description: "Create your first city to unlock Continue and Load.",
          }),
        );
        return;
      }

      const latest = state.latest;
      const card = createSurface({
        tone: "panel",
        title: latest.name,
        description: `Continue latest city · ${state.cityCount} saved ${state.cityCount === 1 ? "city" : "cities"}`,
      });
      const facts = document.createElement("div");
      facts.className = "city-save-facts";
      const seed = document.createElement("span");
      seed.textContent = `Seed ${latest.selectedSeed64}`;
      const played = document.createElement("span");
      played.textContent = `Last played ${formatCityTimestamp(latest.lastPlayedAt)}`;
      const revision = document.createElement("span");
      revision.textContent = `Terrain revision ${latest.terrainRevision}`;
      facts.append(seed, played, revision);
      resumeButton = createButton({
        label: "Resume " + latest.name,
        variant: "primary",
        onPress: () => input.onIntent({ type: "resume" }),
      });
      resumeButton.element.disabled = busy;
      card.content.append(facts, resumeButton.element);
      resumeRegion.append(card.element);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clearResume();
      newCity.dispose();
      loadCity.dispose();
    },
  });
}
