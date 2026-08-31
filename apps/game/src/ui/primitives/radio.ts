import type { UiHandle } from "./types";

export interface RadioHandle extends UiHandle<HTMLLabelElement> {
  readonly input: HTMLInputElement;
}

export function createRadio(input: {
  readonly id: string;
  readonly name: string;
  readonly value: string;
  readonly label: string;
  readonly checked?: boolean;
  readonly disabled?: boolean;
  readonly onChange?: (value: string) => void;
}): RadioHandle {
  const element = document.createElement("label");
  element.className = "ui-choice ui-choice--radio";
  element.htmlFor = input.id;

  const control = document.createElement("input");
  control.type = "radio";
  control.id = input.id;
  control.name = input.name;
  control.value = input.value;
  control.checked = input.checked ?? false;
  control.disabled = input.disabled ?? false;

  const visual = document.createElement("span");
  visual.className = "ui-choice__visual";
  visual.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.className = "ui-choice__label";
  text.textContent = input.label;
  element.append(control, visual, text);

  const listener =
    input.onChange === undefined
      ? undefined
      : () => {
          if (control.checked) input.onChange?.(control.value);
        };
  if (listener !== undefined) control.addEventListener("change", listener);
  let disposed = false;

  return Object.freeze({
    element,
    input: control,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (listener !== undefined)
        control.removeEventListener("change", listener);
    },
  });
}
