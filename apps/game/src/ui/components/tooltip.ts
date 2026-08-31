import type { UiHandle } from "../primitives/types";

export function createTooltip(input: {
  readonly target: HTMLElement;
  readonly text: string;
}): UiHandle<HTMLSpanElement> {
  const element = document.createElement("span");
  element.className = "ui-tooltip";
  element.setAttribute("role", "tooltip");
  element.textContent = input.text;
  element.hidden = true;
  const id = `ui-tooltip-${crypto.randomUUID()}`;
  element.id = id;
  input.target.setAttribute("aria-describedby", id);

  const show = (): void => {
    element.hidden = false;
  };
  const hide = (): void => {
    element.hidden = true;
  };
  input.target.addEventListener("mouseenter", show);
  input.target.addEventListener("mouseleave", hide);
  input.target.addEventListener("focus", show);
  input.target.addEventListener("blur", hide);
  let disposed = false;

  return Object.freeze({
    element,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      input.target.removeEventListener("mouseenter", show);
      input.target.removeEventListener("mouseleave", hide);
      input.target.removeEventListener("focus", show);
      input.target.removeEventListener("blur", hide);
      input.target.removeAttribute("aria-describedby");
    },
  });
}
