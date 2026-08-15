# Citizen Mobility System

**Status:** Partial — core + commute logic implemented; world/traffic integration pending  
**Milestone:** Citizen Mobility & Traffic Foundation v0.1  
**Planning baseline:** `master@6fb09e426147369dfaa274d55339994edf0e8e69`  
**Primary ownership:** `packages/citizen-mobility-core`; atomic composition by `apps/game` is planned in PR6  
**Planned persistence:** `MobilitySaveV1` inside `WorldSaveV7`

## Purpose

Own deterministic per-Citizen activity, commute schedule, trip planning, travel-mode choice, and lifecycle reconciliation while preserving the existing RCI Citizen record as the sole Citizen identity/lifecycle authority.

The first production scope is real Home ↔ Work commuting. Every active mobility trip belongs to a real existing Citizen. The activity vocabulary remains intentionally small (`Home`, `Work`, `Idle`, `Travel`) but the trip/schedule seams can later support Shop, Leisure, Education, Healthcare, Service and Visit without replacing Citizen identity.

## Does Not Own

- Citizen identity, birth/death, household membership, housing, employment, migration, or RCI Demand.
- Building or Road authority.
- Pathfinding, transport graph topology, congestion, queues, or travel-time calculation.
- Pedestrian/car Three.js objects, animation, LOD, or camera visibility.
- Public transit, parking, private-car ownership, shopping/leisure destination policy, or Citizen AI beyond the approved v0.1 commute scope.

## Authority Boundary

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

The package has no dependency on `rci-core`, `building-core`, `road-core`, `traffic-core`, DOM, or Three.js. Cross-system translation stays in `apps/game`.

## Implemented Authority and Behavior

`packages/citizen-mobility-core` now implements:

- immutable `MobilitySnapshotV1` + deterministic fingerprinting;
- typed activity/trip/mode/failure contracts and strict referential validation;
- fail-closed `MobilitySaveV1` codec;
- versioned 07:00–09:00 deterministic work-start distribution with 9-hour work duration;
- integer `GameMinute` due-boundary collection with stable ordering;
- latest-authority Home↔Work planning requests with tentative deterministic trip IDs;
- deterministic generalized-cost mode choice, exact tie → Walk;
- committed Active/Failed trip creation without storing Traffic route/progress;
- lifecycle reconciliation for newly present/deceased/emigrated Citizens, Home/Job changes, and active-destination revalidation;
- trip settlement back to Home/Work/Idle state.

Source entry points:

- `packages/citizen-mobility-core/src/contracts.ts`
- `packages/citizen-mobility-core/src/mobility-snapshot.ts`
- `packages/citizen-mobility-core/src/schedule-policy.ts`
- `packages/citizen-mobility-core/src/schedule-index.ts`
- `packages/citizen-mobility-core/src/mobility-planner.ts`
- `packages/citizen-mobility-core/src/mode-choice.ts`
- `packages/citizen-mobility-core/src/mobility-reconciler.ts`
- `packages/citizen-mobility-core/src/persistence.ts`

## Remaining Foundation Work

Traffic PR3–PR5 must provide real Walk/Drive candidate routes and progression. PR6 must project current RCI Housing/Employment facts, compose Mobility/Traffic atomically, migrate V1–V6 saves, and resume exact active trips. Three.js/UI/release slices remain downstream.

## Planning Documents

- [Citizen Mobility Foundation v0.1 specification](specs/2026-08-15-citizen-mobility-foundation-v0-1.md)
- [Citizen Mobility TDD implementation plan](tdd/2026-08-15-citizen-mobility-foundation-v0-1.md)
- [Cross-system execution index](../architecture-infrastructure/tdd/2026-08-15-citizen-mobility-traffic-foundation-v0-1-execution-index.md)
- [ADR-0001 — Existing RCI Citizen remains identity authority](adrs/0001-existing-rci-citizen-remains-identity-authority.md)
- Related: [RCI](../rci/README.md), [Buildings](../buildings/README.md), [Simulation Time](../simulation-time/README.md), [Traffic](../traffic/README.md)

Verification is intentionally deferred until the final test phase requested for this execution run.
