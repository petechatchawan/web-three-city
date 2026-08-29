# Camera and Input Design

- **Status:** FROZEN — OWNER APPROVED 2026-08-30
- **Owner:** `apps/game`

## Purpose

Provide one production camera/interaction path for desktop mouse and mobile touch without leaking DOM/Three.js details into gameplay systems.

## Architecture

```text
DOM Pointer/Wheel events
        ↓
PointerTracker
        ↓
GestureRecognizer (pure state transitions)
        ↓
InteractionRouter
     ┌──┴─────────┐
     ▼            ▼
CameraIntent   SemanticTap
     │            │
     ▼            ▼
CameraReducer   pointerToNdc
     │            │
     ▼            ▼
CameraState     Raycaster
     │            │
     ▼            ▼
ThreeCamera    Terrain semantic pick
```

## Camera state

Plain immutable values only:

```text
targetX/Y/Z
distance
azimuthRadians
elevationRadians
```

`reduceCityCamera(state,intent,constraints)` is deterministic and browser-free.

## Config ownership

`CITY_CAMERA_DEFAULT_CONFIG` owns camera product factors/limits. `createCityCameraConstraints(mapDefinition, config)` derives concrete meter bounds from the active map. No map-size literals appear in event handlers.

`CITY_INPUT_DEFAULT_CONFIG` owns tap threshold, rotation sensitivity, zoom sensitivity and gesture epsilon values.

## Desktop mapping

```text
primary pointer down/up under threshold -> semantic tap
primary drag                           -> pan
secondary drag                         -> rotate
wheel                                  -> zoom
pointercancel                          -> cancel gesture, no pick
```

## Touch mapping

```text
one pointer under threshold -> tap
one pointer drag            -> pan
two pointers centroid delta -> pan
two pointers distance ratio -> zoom
two pointers angle delta    -> rotate
```

Two-pointer takeover cancels any pending single-pointer tap.

## Browser integration

Interactive viewport uses `touch-action: none`. Event handlers attach to the viewport only. Active pointers are captured with `setPointerCapture` and always released on up/cancel/dispose when still captured.

The handler performs minimal work: normalize event -> update gesture state -> emit camera/pick intent -> request render.

## Camera/Terrain relationship

Camera target Y may be updated from an authoritative Terrain pick; it is presentation convenience only. Camera state is not saved in CitySave v1 and does not modify Terrain.

## Picking contract

Raw DOM client coordinates convert through current viewport bounds to NDC. The Three.js Raycaster supplies candidate X/Z. Terrain re-query supplies height/slope/triangle/revision. Raw Raycaster Y is discarded.

## Disposal

Disposal removes every event listener, releases any active pointer capture safely, clears active gesture state, and stops future callbacks. It is idempotent.

## Tests

```text
camera pan/rotate/zoom reducer determinism
map-bound target clamps
min/max pitch/distance clamps
click under threshold emits tap
primary drag emits pan and no tap
secondary drag emits rotate
two-pointer takeover cancels tap
pinch zoom math
twist rotation math
pointercancel resets state
viewport NDC conversion corners/center
semantic pick Y comes from Terrain
idempotent dispose
```
