import type { CityToolPointerSink } from "../../presentation/input/create-city-input-controller";
import type { NormalizedPointerEvent } from "../../presentation/input/gesture-recognizer";
import type { GameToolCoordinator } from "./create-game-tool-coordinator";

export interface GameInteractionRouter {
  readonly toolPointerSink: CityToolPointerSink;
  onSemanticTap(clientX: number, clientY: number): void;
  dispose(): void;
}

export function createGameInteractionRouter(input: {
  readonly toolCoordinator: Pick<GameToolCoordinator, "activeTool">;
  readonly onSelectionTap: (clientX: number, clientY: number) => void;
}): GameInteractionRouter {
  let disposed = false;
  const toolPointerSink: CityToolPointerSink = Object.freeze({
    onPointerEvent(event: NormalizedPointerEvent): void {
      if (disposed) return;
      input.toolCoordinator.activeTool()?.pointerSink?.onPointerEvent(event);
    },
  });

  return Object.freeze({
    toolPointerSink,
    onSemanticTap(clientX: number, clientY: number): void {
      if (disposed) return;
      const tool = input.toolCoordinator.activeTool();
      if (tool === undefined) {
        input.onSelectionTap(clientX, clientY);
        return;
      }
      tool.onSemanticTap?.(clientX, clientY);
    },
    dispose(): void {
      disposed = true;
    },
  });
}
