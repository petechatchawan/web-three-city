export function createProgress(input: {
  readonly value?: number;
  readonly max?: number;
  readonly ariaLabel: string;
}): HTMLProgressElement {
  const element = document.createElement("progress");
  element.className = "ui-progress";
  element.max = input.max ?? 100;
  if (input.value !== undefined) element.value = input.value;
  element.setAttribute("aria-label", input.ariaLabel);
  return element;
}
