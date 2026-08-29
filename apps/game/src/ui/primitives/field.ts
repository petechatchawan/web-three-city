export interface FieldElements {
  readonly element: HTMLElement;
  readonly label: HTMLLabelElement;
  readonly description?: HTMLElement;
  readonly error: HTMLElement;
}

export function createField(input: {
  readonly label: string;
  readonly control: HTMLInputElement | HTMLSelectElement;
  readonly description?: string;
}): FieldElements {
  const element = document.createElement("div");
  element.className = "ui-field";
  const label = document.createElement("label");
  label.className = "ui-label";
  label.htmlFor = input.control.id;
  label.textContent = input.label;
  element.append(label, input.control);
  let description: HTMLElement | undefined;
  if (input.description !== undefined) {
    description = document.createElement("p");
    description.className = "ui-field__description";
    description.textContent = input.description;
    const descriptionId = `${input.control.id}-description`;
    description.id = descriptionId;
    input.control.setAttribute("aria-describedby", descriptionId);
    element.append(description);
  }
  const error = document.createElement("p");
  error.className = "ui-field__error";
  error.id = `${input.control.id}-error`;
  error.hidden = true;
  error.setAttribute("aria-live", "polite");
  element.append(error);
  return Object.freeze({
    element,
    label,
    ...(description === undefined ? {} : { description }),
    error,
  });
}
