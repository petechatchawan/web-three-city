import type { DialogHandle } from "../components/dialog";
import type { UiHandle } from "../primitives/types";

export interface DialogHostHandle extends UiHandle<HTMLElement> {
  open(dialog: DialogHandle): void;
  closeTop(): boolean;
  hasOpenDialog(): boolean;
}

export function createDialogHost(input: {
  readonly worldUnderlay: HTMLElement;
}): DialogHostHandle {
  const element = document.createElement("div");
  element.className = "game-dialog-host";
  const stack: DialogHandle[] = [];
  const closeListeners = new Map<DialogHandle, () => void>();
  const keyListeners = new Map<DialogHandle, (event: KeyboardEvent) => void>();
  let disposed = false;

  const focusableElements = (dialog: DialogHandle): HTMLElement[] =>
    Array.from(
      dialog.element.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((candidate) => !candidate.hasAttribute("hidden"));
  const trapTabFocus = (dialog: DialogHandle, event: KeyboardEvent): void => {
    if (event.key !== "Tab") return;
    const focusable = focusableElements(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.element.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (first === undefined || last === undefined) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const syncWorldInert = (): void => {
    if (stack.length > 0) input.worldUnderlay.setAttribute("inert", "");
    else input.worldUnderlay.removeAttribute("inert");
  };
  const removeDialog = (dialog: DialogHandle): void => {
    const index = stack.lastIndexOf(dialog);
    if (index >= 0) stack.splice(index, 1);
    const listener = closeListeners.get(dialog);
    if (listener !== undefined) {
      dialog.element.removeEventListener("close", listener);
      closeListeners.delete(dialog);
    }
    const keyListener = keyListeners.get(dialog);
    if (keyListener !== undefined) {
      dialog.element.removeEventListener("keydown", keyListener);
      keyListeners.delete(dialog);
    }
    syncWorldInert();
  };

  return Object.freeze({
    element,
    open(dialog: DialogHandle): void {
      if (disposed || stack.includes(dialog)) return;
      const onClose = (): void => removeDialog(dialog);
      const onKeyDown = (event: KeyboardEvent): void =>
        trapTabFocus(dialog, event);
      closeListeners.set(dialog, onClose);
      keyListeners.set(dialog, onKeyDown);
      dialog.element.addEventListener("close", onClose);
      dialog.element.addEventListener("keydown", onKeyDown);
      stack.push(dialog);
      element.append(dialog.element);
      syncWorldInert();
      dialog.open();
    },
    closeTop(): boolean {
      const top = stack.at(-1);
      if (top === undefined) return false;
      top.close();
      return true;
    },
    hasOpenDialog: () => stack.length > 0,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const dialog of [...stack]) {
        const listener = closeListeners.get(dialog);
        if (listener !== undefined)
          dialog.element.removeEventListener("close", listener);
        const keyListener = keyListeners.get(dialog);
        if (keyListener !== undefined)
          dialog.element.removeEventListener("keydown", keyListener);
        if (dialog.isOpen()) dialog.close();
      }
      stack.length = 0;
      closeListeners.clear();
      keyListeners.clear();
      input.worldUnderlay.removeAttribute("inert");
      element.replaceChildren();
    },
  });
}
