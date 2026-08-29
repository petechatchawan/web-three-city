import type {
  CityId,
  CitySaveSummary,
} from "@web-three-city/orchestration-city-session";
import { createButton } from "../primitives/button";
import { createCard } from "../primitives/card";
import { createEmptyState } from "../primitives/empty-state";
import { createScreenFrame, type ScreenHandle } from "./screen-types";

export function createHomeScreen(input: {
  readonly latest?: CitySaveSummary | undefined;
  readonly cityCount: number;
  readonly onNewCity: () => void;
  readonly onLoadCity: () => void;
  readonly onResume: (cityId: CityId) => void;
}): ScreenHandle {
  const frame = createScreenFrame({
    eyebrow: "Deterministic city builder",
    title: "Web Three City",
    description:
      "Create a new map, continue your latest city, or load a saved city.",
  });

  const actions = document.createElement("div");
  actions.className = "city-screen__actions";
  const newButton = createButton({
    label: "New City",
    variant: "primary",
    onPress: input.onNewCity,
  });
  const loadButton = createButton({
    label: "Load City",
    variant: "secondary",
    onPress: input.onLoadCity,
  });
  actions.append(newButton.element, loadButton.element);
  frame.body.append(actions);

  let resumeButton: ReturnType<typeof createButton> | undefined;
  if (input.latest === undefined) {
    frame.body.append(
      createEmptyState({
        title: "No saved cities yet",
        description:
          "Create your first city to enable Resume and Load workflows.",
      }),
    );
  } else {
    const latest = input.latest;
    const card = createCard({
      title: latest.name,
      description: `Latest city · ${input.cityCount} saved ${input.cityCount === 1 ? "city" : "cities"}`,
    });
    const facts = document.createElement("div");
    facts.className = "city-save-facts";
    const seed = document.createElement("span");
    seed.textContent = `Seed ${latest.selectedSeed64}`;
    const revision = document.createElement("span");
    revision.textContent = `Revision ${latest.terrainRevision}`;
    facts.append(seed, revision);
    resumeButton = createButton({
      label: `Resume ${latest.name}`,
      variant: "primary",
      onPress: () => input.onResume(latest.cityId),
    });
    card.content.append(facts, resumeButton.element);
    frame.body.prepend(card.element);
  }

  let disposed = false;
  return Object.freeze({
    element: frame.element,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      newButton.dispose();
      loadButton.dispose();
      resumeButton?.dispose();
    },
  });
}
