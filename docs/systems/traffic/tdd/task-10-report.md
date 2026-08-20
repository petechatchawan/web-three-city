# Task 10 — Authoritative Short-Trip Publication

## Delivered

- Added Game-level V2 Traffic transport publication: one transport quantum advances through `advanceTrafficQuantum` and publishes the resulting Traffic and Mobility snapshots as one world candidate.
- A terminal V2 Traffic trip is removed only alongside `settleMobilityTrip`, which updates the Mobility trip and Citizen mobility state atomically.
- A failed settlement leaves the staged Mobility state active, causing the world coordinator to reject the complete candidate; the committed-world fingerprint remains unchanged.
- Added a narrow V2 snapshot bridge in committed-world cloning, without changing `package.json` or Save schema contracts.

## TDD evidence

The initial Game RED asserted that a V2 short Drive checkpoint would commit instead of being rejected. It failed with `expected 'rejected' to be 'committed'` before the V2 committed-world bridge existed.

Focused GREEN:

```text
pnpm exec vitest run apps/game/src/traffic-authoritative-short-trip.test.ts
```

Result: 1 file / 4 tests passed.

The tests cover active short Drive and Walk checkpoints, atomic `Leaving -> Arrived` Traffic/Mobility/Citizen settlement, and rejected invalid settlement with unchanged committed fingerprint.

## Verification

```text
pnpm --filter @web-three-city/traffic-core test -- drive-lifecycle.test.ts
pnpm --filter @web-three-city/traffic-core typecheck
pnpm --filter @web-three-city/citizen-mobility-core test -- commute-planning.test.ts
pnpm --filter @web-three-city/citizen-mobility-core typecheck
```

Result: all commands passed (Traffic: 9 files / 26 tests; Mobility: 5 files / 20 tests).

`pnpm --filter @web-three-city/game typecheck` remains red from existing in-progress minute-clock migration references to removed `SimulationSnapshot.absoluteTick`; no Task 10 source paths are reported by the filtered diagnostic scan.

## Assumptions and residual risk

- This task intentionally does not add canonical headway, reservations, or intersection arbitration.
- The legacy save schema remains V1; explicit persistence migration is deferred to the planned Traffic/World save cutover.
- The runtime event loop still needs its separate transport-event dispatch integration before this transaction is exercised by normal Game playback. The new transaction is verified at the authoritative world-publication seam.
