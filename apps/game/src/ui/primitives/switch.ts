import type { DisposableElement } from "./types";

export interface SwitchHandle extends DisposableElement<HTMLLabelElement> {
  readonly input: HTMLInputElement;
}

export function createSwitch(input: {
  readonly id: string;
  readonly label: string;
  readonly checked?: boolean;
  readonly testId?: string;
  readonly onChange?: (checked: boolean) => void;
}): SwitchHandle {
  const element = document.createElement("label");
  element.className = "ui-switch";
  element.htmlFor = input.id;
  if (input.testId !== undefined) element.dataset.testid = input.testId;
  const control = document.createElement("input");
  control.className = "ui-switch__input";
  control.type = "checkbox";
  control.id = input.id;
  control.checked = input.checked ?? false;
  const visual = document.createElement("span");
  visual.className = "ui-switch__visual";
  visual.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.className = "ui-switch__label";
  text.textContent = input.label;
  element.append(control, visual, text);
  const listener =
    input.onChange === undefined
      ? undefined
      : () => input.onChange?.(control.checked);
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
