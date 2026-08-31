import { createPopover, type PopoverHandle } from "./popover";

export function createDropdownMenu(input: {
  readonly trigger: HTMLElement;
  readonly ariaLabel: string;
  readonly items: readonly {
    readonly id: string;
    readonly label: string;
    readonly disabled?: boolean;
    readonly onSelect: () => void;
  }[];
}): PopoverHandle {
  const menu = document.createElement("div");
  menu.className = "ui-dropdown-menu";
  menu.setAttribute("role", "menu");
  const listeners: Array<{
    readonly button: HTMLButtonElement;
    readonly listener: () => void;
  }> = [];

  for (const item of input.items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ui-dropdown-menu__item";
    button.setAttribute("role", "menuitem");
    button.dataset.menuItem = item.id;
    button.textContent = item.label;
    button.disabled = item.disabled ?? false;
    const listener = (): void => {
      item.onSelect();
      popover.close();
    };
    button.addEventListener("click", listener);
    listeners.push({ button, listener });
    menu.append(button);
  }

  const popover = createPopover({
    trigger: input.trigger,
    content: menu,
    ariaLabel: input.ariaLabel,
  });

  let disposed = false;
  return Object.freeze({
    element: popover.element,
    open: popover.open,
    close: popover.close,
    isOpen: popover.isOpen,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const entry of listeners) {
        entry.button.removeEventListener("click", entry.listener);
      }
      popover.dispose();
    },
  });
}
