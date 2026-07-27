# Prototype Interaction Completion v0.1 — Design Specification

**Status:** Proposed for written-spec review  
**Milestone:** Prototype Interaction Completion v0.1  
**Repository:** `petechatchawan/web-three-city`  
**Base:** `master@eee78ca32bd83f172970931e3b2cd97b6527290c`  
**Owner design approval:** 2026-07-28  
**Next milestone:** Web Water & Shoreline Foundation v0.1

## 1. Purpose

Web Terrain Foundation v0.1 proved deterministic terrain generation, chunk meshing, seam-safe normals, Three.js presentation, browser builds, and basic camera-state contracts. The current Game shell still exposes only button-driven quarter-turn rotation, quality selection, and save/load. Existing gesture and camera packages are not yet wired into the product shell, the initial orthographic framing allows the map to dominate the viewport, and terrain selection has no visible product-facing feedback.

This milestone completes the prototype interaction layer before Water & Shoreline work begins. It ports the accepted Unity camera vocabulary into the browser without importing Unity production code or third-party camera assets.

The required product result is a directly manipulable terrain viewer that works with mouse, trackpad, and multi-touch:

- one-finger or primary-pointer drag pans;
- two-finger pinch zooms around the terrain point under the gesture centroid;
- two-finger twist rotates yaw continuously;
- two-finger parallel vertical drag tilts pitch;
- tap or click selects a terrain cell;
- wheel zoom is supported on desktop;
- Reset Camera restores the canonical fitted view;
- selected-cell and optional grid overlays remain presentation-only;
- the whole terrain is initially framed inside the usable viewport rather than overflowing it.

This milestone does not add gameplay mutation, Terraform, Water, Roads, buildings, inertia, perspective projection, or object selection.

## 2. Normative provenance

The browser behavior is derived from the accepted Unity camera specification, not from a new interaction design:

```text
Repository: petechatchawan/cityBuilder
Commit: 19b29e32cb24ed7535fc08aafbd6a7ffe6b1daeb
Specification: docs/superpowers/specs/2026-07-24-camera-interaction-ux-v0-2-design.md
```

Normative Unity vocabulary:

| Input | Behavior |
|---|---|
| One-finger tap | Terrain tile selection |
| One-finger drag | Pan |
| Two-finger pinch | Anchored zoom |
| Two-finger twist | Anchored yaw rotation |
| Two-finger parallel vertical drag | Tilt |
| Deliberate combined gesture | Dominant axis plus qualified secondary axes |

Additional retained Unity policies:

- upward two-finger centroid motion increases pitch toward top-down;
- downward motion decreases pitch toward the horizon;
- map bounds have priority over anchor preservation;
- contact transitions and cancellation must not synthesize a terrain pick;
- camera pose/state authority is separate from gesture classification;
- no pan, zoom, rotate, or tilt inertia is added in this milestone;
- design pitch defaults to `35°–65°` inside an absolute `20°–80°` safety envelope.

Only behavior contracts and authored values are transcribed. Unity source code, scene assets, serialized data, and implementation structure are not copied.

## 3. Scope

### 3.1 Included

1. Product-shell binding for pointer, wheel, keyboard, and touch gestures.
2. Continuous yaw and bounded pitch camera state.
3. Anchored zoom, yaw, and tilt around the terrain point under the two-finger centroid when a terrain hit exists.
4. One-finger/primary-pointer pan with tap-versus-drag arbitration.
5. Terrain-cell selection and a visible selected-cell overlay.
6. Optional whole-map grid overlay with a user-facing toggle.
7. Reset Camera control and keyboard reset.
8. Correct initial and reset framing for desktop, tablet, and mobile viewports.
9. Responsive control panel that does not permanently consume the primary interaction area on small screens.
10. Unit, browser, gesture-transition, visual, and performance regression tests.

### 3.2 Explicitly excluded

- Water, shoreline, waves, hydrology, or water materials;
- Raise, Lower, Flatten, Undo, or any terrain mutation;
- pan/zoom/yaw/pitch inertia or fling;
- edge auto-pan or desktop edge scroll;
- gamepad or console mappings;
- perspective camera support;
- buildings or generic object selection;
- adaptive gesture thresholds;
- replacement of the canonical input architecture with OrbitControls or a third-party camera library;
- direct mutation of Terrain geometry for selection or grid display.

## 4. Architectural approach

Three approaches were considered:

### A. Bind the existing browser camera and gesture packages — selected

Extend `OrthographicCameraRig` from quarter-turn-only yaw/fixed pitch to full canonical state, then bind the existing `GestureController` through a product-shell interaction adapter. Add separate selection/grid presentation overlays.

Advantages:

- preserves package boundaries already established in Web Terrain Foundation v0.1;
- reuses tested pointer normalization;
- keeps Three.js and DOM concerns out of core terrain packages;
- maps directly to the Unity separation of gesture classification, camera state, and terrain picking;
- creates the correct interaction foundation for Water and Terraform.

### B. Adopt Three.js OrbitControls

Rejected because OrbitControls owns a different gesture vocabulary, mixes camera policy with input handling, and would require disabling or overriding behavior for terrain picking, fixed bounds, mobile tool ownership, and future Terraform.

### C. Implement interactions directly in `apps/game/src/main.ts`

Rejected because it would further enlarge the product composition file, duplicate logic already present in `camera-input`, and make Terrain Lab and future gameplay tools diverge.

## 5. Package responsibilities

### 5.1 `packages/camera-input`

Owns platform-neutral camera state and normalized gesture semantics while depending on Three.js only for camera projection and ray construction.

New or revised responsibilities:

- canonical `CameraState`;
- camera limits and fitted-view computation;
- pan conversion from screen delta to world-space pivot movement;
- continuous yaw and pitch application;
- terrain-anchor correction after zoom/yaw/pitch;
- pointer-session arbitration and suppression;
- product-facing input binding helper that can be disposed cleanly.

It does not own TerrainMap, rendering materials, selection meshes, grid meshes, UI state, or save data.

### 5.2 `packages/terrain-three`

Owns product-facing presentation overlays that derive from terrain/world contracts:

- `SelectedCellPresentation`;
- `TerrainGridPresentation`;
- overlay lifecycle and disposal;
- selected-cell geometry projected slightly above the terrain surface;
- grid rendering that remains independent of terrain geometry rebuilds.

It does not mutate TerrainMap or terrain chunk buffers.

### 5.3 `apps/game`

Acts as composition root:

- creates camera, renderer, terrain presentation, picker, overlays, and UI controls;
- connects semantic gesture events to camera commands and selection;
- blocks world input while a pointer starts over interactive UI;
- stores only user-facing view preferences that are explicitly persisted;
- handles resize, context loss/restoration, and teardown.

The existing monolithic `main.ts` should be split narrowly where required:

```text
apps/game/src/
  main.ts
  game-bootstrap.ts
  game-input.ts
  game-ui.ts
  style.css
```

This is targeted extraction only; no framework is introduced.

## 6. Canonical camera state

The current browser state:

```ts
interface CameraState {
  targetX: number;
  targetZ: number;
  yawQuarterTurns: 0 | 1 | 2 | 3;
  pitchDegrees: 55;
  zoom: number;
}
```

is replaced with:

```ts
interface CameraState {
  readonly targetX: number;
  readonly targetZ: number;
  readonly yawDegrees: number;
  readonly pitchDegrees: number;
  readonly orthographicSize: number;
}
```

Locked defaults and limits:

```ts
const CAMERA_DEFAULTS = {
  yawDegrees: 45,
  pitchDegrees: 50,
  minimumPitchDegrees: 35,
  maximumPitchDegrees: 65,
  hardMinimumPitchDegrees: 20,
  hardMaximumPitchDegrees: 80,
  minimumOrthographicSize: 18,
  maximumOrthographicSize: 170,
} as const;
```

Policy:

- `yawDegrees` is normalized into `[0, 360)`;
- touch twist modifies yaw continuously;
- Rotate left/right buttons and `Q/E` add exact `-90°/+90°` steps;
- pitch is clamped to the configured design range, which itself must lie inside the hard safety envelope;
- Reset restores default yaw/pitch and recomputes fitted orthographic size for the current viewport;
- camera state must remain serializable and inspectable without reading Three.js internals.

## 7. Viewport framing

### 7.1 Problem

The current vertical span is derived only from maximum map dimension. At a `45°` yaw and elevated pitch, projected terrain corners extend beyond the intended viewport, and the left-side panel further reduces the usable visual area. The result is the map appearing oversized and cropped.

### 7.2 Required fitted-view algorithm

`fitToWorld(viewport)` must calculate an orthographic size that contains all eight relevant world-space bounds corners:

- four terrain perimeter corners at minimum terrain Y;
- four perimeter corners at maximum supported terrain Y;
- outer diorama base depth where it affects projected vertical extent.

Algorithm:

1. Resolve the usable viewport rectangle after UI safe-area insets.
2. Build the candidate camera orientation from target, yaw, and pitch.
3. Transform world bounds corners into camera-local coordinates.
4. Find camera-local horizontal and vertical extents.
5. Convert extents to the required orthographic half-height using the usable aspect ratio.
6. Apply a fixed `8%` framing margin.
7. Clamp to configured zoom limits.
8. Reapply projection and camera pose atomically.

The initial view and Reset Camera must use this algorithm. Normal viewport resize preserves the user's target, yaw, pitch, and relative zoom where possible; it must not reset the camera unexpectedly. When a resized viewport can no longer contain the current view safely, the orthographic size is increased only enough to maintain valid framing.

### 7.3 UI safe area

Desktop/tablet:

- reserve the visible panel rectangle plus `16 px` gap from the usable camera framing area.

Mobile portrait:

- controls become a compact top sheet or collapsible panel;
- fitted view uses the canvas area not permanently covered by the compact controls;
- browser safe-area insets use `env(safe-area-inset-*)`.

## 8. Pan

### 8.1 Input

- one active primary pointer may become either Tap or Pan;
- pan begins only after movement exceeds `8 CSS px` tap slop;
- mouse primary-button drag and one-finger drag use the same semantic path;
- pointer capture is acquired on accepted world pointer-down;
- pointer-down that starts inside an interactive UI element never enters a world gesture session.

### 8.2 Screen-to-world mapping

Pan must use camera-relative world axes, not raw world X/Z:

1. derive camera-right projected onto the XZ plane;
2. derive camera-forward projected onto the XZ plane;
3. convert screen pixels using current orthographic world-units-per-pixel;
4. move the target opposite the drag direction, preserving direct-manipulation feel;
5. clamp target through world bounds.

No mutation of camera position occurs outside the rig's canonical state path.

## 9. Two-finger gestures

### 9.1 Session ownership

The first valid two-pointer pair owns the gesture until either pointer releases or cancels. A third pointer suppresses the world gesture session until all contacts release. Pointer-ID changes do not silently substitute a new pair mid-session.

### 9.2 Anchoring

At the start of a two-finger gesture:

1. calculate the screen centroid;
2. raycast terrain and store the terrain world point under the centroid when available;
3. store baseline distance, angle, centroid, yaw, pitch, orthographic size, and target.

After applying zoom/yaw/pitch for a frame:

1. raycast the same centroid again;
2. compare the new terrain point against the stored anchor;
3. offset target on XZ to preserve the original terrain point;
4. clamp target to map bounds;
5. if a terrain ray cannot be resolved, retain the bounded camera operation without anchoring.

### 9.3 Dominant-aware classification

The Web implementation retains the Unity vocabulary but may use a simpler deterministic classifier suitable for the current prototype. It must still avoid accidental cross-axis motion.

Locked rules:

- pinch score derives from logarithmic distance change;
- yaw score derives from normalized angle change;
- pitch score derives from parallel vertical centroid movement after subtracting translation noise;
- activation requires a threshold and two consecutive qualifying frames;
- priority for exact score ties is `Pinch > Yaw > Pitch`;
- the dominant axis receives full sensitivity;
- a secondary axis is applied at quarter scale only when it exceeds its independent qualification threshold;
- parallel centroid movement still contributes pan when it is not consumed as dominant pitch;
- transition from one pointer to two pointers resets baselines without emitting a delta on the transition frame.

No learned or adaptive thresholds are permitted.

## 10. Zoom and tilt

### 10.1 Zoom

- wheel and pinch modify `orthographicSize` through the same rig command;
- decreasing orthographic size zooms in;
- wheel input uses an exponential scale so trackpads and mouse wheels remain stable;
- zoom clamps to configured limits;
- pinch uses terrain anchoring;
- wheel zoom anchors around the pointer location when terrain picking succeeds, otherwise it zooms around the current target.

### 10.2 Tilt

- two-finger parallel upward movement increases pitch;
- downward movement decreases pitch;
- pitch clamps to `35°–65°` by default;
- pitch changes use terrain anchoring at the two-finger centroid;
- no desktop mouse binding for free pitch is added in this milestone;
- Reset restores `50°`.

## 11. Terrain selection

### 11.1 Selection semantics

- a selection is emitted only from an eligible Tap release;
- drag, multi-touch, pointer cancellation, UI-origin sessions, and context-loss interruption cannot emit a selection;
- selection remains Terrain-cell-only;
- selecting outside terrain clears selection only when the pointer event is an eligible world tap;
- camera operations do not change the selected cell.

### 11.2 Selected-cell presentation

`SelectedCellPresentation` owns a separate overlay mesh:

- four corner positions are sampled from the authoritative shared height lattice;
- the overlay follows the exact accepted terrain diagonal for the selected cell;
- it renders `0.02` world units above the terrain surface;
- it uses a translucent fill plus a readable border;
- it does not write to depth or geometry buffers in a way that causes z-fighting;
- it is rebuilt only when selection or terrain revision changes;
- it is hidden when no cell is selected;
- disposal is idempotent.

The overlay is presentation-only and is excluded from save data.

## 12. Grid overlay

### 12.1 Product behavior

The Game shell gains a `Grid` toggle. Default state is `Off` for the product shell and `On` for Terrain Lab.

### 12.2 Geometry

The grid must conform to terrain height rather than remain a flat `THREE.GridHelper` at Y=0:

- generate line segments from authoritative lattice edges;
- place each endpoint at terrain height plus `0.015` world units;
- partition grid geometry by terrain chunk so future dirty rebuilds can update only affected chunks;
- use transparent, depth-tested lines with no interior vertical connectors;
- grid seams between chunks must share identical endpoint positions;
- toggling visibility must not rebuild terrain meshes.

For this milestone, full grid geometry may be built once on snapshot load because terrain is immutable. The chunked contract is still required for Terraform readiness.

## 13. UI controls

Required controls:

- Save terrain;
- Load terrain;
- Rotate left;
- Rotate right;
- Reset camera;
- Grid toggle;
- Quality selection;
- visible status;
- visible selected-cell coordinate when selection exists.

Keyboard:

- `Q`: rotate left `90°`;
- `E`: rotate right `90°`;
- `Home`: Reset Camera;
- keyboard shortcuts are ignored while focus is inside form controls.

The UI panel must stop propagation only for its own interactions; it must not globally disable browser accessibility or keyboard focus.

## 14. Error handling and lifecycle

- invalid camera limits fail fast during construction/configuration;
- non-finite gesture values are ignored and reset the affected baseline;
- pointer cancellation clears the session without synthetic selection;
- context loss clears active pointers and pauses rendering;
- context restoration rebuilds Terrain, grid, and selection presentations from authoritative snapshots and current UI state;
- resize with zero-size canvas is deferred until a non-zero viewport exists;
- failed anchor picking degrades to unanchored bounded camera movement;
- all event listeners, pointer captures, overlays, geometries, and materials are disposed on page hide;
- repeated disposal is safe.

## 15. Testing design

### 15.1 Unit tests

`camera-input` tests cover:

- default state and exact limit values;
- continuous yaw normalization;
- `±90°` button/keyboard steps;
- pitch hard/design clamping;
- fit-to-world across desktop landscape, tablet, mobile portrait, and ultrawide aspects;
- UI inset-aware framing;
- pan direction at four representative yaw angles;
- zoom clamping and anchor correction;
- two-finger baseline reset;
- pinch/yaw/pitch dominant classification;
- tie priority `Pinch > Yaw > Pitch`;
- qualified quarter-scale secondary axes;
- third-contact suppression;
- cancellation and no synthetic tap;
- wheel anchoring.

`terrain-three` tests cover:

- selected overlay uses authoritative heights and accepted diagonal;
- selected overlay offset and lifecycle;
- terrain-conforming grid positions;
- seam-identical grid endpoints;
- grid visibility without Terrain rebuild;
- idempotent disposal.

### 15.2 Browser tests

Chromium Playwright scenarios:

1. initial desktop viewport contains the complete map with margin;
2. mobile portrait viewport contains the complete map and compact controls;
3. primary drag pans and does not select;
4. eligible tap selects and shows overlay/coordinate;
5. wheel zoom changes view around the pointer;
6. synthetic two-pointer pinch changes zoom without selecting;
7. synthetic two-pointer twist changes continuous yaw;
8. synthetic parallel vertical drag changes pitch;
9. Reset Camera restores fitted state;
10. Grid toggle changes overlay visibility only;
11. resize preserves usable framing;
12. pointer cancel and third-contact suppression do not select;
13. context restore rebuilds terrain, grid visibility, and selection;
14. no uncaught browser error or leaked active pointer session.

WebKit/mobile-Safari certification is not claimed until a physical-device or supported browser-runner gate is available. Touch behavior must nevertheless use standards-based Pointer Events and avoid browser-specific APIs.

### 15.3 Visual evidence

Required screenshots:

```text
interaction-desktop-initial-fit.png
interaction-mobile-portrait-initial-fit.png
interaction-grid-on.png
interaction-selected-cell.png
interaction-pan-result.png
interaction-zoom-in.png
interaction-yaw-continuous.png
interaction-pitch-top-down.png
interaction-pitch-horizon.png
interaction-reset.png
```

A short browser trace or video should demonstrate pan, pinch, twist, tilt, selection, grid toggle, and reset.

## 16. Performance and allocation constraints

- steady-state render loop adds no per-frame geometry allocation;
- pointer move processing avoids constructing Three.js scene objects;
- selection rebuild allocates only on selection change;
- grid geometry allocates only on snapshot load or future dirty rebuild;
- initial framing computation is O(number of bounds corners), not O(map cells);
- anchor raycasts query existing chunk meshes and do not rebuild geometry;
- interaction processing target is under `1 ms` median per pointer frame on the CI desktop browser;
- no hard mobile performance gate is introduced until physical-device evidence exists.

## 17. Delivery and review boundaries

The milestone is delivered as a dedicated implementation PR based on the accepted specification and TDD plan. It must remain separate from Water & Shoreline work.

Sequence:

```text
Accepted written specification
→ detailed TDD implementation plan
→ implementation Draft PR
→ RED/GREEN checkpoints
→ browser and visual evidence
→ owner physical-feel review
→ merge
→ begin Web Water & Shoreline Foundation v0.1 design/specification
```

The interaction PR must not silently include water packages, water materials, shoreline fixtures, or hydrology contracts.

## 18. Definition of Done

1. Initial desktop and mobile views contain the full map with an `8%` margin in the usable viewport.
2. One-finger/primary drag pans with camera-relative world movement.
3. Eligible tap/click selects exactly one Terrain cell and displays a correct overlay.
4. Wheel and two-finger pinch zoom within limits.
5. Two-finger twist rotates yaw continuously.
6. Two-finger parallel vertical drag changes pitch within `35°–65°`.
7. Two-finger zoom/yaw/pitch preserves the Terrain point under the centroid best-effort.
8. Map bounds override anchoring without camera escape.
9. Contact transitions, cancellation, UI-origin input, and third-contact sessions produce no synthetic selection.
10. Rotate buttons and `Q/E` apply exact `90°` yaw steps.
11. Reset Camera restores default target, yaw `45°`, pitch `50°`, and fitted orthographic size.
12. Grid toggle shows a terrain-conforming, seam-safe overlay without rebuilding Terrain.
13. Selection and grid presentations survive WebGL context restoration.
14. Unit, typecheck, lint, build, browser, and visual-evidence gates pass from a frozen lockfile.
15. Owner approves physical interaction feel before merge.
16. No Water, Terraform, Roads, Buildings, inertia, perspective mode, or third-party camera dependency is included.
