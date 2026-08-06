# RCI Specifications

Canonical approved and historical RCI design specifications are stored in this directory.

## Current specification

- [`2026-08-06-rci-demand-occupancy-foundation-v0-1.md`](2026-08-06-rci-demand-occupancy-foundation-v0-1.md) — owner-approved on 2026-08-06, implemented through PR #26–#31, verified, and merged to `master` at `9409e301d2710db856b584fc555d5c4f714bba62`.

Implementation history and final evidence are maintained in:

- [`../tdd/README.md`](../tdd/README.md)
- [`../verification/2026-08-06-rci-foundation-v0-1-closure.md`](../verification/2026-08-06-rci-foundation-v0-1-closure.md)

## Post-closure clarification

PR #32 corrects the Demand target-buffer interpretation without changing the entity model, package boundaries, tick pipeline, or Save schema:

- Residential availability means a wholly vacant Dwelling Unit, not spare resident capacity inside an occupied Unit.
- Commercial and Industrial target buffers must produce a reachable Growth-gate score when their positions are fully occupied.

The correction and its manual/automated evidence are tracked in [`../verification/2026-08-06-rci-occupied-dwelling-demand-deadlock.md`](../verification/2026-08-06-rci-occupied-dwelling-demand-deadlock.md).
