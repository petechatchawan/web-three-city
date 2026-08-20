# Task 18 — MobilitySaveV2 + WorldSaveV8

## Delivered

- Added fail-closed `MobilitySaveV2` encoding/decoding and a pure, explicit `MobilitySaveV1 -> MobilitySaveV2` migration. The V2 envelope declares `SchedulePolicyV2` for future boundaries while preserving existing Citizen state and committed trip facts.
- Added `WorldSaveV8` as the current encoder composition: `SimulationSaveV3`, `MobilitySaveV2`, and `TrafficSaveV2`, with unchanged Economy/RCI/Terrain/Road/Zone/Building children.
- Retained explicit V7 decoding. V7 simulation hour `8` becomes game minute `480`; V7 Mobility and Traffic children migrate without mutating the supplied V7 payload. V1 Traffic migration receives an explicit time cursor and uses the existing Traffic migration/normalization authority.
- Updated the save coordinator to write `web-three-city:world-save:v8` and retain discovery of `v7` through Terrain V1 keys.
- V8 decoding preserves the saved Traffic transport cursor, including `completedTransportQuantaWithinMinute`; it does not reset to quantum zero or advance a minute.

## TDD evidence

Initial RED:

```text
pnpm --filter @web-three-city/citizen-mobility-core test -- persistence-v2.test.ts
```

Under Node 22, both tests failed as intended because `encodeMobilitySaveV2`, `decodeMobilitySaveV2`, and `migrateMobilitySaveV1ToV2` were undefined.

Focused GREEN:

```text
cd packages/citizen-mobility-core && pnpm exec vitest run test/persistence-v2.test.ts
cd apps/game && pnpm exec vitest run src/world-save-v8.test.ts src/application/save-coordinator.test.ts
```

Results: Mobility `2/2` passed; Game save tests `5/5` passed.

## Verification

Passed:

```text
packages/citizen-mobility-core: persistence-v2 test and typecheck
packages/simulation-core: serialization-v3 test and typecheck
packages/traffic-core: traffic-v2-migration test and typecheck
apps/game: focused WorldSaveV8 and SaveCoordinator tests
```

Full owner suites:

```text
simulation-core: 5 files / 15 tests passed
citizen-mobility-core: 6 files / 22 tests passed
traffic-core: 14 files / 57 tests passed; 1 file / 4 tests blocked
```

The Traffic blocker is outside Task 18: `road-mutation-reservation.test.ts` expects the Task 16 API `reconcileTrafficReservationsAfterRoadMutation`, which is not exported yet.

`apps/game` typecheck remains blocked by pre-existing concurrent minute-authority migration work: many files still reference removed `SimulationSnapshot.absoluteTick`. The Task 18 files had two local type diagnostics after the first run; both were corrected. The remaining diagnostics are outside this task's assigned save-integration files.

The package `test` scripts run their entire package despite file arguments. The Game suite currently has broad failures from the same unfinished `absoluteTick -> absoluteGameMinute` cutover, so only direct focused Vitest invocation is valid Task 18 evidence at this stage.

## Assumptions and residual risk

- `TrafficSaveV1 -> V2` uses the decoded V7 simulation minute as the explicit legacy clock checkpoint and starts the V2 cursor at quantum zero of that migrated minute.
- Current in-memory V1 Traffic is explicitly migrated during V8 encoding using the authoritative derived graph. This is a version conversion for the current encoder; it does not mutate the in-memory snapshot or an old payload.
- Full continuous-versus-resumed active-trip equivalence remains dependent on the in-progress Game/CommittedWorld V2 type migration. The V8 codec preserves the authoritative cursor and all TrafficSaveV2 fields, but the active checkpoint fixture cannot be finalized until the owning Game transaction types stop exposing the V1 compatibility shape.
