# Game UI Foundation v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current feature-specific application/game UI with one game-first, state-driven, responsive UI foundation that scales across lifecycle screens and gameplay tools while preserving existing World, Terrain, Terraform, City Session, persistence, camera, and input semantics.

**Architecture:** Keep the app on Vanilla TypeScript DOM factories + CSS + SVG and migrate incrementally from the current screens/toolbars into `Foundation -> Primitives -> Components -> Patterns -> Screens/Tool Views -> Coordinators`. `apps/game` remains the browser presentation/composition owner; generic UI layers do not import gameplay systems. The live game gains a generic shell, static app-owned tool registry/coordinator, centralized dismissal/keyboard routing, and a generic interaction router that preserves City Input's existing pre-gesture pointer observation / post-gesture semantic-tap commit split.

**Tech Stack:** TypeScript 5.9.2, Three.js 0.179.1, Vite 7.1.3, Vitest 3.2.4, Playwright 1.55.0, CSS, IndexedDB, pnpm 10.15.1, Node 22.18.0.

**Spec:** `docs/superpowers/specs/2026-08-31-game-ui-foundation-v1-design.md`

## Global Constraints

- Use Node `22.18.0` and pnpm `10.15.1` for all official local verification.
- Visual direction is game-first modern city-builder: world-first, compact, translucent, icon-forward, contextual, and consistent.
- No React, Vue, Svelte, Web Components, custom virtual DOM, custom observable framework, Redux/global UI store, runtime plugin discovery, or JSON-driven generic UI engine.
- Minimum interactive target is `44×44` CSS px.
- Minimum supported layout width is `320` CSS px; primary mobile portrait acceptance is `390×844`; primary mobile landscape acceptance is `844×390`.
- Layout bands are Compact `0–639` CSS px, Medium `640–1023` CSS px, Large `>=1024` CSS px. Height-sensitive rules are Foundation-owned; feature CSS must not invent global breakpoints.
- UI and DOM are never gameplay/application authority. Runtime/application state derives typed view state; views emit semantic intents.
- Generic `foundation`, `primitives`, `components`, and `patterns` must not import Terraform/Terrain/World/City Session feature contracts.
- Generic UI colors are semantic only; gameplay/domain colors use separate game-domain token namespaces and never substitute for generic selected/success/warning/error states.
- Exactly one production viewport pointer-listener authority remains: City Input.
- Active-tool pointer observation may happen before gesture reduction for preview/cancel; canonical tool commit remains a post-arbitration semantic tap or another explicitly defined semantic command.
- Camera drag/right-drag/wheel/multi-touch navigation must never commit Terraform.
- One primary gameplay tool is active at a time. Deactivation is distinct from disposal.
- New City preview must render the exact prepared Terrain later consumed by `createNewCity`; creation must not regenerate Terrain.
- Load City v1 preview stays lightweight; selecting/hovering a save must not restore a full live city.
- Terraform v1 semantics stay frozen: Raise/Lower/Flatten, 1×1/3×3/5×5, Fine 0.25m/Normal 1m/Strong 4m, first Flatten tap selects reference without mutation, same-session revision-safe Undo, Terrain snapshot persistence only.
- Game root must not document-scroll; localized sheets/panels own scrolling. Production screens must have no uncontrolled horizontal document overflow.
- Persistent edge surfaces must honor safe-area insets; full-screen shells use `100dvh`.
- Interactive owners clean up listeners/observers/timers/resources idempotently.
- UI Foundation must not introduce a permanent UI `requestAnimationFrame` loop.
- Every task must keep `pnpm architecture:check` at zero violations.

---

## Target File Structure

The implementation converges on this ownership map. Existing files may remain as compatibility adapters until the task that removes them.

```text
apps/game/src/
  application/
    navigation/
      create-city-navigation-coordinator.ts
      screen-controller.ts
      transition-guard.ts
    screens/
      create-home-screen-controller.ts
      create-load-city-screen-controller.ts
      create-new-city-screen-controller.ts

  composition/
    create-game.ts
    create-live-city-experience.ts
    game/
      create-game-interaction-router.ts
      create-game-tool-coordinator.ts
      create-game-tool-registry.ts
      create-game-ui-coordinator.ts
      create-terraform-game-tool.ts
    systems/
      prepared-terrain-handle.ts
      terrain-lifecycle-adapter.ts

  presentation/
    preview/
      create-new-city-terrain-preview.ts
      create-starting-region-preview-overlay.ts
    camera/
    input/
    interaction/

  ui/
    foundation/
      icon-names.ts
    primitives/
      types.ts
      badge.ts
      button.ts
      checkbox.ts
      divider.ts
      icon.ts
      icon-button.ts
      input.ts
      progress.ts
      radio.ts
      slider.ts
      spinner.ts
      switch.ts
      textarea.ts
    components/
      dialog.ts
      dropdown-menu.ts
      metric.ts
      popover.ts
      segmented-control.ts
      sheet.ts
      status-indicator.ts
      surface.ts
      tabs.ts
      toast.ts
      tool-button.ts
      tooltip.ts
    patterns/
      context-surface.ts
      dialog-host.ts
      game-hud.ts
      game-menu.ts
      inspector-surface.ts
      notification-host.ts
      tool-dock.ts
    screens/
      home/
        create-home-view.ts
        home-view-state.ts
      load-city/
        create-load-city-view.ts
        load-city-view-state.ts
      new-city/
        create-new-city-view.ts
        new-city-view-state.ts
      game/
        create-game-shell-view.ts
        game-shell-view-state.ts
    tools/
      game-tool-contract.ts
      terraform/
        create-terraform-tool-view.ts
        terraform-tool-view-state.ts
    styles/
      tokens.css
      reset.css
      foundation.css
      primitives.css
      components.css
      patterns.css
      screens.css
      responsive.css
      debug.css
    style.css

apps/game/tests/
  ui-foundation.test.ts
  ui-components-harness.ts
  game-tool-coordinator.test.ts
  game-interaction-router.test.ts
  screen-transition-guard.test.ts
  new-city-screen-controller.test.ts
  ui-foundation-architecture.test.ts

apps/game/
  ui-components-test.html

tests/browser/
  ui-components.spec.ts
  game-ui.spec.ts
  game-ui-responsive.spec.ts
  game-ui-lifecycle-soak.spec.ts
  new-city-preview.spec.ts
```

---

### Task 1: Establish Foundation Tokens, Handles, Icons, and CSS Ownership

**Files:**
- Create: `apps/game/src/ui/foundation/icon-names.ts`
- Modify: `apps/game/src/ui/primitives/types.ts`
- Create: `apps/game/src/ui/primitives/icon.ts`
- Create: `apps/game/src/ui/styles/tokens.css`
- Create: `apps/game/src/ui/styles/reset.css`
- Create: `apps/game/src/ui/styles/foundation.css`
- Modify: `apps/game/src/style.css`
- Create: `apps/game/tests/ui-foundation.test.ts`
- Modify: `apps/game/tests/ui-primitives-harness.ts`
- Modify: `tests/browser/ui-primitives.spec.ts`

**Interfaces:**
- Produces `UiHandle`, `StatefulUiHandle<TState>`, `UiIconName`, and `createIcon(name)` for every later UI task.
- Keeps `apps/game/src/style.css` as the stable stylesheet entry while delegating token/reset/foundation ownership to imported modules.

- [ ] **Step 1: Write failing handle/icon contract tests**

```ts
import { describe, expect, it } from "vitest";
import type { StatefulUiHandle, UiHandle } from "../src/ui/primitives/types";
import { UI_ICON_NAMES } from "../src/ui/foundation/icon-names";

const acceptsHandle = (_value: UiHandle): void => undefined;
const acceptsStateful = (_value: StatefulUiHandle<{ active: boolean }>): void => undefined;

describe("Game UI foundation contracts", () => {
  it("publishes stable icon names used by product surfaces", () => {
    expect(UI_ICON_NAMES).toEqual(
      expect.arrayContaining([
        "terrain",
        "roads",
        "zones",
        "buildings",
        "menu",
        "close",
        "undo",
        "save",
        "chevron-left",
      ]),
    );
  });

  it("keeps disposable/stateful handles structurally compatible", () => {
    acceptsHandle({ element: {} as HTMLElement, dispose() {} });
    acceptsStateful({
      element: {} as HTMLElement,
      render() {},
      dispose() {},
    });
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
. "$HOME/.nvm/nvm.sh" && nvm use 22.18.0 >/dev/null
pnpm --filter @web-three-city/app-game exec vitest run tests/ui-foundation.test.ts
```

Expected: FAIL because `UiHandle`, `StatefulUiHandle`, `UI_ICON_NAMES`, and `icon-names.ts` do not exist yet.

- [ ] **Step 3: Add the shared handle and icon-name contracts**

```ts
// apps/game/src/ui/primitives/types.ts
export interface UiHandle<T extends HTMLElement = HTMLElement> {
  readonly element: T;
  dispose(): void;
}

export interface StatefulUiHandle<TState, T extends HTMLElement = HTMLElement>
  extends UiHandle<T> {
  render(state: TState): void;
}

export type DisposableElement<T extends HTMLElement> = UiHandle<T>;
```

```ts
// apps/game/src/ui/foundation/icon-names.ts
export const UI_ICON_NAMES = [
  "terrain",
  "roads",
  "zones",
  "buildings",
  "menu",
  "close",
  "undo",
  "save",
  "chevron-left",
  "chevron-right",
  "refresh",
  "play",
  "pause",
  "warning",
  "info",
] as const;

export type UiIconName = (typeof UI_ICON_NAMES)[number];
```

Implement `createIcon(name)` as an app-owned SVG factory with one `switch`/path table internal to `icon.ts`; callers receive an `<svg aria-hidden="true">` and never import an icon package directly.

- [ ] **Step 4: Move global design authority into Foundation CSS modules**

`tokens.css` must define the existing dark palette plus semantic game UI tokens in one place:

```css
:root {
  color-scheme: dark;
  --ui-bg: hsl(222 24% 8%);
  --ui-fg: hsl(210 20% 96%);
  --ui-surface-glass: hsl(222 20% 10% / 0.78);
  --ui-surface-panel: hsl(222 20% 11% / 0.94);
  --ui-surface-raised: hsl(222 18% 14% / 0.98);
  --ui-border: hsl(216 14% 23%);
  --ui-border-strong: hsl(214 16% 38%);
  --ui-muted-fg: hsl(215 12% 65%);
  --ui-accent: hsl(216 18% 20%);
  --ui-accent-fg: hsl(210 18% 94%);
  --ui-positive: hsl(145 45% 42%);
  --ui-warning: hsl(40 72% 52%);
  --ui-danger: hsl(0 62% 48%);
  --ui-info: hsl(205 70% 58%);
  --ui-ring: hsl(210 18% 82%);

  --ui-space-1: 4px;
  --ui-space-2: 8px;
  --ui-space-3: 12px;
  --ui-space-4: 16px;
  --ui-space-5: 20px;
  --ui-space-6: 24px;
  --ui-space-8: 32px;

  --ui-control-min: 44px;
  --ui-icon-sm: 16px;
  --ui-icon-md: 20px;
  --ui-icon-lg: 24px;
  --ui-radius-sm: 7px;
  --ui-radius-md: 10px;
  --ui-radius-lg: 14px;

  --ui-layer-world: 0;
  --ui-layer-world-overlay: 10;
  --ui-layer-hud: 20;
  --ui-layer-tool: 30;
  --ui-layer-inspector: 40;
  --ui-layer-popover: 50;
  --ui-layer-dialog: 60;
  --ui-layer-toast: 70;
  --ui-layer-debug: 80;

  --ui-safe-top: env(safe-area-inset-top, 0px);
  --ui-safe-right: env(safe-area-inset-right, 0px);
  --ui-safe-bottom: env(safe-area-inset-bottom, 0px);
  --ui-safe-left: env(safe-area-inset-left, 0px);

  --ui-motion-fast: 120ms;
  --ui-motion-normal: 180ms;
  --ui-shadow-sm: 0 1px 2px hsl(222 40% 2% / 0.3);

  /* Transitional aliases keep the current UI rendering while callers migrate. */
  --background: var(--ui-bg);
  --foreground: var(--ui-fg);
  --card: var(--ui-surface-panel);
  --card-foreground: var(--ui-fg);
  --popover: var(--ui-surface-raised);
  --primary: var(--ui-fg);
  --primary-foreground: var(--ui-bg);
  --secondary: var(--ui-surface-raised);
  --secondary-foreground: var(--ui-fg);
  --muted: var(--ui-surface-raised);
  --muted-foreground: var(--ui-muted-fg);
  --accent: var(--ui-accent);
  --accent-foreground: var(--ui-accent-fg);
  --danger: var(--ui-danger);
  --danger-foreground: white;
  --success: var(--ui-positive);
  --warning: var(--ui-warning);
  --border: var(--ui-border);
  --input: var(--ui-border);
  --ring: var(--ui-ring);
  --radius: var(--ui-radius-md);
  --radius-sm: var(--ui-radius-sm);
  --control-height: var(--ui-control-min);
  --space-1: var(--ui-space-1);
  --space-2: var(--ui-space-2);
  --space-3: var(--ui-space-3);
  --space-4: var(--ui-space-4);
  --space-5: var(--ui-space-5);
  --space-6: var(--ui-space-6);
  --space-8: var(--ui-space-8);
  --shadow-sm: var(--ui-shadow-sm);
}
```

Remove the old token declarations from `apps/game/src/style.css`; the transitional aliases above keep its remaining legacy rules functional. `apps/game/src/style.css` becomes an import entry first, followed temporarily by legacy rules that later tasks remove:

```css
@import "./ui/styles/tokens.css";
@import "./ui/styles/reset.css";
@import "./ui/styles/foundation.css";
```

- [ ] **Step 5: Extend browser primitive assertions**

Update `ui-primitives-harness.ts` to render at least one `createIcon("terrain")`, then assert in `ui-primitives.spec.ts` that the icon exists, interactive targets remain `>=44px`, focus-visible still renders, and `--ui-layer-dialog` is defined.

- [ ] **Step 6: Run focused GREEN gates**

```bash
pnpm --filter @web-three-city/app-game test
pnpm exec playwright test tests/browser/ui-primitives.spec.ts
pnpm architecture:check
```

Expected: all PASS, architecture remains `0 violations`.

- [ ] **Step 8: Commit**

```bash
git add apps/game/src/ui apps/game/src/style.css apps/game/tests/ui-foundation.test.ts apps/game/tests/ui-primitives-harness.ts tests/browser/ui-primitives.spec.ts
git commit -m "feat(game-ui): establish foundation tokens and icons"
```

---

### Task 2: Build Reusable Controls and State-Oriented Components

**Files:**
- Modify: `apps/game/src/ui/primitives/button.ts`
- Create: `apps/game/src/ui/primitives/icon-button.ts`
- Create: `apps/game/src/ui/primitives/textarea.ts`
- Create: `apps/game/src/ui/primitives/checkbox.ts`
- Create: `apps/game/src/ui/primitives/radio.ts`
- Create: `apps/game/src/ui/primitives/slider.ts`
- Create: `apps/game/src/ui/primitives/divider.ts`
- Create: `apps/game/src/ui/primitives/progress.ts`
- Create: `apps/game/src/ui/primitives/spinner.ts`
- Create: `apps/game/src/ui/components/surface.ts`
- Create: `apps/game/src/ui/components/segmented-control.ts`
- Create: `apps/game/src/ui/components/metric.ts`
- Create: `apps/game/src/ui/components/status-indicator.ts`
- Create: `apps/game/src/ui/components/tool-button.ts`
- Create: `apps/game/src/ui/components/tooltip.ts`
- Create: `apps/game/src/ui/components/popover.ts`
- Create: `apps/game/src/ui/components/dropdown-menu.ts`
- Create: `apps/game/src/ui/components/tabs.ts`
- Create: `apps/game/src/ui/components/toast.ts`
- Create: `apps/game/src/ui/components/dialog.ts`
- Create: `apps/game/src/ui/components/sheet.ts`
- Create: `apps/game/src/ui/styles/primitives.css`
- Create: `apps/game/src/ui/styles/components.css`
- Modify: `apps/game/src/style.css`
- Create: `apps/game/tests/ui-components-harness.ts`
- Create: `apps/game/ui-components-test.html`
- Create: `tests/browser/ui-components.spec.ts`

**Interfaces:**
- Produces the complete v1 primitive set: Button, IconButton, Input, Textarea, Switch, Checkbox, Radio, Slider, Divider, Badge, Progress, Spinner, and Icon.
- Produces the complete v1 component set: Surface/Card, SegmentedControl, Tooltip, Popover, DropdownMenu, Tabs, Metric, StatusIndicator, ToolButton, Toast, Dialog, and Sheet.
- All stateful controls expose `render(state)`; feature code does not manipulate `aria-pressed`, selected classes, disabled styling, modal focus, or popover dismissal itself.

- [ ] **Step 1: Write the segmented-control browser harness and failing assertions**

Harness usage:

```ts
const operation = createSegmentedControl<"raise" | "lower" | "flatten">({
  ariaLabel: "Terrain operation",
  items: [
    { value: "raise", label: "Raise" },
    { value: "lower", label: "Lower" },
    { value: "flatten", label: "Flatten" },
  ],
  onChange: (value) => (mount.dataset.operation = value),
});
operation.render({ value: "raise", disabledValues: [] });
```

Browser expectations:

```ts
await expect(page.getByRole("button", { name: "Raise" })).toHaveAttribute(
  "aria-pressed",
  "true",
);
await page.getByRole("button", { name: "Lower" }).click();
await expect(page.locator("#ui-components-test")).toHaveAttribute(
  "data-operation",
  "lower",
);
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec playwright test tests/browser/ui-components.spec.ts
```

Expected: FAIL because the component harness/modules do not exist.

- [ ] **Step 3: Implement state-oriented component contracts**

Use this external shape:

```ts
export interface SegmentedControlState<T extends string | number> {
  readonly value: T;
  readonly disabledValues: readonly T[];
}

export interface SegmentedControlHandle<T extends string | number>
  extends StatefulUiHandle<SegmentedControlState<T>> {}
```

`createSegmentedControl` creates the group/buttons once; `render` updates `aria-pressed` and `disabled` only. `dispose` removes all click listeners idempotently.

`createIconButton` must require an accessible name:

```ts
createIconButton({
  icon: "menu",
  ariaLabel: "Open game menu",
  onPress,
});
```

- [ ] **Step 4: Implement the remaining frozen primitive/component set and browser semantics**

Use native semantic elements wherever possible: `textarea`, `input[type=checkbox]`, `input[type=radio]`, and `input[type=range]`. `Progress` uses `<progress>` when determinate and `Spinner` for indeterminate work. `ToolButton` composes `IconButton` with active/attention/shortcut presentation. `Popover` owns light-dismiss/focus return; `DropdownMenu` composes Popover + menu semantics; `Tabs` owns `tablist/tab/tabpanel`; `Dialog` owns modal semantics; `Sheet` owns non-modal or modal panel presentation based on its explicit mode; `Toast` is a reusable notification item consumed by `NotificationHost`.

Harness assertions must exercise at least one Checkbox, Radio group, Slider, Tabs instance, Popover open/close, and Dialog open/close so these contracts are not untested scaffolding.

- [ ] **Step 5: Convert Card semantics into `Surface` while retaining temporary compatibility**

`createSurface({ tone: "glass" | "panel" | "raised" })` owns generic visual surface structure. Keep `ui/primitives/card.ts` temporarily as a compatibility wrapper calling `createSurface({ tone: "panel" })`; Task 14 removes it after all consumers migrate.

- [ ] **Step 6: Add component CSS through shared tokens only**

No new component rule may use raw color literals or raw global z-index. Import modules from `style.css`:

```css
@import "./ui/styles/primitives.css";
@import "./ui/styles/components.css";
```

- [ ] **Step 7: Run GREEN**

```bash
pnpm --filter @web-three-city/app-game test
pnpm exec playwright test tests/browser/ui-primitives.spec.ts tests/browser/ui-components.spec.ts
pnpm architecture:check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/game/src/ui apps/game/src/style.css apps/game/tests/ui-components-harness.ts apps/game/ui-components-test.html tests/browser/ui-components.spec.ts
git commit -m "feat(game-ui): add reusable game ui components"
```

---

### Task 3: Add Generic Game UI Patterns and Presentation Hosts

**Files:**
- Create: `apps/game/src/ui/tools/game-tool-contract.ts`
- Create: `apps/game/src/ui/patterns/tool-dock.ts`
- Create: `apps/game/src/ui/patterns/context-surface.ts`
- Create: `apps/game/src/ui/patterns/inspector-surface.ts`
- Create: `apps/game/src/ui/patterns/dialog-host.ts`
- Create: `apps/game/src/ui/patterns/notification-host.ts`
- Create: `apps/game/src/ui/patterns/game-hud.ts`
- Create: `apps/game/src/ui/patterns/game-menu.ts`
- Create: `apps/game/src/ui/styles/patterns.css`
- Modify: `apps/game/src/style.css`
- Modify: `apps/game/tests/ui-components-harness.ts`
- Modify: `tests/browser/ui-components.spec.ts`

**Interfaces:**
- Produces generic surfaces only; these files must not import Terraform/Terrain/World.
- `GameToolDescriptor` is the only information Tool Dock needs about a gameplay tool.

- [ ] **Step 1: Write failing generic Tool Dock tests**

Define expected descriptor/state:

```ts
export type GameToolAvailability =
  | { readonly status: "available" }
  | { readonly status: "locked"; readonly reason: string }
  | { readonly status: "disabled"; readonly reason: string }
  | { readonly status: "hidden" };

export interface GameToolDescriptor {
  readonly id: string;
  readonly label: string;
  readonly icon: UiIconName;
  readonly shortcut?: string;
  readonly order: number;
}
```

Browser test creates Terrain/Roads descriptors, renders Terrain active, then verifies `aria-pressed=true`, a locked button is disabled with accessible reason, and hidden tools produce no button.

- [ ] **Step 2: Run RED**

```bash
pnpm exec playwright test tests/browser/ui-components.spec.ts
```

Expected: FAIL on missing pattern modules.

- [ ] **Step 3: Implement Tool Dock and Context Surface**

Tool Dock external API:

```ts
export interface ToolDockViewState {
  readonly tools: readonly {
    readonly descriptor: GameToolDescriptor;
    readonly availability: GameToolAvailability;
  }[];
  readonly activeToolId?: string;
}

export interface ToolDockHandle extends StatefulUiHandle<ToolDockViewState> {}
```

`ContextSurface` owns placement/surface chrome and mounts one tool-owned child element; it does not understand that child's state. Its state includes `mode: "compact" | "expanded" | "fullscreen"`; Foundation maps that semantic mode to desktop tray / compact sheet / fullscreen presentation without allowing feature-owned pixel positioning. It also owns the shared dismiss/back control and emits one `onDismiss` intent, so Terraform/Roads/Zones never create feature-specific Close semantics.

- [ ] **Step 4: Implement Inspector/Dialog/Notification/HUD hosts**

`DialogHost` provides modal focus ownership and `closeTop()`; `NotificationHost` renders transient status items without becoming gameplay authority; `InspectorSurface` owns the generic right-panel/sheet host; `GameHud` renders descriptors/controls, not gameplay values from DOM queries.

- [ ] **Step 5: Add pattern browser behavior tests**

Assert:

```text
Tool Dock active state is semantic and keyboard-focusable.
Context Surface can mount/unmount one child without recreating Tool Dock.
Dialog Host marks the world-underlay inert/pointer-blocked while modal.
Notification Host renders aria-live status without stealing focus.
All pattern controls remain >=44px.
```

- [ ] **Step 6: Run GREEN**

```bash
pnpm --filter @web-three-city/app-game test
pnpm exec playwright test tests/browser/ui-components.spec.ts
pnpm architecture:check
```

- [ ] **Step 7: Commit**

```bash
git add apps/game/src/ui apps/game/src/style.css apps/game/tests/ui-components-harness.ts tests/browser/ui-components.spec.ts
git commit -m "feat(game-ui): add game hud and surface patterns"
```

---

### Task 4: Implement Tool Registry and Deterministic Tool Coordinator

**Files:**
- Create: `apps/game/src/composition/game/create-game-tool-registry.ts`
- Create: `apps/game/src/composition/game/create-game-tool-coordinator.ts`
- Create: `apps/game/tests/game-tool-coordinator.test.ts`

**Interfaces:**
- Consumes `GameToolDescriptor` from Task 3.
- Produces one coordinator used by Game UI and the interaction router.

```ts
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
```

- [ ] **Step 1: Write RED lifecycle-order tests**

```ts
it("switches A to B by deactivating A before activating B", () => {
  const events: string[] = [];
  const a = fakeTool("a", events);
  const b = fakeTool("b", events);
  const coordinator = createGameToolCoordinator([a, b]);

  expect(coordinator.activate("a")).toBe(true);
  expect(coordinator.activate("b")).toBe(true);
  expect(events).toEqual(["a:activate", "a:deactivate", "b:activate"]);
});
```

Also test same-tool toggle, unavailable/hidden rejection, idempotent deactivate, active-tool disposal, and one-time tool disposal.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/app-game exec vitest run tests/game-tool-coordinator.test.ts
```

- [ ] **Step 3: Implement static app-owned registry and coordinator**

Registry sorts descriptors by `order`, rejects duplicate IDs during construction, and returns immutable lookup results. No runtime plugin discovery is introduced.

- [ ] **Step 4: Run GREEN and architecture**

```bash
pnpm --filter @web-three-city/app-game exec vitest run tests/game-tool-coordinator.test.ts
pnpm architecture:check
```

- [ ] **Step 5: Commit**

```bash
git add apps/game/src/composition/game apps/game/tests/game-tool-coordinator.test.ts
git commit -m "feat(game-ui): coordinate gameplay tool lifecycle"
```

---

### Task 5: Replace Feature-Specific Game Screen with a Generic Game Shell

**Files:**
- Create: `apps/game/src/ui/screens/game/game-shell-view-state.ts`
- Create: `apps/game/src/ui/screens/game/create-game-shell-view.ts`
- Create: `apps/game/src/ui/styles/screens.css`
- Modify: `apps/game/src/style.css`
- Modify: `apps/game/src/ui/screens/create-game-screen.ts` (temporary compatibility adapter)
- Modify: `apps/game/src/composition/create-live-city-experience.ts`
- Modify: `apps/game/tests/live-city-harness.ts`
- Modify: `tests/browser/live-city.spec.ts`

**Interfaces:**
- Produces generic hosts: `viewport`, `hudHost`, `toolDockHost`, `contextHost`, `inspectorHost`, `dialogHost`, `notificationHost`, `debugHost`.
- Does not expose `terraform` or Terraform callbacks.

```ts
export interface GameShellView {
  readonly element: HTMLElement;
  readonly viewport: HTMLElement;
  readonly hudHost: HTMLElement;
  readonly toolDockHost: HTMLElement;
  readonly contextHost: HTMLElement;
  readonly inspectorHost: HTMLElement;
  readonly dialogHost: HTMLElement;
  readonly notificationHost: HTMLElement;
  readonly debugHost: HTMLElement;
  render(state: GameShellViewState): void;
  dispose(): void;
}
```

- [ ] **Step 1: Write browser assertions for generic shell hosts**

Add to `live-city.spec.ts`:

```ts
await expect(page.getByTestId("game-hud-host")).toBeVisible();
await expect(page.getByTestId("game-tool-dock-host")).toBeVisible();
await expect(page.getByTestId("game-context-host")).toBeVisible();
await expect(page.getByTestId("game-dialog-host")).toBeAttached();
await expect(page.getByTestId("game-notification-host")).toBeAttached();
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec playwright test tests/browser/live-city.spec.ts
```

- [ ] **Step 3: Implement the generic shell**

The shell creates fixed layer hosts once. Empty hosts use `pointer-events:none`; interactive child surfaces enable `pointer-events:auto`. `z-index` comes only from Foundation layer tokens.

- [ ] **Step 4: Bridge existing live-city UI temporarily**

Refactor `create-game-screen.ts` into a compatibility adapter around `createGameShellView()`: return the generic shell hosts while temporarily constructing the existing Save/Exit/Debug/Terraform controls and mounting them into `hudHost`, `debugHost`, and `contextHost`. Keep its existing external callbacks so `create-live-city-experience.ts` requires only the shell-host integration change in this task. Do not change Terraform input/runtime semantics here.

- [ ] **Step 5: Run live-city/Terraform regression**

```bash
pnpm exec playwright test tests/browser/live-city.spec.ts tests/browser/terraform.spec.ts tests/browser/terraform-touch.spec.ts
pnpm architecture:check
```

Expected: existing Terraform behavior still PASS while shell host assertions are GREEN.

- [ ] **Step 6: Commit**

```bash
git add apps/game/src/ui/screens/game apps/game/src/ui/screens/create-game-screen.ts apps/game/src/ui/styles/screens.css apps/game/src/style.css apps/game/src/composition/create-live-city-experience.ts apps/game/tests/live-city-harness.ts tests/browser/live-city.spec.ts
git commit -m "refactor(game-ui): introduce generic live game shell"
```

---

### Task 6: Add Generic Game Interaction Router and Central Command/Dismiss Routing

**Files:**
- Create: `apps/game/src/composition/game/create-game-interaction-router.ts`
- Create: `apps/game/src/composition/game/create-game-command-router.ts`
- Create: `apps/game/tests/game-interaction-router.test.ts`
- Modify: `apps/game/src/composition/create-live-city-experience.ts`
- Modify: `apps/game/tests/city-tool-pointer-sink.test.ts`

**Interfaces:**
- Consumes `GameToolCoordinator` from Task 4.
- Produces a `CityToolPointerSink` and semantic-tap function without adding viewport listeners.

```ts
export interface GameInteractionRouter {
  readonly toolPointerSink: CityToolPointerSink;
  onSemanticTap(clientX: number, clientY: number): void;
  dispose(): void;
}
```

Central UI commands:

```ts
export type GameUiCommand =
  | { readonly type: "toggle-tool"; readonly toolId: string }
  | { readonly type: "dismiss-top-layer" }
  | { readonly type: "open-game-menu" }
  | { readonly type: "save-city" };
```

- [ ] **Step 1: Write RED routing tests**

Test that pointer events route to the currently active tool only, tool switch redirects the next event, and semantic tap routes to active tool while no-tool tap invokes selection fallback.

```ts
router.toolPointerSink.onPointerEvent(pointerMove);
router.onSemanticTap(100, 200);
expect(events).toEqual(["terrain:pointer:move", "terrain:tap:100,200"]);
```

Also preserve existing `city-tool-pointer-sink.test.ts` assertion that pointer sink observation occurs before gesture reducer intents are emitted.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/app-game exec vitest run tests/game-interaction-router.test.ts tests/city-tool-pointer-sink.test.ts
```

- [ ] **Step 3: Implement the interaction router without listeners**

`toolPointerSink.onPointerEvent` asks `toolCoordinator.activeTool()` at event time and forwards to `pointerSink`; `onSemanticTap` does the same for `onSemanticTap`. When no tool is active it calls injected `onSelectionTap`.

- [ ] **Step 4: Implement centralized keyboard command routing**

`createGameCommandRouter` owns one keyboard listener at the game-UI layer, ignores `input`, `textarea`, `select`, and `contenteditable`, maps `Escape` to `dismiss-top-layer`, and maps registered tool shortcuts only when the focused target is not editable. Do not intercept camera WASD/Q/E keys already owned by City Input.

- [ ] **Step 5: Wire the router into City Input**

Use:

```ts
createCityInputController({
  viewport: shell.viewport,
  camera,
  requestRender,
  toolPointerSink: interactionRouter.toolPointerSink,
  onTap: (x, y) => interactionRouter.onSemanticTap(x, y),
});
```

No second pointer listener is added.

- [ ] **Step 6: Run GREEN**

```bash
pnpm --filter @web-three-city/app-game exec vitest run tests/game-interaction-router.test.ts tests/city-tool-pointer-sink.test.ts tests/gesture-recognizer.test.ts
pnpm exec playwright test tests/browser/live-city.spec.ts tests/browser/terraform.spec.ts tests/browser/terraform-touch.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/game/src/composition/game apps/game/src/composition/create-live-city-experience.ts apps/game/tests/game-interaction-router.test.ts apps/game/tests/city-tool-pointer-sink.test.ts
git commit -m "refactor(game-ui): centralize tool interaction routing"
```

---

### Task 7: Migrate Terraform v1 onto Tool Dock and Context Surface

**Files:**
- Create: `apps/game/src/ui/tools/terraform/terraform-tool-view-state.ts`
- Create: `apps/game/src/ui/tools/terraform/create-terraform-tool-view.ts`
- Create: `apps/game/src/composition/game/create-terraform-game-tool.ts`
- Modify: `apps/game/src/composition/create-live-city-experience.ts`
- Modify: `apps/game/tests/terraform-toolbar.test.ts` (rename content to view-state tests; file may remain until Task 14 cleanup)
- Modify: `tests/browser/terraform.spec.ts`
- Modify: `tests/browser/terraform-touch.spec.ts`
- Modify: `tests/browser/terraform-persistence.spec.ts`
- Modify: `tests/browser/terraform-disposal.spec.ts`

**Interfaces:**
- Terraform is the reference `GameToolRuntime`.
- Its view consumes typed state; Foundation owns active-tool state, so `TerraformToolViewState` does not duplicate `active`.

```ts
export interface TerraformToolViewState {
  readonly operation: TerraformOperation;
  readonly brushSize: TerraformBrushSize;
  readonly strength: TerraformStrength;
  readonly flattenTargetMeters?: number;
  readonly undoDepth: number;
  readonly validity: "idle" | "valid" | "invalid";
  readonly message?: string;
}
```

- [ ] **Step 1: Rewrite browser expectation to the new product interaction and verify RED**

Replace opening `Terraform` with the Tool Dock category `Terrain`:

```ts
await page.getByRole("button", { name: "Terrain", exact: true }).click();
await expect(page.getByTestId("game-context-surface")).toBeVisible();
await expect(page.getByRole("button", { name: "Raise" })).toHaveAttribute(
  "aria-pressed",
  "true",
);
```

Add same-tool toggle and Escape expectations:

```ts
await page.getByRole("button", { name: "Terrain", exact: true }).click();
await expect(game).toHaveAttribute("data-active-tool", "");
```

- [ ] **Step 2: Run Terraform browser test and confirm RED on old UI**

```bash
pnpm exec playwright test tests/browser/terraform.spec.ts
```

- [ ] **Step 3: Implement Terraform tool view with shared components**

Use three segmented controls:

```ts
const operation = createSegmentedControl<TerraformOperation>({
  ariaLabel: "Terrain operation",
  items: [
    { value: "raise", label: "Raise" },
    { value: "lower", label: "Lower" },
    { value: "flatten", label: "Flatten" },
  ],
  onChange: input.onOperation,
});
const brush = createSegmentedControl<TerraformBrushSize>({
  ariaLabel: "Terrain brush size",
  items: [
    { value: 1, label: "1×1" },
    { value: 3, label: "3×3" },
    { value: 5, label: "5×5" },
  ],
  onChange: input.onBrushSize,
});
const strength = createSegmentedControl<TerraformStrength>({
  ariaLabel: "Terrain strength",
  items: [
    { value: "fine", label: "Fine 0.25m" },
    { value: "normal", label: "Normal 1m" },
    { value: "strong", label: "Strong 4m" },
  ],
  onChange: input.onStrength,
});
```

`render(state)` disables all strength values during Flatten, renders Flatten target/Repick only for Flatten, and renders Undo disabled when `undoDepth===0`. There is no feature-owned absolute positioning and no feature-owned Close button.

- [ ] **Step 4: Extract current Terraform runtime state into `createTerraformGameTool`**

Move Terraform active/deactive/view integration out of `create-live-city-experience.ts` while preserving existing `createTerraformRuntime`, `createTerraformPointerSession`, overlay, preview, Flatten, commit, Undo, and disposal logic.

Required lifecycle:

```text
activate   -> overlay active; view receives current state
 deactivate -> clear preview + flatten target; overlay inactive; Undo retained
 dispose    -> pointer session/runtime/overlay/view disposed; Undo released
```

- [ ] **Step 5: Register Terrain in Tool Registry and mount active view in Context Surface**

Descriptor:

```ts
{
  id: "terrain",
  label: "Terrain",
  icon: "terrain",
  shortcut: "T",
  order: 10,
}
```

Tool Dock click calls coordinator `toggle("terrain")`; coordinator state drives `data-active-tool` and Context Surface mounting.

- [ ] **Step 6: Preserve Terraform diagnostics used by regression tests**

Keep current diagnostics during migration:

```text
data-terraform-operation
data-terraform-brush
data-terraform-strength
data-terraform-preview
data-terraform-undo-depth
data-terrain-revision
data-terraform-overlay-roots
```

`data-terraform-active` may remain as a derived compatibility diagnostic; `data-active-tool` becomes the generic UI diagnostic.

- [ ] **Step 7: Run Terraform unit/browser regression**

```bash
pnpm --filter @web-three-city/app-game test
pnpm exec playwright test tests/browser/terraform.spec.ts tests/browser/terraform-touch.spec.ts tests/browser/terraform-persistence.spec.ts tests/browser/terraform-disposal.spec.ts
pnpm terraform:performance:baseline
```

Expected: all frozen Terraform semantics remain PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/game/src/ui/tools apps/game/src/composition/game apps/game/src/composition/create-live-city-experience.ts apps/game/tests/terraform-toolbar.test.ts tests/browser/terraform*.spec.ts
git commit -m "feat(game-ui): migrate terraform to shared tool surfaces"
```

---

### Task 8: Finish Production Game HUD, Game Menu, Notifications, Inspector Host, and Debug Separation

**Files:**
- Create: `apps/game/src/composition/game/create-game-ui-coordinator.ts`
- Modify: `apps/game/src/ui/patterns/game-hud.ts`
- Modify: `apps/game/src/ui/patterns/game-menu.ts`
- Modify: `apps/game/src/ui/patterns/notification-host.ts`
- Modify: `apps/game/src/ui/patterns/inspector-surface.ts`
- Create: `apps/game/src/ui/styles/debug.css`
- Modify: `apps/game/src/style.css`
- Modify: `apps/game/src/composition/create-live-city-experience.ts`
- Modify: `tests/browser/live-city.spec.ts`
- Create: `tests/browser/game-ui.spec.ts`

**Interfaces:**
- `GameUiCoordinator` owns UI-only presentation state: active tool projection, game-menu visibility, inspector foregrounding, notifications, and dismissal priority.
- Save/Exit remain semantic application callbacks; UI does not persist directly.

- [ ] **Step 1: Write RED Game HUD/Menu tests**

Browser expectations:

```ts
await expect(page.getByRole("button", { name: "Open game menu" })).toBeVisible();
await expect(page.getByText("Terrain Debug · 0 active")).toHaveCount(0);
await page.getByRole("button", { name: "Open game menu" }).click();
await expect(page.getByRole("dialog", { name: "Game menu" })).toBeVisible();
await expect(page.getByRole("button", { name: "Save City" })).toBeVisible();
await expect(page.getByRole("button", { name: "Exit City" })).toBeVisible();
```

- [ ] **Step 2: Run RED**

```bash
pnpm exec playwright test tests/browser/game-ui.spec.ts
```

- [ ] **Step 3: Implement compact production HUD**

Show current city identity and only real currently available global state. Do not invent economy/population/simulation metrics before their systems exist. Move Seed64/Terrain revision out of persistent HUD and retain them only in diagnostics/debug data.

- [ ] **Step 4: Move Save/Exit/Debug behind Game Menu/global surfaces**

Save success creates a short status notification; save failure creates an error notification and leaves the live session intact. Game Menu contains `Resume`, `Save City`, `Debug`, and `Exit City`. Debug controls render inside Debug Surface only when requested. Move all debug-only styles into `ui/styles/debug.css` and import that module from the stable `style.css` entry.

- [ ] **Step 5: Implement dismissal priority**

`dismiss-top-layer` follows:

```text
open modal/Game Menu
-> popover/menu
-> foreground inspector/sheet
-> active primary tool
-> open Game Menu when none of the above is open
```

The next dismiss while Game Menu is topmost closes it.

- [ ] **Step 6: Run GREEN with save/exit regression**

```bash
pnpm exec playwright test tests/browser/game-ui.spec.ts tests/browser/live-city.spec.ts tests/browser/city-lifecycle.spec.ts
pnpm architecture:check
```

- [ ] **Step 7: Commit**

```bash
git add apps/game/src/composition/game apps/game/src/ui/patterns apps/game/src/composition/create-live-city-experience.ts tests/browser/game-ui.spec.ts tests/browser/live-city.spec.ts
git commit -m "feat(game-ui): ship production hud and overlay semantics"
```

---

### Task 9: Introduce Typed Screen Controllers, Single-Flight Navigation, and Redesign Home

**Files:**
- Create: `apps/game/src/application/navigation/screen-controller.ts`
- Create: `apps/game/src/application/navigation/transition-guard.ts`
- Create: `apps/game/src/application/navigation/create-city-navigation-coordinator.ts`
- Create: `apps/game/src/application/screens/create-home-screen-controller.ts`
- Create: `apps/game/src/ui/screens/home/home-view-state.ts`
- Create: `apps/game/src/ui/screens/home/create-home-view.ts`
- Create: `apps/game/tests/screen-transition-guard.test.ts`
- Modify: `apps/game/src/composition/create-game.ts`
- Modify: `apps/game/src/composition/create-city-lifecycle-coordinator.ts` (temporary compatibility delegation; removed Task 14)
- Modify: `apps/game/tests/city-screens-harness.ts`
- Modify: `tests/browser/city-screens.spec.ts`
- Modify: `tests/browser/bootstrap.spec.ts`

**Interfaces:**

```ts
export interface ScreenController {
  readonly element: HTMLElement;
  dispose(): void;
}

export interface HomeViewState {
  readonly latest?: CitySaveSummary;
  readonly cityCount: number;
  readonly phase: "idle" | "resuming";
  readonly error?: string;
}

export type HomeIntent =
  | { readonly type: "new-city" }
  | { readonly type: "load-city" }
  | { readonly type: "resume" };
```

- [ ] **Step 1: Write RED transition-guard tests**

```ts
it("rejects duplicate transitions until the active transition finishes", () => {
  const guard = createTransitionGuard();
  const first = guard.begin();
  expect(first).not.toBeUndefined();
  expect(guard.begin()).toBeUndefined();
  guard.finish(first!);
  const second = guard.begin();
  expect(second).not.toBeUndefined();
  expect(guard.isCurrent(second!)).toBe(true);
});
```

Also assert `cancel()` invalidates the current token and clears the pending state, and `dispose()` permanently rejects future `begin()` calls. Intentional navigation away from an in-flight screen calls `cancel()`; repeated activation of the same pending navigation is ignored.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/app-game exec vitest run tests/screen-transition-guard.test.ts
```

- [ ] **Step 3: Implement transition guard and semantic Home View/Controller**

`TransitionGuard.begin()` returns a token only when no transition is pending; `finish(token)` clears the matching pending transition; `cancel()` invalidates the token and clears pending; `dispose()` invalidates and permanently closes the guard. View creates DOM once and exposes `render(HomeViewState)`. Controller handles service `resumeCity()` and emits navigation intents to the navigation coordinator; busy/error state is typed, not inferred from disabled DOM.

- [ ] **Step 4: Add game-first lightweight Home backdrop**

Use CSS-only/DOM ambient presentation in v1: full-viewport background layers, low-cost gradients/noise shapes, no production Three.js World/Terrain runtime and no permanent RAF.

- [ ] **Step 5: Migrate bootstrap to new navigation coordinator**

`createGame` still builds repository/service/environment adapters, then gives initial summaries to `createCityNavigationCoordinator`. Preserve startup-error behavior and repository disposal.

- [ ] **Step 6: Run Home/bootstrap GREEN**

```bash
pnpm --filter @web-three-city/app-game test
pnpm exec playwright test tests/browser/bootstrap.spec.ts tests/browser/city-screens.spec.ts tests/browser/city-lifecycle.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/game/src/application apps/game/src/ui/screens/home apps/game/src/composition/create-game.ts apps/game/src/composition/create-city-lifecycle-coordinator.ts apps/game/tests tests/browser/bootstrap.spec.ts tests/browser/city-screens.spec.ts
git commit -m "refactor(game-ui): add typed navigation and home controller"
```

---

### Task 10: Redesign Load City as Typed Save Browser + Lightweight Detail Preview

**Files:**
- Create: `apps/game/src/application/screens/create-load-city-screen-controller.ts`
- Create: `apps/game/src/ui/screens/load-city/load-city-view-state.ts`
- Create: `apps/game/src/ui/screens/load-city/create-load-city-view.ts`
- Modify: `apps/game/src/application/navigation/create-city-navigation-coordinator.ts`
- Modify: `apps/game/tests/city-screens-harness.ts`
- Modify: `tests/browser/city-screens.spec.ts`
- Modify: `tests/browser/city-lifecycle.spec.ts`

**Interfaces:**

```ts
export interface LoadCityViewState {
  readonly cities: readonly CitySaveSummary[];
  readonly selectedCityId?: CityId;
  readonly phase: "idle" | "loading";
  readonly loadingCityId?: CityId;
  readonly error?: string;
}

export type LoadCityIntent =
  | { readonly type: "back" }
  | { readonly type: "select"; readonly cityId: CityId }
  | { readonly type: "load"; readonly cityId: CityId };
```

- [ ] **Step 1: Rewrite harness/browser test for select-then-load semantics and verify RED**

Large/medium test selects `Metro Beta`, verifies detail pane metadata, then clicks one `Load City` action. Compact test selects a save and verifies the details surface is foregrounded without horizontal overflow.

- [ ] **Step 2: Run RED**

```bash
pnpm exec playwright test tests/browser/city-screens.spec.ts
```

- [ ] **Step 3: Implement typed Load controller/view**

Controller lists saves once per entry, retains selection in typed state, and calls `service.loadCity(selectedCityId)` only on explicit load intent. Selection/hover never restores the city.

- [ ] **Step 4: Keep failure local and transition only after successful restore**

On load rejection, render `error` and remain Load City. On success, navigation coordinator replaces the screen with the live Game runtime.

- [ ] **Step 5: Run GREEN**

```bash
pnpm exec playwright test tests/browser/city-screens.spec.ts tests/browser/city-lifecycle.spec.ts
pnpm architecture:check
```

- [ ] **Step 6: Commit**

```bash
git add apps/game/src/application apps/game/src/ui/screens/load-city apps/game/tests/city-screens-harness.ts tests/browser/city-screens.spec.ts tests/browser/city-lifecycle.spec.ts
git commit -m "feat(game-ui): redesign load city save browser"
```

---

### Task 11: Build New City Typed State and Exact Prepared-Terrain Preview Composition

**Files:**
- Create: `apps/game/src/composition/systems/prepared-terrain-handle.ts`
- Modify: `apps/game/src/composition/systems/terrain-lifecycle-adapter.ts`
- Create: `apps/game/src/presentation/preview/create-new-city-terrain-preview.ts`
- Create: `apps/game/src/presentation/preview/create-starting-region-preview-overlay.ts`
- Create: `apps/game/src/ui/screens/new-city/new-city-view-state.ts`
- Create: `apps/game/src/ui/screens/new-city/create-new-city-view.ts`
- Create: `apps/game/src/application/screens/create-new-city-screen-controller.ts`
- Create: `apps/game/tests/new-city-screen-controller.test.ts`
- Modify: `apps/game/src/application/navigation/create-city-navigation-coordinator.ts`
- Modify: `apps/game/tests/city-screens-harness.ts`
- Create: `tests/browser/new-city-preview.spec.ts`
- Modify: `tests/browser/city-screens.spec.ts`

**Interfaces:**

```ts
export type NewCityPhase =
  | "configuring"
  | "generating"
  | "preview-ready"
  | "creating";

export interface NewCityViewState {
  readonly name: string;
  readonly seed64: string;
  readonly phase: NewCityPhase;
  readonly preview?: NewCityPreview;
  readonly previewFresh: boolean;
  readonly selectedRegionId?: RegionId;
  readonly error?: string;
}
```

Preview presentation boundary:

```ts
export interface NewCityTerrainPreviewHandle {
  readonly element: HTMLElement;
  setSelectedRegion(regionId: RegionId | undefined): void;
  resize(): void;
  dispose(): void;
}

export interface NewCityTerrainPreviewFactory {
  create(input: {
    readonly mount: HTMLElement;
    readonly preview: NewCityPreview;
    readonly onSelectRegion: (regionId: RegionId) => void;
  }): NewCityTerrainPreviewHandle;
}
```

- [ ] **Step 1: Write RED controller tests for preview freshness and exact object reuse**

Use a fake `CitySessionService` whose `prepareNewCity()` returns one frozen `preview` object and whose `createNewCity(input)` records `input.preview`.

```ts
expect(createInput.preview).toBe(preparedPreview);
```

Also assert changing seed after generation sets `previewFresh=false` and blocks create until generation succeeds again.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @web-three-city/app-game exec vitest run tests/new-city-screen-controller.test.ts
```

- [ ] **Step 3: Extract app-internal prepared Terrain handle reader**

Move the current private token/opaque validation from `terrain-lifecycle-adapter.ts` into `prepared-terrain-handle.ts` and expose it only to app composition/presentation modules:

```ts
export interface PreparedTerrainPresentationSource {
  readonly prepared: PreparedProductionTerrain;
  readonly mapDefinition: MapDefinitionRead;
}

export function readPreparedTerrainPresentationSource(
  handle: PreparedTerrainHandle,
): PreparedTerrainPresentationSource | undefined;
```

UI files never read `handle.opaque` directly.

- [ ] **Step 4: Implement preview runtime from the exact prepared field**

`create-new-city-terrain-preview.ts`:

1. reads `preview.preparedTerrain` through `readPreparedTerrainPresentationSource`;
2. creates a temporary TerrainSystem with:

```ts
createTerrainSystem({
  world: preview.preparedWorld.spatial,
  mapDefinitionId: source.mapDefinition.mapDefinitionId,
  generationProfileId: source.mapDefinition.terrainGenerationProfileId,
  generationProfileVersion:
    source.mapDefinition.terrainGenerationProfileVersion,
  selectedSeed64: source.prepared.selectedSeed64,
  fingerprint: source.prepared.fingerprint,
  source: source.prepared.field,
});
```
3. creates `TerrainThreeProjection` from that temporary TerrainSystem read surface;
4. creates a preview Scene/Camera/Lighting using existing camera/scene capabilities;
5. creates the starting-region overlay;
6. renders on initialization, camera/input changes, selected-region changes, and resize only; it does not create a permanent UI/presentation RAF loop;
7. disposes projection/overlay/lighting/scene/temporary presentation resources idempotently.

It must not persist, create CityId, start Terraform, or mutate prepared Terrain.

- [ ] **Step 5: Implement starting-region overlay and semantic DOM mirror**

Use `preparedWorld.mapDefinition.startingCandidates` anchors for eligible region markers. Three.js ray-hit on a marker emits `onSelectRegion(regionId)`; the DOM region controls in `create-new-city-view.ts` emit the same intent. Both render from `selectedRegionId`.

- [ ] **Step 6: Implement New City Controller/View phase machine**

Generate path:

```text
configuring -> generating -> preview-ready
```

Creation path:

```text
preview-ready -> creating -> Game
```

Rejected generation returns to `configuring`; rejected creation returns to `preview-ready`; neither destroys the screen.

- [ ] **Step 7: Add real-browser preview lifecycle test**

`new-city-preview.spec.ts` performs:

```text
New City
-> Generate seed A
-> assert one preview canvas
-> Randomize/change seed
-> Generate seed B
-> assert still one preview canvas
-> select eligible region
-> Back
-> assert preview canvas/runtime removed
```

Expose test diagnostics such as `data-preview-runtime="ready|disposed"` and `data-preview-canvas-count` from the harness/controller, never as authority.

- [ ] **Step 8: Run GREEN**

```bash
pnpm --filter @web-three-city/app-game test
pnpm exec playwright test tests/browser/new-city-preview.spec.ts tests/browser/city-screens.spec.ts tests/browser/city-lifecycle.spec.ts
pnpm architecture:check
```

- [ ] **Step 9: Commit**

```bash
git add apps/game/src/composition/systems apps/game/src/presentation/preview apps/game/src/ui/screens/new-city apps/game/src/application/screens apps/game/src/application/navigation apps/game/tests/new-city-screen-controller.test.ts apps/game/tests/city-screens-harness.ts tests/browser/new-city-preview.spec.ts tests/browser/city-screens.spec.ts
git commit -m "feat(game-ui): add live new city terrain preview"
```

---

### Task 12: Apply Full Game-First Home/New/Load/Game Visual System and Responsive Contracts

**Files:**
- Create: `apps/game/src/ui/styles/responsive.css`
- Modify: `apps/game/src/ui/styles/tokens.css`
- Modify: `apps/game/src/ui/styles/foundation.css`
- Modify: `apps/game/src/ui/styles/patterns.css`
- Modify: `apps/game/src/ui/styles/screens.css`
- Modify: `apps/game/src/style.css`
- Create: `tests/browser/game-ui-responsive.spec.ts`
- Modify: `tests/browser/city-screens.spec.ts`
- Modify: `tests/browser/game-ui.spec.ts`
- Modify: `tests/browser/terraform-touch.spec.ts`

**Interfaces:**
- No feature-specific breakpoint APIs. CSS/Foundation owns Compact/Medium/Large and short-height rules.
- Semantic surfaces remain the same objects; presentation transforms panel/tray/sheet via CSS/state projection.

- [ ] **Step 1: Write responsive profile tests and verify current RED**

Define helper:

```ts
const PROFILES = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "small-desktop", width: 1024, height: 768 },
  { name: "mobile-portrait", width: 390, height: 844 },
  { name: "mobile-landscape", width: 844, height: 390 },
  { name: "minimum", width: 320, height: 568 },
] as const;
```

For Home/New/Load/Game idle/Game+Terrain assert:

```ts
expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
```

For Game assert document root does not scroll vertically and Tool Dock/Context Surface bounding boxes stay inside viewport/safe-area bounds.

- [ ] **Step 2: Run RED**

```bash
pnpm exec playwright test tests/browser/game-ui-responsive.spec.ts
```

- [ ] **Step 3: Implement Foundation-owned responsive CSS**

Use only these global bands:

```css
@media (max-width: 639px) { /* Compact */ }
@media (min-width: 640px) and (max-width: 1023px) { /* Medium */ }
@media (min-width: 1024px) { /* Large */ }
@media (max-height: 599px) { /* short viewport adaptation */ }
```

Large/Medium: Tool Dock centered bottom, Context Surface above it, Inspector right panel. Compact: Tool Dock fixed equal slots, Context Surface/Inspector become bottom surfaces, and exactly one primary bottom surface is foregrounded at a time.

- [ ] **Step 4: Implement lifecycle-screen responsive transformations**

Home remains full-viewport menu over lightweight backdrop. New City uses side configuration + preview on Large/Medium and live-preview background + bottom configuration surface on Compact. Load uses list+detail on Large/Medium and list-to-detail on Compact.

- [ ] **Step 5: Handle safe area, `100dvh`, and soft-keyboard constraints**

All edge surfaces consume `--ui-safe-*`; full screen roots use `height/min-height:100dvh`; localized sheet bodies scroll internally. Do not add `user-scalable=no` or UA detection.

- [ ] **Step 6: Run responsive/touch GREEN**

```bash
pnpm exec playwright test tests/browser/game-ui-responsive.spec.ts tests/browser/city-screens.spec.ts tests/browser/game-ui.spec.ts tests/browser/terraform-touch.spec.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/game/src/ui/styles apps/game/src/style.css tests/browser/game-ui-responsive.spec.ts tests/browser/city-screens.spec.ts tests/browser/game-ui.spec.ts tests/browser/terraform-touch.spec.ts
git commit -m "feat(game-ui): apply responsive game-first presentation"
```

---

### Task 13: Enforce Accessibility, Focus, Reduced Motion, and UI Architecture Boundaries

**Files:**
- Create: `apps/game/tests/ui-foundation-architecture.test.ts`
- Modify: `apps/game/tests/ui-components-harness.ts`
- Modify: `tests/browser/ui-components.spec.ts`
- Modify: `tests/browser/game-ui.spec.ts`
- Modify: `tests/browser/game-ui-responsive.spec.ts`
- Modify: `apps/game/src/ui/patterns/dialog-host.ts`
- Modify: `apps/game/src/composition/game/create-game-command-router.ts`

**Interfaces:**
- Enforces the frozen Foundation invariants mechanically where practical.

- [ ] **Step 1: Write RED architecture scans**

Vitest scans `apps/game/src/ui/foundation`, `primitives`, `components`, and `patterns` and fails on imports matching:

```ts
/@web-three-city\/(terraform|terrain|world|orchestration-city-session)/
```

It also scans feature CSS/source for raw `z-index:\s*\d+` outside `tokens.css` and scans `ui/tools/*` for duplicated generic `.ui-button` definitions.

- [ ] **Step 2: Run RED and remove violations surfaced by migration leftovers**

```bash
pnpm --filter @web-three-city/app-game exec vitest run tests/ui-foundation-architecture.test.ts
```

Expected: FAIL until remaining legacy violations are migrated/removed.

- [ ] **Step 3: Finish focus/dismiss accessibility contracts**

Dialog Host traps focus only while modal, restores focus to trigger on close, gives icon-only controls `aria-label`, and does not use color as the only selected/error indicator. Game Command Router ignores editable targets and routes Escape centrally.

- [ ] **Step 4: Add reduced-motion and keyboard browser assertions**

Use Playwright `page.emulateMedia({ reducedMotion: "reduce" })`, activate/deactivate Terrain, open/close Game Menu, and verify controls remain immediate/usable. Tab through Tool Dock and assert `focus-visible` outline width is not `0px`.

- [ ] **Step 5: Run GREEN**

```bash
pnpm --filter @web-three-city/app-game test
pnpm exec playwright test tests/browser/ui-components.spec.ts tests/browser/game-ui.spec.ts tests/browser/game-ui-responsive.spec.ts
pnpm architecture:check
```

- [ ] **Step 6: Commit**

```bash
git add apps/game/tests/ui-foundation-architecture.test.ts apps/game/src/ui apps/game/src/composition/game tests/browser/ui-components.spec.ts tests/browser/game-ui.spec.ts tests/browser/game-ui-responsive.spec.ts
git commit -m "test(game-ui): enforce accessibility and ui boundaries"
```

---

### Task 14: Remove Legacy UI Paths and Complete Lifecycle Hardening

**Files:**
- Delete after all imports are gone: `apps/game/src/ui/create-terraform-toolbar.ts`
- Delete after all imports are gone: `apps/game/src/ui/screens/create-home-screen.ts`
- Delete after all imports are gone: `apps/game/src/ui/screens/create-load-city-screen.ts`
- Delete after all imports are gone: `apps/game/src/ui/screens/create-new-city-screen.ts`
- Delete after generic shell cutover: `apps/game/src/ui/screens/create-game-screen.ts`
- Delete after Surface migration: `apps/game/src/ui/primitives/card.ts`
- Delete after navigation cutover: `apps/game/src/composition/create-city-lifecycle-coordinator.ts`
- Modify: `apps/game/src/style.css` to imports only
- Modify: `apps/game/tests/city-screens-harness.ts`
- Modify: `apps/game/tests/terraform-toolbar.test.ts` (rename to `terraform-tool-view.test.ts` if not already renamed)
- Create: `tests/browser/game-ui-lifecycle-soak.spec.ts`
- Modify: `package.json`
- Create: `.github/workflows/game-ui-hardening.yml`
- Modify: `docs/apps/game/README.md`
- Modify: `docs/apps/game/specs/CITY-UI-AND-PERSISTENCE-ADAPTER-DESIGN.md`

**Interfaces:**
- Finalizes one production UI path only; no legacy duplicate screen/tool styling or callback-heavy screen factories remain.

- [ ] **Step 1: Prove legacy paths are unused before deleting them**

Run:

```bash
rg -n 'create-terraform-toolbar|create-home-screen|create-load-city-screen|create-new-city-screen|create-game-screen|ui/primitives/card|create-city-lifecycle-coordinator' apps/game/src apps/game/tests tests/browser
```

Expected: only the legacy files themselves or explicit migration-test references remain. Migrate any remaining real consumer before deletion.

- [ ] **Step 2: Delete legacy files and collapse `style.css` to module imports**

Final entry:

```css
@import "./ui/styles/tokens.css";
@import "./ui/styles/reset.css";
@import "./ui/styles/foundation.css";
@import "./ui/styles/primitives.css";
@import "./ui/styles/components.css";
@import "./ui/styles/patterns.css";
@import "./ui/styles/screens.css";
@import "./ui/styles/responsive.css";
@import "./ui/styles/debug.css";
```

- [ ] **Step 3: Write opt-in 20-cycle UI lifecycle soak**

`game-ui-lifecycle-soak.spec.ts` is guarded by `GAME_UI_LIFECYCLE_SOAK=1` and repeats:

```text
Home -> New City -> Generate -> Back
Home -> Load -> Back
Home -> Resume/Load -> Game
Terrain activate -> edit -> deactivate
Game Menu open/close
Exit -> Home
```

Twenty cycles assert no accumulating `canvas.app-canvas`, preview canvases, Tool Dock roots, Context Surface roots, dialogs, duplicate viewport listeners (through existing diagnostics), or active UI RAF owners.

- [ ] **Step 4: Add hardening scripts**

Root `package.json`:

```json
{
  "scripts": {
    "game-ui:lifecycle:soak": "GAME_UI_LIFECYCLE_SOAK=1 playwright test tests/browser/game-ui-lifecycle-soak.spec.ts --workers=1"
  }
}
```

- [ ] **Step 5: Add `Game UI Hardening` workflow**

Follow repository workflow conventions: Node 22.18.0, pnpm 10.15.1, exact checked-out HEAD, install Chromium, run `pnpm verify`, run `pnpm game-ui:lifecycle:soak`, assert clean worktree, upload Playwright artifacts on failure. Do not add Sonar as a gate.

- [ ] **Step 6: Update app documentation**

`docs/apps/game/README.md` and the frozen adapter design must state the new UI ownership hierarchy, generic Game Shell/Tool Coordinator, live New City preview, responsive bands, and that Terraform is the first reference tool. Preserve City Session/IndexedDB authority rules.

- [ ] **Step 7: Run focused lifecycle soak**

```bash
pnpm game-ui:lifecycle:soak
```

Expected: `1 passed` after all 20 internal cycles.

- [ ] **Step 8: Commit final migration/hardening**

```bash
git add -A
git commit -m "feat(game-ui): complete foundation v1 migration"
```

- [ ] **Step 9: Run complete post-commit local release gate with official runtime**

```bash
. "$HOME/.nvm/nvm.sh" && nvm use 22.18.0 >/dev/null
node -v
pnpm verify
pnpm terraform:performance:baseline
pnpm terraform:lifecycle:soak
pnpm game-ui:lifecycle:soak
git diff --check
git status --short
```

Expected:

```text
Node v22.18.0
format/lint/typecheck/tests/build/browser PASS
architecture 0 violations
Terraform performance baseline completes
Terraform lifecycle soak PASS
Game UI lifecycle soak PASS
git diff --check clean
working tree clean
```

---

## Delivery / Review Sequence

Implement and review in this order; do not skip directly to visual redesign before the contracts it consumes exist:

```text
T1  Foundation tokens/handles/icons
T2  Shared controls/components
T3  Generic patterns/hosts
T4  Tool registry/coordinator
T5  Generic Game Shell
T6  Interaction + command routing
T7  Terraform reference migration
T8  HUD/menu/debug/notifications
T9  Navigation + Home
T10 Load City
T11 New City live Terrain preview
T12 Responsive game-first presentation
T13 Accessibility/architecture enforcement
T14 Legacy cleanup + hardening + release gate
```

Recommended PR/review tranches if implementation is submitted incrementally:

```text
PR1 Foundation + Components                 T1–T3
PR2 Game Shell + Tool Architecture          T4–T6
PR3 Terraform Reference Migration           T7–T8
PR4 Lifecycle Screens + Live Preview        T9–T11
PR5 Responsive + Hardening + Cleanup        T12–T14
```

Each tranche must pass its focused tests and `pnpm architecture:check` before the next tranche begins. `pnpm verify` is mandatory at PR boundaries and at final closure.

## Frozen Acceptance Summary

Game UI Foundation v1 is not complete until the final repository state proves all of these together:

```text
One design-token/layer owner.
No generic UI layer imports gameplay systems.
One state-driven visual language across Home/New/Load/Game.
One generic Game Shell with explicit hosts.
One static app-owned Tool Registry and one deterministic Tool Coordinator.
Terrain Tool Dock entry toggles/switches predictably and Escape/back uses centralized dismissal.
Terraform v1 behavior/persistence/input semantics remain unchanged.
City Input remains the only viewport pointer-listener authority.
New City preview renders exact prepared Terrain and does not leak resources across regeneration/back navigation.
Load selection remains lightweight and does not restore full live Terrain until explicit Load.
Desktop/tablet/mobile share semantic UI components.
390×844, 844×390, and 320px layouts have no uncontrolled horizontal overflow.
Game root does not document-scroll; sheets/panels own local scroll.
Safe area, focus-visible, keyboard editing safety, modal focus, and reduced-motion contracts pass.
Repeated screen/tool/preview lifecycle soak shows no canvas/listener/RAF/root accumulation.
Full `pnpm verify` remains green with architecture at zero violations.
```
