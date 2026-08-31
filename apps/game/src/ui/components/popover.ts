import type { UiHandle } from "../primitives/types";

export interface PopoverHandle extends UiHandle<HTMLElement> {
  open(): void;
  close(options?: { readonly restoreFocus?: boolean }): void;
  isOpen(): boolean;
}

export function createPopover(input: {
  readonly trigger: HTMLElement;
  readonly content: HTMLElement;
  readonly ariaLabel: string;
}): PopoverHandle {
  const element = document.createElement("div");
  element.className = "ui-popover";
  element.setAttribute("role", "dialog");
  element.setAttribute("aria-label", input.ariaLabel);
  element.hidden = true;
  element.append(input.content);
  input.trigger.setAttribute("aria-expanded", "false");

  let disposed = false;
  let open = false;

  const removeGlobalListeners = (): void => {
    document.removeEventListener("pointerdown", onDocumentPointerDown, true);
    document.removeEventListener("keydown", onDocumentKeyDown, true);
  };
  const close = (options: { readonly restoreFocus?: boolean } = {}): void => {
    if (!open) return;
    open = false;
    element.hidden = true;
    input.trigger.setAttribute("aria-expanded", "false");
    removeGlobalListeners();
    if (options.restoreFocus !== false) input.trigger.focus();
  };
  const onDocumentPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (element.contains(target) || input.trigger.contains(target)) return;
    close({ restoreFocus: false });
  };
  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    close();
  };
  const show = (): void => {
    if (disposed || open) return;
    open = true;
    element.hidden = false;
    input.trigger.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    document.addEventListener("keydown", onDocumentKeyDown, true);
  };
  const onTriggerClick = (): void => {
    if (open) close({ restoreFocus: false });
    else show();
  };
  input.trigger.addEventListener("click", onTriggerClick);

  return Object.freeze({
    element,
    open: show,
    close,
    isOpen: () => open,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      removeGlobalListeners();
      input.trigger.removeEventListener("click", onTriggerClick);
      input.trigger.removeAttribute("aria-expanded");
      open = false;
      element.hidden = true;
    },
  });
}
