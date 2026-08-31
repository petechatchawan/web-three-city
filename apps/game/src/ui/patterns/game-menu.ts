import { createDialog } from "../components/dialog";
import { createButton, type ButtonVariant } from "../primitives/button";
import type { UiHandle } from "../primitives/types";

export interface GameMenuAction {
  readonly id: string;
  readonly label: string;
  readonly variant?: ButtonVariant;
}

export interface GameMenuHandle extends UiHandle<HTMLDialogElement> {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

export function createGameMenu(input: {
  readonly title?: string;
  readonly actions: readonly GameMenuAction[];
  readonly onAction: (actionId: string) => void;
}): GameMenuHandle {
  const content = document.createElement("section");
  content.className = "game-menu__content";
  const title = document.createElement("h2");
  title.className = "game-menu__title";
  title.textContent = input.title ?? "Game menu";
  const actions = document.createElement("div");
  actions.className = "game-menu__actions";
  const buttons = input.actions.map((action) =>
    createButton({
      label: action.label,
      ...(action.variant === undefined ? {} : { variant: action.variant }),
      onPress: () => input.onAction(action.id),
    }),
  );
  actions.append(...buttons.map((button) => button.element));
  content.append(title, actions);
  const dialog = createDialog({ ariaLabel: title.textContent, content });
  dialog.element.classList.add("game-menu");
  let disposed = false;

  return Object.freeze({
    element: dialog.element,
    open: dialog.open,
    close: dialog.close,
    isOpen: dialog.isOpen,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const button of buttons) button.dispose();
      dialog.dispose();
    },
  });
}
