import { createSurface } from "../components/surface";

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
  return createSurface({
    tone: "panel",
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.description === undefined
      ? {}
      : { description: input.description }),
  });
}
