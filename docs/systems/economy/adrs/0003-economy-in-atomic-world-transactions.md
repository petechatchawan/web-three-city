# ADR 0003 — Economy in Atomic World Transactions

**Status:** Accepted for Economy Foundation v0.1

## Context

Paid world commands affect two authorities. Publishing a road/terrain/building change separately from its debit can create impossible partial success. Restoring a whole old Economy snapshot during Undo would erase settlements that occurred later.

## Decision

Extend the existing `CommittedWorld` candidate, fingerprint, validation, and one-shot publication path to include Economy. A paid command plans its domain change, derives a deterministic quote, checks affordability, stages domain and Economy deltas, derives dependents, validates the full candidate, and publishes once.

Successful commands retain a session-only typed inverse plus exact Economy receipt. Undo applies the inverse and a compensating refund to the current committed world atomically. It never restores an old Economy snapshot. v0.1 retains one-step LIFO Undo and does not add redo.

## Consequences

- Failure before publication changes neither authority.
- Presentation failure remains downstream and cannot roll back the world.
- Settlement between command and Undo is preserved.
- Undo may reject if its domain inverse is no longer valid; it never forces state or refunds alone.
- A future redo must be a freshly quoted, affordable command.

## Rejected Alternatives

- Separate domain and Economy commits: admits partial publication.
- Compensate after a failed second commit: observable intermediate state and failure-prone recovery.
- Restore the entire previous world: destroys unrelated simulation and settlement progress.
- Introduce a second transaction framework: duplicates the architecture already established by the committed-world coordinator.

## Enforcement

Atomicity/failure-injection tests, world fingerprint tests, Undo-after-settlement tests, typed result contracts, and browser interaction acceptance.
