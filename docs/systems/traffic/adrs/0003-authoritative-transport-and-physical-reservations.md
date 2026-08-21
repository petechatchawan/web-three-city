# ADR-0003: Subordinate transport time and unified physical reservations

**Status:** Accepted  
**Date:** `2026-08-20`  
**System:** `traffic`

## Context

Hour-wide Traffic progression allowed short trips to begin and end without an observable authoritative state. Presentation compensations such as replay and visual headway made renderer behavior appear to own physical movement constraints.

## Decision

`traffic-core` owns a versioned subordinate transport cursor with four ordered quanta per GameMinute, without becoming a second calendar. Active Drive trips move through `WaitingForEntry`, `Entering`, `Travelling`, and `Leaving`; terminal arrival is separate from the final movement phase.

Canonical lane occupancy/headway, ingress/receiving/merge/conflict resource ownership, node classification, and deterministic arbitration are Traffic authority. Reservation bundles acquire atomically and release only after physical rear clearance; they have no timeout. `traffic-three` may interpolate committed safe state but cannot invent capacity, reservation ownership, arrival authority, or synthetic Journey Replay.

`TrafficSaveV2` persists V2 cursor/trip/phase/reservation facts only. Graph caches, occupancy indexes, and renderer state are derived and rebuilt.

## Consequences

- Short trips can remain real, publishable active trips before settlement.
- Headway and junction safety are deterministic and independent of visibility/frame rate.
- Save/load resumes the authoritative checkpoint rather than a replay approximation.
- Parking, transit, signals, incidents, congestion rerouting, and richer conflict templates remain deferred. Reservation-safe Road mutation integration and end-to-end Game/browser closure remain unfinished.
