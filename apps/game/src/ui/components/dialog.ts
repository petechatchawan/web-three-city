import type { UiHandle } from "../primitives/types";

export interface DialogHandle extends UiHandle<HTMLDialogElement> {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

export function createDialog(input: {
  readonly ariaLabel: string;
  readonly content: HTMLElement;
  readonly onClose?: () => void;
}): DialogHandle {
  const element = document.createElement("dialog");
  element.className = "ui-dialog";
  element.setAttribute("aria-label", input.ariaLabel);
  element.append(input.content);
  let restoreFocus: HTMLElement | undefined;
  let disposed = false;

  const open = (): void => {
    if (disposed || element.open) return;
    restoreFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : undefined;
    element.showModal();
  };
  const close = (): void => {
    if (!element.open) return;
    element.close();
  };
  const onCancel = (event: Event): void => {
    event.preventDefault();
    close();
  };
  const onNativeClose = (): void => {
    input.onClose?.();
    const target = restoreFocus;
    restoreFocus = undefined;
    target?.focus();
  };
  element.addEventListener("cancel", onCancel);
  element.addEventListener("close", onNativeClose);

  return Object.freeze({
    element,
    open,
    close,
    isOpen: () => element.open,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (element.open) element.close();
      element.removeEventListener("cancel", onCancel);
      element.removeEventListener("close", onNativeClose);
      restoreFocus = undefined;
    },
  });
}
