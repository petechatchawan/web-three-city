# Citizen Mobility Foundation v0.1 — Design Specification

**Status:** Approved  
**System:** `citizen-mobility`  
**Date:** `2026-08-15`  
**Umbrella milestone:** Citizen Mobility & Traffic Foundation v0.1

## Decision Summary

Citizen Mobility v0.1 adds deterministic logical activity and trip state for every present Citizen without replacing the existing RCI Citizen authority. The existing RCI record remains the sole identity/lifecycle source for Citizens, Households, Housing, Employment, migration, and RCI Demand. Citizen Mobility owns only what a present Citizen is doing, when the next activity boundary occurs, whether a trip is active, the trip purpose/origin/destination, and the selected transport mode.

The first production activity loop is real Home ↔ Work commuting. Walk and Drive are first-class modes. Every mobility trip belongs to a real Citizen and is consumed by Traffic; later visual pedestrians and cars must trace back to that same `citizenId`. The v0.1 activity schema is generic enough for later Home → Work → Shop → Leisure → Service → Home schedules, but those additional behaviors are deliberately out of scope for the first release.

Authoritative mobility time is deterministic and integer-based. The existing Simulation contract remains one tick = one game hour. Mobility adds an integer game-minute coordinate within/among committed tick intervals so departures and arrivals can be distributed within an hour without making frame time authoritative.

## Context

The current RCI system already owns Citizens, Households, Dwelling assignments, Workplaces, Employment, migration, R/C/I Demand, and Growth gates. Buildings already expose Road frontage and capacity-profile seams. Roads own basic-road occupancy and connectivity. What is missing is the logical movement layer that connects a real Citizen's Home and Workplace to walking/driving trips and then to Traffic/Three.js presentation.

Creating a second Citizen model for traffic would split identity, Save authority, and lifecycle reconciliation. Conversely, making Three.js people/cars authoritative would couple simulation correctness to camera visibility and frame updates. This design adds a narrow mobility authority between existing RCI facts and transport planning.

## Goals

- Give every present Citizen a deterministic logical mobility state.
- Generate real Home ↔ Work commute trips from existing Home and Employment assignments.
- Stagger schedules deterministically so all employed Citizens do not depart at the same minute.
- Support both Walk and Drive from the first production version.
- Select travel mode from deterministic route-cost candidates without importing Traffic internals.
- Preserve one Citizen identity source: existing RCI `citizenId`.
- Reconcile birth/death/emigration, housing changes, job changes, and Building retirement without partial world publication.
- Persist exact mobility authority and resume continuously across Save/Load.
- Avoid global per-frame Citizen simulation.
- Keep the activity/trip model extensible to later daily-life Citizen AI without building those features now.

## Non-Goals

- Replacing RCI Citizen, Household, Housing, Employment, migration, or Demand authority.
- Public transport, bicycles, carpooling, parking, private-car ownership, fuel cost, or parking search.
- School, shopping, leisure, healthcare, service, tourism, visit, freight, or emergency-trip generation.
- Citizen wallets, wages, personal spending, or business profitability.
- Pathfinding, Road graph ownership, congestion, intersection queues, or vehicle movement.
- Three.js pedestrian/vehicle meshes or animation.
- Citizen names or appearance authority if those facts do not already exist elsewhere.

## System Boundary

### Planned package

`packages/citizen-mobility-core`

The package is framework-independent and must not import Three.js, DOM/UI code, `rci-core`, `building-core`, or `road-core`. `apps/game` supplies narrow immutable projections from those authorities and composes Mobility into the committed world transaction.

### Inputs supplied by orchestration

A narrow source projection contains only facts required to plan mobility, conceptually:

```text
PresentCitizenProjection
- citizenId
- homeBuildingId?       // from current Housing assignment
- workBuildingId?       // from current Employment/Workplace assignment
- current presence/lifecycle eligibility

MobilityTimeProjection
- absolute committed tick
- current day/calendar identity

ModeCostCandidates
- Walk: available + integer generalized cost
- Drive: available + integer generalized cost
```

Building access geometry and transport routes remain Traffic concerns. Citizen Mobility addresses origin/destination by stable Building instance identity, not Traffic graph node identity.

### Outputs

- `MobilitySnapshotV1`-equivalent immutable state.
- Trip planning requests for Citizens whose schedule reaches a travel boundary.
- Deterministic mode-selection result after caller-supplied route-cost candidates are available.
- Reconciliation receipts/events sufficient for atomic `apps/game` composition and debugging.

### Dependency direction

```text
RCI ──────────────┐
Buildings ────────┤
Simulation ───────┤
                  ▼
             apps/game
                  ↓
       citizen-mobility-core
                  ↓
       trip intents / mode choice
                  ↓
             traffic-core
```

`rci-core`, `building-core`, and `simulation-core` must not import Citizen Mobility.

## Authoritative and Derived State

### Authoritative Mobility state

A production snapshot must represent at least:

```text
MobilitySnapshotV1
- revision
- policyVersion
- scheduleSeedVersion
- nextTripSequence
- citizenStates[]
- trips[]
```

Conceptual per-Citizen state:

```text
CitizenMobilityState
- citizenId
- currentActivity: Home | Work | Idle | Travel
- stationaryPlace?: BuildingId | Unplaced
- activeTripId?
- scheduleCursor
- nextBoundaryGameMinute?
```

Conceptual mobility trip:

```text
MobilityTrip
- tripId
- citizenId
- purpose: CommuteToWork | CommuteHome
- originBuildingId
- destinationBuildingId
- mode: Walk | Drive
- departureGameMinute
- status: Planned | Active | Arrived | Failed | Cancelled
- failureReason?
```

A Citizen in `Travel` references exactly one active trip. While travelling, the Traffic system owns route/progress; Citizen Mobility must not duplicate edge/segment progress.

### Derived state

- A day's staggered activity boundaries when they can be rebuilt from Citizen identity, day, and versioned schedule policy.
- Mode-cost candidates.
- Travel route and route geometry.
- Edge load, congestion, queue, ETA, or transport graph state.
- Three.js materialization, position, rotation, animation, LOD, or visibility.

## Activity Model

v0.1 recognizes these activity kinds:

- `Home` — stationary at the currently assigned Residential Building.
- `Work` — stationary at the currently assigned Workplace Building.
- `Idle` — no valid scheduled destination is currently available; may be stationary at a known Building or `Unplaced`.
- `Travel` — an active trip exists and Traffic owns transport progression.

This is a deliberately small foundation vocabulary. Future activity definitions may add Shopping, Leisure, Education, Healthcare, Service, Visit, or other destination types while reusing the same activity-plan and trip lifecycle contracts.

## Schedule Policy

The foundation schedule is versioned. The default v0.1 employed-Citizen policy is:

- Work start target is deterministically distributed across 07:00–09:00.
- Work duration is 9 game hours.
- The return-home boundary therefore follows the Citizen's deterministic work-start time plus the configured duration.
- Exact offsets derive from stable Citizen identity, calendar day, schedule policy version, and deterministic seed inputs.
- Runtime randomness, wall-clock time, or iteration order must not affect the result.

Citizens without a valid Workplace do not generate Work commute trips. Citizens without a valid Home do not generate a Home-origin trip until a valid origin exists. Such Citizens remain valid RCI entities and use `Idle`/`Unplaced` mobility semantics rather than being deleted or silently assigned a fake place.

## Temporal Contract

The existing Simulation model remains authoritative: one committed Simulation tick = one game hour.

Mobility uses integer `GameMinute` coordinates for sub-hour event ordering:

```text
absoluteGameMinute = absoluteGameTick * 60 + minuteOffset
```

Rules:

- Authoritative comparisons use integer time only.
- A Simulation advancement from hour N to N+1 evaluates every due Mobility boundary in stable `GameMinute` order inside that interval.
- `Pause` advances no Mobility authority.
- `Step` evaluates exactly the next ordinary authoritative hour, including all Mobility events due in that interval.
- Frame delta and render interpolation never change Mobility state.

## Trip Generation

At each due activity boundary:

1. Read one coherent source projection from the staged world.
2. Resolve the latest authoritative Home/Work Building identity required by the next activity.
3. If origin or destination is unavailable, enter/retain a deterministic non-travel state and emit a typed failure/skip receipt.
4. Emit a trip planning request identified by the next stable `tripId` candidate.
5. Ask Traffic through `apps/game` for Walk and Drive candidate availability/costs.
6. Select the mode deterministically.
7. If at least one mode is available, commit the Mobility trip together with its selected Traffic route/state through the same staged world publication.
8. If neither mode is available, publish a failed mobility outcome without mutating Citizen/Household/Employment authority.

Failed plans must not consume generated IDs if the world transaction does not commit.

## Mode Choice

v0.1 uses deterministic generalized-cost choice rather than a fixed distance threshold.

Candidate cost units must be integer/fixed-point and comparable across modes. The semantic costs are:

```text
WalkCost
= walking route travel time

DriveCost
= building/road access time
+ road route travel time
+ committed congestion cost
```

Citizen Mobility receives only the availability and final integer cost for each candidate; Traffic route internals stay outside this package.

Selection order:

1. lowest valid generalized cost,
2. exact tie → `Walk`,
3. no valid candidate → trip failure `Unreachable`.

The Walk tie-break is a deterministic product rule, not an environmental preference model. Car ownership, parking, income, fuel, transit, and personal preferences remain future factors.

## RCI / Building Reconciliation

`apps/game` must reconcile Mobility from the same staged world that contains current RCI and Building state.

### Citizen becomes present

Create one Mobility state deterministically from current authoritative Home/Employment/time. Do not invent a historical trip.

### Citizen dies or emigrates

Cancel any active Mobility/Traffic trip and remove active Mobility state in the same staged publication that makes the Citizen no longer present. Historical Citizen identity remains governed by RCI.

### Home assignment changes

Future Home activity uses the newest Housing assignment. If an active destination is still a valid Building, the current trip may complete. If the destination disappears or becomes invalid, Traffic recovery is requested; if recovery cannot target a valid current activity place, the trip fails deterministically.

### Employment changes

Future Work activity uses the newest Employment/Workplace assignment. Job loss cancels future Work commute scheduling. An active trip to a removed Workplace follows the same recovery/failure rule.

### Building retirement/bulldoze

Mobility never preserves a stale Building destination as valid authority. Destination validity is checked against the staged Building projection before publication.

## Persistence and Migration

Introduce `MobilitySaveV1` and compose it into planned `WorldSaveV7` together with `TrafficSaveV1`.

Persist only authoritative Mobility state:

- Mobility revision and policy versions,
- current per-Citizen Mobility state,
- committed Mobility trip records required for exact resume,
- schedule cursor/next boundary when it is not safely derivable from the same versioned inputs,
- stable trip ID sequence.

Do not persist:

- full future schedule tables that are deterministically rebuildable,
- Traffic route edges or transport progress,
- graph caches,
- Three.js state.

### V1–V6 migration

Older world saves initialize Mobility deterministically from decoded present Citizens, current Housing/Employment, Buildings, and saved Simulation time.

Migration must not invent in-progress historical trips. Each Citizen starts in the appropriate stationary foundation activity for the saved time when a valid place exists, otherwise `Idle`. Future departures begin at the next deterministic schedule boundary. This preserves old-city authority without creating a burst of synthetic catch-up traffic on load.

Decode is all-or-nothing. Invalid Mobility data rejects the new world save; no partial world publication is allowed.

## Determinism and Performance

- Stable IDs are never reused.
- Generated ID sequences advance only on committed transactions.
- Schedule hashing/seeding is versioned and deterministic.
- Event ordering is explicit: `GameMinute`, event kind priority, `citizenId`, then `tripId` where needed.
- No authoritative use of `Math.random()`, `Date.now()`, render frame delta, or unordered iteration.
- Authoritative ratios/cost decisions use integer or validated fixed-point arithmetic.
- No per-frame loop over all Citizens.
- Schedule processing uses due-event buckets/indexes so work scales with due boundaries and active trips, not camera frame rate.
- Foundation scale target: at least 20,000 logical Citizens and at least 5,000 concurrent logical trips in dedicated scale verification without changing correctness semantics.

Exact CPU/memory budgets are measured and frozen during the implementation/performance PR; passing scale counts does not waive frame/runtime profiling.

## Extension Points

The v0.1 seam intentionally supports later:

- additional activity definitions and destination-choice policies,
- school/education schedules,
- shopping/leisure/service/healthcare trips,
- public-transit/bicycle/car-ownership mode candidates,
- citizen preference or household-resource factors,
- accessibility feedback into RCI/Land Value/Economy,
- richer daily schedule planners.

Extensions add definitions/policies and mode candidates; they do not replace Citizen identity or the Mobility trip lifecycle.

## Acceptance Criteria

- Existing RCI `citizenId` is the only Citizen identity authority.
- Every committed Mobility trip maps to one present real Citizen.
- Every employed/housed Citizen with a reachable Home/Work pair receives deterministic staggered commute opportunities.
- Work departures are distributed through the versioned schedule window rather than synchronized at one tick boundary.
- Walk and Drive are both real trip modes from v0.1.
- Mode selection is deterministic and uses caller-supplied Traffic costs.
- Citizens with missing Home/Job/access fail closed without corrupting RCI state.
- Death/emigration/assignment/building changes reconcile without orphaned active trips.
- Save/load preserves the same Citizen activity/trip identity and continues equivalently.
- V1–V6 migration creates no fake historical trips.
- Pause/Step semantics remain consistent with Simulation Time.
- No Three.js or frame-time state can mutate Mobility authority.
- Scale verification covers at least 20,000 Citizens / 5,000 concurrent logical trips.

## PR Decomposition

This specification owns the Citizen Mobility slices of the umbrella milestone:

1. Core contracts, validation, deterministic IDs, `MobilitySaveV1` schema.
2. Activity/schedule policy and event indexing.
3. Home/Work commute trip generation and mode-choice seam.
4. RCI/Building lifecycle reconciliation and world transaction integration.
5. Save migration and exact-resume verification.

Traffic graph/routing/congestion/visual-agent slices are defined in the Traffic specification and will be sequenced together in the later TDD implementation packet.

## Related Documents

- System overview: [`../README.md`](../README.md)
- ADR: [`../adrs/0001-existing-rci-citizen-remains-identity-authority.md`](../adrs/0001-existing-rci-citizen-remains-identity-authority.md)
- Traffic specification: [`../../traffic/specs/2026-08-15-traffic-foundation-v0-1.md`](../../traffic/specs/2026-08-15-traffic-foundation-v0-1.md)
- RCI current state: [`../../rci/README.md`](../../rci/README.md)
- Buildings current state: [`../../buildings/README.md`](../../buildings/README.md)
- Simulation Time current state: [`../../simulation-time/README.md`](../../simulation-time/README.md)
- TDD plan: pending written-spec approval
- Verification: pending implementation
