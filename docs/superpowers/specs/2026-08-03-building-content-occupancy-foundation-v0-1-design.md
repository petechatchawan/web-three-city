# Building Content & Occupancy Foundation v0.1 Design

## Status

Approved for implementation through a pull request on 2026-08-03.

## Goal

Add authoritative, deterministic building content and occupancy to the browser city-builder while preserving Zones as development rights and keeping rendering as derived presentation.

## Locked scope

Included:

- data-driven Building Definitions and authoritative Building Instances
- canonical rectangular footprints with quarter-turn rotation
- strict Building-to-Zone compatibility
- deterministic lot allocation, definition selection, rotation, and road frontage
- explicit `Develop Zones` command
- Building bulldoze that preserves the underlying Zone
- atomic occupancy transactions with stale-revision fencing
- derived occupancy index and occupied cells
- Save/Load migration to WorldSaveV3
- one-level Undo for Building development and bulldoze
- Road, Terraform, and Zone guards against Building occupancy
- Three.js cube-composed prototype buildings for Residential, Commercial, and Industrial content
- accessible Game UI controls, status, counts, and browser acceptance coverage

Excluded:

- automatic simulation-tick development
- demand, economy, population, jobs, taxation, land value, or desirability
- utilities, services, traffic, pathfinding, agents, upgrades, abandonment, and construction timers
- final artwork, imported models, animation, or mod loading

## Authoritative model

```text
BuildingDefinition
├── DefinitionId
├── DefinitionVersion
├── Label
├── FootprintWidth
├── FootprintDepth
├── AllowedRotationQuarterTurns
├── CompatibleZoneDefinitionIds
├── SelectionPriority
├── PrototypeId
└── PrototypeHeight

BuildingInstance
├── InstanceId
├── BuildingDefinitionId
├── BuildingDefinitionVersion
├── OriginCell
└── RotationQuarterTurns

BuildingSnapshot
├── Revision
└── Instances[]
```

The following are derived and must never be persisted as authority:

- occupied cells
- rotated width and depth
- occupancy index entries
- world bounds
- road-facing edge
- entrance direction derived from rotation
- frontage cell
- entrance candidate cell
- Three.js groups, meshes, materials, and geometry

## Footprint rules

`RotationQuarterTurns` is exactly `0 | 1 | 2 | 3`.

For a canonical `Width × Depth` definition:

- rotation `0` or `2` produces `Width × Depth`
- rotation `1` or `3` produces `Depth × Width`

The canonical origin is the minimum grid coordinate of the rotated rectangular footprint. Occupied cells are derived in row-major order from the origin and rotated dimensions.

## Content catalog v0.1

The built-in catalog contains six definitions:

| Definition | Zone | Footprint | Allowed rotations | Prototype |
| --- | --- | --- | --- | --- |
| `residential-cottage-1x1` | Residential | 1×1 | 0,1,2,3 | cottage |
| `residential-rowhouse-1x2` | Residential | 1×2 | 0,1,2,3 | rowhouse |
| `commercial-shop-1x1` | Commercial | 1×1 | 0,1,2,3 | shop |
| `commercial-office-2x2` | Commercial | 2×2 | 0,1,2,3 | office |
| `industrial-workshop-1x2` | Industrial | 1×2 | 0,1,2,3 | workshop |
| `industrial-warehouse-2x2` | Industrial | 2×2 | 0,1,2,3 | warehouse |

Every definition owns a non-empty canonical `CompatibleZoneDefinitionIds[]`. Compatibility is strict and fail-closed:

- the whole footprint must contain one homogeneous Zone definition
- the selected Building Definition must explicitly list that Zone definition
- missing definitions, missing versions, mixed Zones, fallback mapping, random reselection, and compatibility inference are rejected

## Development pipeline

```text
Explicit Develop Zones command
    ↓
Development Scanner (row-major world order)
    ↓
Lot Allocator
    ↓
Compatible Definition Selector
    ↓
Rotation Selector
    ↓
Road Frontage Resolver
    ↓
Atomic Occupancy Plan
    ↓
Building Snapshot Commit
    ↓
Building Presenter Rebuild
```

### Deterministic ordering

1. Scan candidate origins by `z`, then `x`.
2. Select definitions by descending `SelectionPriority`, descending footprint area, then `DefinitionId`.
3. Evaluate allowed rotations in numeric order, then prefer the valid rotation whose canonical south entrance edge faces the resolved Road frontage.
4. Break remaining rotation ties by shortest road-access distance, direction order `north`, `east`, `south`, `west`, frontage-cell `z`, frontage-cell `x`, then numeric rotation.
5. Generate instance IDs as `building:<target-building-revision>:<sequence>`.

No random source participates in Building v0.1.

### Placement validation

A candidate footprint is valid only when:

- every cell is inside the World
- every cell has the same compatible Zone definition
- every cell is dry
- every cell has flat terrain
- no cell is occupied by a Road
- no cell is occupied by an existing or earlier planned Building
- at least one footprint cell resolves deterministic Road access
- all source revisions are coherent

The scanner greedily accepts the first valid candidate under the deterministic ordering and continues until the whole World has been scanned. A Develop command with no placements is rejected as `building:no-change`.

## Atomic mutation model

Building operations use immutable plans and receipts.

A plan captures:

- base Building revision
- base Terrain revision
- base Water source Terrain revision
- base Road revision
- base Zone revision
- operation and requested bulldoze cell when applicable
- proposed authoritative instances
- added and removed instances
- dirty chunks
- validity and deterministic invalid reason

Commit re-plans against current inputs and rejects any stale or altered plan. Partial placement is never committed outside the complete deterministic scanner result.

## Occupancy ownership

`building-core` owns the Building occupancy index derived from the snapshot and definitions.

Game composition exposes it as a world occupancy adapter:

```text
revision = BuildingSnapshot.revision
isBlocked(cell) = buildingOccupiedAt(BuildingSnapshot, cell)
```

This adapter is consumed by:

- Zone placement/removal guard
- Terraform occupancy guard
- Road placement/bulldoze guard
- Save/Load validation

Zone data remains present under every Building. Bulldozing a Building never edits the Zone grid.

## Save and load

WorldSaveV3 contains:

- TerrainSaveV1
- RoadSaveV1
- ZoneSaveV1
- BuildingSaveV1

WorldSaveV1 and WorldSaveV2 migrate to an empty Building snapshot. BuildingSaveV1 persists only authoritative instance fields and snapshot revision.

Load is fail-closed. It rejects:

- unknown definition IDs or versions
- invalid rotations
- out-of-bounds footprints
- duplicate instance IDs
- overlapping Building footprints
- incompatible or mixed Zones
- wet, non-flat, or Road-occupied cells
- missing Road frontage
- incoherent World revisions

## Undo

The existing one-level `WorldUndoStore` gains `kind: 'building'`. Development and bulldoze replace the previous undo entry with a defensive copy of the prior Building snapshot. Consuming Undo restores the prior instances with a newer Building revision.

## Presentation

`building-three` receives only authoritative instances plus derived terrain elevation. It creates one named root, `building-committed-root`, and cube-composed low-poly prototype groups.

Presentation rules:

- geometry and materials are derived and disposable
- each Building group carries its `instanceId` in `userData`
- footprint center, rotation, and terrain elevation are derived
- Residential, Commercial, and Industrial prototypes are visually distinct
- no prefab or mesh identifiers are stored in BuildingInstance
- rebuilding the presentation must not mutate Building state

## Game interaction

New tool modes:

- `building-develop`: executes the deterministic World development scan on pointer release
- `building-bulldoze`: removes the Building occupying the selected cell

The HUD adds:

- Develop Zones button
- Bulldoze Building button
- committed Building count
- operation status and invalid-reason messages
- Undo integration

Keyboard shortcuts remain unchanged in v0.1; Building controls are accessible buttons with pressed state and descriptive labels.

## Error policy

The domain uses stable `building:*` error codes. Unknown data and incoherent revisions fail closed. User-facing messages are mapped at the Game boundary; core packages never contain UI strings.

## Test coverage to write before final verification

- definition catalog and compatibility
- rotated footprint derivation
- snapshot immutability and occupancy index
- deterministic scanner ordering and frontage
- atomic plan/commit and stale revision fencing
- bulldoze and Zone preservation
- serialization and malformed-save rejection
- Three.js prototype presentation and disposal
- Road, Terraform, and Zone cross-domain guards
- WorldSaveV1/V2 migration and WorldSaveV3 round-trip
- Undo
- Game UI, input routing, browser acceptance, and visual evidence

Per Owner instruction, implementation and tests are written completely before any verification command is run.
