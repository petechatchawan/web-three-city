import { describe, expect, it } from "vitest";
import { createGameToolCoordinator } from "../src/composition/game/create-game-tool-coordinator";
import { createGameToolRegistry } from "../src/composition/game/create-game-tool-registry";
import type { GameToolRuntime } from "../src/composition/game/create-game-tool-coordinator";
import type { GameToolAvailability } from "../src/ui/tools/game-tool-contract";

function fakeTool(
  id: string,
  events: string[],
  availability: GameToolAvailability = { status: "available" },
): GameToolRuntime {
  let currentAvailability = availability;
  let disposed = false;
  return {
    descriptor: {
      id,
      label: id.toUpperCase(),
      icon: "terrain",
      order: id.charCodeAt(0),
    },
    availability: () => currentAvailability,
    activate: () => events.push(`${id}:activate`),
    deactivate: () => events.push(`${id}:deactivate`),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      events.push(`${id}:dispose`);
    },
    view: {
      element: {} as HTMLElement,
      dispose: () => undefined,
    },
    setAvailability(next: GameToolAvailability): void {
      currentAvailability = next;
    },
  } as GameToolRuntime & {
    setAvailability(next: GameToolAvailability): void;
  };
}

describe("Game tool registry", () => {
  it("sorts tools by descriptor order and rejects duplicate ids", () => {
    const events: string[] = [];
    const b = fakeTool("b", events);
    const a = fakeTool("a", events);
    const registry = createGameToolRegistry([b, a]);

    expect(registry.all().map((tool) => tool.descriptor.id)).toEqual([
      "a",
      "b",
    ]);
    expect(registry.get("a")).toBe(a);
    expect(() => createGameToolRegistry([a, a])).toThrow(/duplicate tool id/i);
  });
});

describe("Game tool coordinator", () => {
  it("switches A to B by deactivating A before activating B", () => {
    const events: string[] = [];
    const a = fakeTool("a", events);
    const b = fakeTool("b", events);
    const coordinator = createGameToolCoordinator([a, b]);

    expect(coordinator.activate("a")).toBe(true);
    expect(coordinator.activate("b")).toBe(true);
    expect(events).toEqual(["a:activate", "a:deactivate", "b:activate"]);
    expect(coordinator.activeToolId()).toBe("b");
  });

  it("toggles the active tool off without disposing it", () => {
    const events: string[] = [];
    const a = fakeTool("a", events);
    const coordinator = createGameToolCoordinator([a]);

    expect(coordinator.toggle("a")).toBe(true);
    expect(coordinator.toggle("a")).toBe(true);
    expect(coordinator.activeTool()).toBeUndefined();
    expect(events).toEqual(["a:activate", "a:deactivate"]);
  });

  it("rejects locked, disabled and hidden tools without disturbing the active tool", () => {
    const events: string[] = [];
    const active = fakeTool("a", events);
    const locked = fakeTool("b", events, {
      status: "locked",
      reason: "Requires milestone",
    });
    const disabled = fakeTool("c", events, {
      status: "disabled",
      reason: "Unavailable now",
    });
    const hidden = fakeTool("d", events, { status: "hidden" });
    const coordinator = createGameToolCoordinator([
      active,
      locked,
      disabled,
      hidden,
    ]);

    expect(coordinator.activate("a")).toBe(true);
    expect(coordinator.activate("b")).toBe(false);
    expect(coordinator.activate("c")).toBe(false);
    expect(coordinator.activate("d")).toBe(false);
    expect(coordinator.activate("missing")).toBe(false);
    expect(coordinator.activeToolId()).toBe("a");
    expect(events).toEqual(["a:activate"]);
  });

  it("deactivates idempotently and disposes every tool exactly once", () => {
    const events: string[] = [];
    const a = fakeTool("a", events);
    const b = fakeTool("b", events);
    const coordinator = createGameToolCoordinator([a, b]);

    coordinator.activate("a");
    coordinator.deactivate();
    coordinator.deactivate();
    coordinator.dispose();
    coordinator.dispose();

    expect(events).toEqual([
      "a:activate",
      "a:deactivate",
      "a:dispose",
      "b:dispose",
    ]);
  });

  it("rechecks availability at activation time", () => {
    const events: string[] = [];
    const tool = fakeTool("a", events) as GameToolRuntime & {
      setAvailability(next: GameToolAvailability): void;
    };
    const coordinator = createGameToolCoordinator([tool]);

    tool.setAvailability({ status: "disabled", reason: "Busy" });
    expect(coordinator.activate("a")).toBe(false);
    tool.setAvailability({ status: "available" });
    expect(coordinator.activate("a")).toBe(true);
    expect(events).toEqual(["a:activate"]);
  });
});
