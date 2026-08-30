export interface CardElements {
  readonly element: HTMLElement;
  readonly header: HTMLElement;
  readonly content: HTMLElement;
}

export function createCard(
  input: {
    readonly title?: string;
    readonly description?: string;
  } = {},
): CardElements {
  const element = document.createElement("section");
  element.className = "ui-card";
  const header = document.createElement("header");
  header.className = "ui-card__header";
  const content = document.createElement("div");
  content.className = "ui-card__content";
  if (input.title !== undefined) {
    const title = document.createElement("h2");
    title.className = "ui-card__title";
    title.textContent = input.title;
    header.append(title);
  }
  if (input.description !== undefined) {
    const description = document.createElement("p");
    description.className = "ui-card__description";
    description.textContent = input.description;
    header.append(description);
  }
  element.append(header, content);
  return Object.freeze({ element, header, content });
}
