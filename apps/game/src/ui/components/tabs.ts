import type { UiHandle } from "../primitives/types";

export interface TabsHandle extends UiHandle<HTMLElement> {
  select(id: string): boolean;
  selectedId(): string;
}

export function createTabs(input: {
  readonly ariaLabel: string;
  readonly items: readonly {
    readonly id: string;
    readonly label: string;
    readonly content: HTMLElement;
  }[];
  readonly initialId: string;
  readonly onChange?: (id: string) => void;
}): TabsHandle {
  const initial = input.items.find((item) => item.id === input.initialId);
  if (initial === undefined)
    throw new Error(`Unknown initial tab ${input.initialId}.`);

  const element = document.createElement("section");
  element.className = "ui-tabs";
  const tablist = document.createElement("div");
  tablist.className = "ui-tabs__list";
  tablist.setAttribute("role", "tablist");
  tablist.setAttribute("aria-label", input.ariaLabel);
  const panels = document.createElement("div");
  panels.className = "ui-tabs__panels";

  const entries = input.items.map((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ui-tabs__tab";
    button.setAttribute("role", "tab");
    button.id = `ui-tab-${item.id}`;
    button.textContent = item.label;
    const panel = document.createElement("div");
    panel.className = "ui-tabs__panel";
    panel.setAttribute("role", "tabpanel");
    panel.id = `ui-tabpanel-${item.id}`;
    panel.setAttribute("aria-labelledby", button.id);
    button.setAttribute("aria-controls", panel.id);
    panel.append(item.content);
    tablist.append(button);
    panels.append(panel);
    return { item, button, panel };
  });
  element.append(tablist, panels);

  let selectedId = input.initialId;
  let disposed = false;
  const render = (): void => {
    for (const entry of entries) {
      const selected = entry.item.id === selectedId;
      entry.button.setAttribute("aria-selected", String(selected));
      entry.button.tabIndex = selected ? 0 : -1;
      entry.panel.hidden = !selected;
    }
  };
  const select = (id: string): boolean => {
    if (disposed || !entries.some((entry) => entry.item.id === id))
      return false;
    if (id === selectedId) return true;
    selectedId = id;
    render();
    input.onChange?.(id);
    return true;
  };
  const listeners = entries.map((entry) => {
    const listener = (): void => {
      select(entry.item.id);
    };
    entry.button.addEventListener("click", listener);
    return { button: entry.button, listener };
  });
  render();

  return Object.freeze({
    element,
    select,
    selectedId: () => selectedId,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const entry of listeners) {
        entry.button.removeEventListener("click", entry.listener);
      }
    },
  });
}
