# Task 17 — TrafficSaveV2 persistence and migration

## Scope

Implemented `TrafficSaveV2` encode/decode and explicit `TrafficSaveV1 -> TrafficSaveV2` migration in `traffic-core`.

Persisted authority is limited to the V2 snapshot cursor and trip facts: route identity, progress, Drive lifecycle phase, access reservation facts, transport-time queue timestamp, and active node traversal reservations. Derived lane occupancy, leader maps, graph caches, conflict matrices, and global resource-owner maps are rebuilt after load and are not serialized.

## TDD evidence

RED command (Node 22):

```bash
pnpm --filter @web-three-city/traffic-core test -- traffic-v2-migration.test.ts
```

Before implementation, `traffic-v2-migration.test.ts` failed its intended assertions because `encodeTrafficSaveV2`, `decodeTrafficSaveV2`, and `migrateTrafficSaveV1ToV2` were undefined. The same package invocation also ran four pre-existing Task 16 road-mutation tests, which fail because `reconcileTrafficReservationsAfterRoadMutation` is not implemented.

GREEN focused command:

```bash
cd packages/traffic-core
pnpm exec vitest run test/traffic-v2-migration.test.ts
```

Result: 1 file passed, 4 tests passed.

## Migration rules implemented

- V1 Drive trips migrate to `Travelling`; Walk and terminal trips have no Drive phase.
- Legacy queue values are rebased from their age relative to an explicit legacy clock checkpoint into the supplied V2 transport cursor.
- The one-time V1 migration sorts same-edge Drive trips front-to-back, preserves the leader, only rewinds followers, and returns insufficient-origin-storage overflow to `WaitingForEntry`.
- V2 decoding validates same-edge canonical headway and rejects an overlapping current-schema save without normalization.

## Verification

```bash
pnpm --filter @web-three-city/traffic-core typecheck
```

Result: passed.

```bash
pnpm --filter @web-three-city/traffic-core test
```

Result: blocked by four unrelated failures in `test/road-mutation-reservation.test.ts`; each is `TypeError: api.reconcileTrafficReservationsAfterRoadMutation is not a function`. All Task 17 migration tests pass in isolation.

## Residual risk

Task 17 does not implement the Task 16 road-mutation reconciliation API or WorldSaveV8 composition; those remain owned by their respective tasks.
