# ADR-0003: Explicit Temporal Units

**Status:** Accepted — implementation deferred to successor
**Date:** `2026-08-25`
**System:** `simulation-time`

## Context

Legacy `tick` fields represent multiple units. Simulation V1/V2 ticks are hours
that migrate to minutes, Building/RCI/Economy ticks remain macro hours, Mobility
uses game minutes, and Traffic V2 uses transport seconds. All are currently
plain numbers, allowing valid numeric values with incompatible meanings to be
compared without a compile-time or validation failure.

## Decision

`simulation-core` owns explicit game-minute and macro-hour point/duration types;
`traffic-core` owns transport-second point/duration types while consuming the
game-minute authority. Constructors validate raw values at trusted boundaries.
Conversion, arithmetic, and comparison use named helpers.

Runtime contracts use semantic property names. Architecture tooling rejects
cross-unit operators, direct temporal casts, and `as unknown as` escapes. Domain
packages may depend on `simulation-core`; `simulation-core` never imports them.

Persistence remains integer-based with explicit names and one envelope-level
temporal-standard discriminator, avoiding object wrappers for high-cardinality
timestamps.

## Consequences

### Positive

- Unit intent is visible in APIs, persistence, review, and errors.
- Assignment/call-site mistakes fail typecheck; operator mistakes fail the
  architecture contract.
- The canonical world timeline remains singular.

### Negative

- Public contract migration affects Simulation, Building, RCI, Economy,
  Mobility, Traffic, Game, render consumers, fixtures, and Save codecs.
- Workspace dependency policy and Level 2 verification mapping must change.
- Arithmetic helpers add migration work even when underlying values remain
  integers.

## Alternatives Considered

### Branded numbers without architecture enforcement

Rejected because TypeScript still permits relational operators between branded
numeric values.

### `{ value, unit }` runtime objects for every timestamp

Rejected because RCI stores many timestamps per Citizen and would pay avoidable
allocation, fingerprint, and Save-size costs.

### Keep names and patch known comparisons

Rejected as the long-term standard because new cross-unit call sites would
remain easy to introduce.

## Enforcement

- Type-level assignment/call tests.
- Type-aware AST tests for operators and casts.
- Codec tests are the only raw JSON-to-temporal constructor boundary.
- Static dependency and Level 2 topology tests.

## Supersession

Does not change ADR-0001 calendar mapping; it makes ADR-0001 units explicit.
