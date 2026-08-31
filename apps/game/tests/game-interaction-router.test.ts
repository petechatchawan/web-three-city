import { describe, expect, it } from "vitest";
import { createGameCommandRouter } from "../src/composition/game/create-game-command-router";
import { createGameInteractionRouter } from "../src/composition/game/create-game-interaction-router";
import { createGameToolCoordinator } from "../src/composition/game/create-game-tool-coordinator";
import type { GameToolRuntime } from "../src/composition/game/create-game-tool-coordinator";
import type { GameUiCommand } from "../src/composition/game/create-game-command-router";
import type { NormalizedPointerEvent } from "../src/presentation/input/gesture-recognizer";

function fakeTool(id: string, events: string[]): GameToolRuntime {
  return {
    descriptor: {
      id,
      label: id,
      icon: "terrain",
      order: id === "terrain" ? 10 : 20,
    },
    availability: () => ({ status: "available" }),
    activate: () => events.push(`${id}:activate`),
    deactivate: () => events.push(`${id}:deactivate`),
    dispose: () => events.push(`${id}:dispose`),
    view: { element: {} as HTMLElement, dispose: () => undefined },
    pointerSink: {
      onPointerEvent: (event) => events.push(`${id}:pointer:${event.type}`),
    },
    onSemanticTap: (x, y) => events.push(`${id}:tap:${x},${y}`),
  };
}

class FakeKeyboardTarget {
  readonly listeners = new Set<EventListener>();
  addEventListener(type: string, listener: EventListener): void {
    if (type === "keydown") this.listeners.add(listener);
  }
  removeEventListener(type: string, listener: EventListener): void {
    if (type === "keydown") this.listeners.delete(listener);
  }
  emit(input: {
    readonly key: string;
    readonly code: string;
    readonly target?: EventTarget;
  }): { readonly prevented: boolean } {
    let prevented = false;
    const event = {
      key: input.key,
      code: input.code,
      target: input.target ?? null,
      repeat: false,
      preventDefault: () => {
        prevented = true;
      },
    } as unknown as KeyboardEvent;
    for (const listener of this.listeners) listener(event);
    return { prevented };
  }
}

describe("Game interaction router", () => {
  it("routes pointer and semantic tap to the active tool at event time", () => {
    const events: string[] = [];
    const terrain = fakeTool("terrain", events);
    const roads = fakeTool("roads", events);
    const coordinator = createGameToolCoordinator([terrain, roads]);
    const router = createGameInteractionRouter({
      toolCoordinator: coordinator,
      onSelectionTap: (x, y) => events.push(`selection:${x},${y}`),
    });
    const pointer: NormalizedPointerEvent = {
      type: "move",
      id: 1,
      pointerType: "mouse",
      button: 0,
      x: 10,
      y: 20,
    };

    coordinator.activate("terrain");
    router.toolPointerSink.onPointerEvent(pointer);
    router.onSemanticTap(100, 200);
    coordinator.activate("roads");
    router.toolPointerSink.onPointerEvent({ ...pointer, type: "down" });
    router.onSemanticTap(300, 400);

    expect(events).toEqual([
      "terrain:activate",
      "terrain:pointer:move",
      "terrain:tap:100,200",
      "terrain:deactivate",
      "roads:activate",
      "roads:pointer:down",
      "roads:tap:300,400",
    ]);
  });

  it("uses selection fallback only when no primary tool is active", () => {
    const events: string[] = [];
    const terrain = fakeTool("terrain", events);
    const coordinator = createGameToolCoordinator([terrain]);
    const router = createGameInteractionRouter({
      toolCoordinator: coordinator,
      onSelectionTap: (x, y) => events.push(`selection:${x},${y}`),
    });

    router.onSemanticTap(5, 6);
    coordinator.activate("terrain");
    coordinator.deactivate();
    router.onSemanticTap(7, 8);

    expect(events).toEqual([
      "selection:5,6",
      "terrain:activate",
      "terrain:deactivate",
      "selection:7,8",
    ]);
  });

  it("stops forwarding after disposal", () => {
    const events: string[] = [];
    const terrain = fakeTool("terrain", events);
    const coordinator = createGameToolCoordinator([terrain]);
    const router = createGameInteractionRouter({
      toolCoordinator: coordinator,
      onSelectionTap: (x, y) => events.push(`selection:${x},${y}`),
    });
    coordinator.activate("terrain");
    router.dispose();

    router.toolPointerSink.onPointerEvent({
      type: "move",
      id: 1,
      pointerType: "mouse",
      button: 0,
      x: 1,
      y: 2,
    });
    router.onSemanticTap(1, 2);

    expect(events).toEqual(["terrain:activate"]);
  });
});

describe("Game command router", () => {
  it("maps Escape and tool shortcuts to semantic commands", () => {
    const target = new FakeKeyboardTarget();
    const commands: GameUiCommand[] = [];
    const router = createGameCommandRouter({
      keyboardTarget: target,
      toolShortcuts: [{ toolId: "terrain", key: "t" }],
      onCommand: (command) => commands.push(command),
    });

    expect(target.emit({ key: "Escape", code: "Escape" }).prevented).toBe(true);
    expect(target.emit({ key: "T", code: "KeyT" }).prevented).toBe(true);
    expect(commands).toEqual([
      { type: "dismiss-top-layer" },
      { type: "toggle-tool", toolId: "terrain" },
    ]);
    router.dispose();
    expect(target.listeners.size).toBe(0);
  });

  it("ignores editable targets and camera movement keys", () => {
    const target = new FakeKeyboardTarget();
    const commands: GameUiCommand[] = [];
    const router = createGameCommandRouter({
      keyboardTarget: target,
      toolShortcuts: [
        { toolId: "terrain", key: "t" },
        { toolId: "camera-conflict", key: "q" },
      ],
      onCommand: (command) => commands.push(command),
    });
    const input = {
      tagName: "INPUT",
      isContentEditable: false,
    } as unknown as EventTarget;

    expect(
      target.emit({ key: "t", code: "KeyT", target: input }).prevented,
    ).toBe(false);
    expect(target.emit({ key: "q", code: "KeyQ" }).prevented).toBe(false);
    expect(target.emit({ key: "w", code: "KeyW" }).prevented).toBe(false);
    expect(commands).toEqual([]);
    router.dispose();
  });
});
