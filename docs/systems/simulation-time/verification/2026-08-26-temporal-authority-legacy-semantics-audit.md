# Temporal Authority Legacy Semantics Audit — 2026-08-26

**Status:** Complete for design planning; no production code changed  
**Baseline:** `master@df5b831f7bd25f2f8015ea04b1f3a5d17753c11b`  
**Purpose:** establish current temporal ownership, legacy `tick` semantics, dependency direction, and persistence assumptions before the Temporal Authority & Simulation Clock Standard v1 migration.

## Executive Result

The merged repository can host the successor standard in `simulation-core` without introducing a new `temporal-core` package today. `simulation-core` is dependency-free, while existing dependent domains either already depend on it (Building, RCI) or can add a one-way dependency without a cycle (Economy, Mobility, Traffic).

The audit also confirms that the word `tick` does **not** have one repository-wide unit:

```text
Simulation V1/V2 absoluteTick   = macro hour / hour cursor -> GameMinute via *60
Building lifecycle *AtTick      = MacroHourIndex -> rename 1:1
RCI tick/evaluation fields      = MacroHourIndex -> rename 1:1 after field proof
Economy settlement tick fields  = MacroHourIndex -> rename 1:1 after field proof
Mobility departure/boundary     = GameMinute -> AbsoluteGameMinute 1:1
Traffic V2 cursor               = TransportSecond + source GameMinute
```

That distinction is a hard migration rule.

## 1. Simulation Core

Current package: `packages/simulation-core`.

Current source authority:

- `SimulationSnapshot.absoluteGameMinute: number`
- `growthSequence`
- Simulation revision
- calendar/macro-hour projection helpers

The package has no declared workspace dependencies. This makes it the correct lower-level owner for generic game-minute, macro-hour, and calendar types unless a later concrete dependency cycle disproves the assumption.

Current calendar policy:

```text
60 minutes/hour
24 hours/day
30 days/month
12 months/year
```

Current `deriveMacroHourIndex(absoluteGameMinute)` is centralized as `floor(minute / 60)`, but inputs/outputs are raw numbers.

### Persistence evidence

Simulation V1/V2 store `absoluteTick`; migration to the minute authority already performs checked multiplication by 60. Simulation V3 stores `absoluteGameMinute` directly. Therefore Simulation legacy ticks are hour-level values and are **not** the same semantic as Building/RCI/Economy legacy tick fields.

## 2. Building

`building-core` already declares a dependency on `simulation-core`.

Current lifecycle fields retain legacy names including:

```text
constructionDurationTicks
constructionStartedAtTick
constructionCompletesAtTick
activatedAtTick
```

However lifecycle functions compare these values against a `macroHourIndex`, and construction progress subtracts them from macro-hour values. This is direct source evidence that these persisted/runtime fields represent macro hours despite the generic names.

Migration consequence:

```text
Building *AtTick -> *AtMacroHourIndex 1:1
Building *Ticks  -> *MacroHours 1:1
```

No `*60` conversion is permitted for these fields.

Building lifecycle logic remains owned by `building-core`; consumers must use Building APIs rather than recreate time comparisons.

## 3. RCI

`rci-core` already depends on `building-core`, `simulation-core`, and `world-core`.

The current RCI tick planner imports macro-hour transition logic and assigns/evaluates its generic tick values from:

```text
macroHourTransition.beforeMacroHourIndex
macroHourTransition.afterMacroHourIndex
```

The main evaluation boundary uses `afterMacroHourIndex` as the evaluation tick. This strongly supports macro-hour 1:1 migration for RCI temporal fields.

Because RCI has higher-cardinality temporal state and historical migration risk, production migration must still include golden field-by-field tests before semantic renaming. This audit is architectural evidence, not a substitute for those RED tests.

## 4. Economy

`economy-core` currently declares no workspace dependencies, so a one-way dependency on `simulation-core` is cycle-free at this baseline.

Current temporal fields include generic names such as:

```text
lastDailySettlementTick
lastMonthlyCloseTick
latestDailySettlementTick
```

Scheduled settlement receives a macro-hour transition and uses its `afterMacroHourIndex` as the effective settlement tick. The module also contains local `floor(gameMinute / 60)` validation logic, which is precisely the kind of duplicated conversion the successor temporal API should eliminate.

Migration expectation: Economy settlement tick fields are macro-hour semantics and should rename 1:1 after golden tests establish every persisted field.

## 5. Citizen Mobility

`citizen-mobility-core` currently declares no workspace dependencies.

Current schedule fields are raw game-minute values, including:

```text
departureGameMinute
nextBoundaryGameMinute
```

Migration expectation: these become `AbsoluteGameMinute` values 1:1. Adding a dependency on `simulation-core` is cycle-free on the audited baseline.

## 6. Traffic

`traffic-core` currently declares no workspace dependencies.

Traffic already distinguishes some temporal resolutions:

- legacy trip queue field: `arrivedAtGameSecond`
- V2 trip queue field: `arrivedAtTransportSecond`
- V2 time cursor: source GameMinute + absolute TransportSecond + completed quantum count
- edge travel duration: `freeFlowTravelSeconds`

Game orchestration still contains raw conversion arithmetic such as `sourceGameMinute * 4` and legacy queue time `* 4`. Those conversions must move behind explicit temporal migration/helpers while preserving four transport quanta per GameMinute.

## 7. Application-Level Atomic Temporal Minute

PR #83 already implemented the intended authority topology in `apps/game`:

```text
GameMinute
Q1
Q2
Q3
Q4
```

`temporal-publication-controller.ts` stages all five publications before invoking `publishBatchForTransaction`. A planning failure returns the original committed world; successful execution produces five ordered revision receipts and one final presentation/adoption path.

The successor therefore does **not** need a new temporal transaction architecture. It should migrate the current result/receipt fields to explicit units and retain the proven batching semantics.

## 8. Current Playback Runtime

`apps/game/src/simulation-runtime.ts` currently uses:

```text
GAME_MINUTE_MILLISECONDS = 1000
normal multiplier = 1
fast multiplier = 2
faster multiplier = 4
```

Nominal pacing is therefore:

```text
x1 = 1.000s / GameMinute
x2 = 0.500s / GameMinute
x4 = 0.250s / GameMinute
```

This audit result conflicts with the proposed successor baseline of 3.0/1.5/0.75s. Since the product motivation includes current x4 feeling too slow, this discrepancy requires explicit owner reconfirmation before playback production edits.

## 9. World Persistence

Current canonical writer: WorldSaveV8.  
Current save key: `web-three-city:world-save:v8`.

The current reader accepts legacy world save keys through V8 (with historical gaps dictated by previous schemas) plus terrain legacy input.

WorldSaveV8 composes:

```text
SimulationSaveV3
MobilitySaveV2
TrafficSaveV2
plus existing Building / RCI / Economy codecs
```

WorldSave V8 migration code already contains raw temporal conversions, including Traffic cursor derivation from `absoluteGameMinute * 4`.

The successor must make WorldSaveV9 the only writer after cutover while retaining V1–V8 decode/migration authority.

## 10. Calendar Migration Gap

Current saves encode `AbsoluteGameMinute` under a 30-day/month calendar projection. The proposed successor calendar interprets every 24-hour cycle as one month.

Preserving the same `AbsoluteGameMinute` across V8 -> V9 preserves deterministic simulation timeline position but changes the displayed calendar label. Remapping the authority to preserve the displayed date changes elapsed simulation position and can affect domain schedules.

The approved baseline design did not fully specify which continuity is authoritative. Production V9 implementation must not proceed until the owner selects an explicit policy and the selected behavior is encoded in migration tests.

## 11. Dependency Conclusion

Audited baseline dependency direction supports:

```text
Building ---------> simulation-core
RCI --------------> simulation-core
Economy ----------> simulation-core   (new dependency allowed)
Citizen Mobility -> simulation-core   (new dependency allowed)
Traffic ----------> simulation-core   (new dependency allowed if generic game-minute types are consumed)

simulation-core -X-> any of the above
```

No present evidence requires a new `temporal-core` package.

## 12. Design Stop Conditions

Before implementation planning can be declared complete:

1. owner reconfirms or replaces the 3.0/1.5/0.75 playback table after seeing the current 1.0/0.5/0.25 baseline;
2. owner chooses V8 -> V9 calendar continuity semantics;
3. TDD plan must require golden historical proof before any RCI/Economy ambiguous Tick field is renamed;
4. no migration slice may create a second mutable world clock.

No production code was changed by this audit.
