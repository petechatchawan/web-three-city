export type BadgeTone = "neutral" | "success" | "warning" | "danger";

export function createBadge(input: {
  readonly label: string;
  readonly tone?: BadgeTone;
}): HTMLSpanElement {
  const element = document.createElement("span");
  element.className = `ui-badge ui-badge--${input.tone ?? "neutral"}`;
  element.textContent = input.label;
  return element;
}
