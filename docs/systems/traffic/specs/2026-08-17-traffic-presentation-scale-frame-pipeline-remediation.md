# Traffic Presentation Scale & Frame Pipeline Remediation

Status: APPROVED FOR IMPLEMENTATION
Date: 2026-08-17
Scope: PR #79 only
Owner visual gate: FAIL / pending re-test

## Problem

Citizen Mobility and canonical Traffic correctness are already verified, but owner manual acceptance at 414×896 exposed two presentation release blockers:

1. Vehicle and Citizen visuals are out of scale with the rendered road. The basic road is 0.72 world units wide while the current vehicle body is 1.6 world units wide and 3.2 long, so the vehicle is wider than the road.
2. Motion at 4× remains visibly juddery. The current frame path still performs selection, headway derivation, Set/Map/array construction, route sampling allocations, and replay reconstruction while also updating transforms. Motion timing defaults to a synthetic `frameIndex * 16.667` clock rather than the real RAF timestamp.

Canonical Traffic/Mobility authority is not defective and must not be redesigned.

## Production architecture

```text
Canonical Traffic snapshot
        |
        | revision/camera-context change
        v
Traffic Presentation Reconciler
- spatial materialization / LOD
- stable visual identity
- deterministic headway/lateral targets
- prepared route cache
- motion target reconciliation
        |
        v
Prepared Presentation State
        |
        | every requestAnimationFrame(timestamp)
        v
Traffic Frame Sampler
- advance continuous visual distance
- sample prepared route into reusable vectors
- smooth heading
- set transform only
        |
        v
Pooled Three.js visuals
```

Simulation time remains canonical. Render time is presentation-only.

## Authority invariants

- Canonical Traffic progress, route, queue/order, lifecycle, persistence, and Citizen schedules remain unchanged.
- Presentation state may interpolate, visually separate, and briefly retain an arriving visual, but it never mutates canonical Traffic/Mobility state.
- 1×/2×/4× change how quickly canonical target time advances; they must not change the render clock cadence or cause target-reset snapping.
- No departure staggering, random jitter, reduced simulation speed, or canonical-progress clamping may be introduced to hide presentation defects.

## Visual scale contract

Traffic visual dimensions are centralized in `traffic-three` and derived from a supplied rendered-road width. `traffic-three` must not depend directly on `road-core`; the game adapter supplies `BASIC_ROAD_DEFINITION.width`.

Baseline for the current basic road (`0.72` world units):

- vehicle width ratio: 0.3333 → ~0.24 world units
- vehicle length ratio: 0.6944 → ~0.50 world units
- vehicle total height ratio: 0.2778 → ~0.20 world units
- pedestrian width ratio: 0.1111 → ~0.08 world units
- pedestrian depth ratio: 0.0833 → ~0.06 world units
- pedestrian total height ratio: 0.3333 → ~0.24 world units
- appearance size variation: bounded to ±5%

Acceptance invariants:

- vehicle width <= 40% of rendered road width
- vehicle length <= 85% of rendered road width
- pedestrian width < vehicle width / 2
- visual variants never violate those envelopes
- changing the game road width creates a proportionally scaled Traffic visual policy without changing Traffic authority

## Prepared route contract

A `PreparedTrafficRoute` stores:

- stable route segment references
- cumulative segment end distances
- total distance

Preparation occurs when a trip route is first reconciled or changes. Frame sampling uses an allocation-light API that writes into caller-owned `Vector3` state. Route total length and cumulative offsets are never recomputed per frame.

## Reconciliation contract

Heavy presentation work is revision/context-driven, not RAF-driven:

- spatial-index rebuild
- candidate query/materialization selection
- near/mid LOD decision
- same-edge headway/lateral placement
- stable trip binding/release decisions
- prepared-route creation
- canonical motion-target update

A camera-anchor change may request reconciliation even without a Traffic revision. Repeated render frames with unchanged Traffic revision and unchanged anchor must not rerun materialization/headway reconciliation.

## Frame contract

Every RAF frame receives the browser timestamp. The hot path may:

- advance existing motion state toward the latest target
- sample a prepared route into reusable vectors
- update heading/visual state if needed
- update object position/rotation
- advance bounded arrival/replay presentation state

The hot path must not:

- rebuild routes
- scan all logical Traffic trips
- rebuild the spatial index
- regroup/sort headway globally
- allocate appearance materials/geometries
- call `slice`, `map`, `filter`, or `reduce` over route history for each agent
- create a new presentation entity for an already-bound trip

## Motion contract

A snapshot change updates target distance; it does not restart the visual object or snap to the target. Motion keeps current presentation distance and heading as continuous state. The next RAF samples from that current state toward the latest target using real elapsed render time.

If a route identity changes because canonical recovery selected a new route, presentation performs a bounded route rebind; canonical state remains authoritative.

A two-snapshot render-delay buffer is an allowed fallback only if profiling after the hot-path remediation still shows cadence judder. It is not part of the initial implementation.

## Pool lifecycle contract

Pool lifecycle is split conceptually into:

- bind: identity, deterministic appearance, scale, static metadata; once per trip binding/reuse
- state update: queue/turn/LOD when source state changes
- frame transform: position/rotation only
- release: return to pool after dematerialization/bounded arrival

An existing bound trip must not re-run appearance/scale assignment every RAF.

## Journey replay contract

Departure replay keeps a prepared route and cumulative distances. RAF must not execute `slice(...).reduce(...)` or construct a new route-distance history each frame. Replay pool objects keep stable trip identity until the replay completes.

## Performance evidence

Existing 5,000 logical Traffic and 20,000-Citizen fixtures remain mandatory. Add presentation-specific instrumentation/test evidence proving:

- unchanged snapshot + unchanged camera does not increment reconciliation count on every RAF
- prepared-route count does not increase on repeated RAF frames for stable routes
- pool-created count is stable after warmup
- frame sampling can advance at synthetic 1×/2×/4× target cadence without canonical mutation

Absolute FPS is not hard-coded in CI because runner/device performance differs. Architectural budgets are the release gate.

## Verification

Focused RED/GREEN first, then:

1. `traffic-three` focused tests
2. game Traffic presentation/runtime tests
3. Traffic presentation performance fixture
4. existing 5,000 Traffic and 20,000-Citizen fixtures
5. `pnpm check`
6. Targeted Browser `@traffic` and `@building` only if affected integration still requires it
7. Sonar Quality Gate
8. clean worktree
9. owner re-test at 414×896 for 1×/2×/4× morning/evening commute

Full Browser is NOT REQUIRED unless Browser Verification Policy v0.2 Level-4 escalation is triggered.

## Release gate

PR #79 remains Open + Draft + Not merged. Automated success does not mark owner visual acceptance PASS. Stop after automated verification and hand the exact HEAD back for owner re-test.