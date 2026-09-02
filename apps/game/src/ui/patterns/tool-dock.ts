import { createToolButton } from "../components/tool-button";
import { createButton } from "../primitives/button";
import type { StatefulUiHandle } from "../primitives/types";
import type {
  GameToolAvailability,
  GameToolCategoryDescriptor,
  GameToolDescriptor,
} from "../tools/game-tool-contract";

export interface ToolDockViewState {
  readonly tools: readonly {
    readonly descriptor: GameToolDescriptor;
    readonly availability: GameToolAvailability;
  }[];
  readonly expandedCategoryId?: string;
  readonly activeToolId?: string;
}

export type ToolDockHandle = StatefulUiHandle<ToolDockViewState>;

interface ToolEntry {
  readonly descriptor: GameToolDescriptor;
  readonly handle: ReturnType<typeof createToolButton>;
}

interface CategoryButtonEntry {
  readonly descriptor: GameToolCategoryDescriptor;
  readonly handle: ReturnType<typeof createButton>;
}

interface CategoryEntry {
  readonly descriptor: GameToolCategoryDescriptor;
  readonly tools: Array<ToolDockViewState["tools"][number]>;
}

function compareCategory(
  left: GameToolCategoryDescriptor,
  right: GameToolCategoryDescriptor,
): number {
  return left.order - right.order || left.label.localeCompare(right.label);
}

export function createToolDock(input: {
  readonly onCategoryPress: (categoryId: string) => void;
  readonly onToolPress: (toolId: string) => void;
}): ToolDockHandle {
  const element = document.createElement("nav");
  element.className = "game-tool-dock";
  element.setAttribute("aria-label", "Gameplay tools");

  const toolTray = document.createElement("div");
  toolTray.className = "game-tool-dock__tool-tray";
  toolTray.setAttribute("role", "group");
  toolTray.hidden = true;

  const categoryDock = document.createElement("div");
  categoryDock.className = "game-tool-dock__category-dock";
  categoryDock.setAttribute("role", "group");
  categoryDock.setAttribute("aria-label", "Tool categories");

  element.append(toolTray, categoryDock);

  const toolEntries = new Map<string, ToolEntry>();
  const categoryEntries = new Map<string, CategoryButtonEntry>();
  let disposed = false;

  const removeMissingTools = (visibleIds: ReadonlySet<string>): void => {
    for (const [id, entry] of toolEntries) {
      if (visibleIds.has(id)) continue;
      entry.handle.dispose();
      entry.handle.element.remove();
      toolEntries.delete(id);
    }
  };

  const removeMissingCategories = (visibleIds: ReadonlySet<string>): void => {
    for (const [id, entry] of categoryEntries) {
      if (visibleIds.has(id)) continue;
      entry.handle.dispose();
      entry.handle.element.remove();
      categoryEntries.delete(id);
    }
  };

  const renderTool = (
    tool: ToolDockViewState["tools"][number],
    activeToolId: string | undefined,
  ): HTMLButtonElement => {
    let entry = toolEntries.get(tool.descriptor.id);
    if (entry === undefined) {
      const descriptor = tool.descriptor;
      const handle = createToolButton({
        icon: descriptor.icon,
        label: descriptor.label,
        ...(descriptor.shortcut === undefined
          ? {}
          : { shortcut: descriptor.shortcut }),
        onPress: () => input.onToolPress(descriptor.id),
      });
      entry = { descriptor, handle };
      toolEntries.set(descriptor.id, entry);
    }

    const unavailable = tool.availability.status !== "available";
    entry.handle.render({
      active: activeToolId === tool.descriptor.id,
      disabled: unavailable,
    });
    if (
      tool.availability.status === "locked" ||
      tool.availability.status === "disabled"
    ) {
      entry.handle.element.title = tool.availability.reason;
      entry.handle.element.setAttribute(
        "aria-description",
        tool.availability.reason,
      );
    } else {
      entry.handle.element.removeAttribute("title");
      entry.handle.element.removeAttribute("aria-description");
    }
    return entry.handle.element;
  };

  return Object.freeze({
    element,
    render(state: ToolDockViewState): void {
      if (disposed) return;
      const visible = state.tools.filter(
        (tool) => tool.availability.status !== "hidden",
      );
      removeMissingTools(new Set(visible.map((tool) => tool.descriptor.id)));

      const categories = new Map<string, CategoryEntry>();
      for (const tool of visible) {
        const category = tool.descriptor.category;
        const existing = categories.get(category.id);
        if (existing === undefined) {
          categories.set(category.id, { descriptor: category, tools: [tool] });
        } else {
          existing.tools.push(tool);
        }
      }

      const orderedCategories = [...categories.values()].sort((left, right) =>
        compareCategory(left.descriptor, right.descriptor),
      );
      removeMissingCategories(
        new Set(orderedCategories.map((category) => category.descriptor.id)),
      );

      const categoryButtons = orderedCategories.map((category) => {
        let entry = categoryEntries.get(category.descriptor.id);
        if (entry === undefined) {
          const descriptor = category.descriptor;
          const handle = createButton({
            label: descriptor.label,
            onPress: () => input.onCategoryPress(descriptor.id),
          });
          handle.element.classList.add("game-tool-dock__category-button");
          handle.element.dataset.categoryId = descriptor.id;
          entry = { descriptor, handle };
          categoryEntries.set(descriptor.id, entry);
        }
        entry.handle.element.setAttribute(
          "aria-expanded",
          String(state.expandedCategoryId === category.descriptor.id),
        );
        return entry.handle.element;
      });
      categoryDock.replaceChildren(...categoryButtons);

      const expanded =
        state.expandedCategoryId === undefined
          ? undefined
          : categories.get(state.expandedCategoryId);
      if (expanded === undefined) {
        toolTray.hidden = true;
        toolTray.removeAttribute("aria-label");
        toolTray.replaceChildren();
        return;
      }

      toolTray.hidden = false;
      toolTray.setAttribute("aria-label", `${expanded.descriptor.label} tools`);
      const toolButtons = expanded.tools
        .slice()
        .sort(
          (left, right) =>
            left.descriptor.order - right.descriptor.order ||
            left.descriptor.label.localeCompare(right.descriptor.label),
        )
        .map((tool) => renderTool(tool, state.activeToolId));
      toolTray.replaceChildren(...toolButtons);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const entry of toolEntries.values()) entry.handle.dispose();
      for (const entry of categoryEntries.values()) entry.handle.dispose();
      toolEntries.clear();
      categoryEntries.clear();
      toolTray.replaceChildren();
      categoryDock.replaceChildren();
      element.replaceChildren();
    },
  });
}
