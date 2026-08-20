# ADR-0001: Minute calendar with derived macro-hour compatibility

**Status:** Accepted  
**Date:** `2026-08-20`  
**System:** `simulation-time`

## Context

Traffic requires observable, deterministic progression within what was formerly one hour-wide Simulation tick. Building, RCI, and Economy already have intentional hour-domain durations and boundary rules. Reinterpreting their existing values as minutes would accelerate their behavior by sixty.

## Decision

`SimulationSnapshot.absoluteGameMinute` is the sole canonical calendar cursor. `macroHourIndex` is derived only as `floor(absoluteGameMinute / 60)`. Consumers run legacy hourly work only when a minute transition crosses that derived boundary. V1/V2 saves migrate `absoluteTick` exactly to `absoluteGameMinute = absoluteTick * 60`; the current encoded child schema is `SimulationSaveV3` in `WorldSaveV8`.

Traffic may keep a subordinate versioned transport cursor, but it is not a calendar and cannot advance Building, RCI, or Economy semantics.

## Consequences

- Minute transitions can publish Mobility intent without multiplying hourly domain work.
- Calendar authority remains singular and Save migration is explicit/fail-closed for unsafe numeric conversion.
- `apps/game` must coordinate minute and transport transactions atomically.
- Seasonal calendars, offline progress, and a generic scheduler remain out of scope.
