# ADR-0002: WorldSaveV9 Temporal and Calendar Policy Migration

**Status:** Accepted  
**Date:** `2026-08-26`  
**System:** `world`  
**Supersedes:** ADR-0001 WorldSaveV9 Temporal Unit Migration

## Context

WorldSaveV8 persists `absoluteGameMinute` under the legacy 24-hour/day, 30-day/month projection. The successor calendar interprets one 24-hour Simulation Cycle as one calendar month and 12 cycles as one year.

Preserving a legacy displayed date would require remapping the canonical world clock, changing schedule position. Preserving canonical authority 1:1 changes only how the old timestamp is labeled by the new calendar. RCI additionally uses legacy 360-day/year age semantics, so blindly migrating every RCI Tick field 1:1 would make citizens approximately 30x older under the new year length.

## Decision

WorldSaveV9 becomes the canonical writer after cutover and composes:

```text
SimulationSaveV4
BuildingSaveV3
RciSaveV2
EconomySaveV2
MobilitySaveV3
TrafficSaveV3
```

The world envelope carries:

```text
temporalStandardVersion = 1
calendarPolicyVersion   = 1
```

Reader compatibility remains V1–V9. Writer authority becomes V9 only. Unknown temporal/calendar discriminators reject the whole Save.

### Canonical time continuity

V8 `AbsoluteGameMinute` migrates **1:1**. The new calendar reprojects that authority; a legacy save may therefore display a different month/year after first migration. The canonical clock is not remapped merely to preserve the old 30-day-calendar label.

### Domain migration rules

- Simulation V1/V2 `absoluteTick` is an hourly cursor and migrates with checked `*60` to `AbsoluteGameMinute`.
- Building lifecycle Tick fields represent macro hours and migrate 1:1.
- Economy operational settlement Tick fields migrate 1:1 after golden field proof.
- Mobility GameMinute values migrate 1:1.
- Traffic V2 transport-second values migrate 1:1.
- RCI fields are **classification-driven**, not blanket 1:1.

RCI age-origin state such as `bornAtTick` uses a checked age-preserving cutover relative to the current macro hour:

```text
legacy year = 8640 macro hours
new year    =  288 macro hours

legacyElapsed = currentMacroHour - legacyBornMacroHour
newElapsed    = floor(legacyElapsed * 288 / 8640)
newBorn       = currentMacroHour - newElapsed
```

This preserves whole age-years, age-band, monotonic ordering, and proportional fractional-year position while canonical `AbsoluteGameMinute` remains unchanged. Historical event points, relationship/membership timestamps, cycle counters, and durations follow their separately proven semantic classification; they are not automatically age-scaled.

## Persistence Shape

New V9 timestamps remain validated integers with semantically explicit property names. The envelope-level policy versions avoid allocating `{value, unit}` wrappers for high-cardinality RCI records.

Raw historical numeric values may be converted only inside trusted codec/migration boundaries using owning temporal constructors/helpers.

## Consequences

### Positive

- One canonical world timeline survives migration unchanged.
- V9 unambiguously identifies temporal and calendar interpretation.
- Existing citizen ages do not jump during the calendar cutover.
- High-cardinality saves remain compact.
- Future calendar policies cannot silently reinterpret V9.

### Negative

- Legacy displayed calendar labels intentionally change.
- RCI migration is field-sensitive and requires more golden evidence than a blanket rename.
- Six domain codecs plus the world envelope need coordinated migration tests.

## Alternatives Considered

### Remap `AbsoluteGameMinute` to preserve legacy displayed date
Rejected because it changes the canonical schedule position for Building, RCI, Economy, Mobility, and Traffic.

### Migrate all RCI Tick fields 1:1
Rejected because age-bearing state would be reinterpreted against a year 30x shorter.

### Keep V8 writer
Rejected because persisted semantics would remain ambiguous.

### Per-record `{value, unit}` wrappers
Rejected due to RCI cardinality and redundant unit metadata.

## Enforcement

- Golden V1–V8 fixtures with field-semantic assertions.
- V8 -> V9 tests proving `AbsoluteGameMinute` 1:1.
- RCI age-origin tests for newborn, child, working-age, senior, fractional year, ordering, and invalid future/unsafe timestamps.
- Building/Economy/Mobility/Traffic continuation tests.
- Save at `N:59`, load, cross `N+1:00`, compare deterministic authority outcomes.
- V9 writer tests assert semantic field names and valid policy discriminators.
- Browser Save/load evidence for migrated V8 and fresh V9 cities.

## Supersession

This ADR supersedes ADR-0001. ADR-0001 remains the record of the earlier proposal that kept legacy calendar mapping unchanged.