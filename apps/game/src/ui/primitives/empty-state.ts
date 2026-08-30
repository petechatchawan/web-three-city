export function createEmptyState(input: {
  readonly title: string;
  readonly description: string;
}): HTMLElement {
  const element = document.createElement("div");
  element.className = "ui-empty-state";
  const title = document.createElement("h3");
  title.className = "ui-empty-state__title";
  title.textContent = input.title;
  const description = document.createElement("p");
  description.className = "ui-empty-state__description";
  description.textContent = input.description;
  element.append(title, description);
  return element;
}
