# Camera and Input Design

- **Status:** FROZEN — OWNER APPROVED 2026-08-30
- **Owner:** `apps/game`
- **Scope:** Production camera state, desktop keyboard/mouse input, mobile touch input, motion smoothing, and semantic-pick arbitration

## Purpose

Provide one production camera/interaction path for desktop and touch without leaking DOM or Three.js details into gameplay systems. Camera state is presentation state only; it never becomes World or Terrain authority.

## System overview

```text
DOM Pointer / Wheel / Keyboard
            ↓
      Input normalization
       ┌────┴───────────────┐
       │                    │
       ▼                    ▼
GestureRecognizer       KeyboardState
(pure)                  (pure)
       │                    │
       │ direct             │ driven
       ▼                    ▼
CameraIntent       CameraMotionDriver
       │             velocity / damping
       │                    │
       └──────────┬─────────┘
                  ▼
           CameraReducer
               (pure)
                  ↓
             CameraState
                  ↓
             CameraPose
                  ↓
       Three PerspectiveCamera
                  │
                  └─ semantic tap → NDC → Raycaster → Terrain pick
```

The system intentionally separates **direct manipulation** from **driven motion**.

```text
Direct manipulation
mouse drag / touch drag / pinch / twist
→ immediate CameraIntent
→ no damping while the pointer is active

Driven motion
WASD / Q / E / wheel
→ target motion
→ frame-rate-independent smoothing
→ demand-driven animation frames
```

This keeps Terraform/Road placement precise while still making PC navigation feel smooth.

## Camera state

Plain immutable values only:

```text
targetX
targetY
targetZ
distance
azimuthRadians
elevationRadians
```

`reduceCityCamera(state, intent, constraints)` is deterministic and browser-free.

Camera pan intent is expressed in the camera-relative ground plane:

```text
rightMeters
forwardMeters
```

The reducer owns the conversion from those axes into World X/Z. Input code must not duplicate camera-basis math.

## Config ownership

`CITY_CAMERA_DEFAULT_CONFIG` owns map-derived camera framing and limits:

```text
initial/min/max distance factors
initial/min/max elevation
initial azimuth
target margin
```

`CITY_INPUT_DEFAULT_CONFIG` owns raw interaction sensitivity:

```text
tap threshold
pointer rotate sensitivity
wheel log-zoom impulse sensitivity
pointer pan scale
multi-touch epsilon
```

`CITY_CAMERA_MOTION_DEFAULT_CONFIG` owns driven-motion behavior:

```text
keyboard pan speed factor
keyboard rotation speed
Shift fast multiplier
acceleration response
deceleration response
wheel zoom response
maximum frame delta
sleep epsilons
maximum queued wheel zoom impulse
```

No map-size literal, keyboard speed, damping coefficient, or interaction threshold belongs in event handlers.

## Desktop mapping

```text
Primary click under threshold  → semantic Terrain tap
Primary drag                   → direct grab-pan
Secondary drag                 → direct rotate
Wheel                          → smooth zoom impulse
W                              → camera-relative forward
S                              → camera-relative backward
A                              → camera-relative left
D                              → camera-relative right
Q                              → rotate left
E                              → rotate right
Shift + movement/rotation      → fast modifier
Pointer cancel                 → cancel gesture, no pick
```

WASD planar input is normalized before speed is applied, so diagonal movement is not faster than cardinal movement.

Keyboard movement is camera-relative, not fixed to World X/Z. Rotating the camera changes the direction represented by W/A/S/D as expected for an RTS/city-builder camera.

## Keyboard lifecycle

Keyboard listeners are active only while the Live City input controller exists.

Camera keys are ignored while focus originates from editable content:

```text
input
textarea
select
contenteditable
```

Held-key state is cleared on:

```text
window blur
document hidden / visibilitychange
input-controller dispose
```

This prevents sticky movement when the user Alt-Tabs, changes browser visibility, or leaves the city while a key is held.

Key repeat does not duplicate held-key state or accumulate extra motion impulses.

## Motion smoothing

Keyboard and wheel motion are frame-rate independent.

Velocity approaches a target with exponential response:

```text
v(t + dt) = target + (v(t) - target) * exp(-response * dt)
```

Displacement uses the analytical integral of that exponential over the frame, rather than Euler stepping. Therefore equivalent elapsed time at 60 Hz and 120 Hz produces equivalent camera travel within numeric tolerance.

When a movement key is released:

```text
target velocity → 0
current velocity → decays smoothly
velocity < sleep epsilon → exactly 0
```

Wheel zoom is represented as a queued logarithmic distance impulse. Each animation frame consumes part of the remaining log impulse using exponential damping. The final frame consumes the residual before sleeping, so no queued zoom magnitude is silently lost.

## Demand-driven animation

Camera motion does not run a permanent `requestAnimationFrame` loop.

```text
keyboard down / wheel
        ↓
wake motion loop
        ↓
step while input or residual velocity exists
        ↓
all motion below epsilon
        ↓
stop requesting frames
```

A second wake while a frame is already scheduled does not create another RAF chain.

Dispose cancels the pending frame and prevents future callbacks.

## Direct manipulation contract

Pointer and touch gestures intentionally bypass the motion damping layer while active:

```text
primary mouse drag
one-finger touch drag
two-finger centroid pan
pinch zoom
touch twist
secondary mouse rotate
```

This avoids the camera lagging behind the pointer and preserves precise placement interaction.

A future optional release-inertia feature must remain separate from active direct manipulation and must not interfere with tool commit/tap arbitration.

## Pan direction invariant

Pan uses grab/map-drag semantics: projected world content follows the pointer.

DOM client coordinates:

```text
+X = right
+Y = down
```

Normalized screen-pan mapping:

```text
rightMeters   = -screenDeltaX * metersPerPixel
forwardMeters = +screenDeltaY * metersPerPixel
```

Do not symmetrically negate both axes. With a pitched camera, doing so makes vertical pan run opposite the pointer while horizontal pan still appears correct.

Single-pointer pan and two-pointer centroid pan share this mapping owner.

## Touch mapping

```text
one pointer under threshold → semantic tap
one pointer drag            → direct pan
two pointers centroid delta → direct pan
two pointers distance ratio → direct zoom
two pointers angle delta    → direct rotate
```

Two-pointer takeover cancels any pending single-pointer tap.

Touch remains direct/precise even though PC keyboard and wheel use smoothing.

## Browser integration

Interactive viewport uses `touch-action: none`.

Pointer listeners attach to the viewport. Active pointers use pointer capture and are released on up, cancel, or dispose.

Keyboard listeners attach to the live browser keyboard target and are removed on dispose. Visibility lifecycle is owned by the input controller.

The imperative handler performs only routing:

```text
DOM event
→ normalize/update input state
→ direct CameraIntent OR driven-motion input OR semantic tap
```

Camera math, smoothing math, and gesture recognition live in pure modules.

## Camera/Terrain relationship

Camera target Y may be updated from an authoritative Terrain pick as a presentation convenience. Camera state is not stored in CitySave v1 and cannot mutate Terrain.

## Picking contract

Raw DOM client coordinates convert through current viewport bounds to NDC. The Three.js Raycaster supplies candidate X/Z only. Terrain is queried again for authoritative height, slope, triangle identity, and revision. Raw Raycaster Y is discarded.

Camera gesture and semantic pick are mutually exclusive for one gesture sequence.

## Disposal

Disposal is idempotent and performs all of the following:

```text
remove pointer listeners
remove wheel listener
remove keyboard listeners
remove visibility listener
release active pointer capture
clear gesture state
clear held keyboard state
cancel demand RAF
clear residual camera motion
restore previous touch-action
```

No camera callback may continue after disposal.

## Tests

Pure/unit coverage:

```text
camera reducer determinism
camera-relative cardinal pan basis
map target clamps
pitch/distance clamps
W/A/S/D mapping
W+D diagonal normalization
Q/E opposite rotation
Shift fast modifier
keyboard acceleration/deceleration
60 Hz vs 120 Hz motion equivalence
wheel residual preservation
demand RAF wake/sleep/dispose
editable-target keyboard ignore
blur/visibility sticky-key prevention
pointer tap-vs-drag arbitration
two-pointer takeover
pinch/twist math
pointer cancel
semantic pick authority
```

Browser acceptance:

```text
mouse pan direction
mobile pan direction
two-finger centroid direction
W keyboard movement
Q/E rotation
post-key release deceleration
wheel changes distance asynchronously through smoothing
pointer/touch picking remains functional
Live City mobile layout remains valid
```

## Maintenance invariants

```text
CameraState is presentation state, never gameplay authority.
CameraReducer stays pure and browser-free.
GestureRecognizer stays pure.
KeyboardState stays immutable and pure.
Motion smoothing stays delta-time based.
Direct pointer/touch manipulation stays undamped while active.
Only driven motion owns demand RAF.
No permanent camera animation loop.
No raw speed/damping literals in DOM handlers.
No duplicate screen-pan sign mapping.
No keyboard listener survives Live City disposal.
```
