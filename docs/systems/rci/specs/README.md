# RCI Specifications

Canonical approved and historical RCI design specifications are stored in this directory.

## Current specification

- [`2026-08-06-rci-demand-occupancy-foundation-v0-1.md`](2026-08-06-rci-demand-occupancy-foundation-v0-1.md) — owner-approved on 2026-08-06, implemented through PR #26–#31, verified, and merged to `master` at `9409e301d2710db856b584fc555d5c4f714bba62`.

The design document is retained as the planning-time specification. Its original metadata records the stage at which it was written; current delivery status is authoritative in this index, the living System README, and the closure record.

Implementation history and final evidence are maintained in:

- [`../README.md`](../README.md)
- [`../tdd/README.md`](../tdd/README.md)
- [`../verification/2026-08-06-rci-foundation-v0-1-closure.md`](../verification/2026-08-06-rci-foundation-v0-1-closure.md)

## Post-closure clarification

PR #32 corrected the Demand target-buffer interpretation without changing the entity model, package boundaries, tick pipeline, or Save schema:

- Residential availability means a wholly vacant Dwelling Unit, not spare resident capacity inside an occupied Unit.
- Commercial and Industrial target buffers must produce a reachable Growth-gate score when their positions are fully occupied.

The correction was verified and squash-merged to `master` as `03cf6a1d1702ec75d532e0f428b2044914156bba`. Its exact manual and automated evidence is tracked in [`../verification/2026-08-06-rci-occupied-dwelling-demand-deadlock.md`](../verification/2026-08-06-rci-occupied-dwelling-demand-deadlock.md).

## Status authority

For handoff and future maintenance, use this precedence:

1. [`../README.md`](../README.md) for current runtime behavior and delivery state.
2. Verification records for exact evidence and closure boundaries.
3. The design specification for approved architectural intent and historical decisions.

The TDD packet is implementation history and must not be used as the current work-status source after closure.

## Current correction state

PR #32 is closed and merged. Final exact-head verification passed on implementation head `e33ef19c6eef4d593251d133913860a5416923e5` with workflow run `31147264885`: Lean CI passed and Full browser verification passed `121/121`. The resulting runtime merge commit has the same tree as the tested PR merge ref, and existing `WorldSaveV5` saves require no migration.
