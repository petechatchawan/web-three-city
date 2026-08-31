import type { GameToolRuntime } from "./create-game-tool-coordinator";

export interface GameToolRegistry {
  all(): readonly GameToolRuntime[];
  get(toolId: string): GameToolRuntime | undefined;
}

export function createGameToolRegistry(
  tools: readonly GameToolRuntime[],
): GameToolRegistry {
  const byId = new Map<string, GameToolRuntime>();
  for (const tool of tools) {
    if (byId.has(tool.descriptor.id)) {
      throw new Error(`Duplicate tool id: ${tool.descriptor.id}`);
    }
    byId.set(tool.descriptor.id, tool);
  }
  const ordered = Object.freeze(
    [...byId.values()].sort(
      (left, right) => left.descriptor.order - right.descriptor.order,
    ),
  );
  return Object.freeze({
    all: () => ordered,
    get: (toolId: string) => byId.get(toolId),
  });
}
