# ADR 0005 — Economy Persistence and Deterministic Migration

**Status:** Accepted for Economy Foundation v0.1

## Context

Economy becomes authoritative persisted state. Older saves contain simulation and source-domain state but no defensible accounting history. Load must not invent past revenue or replay elapsed days.

## Decision

Add `EconomySaveV1` to the next current WorldSave envelope (V6 on the planning baseline). Persist only Economy-owned revision, rules version, treasury, policy, current/previous aggregate periods, and settlement markers.

Migrate older saves to configured initial treasury/default policy and a zeroed current period matching their saved GameTime. Set settlement markers to the latest eligible boundary so load performs no historical catch-up. Previous period is null. Validate the complete candidate world before publication.

## Consequences

- Backward load is deterministic and honest about missing history.
- Derived taxable and maintenance projections are rebuilt, not persisted.
- Save/load continuation is testable against uninterrupted execution.
- Future save changes must migrate from this explicit Economy schema.

## Rejected Alternatives

- Derive historical accounts from current buildings: fabricates activity and commands that did not occur.
- Reset simulation time with Economy: breaks existing save authority.
- Persist projections or a full ledger: duplicates owners and adds unneeded v0.1 state.

## Enforcement

V1–current migration fixtures, malformed-save tests, round-trip tests, continuation/replay tests, and clean atomic load publication.
