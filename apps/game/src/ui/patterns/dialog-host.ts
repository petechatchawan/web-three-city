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
  let disposed = false;

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
    syncWorldInert();
  };

  return Object.freeze({
    element,
    open(dialog: DialogHandle): void {
      if (disposed || stack.includes(dialog)) return;
      const onClose = (): void => removeDialog(dialog);
      closeListeners.set(dialog, onClose);
      dialog.element.addEventListener("close", onClose);
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
        if (dialog.isOpen()) dialog.close();
      }
      stack.length = 0;
      closeListeners.clear();
      input.worldUnderlay.removeAttribute("inert");
      element.replaceChildren();
    },
  });
}
