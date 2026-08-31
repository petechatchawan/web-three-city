import type { UiHandle } from "./types";

export interface SliderHandle extends UiHandle<HTMLLabelElement> {
  readonly input: HTMLInputElement;
}

export function createSlider(input: {
  readonly id: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  readonly value: number;
  readonly onChange?: (value: number) => void;
}): SliderHandle {
  const element = document.createElement("label");
  element.className = "ui-slider";
  element.htmlFor = input.id;
  const text = document.createElement("span");
  text.className = "ui-slider__label";
  text.textContent = input.label;
  const control = document.createElement("input");
  control.type = "range";
  control.id = input.id;
  control.min = String(input.min);
  control.max = String(input.max);
  control.step = String(input.step ?? 1);
  control.value = String(input.value);
  element.append(text, control);

  const listener =
    input.onChange === undefined
      ? undefined
      : () => input.onChange?.(Number(control.value));
  if (listener !== undefined) control.addEventListener("input", listener);
  let disposed = false;
  return Object.freeze({
    element,
    input: control,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (listener !== undefined)
        control.removeEventListener("input", listener);
    },
  });
}
