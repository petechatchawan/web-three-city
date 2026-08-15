# ADR-0001: Logical real trips with materialized visual agents

**Status:** Accepted  
**Date:** `2026-08-15`  
**System:** `traffic`

## Context

The product goal requires visible Citizens walking and real cars commuting, while the target platform cannot afford one permanently materialized Three.js object for every logical Citizen/trip. Decorative random traffic would make the city look active but would not support reliable Citizen Inspect, Home/Work traceability, later daily-life AI, deterministic Save/Load, or traffic-derived gameplay feedback.

The architecture therefore needs to distinguish transport truth from render presence without weakening the requirement that visible people/cars correspond to real Citizens.

## Decision

Every committed Walk/Drive Traffic trip is a logical trip tied to one Mobility `tripId` and one existing RCI `citizenId`.

A Three.js pedestrian or vehicle is a materialized presentation of that exact logical trip. Materialization is optional and camera/presentation-budget driven:

```text
real logical trip
→ may be materialized near the camera
→ may be dematerialized/pool-released off-screen
→ logical route/progress/queue state continues unchanged
```

No anonymous decorative pedestrian/car is permitted to satisfy canonical v0.1 Traffic acceptance. A visible pedestrian must map to a real Walk trip. A visible car must map to a real Drive trip.

Presentation budgets may cause some otherwise visible logical trips not to receive a mesh; this is a rendering-capacity decision, not a reduction in Traffic demand or Citizen count.

## Consequences

### Positive

- Visible city life remains semantically connected to real Citizens, Homes, Jobs, and trips.
- Citizen/Vehicle Inspect can trace directly to committed authority.
- Camera movement, LOD, pooling, context loss, and renderer recreation cannot corrupt simulation.
- Large logical populations remain possible on mobile because off-screen trips need no Three.js object.
- Future daily activity AI can reuse the same trip/agent seam.

### Negative

- Traffic must maintain per-trip logical progression even when not rendered.
- Presentation needs spatial indexing and deterministic materialization selection.
- Visual density may be lower than total logical density when agent budgets are reached.
- Pooling/LOD/interpolation must be carefully tested so presentation does not appear to teleport or duplicate one logical trip.

## Alternatives Considered

### One persistent Three.js object per Citizen/trip

Rejected because it couples logical population scale to renderer object count and per-frame update cost.

### Aggregate anonymous traffic with representative decorative agents

Rejected for v0.1 because the approved product contract requires visible agents to be real Citizen trips and future Citizen AI needs individual trip traceability.

### Pure visual traffic with no Traffic authority

Rejected because congestion, Save/Load, routing, queues, and future accessibility feedback require deterministic logical transport state.

## Enforcement

- Every materialized pedestrian/vehicle carries stable `tripId` and `citizenId` references from committed projections.
- Browser tests must inspect visible agents and verify the corresponding committed trip/Citizen.
- Materialize/dematerialize/camera movement tests must prove Traffic fingerprints do not change.
- Save/load tests preserve logical trips without persisting Three.js object identity.
- Performance tests enforce spatial queries/pools and prohibit per-frame world-wide agent scans.
- Code review rejects decorative random traffic as a substitute for canonical Traffic acceptance.

## Supersession

Future ambient/decorative city-life effects may coexist only if clearly separated from authoritative Citizen/Traffic agents. They do not supersede this ADR unless a later approved product decision removes the requirement that canonical visible Traffic represent real trips.
