# ADR — Light Theme + Mobile-First Uniform Shell

**Status:** Accepted

**Date:** 2026-08-09

## Context

The City UI presentation layer currently ships a dark-only theme with a legacy
`.panel` sidebar that assumed `#f5f8fa` surface tones and dark `rgb(16 28 37 …)`
walls. World assets (terrain, water, roof, zone overlays) use dark, muted
constants tuned for that dark presentation, and the WebGL renderer clears the
world to an opaque dark color rather than letting CSS paint the backdrop.

Separately, the shell relies on viewport-classification branching
(`isMobile`) and a build dock to arrange HUD, tools, and dialogs. Routing tool
context into a contextual sheet requires a committed tool projection feed, and
management panels are presented as centered modals that consume world space on
small viewports and mobile phones.

The goal is a single light theme with a mobile-first, breakpoint-uniform shell:
bottom navigation, slide-up subtool tray, a floating collapsible context sheet
showing the committed tool projection, and management panels rendered as bottom
sheets at every size. No `isMobile` branching. No Save schema change.

## Decision

Adopt a single light theme and a mobile-first uniform shell.

### Presentation-only color system

- `tokens.css` owns the single light palette: surface
  `rgba(255 255 255 / 0.88)`, surface-raised `#ffffff`, text `#1a2236`, muted
  `#4a5878`, accent `#2563eb`, danger `#dc2626`, zone tokens
  `#16a34a`/`#2563eb`/`#d97706`. Dark-only CSS is removed.
- Historic hard-coded dark walls in `.panel`, `.tool-context`, and
  `.undo-button` receive the same light treatment or are removed where the new
  shell supersedes them.
- Legacy `.city-tool-context` stays `display:none` until the new context sheet
  activates it.
- The browser paints the horizon: transparent WebGL clear + CSS sky gradient on
  `body`/`.app-shell` (blue → near-white → subtle green + radial sun glow +
  horizon haze).

### Bright daytime world assets
- Terrain/water/building/zone material constants become bright daytime values
  tuned for the light presentation. Geometry, opacity, and vertex-count
  semantics are unchanged; this is color-only.

### Uniform mobile-first shell (Milestones 2-6)
- Bottom navigation replaces the build dock, subtool tray exposes per-category
  tools, and a floating collapsible context sheet shows the **committed** tool
  projection (validity/rejection/message/effective cells/affordability/Undo).
- HUD chips become tappable and route into dialogs.
- Management panels present as 90vh bottom sheets (handle bar, backdrop blur,
  clear ×) uniformly at every breakpoint; `isMobile` branching is never added.
- Tool authority, simulation loop, camera/grid/quality, Save V6, undo, inspect
  semantics, and mesh geometry remain unchanged.

## Consequences

### Positive
- One theme to maintain; dark-only CSS removed.
- Uniform layout removes viewport-classification branching from component logic.
- The CSS sun/sky plus transparent clear keeps textures as accent while the
  canvas stays effectively backdrop.
- Bottom-sheet panels use space better on small viewport sizes.

### Costs
- A second event binding group reuses one canvas tool-event stream into the
  shell context sheet, double-writing committed projections while the legacy
  binding is retired staged (legacy `bindGameToolHud` stays until removal).
- Smaller window footprint + backdrop-filter blur composition must be browser-tested
  on portrait and landscape acceptance sizes.
- Renderer transparency reworks the render-target sizing expectations if the app
  tries to clear the canvas opaquely again.

## Rejected alternatives

### Keep the dark theme and add a light toggle
Rejected: doubles the presentation surface to maintain and conflicts with the
uniform-shell goal. Single light theme ships first; a toggle can be added later
if concrete demand appears.

### Keep `isMobile` branching with a parallel mobile layout
Rejected: the branching duplicates every surface and regresses acceptance
coverage; the uniform shell renders the same DOM at all breakpoints.

### Keep opaque dark renderer clear; paint sky inside Three.js
Rejected CSS sky keeps the world canvas transparent and preserves the shared
canvas contract (`#game-canvas` WebGL ownership unchanged) with no scene-graph
sky cost.