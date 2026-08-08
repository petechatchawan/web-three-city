# ADR 0001 — Integer Money and Basis-Point Rates

**Status:** Accepted for Economy Foundation v0.1

## Context

Treasury, tax, settlement, undo, replay, and persistence must be bit-for-bit deterministic across runtimes. Floating-point currency and percentage arithmetic can drift or round inconsistently.

## Decision

Represent money as signed safe-integer minor units (`100` = `1.00`) and rates as integer basis points (`10_000` = 100%). Validate all public values as safe integers. Use `bigint` for multiplication intermediates, divide after multiplication, round halves away from zero, and reject overflow before converting back to `number`. JSON persists validated numbers.

## Consequences

- Arithmetic and serialization are stable and testable.
- Treasury may be negative, while revenue/cost inputs remain non-negative.
- Formatting is presentation-only.
- The safe-integer ceiling is an explicit v0.1 scale limit rather than silent precision loss.

## Rejected Alternatives

- Floating-point major units: simple but unsuitable for authoritative accounting.
- Decimal/string money throughout: precise but adds dependency and conversion complexity not justified by current scale.
- Arbitrary-precision values in saves: JSON interoperability and UI boundaries become unnecessarily complex.

## Enforcement

`economy-core` arithmetic/validation tests, save decoders, deterministic replay tests, and architecture boundaries.
