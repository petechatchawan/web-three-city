# Citizen Mobility System

**Status:** Partial — core authority/persistence implemented; commute/world integration pending  
**Milestone:** Citizen Mobility & Traffic Foundation v0.1  
**Planning baseline:** `master@6fb09e426147369dfaa274d55339994edf0e8e69`  
**Primary ownership:** `packages/citizen-mobility-core`; atomic composition by `apps/game` is planned in PR6  
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

The system does not create `TrafficCitizen`, `PedestrianCitizen`, `VisualCitizen`, or equivalent duplicate Citizen authority. A visual pedestrian or car must be traceable to the original RCI `citizenId` through an active trip.

## Implemented Core Authority

`packages/citizen-mobility-core` now defines:

- `CitizenMobilityState` with `Home | Work | Idle | Travel` activity semantics;
- immutable `MobilityTrip` records for commute purpose/mode/lifecycle;
- `MobilitySnapshotV1` with canonical sorting, referential validation, stable trip sequence, and deterministic fingerprinting;
- typed `MobilityContractError` validation failures;
- fail-closed `MobilitySaveV1` encode/decode;
- no runtime dependency on RCI, Buildings, Roads, Traffic, DOM, or Three.js.

Source entry points:

- `packages/citizen-mobility-core/src/contracts.ts`
- `packages/citizen-mobility-core/src/mobility-snapshot.ts`
- `packages/citizen-mobility-core/src/mobility-fingerprint.ts`
- `packages/citizen-mobility-core/src/persistence.ts`

## Remaining Foundation Behavior

PR2 adds deterministic staggered Home↔Work schedule/trip planning and mode choice. PR6 adds RCI/Building/Simulation adapters, atomic world publication, Save migration and exact resume. Until those slices close, the package is not yet active in gameplay runtime.

## Future Extension Seam

Later Citizen AI may add Shopping, Leisure, Education, Healthcare, Service, and Visit activity definitions/destination policies. Extensions must reuse the same Citizen identity, activity-plan, trip, mode, and Traffic seams rather than introducing a second agent authority.

## Planning Documents

- [Citizen Mobility Foundation v0.1 specification](specs/2026-08-15-citizen-mobility-foundation-v0-1.md)
- [Citizen Mobility TDD implementation plan](tdd/2026-08-15-citizen-mobility-foundation-v0-1.md)
- [Cross-system execution index](../architecture-infrastructure/tdd/2026-08-15-citizen-mobility-traffic-foundation-v0-1-execution-index.md)
- [ADR-0001 — Existing RCI Citizen remains identity authority](adrs/0001-existing-rci-citizen-remains-identity-authority.md)
- Related: [RCI](../rci/README.md), [Buildings](../buildings/README.md), [Simulation Time](../simulation-time/README.md), [Traffic](../traffic/README.md)

Verification is intentionally deferred until the final test phase requested for this execution run.
