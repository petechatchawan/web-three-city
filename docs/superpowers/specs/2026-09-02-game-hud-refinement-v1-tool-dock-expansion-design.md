# Game HUD Refinement v1 — Tool Dock Expansion Design

**Status:** Approved design, implementation pending  
**Date:** 2026-09-02  
**Repository:** `web-three-city`  
**Branch:** `feat/game-hud-refinement-v1`  
**Base:** `master@f012843f`

## 1. Purpose

Game UI Foundation v1 established the production shell, HUD, Tool Dock, Context Surface, Game Menu, Debug Surface, Inspector, notifications, and responsive contracts. Game HUD Refinement v1 tightens five approved areas:

1. compact Game HUD,
2. removal of meaningless top-center UI,
3. Category → Tool hierarchy for the Tool Dock,
4. production Game Menu / developer Debug separation,
5. Terraform strength presentation derived from canonical domain authority.

The current feature branch already contains partial, uncommitted implementation for these areas. The partial Tool Dock implementation only groups tools visually by category. It does not yet provide category navigation or expanded/collapsed interaction state. This design replaces that grouped-rendering direction with an explicit interaction model before implementation continues.

## 2. Goals

The completed refinement must provide:

- a compact city identity at the top-left without competing with the game world,
- no top-center control when there is no real simulation system,
- a Tool Dock that exposes categories first and tools only when their category is expanded,
- one authoritative expanded-category state owned outside the DOM renderer,
- one authoritative active-tool state owned by the existing `GameToolCoordinator`,
- a bottom Tool Stack whose Context Surface, Tool Tray, and Category Dock cannot overlap as their content height changes,
- a normal production Game Menu containing only real player actions,
- Debug reachable through the semantic command router with `F3`, not through the production menu,
- Terraform strength labels derived from domain-facing metadata rather than duplicated UI literals,
- preserved desktop, tablet, mobile portrait, mobile landscape, touch, keyboard, and lifecycle behavior.

## 3. Non-goals

This work must not add placeholder or fake systems. Specifically excluded:

- Roads,
- Zones,
- Buildings,
- Utilities,
- Transport,
- economy implementation,
- population simulation,
- simulation speed controls,
- date/time simulation,
- fake HUD metrics,
- Settings screen,
- World Presentation changes,
- lighting,
- water,
- biome work,
- save-browser redesign.

Production currently has one real gameplay tool: Terrain. Therefore production must expose only the `Environment` category and `Terrain` tool.

## 4. Locked Shell Architecture

The game shell remains responsible for global layer ownership. The tool area becomes one logical bottom stack:

```text
Game Shell
│
├── HUD
├── Tool Stack
│   │
│   ├── Context Surface
│   └── Tool Dock
│       ├── Tool Tray
│       └── Category Dock
│
├── Inspector
├── Debug
├── Dialog
└── Notifications
```

The important layout property is that Context Surface, Tool Tray, and Category Dock participate in one bottom-anchored stack. Their relative positions must follow actual rendered height rather than fixed assumptions such as `--ui-control-min + Npx`.

The implementation may preserve separate shell host elements where doing so keeps layer ownership simple, but presentation must behave as one tool stack. It must not reintroduce fixed offsets that assume a specific Dock or Tray height.

## 5. Tool Metadata Contract

Tool category metadata is typed and originates in the tool descriptor. Generic Tool Dock rendering must not infer categories from tool IDs, labels, DOM selectors, or string conventions.

Conceptual contract:

```ts
export interface GameToolCategoryDescriptor {
  readonly id: string;
  readonly label: string;
  readonly order: number;
}

export interface GameToolDescriptor {
  readonly id: string;
  readonly label: string;
  readonly icon: UiIconName;
  readonly shortcut?: string;
  readonly order: number;
  readonly category: GameToolCategoryDescriptor;
}
```

Production Terrain metadata is:

```text
category.id    = environment
category.label = Environment
tool.id        = terrain
tool.label     = Terrain
```

Tests must include multiple categories and tools to prove the renderer is generic, even though production has only one category and one tool.

## 6. State Ownership

Two different states must remain separate because they have different authority:

```text
UI navigation authority
└── expandedCategoryId: string | undefined

Tool runtime authority
└── GameToolCoordinator.activeToolId(): string | undefined

Terraform domain/runtime authority
└── operation / brush / strength / flatten / undo / preview state
```

`ToolDock` is a renderer and event surface. It must not privately own authoritative expanded-category state.

`GameToolCoordinator` continues to own tool activation/deactivation and must not become responsible for UI-only presentation details such as category button rendering.

Composition coordinates the two states and enforces their invariant.

## 7. Core Invariant

If a tool is active, its category must be the expanded category.

```text
activeTool != none
⇒ expandedCategory == activeTool.category
```

The inverse is not required: a category may be expanded while no tool is active.

No state is allowed where a category is collapsed while a tool from that category remains active in the world.

## 8. Tool Dock State Machine

### 8.1 Idle

```text
expandedCategory = none
activeTool        = none
```

Production UI:

```text
[ Environment ]
```

`Terrain` is not rendered in the Tool Tray.

### 8.2 Expand Category

Input:

```text
click Environment
```

Result:

```text
expandedCategory = environment
activeTool        = none
```

Presentation:

```text
[ Terrain ]
     ↑
[ Environment ]
```

### 8.3 Activate Tool

Input:

```text
click Terrain
```

Result:

```text
expandedCategory = environment
activeTool        = terrain
Context Surface   = open with Terrain tool view
```

Presentation:

```text
[ Terrain Context ]
        ↑
[ Terrain ]
        ↑
[ Environment ]
```

### 8.4 Toggle Active Tool Off

If Terrain is active and the user presses Terrain again:

```text
activeTool        = none
expandedCategory = environment
Context Surface   = closed
```

The category remains expanded because the user only toggled the tool, not the category.

### 8.5 Collapse Category

If `Environment` is expanded and pressed again:

```text
if Terrain active:
  deactivate Terrain
  close Terrain Context

expandedCategory = none
```

This prevents hidden active tools.

### 8.6 Switch Category

Future behavior when more real categories exist:

```text
Environment / Terrain active
↓ click Build
Deactivate Terrain
Close Terrain Context
expandedCategory = build
activeTool = none
```

Only one category is expanded at a time.

## 9. Keyboard and Semantic Commands

Keyboard handling remains centralized through `createGameCommandRouter`; no scattered DOM keydown handlers may be added.

### Terrain shortcut

`T` is a semantic shortcut to the Terrain tool.

From idle:

```text
T
→ expand Environment
→ activate Terrain
→ open Terrain Context
```

From Terrain active:

```text
T
→ deactivate Terrain
→ close Terrain Context
→ collapse Environment
```

This preserves fast keyboard access without requiring a category click first.

### Debug shortcut

`F3` remains:

```text
F3 → open-debug
```

The command is routed through the same semantic command architecture as other game commands.

## 10. Escape / Dismissal Contract

Central dismissal remains authoritative. The order is:

```text
Game Menu open
→ Escape closes Game Menu

Debug open
→ Escape closes Debug

Inspector open
→ Escape closes Inspector

Active tool
→ Escape deactivates tool
→ closes Context Surface
→ collapses its category

Expanded category with no active tool
→ Escape collapses category

No foreground UI/tool/category
→ Escape opens Game Menu
```

The player must not need multiple Escape presses merely to leave one active tool interaction.

## 11. Tool Stack Layout

### Problem being removed

The current responsive layout positions Context Surface using a bottom offset derived from a fixed control-height assumption. After the category label increased Dock height, browser verification measured direct overlap:

```text
context bottom = 768
dock top       = 768
```

Another responsive assertion required `<= 760` but measured `768`.

Adding an expandable Tool Tray would make a fixed-height offset more fragile. Therefore the fix must be structural rather than another numeric adjustment.

### Locked layout

```text
┌─────────────────────────────┐
│ Context Surface             │
└─────────────────────────────┘
            gap
┌─────────────────────────────┐
│ Tool Tray                   │
└─────────────────────────────┘
            gap
┌─────────────────────────────┐
│ Category Dock               │
└─────────────────────────────┘
```

The stack is anchored to the safe-area bottom. Each layer is positioned by layout flow from its actual content height.

No implementation may encode the current height of Category Dock or Tool Tray into a Context Surface `bottom` calculation.

## 12. Responsive Contract

Desktop, small desktop/tablet, mobile portrait, mobile landscape, and the minimum supported viewport use the same state machine and same component hierarchy.

Responsive CSS may vary:

- width,
- density,
- spacing,
- surface sizing,
- wrapping/scroll behavior.

It must not define a separate interaction model.

Required invariants:

```text
Context Surface does not overlap Tool Tray.
Tool Tray does not overlap Category Dock.
Tool Stack remains inside viewport.
No horizontal page overflow.
Orientation change preserves coherent category/tool state.
Touch interaction remains usable.
```

## 13. HUD Contract

Top-left contains compact city identity. Existing metrics support remains available for real future simulation data, but no fake metric is created.

Top-center is empty when there are no real metrics or simulation controls. `GameHud` may expose an optional simulation-control slot so future implementation does not require shell restructuring, but the slot must not render a surface when empty.

Top-right contains the Game Menu action.

The production idle HUD therefore remains:

```text
left:   city identity
center: empty
right:  menu
```

## 14. Game Menu and Debug Contract

Normal production Game Menu contains exactly the real actions:

```text
Resume
Save City
Exit to Main Menu
```

`Settings` is omitted until a real Settings system exists.

`Debug` is omitted from the production menu and remains accessible through the developer command path:

```text
F3 → Debug Surface
```

Existing Debug Surface functionality is retained.

Browser helpers and lifecycle tests that still look for `Exit City` or a `Debug` menu button are stale tests and must be migrated to the new approved contract rather than restoring old production UI.

## 15. Terraform Strength Ownership

Canonical production authority is the current repository implementation:

```ts
LOGICAL_ELEVATION_METERS = 0.25
```

and:

```text
Fine   = 1 logical level
Normal = 4 logical levels
Strong = 16 logical levels
```

Presentation delta is derived as:

```text
strengthLevels(strength)
        ×
LOGICAL_ELEVATION_METERS
        ↓
strengthDeltaMeters(strength)
        ↓
Terraform UI presenter/options
```

Expected current labels remain:

```text
Fine 0.25m
Normal 1m
Strong 4m
```

The generic segmented-control/view layer must not duplicate those meter values or recompute Terraform domain logic itself.

## 16. Existing Partial Branch State

The feature branch currently contains uncommitted partial implementation from the first refinement pass, including:

- compact HUD work,
- optional HUD center/simulation slot,
- typed category metadata,
- grouped Tool Dock rendering,
- `F3 → open-debug`,
- production Game Menu action changes,
- Terraform strength domain helper/presenter work,
- related focused tests.

Implementation continuation must inspect and evolve these changes rather than resetting or discarding them blindly.

The grouped Tool Dock implementation is specifically superseded by this design. Its typed category metadata is reusable; its always-visible `Category label + Tool` presentation is not final.

Unrelated untracked files such as `.zed/` must not be included in feature commits.

## 17. Test Strategy

All production behavior changes use TDD:

```text
RED
→ focused failure proving the new requirement
→ minimal GREEN implementation
→ refactor
→ focused PASS
```

Required regression coverage includes:

### Tool Dock

- idle production shows `Environment` and does not show `Terrain`,
- pressing Environment expands Terrain,
- pressing Terrain activates Terrain and opens Context,
- pressing active Terrain toggles tool off while Environment remains expanded,
- collapsing Environment deactivates active Terrain and closes Context,
- multiple categories/tools in harness sort and switch from typed metadata,
- renderer grouping/navigation does not depend on hardcoded tool/category labels.

### Commands

- `T` from idle expands Environment and activates Terrain,
- `T` from Terrain active deactivates Terrain and collapses Environment,
- `F3` opens Debug through command routing,
- editable targets continue to ignore gameplay shortcuts.

### Escape lifecycle

- menu/debug/inspector precedence remains intact,
- active tool dismissal also collapses its category,
- expanded-only category collapses before Game Menu opens,
- no duplicate/lost layer ownership through repeated open/close cycles.

### Responsive

- Context / Tool Tray / Category Dock never overlap,
- desktop, tablet/small desktop, mobile portrait, mobile landscape, minimum viewport,
- orientation changes preserve coherent active/expanded state,
- touch Terraform path remains usable.

### Game Menu / Debug migration

- normal menu has `Resume`, `Save City`, `Exit to Main Menu`,
- normal menu has no Debug,
- lifecycle/disposal/persistence/soak helpers use the new exit label,
- Debug acceptance uses `F3` instead of a menu action.

### Terraform strength

- domain helper proves current deltas from canonical constants,
- UI presenter consumes domain helper,
- view source contains no duplicated Fine/Normal/Strong meter literals,
- browser labels remain `Fine 0.25m`, `Normal 1m`, `Strong 4m`.

## 18. Verification Environment and Gate

The repository declares Node `22.18.0`. Final verification must run using that version:

```bash
nvm use 22.18.0
```

Required final gate:

```bash
pnpm verify
git diff --check
git status --short --branch
```

Expected conditions:

```text
0 architecture violations
0 test failures
0 browser failures
```

The architecture edge count may legitimately differ from the original 140 if approved imports are added; the invariant is zero violations.

`terrain-phase-1.spec.ts` has shown an unrelated/intermittent WebGL/picking failure while the branch was being verified under Node 24.18.0. If it still fails after the feature-specific regressions are closed and verification is rerun under Node 22.18.0, it must be investigated as a separate root-cause problem rather than patched through HUD/Tool Dock code.

## 19. Commit and Push Policy

Implementation stays on:

```text
feat/game-hud-refinement-v1
```

Do not modify `master` directly. Do not create an isolated worktree. Do not push until implementation and verification are complete or the user explicitly requests a push.

Production implementation commits must exclude unrelated local files.

## 20. Acceptance Summary

The refinement is accepted when the game presents this conceptual interaction:

```text
Idle

        [ Environment ]

Expand

        [ Terrain ]
             ↑
        [ Environment ]

Activate Terrain

  [ Terrain Context Controls ]
             ↑
        [ Terrain ]
             ↑
        [ Environment ]
```

with no overlap, no hidden active tool, no fake systems, Debug removed from the production menu, canonical Terraform strength ownership preserved, and the full verification gate passing on the repository's required Node version.
