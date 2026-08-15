# ADR-0002: Derived transport graphs and lagged congestion costs

**Status:** Accepted  
**Date:** `2026-08-15`  
**System:** `traffic`

## Context

Road already owns Road occupancy, definition codes, connectivity, and validity; Buildings already own placement and deterministic Road frontage. Traffic needs pedestrian/vehicle graphs, route costs, capacity, queues, and congestion. Persisting an independent Traffic network authority would duplicate Road/Building facts and create synchronization/migration risk.

Routing also creates a potential cycle: a route changes Road load, load changes congestion, congestion changes route cost, and route cost could immediately change the route again. A same-reconciliation feedback loop would make ordering and replay fragile.

## Decision

Pedestrian and vehicle transport graphs are deterministic derived projections from coherent Road + Building access source revisions supplied by `apps/game`. They are rebuildable and are not persisted as Road/Building authority.

Traffic keeps versioned Traffic profiles/policies for speed, capacity, node service, pedestrian offsets, and routing semantics. Those policies interpret stable upstream Road definition codes but do not mutate Road snapshots.

Newly departing trips plan routes using an immutable Traffic cost projection derived from the previous committed Traffic state. The resulting newly committed Traffic state produces the next cost projection. Congestion does not trigger normal same-tick or mid-trip rerouting in v0.1.

Road topology invalidation is a separate recovery event: if an already selected remaining route becomes impossible because the authoritative Road graph changed, Traffic deterministically replans from the current stable logical node to the latest valid destination or fails `UnreachableDestination`.

## Consequences

### Positive

- Road and Building remain single sources of spatial/network truth.
- Traffic graph caches can be discarded/rebuilt after load or localized Road mutations.
- No duplicate network persistence or reverse Traffic→Road mutation path is created.
- Lagged cost input removes the route↔congestion same-tick cycle.
- Replay ordering and route decisions remain testable and deterministic.
- Future Traffic profiles can add Road-type semantics without moving Traffic authority into `road-core`.

### Negative

- `apps/game` must build narrow coherent source projections and enforce revision fences.
- Local Road mutations require graph dirty-region invalidation and active-route validation.
- New trips respond to congestion with one committed-state lag by design.
- Dynamic congestion-aware mid-trip rerouting is deferred and will require a later explicit policy/ADR.

## Alternatives Considered

### Persist an independent Traffic road graph

Rejected because it duplicates Road topology/Building access authority and requires synchronization across every Road/Building mutation and Save migration.

### Put capacity/pathfinding directly into `road-core`

Rejected because the current Road boundary explicitly excludes Traffic/pathfinding/capacity and Traffic is a downstream consumer that should not reverse that dependency.

### Recompute routes immediately until congestion converges in one tick

Rejected because it introduces same-tick cyclic feedback, unstable ordering, and potentially unbounded work.

### Reroute every active trip whenever congestion changes

Rejected for v0.1 because it creates route thrashing, weakens replay stability, and is not necessary for the first visual/commute foundation.

## Enforcement

- Dependency tests prevent `road-core`/`building-core` from importing Traffic and prevent `traffic-core` from importing their implementation packages.
- Save schema tests assert graphs/caches are not authoritative persisted data.
- Graph fingerprint tests prove identical Road/Building projections produce identical graph IDs/topology.
- Routing tests include equal-cost tie cases and stable node/edge ordering.
- Lag tests prove newly due routes use the prior committed Traffic-cost projection rather than traffic being generated within the same reconciliation.
- Road mutation browser/integration tests verify route continuation, deterministic recovery, or typed failure.

## Supersession

A future ADR is required before introducing authoritative Road-capacity state into Roads, persistent Traffic graph authority, live congestion rerouting, or iterative same-tick equilibrium routing.
