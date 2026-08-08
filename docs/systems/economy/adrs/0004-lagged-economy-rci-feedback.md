# ADR 0004 — Lagged Economy-to-RCI Feedback

**Status:** Accepted for Economy Foundation v0.1

## Context

Tax policy must influence RCI demand, while occupied RCI activity also determines tax revenue. Calculating both recursively in one tick would create cyclic ownership and ordering-dependent results.

## Decision

Use committed-state lag. At a daily tick, RCI evaluates with normalized tax-pressure factors derived from committed Economy N. Economy then settles using the newly staged RCI N+1 projection, and the complete dependent world publishes once.

Economy exposes channel pressure values; application adapts them to RCI's external factor mechanism. Neither package imports the other. Rules define the neutral rate, clamped pressure span, and factor weight.

## Consequences

- Evaluation order is explicit, acyclic, and replayable.
- Policy changes affect the next daily RCI evaluation rather than recursively changing the current calculation.
- The application owns the small translation seam.

## Rejected Alternatives

- Same-tick fixed-point iteration: complex, slow, and unnecessary for v0.1.
- Direct Economy factor implementation inside RCI: reverses ownership and couples packages.
- Direct RCI calls from Economy: creates the opposite dependency and an eventual cycle.

## Enforcement

Tick-order tests, package-boundary tests, factor normalization tests, and deterministic replay with policy changes.
