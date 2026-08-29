import type { DisposableElement } from "./types";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function createButton(input: {
  readonly label: string;
  readonly variant?: ButtonVariant;
  readonly type?: "button" | "submit" | "reset";
  readonly testId?: string;
  readonly ariaLabel?: string;
  readonly onPress?: () => void;
}): DisposableElement<HTMLButtonElement> {
  const element = document.createElement("button");
  element.type = input.type ?? "button";
  element.className = `ui-button ui-button--${input.variant ?? "secondary"}`;
  element.textContent = input.label;
  if (input.testId !== undefined) element.dataset.testid = input.testId;
  if (input.ariaLabel !== undefined)
    element.setAttribute("aria-label", input.ariaLabel);
  const listener = input.onPress;
  if (listener !== undefined) element.addEventListener("click", listener);
  let disposed = false;
  return Object.freeze({
    element,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (listener !== undefined)
        element.removeEventListener("click", listener);
    },
  });
}
