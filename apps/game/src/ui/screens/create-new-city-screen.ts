import type { NewCityPreview } from "@web-three-city/orchestration-city-session";
import type { RegionId } from "@web-three-city/world";
import { createBadge } from "../primitives/badge";
import { createButton } from "../primitives/button";
import { createCard } from "../primitives/card";
import { createField } from "../primitives/field";
import { createInput } from "../primitives/input";
import { createScreenFrame, type ScreenHandle } from "./screen-types";

export interface NewCityScreenHandle extends ScreenHandle {
  setPreview(preview: NewCityPreview | undefined): void;
  setError(message: string | undefined): void;
  setBusy(busy: boolean): void;
}

export function createNewCityScreen(input: {
  readonly initialSeed64: string;
  readonly onBack: () => void;
  readonly onRandomizeSeed: () => string;
  readonly onGenerate: (input: {
    readonly name: string;
    readonly seed64: string;
  }) => void;
  readonly onCreateCity: (regionId: RegionId) => void;
}): NewCityScreenHandle {
  const frame = createScreenFrame({
    eyebrow: "New city",
    title: "Create a deterministic world",
    description:
      "Choose a name and Seed64. The same valid seed always produces the same terrain.",
  });
  const card = createCard();
  const form = document.createElement("form");
  form.className = "city-form";

  const nameInput = createInput({
    id: "new-city-name",
    name: "cityName",
    placeholder: "My City",
    autocomplete: "off",
  });
  const nameField = createField({ label: "City name", control: nameInput });

  const seedInput = createInput({
    id: "new-city-seed",
    name: "seed64",
    value: input.initialSeed64,
    autocomplete: "off",
  });
  seedInput.spellcheck = false;
  const seedField = createField({
    label: "Terrain seed",
    control: seedInput,
    description: "Format: 0x followed by exactly 16 hexadecimal digits.",
  });

  const randomizeButton = createButton({
    label: "Randomize seed",
    variant: "secondary",
    onPress: () => {
      seedInput.value = input.onRandomizeSeed();
    },
  });
  const generateButton = createButton({
    label: "Generate terrain",
    variant: "primary",
    type: "submit",
  });
  const formActions = document.createElement("div");
  formActions.className = "city-form__actions";
  formActions.append(randomizeButton.element, generateButton.element);
  form.append(nameField.element, seedField.element, formActions);
  card.content.append(form);

  const error = document.createElement("p");
  error.className = "city-screen__error";
  error.setAttribute("role", "alert");
  error.hidden = true;

  const previewRegion = document.createElement("section");
  previewRegion.className = "new-city-preview";
  previewRegion.hidden = true;

  const backButton = createButton({
    label: "Back",
    variant: "ghost",
    onPress: input.onBack,
  });
  frame.header.prepend(backButton.element);
  frame.body.append(card.element, error, previewRegion);

  let createActionButton: ReturnType<typeof createButton> | undefined;
  let currentPreview: NewCityPreview | undefined;

  const onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const name = nameInput.value.trim();
    if (name.length === 0) {
      nameField.error.textContent = "City name is required";
      nameField.error.hidden = false;
      return;
    }
    nameField.error.hidden = true;
    input.onGenerate({ name, seed64: seedInput.value.trim() });
  };
  form.addEventListener("submit", onSubmit);

  const renderPreview = (): void => {
    previewRegion.replaceChildren();
    createActionButton?.dispose();
    createActionButton = undefined;
    if (currentPreview === undefined) {
      previewRegion.hidden = true;
      return;
    }

    previewRegion.hidden = false;
    const previewCard = createCard({
      title: "Terrain ready",
      description:
        "Select an eligible starting Region before creating the city.",
    });
    const meta = document.createElement("div");
    meta.className = "new-city-preview__meta";
    meta.append(
      createBadge({ label: currentPreview.seed64 }),
      createBadge({ label: currentPreview.fingerprint, tone: "success" }),
    );

    const regions = document.createElement("fieldset");
    regions.className = "region-picker";
    const legend = document.createElement("legend");
    legend.textContent = "Starting Region";
    regions.append(legend);
    for (const [
      index,
      regionId,
    ] of currentPreview.eligibleStartingRegionIds.entries()) {
      const label = document.createElement("label");
      label.className = "region-picker__option";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "startingRegion";
      radio.value = regionId;
      radio.checked = index === 0;
      const text = document.createElement("span");
      text.textContent = regionId;
      label.append(radio, text);
      regions.append(label);
    }

    createActionButton = createButton({
      label: "Create city",
      variant: "primary",
      onPress: () => {
        const selected = regions.querySelector<HTMLInputElement>(
          'input[name="startingRegion"]:checked',
        );
        if (selected !== null) input.onCreateCity(selected.value as RegionId);
      },
    });
    previewCard.content.append(meta, regions, createActionButton.element);
    previewRegion.append(previewCard.element);
  };

  let disposed = false;
  const handle: NewCityScreenHandle = {
    element: frame.element,
    setPreview(preview): void {
      currentPreview = preview;
      renderPreview();
    },
    setError(message): void {
      error.hidden = message === undefined;
      error.textContent = message ?? "";
    },
    setBusy(busy): void {
      nameInput.disabled = busy;
      seedInput.disabled = busy;
      randomizeButton.element.disabled = busy;
      generateButton.element.disabled = busy;
      backButton.element.disabled = busy;
      if (createActionButton !== undefined) {
        createActionButton.element.disabled = busy;
      }
      frame.element.dataset.busy = String(busy);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      form.removeEventListener("submit", onSubmit);
      backButton.dispose();
      randomizeButton.dispose();
      generateButton.dispose();
      createActionButton?.dispose();
    },
  };
  return Object.freeze(handle);
}
