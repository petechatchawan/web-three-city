# Task 11 — Remove synthetic Journey Replay production path

## Scope completed

- Removed the completed-trip receipt bridge from `game-world-tick` through `main` to presentation.
- Deleted `apps/game/src/traffic-journey-receipt-registry.ts`.
- Removed replay pools, replay state, wall-clock replay timings, replay-frame materialization, replay debug counters, and replay inspection fallback.
- `TrafficRuntimePresentation` now materializes only the current authoritative Traffic projection.
- Kept generic Traffic transaction receipts as non-motion diagnostics; no production presentation code consumes them.

## TDD evidence

- RED: `pnpm exec vitest run apps/game/src/traffic-runtime-presentation.test.ts --reporter=verbose`
  failed on the new guard because `traffic-runtime-presentation.ts` still contained `TrafficJourneyReplay`.
- GREEN: the same focused test passes after removal. The guard forbids replay pools, `REPLAY_` timing constants, `enqueueJourneyReceipts`, and the receipt registry in the production runtime path.

## Verification

- PASS: `pnpm exec vitest run apps/game/src/traffic-runtime-presentation.test.ts apps/game/src/traffic-presentation.test.ts apps/game/src/traffic-presentation-lane-reprepare.test.ts --reporter=verbose`
  — 3 files, 9 tests.
- PASS: production-source search for `JourneyReplay`, `replayVehicles`, `replayPedestrians`, `REPLAY_`, `enqueueJourneyReceipts`, and `traffic-journey-receipt-registry` under `apps/game/src` (excluding tests) returned no matches.
- PASS: `git diff --check`.
- BLOCKED (pre-existing integration work): `pnpm --filter @web-three-city/game typecheck` reports repository-wide Task 10 migration errors caused by consumers still using `SimulationSnapshot.absoluteTick` after the snapshot contract changed to `absoluteGameMinute`. No reported error is in a Task 11 file.

## Assumptions and residual risk

- The Task 10 authoritative checkpoint work is responsible for ensuring short trips remain active across published Traffic snapshots; Task 11 deliberately adds no replacement motion path.
- Full Game test/typecheck closure must follow once the concurrent Simulation/Task 10 migration is reconciled.
