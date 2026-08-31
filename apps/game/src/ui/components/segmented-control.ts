import type { StatefulUiHandle } from "../primitives/types";

export interface SegmentedControlState<T extends string | number> {
  readonly value: T;
  readonly disabledValues: readonly T[];
}

export type SegmentedControlHandle<T extends string | number> =
  StatefulUiHandle<SegmentedControlState<T>>;

export function createSegmentedControl<T extends string | number>(input: {
  readonly ariaLabel: string;
  readonly items: readonly {
    readonly value: T;
    readonly label: string;
    readonly ariaLabel?: string;
    readonly testId?: string;
  }[];
  readonly onChange: (value: T) => void;
}): SegmentedControlHandle<T> {
  const element = document.createElement("div");
  element.className = "ui-segmented-control";
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", input.ariaLabel);

  const buttons = input.items.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ui-segmented-control__button";
    button.textContent = item.label;
    if (item.ariaLabel !== undefined)
      button.setAttribute("aria-label", item.ariaLabel);
    if (item.testId !== undefined) button.dataset.testid = item.testId;
    button.setAttribute("aria-pressed", "false");
    const listener = (): void => input.onChange(item.value);
    button.addEventListener("click", listener);
    element.append(button);
    return { item, button, listener };
  });

  let disposed = false;
  const handle: SegmentedControlHandle<T> = {
    element,
    render(state): void {
      if (disposed) return;
      for (const entry of buttons) {
        entry.button.setAttribute(
          "aria-pressed",
          String(Object.is(entry.item.value, state.value)),
        );
        entry.button.disabled = state.disabledValues.some((value) =>
          Object.is(value, entry.item.value),
        );
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const entry of buttons) {
        entry.button.removeEventListener("click", entry.listener);
      }
    },
  };
  return Object.freeze(handle);
}
