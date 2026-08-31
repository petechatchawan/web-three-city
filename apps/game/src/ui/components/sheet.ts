import type { UiHandle } from "../primitives/types";

export interface SheetHandle extends UiHandle<HTMLElement> {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

export function createSheet(input: {
  readonly ariaLabel: string;
  readonly content: HTMLElement;
  readonly modal?: boolean;
}): SheetHandle {
  const element = document.createElement("section");
  element.className = "ui-sheet";
  element.hidden = true;
  element.setAttribute("aria-label", input.ariaLabel);
  if (input.modal === true) {
    element.setAttribute("role", "dialog");
    element.setAttribute("aria-modal", "true");
  } else {
    element.setAttribute("role", "region");
  }
  element.append(input.content);
  let disposed = false;
  let open = false;
  return Object.freeze({
    element,
    open(): void {
      if (disposed || open) return;
      open = true;
      element.hidden = false;
    },
    close(): void {
      if (!open) return;
      open = false;
      element.hidden = true;
    },
    isOpen: () => open,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      open = false;
      element.hidden = true;
    },
  });
}
