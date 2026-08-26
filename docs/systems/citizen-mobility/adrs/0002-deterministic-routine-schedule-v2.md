# ADR-0002: Deterministic routine schedule V2 without congestion feedback

**Status:** Accepted  
**Date:** `2026-08-20`  
**System:** `citizen-mobility`

## Context

Hour-batched commute demand created synchronized departures. Mobility needs per-Citizen minute boundaries while preserving RCI identity authority and preventing Traffic congestion from creating a route-choice feedback loop.

## Decision

`SchedulePolicyV2` deterministically distributes work starts in the 07:00–09:00 window with bounded daily jitter and a nine-hour work duration. Mobility collects due `GameMinute` boundaries in stable order, records desired activity, and permits at most one active trip per Citizen. If another boundary is due while travel is active, Mobility catches up after settlement instead of creating a second trip.

Schedule generation and desired activity do not read live Traffic congestion, queue length, or renderer state. Traffic independently owns mode-route feasibility, admission, progression, and recovery.

## Consequences

- Commute demand is repeatable and staggered without synthetic Citizens or wall-clock randomness.
- Delayed travellers converge on their latest routine intent without duplicate trips.
- Dynamic congestion-sensitive departure scheduling and non-commute routine policy remain future decisions.
- `MobilitySaveV2` declares the policy version while preserving committed existing trip facts; `WorldSaveV8` composes it.
