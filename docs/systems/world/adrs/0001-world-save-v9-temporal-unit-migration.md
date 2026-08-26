# ADR-0001: WorldSaveV9 Temporal Unit Migration

**Status:** Accepted — implementation deferred to successor
**Date:** `2026-08-25`
**System:** `world`

## Context

WorldSaveV8 composes domain codecs whose temporal fields use several units and
legacy `tick` names. TypeScript runtime migration alone cannot make untrusted JSON
unambiguous, while wrapping every RCI timestamp in an object would substantially
increase high-cardinality Save size and allocation.

## Decision

WorldSaveV9 composes new Simulation, Building, RCI, Economy, Mobility, and
Traffic codecs with semantic field names and one envelope-level temporal
standard discriminator. Timestamp values remain validated integers. The reader
accepts V1–V9; the canonical writer emits V9 only.

Legacy Simulation V1/V2 ticks migrate to game minutes with checked multiplication
by 60. Legacy Building, RCI, and Economy ticks migrate 1:1 to macro hours.
Mobility game-minute and Traffic transport-second values migrate 1:1. Calendar
mapping and playback pacing remain unchanged in V9.

## Consequences

### Positive

- New Saves identify temporal semantics without per-record wrapper overhead.
- Existing cities retain deterministic continuation.
- Future calendar redesign cannot silently reuse V9 semantics.

### Negative

- Six domain codecs and the world envelope require new golden migration tests.
- Writer upgrades affect deployment fixtures and browser Save/load evidence.

## Alternatives Considered

### Keep V8 and rely only on runtime names

Rejected because persisted legacy names remain the canonical writer output.

### Store `{value, unit}` for every timestamp

Rejected due to RCI Save cardinality and redundant per-value unit data.

### Combine V9 with compressed calendar migration

Rejected to preserve current gameplay semantics and isolate migration failures.

## Enforcement

- Golden V1–V8 fixtures and uninterrupted-versus-save/load continuation tests.
- V9 codec rejection for unknown unit standard and unsafe integers.
- Writer tests assert V9-only output and no legacy ambiguous fields.

## Supersession

A future calendar-policy migration requires a new schema or explicit calendar
policy version; it cannot reinterpret V9 in place.
