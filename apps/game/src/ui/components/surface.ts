export type SurfaceTone = "glass" | "panel" | "raised";

export interface SurfaceElements {
  readonly element: HTMLElement;
  readonly header: HTMLElement;
  readonly content: HTMLElement;
}

export function createSurface(
  input: {
    readonly tone?: SurfaceTone;
    readonly title?: string;
    readonly description?: string;
  } = {},
): SurfaceElements {
  const element = document.createElement("section");
  element.className = `ui-surface ui-surface--${input.tone ?? "panel"} ui-card`;
  const header = document.createElement("header");
  header.className = "ui-surface__header ui-card__header";
  const content = document.createElement("div");
  content.className = "ui-surface__content ui-card__content";

  if (input.title !== undefined) {
    const title = document.createElement("h2");
    title.className = "ui-surface__title ui-card__title";
    title.textContent = input.title;
    header.append(title);
  }
  if (input.description !== undefined) {
    const description = document.createElement("p");
    description.className = "ui-surface__description ui-card__description";
    description.textContent = input.description;
    header.append(description);
  }

  element.append(header, content);
  return Object.freeze({ element, header, content });
}
