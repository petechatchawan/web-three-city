import type {
  GameToolCoordinator,
  GameToolRuntime,
} from "./create-game-tool-coordinator";

export interface GameToolNavigationState {
  readonly expandedCategoryId?: string;
  readonly activeToolId?: string;
}

export interface GameToolNavigationController {
  state(): GameToolNavigationState;
  pressCategory(categoryId: string): boolean;
  pressTool(toolId: string): boolean;
  toggleToolShortcut(toolId: string): boolean;
  dismissToolNavigation(): boolean;
  dispose(): void;
}

export function createGameToolNavigationController(input: {
  readonly tools: readonly GameToolRuntime[];
  readonly toolCoordinator: GameToolCoordinator;
  readonly onStateChange: (state: GameToolNavigationState) => void;
}): GameToolNavigationController {
  const byToolId = new Map(
    input.tools.map((tool) => [tool.descriptor.id, tool] as const),
  );
  const categoryIds = new Set(
    input.tools.map((tool) => tool.descriptor.category.id),
  );
  let expandedCategoryId: string | undefined;
  let disposed = false;

  const snapshot = (): GameToolNavigationState => {
    const activeToolId = input.toolCoordinator.activeToolId();
    return Object.freeze({
      ...(expandedCategoryId === undefined ? {} : { expandedCategoryId }),
      ...(activeToolId === undefined ? {} : { activeToolId }),
    });
  };

  const publish = (): void => {
    if (!disposed) input.onStateChange(snapshot());
  };

  const collapse = (): void => {
    input.toolCoordinator.deactivate();
    expandedCategoryId = undefined;
  };

  return Object.freeze({
    state: snapshot,
    pressCategory(categoryId: string): boolean {
      if (disposed || !categoryIds.has(categoryId)) return false;
      if (expandedCategoryId === categoryId) {
        collapse();
      } else {
        input.toolCoordinator.deactivate();
        expandedCategoryId = categoryId;
      }
      publish();
      return true;
    },
    pressTool(toolId: string): boolean {
      if (disposed) return false;
      const tool = byToolId.get(toolId);
      if (
        tool === undefined ||
        tool.descriptor.category.id !== expandedCategoryId
      ) {
        return false;
      }
      if (!input.toolCoordinator.toggle(toolId)) return false;
      publish();
      return true;
    },
    toggleToolShortcut(toolId: string): boolean {
      if (disposed) return false;
      const tool = byToolId.get(toolId);
      if (tool === undefined) return false;

      if (input.toolCoordinator.activeToolId() === toolId) {
        collapse();
        publish();
        return true;
      }

      const previousExpandedCategoryId = expandedCategoryId;
      expandedCategoryId = tool.descriptor.category.id;
      if (!input.toolCoordinator.activate(toolId)) {
        expandedCategoryId = previousExpandedCategoryId;
        return false;
      }
      publish();
      return true;
    },
    dismissToolNavigation(): boolean {
      if (
        disposed ||
        (expandedCategoryId === undefined &&
          input.toolCoordinator.activeToolId() === undefined)
      ) {
        return false;
      }
      collapse();
      publish();
      return true;
    },
    dispose(): void {
      disposed = true;
    },
  });
}
