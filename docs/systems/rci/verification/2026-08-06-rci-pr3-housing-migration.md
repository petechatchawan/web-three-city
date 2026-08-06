# RCI PR 3 — Housing and Migration Implementation Evidence

**Branch:** `feat/rci-housing-migration-v0-1`  
**Verification status:** Implementation, tests, and handoff documentation written; execution deferred to the final PR 2–6 integration gate

## Delivered

- Versioned Building capacity-profile references with no reverse dependency on RCI.
- Foundation Residential capacity profiles: Cottage `1×4`, Row House `1×5`, Duplex `2×4`, Apartment `6×3`.
- Deterministic Dwelling inventory activation/retirement from Building lifecycle.
- Normalized housing assignments and current Housing projection.
- Stable adequate-capacity relocation and displaced-first reconciliation.
- Incoming request accumulator, canonical queue order, five versioned archetypes, and no preallocated population authority.
- Atomic incoming Household materialization.
- Displaced queue with exact 720-tick expiry and historical Household emigration.
- Fixed-point housing-side emigration pressure factors.
- Legacy world-save migration that derives empty Dwelling inventory from active Residential Buildings.
- Tick integration before Employment/Demand phases.

## Written Acceptance Coverage

- Capacity metadata and approved profile totals.
- Inventory activation, idempotence, retirement, and Building-array permutation.
- One active housing assignment per Household/Unit.
- Displaced queue uniqueness/order/expiry.
- Incoming queue order and accumulator carry/caps.
- Atomic materialization and no preallocation.
- Historical Household emigration.
- Housing reconciliation priority and stable allocation.
- Prior-save migration and canonical housing Save output.

## Deferred Verification Policy

Per owner instruction, PR 2–6 are implemented before tests run. This document therefore records delivered scope but does not claim a passing exact head. Final commands, outputs, and commit SHAs are appended during PR 6 closure.

Required final gates include package tests/typecheck/build, repository `pnpm check`, `pnpm verify:full`, Save/resume equality, and browser acceptance.

## Handoff Boundaries

- `building-core` owns definitions and Building lifecycle only.
- RCI owns Dwelling inventory, occupancy, queues, relocation, materialization, and emigration.
- Relocation and incoming materialization require sufficient capacity.
- Birth-caused overcrowding is retained and measured; relocation never creates new overcrowding.
- Employment factors and compatible job supply enter in PR 4 through existing extension contracts.
