import { createToolButton } from "../components/tool-button";
import type { StatefulUiHandle } from "../primitives/types";
import type {
  GameToolAvailability,
  GameToolDescriptor,
} from "../tools/game-tool-contract";

export interface ToolDockViewState {
  readonly tools: readonly {
    readonly descriptor: GameToolDescriptor;
    readonly availability: GameToolAvailability;
  }[];
  readonly activeToolId?: string;
}

export type ToolDockHandle = StatefulUiHandle<ToolDockViewState>;

interface ToolEntry {
  readonly descriptor: GameToolDescriptor;
  readonly handle: ReturnType<typeof createToolButton>;
}

export function createToolDock(input: {
  readonly onToolPress: (toolId: string) => void;
}): ToolDockHandle {
  const element = document.createElement("nav");
  element.className = "game-tool-dock";
  element.setAttribute("aria-label", "Gameplay tools");
  const entries = new Map<string, ToolEntry>();
  let disposed = false;

  const removeMissing = (visibleIds: ReadonlySet<string>): void => {
    for (const [id, entry] of entries) {
      if (visibleIds.has(id)) continue;
      entry.handle.dispose();
      entry.handle.element.remove();
      entries.delete(id);
    }
  };

  return Object.freeze({
    element,
    render(state: ToolDockViewState): void {
      if (disposed) return;
      const visible = state.tools
        .filter((tool) => tool.availability.status !== "hidden")
        .slice()
        .sort((left, right) => left.descriptor.order - right.descriptor.order);
      const visibleIds = new Set(visible.map((tool) => tool.descriptor.id));
      removeMissing(visibleIds);

      for (const tool of visible) {
        let entry = entries.get(tool.descriptor.id);
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
          entries.set(descriptor.id, entry);
        }

        const unavailable = tool.availability.status !== "available";
        entry.handle.render({
          active: state.activeToolId === tool.descriptor.id,
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
        element.append(entry.handle.element);
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const entry of entries.values()) entry.handle.dispose();
      entries.clear();
      element.replaceChildren();
    },
  });
}
