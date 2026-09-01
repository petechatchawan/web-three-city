import { createBadge } from "../../primitives/badge";
import { createButton } from "../../primitives/button";
import { createCard } from "../../primitives/card";
import { createField } from "../../primitives/field";
import { createInput } from "../../primitives/input";
import type { NewCityIntent, NewCityViewState } from "./new-city-view-state";

export interface NewCityView {
  readonly element: HTMLElement;
  readonly previewMount: HTMLElement;
  render(state: NewCityViewState): void;
  dispose(): void;
}

export function createNewCityView(input: {
  readonly onIntent: (intent: NewCityIntent) => void;
}): NewCityView {
  const element = document.createElement("section");
  element.className = "screen-shell new-city-screen-v1";
  element.dataset.testid = "new-city-screen";

  const header = document.createElement("header");
  header.className = "screen-shell__header new-city-screen-v1__header";
  const back = createButton({
    label: "Back",
    variant: "ghost",
    onPress: () => input.onIntent({ type: "back" }),
  });
  const titleWrap = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "screen-shell__eyebrow";
  eyebrow.textContent = "New city";
  const title = document.createElement("h1");
  title.textContent = "Create a deterministic world";
  const description = document.createElement("p");
  description.textContent =
    "Generate Terrain once, preview that exact prepared surface, then choose a starting Region.";
  titleWrap.append(eyebrow, title, description);
  header.append(back.element, titleWrap);

  const body = document.createElement("div");
  body.className = "new-city-layout";

  const configCard = createCard({ title: "City configuration" });
  const form = document.createElement("form");
  form.className = "city-form new-city-layout__form";
  const nameInput = createInput({
    id: "new-city-name-v1",
    name: "cityName",
    placeholder: "My City",
    autocomplete: "off",
  });
  const nameField = createField({ label: "City name", control: nameInput });
  const seedInput = createInput({
    id: "new-city-seed-v1",
    name: "seed64",
    autocomplete: "off",
  });
  seedInput.spellcheck = false;
  const seedField = createField({
    label: "Terrain seed",
    control: seedInput,
    description: "Format: 0x followed by exactly 16 hexadecimal digits.",
  });
  const randomize = createButton({
    label: "Randomize seed",
    variant: "secondary",
    onPress: () => input.onIntent({ type: "randomize-seed" }),
  });
  const generate = createButton({
    label: "Generate terrain",
    variant: "primary",
    type: "submit",
  });
  const actions = document.createElement("div");
  actions.className = "city-form__actions";
  actions.append(randomize.element, generate.element);
  form.append(nameField.element, seedField.element, actions);
  configCard.content.append(form);

  const error = document.createElement("p");
  error.className = "city-screen__error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  configCard.content.append(error);

  const previewPanel = document.createElement("section");
  previewPanel.className = "new-city-layout__preview-panel";
  const previewMount = document.createElement("div");
  previewMount.className = "new-city-terrain-preview";
  previewMount.dataset.testid = "new-city-terrain-preview";
  previewMount.dataset.previewRuntime = "idle";
  previewMount.dataset.previewCanvasCount = "0";
  const previewDetails = document.createElement("div");
  previewDetails.className = "new-city-preview-details";
  previewPanel.append(previewMount, previewDetails);

  body.append(configCard.element, previewPanel);
  element.append(header, body);

  let regionListeners: Array<{
    readonly input: HTMLInputElement;
    readonly listener: () => void;
  }> = [];
  let createCityButton: ReturnType<typeof createButton> | undefined;
  let disposed = false;

  const clearPreviewControls = (): void => {
    for (const entry of regionListeners) {
      entry.input.removeEventListener("change", entry.listener);
    }
    regionListeners = [];
    createCityButton?.dispose();
    createCityButton = undefined;
    previewDetails.replaceChildren();
  };

  const onNameInput = (): void =>
    input.onIntent({ type: "name-changed", value: nameInput.value });
  const onSeedInput = (): void =>
    input.onIntent({ type: "seed-changed", value: seedInput.value });
  const onSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    input.onIntent({ type: "generate" });
  };
  nameInput.addEventListener("input", onNameInput);
  seedInput.addEventListener("input", onSeedInput);
  form.addEventListener("submit", onSubmit);

  const render = (state: NewCityViewState): void => {
    if (disposed) return;
    if (nameInput.value !== state.name) nameInput.value = state.name;
    if (seedInput.value !== state.seed64) seedInput.value = state.seed64;
    const busy = state.phase === "generating" || state.phase === "creating";
    nameInput.disabled = busy;
    seedInput.disabled = busy;
    randomize.element.disabled = busy;
    generate.element.disabled = busy;
    back.element.disabled = busy;
    element.dataset.phase = state.phase;
    element.dataset.previewFresh = String(state.previewFresh);
    error.hidden = state.error === undefined;
    error.textContent = state.error ?? "";

    clearPreviewControls();
    if (state.preview === undefined) {
      const empty = document.createElement("div");
      empty.className = "new-city-preview-details__empty";
      empty.textContent = "Generate terrain to start the live preview.";
      previewDetails.append(empty);
      return;
    }

    const meta = document.createElement("div");
    meta.className = "new-city-preview__meta";
    meta.append(
      createBadge({ label: state.preview.seed64 }),
      createBadge({ label: state.preview.fingerprint, tone: "success" }),
    );
    const freshness = document.createElement("p");
    freshness.className = "new-city-preview__freshness";
    freshness.textContent = state.previewFresh
      ? "Preview matches the current configuration."
      : "Configuration changed. Generate again before creating the city.";

    const fieldset = document.createElement("fieldset");
    fieldset.className = "region-picker";
    const legend = document.createElement("legend");
    legend.textContent = "Starting Region";
    fieldset.append(legend);
    for (const regionId of state.preview.eligibleStartingRegionIds) {
      const label = document.createElement("label");
      label.className = "region-picker__option";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "startingRegion";
      radio.value = regionId;
      radio.checked = state.selectedRegionId === regionId;
      radio.disabled = busy || !state.previewFresh;
      const listener = (): void =>
        input.onIntent({ type: "select-region", regionId });
      radio.addEventListener("change", listener);
      regionListeners.push({ input: radio, listener });
      const text = document.createElement("span");
      text.textContent = regionId;
      label.append(radio, text);
      fieldset.append(label);
    }

    createCityButton = createButton({
      label: "Create city",
      variant: "primary",
      onPress: () => input.onIntent({ type: "create" }),
    });
    createCityButton.element.disabled =
      busy || !state.previewFresh || state.selectedRegionId === undefined;
    previewDetails.append(meta, freshness, fieldset, createCityButton.element);
  };

  return Object.freeze({
    element,
    previewMount,
    render,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      clearPreviewControls();
      nameInput.removeEventListener("input", onNameInput);
      seedInput.removeEventListener("input", onSeedInput);
      form.removeEventListener("submit", onSubmit);
      back.dispose();
      randomize.dispose();
      generate.dispose();
    },
  });
}
