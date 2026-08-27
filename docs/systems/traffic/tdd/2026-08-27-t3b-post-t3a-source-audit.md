# T3B Post-T3A Source Audit

**Status:** SOURCE-AUDITED / IMPLEMENTATION NOT STARTED  
**Audited master:** `4a9ca6c18a4360d9576db8c5ab55c69f64e20cd7`  
**T3B branch base:** `feat/t3b-traffic-temporal-migration@4a9ca6c18a4360d9576db8c5ab55c69f64e20cd7`

This audit refines `2026-08-26-traffic-temporal-contract-migration.md` after T3A merged. It does not change T3B product semantics.

## Confirmed plan assumptions

1. `packages/traffic-core/src/transport-time.ts` remains the correct Traffic-owned time seam, but its cursor is still raw-number based and computes `sourceGameMinute * 4` directly.
2. `packages/traffic-core/package.json` still has no dependency on `@web-three-city/simulation-core`; T3B must add the one-way dependency.
3. `ActiveTransportTripV2.queuedMovement.arrivedAtTransportSecond` is still a raw `number`.
4. `apps/game/src/game-minute-transaction.ts` still constructs V2 Traffic time with raw `sourceGameMinute * 4` and converts V1 queue timestamps with raw `arrivedAtGameSecond * 4`.
5. `apps/game/src/simulation-runtime.ts` still owns a duplicate local `TRANSPORT_QUANTA_PER_GAME_MINUTE = 4` while emitting Q1..Q4.
6. `tooling/temporal-unit-boundary.test.mjs` still recognizes only Simulation temporal types and has a single whole-file trust boundary for `simulation-core/src/temporal-units.ts`.
7. T3A remains intact: Mobility runtime uses explicit `AbsoluteGameMinute` and `scheduleCursorCycle`; no T3B/T4 implementation was introduced by T3A.

## Additional transport-time seams discovered after plan freeze

The implementation plan must include these seams so transport-point arithmetic does not remain raw after branding:

- `packages/traffic-core/src/traffic-quantum.ts`
  - `advanceRouteSegment(... arrivedAtTransportSecond: number)`
  - `advanceOneQuantum(... arrivedAtTransportSecond: number)`
  - queue creation forwards the raw point into `arrivedAtTransportSecond`.
- `packages/traffic-core/src/intersection-arbitration.ts`
  - `IntersectionArbitrationCandidate.queuedAtTransportSecond: number`
  - `currentTransportSecond: number`
  - raw point subtraction and raw point ordering are used for age promotion and deterministic queue ordering.
- `apps/game/src/mobility-traffic-tick.ts`
  - the V2-to-V1 compatibility view currently performs `Math.floor(arrivedAtTransportSecond / 4)`.
  - the legacy optional V1 progression path still uses GameSecond arithmetic (`gameMinute * 60`). The normal authoritative five-phase path calls this planner with `advanceTraffic: false`, so this is compatibility/legacy progression rather than the Q1..Q4 authority path. T3B must classify it, not redesign Mobility semantics.
- `packages/traffic-core/src/traffic-migration.ts`
  - V1 queue migration currently rebases queue age using raw `legacyCurrentGameSecond` and raw `currentTransportSecond`.
  - preserve its age-preserving semantics; do not replace it blindly with a direct `legacyTimestamp * 4` mapping.

## Required API refinement

The frozen T3B plan already requires `AbsoluteTransportSecond`, `TransportSecondDuration`, checked construction, addition, value access and comparison. Post-T3A source proves one additional owner helper is necessary to remove raw point subtraction from intersection arbitration:

```ts
export function transportSecondDurationBetween(
  later: AbsoluteTransportSecond,
  earlier: AbsoluteTransportSecond,
): TransportSecondDuration;
```

Contract:

- returns `later - earlier` as a validated non-negative `TransportSecondDuration`;
- rejects reversed points rather than returning a signed duration;
- arithmetic lives only inside Traffic's trusted transport-time authority;
- consumers compare/order points through `compareTransportSeconds()` and obtain elapsed duration through `transportSecondDurationBetween()`.

This is a refinement of the existing T3B type model, not a new temporal unit.

## Architecture enforcement refinement

Do **not** implement Traffic trust by skipping all checks in `transport-time.ts`.

The architecture gate must become ownership-aware:

```text
Simulation types
  trusted constructor/cast boundary = simulation-core/src/temporal-units.ts

Traffic transport types
  trusted constructor/cast boundary = traffic-core/src/transport-time.ts
```

`transport-time.ts` consumes `AbsoluteGameMinute`; therefore it must still be subject to Simulation-type rules even while it is trusted to construct Traffic-owned types.

## T3B execution invariants after T3A

- `AbsoluteGameMinute` remains the sole mutable world-calendar authority.
- Four Traffic quanta per GameMinute remains exactly 4.
- Successful publication remains `GameMinute -> Q1 -> Q2 -> Q3 -> Q4`, revision `+5`.
- Traffic routing, lane occupancy, intersection policy, headway, drive lifecycle, entry/leave behavior, physical progress and rendering remain behavior-identical.
- Mobility trip identity, mode, purpose, schedule-cycle behavior and V1/V2 wire compatibility remain unchanged.
- Traffic V1/V2 wire field names remain unchanged in T3B; WorldSave/domain writer version changes belong to T5.
- No T4 compressed-calendar implementation is allowed in T3B.

## Stop conditions

Stop and review before pushing if implementation would require any of the following:

- changing four-quanta cadence;
- changing queue age semantics during V1 migration;
- weakening the temporal architecture scanner;
- casting raw numbers directly to Traffic temporal types outside the trusted owner seam;
- changing Mobility schedule/catch-up semantics to eliminate a Traffic compatibility adapter;
- changing Traffic routing/physical policy to satisfy typed-time tests;
- introducing T4 calendar projection or T5 writer-version work.

## Local execution rule

RED remains local only. Push only a GREEN candidate after the T3B owner tests, combined T3A+T3B Game/Mobility/Traffic tests, deployment, `pnpm check`, selective verification, resolver-required Browser authority and `git diff --check` are GREEN.
