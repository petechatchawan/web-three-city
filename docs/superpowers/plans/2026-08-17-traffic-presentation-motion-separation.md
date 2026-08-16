# Traffic Presentation Motion & Spatial Separation

## Goal

Make rendered Traffic vehicles readable and continuous at 1x, 2x, and 4x without changing canonical Traffic/Mobility authority.

## Root cause

The existing presentation pool keeps a trip-keyed object, but it assigns the raw canonical edge progress whenever a materialized update is due. Between logical ticks the target is static, and at the next tick the mesh jumps directly to the new target. Mid-LOD cadence makes the jump larger. Turn orientation is also derived from the next edge only at the turn threshold, so the heading changes abruptly.

## Implementation

1. Add focused tests for route-polyline sampling, tangent heading, stable trip-to-vehicle identity, frame interpolation, deterministic headway, and canonical snapshot immutability.
2. Add reusable traffic-three route motion helpers that sample distance along a polyline and derive tangent orientation.
3. Extend the game presentation projection with the complete route polyline and authoritative route distance for each agent.
4. Keep per-trip presentation motion state in `TrafficPresentation`; interpolate targets using the real render timestamp and update existing pooled transforms every frame.
5. Keep deterministic same-edge headway visual-only and bounded; preserve canonical progress and existing materialization caps.
6. Add bounded presentation retention for arrival cleanup and update the Traffic living documentation with the authority invariant.

## Verification

- Focused traffic-three and game presentation tests (RED, then GREEN)
- Affected package tests and typechecks
- `pnpm check`
- Targeted Browser `@traffic` (add `@building` only if the changed path requires it)
- Traffic performance fixtures (5,000 trips and 20,000 citizens)
- Exact-head clean worktree and Sonar evidence
- Stop at owner manual visual re-test; do not mark the manual gate or merge PR #79.
