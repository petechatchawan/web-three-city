export interface ScreenHandle {
  readonly element: HTMLElement;
  dispose(): void;
}

export function createScreenFrame(input: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description: string;
}): {
  readonly element: HTMLElement;
  readonly header: HTMLElement;
  readonly body: HTMLElement;
} {
  const element = document.createElement("section");
  element.className = "city-screen";
  const container = document.createElement("div");
  container.className = "city-screen__container";
  const header = document.createElement("header");
  header.className = "city-screen__header";

  if (input.eyebrow !== undefined) {
    const eyebrow = document.createElement("p");
    eyebrow.className = "city-screen__eyebrow";
    eyebrow.textContent = input.eyebrow;
    header.append(eyebrow);
  }

  const title = document.createElement("h1");
  title.className = "city-screen__title";
  title.textContent = input.title;
  const description = document.createElement("p");
  description.className = "city-screen__description";
  description.textContent = input.description;
  header.append(title, description);

  const body = document.createElement("div");
  body.className = "city-screen__body";
  container.append(header, body);
  element.append(container);
  return Object.freeze({ element, header, body });
}
