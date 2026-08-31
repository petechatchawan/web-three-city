import type { UiIconName } from "../foundation/icon-names";
import { createIcon } from "./icon";
import type { UiHandle } from "./types";

export type IconButtonHandle = UiHandle<HTMLButtonElement>;

export function createIconButton(input: {
  readonly icon: UiIconName;
  readonly ariaLabel: string;
  readonly testId?: string;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
}): IconButtonHandle {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "ui-icon-button";
  element.setAttribute("aria-label", input.ariaLabel);
  element.disabled = input.disabled ?? false;
  if (input.testId !== undefined) element.dataset.testid = input.testId;
  element.append(createIcon(input.icon));

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
