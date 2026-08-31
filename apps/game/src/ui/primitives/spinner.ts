export function createSpinner(
  input: { readonly ariaLabel?: string } = {},
): HTMLElement {
  const element = document.createElement("span");
  element.className = "ui-spinner";
  element.setAttribute("role", "status");
  element.setAttribute("aria-label", input.ariaLabel ?? "Loading");
  const visual = document.createElement("span");
  visual.className = "ui-spinner__visual";
  visual.setAttribute("aria-hidden", "true");
  element.append(visual);
  return element;
}
