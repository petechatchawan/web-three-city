# ADR-0002: WorldSaveV9 Temporal and Calendar Policy Migration

**Status:** Proposed — successor design; legacy calendar continuity policy pending owner confirmation  
**Date:** `2026-08-26`  
**System:** `world`  
**Supersedes when accepted:** ADR-0001 WorldSaveV9 Temporal Unit Migration

## Context

ADR-0001 intentionally kept the legacy calendar mapping unchanged in WorldSaveV9 and deferred any compressed-calendar cutover to a later schema/policy decision. The successor Temporal Authority & Simulation Clock Standard v1 now intends to deliver explicit temporal units and the compressed calendar as one coordinated migration.

WorldSaveV8 persists `absoluteGameMinute` under the legacy 24-hour/day, 30-day/month projection. The successor calendar interprets one 24-hour simulation cycle as one calendar month. A raw V8 `absoluteGameMinute` can therefore preserve timeline position or preserve the old displayed date, but not both automatically.

## Proposed Decision

WorldSaveV9 becomes the canonical writer after cutover and composes:

```text
SimulationSaveV4
BuildingSaveV3
RciSaveV2
EconomySaveV2
MobilitySaveV3
TrafficSaveV3
```

The world envelope identifies temporal semantics and calendar interpretation once, without wrapping every timestamp:

```text
temporalStandardVersion = 1
calendarPolicyVersion   = 1
```

The V9 reader validates these discriminators and rejects unknown values. Runtime temporal fields use semantically explicit names and validated integer representation.

Reader compatibility remains V1–V9. Writer authority becomes V9 only.

## Legacy Unit Migration

- Simulation V1/V2 `absoluteTick` is an hourly cursor and migrates using checked `* 60` to `AbsoluteGameMinute`.
- Building lifecycle `*AtTick` and `*Ticks` represent macro hours and migrate 1:1 to explicit macro-hour fields.
- RCI and Economy generic Tick fields migrate 1:1 only after golden historical tests prove each field's macro-hour meaning.
- Mobility GameMinute values migrate 1:1 to `AbsoluteGameMinute`.
- Traffic V2 TransportSecond values migrate 1:1 to `AbsoluteTransportSecond`; legacy conversion paths move behind explicit codec helpers.

## Pending Calendar Continuity Decision

Choose exactly one policy before V9 production implementation:

### A. Authority continuity — recommended

Preserve legacy `AbsoluteGameMinute` 1:1. Domain timeline continuation remains deterministic. On first load under V9 the displayed month/year is projected using the new compressed policy and may differ from the legacy label.

### B. Display-calendar continuity

Apply a one-time checked authority remap so the new compressed projection represents the closest equivalent legacy displayed calendar position. This requires explicit parity tests for Building, RCI, Economy, Mobility, and Traffic because schedule position changes.

The migration must never infer a policy from numeric shape or silently reinterpret an old save without a tested rule.

## Consequences

### Positive

- V9 unambiguously identifies both temporal units and calendar interpretation.
- High-cardinality records remain compact integers rather than `{value, unit}` wrappers.
- Old save semantics are handled at one trusted migration boundary.

### Negative

- Calendar cutover makes legacy continuity a product decision, not a codec-only rename.
- Six domain codecs plus the world envelope need new migration/round-trip evidence.
- Option B is substantially riskier because it changes absolute timeline position.

## Enforcement

- Golden V1–V8 fixtures.
- Unit-discriminator and calendar-policy rejection tests.
- Uninterrupted-versus-save/load continuation at `N:59 -> N+1:00`.
- Construction-in-progress, RCI, Economy, Mobility, and Traffic continuation tests.
- V9 writer tests assert no ambiguous legacy temporal field names remain.
- V9 is not implemented until the owner selects A or B.

## Supersession

Once the continuity policy is explicitly approved, this ADR becomes Accepted and supersedes ADR-0001. ADR-0001 remains the record of the earlier decision to keep calendar mapping unchanged in the initial V9 proposal.
