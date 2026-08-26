# ADR-0002: Atomic Temporal Minute Publication

**Status:** Accepted
**Date:** `2026-08-25`
**System:** `simulation-time`

## Context

The runtime advances one game minute through five ordered authority transitions:
`GameMinute`, then four Traffic transport quanta. Intermediate presentation and
subscriber notification are already suppressed, but the live committed-world
store is mutated after each transition. A later quantum rejection can therefore
leave internal authority partway through a minute, while a GameMinute rejection
currently returns the unchanged world without stopping playback or exposing its
cause.

## Decision

Plan and validate all five candidate worlds against an immutable original before
mutating the live store. A dedicated synchronous batch operation validates the
revision/fingerprint chain and installs the five prepared candidates without
callbacks, asynchronous boundaries, presentation, or subscriber notification.
Only the final world is externally published.

A successful batch has five phase receipts, advances one game minute, and adds
five world revisions. A rejected batch leaves the original world unchanged and
returns the exact failed phase and typed reason. The runtime pauses and does not
automatically retry.

## Consequences

### Positive

- No observer sees a partial temporal minute.
- Later-quantum failure cannot strand the live world at an intermediate cursor.
- Five-phase authority, validation, fingerprints, and revision history remain
  explicit.
- Failure is diagnosable and bounded instead of becoming a hot retry loop.

### Negative

- Temporal planning must retain five prepared candidates and receipts until
  acceptance.
- The committed-world store and transaction coordinator gain a specialized
  batch seam in addition to ordinary one-revision commands.
- Phase planners must remain pure with respect to external state.

## Alternatives Considered

### Keep sequential live commits and only pause on rejection

This prevents retry loops but permits a Q-phase failure to leave partial
authority committed.

### Collapse the minute into one revision

Rejected because Traffic transport cursor and parity/debug contracts require
five ordered authority transitions and final revision `+5`.

### Spread quanta across animation frames

Rejected because wall-clock scheduling must not change deterministic authority
or expose partial-minute state.

## Enforcement

- Candidate-chain tests assert revisions `R+1..R+5`, fingerprints, and receipts.
- Failure injection at every phase asserts the original store identity/content,
  no presentation, and no subscriber notification.
- Browser tests assert no automatic retry and paused failure UI.
- No phase planner may invoke presentation, analytics, storage, network, or
  user-visible events.

## Supersession

Supersedes only the live-store sequencing portion of ADR-0001; minute calendar
authority and macro-hour compatibility remain unchanged.
