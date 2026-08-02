# Operation-Aware Road Preview, Release Reliability, and Camera Pan Design

**Status:** Approved
**Baseline:** `master@9f676de293d863360944284b2d23a9265c65cbf4`
**Scope:** Road Build/Bulldoze feedback, pointer release semantics, and screen-relative camera pan.

## Problem Statement

Three interaction defects remain after Road reversible-stroke work:

1. Valid Bulldoze Preview is not visually distinct enough from committed Road geometry.
2. A valid Road stroke can be cancelled when pointer-up lands outside the pickable Terrain even though a valid Preview was already established.
3. Camera pan direction can reverse after yaw rotation because screen deltas are projected through an incorrect yaw basis.

## Product Contract

### Operation-aware Road Preview

Road Preview styling is determined by both operation and validity:

- valid Build: green translucent surface with a visible outline;
- invalid Build: red translucent surface plus invalid marker and reason;
- valid Bulldoze: orange-red translucent removal surface plus a visible removal marker/outline;
- invalid Bulldoze/no-change: dark red translucent surface plus invalid marker and reason.

Only the active mutation footprint receives Preview styling. Committed Roads outside that footprint remain committed gray.

### Reliable release semantics

A Road session captures its latest planned state. Pointer release behaves as follows:

- if release picks a Terrain cell, update the trace to that cell and finalize the resulting plan;
- if release is outside pickable Terrain but a latest plan exists, finalize that latest plan;
- if the latest plan is valid, commit it;
- if the latest plan is invalid, reject it and preserve the invalid reason;
- `pointercancel`, Escape, blur, second-touch transfer, context loss, and explicit session clearing still cancel without commit.

Pointer capture remains best-effort. Release reliability must not depend on pointer-up remaining inside the Terrain mesh.

### Explicit Road HUD states

The Road HUD must distinguish:

- `Valid build`
- `Invalid build`
- `Valid bulldoze`
- `Invalid bulldoze`

The status detail continues to expose the current invalid reason or release instruction. Requested and Effective counts remain live.

### Screen-relative camera pan

Pan uses the camera's actual horizontal screen basis:

- dragging right always moves the world visually right on screen;
- dragging left always moves the world visually left;
- dragging up always moves the world visually up;
- dragging down always moves the world visually down;
- behavior is continuous for arbitrary yaw and does not flip at quadrant boundaries.

The basis is derived from the camera orientation projected onto the XZ plane, rather than a hand-written sine/cosine mapping tied to one default yaw.

## Architecture

### Road material contract

`RoadMaterials` gains operation-specific Preview materials:

- `buildValidPreview`
- `buildInvalidPreview`
- `bulldozeValidPreview`
- `bulldozeInvalidPreview`
- `invalidMarker`
- `bulldozeMarker`

`RoadPreviewPresentation.show()` selects material and marker from `plan.operation` and `plan.valid`. Geometry ownership remains cell-scoped as established by PR #15.

### Road release contract

`RoadStrokeController.end()` accepts an optional release cell. When absent, it finalizes the existing session plan without mutating the trace. `GameInput` passes `null` when Terrain picking fails on pointer-up instead of cancelling the session.

### Camera basis contract

`CameraInteractionController.panScreen()` derives normalized right and up vectors from the camera world matrix, projects them onto XZ, and converts screen-pixel deltas into world-space target deltas. Tests assert projected screen motion rather than hard-coding quadrant-specific world signs.

## Error Handling

- Empty or never-planned Road sessions return `null` and do not announce a transaction.
- Invalid finalized plans are surfaced to the existing reject/status path and never committed.
- Degenerate camera basis vectors are ignored instead of producing non-finite pan values.
- Existing stale-plan, revision, Road/Water/Terrain, undo, and save/load guards remain unchanged.

## Verification

### Unit and composition

- valid Build and valid Bulldoze use different materials and marker contracts;
- invalid Build and invalid Bulldoze remain visibly red and expose invalid markers;
- release outside Terrain finalizes the latest valid plan;
- release outside Terrain finalizes the latest invalid plan without commit;
- pointercancel and lost capture still cancel;
- pan direction remains screen-relative at 45°, 135°, 225°, 315°, and non-quarter yaw values.

### Browser/WebGL

- valid Build Preview is visibly green and commits after release outside Terrain;
- invalid Build Preview is visibly red and does not mutate the Road snapshot;
- valid Bulldoze Preview is visibly orange-red and removes only the active footprint;
- camera pan remains visually consistent after rotate-left and rotate-right across all quadrants;
- complete Lean CI and full Chromium/WebGL suite pass on one exact `master` head.

## Non-goals

- Road cost/economy;
- new Road types;
- camera inertia;
- redesigning pointer ownership;
- changing Terraform release semantics;
- replacing the existing Road transaction or save/undo architecture.
