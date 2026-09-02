# Game HUD Refinement v1 — Tool Dock Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Game HUD Refinement v1 by replacing the partial always-visible grouped Tool Dock with an authoritative Category → Tool → Context interaction, structurally stacking tool surfaces without overlap, preserving the approved HUD/Menu/Debug/Terraform contracts, and returning the full repository verification gate to zero failures.

**Architecture:** Composition owns UI-only `expandedCategoryId`, while the existing `GameToolCoordinator` remains the sole active-tool runtime authority. A focused `GameToolNavigationController` coordinates category presses, tool presses, keyboard shortcuts, and dismissal while enforcing `active tool ⇒ active tool category is expanded`. The shell renders Context Surface and Tool Dock inside one bottom-anchored Tool Stack so layout follows rendered height instead of fixed bottom offsets.

**Tech Stack:** TypeScript, Three.js, DOM UI primitives, Vitest, Playwright, CSS, pnpm, Node 22.18.0.

**Spec:** `docs/superpowers/specs/2026-09-02-game-hud-refinement-v1-tool-dock-expansion-design.md`

## Global Constraints

- Work only on branch `feat/game-hud-refinement-v1`; do not modify `master` directly.
- Do not create an isolated worktree.
- The current branch contains approved partial uncommitted implementation; evolve it in place and do not reset or discard it blindly.
- Do not stage or commit unrelated local files such as `.zed/`.
- Production currently exposes only `Environment → Terrain`; do not add fake Build, Services, Roads, Zones, Buildings, Utilities, or Transport production entries.
- Do not add fake HUD metrics, simulation speed/date controls, Settings, economy, population, World Presentation, lighting, water, biome, or save-browser work.
- `ToolDock` is a renderer/event surface; it must not privately own authoritative expanded-category state.
- `GameToolCoordinator` remains the active-tool runtime authority and must not own UI rendering details.
- `active tool ⇒ expanded category === active tool.category.id` must always hold.
- Keyboard handling stays centralized in `createGameCommandRouter`; no scattered gameplay `keydown` handlers.
- `T` from idle expands Environment and activates Terrain; `T` from active Terrain deactivates Terrain and collapses Environment.
- `F3` opens Debug through semantic command routing; Debug must not return to the production Game Menu.
- Production Game Menu remains exactly `Resume`, `Save City`, `Exit to Main Menu`.
- Context Surface / Tool Tray / Category Dock must use actual layout flow; do not encode Dock/Tray pixel height into Context `bottom` calculations.
- Terraform strength presentation remains derived from `strengthLevels(strength) * LOGICAL_ELEVATION_METERS` via `strengthDeltaMeters(strength)`.
- Final verification must run under Node `22.18.0`.
- Do not push until implementation and verification are complete or the user explicitly requests it.

---

## File Structure Map

### New focused composition unit

- `apps/game/src/composition/game/create-game-tool-navigation-controller.ts`
  - Owns `expandedCategoryId` only.
  - Coordinates category/tool interactions with `GameToolCoordinator`.
  - Knows tool descriptors only through the supplied runtime list.
  - Emits immutable navigation state after every successful transition.
  - Implements category press, tool press, keyboard tool toggle, and tool/category dismissal.

- `apps/game/tests/game-tool-navigation-controller.test.ts`
  - Unit-tests the state machine without DOM/WebGL.

### Existing renderer/presentation units

- `apps/game/src/ui/patterns/tool-dock.ts`
  - Renders Category Dock always for visible categories.
  - Renders Tool Tray only for `expandedCategoryId`.
  - Emits `onCategoryPress(categoryId)` and `onToolPress(toolId)`.
  - Does not mutate authoritative expanded state internally.

- `apps/game/src/ui/screens/game/create-game-shell-view.ts`
  - Adds a structural `toolStackHost` while preserving `toolDockHost` and `contextHost` references/test IDs for callers and regression tests.

- `apps/game/src/ui/styles/screens.css`
  - Owns Tool Stack shell positioning/layer placement.

- `apps/game/src/ui/styles/patterns.css`
  - Owns Tool Stack child surfaces, Tool Dock, Tool Tray, Category Dock, Context Surface presentation.

- `apps/game/src/ui/styles/responsive.css`
  - Changes width/density/scroll behavior only; no separate interaction state and no fixed dock-height offsets.

### Existing composition integration

- `apps/game/src/composition/create-live-city-experience.ts`
  - Instantiates `GameToolNavigationController`.
  - Synchronizes Tool Dock + Context Surface from navigation/tool state.
  - Routes `T`, category presses, tool presses, Context close, and Escape into navigation semantics.

- `apps/game/src/composition/game/create-game-ui-coordinator.ts`
  - Extends central dismissal with a tool-navigation dismissal callback that can distinguish "handled tool/category state" from "nothing to dismiss".

- `apps/game/src/composition/game/create-game-command-router.ts`
  - Keeps current semantic command shape; no new DOM handler.

### Approved partial contracts to retain/finalize

- `apps/game/src/ui/patterns/game-hud.ts`
- `apps/game/src/ui/tools/game-tool-contract.ts`
- `apps/game/src/ui/tools/terraform/create-terraform-tool-view.ts`
- `apps/game/src/ui/tools/terraform/terraform-strength-options.ts`
- `systems/terraform/src/domain/strength.ts`
- `systems/terraform/src/index.ts`

### Browser regression surfaces

- `tests/browser/game-ui.spec.ts`
- `tests/browser/game-ui-responsive.spec.ts`
- `tests/browser/terraform-touch.spec.ts`
- `tests/browser/terraform.spec.ts`
- `tests/browser/live-city.spec.ts`
- `tests/browser/game-menu-test-helpers.ts`
- `tests/browser/city-lifecycle.spec.ts`
- `tests/browser/terraform-disposal.spec.ts`
- `tests/browser/terraform-persistence.spec.ts`
- `tests/browser/game-ui-lifecycle-soak.spec.ts`
- `tests/browser/terraform-lifecycle-soak.spec.ts`
- `tests/browser/terrain-lifecycle-soak.spec.ts`

---

### Task 1: Add the authoritative Tool Navigation state machine

**Files:**
- Create: `apps/game/src/composition/game/create-game-tool-navigation-controller.ts`
- Create: `apps/game/tests/game-tool-navigation-controller.test.ts`
- Read only: `apps/game/src/composition/game/create-game-tool-coordinator.ts`
- Read only: `apps/game/src/ui/tools/game-tool-contract.ts`

**Interfaces:**
- Consumes:
  - `readonly tools: readonly GameToolRuntime[]`
  - `readonly toolCoordinator: GameToolCoordinator`
  - `readonly onStateChange: (state: GameToolNavigationState) => void`
- Produces:

```ts
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
}): GameToolNavigationController;
```

**Required transition semantics:**

```text
pressCategory(collapsed category)
→ deactivate current tool if any
→ expand requested category
→ active none

pressCategory(expanded category)
→ deactivate active tool if any
→ collapse category

pressTool(tool in expanded category)
→ coordinator.toggle(toolId)
→ expanded category remains

pressTool(tool outside expanded category)
→ reject false; renderer should not normally expose this path

toggleToolShortcut(inactive tool)
→ expand tool.category
→ coordinator.activate(toolId)

toggleToolShortcut(active tool)
→ coordinator.deactivate()
→ collapse category

dismissToolNavigation(active tool)
→ coordinator.deactivate()
→ collapse category
→ true

dismissToolNavigation(expanded only)
→ collapse category
→ true

dismissToolNavigation(idle)
→ false
```

- [ ] **Step 1: Write the failing state-machine tests**

Create `apps/game/tests/game-tool-navigation-controller.test.ts` with a two-category fake registry and explicit transition assertions:

```ts
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
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
pnpm --filter @web-three-city/app-game exec vitest run tests/game-tool-navigation-controller.test.ts --reporter=verbose
```

Expected: FAIL because `create-game-tool-navigation-controller.ts` does not exist.

- [ ] **Step 3: Implement the minimal navigation controller**

Implement a descriptor map from the supplied `tools`, immutable state snapshots, successful-transition callbacks, and disposal guards. Do not import DOM/UI patterns.

Core implementation shape:

```ts
const byToolId = new Map(input.tools.map((tool) => [tool.descriptor.id, tool]));
let expandedCategoryId: string | undefined;
let disposed = false;

const snapshot = (): GameToolNavigationState => {
  const activeToolId = input.toolCoordinator.activeToolId();
  return Object.freeze({
    ...(expandedCategoryId === undefined ? {} : { expandedCategoryId }),
    ...(activeToolId === undefined ? {} : { activeToolId }),
  });
};

const publish = (): void => input.onStateChange(snapshot());
```

For shortcut activation, set `expandedCategoryId = tool.descriptor.category.id` before activating. If coordinator activation fails, restore the previous expanded category and return `false`.

- [ ] **Step 4: Run focused tests and coordinator regressions**

Run:

```bash
pnpm --filter @web-three-city/app-game exec vitest run \
  tests/game-tool-navigation-controller.test.ts \
  tests/game-tool-coordinator.test.ts \
  --reporter=verbose
```

Expected: PASS, with existing coordinator behavior unchanged.

- [ ] **Step 5: Commit only Task 1 files**

```bash
git add \
  apps/game/src/composition/game/create-game-tool-navigation-controller.ts \
  apps/game/tests/game-tool-navigation-controller.test.ts
git diff --cached --check
git commit -m "feat(game-ui): add tool navigation state machine"
```

---

### Task 2: Replace grouped Tool Dock rendering with Category Dock + Tool Tray

**Files:**
- Modify: `apps/game/src/ui/patterns/tool-dock.ts`
- Modify: `apps/game/src/ui/tools/game-tool-contract.ts`
- Modify: `apps/game/tests/ui-components-harness.ts`
- Modify: `tests/browser/ui-components.spec.ts`

**Interfaces:**
- Consumes existing `GameToolCategoryDescriptor` and `GameToolDescriptor.category`.
- Produces:

```ts
export interface ToolDockViewState {
  readonly tools: readonly {
    readonly descriptor: GameToolDescriptor;
    readonly availability: GameToolAvailability;
  }[];
  readonly expandedCategoryId?: string;
  readonly activeToolId?: string;
}

export function createToolDock(input: {
  readonly onCategoryPress: (categoryId: string) => void;
  readonly onToolPress: (toolId: string) => void;
}): ToolDockHandle;
```

**DOM contract:**

```text
nav.game-tool-dock[aria-label="Gameplay tools"]
├── div.game-tool-dock__tool-tray[aria-label="<Category> tools"]
│   └── tool buttons for expanded category only
└── div.game-tool-dock__category-dock[aria-label="Tool categories"]
    └── category buttons with aria-expanded="true|false"
```

Category buttons are real buttons created with `createButton`, not text labels. The category button label is the category label; no category icon metadata is added in this scope.

- [ ] **Step 1: Change the browser harness expectations first**

Update the harness to track category/tool presses separately:

```ts
const toolDock = createToolDock({
  onCategoryPress: (id) => {
    mount.dataset.categoryPress = id;
  },
  onToolPress: (id) => {
    mount.dataset.toolPress = id;
  },
});

toolDock.render({
  tools: [
    { descriptor: terrain, availability: { status: "available" } },
    { descriptor: roads, availability: { status: "locked", reason: "Requires milestone" } },
    { descriptor: zones, availability: { status: "hidden" } },
  ],
  expandedCategoryId: "environment",
  activeToolId: "terrain",
});
```

Add/replace assertions in `tests/browser/ui-components.spec.ts` so they prove:

```ts
const dock = page.getByRole("navigation", { name: "Gameplay tools" });
const categories = dock.getByRole("group", { name: "Tool categories" });
await expect(categories.getByRole("button", { name: "Build" })).toHaveAttribute("aria-expanded", "false");
await expect(categories.getByRole("button", { name: "Environment" })).toHaveAttribute("aria-expanded", "true");
await expect(dock.getByRole("group", { name: "Environment tools" })).toBeVisible();
await expect(dock.getByRole("button", { name: "Terrain", exact: true })).toBeVisible();
await expect(dock.getByRole("button", { name: "Roads", exact: true })).toHaveCount(0);
```

Then click Build and assert `data-category-press="build"`; the harness remains externally rendered and does not self-own navigation state.

- [ ] **Step 2: Run browser harness test and confirm RED**

Run:

```bash
pnpm exec playwright test tests/browser/ui-components.spec.ts --grep "generic game patterns" --workers=1
```

Expected: FAIL because the current Tool Dock renders category labels as sections and all visible tools immediately.

- [ ] **Step 3: Implement Category Dock + Tool Tray renderer**

In `tool-dock.ts`:

1. derive unique visible categories from tool metadata,
2. sort categories by `category.order`, then label,
3. render one category button per category,
4. set `aria-expanded` from `state.expandedCategoryId`,
5. render Tool Tray only for the matching expanded category,
6. sort tools inside the tray by `descriptor.order`, then label,
7. preserve availability/disabled/reason semantics,
8. keep tool button instances reusable and dispose removed tools,
9. keep category button handles reusable and dispose removed categories.

The renderer must not change `expandedCategoryId` after a click; it only calls `input.onCategoryPress` and waits for the next render state.

- [ ] **Step 4: Run focused browser and typecheck**

```bash
pnpm exec playwright test tests/browser/ui-components.spec.ts --grep "generic game patterns" --workers=1
pnpm --filter @web-three-city/app-game typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit only Tool Dock renderer/harness files**

```bash
git add \
  apps/game/src/ui/patterns/tool-dock.ts \
  apps/game/src/ui/tools/game-tool-contract.ts \
  apps/game/tests/ui-components-harness.ts \
  tests/browser/ui-components.spec.ts
git diff --cached --check
git commit -m "feat(game-ui): add category-driven tool dock"
```

---

### Task 3: Integrate category navigation, T shortcut, Escape, HUD, Menu, and Debug into the live city

**Files:**
- Modify: `apps/game/src/composition/create-live-city-experience.ts`
- Modify: `apps/game/src/composition/game/create-game-ui-coordinator.ts`
- Modify: `apps/game/src/composition/game/create-game-command-router.ts`
- Modify: `apps/game/src/ui/patterns/game-hud.ts`
- Modify: `apps/game/tests/game-interaction-router.test.ts`
- Modify: `tests/browser/game-ui.spec.ts`

**Interfaces:**
- Consumes Task 1 `GameToolNavigationController`.
- `createGameUiCoordinator` changes tool dismissal inputs from:

```ts
readonly hasActiveTool: () => boolean;
readonly deactivateActiveTool: () => void;
```

to:

```ts
readonly dismissToolNavigation: () => boolean;
```

The callback returns `true` when active tool/category state was dismissed and `false` when tool navigation was already idle.

**Live integration state:**

```ts
let toolNavigation: GameToolNavigationController | undefined;
let toolNavigationState: GameToolNavigationState = Object.freeze({});
```

`syncToolUi()` renders the Tool Dock with both `expandedCategoryId` and `activeToolId`, and renders Context only when the coordinator has an active tool.

- [ ] **Step 1: Rewrite `game-ui.spec.ts` to the approved interaction before implementation**

Change the production HUD test from "Terrain visible immediately" to:

```ts
const dock = page.getByRole("navigation", { name: "Gameplay tools" });
const environment = dock.getByRole("button", { name: "Environment", exact: true });
await expect(environment).toBeVisible();
await expect(environment).toHaveAttribute("aria-expanded", "false");
await expect(dock.getByRole("button", { name: "Terrain", exact: true })).toHaveCount(0);
```

Add a Tool Dock state test:

```ts
await environment.click();
await expect(environment).toHaveAttribute("aria-expanded", "true");
const terrain = dock.getByRole("button", { name: "Terrain", exact: true });
await expect(terrain).toBeVisible();

await terrain.click();
await expect(game).toHaveAttribute("data-active-tool", "terrain");
await expect(page.getByTestId("game-context-surface")).toBeVisible();

await terrain.click();
await expect(game).toHaveAttribute("data-active-tool", "");
await expect(environment).toHaveAttribute("aria-expanded", "true");
await expect(page.getByTestId("game-context-surface")).toBeHidden();

await environment.click();
await expect(environment).toHaveAttribute("aria-expanded", "false");
await expect(terrain).toHaveCount(0);
```

Change central dismissal expectations:

```text
Environment expanded + Terrain active
Escape → Terrain inactive + Environment collapsed + Context hidden
Escape → Game Menu opens
```

Add keyboard behavior:

```ts
await page.keyboard.press("T");
await expect(game).toHaveAttribute("data-active-tool", "terrain");
await expect(environment).toHaveAttribute("aria-expanded", "true");
await page.keyboard.press("T");
await expect(game).toHaveAttribute("data-active-tool", "");
await expect(environment).toHaveAttribute("aria-expanded", "false");
```

Retain existing `F3` and production-menu assertions.

- [ ] **Step 2: Run Game UI browser tests and confirm RED**

```bash
pnpm exec playwright test tests/browser/game-ui.spec.ts --workers=1
```

Expected: FAIL because production currently exposes Terrain immediately and Escape does not know expanded-category state.

- [ ] **Step 3: Integrate `GameToolNavigationController` in `create-live-city-experience.ts`**

After constructing `terraformTool` and `toolCoordinator`:

```ts
toolNavigation = createGameToolNavigationController({
  tools: [terraformTool],
  toolCoordinator,
  onStateChange: (state) => {
    toolNavigationState = state;
    syncToolUi();
  },
});
```

Construct the dock as:

```ts
toolDock = createToolDock({
  onCategoryPress: (categoryId) => {
    toolNavigation?.pressCategory(categoryId);
  },
  onToolPress: (toolId) => {
    toolNavigation?.pressTool(toolId);
  },
});
```

Route Context close through:

```ts
onDismiss: () => {
  toolNavigation?.dismissToolNavigation();
}
```

Route `toggle-tool` through:

```ts
if (command.type === "toggle-tool") {
  toolNavigation?.toggleToolShortcut(command.toolId);
}
```

`syncToolUi()` must use:

```ts
dock.render({
  tools: [{ descriptor: terrain.descriptor, availability: terrain.availability() }],
  ...(toolNavigationState.expandedCategoryId === undefined
    ? {}
    : { expandedCategoryId: toolNavigationState.expandedCategoryId }),
  ...(activeToolId === undefined ? {} : { activeToolId }),
});
```

Dispose `toolNavigation` before `toolCoordinator` during teardown.

- [ ] **Step 4: Update central Game UI dismissal**

In `create-game-ui-coordinator.ts`, after Menu → Debug → Inspector precedence:

```ts
if (input.dismissToolNavigation()) return;
openGameMenu();
```

This replaces the old `hasActiveTool()/deactivateActiveTool()` branch and allows an expanded-only category to dismiss before Game Menu.

- [ ] **Step 5: Retain approved command/HUD contracts and focused unit coverage**

Keep `GameUiCommand` containing `open-debug`, `commandShortcuts`, editable-target suppression, and `GameHudViewState.simulationControls?` from the partial implementation.

Run:

```bash
pnpm --filter @web-three-city/app-game exec vitest run tests/game-interaction-router.test.ts --reporter=verbose
pnpm exec playwright test tests/browser/game-ui.spec.ts --workers=1
```

Expected: PASS.

- [ ] **Step 6: Commit live interaction integration**

```bash
git add \
  apps/game/src/composition/create-live-city-experience.ts \
  apps/game/src/composition/game/create-game-ui-coordinator.ts \
  apps/game/src/composition/game/create-game-command-router.ts \
  apps/game/src/ui/patterns/game-hud.ts \
  apps/game/tests/game-interaction-router.test.ts \
  tests/browser/game-ui.spec.ts
git diff --cached --check
git commit -m "feat(game-ui): integrate category tool navigation"
```

---

### Task 4: Replace fixed Context offsets with one structural Tool Stack

**Files:**
- Modify: `apps/game/src/ui/screens/game/create-game-shell-view.ts`
- Modify: `apps/game/src/ui/styles/screens.css`
- Modify: `apps/game/src/ui/styles/patterns.css`
- Modify: `apps/game/src/ui/styles/responsive.css`
- Modify: `tests/browser/game-ui-responsive.spec.ts`
- Modify: `tests/browser/terraform-touch.spec.ts`

**Interfaces:**
- `GameShellView` adds:

```ts
readonly toolStackHost: HTMLElement;
```

- Existing `toolDockHost` and `contextHost` remain exposed and retain test IDs.
- Shell DOM becomes:

```text
game-shell__tool-stack-host (full layer owner)
└── .game-tool-stack (bottom-anchored flow container)
    ├── game-context-host
    └── game-tool-dock-host
```

Inside Tool Dock, Tool Tray remains above Category Dock, so actual visual order is:

```text
Context Surface
Tool Tray
Category Dock
```

- [ ] **Step 1: Strengthen responsive RED tests to assert all three surfaces**

In `game-ui-responsive.spec.ts`, update game setup to expand Environment before clicking Terrain:

```ts
await page.getByRole("button", { name: "Environment", exact: true }).click();
await page.getByRole("button", { name: "Terrain", exact: true }).click();
```

For compact layout, capture:

```ts
const contextBox = await page.getByTestId("game-context-surface").boundingBox();
const trayBox = await page.locator(".game-tool-dock__tool-tray").boundingBox();
const categoriesBox = await page.locator(".game-tool-dock__category-dock").boundingBox();
```

Assert:

```ts
expect(contextBox.y + contextBox.height).toBeLessThanOrEqual(trayBox.y - 8);
expect(trayBox.y + trayBox.height).toBeLessThanOrEqual(categoriesBox.y - 8);
```

Repeat the same structural assertions in `terraform-touch.spec.ts` while retaining width/overflow/touch behavior.

- [ ] **Step 2: Run responsive/touch tests and confirm RED**

```bash
pnpm exec playwright test \
  tests/browser/game-ui-responsive.spec.ts \
  tests/browser/terraform-touch.spec.ts \
  --workers=1
```

Expected: FAIL because Context and Dock still use independent absolute bottom positioning and no structural stack exists.

- [ ] **Step 3: Add Tool Stack structure to the shell**

In `create-game-shell-view.ts`:

```ts
const toolStackHost = createHost(
  "game-tool-stack-host",
  "game-shell__tool-stack-host",
  "tool",
);
const toolStack = document.createElement("div");
toolStack.className = "game-tool-stack";

const contextHost = document.createElement("div");
contextHost.className = "game-tool-stack__context-host";
contextHost.dataset.testid = "game-context-host";

const toolDockHost = document.createElement("div");
toolDockHost.className = "game-tool-stack__dock-host";
toolDockHost.dataset.testid = "game-tool-dock-host";

toolStack.append(contextHost, toolDockHost);
toolStackHost.append(toolStack);
```

Append `toolStackHost` once to the shell instead of appending full-screen Tool Dock and Context hosts separately.

- [ ] **Step 4: Move tool surfaces into normal stack flow**

In CSS:

```css
.game-shell__tool-stack-host {
  z-index: var(--ui-layer-tool);
}

.game-tool-stack {
  position: absolute;
  left: 50%;
  bottom: calc(var(--ui-safe-bottom) + var(--ui-space-3));
  transform: translateX(-50%);
  width: fit-content;
  max-width: calc(100vw - var(--ui-safe-left) - var(--ui-safe-right) - (2 * var(--ui-space-3)));
  display: grid;
  justify-items: center;
  gap: var(--ui-space-2);
  pointer-events: none;
}

.game-tool-stack__context-host,
.game-tool-stack__dock-host {
  min-width: 0;
  max-width: 100%;
  pointer-events: none;
}

.game-context-surface,
.game-tool-dock {
  position: static;
  inset: auto;
  transform: none;
}
```

Remove Context `bottom: calc(...control-min...)` rules from `patterns.css` and `responsive.css`.

For `max-width: 639px`, make `.game-tool-stack` span safe-area width:

```css
.game-tool-stack {
  left: calc(var(--ui-safe-left) + var(--ui-space-2));
  right: calc(var(--ui-safe-right) + var(--ui-space-2));
  bottom: calc(var(--ui-safe-bottom) + var(--ui-space-2));
  width: auto;
  max-width: none;
  transform: none;
  justify-items: stretch;
}
```

Do not add a new numeric offset based on Tool Dock or Tool Tray height.

- [ ] **Step 5: Run responsive/touch tests across profiles**

```bash
pnpm exec playwright test \
  tests/browser/game-ui-responsive.spec.ts \
  tests/browser/terraform-touch.spec.ts \
  --workers=1
```

Expected: PASS with no overlap, no horizontal overflow, and touch path intact.

- [ ] **Step 6: Commit structural Tool Stack changes**

```bash
git add \
  apps/game/src/ui/screens/game/create-game-shell-view.ts \
  apps/game/src/ui/styles/screens.css \
  apps/game/src/ui/styles/patterns.css \
  apps/game/src/ui/styles/responsive.css \
  tests/browser/game-ui-responsive.spec.ts \
  tests/browser/terraform-touch.spec.ts
git diff --cached --check
git commit -m "feat(game-ui): stack tool surfaces by layout flow"
```

---

### Task 5: Finalize Terraform strength ownership and HUD optional-center regression

**Files:**
- Modify: `systems/terraform/src/domain/strength.ts`
- Modify: `systems/terraform/src/index.ts`
- Create/retain: `systems/terraform/tests/strength.test.ts`
- Create/retain: `apps/game/src/ui/tools/terraform/terraform-strength-options.ts`
- Modify: `apps/game/src/ui/tools/terraform/create-terraform-tool-view.ts`
- Modify: `apps/game/tests/ui-foundation-architecture.test.ts`
- Modify: `apps/game/tests/ui-components-harness.ts`
- Modify: `tests/browser/ui-components.spec.ts`
- Modify: `tests/browser/terraform.spec.ts`

**Interfaces:**

```ts
export function strengthDeltaMeters(strength: TerraformStrength): number {
  return strengthLevels(strength) * LOGICAL_ELEVATION_METERS;
}
```

and:

```ts
export const TERRAFORM_STRENGTH_OPTIONS: readonly {
  readonly value: TerraformStrength;
  readonly label: string;
  readonly testId: string;
}[];
```

- [ ] **Step 1: Run the existing ownership tests as the RED/GREEN checkpoint**

The partial branch already contains the intended tests. Run them before any cleanup:

```bash
pnpm --filter @web-three-city/terraform exec vitest run tests/strength.test.ts --reporter=verbose
pnpm --filter @web-three-city/app-game exec vitest run tests/ui-foundation-architecture.test.ts --reporter=verbose
```

Expected current state: PASS. If either fails after Tasks 1–4, repair only the ownership seam described by the spec; do not reintroduce meter literals into the view.

- [ ] **Step 2: Verify the source ownership directly**

Run:

```bash
rg -n 'Fine 0\.25m|Normal 1m|Strong 4m' \
  apps/game/src/ui/tools/terraform \
  systems/terraform/src
```

Expected: no matches in production source.

- [ ] **Step 3: Verify browser labels and HUD optional center**

The browser tests must assert all current labels:

```ts
for (const label of ["Fine 0.25m", "Normal 1m", "Strong 4m"]) {
  await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
}
```

and the UI-components harness must retain:

```text
no simulation controls → HUD center hidden
supplied simulation control → HUD center visible
```

Run:

```bash
pnpm exec playwright test \
  tests/browser/ui-components.spec.ts \
  tests/browser/terraform.spec.ts \
  --workers=1
```

Expected: PASS.

- [ ] **Step 4: Commit the approved ownership/HUD partial implementation**

```bash
git add \
  systems/terraform/src/domain/strength.ts \
  systems/terraform/src/index.ts \
  systems/terraform/tests/strength.test.ts \
  apps/game/src/ui/tools/terraform/terraform-strength-options.ts \
  apps/game/src/ui/tools/terraform/create-terraform-tool-view.ts \
  apps/game/tests/ui-foundation-architecture.test.ts \
  apps/game/tests/ui-components-harness.ts \
  tests/browser/ui-components.spec.ts \
  tests/browser/terraform.spec.ts
git diff --cached --check
git commit -m "refactor(terraform-ui): derive strength labels from domain"
```

If some listed files were already committed by Task 2 or 3, stage only their remaining Task 5 diff; never amend prior task commits merely to force the file list.

---

### Task 6: Migrate all stale Game Menu / Debug browser contracts

**Files:**
- Modify: `tests/browser/game-menu-test-helpers.ts`
- Modify: `tests/browser/city-lifecycle.spec.ts`
- Modify: `tests/browser/live-city.spec.ts`
- Modify: `tests/browser/terraform-disposal.spec.ts`
- Modify: `tests/browser/terraform-persistence.spec.ts`
- Modify: `tests/browser/game-ui-lifecycle-soak.spec.ts`
- Modify: `tests/browser/terraform-lifecycle-soak.spec.ts`
- Modify: `tests/browser/terrain-lifecycle-soak.spec.ts`

**Interfaces:**

```ts
export type GameMenuAction = "Resume" | "Save City" | "Exit to Main Menu";
```

Debug browser flows use:

```ts
await page.keyboard.press("F3");
```

not a Game Menu action.

- [ ] **Step 1: Prove the stale contracts still exist**

Run:

```bash
rg -n 'Exit City|name: "Debug"|GameMenuAction.*Debug' tests/browser
```

Expected before migration: matches in lifecycle/persistence/disposal/live-city/soak helpers.

- [ ] **Step 2: Update the shared helper and normal exit calls**

Change:

```ts
export type GameMenuAction = "Resume" | "Save City" | "Exit to Main Menu";
```

Replace every:

```ts
await gameMenuAction(page, "Exit City");
```

with:

```ts
await gameMenuAction(page, "Exit to Main Menu");
```

For direct locators replace `{ name: "Exit City" }` with `{ name: "Exit to Main Menu" }`.

- [ ] **Step 3: Migrate Debug acceptance in `live-city.spec.ts`**

Replace:

```ts
await page.getByRole("button", { name: "Open game menu" }).click();
const menu = page.getByRole("dialog", { name: "Game menu" });
await menu.getByRole("button", { name: "Debug" }).click();
```

with:

```ts
await page.keyboard.press("F3");
const debug = page.getByRole("region", { name: "Terrain Debug" });
await expect(debug).toBeVisible();
```

When later saving/exiting, explicitly open the Game Menu again before selecting its actions.

- [ ] **Step 4: Verify no stale contract remains**

```bash
rg -n 'Exit City|name: "Debug"|GameMenuAction.*Debug' tests/browser
```

Expected: no stale Game Menu contract matches. The deliberate `menu ... Debug ... toHaveCount(0)` negative assertion in `game-ui.spec.ts` may remain and is not a stale positive contract.

- [ ] **Step 5: Run the affected non-soak browser tests**

```bash
pnpm exec playwright test \
  tests/browser/city-lifecycle.spec.ts \
  tests/browser/live-city.spec.ts \
  tests/browser/terraform-disposal.spec.ts \
  tests/browser/terraform-persistence.spec.ts \
  --workers=1
```

Expected: no timeout waiting for `Exit City` or Game Menu `Debug`.

- [ ] **Step 6: Commit browser contract migration**

```bash
git add \
  tests/browser/game-menu-test-helpers.ts \
  tests/browser/city-lifecycle.spec.ts \
  tests/browser/live-city.spec.ts \
  tests/browser/terraform-disposal.spec.ts \
  tests/browser/terraform-persistence.spec.ts \
  tests/browser/game-ui-lifecycle-soak.spec.ts \
  tests/browser/terraform-lifecycle-soak.spec.ts \
  tests/browser/terrain-lifecycle-soak.spec.ts
git diff --cached --check
git commit -m "test(game-ui): migrate menu and debug contracts"
```

---

### Task 7: Close production category/shortcut/orientation/touch lifecycle regressions

**Files:**
- Modify as needed from failing assertions only:
  - `tests/browser/game-ui.spec.ts`
  - `tests/browser/game-ui-responsive.spec.ts`
  - `tests/browser/terraform-touch.spec.ts`
  - `tests/browser/terraform.spec.ts`
  - `apps/game/src/composition/create-live-city-experience.ts`
  - `apps/game/src/composition/game/create-game-tool-navigation-controller.ts`
  - `apps/game/src/ui/patterns/tool-dock.ts`
  - `apps/game/src/ui/styles/patterns.css`
  - `apps/game/src/ui/styles/responsive.css`

**Interfaces:**
- No new public contract is introduced in this task.
- This task verifies the already-defined state machine across actual browser input and viewport changes.

- [ ] **Step 1: Run the complete feature-focused browser set under Node 22.18.0**

```bash
source ~/.nvm/nvm.sh
nvm use 22.18.0
pnpm exec playwright test \
  tests/browser/game-ui.spec.ts \
  tests/browser/game-ui-responsive.spec.ts \
  tests/browser/terraform-touch.spec.ts \
  tests/browser/terraform.spec.ts \
  tests/browser/ui-components.spec.ts \
  --workers=1
```

Expected: PASS.

- [ ] **Step 2: If a feature-focused assertion fails, create a minimal regression before fixing it**

For state failures, add the smallest missing transition to `game-tool-navigation-controller.test.ts` first. For geometry failures, add an explicit Context/Tray/Category bounding-box assertion first. For shortcut failures, add the command/navigation browser assertion first. Re-run that single test and observe RED before changing production.

Do not solve geometry by adding a Dock/Tray height constant to Context positioning.

- [ ] **Step 3: Run focused unit and browser verification after any fix**

```bash
pnpm --filter @web-three-city/app-game exec vitest run \
  tests/game-tool-navigation-controller.test.ts \
  tests/game-tool-coordinator.test.ts \
  tests/game-interaction-router.test.ts \
  tests/ui-foundation-architecture.test.ts \
  --reporter=verbose

pnpm exec playwright test \
  tests/browser/game-ui.spec.ts \
  tests/browser/game-ui-responsive.spec.ts \
  tests/browser/terraform-touch.spec.ts \
  tests/browser/terraform.spec.ts \
  tests/browser/ui-components.spec.ts \
  --workers=1
```

Expected: PASS.

- [ ] **Step 4: Commit only actual regression-closure changes, if any**

If Task 7 required code/test changes:

```bash
git add <only-files-changed-to-close-task-7-regressions>
git diff --cached --check
git commit -m "test(game-ui): close tool navigation regressions"
```

If no files changed because all focused tests already pass, do not create an empty commit.

---

### Task 8: Run the repository verification gate under Node 22.18.0 and isolate unrelated Terrain failure if necessary

**Files:**
- No planned production files.
- Modify only a separately root-caused Terrain test/implementation if the Node-22 isolated reproduction proves an independent defect; do not route that repair through HUD/Tool Dock code.

**Interfaces:**
- Verification gate only.

- [ ] **Step 1: Confirm branch, runtime, and unrelated file exclusion**

```bash
source ~/.nvm/nvm.sh
nvm use 22.18.0
node --version
pnpm --version
git status --short --branch
```

Expected:

```text
branch = feat/game-hud-refinement-v1
node = v22.18.0
.zed/ remains untracked/uncommitted if still present
```

- [ ] **Step 2: Run the previously unstable Terrain browser case in isolation**

```bash
pnpm exec playwright test \
  tests/browser/terrain-phase-1.spec.ts \
  --grep "projects production Terrain through real WebGL and semantic picking" \
  --workers=1
```

Expected: PASS under the repository runtime.

If this isolated test still fails, stop feature completion claims and invoke `superpowers:systematic-debugging`. Reproduce the exact failure under Node 22, inspect trace/error context, and fix only the independently identified Terrain/WebGL/picking root cause. Do not add HUD/Tool Dock timing sleeps or unrelated UI changes to mask it.

- [ ] **Step 3: Run the complete repository gate**

```bash
pnpm verify
```

Expected final conditions:

```text
format:      PASS
lint:        PASS
typecheck:   PASS
unit tests:  PASS
architecture: 0 violations
build:       PASS
browser:     0 FAIL
```

The architecture edge count may differ from 140; zero violations is the acceptance invariant.

- [ ] **Step 4: Run final repository hygiene checks**

```bash
git diff --check
git status --short --branch
git log --oneline --decorate -12
```

Expected:

```text
git diff --check = no output
no unintended staged files
no .zed/ in any feature commit
branch remains feat/game-hud-refinement-v1
```

- [ ] **Step 5: Commit any final verification-only cleanup**

Only if verification required a legitimate tracked cleanup:

```bash
git add <verified-cleanup-files-only>
git diff --cached --check
git commit -m "test(game-ui): complete HUD refinement verification"
```

If verification is green without tracked cleanup, do not create an empty commit.

- [ ] **Step 6: Produce the completion report without pushing**

Report:

```text
branch
HEAD
working tree
files changed
commits
HUD
Top-center
Tool Dock
Game Menu / Debug
Terraform strength ownership
focused test evidence
pnpm verify evidence
git diff --check evidence
```

Do not push unless the user explicitly asks after reviewing this evidence.
