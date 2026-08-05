# Building Growth & Variety Foundation v0.1 Design

## Status

Approved by the Owner on 2026-08-04 for planning and inline implementation through three stacked pull requests.

## Goal

Replace explicit whole-world Building development with deterministic automatic growth driven by a shared in-game calendar, while expanding the built-in Building catalog and preserving authoritative world-state, fail-closed validation, Save/Load determinism, and derived Three.js presentation.

## Delivery model

The milestone is delivered through three ordered pull requests:

1. **Simulation Clock & Building Growth Core**
2. **Building Content Variety**
3. **Runtime, Save, UI & Browser Integration**

The pull requests are stacked. Growth logic must not depend on Three.js or browser APIs. Content definitions and presentation must not own simulation time. Runtime integration composes the pure packages without duplicating authority.

## Locked simulation calendar

One logical tick equals one in-game hour.

```text
24 ticks = 1 day
30 days = 1 month
12 months = 1 year
```

A new world begins at:

```text
Year 1 / Month 1 / Day 1 / 08:00
```

The simulation stores an absolute non-negative safe-integer tick. Calendar fields are derived and never persisted independently.

### Runtime speeds

```text
Paused = 0×
Normal = 1 tick per real second
Fast = 2 ticks per real second
Faster = 4 ticks per real second
Step = exactly 1 tick
```

`Step` is available only while paused and leaves the simulation paused. Normal, Fast, Faster, and Step must produce identical authoritative results when compared at the same absolute tick.

The real-time accumulator is presentation/runtime state, not world authority. Hidden browser tabs do not accumulate catch-up time. Offline progression is excluded. New games start at Normal. Loaded games start Paused.

## Building lifecycle

```text
Vacant Zone
  → Eligible Candidate
  → Construction
  → Active
```

Vacant and eligible states are derived from Zone, Terrain, Water, Road, and Building authority. They are not persisted as separate records.

`BuildingInstance` is a discriminated union sharing these base fields:

```text
instanceId
buildingDefinitionId
buildingDefinitionVersion
originCell
rotationQuarterTurns
```

Construction authority adds:

```text
lifecycle = construction
constructionStartedAtTick
constructionCompletesAtTick
```

Active authority adds:

```text
lifecycle = active
activatedAtTick
```

All lifecycle ticks are non-negative safe integers. Construction completion must be strictly later than construction start. Active timestamps may equal the initial game tick for migrated worlds.

## Growth cadence and transaction order

Development evaluation occurs at in-game hours:

```text
00:00, 06:00, 12:00, 18:00
```

At most one Building may begin Construction per evaluation tick.

One logical tick executes in this order:

1. Advance `absoluteTick` by exactly one.
2. Complete due Construction instances in deterministic `instanceId` order.
3. When the derived hour is an evaluation hour, derive the current eligible candidate set.
4. Select at most one candidate using deterministic content and placement rules.
5. Commit Simulation and Building changes atomically.
6. Return a receipt containing started, completed, and dirty-instance identifiers.

The candidate queue is derived each evaluation. It is never persisted because Road, Zone, Terrain, Water, and occupancy changes can invalidate queued candidates.

`growthSequence` is authoritative and increments only when automatic growth starts a Construction instance successfully. It is persisted to stabilize instance identifiers and weighted content selection.

## Construction duration

Every Building Definition declares `constructionDurationTicks`.

Built-in content uses:

```text
constructionDurationTicks = 24 × footprint area
```

Therefore:

```text
1×1 = 24 ticks
1×2 or 2×1 = 48 ticks
2×2 = 96 ticks
```

Construction progress is derived:

```text
(currentTick - constructionStartedAtTick)
/
(constructionCompletesAtTick - constructionStartedAtTick)
```

Progress is clamped to `[0, 1]` for presentation only.

## Automatic placement rules

Automatic growth reuses the existing authoritative world constraints:

- all footprint cells are inside the World;
- all footprint cells contain one homogeneous compatible Zone definition;
- all footprint cells are dry;
- all footprint cells are flat;
- no footprint cell contains a Road;
- no footprint cell is occupied by an existing or earlier planned Building;
- deterministic Road frontage exists;
- source revisions are coherent.

Automatic growth starts one Construction instance, not the previous whole-world greedy batch. The explicit `Develop Zones` command remains temporarily available through PR 1 and PR 2, then is removed during PR 3 runtime cutover.

## Content catalog

The six existing definition identifiers remain valid. Six new definitions are added, producing twelve built-in definitions.

### Residential

| Definition ID | Footprint | Weight |
| --- | ---: | ---: |
| `residential-cottage-1x1` | 1×1 | 40 |
| `residential-rowhouse-1x2` | 1×2 | 30 |
| `residential-duplex-2x1` | 2×1 | 20 |
| `residential-apartment-2x2` | 2×2 | 10 |

### Commercial

| Definition ID | Footprint | Weight |
| --- | ---: | ---: |
| `commercial-shop-1x1` | 1×1 | 40 |
| `commercial-cafe-1x1` | 1×1 | 30 |
| `commercial-market-1x2` | 1×2 | 20 |
| `commercial-office-2x2` | 2×2 | 10 |

### Industrial

| Definition ID | Footprint | Weight |
| --- | ---: | ---: |
| `industrial-workshop-1x2` | 1×2 | 35 |
| `industrial-depot-1x1` | 1×1 | 30 |
| `industrial-warehouse-2x2` | 2×2 | 20 |
| `industrial-factory-2x2` | 2×2 | 15 |

Every definition adds:

```text
selectionWeight
constructionDurationTicks
```

`selectionPriority` remains the coarse placement tier. Weight selection occurs only among valid definitions in the highest available priority tier.

## Deterministic variety selection

No runtime random source participates.

The stable selection key contains:

```text
absoluteTick
growthSequence
originCell
zoneDefinitionId
```

Selection executes as follows:

1. Scan origins in row-major order by `z`, then `x`.
2. Enumerate compatible definitions whose complete footprint and frontage are valid.
3. Keep only the highest valid `selectionPriority` tier.
4. Resolve each definition's best valid rotation and frontage using the established deterministic rotation ordering.
5. When more than one valid definition remains, exclude definitions matching an immediately adjacent Building when at least one non-matching alternative exists.
6. Apply a stable unsigned 32-bit hash to the selection key.
7. Select from cumulative `selectionWeight`, ordered by `definitionId`.

Bulldozing and later redevelopment can select another definition because `growthSequence` is monotonic. Removing the underlying Zone prevents future redevelopment.

## Presentation

Construction presentation has three derived phases:

```text
0%–33%   foundation
>33%–66% frame
>66%–<100% shell
100%      active prototype
```

Presentation rebuilds only when an instance is added, removed, completed, or crosses a phase boundary. It does not rebuild every real-time frame.

All twelve active prototypes remain cube-composed low-poly content. They must be distinguishable by silhouette, height, roof treatment, and primary structural elements. Zone-family color may support recognition but cannot be the only distinction.

No Three.js object, material, mesh, phase, progress fraction, or world transform is persisted as authority.

## Save and load

The integrated runtime introduces `WorldSaveV4`:

```text
WorldSaveV4
├── TerrainSaveV1
├── RoadSaveV1
├── ZoneSaveV1
├── BuildingSaveV2
└── SimulationSaveV1
```

`SimulationSaveV1` persists:

```text
absoluteTick
growthSequence
```

`BuildingSaveV2` persists lifecycle-specific timestamps.

Migration rules:

- WorldSaveV1 and WorldSaveV2 migrate to empty Buildings and initial GameTime.
- WorldSaveV3 Buildings migrate to `active` with `activatedAtTick` equal to the initial absolute tick.
- Migrated `growthSequence` equals the migrated Building count.

Load fails closed for malformed Simulation or lifecycle authority, including negative or non-integer ticks, end-before-start Construction, lifecycle-field mismatches, already-due Construction records, duplicate automatic identifiers, unknown definitions or versions, invalid rotations, invalid footprints, incompatible Zones, wet or non-flat cells, Road conflicts, missing frontage, overlaps, and incoherent source revisions.

Loading resets runtime speed to Paused and clears the real-time accumulator. No offline catch-up is applied.

## Undo and player operations

Automatic Construction start and automatic completion do not replace the player's one-level Undo entry. Logical time advance cannot be undone.

Bulldoze works for Construction and Active instances. It preserves the Zone. Undo restores the exact prior lifecycle and timestamps with a newer Building revision. Load clears Undo under the existing policy.

## UI

The Game HUD adds:

```text
Y1 M1 D1 08:00
[Pause] [Play] [2×] [4×] [Step]
Construction: N
Active: N
Total: N
```

Speed controls expose pressed state and accessible labels. `Step` is disabled while time is running. Status announces meaningful Construction starts and completions without emitting a message for idle ticks.

The explicit `Develop Zones` control is removed only after automatic runtime integration is active. Building Bulldoze and Undo remain.

Day/night lighting is excluded even though the clock supports it.

## Package and responsibility boundaries

### `simulation-core`

Owns absolute ticks, simple calendar derivation, speed values, Simulation snapshots, immutable tick plans and commits, and serialization. It has no browser or Three.js dependencies.

### `building-core`

Owns Building definitions, lifecycle authority, deterministic growth planning, Building mutation, occupancy, lifecycle serialization, and construction progress derivation. It consumes Simulation snapshot values but does not own real-time accumulation.

### `building-three`

Owns active and Construction presentation derived from Building authority. It never advances time or mutates Building snapshots.

### `apps/game`

Owns runtime accumulation, document visibility behavior, composition of the tick transaction, UI, Save/Load orchestration, Undo policy, status messages, and browser evidence.

## Pull-request boundaries

### PR 1 — Simulation Clock & Building Growth Core

- add `simulation-core`;
- add simple calendar and Simulation serialization;
- add lifecycle authority to `building-core`;
- add one-candidate automatic growth and due-completion planning;
- add atomic tick transaction contracts and pure unit tests;
- retain the explicit development UI temporarily.

### PR 2 — Building Content Variety

- add six definitions and metadata;
- add stable weighted selection and adjacent-duplicate avoidance;
- add twelve active prototypes;
- add three Construction phase presentations;
- add catalog, selection, and presentation tests.

### PR 3 — Runtime, Save, UI & Browser Integration

- add the real-time clock runtime and hidden-tab freeze;
- compose automatic growth ticks;
- introduce WorldSaveV4 and migrations;
- add time controls and lifecycle counts;
- remove explicit Develop Zones;
- preserve Undo policy;
- add deterministic speed/replay, Save/Load, migration, interaction, and visual-evidence coverage;
- run exact-head full verification and Owner acceptance.

## Excluded scope

- Population and Jobs
- Demand meters
- Economy, Tax, Budget, Land Value, and Desirability
- Utilities and City Services
- Traffic, Pathfinding, and Agents
- Building upgrades and abandonment
- Fire, disasters, and other events
- Day/night lighting and seasons
- Imported final art assets
- Mod loading
- Offline progression

## Acceptance criteria

The milestone closes only when:

- equal absolute ticks produce equal authority under Normal, Fast, Faster, and Step;
- Construction Save/Load resumes from the exact persisted tick;
- WorldSaveV1 through WorldSaveV3 migrate deterministically;
- automatic growth never replaces player Undo;
- Road, Zone, Terrain, Water, frontage, and occupancy guards remain fail closed;
- all twelve definitions are reachable under deterministic selection;
- all three Construction phases have visual evidence;
- full workspace verification, browser tests, and clean-worktree verification pass on the exact final head;
- the Owner completes manual acceptance and explicitly authorizes final merges.
