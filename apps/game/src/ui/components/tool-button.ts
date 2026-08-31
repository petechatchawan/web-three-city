import type { UiIconName } from "../foundation/icon-names";
import { createIconButton } from "../primitives/icon-button";
import type { StatefulUiHandle } from "../primitives/types";

export interface ToolButtonState {
  readonly active: boolean;
  readonly disabled: boolean;
  readonly attention?: boolean;
}

export function createToolButton(input: {
  readonly icon: UiIconName;
  readonly label: string;
  readonly shortcut?: string;
  readonly onPress: () => void;
}): StatefulUiHandle<ToolButtonState, HTMLButtonElement> {
  const button = createIconButton({
    icon: input.icon,
    ariaLabel:
      input.shortcut === undefined
        ? input.label
        : `${input.label} (${input.shortcut})`,
    onPress: input.onPress,
  });
  button.element.classList.add("ui-tool-button");
  const label = document.createElement("span");
  label.className = "ui-tool-button__label";
  label.textContent = input.label;
  button.element.append(label);
  let disposed = false;

  return Object.freeze({
    element: button.element,
    render(state: ToolButtonState): void {
      if (disposed) return;
      button.element.disabled = state.disabled;
      button.element.setAttribute("aria-pressed", String(state.active));
      if (state.attention === true) button.element.dataset.attention = "true";
      else delete button.element.dataset.attention;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      button.dispose();
    },
  });
}
