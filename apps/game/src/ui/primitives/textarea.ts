export function createTextarea(input: {
  readonly id: string;
  readonly name: string;
  readonly value?: string;
  readonly placeholder?: string;
  readonly rows?: number;
}): HTMLTextAreaElement {
  const element = document.createElement("textarea");
  element.className = "ui-textarea";
  element.id = input.id;
  element.name = input.name;
  if (input.value !== undefined) element.value = input.value;
  if (input.placeholder !== undefined) element.placeholder = input.placeholder;
  if (input.rows !== undefined) element.rows = input.rows;
  return element;
}
