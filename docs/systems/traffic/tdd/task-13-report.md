# Task 13 — Atomic ingress and receiving reservations

## Delivered

- Added `traffic-reservation.ts`: deterministic resource IDs, static access-service credit, derived reservation owner indexes, atomic bundle acquire, and owner-checked release.
- Extended V2 Drive state with normalized entry credit and resource ownership facts. The owner index is rebuilt from active trips each quantum; it is not persisted separately.
- Integrated admission into the Drive lifecycle. A `WaitingForEntry` Drive accrues static credit, then moves to `Entering` only when its ingress and first receiving resources are both atomically available.
- Retained entry resources through `Entering` and `Travelling` until the vehicle's rear has crossed the configured fixed-point clearance (`125_000` progress units by default). There is no timeout release.
- Added atomic Drive cancellation/failure transitions that clear reservation facts alongside terminal status.
- This task intentionally adds no node classification, merge handling, or intersection arbitration (Tasks 14–15).

## TDD evidence

Focused RED→GREEN commands used Node 22 because this workspace's pnpm version requires `node:sqlite`.

- RED: static service-credit test failed with `api.accrueStaticAccessServiceCredit is not a function`.
- RED: atomic bundle test failed with `api.createTrafficReservationResourceId is not a function`.
- RED: blocked receiving test failed with `expected 'Entering' to be 'WaitingForEntry'`.
- RED: rear-clearance receipt test failed with `expected [] to deeply equal ['clearing-entry']`.
- RED: cancellation/failure tests failed with `api.terminateDriveWithEntryReservation is not a function`.
- GREEN after each minimal implementation:

```text
/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm --filter @web-three-city/traffic-core test -- traffic-reservation.test.ts'
```

The reservation tests cover static credit independent of live congestion/load/queue length, blocked credited waiting, all-or-nothing bundles, physical rear-clearance release without a timer, and atomic failure/cancellation release.

## Verification

- PASS: `pnpm --filter @web-three-city/traffic-core test` — 11 files, 38 tests.
- PASS: `pnpm --filter @web-three-city/traffic-core typecheck`.
- PASS: scoped `git diff --check`.

## Assumptions and residual risk

- The initial ingress footprint is identified by the deterministic origin-building access identity, and the first routed Drive edge identifies the receiving footprint. A future multi-access Building projection can substitute a distinct access ID without changing reservation lifecycle rules.
- V2 failure/cancellation callers must use `terminateDriveWithEntryReservation`; existing V1 topology recovery remains outside this Task 13 V2 lifecycle seam.
- Task 14 must provide node classification before merge resources are introduced; Task 15 must add conflict-zone arbitration. Neither is inferred from edge degree here.
