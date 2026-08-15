# Citizen Mobility System

**Status:** Approved design — not implemented  
**Milestone:** Citizen Mobility & Traffic Foundation v0.1  
**Planning baseline:** `master@394e5ec484277b3b2e709b40d4c38191809c5f3e`  
**Planned ownership:** `packages/citizen-mobility-core`; atomic composition by `apps/game`  
**Planned persistence:** `MobilitySaveV1` inside `WorldSaveV7`

## Purpose

Own the logical activity, schedule, trip intent, travel-mode choice, and current mobility state of each present Citizen while preserving the existing RCI Citizen record as the sole Citizen identity/lifecycle authority.

The first production scope is real Home ↔ Work commuting. Every active mobility trip belongs to a real existing Citizen. The architecture is intentionally generic enough for later Work → Shop → Leisure → Service → Home activity chains without replacing the v0.1 identity, trip, or transport seams.

## Does Not Own

- Citizen identity, birth/death, household membership, housing, employment, migration, or RCI Demand.
- Building or Road authority.
- Pathfinding, transport graph topology, congestion, queues, or travel-time calculation.
- Pedestrian/car Three.js objects, animation, LOD, or camera visibility.
- Public transit, parking, private-car ownership, shopping/leisure destination policy, or Citizen movement AI beyond the approved v0.1 commute scope.

## Approved Authority Boundary

```text
RCI Citizen / Household / Home / Employment
                  ↓
           apps/game projection
                  ↓
       Citizen Mobility authority
   Activity + Schedule + Trip + Mode
                  ↓
          Traffic planning seam
                  ↓
     Walking / Driving transport state
```

The system must not create `TrafficCitizen`, `PedestrianCitizen`, `VisualCitizen`, or any equivalent duplicate Citizen authority. A visual pedestrian or car must be traceable to the original RCI `citizenId` through an active trip.

## Planned Authoritative State

- Mobility revision and policy version.
- One active mobility state for each present Citizen.
- Current non-travel activity and stationary place when applicable.
- Schedule cursor / next deterministic activity boundary.
- Active mobility trip identity when travelling.
- Mobility trip records: Citizen, purpose, origin, destination, selected mode, departure time, and lifecycle status.
- Stable trip ID sequence and deterministic schedule seed inputs.

Transport routes, edge progress, traffic queues, graph nodes, congestion, meshes, animation state, and camera materialization are outside Citizen Mobility authority.

## Foundation Behavior

- Foundation activity kinds: `Home`, `Work`, `Idle`, and `Travel`.
- Foundation trip purposes: commute to Work and commute Home.
- Walk and Drive are first-class modes.
- Work schedules are deterministically staggered instead of releasing all Citizens at one clock instant.
- Activity timing uses deterministic integer game-minute coordinates inside the existing one-hour Simulation tick model.
- Mode choice consumes caller-supplied deterministic Walk/Drive route-cost candidates; Citizen Mobility does not import Traffic internals.
- Missing/invalid Home, Job, or transport access fails closed without deleting or mutating the Citizen, Household, Employment, or Building authority.
- RCI lifecycle/assignment changes reconcile Mobility atomically through `apps/game` orchestration.

## Future Extension Seam

Later Citizen AI may add activity definitions and destination policies such as Shopping, Leisure, Education, Healthcare, Service, and Visit. Those extensions must reuse the same Citizen identity, activity-plan, trip, mode, and Traffic seams rather than introducing a second agent authority.

## Planning Documents

- [Citizen Mobility Foundation v0.1 specification](specs/2026-08-15-citizen-mobility-foundation-v0-1.md)
- [Citizen Mobility TDD implementation plan](tdd/2026-08-15-citizen-mobility-foundation-v0-1.md)
- [Cross-system execution index](../architecture-infrastructure/tdd/2026-08-15-citizen-mobility-traffic-foundation-v0-1-execution-index.md)
- [ADR-0001 — Existing RCI Citizen remains identity authority](adrs/0001-existing-rci-citizen-remains-identity-authority.md)
- Related: [RCI](../rci/README.md), [Buildings](../buildings/README.md), [Simulation Time](../simulation-time/README.md), [Traffic](../traffic/README.md)

Verification records are added per implementation PR and at foundation closure; production behavior remains unimplemented until those PRs pass their gates.
