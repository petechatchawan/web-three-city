# ADR-0001: Use Citizen Records as Population Authority

**Status:** Accepted  
**Date:** 2026-08-06  
**System:** RCI Demand & Occupancy

## Context

RCI v0.1 must support aging, birth, death, migration, employment, Household movement, and future family relationships. Aggregate age histograms are efficient but lose stable identity and cannot preserve who was born, died, moved, partnered, or related to whom. Reconstructing those facts later would create synthetic history and a disruptive Save migration.

A full Citizen AI and detailed social simulation would exceed the RCI foundation scope.

## Decision

Store lightweight Citizen records with stable IDs as the authoritative population state from v0.1. Store relationships, Household membership, qualifications, housing assignments, and employment assignments as first-class historical records.

Compute age histograms, age bands, current membership, population totals, employment totals, vacancies, and HUD statistics as derived projections.

Retain emigrated and deceased Citizens so relationship and employment history remains referentially valid.

## Consequences

### Positive

- Birth and death affect real stable entities.
- Parent, partner, Household, housing, and career history can expand without inventing old records.
- Save/Load preserves city history losslessly.
- Aggregate simulation remains possible through projections and indexes.
- Citizen rendering or AI can be added later without replacing population authority.

### Negative

- Save files and validation are larger than aggregate-only counters.
- Cross-record referential integrity and sequence management are required.
- Lifecycle mutations must close active assignments atomically.
- Historical retention needs future archival/versioning policy if cities become extremely large.

## Alternatives Considered

### Aggregate histograms as authority

Rejected because lineage, Household transitions, and individual employment history cannot be reconstructed truthfully.

### Anonymous member records without relationships

Rejected because it postpones the same migration problem once parent and partner history becomes necessary.

### Full Citizen agent simulation in v0.1

Rejected because routines, pathfinding, health, education, names, appearance, and social behavior are outside RCI Demand & Occupancy.

## Enforcement

- RCI Save stores normalized Citizen and historical assignment records.
- Projections must rebuild from authority and are not persisted as competing truth.
- Stable IDs and deterministic sequences are revision-fenced.
- Cross-domain validation rejects dangling or overlapping active records.
- Implementation tests compare continuous execution with save/load/resume.

## Supersession

A future storage optimization may archive historical records, but it must preserve stable identity, relationship references, deterministic replay semantics, and lossless migration.
