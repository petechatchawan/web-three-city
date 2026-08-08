# ADR — Mobile-First Dialog-Based City Presentation

**Status:** Accepted

**Date:** 2026-08-09

## Context

The existing gameplay presentation accumulated status, Economy, controls, Save/Load, camera/view settings, and system details inside a permanent left-side panel. That pattern consumes too much world space on mobile and encourages unrelated systems to share one presentation surface.

The game is a world-centric city builder. Detailed management should be available without making a dashboard the primary screen. The codebase already uses Vanilla TypeScript/native DOM and keeps domain authority outside presentation.

## Decision

Adopt a mobile-first, landscape-first, dialog-based City UI architecture.

- The 3D world is the primary screen.
- Persistent UI is limited to compact HUD, bottom build dock, simulation controls, and small top-level actions.
- System management and player inspection use one primary `DialogHost` with one active dialog and an internal navigation stack.
- Primary dialogs block world pointer input but never pause or otherwise mutate simulation state.
- Tool configuration uses a separate non-modal contextual surface so placement remains interactive.
- Default Navigate mode owns inspection; active build tools own world taps while selected.
- Player inspect and Developer inspect are separate presentation contracts.
- Vanilla TypeScript + native DOM/CSS remains the runtime technology, with an internal component/lifecycle layer instead of a general UI framework.
- Cities: Skylines may inform information architecture and interaction patterns, but its visual design/assets are not copied.

## Consequences

### Positive

- More world space on mobile.
- Clear system boundaries in presentation.
- Deterministic Back/Close/input behavior.
- Existing simulation and domain architecture remain authoritative.
- Inspect and future Information Views have explicit extension seams.
- Avoids adding a framework runtime solely for UI composition.

### Costs

- A small internal UI component/dialog lifecycle layer must be built and tested.
- Existing sidebar presentation must be migrated and then removed.
- Dialog content must use explicit projections rather than reading arbitrary domain state directly.
- Responsive/mobile browser acceptance becomes a first-class verification requirement.

## Rejected alternatives

### Keep extending the permanent sidebar

Rejected because it does not scale to mobile, mixes unrelated responsibilities, and progressively hides the world.

### Introduce React/Vue/Svelte now

Rejected for v0.1 because current requirements do not justify the additional runtime, state integration, and migration surface. This decision can be superseded later if UI complexity demonstrates a concrete need.

### Stack multiple modal dialogs

Rejected for v0.1. One primary dialog plus internal navigation provides clearer mobile Back behavior and fewer input/focus edge cases.
