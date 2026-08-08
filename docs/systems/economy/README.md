# Economy System

**Status:** Partial — Core, Treasury, and Scheduled Settlement implemented

**Milestone:** Economy Foundation v0.1

**Primary ownership:** `packages/economy-core`; composition by `apps/game`

**Persistence:** planned `EconomySaveV1` within the next `WorldSave` version

## Purpose

Economy Foundation v0.1 defines a deterministic aggregate municipal economy: treasury, R/C/I tax policy and revenue, player-action costs, road maintenance, monthly accounting, and lagged tax-pressure feedback to RCI.

The framework-independent Economy foundation provides deterministic money/rate arithmetic, versioned rules, the authoritative snapshot, pure Treasury/tax-policy commands, aggregate accounting, taxable projections, and scheduled daily/monthly settlement. `apps/game` now includes Economy in atomic background-tick candidates. Paid actions, persistence, RCI policy feedback, and UI remain unimplemented.

## Ownership

Economy owns only:

- integer minor-unit money and basis-point tax-rate contracts;
- treasury and tax policy;
- current and previous municipal accounting periods;
- daily settlement and monthly-close markers;
- versioned Economy rules, validation, quotes, deltas, and snapshots.

Economy does not own citizens, households, jobs, buildings, roads, terrain, simulation time, RCI demand, or presentation state. The application supplies immutable projections from those authorities and publishes dependent changes through the existing committed-world transaction coordinator.

## Foundation Workflows

- Paid road, terraform, and bulldoze commands are planned, quoted, checked for affordability, staged with an Economy debit, cross-validated, and published atomically.
- Zoning and automatic/private RCI growth remain free in v0.1.
- At the canonical daily 08:00 boundary, Economy derives tax revenue and road maintenance from application projections.
- At Day 1 08:00, the previous month closes before the new day's settlement is recorded in the newly opened period.
- RCI reads tax-pressure factors derived from the previously committed Economy state; Economy then settles from the newly staged RCI state. There is no same-tick cycle.
- Presentation consumes an Economy projection and submits typed application commands; it never mutates Economy state.

Paid actions, lagged policy feedback, persistence, and presentation remain approved contracts for later implementation PRs.

## Current Implementation

- [`money.ts`](../../../packages/economy-core/src/money.ts) validates safe-integer minor units/basis points and performs checked ratio arithmetic with `bigint` intermediates.
- [`rules.ts`](../../../packages/economy-core/src/rules.ts) owns and validates `economy-rules.foundation.v1`.
- [`economy-snapshot.ts`](../../../packages/economy-core/src/economy-snapshot.ts) creates, clones, validates, and fingerprints `EconomySnapshotV1`.
- [`treasury-accounting.ts`](../../../packages/economy-core/src/treasury-accounting.ts) applies revision-fenced policy changes and categorized Economy deltas, enforces immediate affordability, permits recurring deficits, closes periods, and derives cost/accounting summaries.
- [`scheduled-settlement.ts`](../../../packages/economy-core/src/scheduled-settlement.ts) validates narrow RCI/Road projections and applies once-only 08:00 tax and maintenance settlement.
- The package has no runtime dependency and no DOM/Three.js library access.
- `apps/game` derives projections from staged RCI and authoritative Road state, validates Economy in `CommittedWorld`, fingerprints it, and publishes Simulation/Building/RCI/Economy once.

## Determinism and Failure

- Money uses safe integer minor units; tax rates use integer basis points.
- Authoritative multiplication uses checked integer intermediates and one specified rounding rule.
- A failed plan, quote, validation, or publication changes neither world nor treasury.
- Recurring expenses may make treasury negative; a positive-cost player command is rejected when unaffordable.
- Undo applies an exact compensating Economy delta to the current world. It does not restore an old Economy snapshot.
- Pause advances nothing; Step advances exactly one ordinary authoritative tick.

## Deliberate Limits

There are no citizen wallets, wages, rent, business accounts, loans, bonds, inflation, production chains, utility billing, service budgets, land value, abandonment, density upgrades, or traffic-productivity economics in v0.1.

## Planning Authority

- [Economy Foundation v0.1 specification](specs/2026-08-08-economy-foundation-v0-1.md)
- [TDD implementation plan](tdd/2026-08-08-economy-foundation-v0-1.md)
- [Money and rates ADR](adrs/0001-integer-money-and-basis-point-rates.md)
- [Municipal authority ADR](adrs/0002-aggregate-municipal-economy-authority.md)
- [Atomic transaction ADR](adrs/0003-economy-in-atomic-world-transactions.md)
- [Lagged RCI feedback ADR](adrs/0004-lagged-economy-rci-feedback.md)
- [Persistence ADR](adrs/0005-economy-persistence-and-migration.md)

Later implementation PRs must update this overview in the same PRs that establish their contracts.
