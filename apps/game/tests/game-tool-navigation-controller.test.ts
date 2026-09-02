import { describe, expect, it } from "vitest";
import { createGameToolCoordinator } from "../src/composition/game/create-game-tool-coordinator";
import { createGameToolNavigationController } from "../src/composition/game/create-game-tool-navigation-controller";
import type { GameToolRuntime } from "../src/composition/game/create-game-tool-coordinator";

function fakeTool(input: {
  id: string;
  categoryId: string;
  categoryLabel: string;
  categoryOrder: number;
  events: string[];
}): GameToolRuntime {
  return {
    descriptor: {
      id: input.id,
      label: input.id,
      icon: "terrain",
      order: 10,
      category: {
        id: input.categoryId,
        label: input.categoryLabel,
        order: input.categoryOrder,
      },
    },
    availability: () => ({ status: "available" }),
    activate: () => input.events.push(`${input.id}:activate`),
    deactivate: () => input.events.push(`${input.id}:deactivate`),
    dispose: () => undefined,
    view: { element: {} as HTMLElement, dispose: () => undefined },
  };
}

describe("Game tool navigation controller", () => {
  it("expands categories separately from active tools and enforces the invariant", () => {
    const events: string[] = [];
    const terrain = fakeTool({
      id: "terrain",
      categoryId: "environment",
      categoryLabel: "Environment",
      categoryOrder: 20,
      events,
    });
    const roads = fakeTool({
      id: "roads",
      categoryId: "build",
      categoryLabel: "Build",
      categoryOrder: 10,
      events,
    });
    const coordinator = createGameToolCoordinator([terrain, roads]);
    const states: object[] = [];
    const navigation = createGameToolNavigationController({
      tools: [terrain, roads],
      toolCoordinator: coordinator,
      onStateChange: (state) => states.push(state),
    });

    expect(navigation.pressCategory("environment")).toBe(true);
    expect(navigation.state()).toEqual({ expandedCategoryId: "environment" });
    expect(coordinator.activeToolId()).toBeUndefined();

    expect(navigation.pressTool("terrain")).toBe(true);
    expect(navigation.state()).toEqual({
      expandedCategoryId: "environment",
      activeToolId: "terrain",
    });

    expect(navigation.pressCategory("build")).toBe(true);
    expect(navigation.state()).toEqual({ expandedCategoryId: "build" });
    expect(events).toEqual(["terrain:activate", "terrain:deactivate"]);
    expect(states).toEqual([
      { expandedCategoryId: "environment" },
      { expandedCategoryId: "environment", activeToolId: "terrain" },
      { expandedCategoryId: "build" },
    ]);
  });

  it("uses the keyboard tool toggle as expand+activate and active-toggle as deactivate+collapse", () => {
    const events: string[] = [];
    const terrain = fakeTool({
      id: "terrain",
      categoryId: "environment",
      categoryLabel: "Environment",
      categoryOrder: 20,
      events,
    });
    const coordinator = createGameToolCoordinator([terrain]);
    const navigation = createGameToolNavigationController({
      tools: [terrain],
      toolCoordinator: coordinator,
      onStateChange: () => undefined,
    });

    expect(navigation.toggleToolShortcut("terrain")).toBe(true);
    expect(navigation.state()).toEqual({
      expandedCategoryId: "environment",
      activeToolId: "terrain",
    });

    expect(navigation.toggleToolShortcut("terrain")).toBe(true);
    expect(navigation.state()).toEqual({});
    expect(events).toEqual(["terrain:activate", "terrain:deactivate"]);
  });

  it("dismisses active tool and expanded category in one transition", () => {
    const events: string[] = [];
    const terrain = fakeTool({
      id: "terrain",
      categoryId: "environment",
      categoryLabel: "Environment",
      categoryOrder: 20,
      events,
    });
    const coordinator = createGameToolCoordinator([terrain]);
    const navigation = createGameToolNavigationController({
      tools: [terrain],
      toolCoordinator: coordinator,
      onStateChange: () => undefined,
    });

    navigation.toggleToolShortcut("terrain");
    expect(navigation.dismissToolNavigation()).toBe(true);
    expect(navigation.state()).toEqual({});
    expect(navigation.dismissToolNavigation()).toBe(false);
  });
});
