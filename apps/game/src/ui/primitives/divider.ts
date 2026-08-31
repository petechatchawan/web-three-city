export function createDivider(): HTMLHRElement {
  const element = document.createElement("hr");
  element.className = "ui-divider";
  element.setAttribute("aria-hidden", "true");
  return element;
}
