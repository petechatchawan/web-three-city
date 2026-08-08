# City UI Foundation v0.1 Specification

**Status:** Approved design — not implemented

**Baseline:** `master@dbf236a89a906e0ece461ed810eeae85e68968be`

## Goal

Replace the current permanent left-side control/status panel with a mobile-first, world-centric player UI whose detailed management and inspection surfaces are dialog-based. Cities: Skylines is an information-architecture and interaction reference only; Web Three City keeps its own visual language, assets, spacing, and component implementation.

## Chosen approach

Use Vanilla TypeScript + native DOM/CSS with a small internal UI component layer. Do not introduce React, Vue, Svelte, or another general UI runtime for this milestone.

This is preferred over:

1. continuing ad-hoc `innerHTML`/query-selector UI, which scales poorly as dialogs and inspect states multiply; and
2. adopting a framework, which adds runtime/integration complexity without a current product requirement that justifies it.

The internal layer provides explicit mount/update/dispose contracts, shared tokens, responsive behavior, and a single dialog/navigation authority.

## Product principles

1. Mobile-first.
2. Landscape-first gameplay; portrait remains supported.
3. World-centric: the city remains visible whenever practical.
4. Dialog-based management and inspection.
5. System-separated information architecture.
6. First-class world inspection.
7. Information Views are extensible but only expose currently supported overlays.
8. Minimal persistent HUD.
9. Bottom build tools.
10. No permanent sidebar.
11. Player UI and Developer UI are separate.
12. Presentation is downstream from application/domain authority.

## Responsive baseline

Primary acceptance viewports:

- landscape mobile: `844×390`, `932×430`;
- portrait smoke: `390×844`, `430×932`;
- desktop regression: `1280×720`, `1440×900`.

Use safe-area insets and a minimum interactive target of 44 CSS px. No primary control may rely on hover.

## Persistent player shell

### Compact HUD

Shows awareness-level data only:

- population;
- treasury;
- current-period net;
- compact R/C/I demand state;
- GameTime date/time.

HUD values are immutable projections. No authoritative arithmetic is performed in the DOM layer.

### Top-level actions

- Information Views
- City
- Game Menu

### Bottom build dock

- Terrain
- Roads
- Zones
- Buildings

Selecting a category reveals only its current tools. Existing tool ownership, placement, preview, transaction, Undo, and validation semantics remain unchanged.

### Simulation controls

Expose the existing Paused / Normal / Fast / Faster / Step behavior in a compact touch-safe control group.

## Dialog architecture

### Primary DialogHost

There is exactly one active primary dialog at a time. It owns an internal navigation stack and deterministic Back/Close behavior.

Primary dialog kinds:

- `SystemDialog`
- `InspectDialog`

No modal-on-modal stacking is allowed in v0.1. Navigation within a dialog changes the internal route/section rather than spawning another primary modal.

### Simulation behavior while dialogs are open

Opening a System or Inspect dialog:

- blocks world pointer input behind the dialog;
- does **not** pause GameTime;
- does **not** alter simulation speed;
- does **not** stop RCI, Economy, Growth, or scheduled settlement;
- does **not** cancel or replace the selected build tool;
- does **not** clear Undo history or committed state.

Projection content may refresh while a dialog remains open as committed world revisions advance.

### Contextual Tool Surface

Tool configuration/status uses one non-modal contextual surface separate from the primary DialogHost. It may show:

- selected tool;
- brush/options;
- cost preview;
- validity/rejection state;
- affordability;
- Undo availability.

It must not block the world input required by the active placement tool.

## System dialogs

The City action opens a registry-backed management surface. v0.1 exposes only systems with current authoritative data/projections:

### City Overview

Compact city summary assembled from existing presentation projections. It owns no aggregate simulation state.

### Economy

Sections:

- Overview
- Taxation

Reuse the existing Economy projection and typed tax-policy command. Preserve Treasury, income, expenses, net, current/previous period, R/C/I revenue, road maintenance, player-action expense, and tax-policy behavior.

### Population / RCI

Expose currently available aggregate population, household, housing, employment, cohort, and demand information. Do not invent education/service data that has no owning system yet.

### Zoning

Expose current R/C/I demand/gate/development information supported by existing RCI/Zoning projections.

### Roads

Expose current network information that can be derived without introducing new Road simulation authority.

Future systems/tabs remain absent until their owning domain exists.

## World inspection

Inspection is available in Navigate/default mode. Active build tools retain world-tap ownership and must not be interrupted by inspect routing.

Deterministic target priority for a picked world cell/object:

1. Building
2. Road
3. Zone
4. Terrain

Each inspect adapter maps committed world state into a read-only player projection. The DOM must not read arbitrary internal state directly.

### Building Inspect

Show only currently authoritative values such as type/zone, occupancy/dwelling or workplace capacity, household/workforce summary, and road access where available.

### Road Inspect

Show current road identity/connectivity/footprint information and maintenance derived through existing Economy/Road projections where available.

### Zone Inspect

Show zone type, demand/growth state, road adjacency, and current development state when those values are authoritative.

### Terrain Inspect

Show cell/grid coordinate, quantized height, water/occupancy status, and other player-safe terrain facts already available from committed world projections.

If an inspected target becomes unavailable after a committed update, render an unavailable state and allow Close/Back; never retain stale authoritative data.

## Player inspect vs Developer inspect

Player inspect contains gameplay-relevant information only. IDs, revisions, raw snapshot fields, transaction fingerprints, and similar implementation data belong to a separate Developer Overlay/Inspect mode that is hidden during normal play.

## Information Views

Create an Information View registry and presentation entry point. v0.1 may expose only overlays already supported by the current runtime (for example canonical grid/zoning visualization where appropriate). Do not fabricate suitability, pollution, services, or resource maps without owning systems.

An Information View consists of:

- an overlay activation adapter;
- a player-facing title/legend projection;
- deterministic deactivate/replace behavior.

Only one primary information view is active at a time in v0.1.

## Internal presentation structure

Target structure:

```text
apps/game/src/ui/
├── foundation/
│   ├── tokens
│   ├── responsive
│   └── lifecycle
├── components/
│   ├── button
│   ├── icon-button
│   ├── metric
│   ├── tabs
│   └── panel
├── shell/
│   ├── game-hud
│   ├── build-dock
│   ├── simulation-controls
│   └── top-actions
├── dialog/
│   ├── dialog-host
│   ├── system-dialog
│   ├── inspect-dialog
│   └── dialog-navigation
├── tools/
│   └── contextual-tool-surface
├── systems/
│   ├── city-overview
│   ├── economy
│   ├── population-rci
│   ├── zoning
│   └── roads
├── inspect/
│   ├── building
│   ├── road
│   ├── zone
│   └── terrain
├── information-views/
└── developer/
```

Exact file names may change during implementation, but ownership boundaries may not collapse back into a monolithic bootstrap/UI file.

## Presentation data flow

```text
Owning domain state
      ↓
Application composition / committed world
      ↓
Immutable presentation projection
      ↓
City UI component/dialog
      ↓
Typed user intent
      ↓
Existing application command / tool controller
```

UI never becomes an alternative mutation path around `CommittedWorld`, domain validators, Economy transaction composition, RCI evaluation, or existing tool controllers.

## Input invariants

- UI surfaces mark themselves as world-input blocking where appropriate.
- Blocking dialogs consume pointer/touch input before world routing.
- Non-modal tool surfaces consume only their own controls; the remaining world continues to receive the active tool input.
- Opening City/Information/Menu from an active tool preserves selected tool state.
- Returning from a primary dialog resumes the same tool selection unless the user explicitly changed tools.
- Automatic Growth, Economy settlement, and dialog refreshes must not synthesize tool clicks or Navigate transitions.

## Accessibility and motion

- semantic buttons/labels/dialog roles;
- keyboard Escape = Close on desktop where safe;
- deterministic Back behavior;
- visible focus state;
- `aria-live` only for bounded status feedback, not continuously changing simulation metrics;
- short restrained transitions; respect `prefers-reduced-motion`;
- no information conveyed only by color.

## Migration policy

This is a clean replacement of the permanent sidebar architecture, delivered incrementally behind one player-shell authority rather than maintaining two long-lived UI systems.

During implementation, legacy controls may remain only while their replacement slice is incomplete. The milestone cannot close until the permanent sidebar path and duplicate presentation authority are removed.

Existing domain behavior must remain unchanged unless separately specified.

## Verification contract

### Unit/component

Cover at minimum:

- dialog open/back/close stack semantics;
- one-primary-dialog invariant;
- simulation state unchanged by dialog open/close;
- world input blocked by primary dialog;
- active tool preserved across dialog lifecycle;
- immutable projection rendering/update/dispose;
- Economy tax command wiring;
- deterministic inspect target priority;
- inspected-target unavailable state;
- Information View replace/deactivate behavior;
- responsive state calculation.

### Browser acceptance

Cover at minimum:

- landscape mobile shell has no permanent sidebar or overflow;
- HUD and bottom build dock remain touch-accessible;
- Economy dialog updates while simulation runs;
- tax-policy interaction still works;
- build tool remains selected after opening/closing City dialog;
- Road/Zoning/Terraform placement behavior remains intact;
- Navigate → Building/Road/Zone/Terrain inspection;
- dialog blocks accidental world mutation behind it;
- Save/Load still restores owning system state;
- portrait smoke layout;
- desktop regression layout.

Existing browser/domain tests remain authoritative and must not be weakened to make the UI migration pass.

## Out of scope

- visual cloning of Cities: Skylines;
- React/Vue/Svelte migration;
- new Economy domain behavior such as loans/services/production;
- new Education, Pollution, Land Value, Services, Traffic, or resource simulations;
- fake future tabs;
- persisted UI navigation state;
- offline/background catch-up;
- broad redesign of Three.js world rendering;
- unrelated architecture refactors.

## Milestone completion

City UI Foundation v0.1 is complete when:

1. mobile landscape gameplay is the primary supported presentation;
2. the permanent sidebar is gone;
3. persistent HUD/build/simulation controls are compact and responsive;
4. system management is primary-dialog based;
5. Economy and current city/RCI information are migrated without authority changes;
6. Building/Road/Zone/Terrain inspection works in Navigate mode;
7. player and developer information are separated;
8. dialog lifecycle does not pause or mutate simulation/tool state;
9. targeted, Lean, and canonical full browser verification pass on the exact candidate;
10. system documentation and closure evidence are current.
