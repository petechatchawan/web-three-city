import type { CityToolPointerSink } from "../../presentation/input/create-city-input-controller";
import type { UiHandle } from "../../ui/primitives/types";
import type {
  GameToolAvailability,
  GameToolDescriptor,
} from "../../ui/tools/game-tool-contract";
import { createGameToolRegistry } from "./create-game-tool-registry";

export interface GameToolRuntime {
  readonly descriptor: GameToolDescriptor;
  readonly availability: () => GameToolAvailability;
  activate(): void;
  deactivate(): void;
  dispose(): void;
  readonly view: UiHandle;
  readonly pointerSink?: CityToolPointerSink;
  onSemanticTap?(clientX: number, clientY: number): void;
}

export interface GameToolCoordinator {
  activeToolId(): string | undefined;
  activate(toolId: string): boolean;
  toggle(toolId: string): boolean;
  deactivate(): void;
  activeTool(): GameToolRuntime | undefined;
  dispose(): void;
}

export function createGameToolCoordinator(
  tools: readonly GameToolRuntime[],
): GameToolCoordinator {
  const registry = createGameToolRegistry(tools);
  let active: GameToolRuntime | undefined;
  let disposed = false;

  const deactivate = (): void => {
    if (disposed || active === undefined) return;
    const current = active;
    active = undefined;
    current.deactivate();
  };

  const activate = (toolId: string): boolean => {
    if (disposed) return false;
    const next = registry.get(toolId);
    if (next === undefined || next.availability().status !== "available") {
      return false;
    }
    if (active === next) return true;
    deactivate();
    next.activate();
    active = next;
    return true;
  };

  return Object.freeze({
    activeToolId: () => active?.descriptor.id,
    activate,
    toggle(toolId: string): boolean {
      if (disposed) return false;
      if (active?.descriptor.id === toolId) {
        deactivate();
        return true;
      }
      return activate(toolId);
    },
    deactivate,
    activeTool: () => active,
    dispose(): void {
      if (disposed) return;
      if (active !== undefined) {
        const current = active;
        active = undefined;
        current.deactivate();
      }
      disposed = true;
      for (const tool of registry.all()) tool.dispose();
    },
  });
}
