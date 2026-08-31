# Game UI Foundation v1 Design

- **Status:** FROZEN — OWNER APPROVED 2026-08-31
- **Date:** 2026-08-31
- **Owner:** `apps/game`
- **Scope:** Full product UI foundation for Home, New City, Load City, Game HUD, gameplay tools, inspector, overlays, dialogs, notifications, debug presentation, and responsive PC/mobile behavior
- **Visual direction:** Game-first modern city-builder UI; world-first, compact, translucent, icon-forward, contextual, and consistent
- **Technology:** Vanilla TypeScript DOM factories, CSS, SVG icons, Three.js presentation; no React/Vue/Svelte/Web Components or custom reactive framework in v1
- **Base:** `master@fbaf4d1c779c0f1d110771e4c987da8b96be83fa`

## 1. Goal

Create one maintainable UI system that can scale across the complete game without each feature inventing its own controls, layout, state ownership, responsive behavior, or lifecycle.

The target product model is:

```text
World / Preview Scene = primary visual surface
UI                  = compact overlay and contextual interaction layer
```

The foundation must support the current product and future systems without requiring a shell redesign when Roads, Zones, Buildings, Water, Environment, Economy, Services, Transport, Policies, or additional tools arrive.

The v1 foundation covers:

```text
Home
New City
Load City
Game
Game HUD
Tool Dock
Context Surface
Inspector
Dialog / Sheet
Notifications
Debug presentation
Desktop / tablet / mobile adaptation
Keyboard / mouse / touch interaction semantics
```

The implementation must preserve current World, Terrain, Terraform, City Session, persistence, camera, and input authority boundaries.

## 2. Binding Architectural Principles

The following are production invariants for Game UI Foundation v1.

### 2.1 World-first presentation

The game world or world preview is the primary canvas. Persistent UI must remain compact and must not convert the game into a dashboard layout.

### 2.2 Progressive disclosure

Only information required for the current task is persistent. Tool-specific controls appear when that tool is active. Large lists, detailed configuration, and secondary information use contextual surfaces, sheets, inspectors, or dialogs.

### 2.3 UI is never gameplay authority

Canonical gameplay state remains owned by the appropriate system or orchestration concern. DOM state, CSS classes, selected button styling, canvas geometry, debug attributes, and transient UI state are never canonical gameplay state.

```text
System / application runtime state
        -> typed presentation state
        -> UI render/update
```

The reverse direction is expressed only as semantic user intents.

### 2.4 DOM is not application-state authority

The application must never infer gameplay or application decisions by querying CSS classes or DOM visibility. A DOM node may reflect `selected`, `active`, `disabled`, or `busy`; those values originate from typed state owned outside the DOM.

### 2.5 One interaction language

All interactive controls use common visual and behavioral states:

```text
default
hover
pressed
selected
disabled
focus-visible
danger / destructive where applicable
```

Feature code must not redefine button, switch, segmented-control, focus, or disabled semantics.

### 2.6 Compact visual density, comfortable interaction density

Game UI may look visually compact while retaining a minimum 44 CSS px interaction target. Visible icons may be 20–24 px while the interactive control remains at least 44×44 CSS px.

### 2.7 Semantic color only

Generic UI state uses semantic UI colors. Domain colors such as Residential green, Commercial blue, Industrial yellow, or Terraform valid/invalid overlays live in separate game-domain token namespaces and are not reused as generic UI state colors.

### 2.8 Explicit ownership and deterministic disposal

Every interactive UI owner owns the listeners, observers, timers, or other browser resources it creates. Disposal is idempotent.

```ts
interface UiHandle {
  readonly element: HTMLElement;
  dispose(): void;
}
```

Stateful views use a state-oriented external contract:

```ts
interface StatefulUiHandle<TState> extends UiHandle {
  render(state: TState): void;
}
```

The implementation may update existing DOM incrementally; `render(state)` does not require rebuilding the full subtree.

## 3. Technology and Dependency Direction

Game UI Foundation v1 remains app-owned browser presentation.

```text
Application composition
        -> Screen / Game coordinators
        -> Screens / Tool presentations
        -> Patterns
        -> Components
        -> Primitives
        -> Foundation tokens/contracts
        -> DOM / CSS
```

Gameplay dependency boundary:

```text
Gameplay systems
        ^
Application/tool adapters
        ^
Tool or screen controllers

UI foundation X-> gameplay systems
```

`foundation`, generic `primitives`, generic `components`, and generic `patterns` must not import Terraform, Terrain, Roads, Zones, Buildings, or other gameplay packages.

Feature-specific presentation may depend on the feature's public contracts through app-level adapters where required.

No framework migration is part of v1. The project does not introduce React, Vue, Svelte, Web Components, a custom VDOM, a global observable framework, or a Redux-like global store merely to implement this foundation.

## 4. Design-System Layering

The design system is layered as:

```text
Foundation
  -> Primitives
  -> Components
  -> Patterns
  -> Screens / Tool views
```

Dependencies may point downward only.

### 4.1 Foundation

Foundation owns:

```text
color tokens
typography tokens
spacing tokens
size/control tokens
radius tokens
surface tokens
shadow/elevation tokens
motion tokens
layer/z-index tokens
responsive contracts
safe-area tokens
icon-name contract
accessibility defaults
```

### 4.2 Primitives

Primitives are generic low-level controls or display elements. The v1 target set is:

```text
Button
IconButton
Input
Textarea
Switch
Checkbox
Radio
Slider
Divider
Badge
Progress
Spinner
Icon
```

A primitive is created only when generic reuse justifies it. Feature-specific controls such as `TerraformButton` or `RoadButton` are forbidden at this layer.

### 4.3 Components

Components compose primitives and own reusable interaction behavior. The v1 target set is:

```text
Surface / Card
SegmentedControl
Tooltip
Popover
DropdownMenu
Tabs
Metric
StatusIndicator
ToolButton
Toast
Dialog
Sheet
```

### 4.4 Patterns

Patterns define app/game layout and interaction surfaces:

```text
HudCluster
ToolDock
ContextSurface
Inspector
DialogHost
NotificationHost
GameMenu
ScreenOverlay
PreviewPanel
```

Patterns own global positioning and layer placement. Feature views provide content; features do not own absolute placement of global surfaces.

## 5. Visual Language

The approved visual direction is a game-first modern city-builder interface. It may draw general inspiration from established city-builder HUD patterns but must not copy third-party assets, proprietary icons, exact layouts, or branded visual elements.

The binding characteristics are:

```text
world-first
compact persistent chrome
translucent HUD surfaces
strong hierarchy with low visual noise
icon-forward primary navigation
text used to confirm meaning and improve discoverability
contextual controls rather than permanent large panels
minimal decorative shadow
subtle borders
clear active-tool state
```

Lifecycle screens and gameplay screens use the same tokens, iconography, interaction states, typography system, surface language, motion language, and accessibility rules even though their layouts differ.

## 6. Token Model

### 6.1 Token ownership

Stable visual values must be represented by shared tokens rather than re-authored feature constants. Feature CSS may define geometry unique to its own semantic content but may not create a parallel design system.

### 6.2 Color layers

Internal palette tokens may exist, but feature/components consume semantic tokens.

Generic semantic UI tokens include at least:

```text
--ui-bg
--ui-fg
--ui-surface-1
--ui-surface-2
--ui-surface-3
--ui-border
--ui-border-strong
--ui-muted
--ui-muted-fg
--ui-accent
--ui-accent-fg
--ui-positive
--ui-warning
--ui-danger
--ui-info
```

Game-domain colors use a separate namespace, for example:

```text
--game-zone-residential
--game-zone-commercial
--game-zone-industrial
--game-terrain-valid
--game-terrain-invalid
```

### 6.3 Surface hierarchy

The system defines distinct surface strength rather than one opacity for all overlays:

```text
HUD glass       -> lightest/translucent
Context surface -> more opaque
Inspector       -> more opaque than HUD
Dialog          -> strongest foreground separation
```

### 6.4 Typography

Semantic typography roles are preferred over feature-local pixel sizes:

```text
display
heading-large
heading-medium
heading-small
body
compact
label
micro
metric
mono/diagnostic where required
```

The default design scale is approximately:

```text
Display     32–40 px
Heading L   24 px
Heading M   18 px
Heading S   15 px
Body        14 px
Compact     13 px
Label       12 px
Micro       11 px
```

HUD metrics use tabular numeric rendering where numeric jitter would otherwise change layout.

### 6.5 Spacing

The existing 4 px base scale remains valid:

```text
4, 8, 12, 16, 20, 24, 32, 40, 48
```

Foundation additionally provides semantic gap/padding tokens such as tight, control, group, panel, and control-horizontal padding so feature CSS does not repeatedly choose arbitrary spacing.

### 6.6 Control density

Controls support semantic visual densities:

```text
compact
regular
large
```

The minimum interaction target remains 44×44 CSS px at every responsive band.

### 6.7 Radius

Use semantic radius roles:

```text
small  -> controls
medium -> panels
large  -> large surfaces/dialogs where appropriate
pill   -> badges/segmented visual treatment
```

The product avoids a card-heavy appearance in the game shell.

### 6.8 Layer tokens

Raw feature-level z-index values are forbidden. Foundation owns the layer scale:

```text
world
world-overlay
hud
tool
inspector
popover
dialog
notification
debug
```

Exact numeric values are an implementation detail of the shared token owner; ordering is binding.

### 6.9 Motion

Motion exists to communicate continuity, not decoration. Foundation owns semantic durations such as instant, fast, normal, and slow.

Typical usage:

```text
hover/focus feedback -> fast
tool/context opening -> normal
dialog/sheet opening -> normal
screen-level transition -> normal/slow
```

Gameplay commits, camera response, simulation changes, and repeated metrics are not delayed for decorative animation.

`prefers-reduced-motion: reduce` remains mandatory and must not block state changes.

## 7. Icon Contract

Features must not import an icon library directly. UI exposes an app-owned icon-name contract and SVG rendering primitive.

```ts
createIcon({ name: "terrain" });
```

The implementation may use a vetted open-licensed SVG icon source behind that contract. Replacing the source must not require changes in feature views.

Semantic sizes:

```text
16 px -> inline/compact
20 px -> standard control
24 px -> primary gameplay tool
32 px -> rare hero/emphasis usage
```

Icon-only controls always expose an accessible name. Mobile interaction must not depend on hover-only tooltips to explain primary actions.

## 8. CSS Ownership

The current monolithic `apps/game/src/style.css` becomes a stable entry point rather than the long-term implementation owner.

Target ownership:

```text
apps/game/src/ui/styles/
  tokens.css
  reset.css
  foundation.css
  primitives/
  components/
  patterns/
  screens/
  debug.css
```

Feature-specific styling may exist alongside a feature view when the style is truly semantic to that feature. Global placement, layer positioning, common controls, generic sheets/dialogs, dock placement, and shared spacing remain foundation/pattern-owned.

Stable style values must not be expressed through inline styles.

## 9. Screen Architecture

Top-level application navigation is internal application navigation, not browser-route-driven navigation in v1.

Current top-level screens are:

```text
Home
New City
Load City
Game
Startup Error
```

The architectural flow is:

```text
Application Navigation
        -> Screen Controller
        -> Typed Presentation State
        -> Screen View

Screen View
        -> semantic intent
        -> Screen Controller
```

A screen view does not directly create/dispose another top-level screen or perform cross-system orchestration.

## 10. Application Navigation and Transition Semantics

### 10.1 Navigation state

The application maintains one current top-level screen and one active screen controller at a time.

### 10.2 Navigation intents

Views emit semantic intents such as:

```text
continue-city
new-city
load-city
back
generate-terrain
create-city
select-save
load-selected-city
save-city
exit-city
```

Views do not emit DOM events as application-level contracts.

### 10.3 Single-flight transitions

Top-level transitions are single-flight. Duplicate/conflicting transition intents while a transition is in progress do not start additional transitions.

Example: repeated Create City activation creates at most one create transition.

### 10.4 Prepare before destructive navigation

Where destination preparation can fail, prepare/validate before destroying the current usable screen.

```text
Load request
-> load/validate/restore
-> success: leave Load and enter Game
-> failure: remain on Load with an operation error
```

Expected operation failure does not force a screen change.

### 10.5 Screen disposal

Leaving a screen deterministically disposes resources it owns. Repeated `dispose()` is safe.

## 11. Controller/View Separation

Complex screens use a controller/view split.

Controller responsibilities:

```text
own presentation state
call orchestration/application capabilities
manage async phase/busy/error transitions
own non-view screen resources
render the view
```

View responsibilities:

```text
create DOM
emit semantic intents
render typed presentation state
own view-local DOM listeners
manage accessible focus/presentation behavior
dispose view resources
```

This split is required for New City, Load City, and Game. Home may remain lightweight but should conform to the same intent/state model.

## 12. Home Screen

Home is a full-screen game menu with a lightweight backdrop. It must not create a canonical World, Terrain, City Session, Terraform runtime, or production game input stack merely to render the menu.

Home supports:

```text
Continue latest valid city when available
New City
Load City
Settings entry point when implemented
```

When a resumable city exists, Continue is the primary action. When no save exists, New City becomes primary.

The backdrop is presentation-only. v1 may use CSS/ambient presentation; the architecture permits a future lightweight Three.js diorama without changing Home contracts.

## 13. New City Screen

New City is a game-first configuration surface over a live Terrain preview.

### 13.1 Layout model

Large/medium layouts use a configuration surface beside the preview. Compact layouts use the live preview as the primary background with configuration in a bottom sheet.

### 13.2 State machine

New City has explicit phases:

```text
configuring
-> generating
-> preview-ready
-> creating
```

Failure returns to the last usable phase and surfaces an operation/field error without destroying the screen.

### 13.3 Preview freshness

The view/controller tracks whether the prepared preview still matches the current configuration. Editing seed or any future generation-affecting input invalidates the prepared preview for creation until generation succeeds again.

### 13.4 Exact prepared Terrain reuse

Generation semantics preserve the existing Terrain Product Integration invariant:

```text
explicit configuration / Seed64
-> prepare Terrain exactly once
-> render preview from that prepared Terrain
-> Create City consumes the exact prepared result
```

Create must not regenerate a second Terrain field simply because generation is deterministic.

### 13.5 Preview session boundary

The preview is not a production `LiveCitySession`. It owns derived preview presentation resources only and does not own a CityId, saved city, Terraform history, simulation state, or other live-game state.

### 13.6 Preview resource replacement

Regenerating disposes the previous preview presentation before or while atomically replacing it with the next successful preview. Repeated generation must never accumulate canvases, camera/input owners, geometry, listeners, or RAF owners.

### 13.7 Starting Region selection

The primary game-first presentation is selection/highlight on the Terrain preview. A semantic DOM-accessible selection representation remains available. Both representations derive from one selected-region presentation state.

The 3D preview must not become selection authority.

### 13.8 Preview camera

Preview camera behavior may use a distinct configuration from the production game camera but should reuse existing camera implementation capabilities rather than duplicate camera logic.

## 14. Load City Screen

Load City is a save browser plus preview/details surface.

Large/medium layouts use list + preview/detail composition. Compact layouts use a list-to-detail flow rather than shrinking a desktop split pane.

v1 preview is intentionally lightweight: save metadata and an optional derived preview asset if one exists. Selecting or hovering a save must not automatically restore an entire 512×512 live Terrain and construct a full game runtime.

Future thumbnail/preview assets are derived presentation data, not canonical save authority, and must not be stored inside Terrain canonical snapshots.

## 15. Game Screen Architecture

Game combines a live world presentation runtime with a generic UI shell.

```text
Game Screen Controller
  -> Live World/Presentation Runtime
  -> Game UI Coordinator
  -> Generic Game Shell View
```

The game shell knows presentation hosts, not feature internals.

Conceptual shell hosts:

```ts
interface GameShellView {
  readonly viewport: HTMLElement;
  readonly hudHost: HTMLElement;
  readonly toolDockHost: HTMLElement;
  readonly contextHost: HTMLElement;
  readonly inspectorHost: HTMLElement;
  readonly overlayHost: HTMLElement;
  readonly dialogHost: HTMLElement;
  readonly notificationHost: HTMLElement;
  readonly debugHost: HTMLElement;
  dispose(): void;
}
```

Exact interface shape may vary during implementation, but the slot/ownership separation is binding.

## 16. Game Presentation Layers

The Game screen provides explicit presentation layers:

```text
World Surface
World UI / semantic world overlay
HUD
Tool surface
Inspector
Popover/overlay
Dialog
Notification
Debug
```

Empty layer hosts do not intercept world input. Interactive child surfaces enable pointer interaction only where needed.

Features must not append arbitrary globally positioned UI directly to the game root.

## 17. Game HUD

HUD contains persistent global city/session information only.

HUD may contain:

```text
city identity when space permits
money / global economy summary
population / core metrics
future demand/happiness/alerts
simulation state and speed
global menu/save status
```

HUD must not contain feature-specific Terraform brush state, Road type, Zone type, Building category, or similar contextual controls.

Production HUD must remove development-only identity such as Terrain fingerprint/revision/Seed64 from the primary persistent chrome. Such information belongs in debug/info surfaces.

### 17.1 HUD metric contract

Metrics are declarative presentation state rather than hardcoded screen fields. A metric state includes identity, formatted value, accessible label, optional icon, priority, and optional semantic severity/trend.

Responsive layouts may omit lower-priority metrics; they must not shrink important text below readable design sizes merely to fit everything.

## 18. Gameplay Tool Architecture

### 18.1 Tool Dock

The Tool Dock is primary gameplay-system navigation.

Initial primary tools may include:

```text
Terrain
Roads
Zones
Buildings
```

Future tools may be added without changing Game Shell internals.

### 18.2 Static app-owned registry

v1 uses a static application-owned registry, not a runtime plugin marketplace or dynamic extension engine.

Each tool exposes a descriptor conceptually containing:

```text
id
label
icon
order
optional shortcut
availability
```

The availability values have four distinct meanings:

```text
available -> can be activated
locked    -> progression/product rule prevents use; reason may be explained
disabled  -> temporarily unavailable in the current state
hidden    -> not present in the current product/configuration surface
```

The availability reason/state comes from application or gameplay policy, never from DOM state.

The registry drives Tool Dock presentation and activation lookup.

### 18.3 Tool Dock does not know feature internals

Tool Dock and Game Shell must not import or understand `TerraformOperation`, Road types, Zone types, Building categories, or feature-specific command semantics.

### 18.4 One active primary tool

Exactly zero or one primary gameplay tool is active at a time.

```text
click inactive tool -> activate
click active tool   -> deactivate
click another tool  -> deterministic switch
```

### 18.5 Deactivate is not dispose

`deactivate` means the tool is temporarily not receiving primary world interaction. `dispose` means the current live game session/tool runtime is being destroyed.

Terraform reference semantics:

```text
deactivate
-> clear transient preview
-> hide/deactivate Terraform overlay
-> retain valid same-session Undo history

dispose
-> dispose runtime/overlay/listeners/resources
-> release Undo history
```

### 18.6 Tool-switch lifecycle

Switching Tool A to Tool B follows one ordered lifecycle:

```text
request switch
-> A clears transient preview / prepares deactivation
-> A deactivates
-> A context view unmounts/disposes
-> B activates
-> B context view mounts
-> publish B as active
```

If future tools require deactivation confirmation, the coordinator may extend the prepare-deactivate stage. No generic workflow engine is introduced for v1.

## 19. Context Surface

The shared Context Surface configures the active tool.

```text
Tool Dock       = choose gameplay system
Context Surface = configure active gameplay system
```

Feature code provides contextual content; the shared pattern owns global placement, responsive transformation, layer, safe-area behavior, and dismissal semantics.

The Context Surface supports semantic presentation modes:

```text
compact
expanded
fullscreen
```

Foundation maps those modes to responsive presentation. Features do not choose arbitrary pixel positioning.

### 19.1 Terraform reference presentation

Terraform v1 becomes the first reference consumer:

```text
Terrain tool selected
-> Context Surface
   -> Operation: Raise / Lower / Flatten
   -> Brush: 1×1 / 3×3 / 5×5
   -> Strength: Fine / Normal / Strong when applicable
   -> Flatten reference state when applicable
   -> Undo
   -> contextual status when useful
```

The migration is presentation-only. Frozen Terraform domain/runtime semantics do not change.

Terraform should use shared SegmentedControl/Button/Icon/Status components and must not retain a parallel feature-specific button system or global positioning CSS.

## 20. Tool Presentation State

Tool views receive typed presentation state through `render(state)` or an equivalent state-oriented API.

Terraform reference state conceptually includes:

```ts
interface TerraformToolViewState {
  readonly operation: TerraformOperation;
  readonly brushSize: TerraformBrushSize;
  readonly strength: TerraformStrength;
  readonly flattenTargetMeters?: number;
  readonly undoDepth: number;
  readonly validity: "idle" | "valid" | "invalid";
  readonly message?: string;
}
```

`active` does not need to be duplicated inside feature view state when activation is already owned by Tool Coordinator.

Tool-specific presentation state remains feature-owned; Game UI Foundation owns only generic activation/surface lifecycle.

## 21. Game Interaction Routing

There remains exactly one viewport pointer-listener authority. The generic interaction route must preserve the existing Terraform TF4 split between pointer observation and semantic commit.

The production direction is:

```text
Pointer Events
-> City Input
   |
   |-- normalized pointer observation stream, before gesture reduction
   |     -> Game Interaction Router
   |     -> active tool pointer adapter
   |     -> preview / cancellation only; never canonical commit
   |
   `-- gesture arbitration / semantic outputs
         |
         |-- camera navigation gestures
         `-- semantic tap
               -> Game Interaction Router
               -> active tool commit when a tool is active
               -> selection/inspector when no primary tool owns the tap
```

Terraform, Roads, Zones, Buildings, and Inspector must not attach competing viewport pointer listener stacks.

The active tool may observe normalized pointer events for hover/preview/cancel lifecycle, but one accepted canonical gameplay commit still comes only from the post-arbitration semantic tap or another explicitly defined semantic command. Navigation gestures never commit a tool action.

Existing Terraform pointer-session semantics are retained behind this generic route rather than rewritten. Camera gestures retain priority over tool commits according to existing City Input semantics.

## 22. Tool Preview Ownership

Each tool owns the semantics and derived world presentation of its own preview:

```text
Terraform -> Terraform overlay
Roads     -> road placement/upgrade preview
Zones     -> zone paint preview
Buildings -> building ghost/placement preview
```

Foundation controls activation/deactivation lifecycle but does not understand preview geometry.

A tool must clear/deactivate its transient preview when deactivated or disposed.

## 23. Inspector

Inspector represents a selected world entity, not the active gameplay tool.

Potential inspected entities include buildings, road segments, infrastructure, vehicles, citizens, zones, or future domain objects.

Desktop may show Inspector simultaneously with an active tool. Compact layouts preserve semantic coexistence but show only one primary bottom surface at a time; opening Inspector temporarily occupies the bottom surface and closing it restores the active tool context without implicitly deactivating the tool.

World-tap routing follows:

```text
active primary tool -> tool semantics
no active tool      -> world selection / inspector semantics
```

Explicit inspect intents from UI may still open Inspector while a tool is active.

## 24. Overlay, Dialog, and Dismissal Semantics

Screen navigation and overlay navigation are distinct.

Dialogs, Settings overlays, confirmations, popovers, Game Menu, and Inspector do not become top-level screens merely because they cover much of the viewport.

### 24.1 Modal classification

```text
Tool Context -> non-modal
Inspector    -> non-modal
Popover      -> light-dismiss transient
Dialog       -> modal
Game Menu    -> modal overlay
```

### 24.2 Central dismissal command

Individual features must not independently own global Escape behavior.

Desktop `Escape` and explicit mobile/back UI map to a common dismiss-top-layer semantic command.

The default dismissal priority is:

```text
1. modal dialog or open Game Menu
2. popover/menu
3. currently foregrounded inspector/sheet
4. active primary tool
5. if nothing dismissible remains and Game Menu is closed, open Game Menu from Game
```

An open Game Menu therefore closes on the next dismiss command when it is the top modal surface.

Example:

```text
Dialog + Terraform active
Esc #1 -> Dialog closes
Esc #2 -> Terraform deactivates
Esc #3 -> Game Menu opens
```

Focus returns to the initiating control when a dismissible overlay closes where practical.

## 25. Keyboard Command Routing

Gameplay/global keyboard shortcuts are centralized rather than registered separately by each tool.

Potential bindings include Terrain, Roads, Zones, Buildings, simulation speed, and dismissal commands. Exact key assignments beyond existing product requirements may be finalized during implementation without changing the architecture.

Global shortcuts must not activate while the user is typing in:

```text
input
textarea
select
contenteditable
```

or when the active modal intentionally captures keyboard input.

## 26. Notifications and Feedback

The UI uses four feedback levels:

```text
Field error       -> invalid form/config input
Context status    -> current tool/operation information
Toast             -> transient cross-surface result such as Save success/failure
Dialog            -> blocking/destructive decision
```

Repeated gameplay actions should prefer world visual feedback rather than emitting a toast for every successful commit.

Errors are classified as:

```text
Field Error
Operation Error
Fatal Screen/Bootstrap Error
```

Expected operation errors retain the current usable screen/runtime.

## 27. Debug Presentation

Terrain Debug and future engineering diagnostics are separate from production HUD.

Developer-only data such as:

```text
Terrain vertices
triangle topology
normals
render sectors
revision/fingerprint diagnostics
runtime counters
```

moves to a dedicated debug surface or developer entry point.

Diagnostic `data-*` attributes may remain for browser testing, but they are projections of runtime state and never state authority.

## 28. Responsive Contract

Responsive behavior is capability/layout driven, not user-agent/device-name driven.

Foundation defines three v1 layout bands:

```text
Compact: 0–639 CSS px
Medium:  640–1023 CSS px
Large:   >= 1024 CSS px
```

A `short viewport` adaptation applies below 600 CSS px height regardless of width.

The minimum supported layout width is 320 CSS px.

These global layout bands and the short-viewport threshold have one Foundation owner. Feature CSS may adapt its own internal content, but it must not invent competing global breakpoints for Tool Dock, HUD, Context Surface, Inspector, Dialog, or screen-shell behavior.

Responsive presentation additionally considers pointer capability and hover capability. A large touch device remains touch-capable; a narrow desktop window remains compact even though it has a mouse.

## 29. Safe Area and Viewport Units

Full-screen shells use dynamic viewport semantics (`dvh`) rather than relying on legacy `vh` alone.

Foundation owns safe-area tokens derived from:

```text
env(safe-area-inset-top)
env(safe-area-inset-right)
env(safe-area-inset-bottom)
env(safe-area-inset-left)
```

Persistent edge surfaces consume shared safe-area tokens; feature CSS does not re-author safe-area logic.

Resize or orientation changes affect presentation only. They do not reset camera state, selected tool, Terraform operation, inspector selection, dialog semantics, or gameplay state.

## 30. Large Layout

Large is the reference desktop presentation:

```text
Top HUD            -> horizontal compact global metrics/actions
Tool Dock          -> centered bottom floating dock
Context Surface    -> floating tray above Tool Dock
Inspector          -> right-side compact panel
Dialog             -> centered constrained modal
Tooltip            -> hover/focus enhancement
```

Persistent chrome remains compact despite available space.

Inspector preferred width is approximately 280–360 CSS px. Context Surface has a content-aware constrained width; it must not stretch full width merely because space exists.

## 31. Medium Layout

Medium reduces persistent information rather than simply shrinking every desktop element.

```text
HUD              -> fewer persistent metrics
Tool Dock        -> horizontal bottom dock
Context Surface  -> wider relative to viewport
Inspector        -> side panel only when enough world width remains; otherwise sheet
Labels/spacing   -> reduced where semantics remain clear
```

Inspector transformation is based on usable world width as well as the Medium band.

## 32. Compact Layout

Compact prioritizes:

```text
1. world visibility
2. primary tool switching
3. current-tool actions
4. secondary metrics/details
```

### 32.1 Compact HUD

Show critical metrics and compact simulation/menu controls. Lower-priority metrics move to secondary surfaces. Persistent HUD must not wrap unpredictably into multiple rows.

### 32.2 Compact Tool Dock

The dock is bottom-fixed, safe-area aware, and uses predictable equal slots for approximately 4–5 primary tools. Core tool navigation does not use uncontrolled horizontal scrolling. Overflow future tools use a `More` entry/category strategy.

### 32.3 Context Surface transformation

The same semantic Context Surface becomes a non-modal bottom sheet.

v1 supports explicit states:

```text
compact
expanded
```

Complex draggable-sheet physics is out of scope. Content exceeding the selected surface height scrolls inside the sheet.

### 32.4 One primary bottom surface

Compact presentation shows one primary bottom surface at a time. Tool context and Inspector do not stack as multiple competing bottom sheets. Semantic state may coexist; foreground presentation is coordinated centrally.

### 32.5 Mobile New City

Live Terrain preview remains visible as the primary surface and configuration is presented in a bottom sheet. Opening the software keyboard must keep the active field usable and must not create document-level game-screen scrolling.

### 32.6 Mobile Load City

Load uses list/detail flow rather than a compressed split pane.

## 33. Input-Modality Contract

Hover is an enhancement only.

Fine pointer may enable hover visuals and tooltips. Coarse pointer must remain fully understandable without hover.

Pointer starting on interactive UI is UI-owned and does not route to City Input/world commit. Empty overlay hosts do not block world input.

Tool/Inspector Context Surfaces are non-modal: visible world area remains interactable where tool semantics require it. Modal Dialog/Game Menu blocks underlying world interaction.

## 34. Scroll Contract

Game root is a full-screen non-document-scrolling surface.

```text
Game root -> overflow hidden
World     -> never document scroll
```

Local surfaces may scroll:

```text
sheet body
dialog body
save list
configuration panel
building browser/future catalogs
```

Home/New/Load use full-screen shells and localized scrolling where needed rather than defaulting to long web-page document scrolling.

## 35. Home / New / Load Presentation Direction

All lifecycle screens use the same game-first design language.

### Home

Full-screen backdrop with focused vertical game-menu actions. It must not look like an admin dashboard or a stack of generic web cards.

### New City

Large/medium: configuration surface + live Terrain preview.

Compact: live Terrain preview + bottom configuration sheet.

### Load City

Large/medium: save list + selected city preview/details.

Compact: list -> details/preview flow.

## 36. Game Menu

Game Menu is a modal overlay over the active Game screen, not a top-level screen transition.

Expected future items may include:

```text
Resume
Save
Settings
Exit to Main Menu
```

Opening Game Menu does not itself destroy the live runtime. Future simulation pause integration remains a simulation/application concern triggered by menu intent, not UI authority.

## 37. Accessibility Contract

Game-first presentation does not relax accessibility requirements.

Binding baseline:

```text
minimum 44 px interaction target
semantic native controls where appropriate
keyboard reachability
visible focus for keyboard navigation
aria-label for icon-only controls
aria-pressed/selected semantics for persistent toggles/tools
aria-live only for meaningful status
color never the sole semantic indicator
reduced motion support
adequate contrast
modal focus containment
focus restoration on dismiss where practical
```

Browser zoom/text scaling must not be intentionally disabled to hide layout defects.

## 38. Responsive Acceptance Profiles

Representative v1 browser profiles are:

| Profile | Viewport | Primary interaction |
| --- | ---: | --- |
| Desktop | 1440×900 | mouse + keyboard |
| Small Desktop / Tablet landscape | 1024×768 | mouse/keyboard or touch capability |
| Mobile Portrait | 390×844 | touch |
| Mobile Landscape | 844×390 | touch |
| Narrow minimum sanity | 320×568 | layout/accessibility sanity |

Detailed interaction suites need not run every scenario on every profile. Core layout smoke runs on all profiles; detailed tool interaction runs at least on Desktop and 390×844 mobile; landscape receives key shell/tool/context checks.

## 39. Browser and Unit Verification Contract

### 39.1 Design-system/primitives

Verify:

```text
44 px targets
focus-visible
accessible labels
selected/disabled semantics
reduced-motion compatibility
idempotent disposal of interactive primitives
```

### 39.2 Screen navigation

Verify:

```text
Home -> New -> Back without resource leak
Home -> Load -> Back
single-flight duplicate transition behavior
Load failure retains Load screen
Load success creates exactly one Game runtime
Game -> Exit -> Home disposes presentation/input resources
```

### 39.3 New City preview lifecycle

Soak representative cycles:

```text
enter New City
Generate A
Generate B
Randomize / Generate C
Back
repeat
```

Assert one preview canvas/runtime owner at a time, no stale geometry/listeners/RAF ownership, and exact prepared Terrain reuse for Create.

### 39.4 Tool Coordinator

Unit-test:

```text
activate inactive tool
toggle active tool off
switch A -> B exact order
deactivate vs dispose behavior
no duplicate activation
blocked/prepared switch extension point if implemented
```

### 39.5 Gameplay interaction routing

Browser-test:

```text
active tool world tap -> tool path, not selection
no active tool world tap -> selection path
drag/right-drag/wheel/pinch -> camera semantics, not tool commit
pointer over UI -> no world tool commit
dialog open -> underlying world interaction blocked
```

### 39.6 Dismissal semantics

Verify:

```text
Dialog closes before active tool
Popover closes before tool
Inspector/sheet foreground closes appropriately
active tool deactivates on next dismiss
next Game-level dismiss opens Game Menu
```

### 39.7 Responsive gates

Representative screen states:

```text
Home
New City preview
Load City
Game idle
Game + active tool
Game + Inspector
Game + Dialog
```

For all required profiles:

```text
no horizontal document overflow
Game does not document-scroll
safe-area edge surfaces remain usable
critical controls do not collide
orientation/resize preserves semantic state
```

Visual screenshot tests may be added for stable DOM UI regions, preferably masking the dynamic world canvas. They are not required to become the primary release gate in v1.

## 40. Performance Contract

The UI foundation must not introduce a permanent UI `requestAnimationFrame` loop.

UI state updates are event/state driven. Three.js rendering remains owned by presentation/runtime code.

Repeated HUD metric or tool-state updates should update existing DOM rather than recreate the entire shell or remount unrelated surfaces.

The foundation should avoid runtime device detection, heavyweight framework runtime, and unnecessary duplicate Three.js previews.

## 41. Migration from Current UI

Migration is architectural and presentation-focused; current gameplay semantics remain intact.

### 41.1 Existing primitives

Current Button/Input/Switch/Badge/etc. are inputs to the new primitive layer. The current Card evolves into the shared `Surface / Card` component layer. Reuse/refactor rather than rewrite without reason.

### 41.2 Current `style.css`

Keep it as the stable imported entry while moving implementation ownership into structured style modules.

### 41.3 Current lifecycle screens

Home, New City, and Load City move from screen factories with many callbacks toward typed state + semantic intent controller/view ownership.

New City additionally gains live Terrain preview composition.

### 41.4 Current Game screen

`create-game-screen.ts` moves from knowing Terraform/debug internals toward a generic shell with explicit presentation hosts.

### 41.5 Current live-city composition

`create-live-city-experience.ts` is not replaced wholesale. Responsibilities are extracted incrementally so world presentation, tool coordination, HUD/UI coordination, debug, and lifecycle ownership become focused modules while preserving verified behavior.

### 41.6 Terraform

Terraform v1 is the first production tool migrated onto Tool Dock + Context Surface + shared components.

The following frozen semantics remain unchanged:

```text
Raise / Lower / Flatten
1×1 / 3×3 / 5×5 gameplay-cell brushes
Fine 0.25m / Normal 1m / Strong 4m
first valid Flatten tap selects canonical reference without mutation
City Input semantic tap remains the commit signal
camera navigation never commits Terraform
same-session revision-safe Undo
Terrain snapshot remains the persistence authority
```

The UI migration must not reopen Terraform v1 domain closure.

## 42. Repository Ownership Target

Exact filenames may be refined during implementation planning, but ownership is expected to converge toward:

```text
apps/game/src/
  application/
    navigation/

  ui/
    foundation/
    primitives/
    components/
    patterns/
    styles/

    screens/
      home/
      new-city/
      load-city/
      game/

    tools/
      terraform/
      roads/       future
      zones/       future
      buildings/   future

  composition/
    game/

  presentation/
    preview/
    camera/
    input/
```

This is an ownership map, not permission to bypass current architecture policy. Implementation planning must validate each proposed path against `architecture.policy.json` before code movement.

## 43. Explicit Non-goals

Game UI Foundation v1 does not include:

```text
React/Vue/Svelte migration
Web Components conversion
custom virtual DOM
custom observable/reactivity framework
Redux/global UI store
dynamic plugin marketplace
runtime tool discovery system
global gameplay Undo stack
JSON-driven generic UI engine
desktop docking/window-manager system
complex draggable bottom-sheet physics
browser-route/deep-link product architecture
full 3D runtime on Home
full city restore on Load hover
canonical thumbnail data inside Terrain/World snapshots
redesign of Terraform gameplay semantics
implementation of future Roads/Zones/Buildings gameplay systems
```

## 44. Binding Invariants

```text
UI is derived presentation, never gameplay authority.
DOM is never application-state authority.
Gameplay systems never import UI Foundation.
Game Shell never knows feature-specific tool control contracts.
Foundation owns shared controls, layers, responsive rules, safe areas, and global surface positioning.
One primary gameplay tool is active at a time.
Tool deactivate and tool dispose are distinct lifecycles.
One viewport pointer-listener authority remains in production.
Normalized pointer observation may drive active-tool preview/cancel before gesture reduction, but canonical tool commit remains post-arbitration semantic intent.
Tool world interactions route through a generic coordinator/router, not competing listeners.
Inspector is selection state, not active-tool state.
Desktop and mobile use the same semantic component architecture.
Compact presentation shows one primary bottom surface at a time.
Escape/back dismissal semantics are centralized.
Feature CSS does not use arbitrary global z-index or duplicate generic control styling.
Interactive UI ownership includes idempotent cleanup.
New City preview uses the exact prepared Terrain later consumed by Create City.
Load preview remains lightweight and derived.
Responsive resize/orientation never mutates gameplay or active-tool state.
Terraform migration changes presentation architecture only; Terraform v1 semantics stay frozen.
```

## 45. Definition of Done for Foundation v1

Game UI Foundation v1 is production-ready when all of the following are true:

```text
Design tokens and layer contracts have one owner.
Generic primitives/components/patterns are reusable and tested.
Home/New/Load/Game use one visual and interaction language.
New City has deterministic leak-free live Terrain preview lifecycle.
Game Shell exposes generic hosts and no longer owns Terraform-specific controls.
Tool Registry/Coordinator supports activate, toggle, switch, deactivate, and dispose deterministically.
Terraform is migrated as the reference tool without domain-semantic changes.
Context Surface, Inspector, Dialog, Notifications, and Debug have explicit ownership/layer semantics.
Central dismissal and keyboard routing are in place.
City Input remains the single viewport pointer authority.
Large/Medium/Compact layouts satisfy responsive contracts.
390×844 and 844×390 gameplay layouts are usable with touch.
320 px width has no horizontal layout failure.
No production screen has uncontrolled horizontal document overflow.
Game root does not document-scroll.
Reduced-motion and keyboard-focus contracts pass.
Repeated screen/tool/preview lifecycle tests show no listener/canvas/RAF accumulation.
Repository architecture verification remains at zero violations.
Existing Terrain/City Session/Terraform persistence and gameplay contracts remain passing.
```

## 46. Design Decision Summary

Game UI Foundation v1 standardizes the product on an app-owned layered game UI architecture:

```text
Vanilla TypeScript + DOM + CSS + SVG

Foundation
  -> Primitives
  -> Components
  -> Patterns
  -> Screens / Tool Views
  -> Coordinators / application composition
```

The product becomes game-first rather than web-dashboard-first:

```text
Home      -> lightweight game backdrop
New City  -> live Terrain preview + contextual configuration
Load City -> lightweight save browser/preview
Game      -> full live Three.js world + compact HUD + Tool Dock + contextual surfaces
```

This foundation is intentionally strong enough to support the planned city-builder surface area while avoiding a framework rewrite, feature-specific UI silos, a custom frontend framework, or premature plugin/state infrastructure.
