# Citizen Mobility System

**Status:** Implemented — V2 schedule/save authority and Game atomic integration are complete; release/owner verification remains open<br>
**Milestone:** Citizen Mobility & Traffic Foundation v0.1  
**Primary ownership:** `packages/citizen-mobility-core`; atomic composition by `apps/game`<br>
**Persistence:** `MobilitySaveV2` inside `WorldSaveV8`; V1 migration remains supported

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
- fail-closed `MobilitySaveV2` codec plus explicit `MobilitySaveV1 -> V2` migration;
- `SchedulePolicyV2`: versioned deterministic 07:00–09:00 work-start distribution, bounded daily jitter, and 9-hour work duration;
- integer `GameMinute` due-boundary collection with stable ordering and desired-activity catch-up;
- latest-authority Home↔Work planning requests with tentative deterministic trip IDs;
- deterministic generalized-cost mode choice, exact tie → Walk;
- committed Active/Failed trip creation without storing Traffic route/progress;
- lifecycle reconciliation for newly present/deceased/emigrated Citizens, Home/Job changes, and active-destination revalidation;
- trip settlement back to Home/Work/Idle state.
- `apps/game` projection of real RCI Citizens, Home, and Employment facts; no synthetic Citizen identity is created;
- atomic Mobility + Traffic tick composition, including deterministic active-trip reconciliation after Road changes;
- one-active-trip-per-Citizen enforcement: later due boundaries update desired activity and catch up after settlement rather than producing duplicate trips;
- `WorldSaveV8` persistence with explicit V7 Mobility migration, active Mobility/Traffic continuation, and no synthetic historical trips.

Source entry points:

- `packages/citizen-mobility-core/src/contracts.ts`
- `packages/citizen-mobility-core/src/mobility-snapshot.ts`
- `packages/citizen-mobility-core/src/schedule-policy.ts`
- `packages/citizen-mobility-core/src/schedule-index.ts`
- `packages/citizen-mobility-core/src/mobility-planner.ts`
- `packages/citizen-mobility-core/src/mode-choice.ts`
- `packages/citizen-mobility-core/src/mobility-reconciler.ts`
- `packages/citizen-mobility-core/src/persistence.ts`

## Current Limitations and Extension Points

Public transit, parking, private-car ownership, non-commute destination policy, and broader Citizen AI remain deferred. Schedule choice does not consume live congestion or Traffic queue state; Traffic owns route topology, progression, queues, physical admission, and recovery. `apps/game` remains the only composition boundary. Presentation and UI consume committed projections and cannot create or mutate Mobility authority.

## Planning Documents

- [Citizen Mobility Foundation v0.1 specification](specs/2026-08-15-citizen-mobility-foundation-v0-1.md)
- [Citizen Mobility TDD implementation plan](tdd/2026-08-15-citizen-mobility-foundation-v0-1.md)
- [Cross-system execution index](../architecture-infrastructure/tdd/2026-08-15-citizen-mobility-traffic-foundation-v0-1-execution-index.md)
- [ADR-0001 — Existing RCI Citizen remains identity authority](adrs/0001-existing-rci-citizen-remains-identity-authority.md)
- [ADR-0002 — Deterministic routine schedule V2 without congestion feedback](adrs/0002-deterministic-routine-schedule-v2.md)
- Related: [RCI](../rci/README.md), [Buildings](../buildings/README.md), [Simulation Time](../simulation-time/README.md), [Traffic](../traffic/README.md)

Focused Mobility V2 persistence/schedule tests, Game integration, and typechecks are recorded in the Task reports. Exact-head release verification and owner-controlled 414×896 visual acceptance remain final gates; no synthetic Citizen or replay authority is used by the runtime path.
