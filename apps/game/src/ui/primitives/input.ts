export function createInput(input: {
  readonly id: string;
  readonly name: string;
  readonly type?: "text" | "search";
  readonly value?: string;
  readonly placeholder?: string;
  readonly autocomplete?: HTMLInputElement["autocomplete"];
}): HTMLInputElement {
  const element = document.createElement("input");
  element.className = "ui-input";
  element.id = input.id;
  element.name = input.name;
  element.type = input.type ?? "text";
  if (input.value !== undefined) element.value = input.value;
  if (input.placeholder !== undefined) element.placeholder = input.placeholder;
  if (input.autocomplete !== undefined)
    element.autocomplete = input.autocomplete;
  return element;
}
