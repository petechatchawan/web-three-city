# ADR-0001: Existing RCI Citizen remains identity authority

**Status:** Accepted  
**Date:** `2026-08-15`  
**System:** `citizen-mobility`

## Context

RCI already owns Citizen identity, lifecycle, Household membership, Housing, Employment, migration, and historical presence. Citizen Mobility and Traffic need per-Citizen activity/trip state plus visual pedestrians and cars. Creating a second traffic-specific Citizen entity would split identity, lifecycle, Save authority, and Inspect semantics. Making visual agents authoritative would also couple simulation correctness to camera visibility and frame updates.

## Decision

The existing RCI `citizenId` remains the sole Citizen identity/lifecycle authority.

Citizen Mobility may own only per-present-Citizen mobility facts: current activity, stationary place, schedule cursor, active trip identity, trip purpose/origin/destination/mode/status, and stable Mobility-generated trip IDs.

Traffic state references Mobility `tripId` and RCI `citizenId`; it never creates an alternative Citizen record. Three.js pedestrian and vehicle agents are materialized projections of committed real trips and are never identity authority.

`citizen-mobility-core` must consume narrow caller-supplied Citizen/Home/Employment projections rather than importing `rci-core` directly. `apps/game` remains the application composition boundary.

## Consequences

### Positive

- One canonical Citizen identity survives RCI, Mobility, Traffic, Save/Load, Inspect, and presentation.
- Birth/death/emigration and assignment changes have one upstream lifecycle source.
- Camera materialization can be destroyed/recreated without losing Citizen or trip state.
- Future daily-life Citizen AI can extend Mobility without migrating Citizen identity.
- Package dependency direction remains acyclic.

### Negative

- Application orchestration must translate RCI state into a narrow Mobility projection.
- Mobility/Traffic commits require cross-snapshot validation to prevent orphaned `citizenId`/`tripId` references.
- Visual systems cannot invent decorative Citizens and later treat them as simulation facts.

## Alternatives Considered

### Traffic-specific Citizen entities

Rejected because they duplicate identity and require synchronization with birth/death, Household, Housing, Employment, migration, and Save state.

### Three.js visual agent as Citizen authority

Rejected because visibility, LOD, pooling, context loss, and frame timing would then affect simulation correctness.

### Aggregate anonymous commuters only

Rejected for the approved product goal: visible pedestrians/cars must correspond to real Citizens and the architecture must support later individual daily activity AI.

## Enforcement

- Dependency tests must prevent `rci-core` from importing Citizen Mobility/Traffic and prevent `citizen-mobility-core` from importing `rci-core`.
- Snapshot validation must reject Mobility states/trips referencing non-present or nonexistent Citizens unless explicitly historical/cancelled by contract.
- Browser/interaction acceptance must prove visible pedestrians/cars expose the same underlying `citizenId` as the committed Mobility trip.
- Save/load tests must preserve Citizen-to-trip identity across reload.
- Presentation tests must prove materialization/dematerialization does not mutate Mobility/RCI state.

## Supersession

A future ADR may supersede this only through an explicitly approved Citizen-authority redesign and Save migration. Adding richer activities, transit, parking, or visual agents does not by itself supersede this decision.
