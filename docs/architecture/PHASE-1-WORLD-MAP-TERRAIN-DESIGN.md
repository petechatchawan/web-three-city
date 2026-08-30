# Phase 1 — World, Map, and Terrain Design

- **Status:** FROZEN — OWNER APPROVED 2026-08-29
- **Date:** 2026-08-29
- **Scope:** Phase 1 product foundation for World, Map, Grid topology, Regions, Terrain authority, deterministic terrain generation, terrain mutation, terrain geometric queries, Three.js terrain presentation, and snapshot ownership contracts
- **Depends on:** Product Architecture, ADR-000, ADR-001, A3 Repository Topology & Ownership Model, A4 Package Boundary Model, A5 System Internal Structure, A6 Public Export & Dependency Rules, A7 Composition & Orchestration Structure, A8 Foundation Structure, A9 Testing Structure
- **Target product:** `web-three-city`
- **Implementation status:** Design/spec authority frozen. Production implementation requires the approved TDD implementation plan and RED/GREEN execution gates.

## 1. Purpose

Phase 1 establishes the physical world foundation of the product before Roads, Zoning, Buildings, simulation runtime, economy, mobility, or persistence infrastructure are introduced.

The phase is intentionally narrow:

```text
WORLD defines where things exist.
MAP defines one playable world instance.
TERRAIN owns what the ground is.
THREE.JS only presents the result.
```

The required authority direction is:

```text
MapDefinition
     ↓
GridTopology
     ↓
TerrainState
     ↓
Resolved Terrain Surface
     ↓
Three.js Presentation
```

Reverse ownership is forbidden. Terrain does not own Map configuration. World does not own Terrain elevation. Three.js geometry is never canonical gameplay state.

## 2. Current design reference

The owner supplied an existing production-grade Unity Map / World / Terrain model as an explicit current design reference for this phase.

That reference is accepted as:

```text
DESIGN REFERENCE
+
CURRENT PRODUCT REQUIREMENT INPUT
```

It is not treated as:

```text
source-code migration authority
binary/save compatibility requirement
package-layout compatibility requirement
Unity API compatibility requirement
historical Git authority
```

This use is compatible with ADR-000 because the owner explicitly introduced the reference into the current design process.

Phase 1 preserves proven semantics where they remain appropriate while redesigning implementation around TypeScript, Three.js, browser lifecycle, and the frozen repository architecture.

## 3. Phase 1 boundaries

### 3.1 Included

Phase 1 includes:

```text
World spatial authority
finite Map definition
Map instance state
Grid topology
Region topology
starting-region provenance
Terrain canonical state
Terrain logical chunking
Terrain geometric surface definition
Terrain deterministic generation contract
Terrain queries
Terrain atomic mutation foundation
Terrain revision/change reporting
Three.js terrain presentation
pointer/raycast-to-terrain semantic picking
World/Terrain snapshot contracts
vertical-slice integration verification
```

### 3.2 Explicitly excluded

Phase 1 does not introduce:

```text
Terraform player tools
Roads
Zoning
Buildings
Households
Businesses
Economy
RCI
Traffic
Mobility
SimClock
simulation scheduler
ECS
Hydrology
Water simulation
concrete persistence adapter
save-file encoding
save/load lifecycle
runtime event bus
networking
multiplayer
```

Terrain mutation exists in Phase 1 because it is part of Terrain authority correctness, not because Terraform gameplay is included.

## 4. Chosen package ownership

Phase 1 creates exactly two gameplay system ownership candidates once their binding specifications are approved:

```text
systems/world
systems/terrain
```

There is no separate `systems/map` package in Phase 1.

### 4.1 `systems/world`

World owns:

```text
MapDefinition
MapState
CellCoord
VertexCoord
ChunkCoord
MapExtent
GridTopology
RegionId
Region geometry
Region adjacency
starting-candidate definitions
starting-region provenance
world/grid queries
```

Map is therefore a first-class domain concept owned by World, not a separate bounded system.

### 4.2 `systems/terrain`

Terrain owns:

```text
TerrainState
LogicalElevation
TerrainRevision
Terrain chunk data
Terrain surface semantics
Terrain queries
Terrain mutation
TerrainChangeSet
Terrain generation profile execution
Terrain output fingerprinting for verification
Terrain presentation projection
Terrain snapshot semantics
```

Terrain never owns Region unlocking, map identity, or world-grid definitions.

### 4.3 No `foundation/spatial` in Phase 1

`foundation/spatial` remains uncreated.

The current spatial vocabulary is still product/world semantic vocabulary rather than proven product-neutral infrastructure. In particular:

```text
CellCoord
VertexCoord
ChunkCoord
RegionId
MapExtent
```

belong to World even if several future systems consume them.

The A8 rule remains binding:

```text
used by many systems
!=
Foundation
```

A future Foundation spatial package requires separate evidence that a genuinely generic lower-level primitive has emerged.

## 5. Production map baseline

Phase 1 adopts the following map baseline as current product design:

| Property | Phase 1 value |
| --- | ---: |
| Gameplay cells | `512 × 512` |
| Cell size | `8 m × 8 m` |
| Playable horizontal size | `4096 m × 4096 m` |
| Logical chunk size | `32 × 32` cells |
| Logical chunk grid | `16 × 16` |
| Logical chunks | `256` |
| Terrain vertex grid | `513 × 513` |
| Regions | `20` |
| Starting candidates | `4` |
| Render-sector grid | `8 × 8` |
| Render sectors | `64` |
| Cells per render sector | `64 × 64` |
| Logical chunks per render sector | `2 × 2` |

These are current Phase 1 product values, not compatibility obligations to the Unity implementation.

## 6. World coordinate convention

The logical world coordinate convention is fixed as:

```text
+X = East
+Z = North
+Y = Up
```

One Three.js world unit represents one meter at the presentation boundary.

The horizontal world origin is the south-west corner of cell `(0, 0)`.

For valid cell coordinates:

```text
0 <= x < 512
0 <= z < 512
```

For valid terrain vertex coordinates:

```text
0 <= x <= 512
0 <= z <= 512
```

Cell `(x, z)` occupies:

```text
X: [x * 8m, (x + 1) * 8m)
Z: [z * 8m, (z + 1) * 8m)
```

The outer map boundary is therefore:

```text
X: [0m, 4096m]
Z: [0m, 4096m]
```

Presentation camera convention is free to vary, but canonical World coordinates do not change with camera orientation.

## 7. `MapDefinition`

`MapDefinition` is immutable world configuration.

The production baseline identity is:

```text
profileId      = production-v1
profileVersion = 1
```

A `MapDefinition` contains, conceptually:

```text
MapDefinitionId
profile version
width/height in cells
cell size
logical chunk size
Region definitions
starting-candidate definitions
terrain-generation profile identity
```

A `MapDefinition` does not contain mutable city progress or Terrain elevation values.

Changing a `MapDefinition` produces a different map definition/version; a running city does not silently mutate its definition.

## 8. `MapState`

`MapState` is city/save-specific World state.

Phase 1 state is intentionally minimal:

```text
MapDefinition identity
StartingRegionId
UnlockedRegionIds
```

`StartingRegionId` is permanent city provenance. It is not transient UI state.

Initial invariant:

```text
StartingRegionId ∈ UnlockedRegionIds
```

and the initial new-city state begins with exactly the selected starting region unlocked.

Expansion purchasing/unlocking policy is outside Phase 1 even though the state representation supports multiple unlocked regions.

## 9. Region model

The production map is partitioned into 20 deterministic Regions.

Region geometry belongs to immutable `MapDefinition`.

The canonical geometry representation is cell-based and must be deterministic, non-overlapping, and order-normalized. A production representation may use sorted horizontal cell runs:

```text
RegionCellRun {
  z
  xStartInclusive
  xEndExclusive
}
```

This representation supports irregular regions without making rendered polygons authoritative.

Binding Region invariants:

```text
every playable cell belongs to exactly one Region
Region geometries do not overlap
Region geometry remains inside MapExtent
each Region is cardinally connected
Region run ordering is canonical
```

### 9.1 Region adjacency

Adjacency is derived, never manually authored as a second truth.

```text
Region A adjacent Region B
iff
at least one cell in A shares a cardinal cell edge with one cell in B
```

Diagonal corner contact alone does not create adjacency.

### 9.2 Starting candidates

Exactly four Regions are designated as starting candidates in the production profile.

Each candidate owns one `StartAnchorCell` from `MapDefinition`.

Invariant:

```text
StartAnchorCell belongs to its candidate Region.
```

Eligibility derived from generated Terrain is deterministic. The caller may select only an eligible starting candidate.

## 10. `GridTopology`

`GridTopology` is the sole owner of discrete spatial mathematics for the World grid.

Other systems do not duplicate these formulas.

Required capabilities include:

```text
Cell -> logical Chunk
Cell -> local Cell within Chunk
Vertex -> owner Chunk
Vertex -> incident Cells
Vertex -> touching Chunks
Cell -> cardinal neighbors
Cell rectangle -> intersecting Chunks
world horizontal position -> Cell or out-of-bounds
Cell -> world horizontal bounds
Region geometry -> adjacency
```

Topology operations must be deterministic pure calculations over immutable map geometry.

### 10.1 Logical chunk coordinates

Valid logical chunk coordinates are:

```text
0 <= chunkX < 16
0 <= chunkZ < 16
```

Cell ownership is direct:

```text
chunkX = floor(cellX / 32)
chunkZ = floor(cellZ / 32)
```

### 10.2 Shared vertex ownership

A terrain `VertexCoord` has exactly one logical owner Chunk.

At logical chunk seams, ownership uses the **south-west owner rule**:

```text
west wins an X seam
south wins a Z seam
south-west wins an X+Z corner seam
```

At outer map boundaries, the only existing touching chunk owns the vertex.

One deterministic formulation for a valid vertex coordinate is conceptually:

```text
ownerChunkX = clamp(floor((vertexX - 1) / 32), 0, 15)
ownerChunkZ = clamp(floor((vertexZ - 1) / 32), 0, 15)
```

`GridTopology` owns the actual implementation and tests of this rule.

No Terrain chunk may create a second mutable elevation copy for a seam vertex owned by another chunk.

## 11. Terrain canonical authority

Phase 1 chooses **Vertex-authoritative integer heightfield** as the canonical Terrain representation.

Canonical mapping:

```text
VertexCoord
    ↓
LogicalElevation<int32>
```

This choice is deliberate because it directly supports:

```text
one shared seam truth
fixed triangulated surface
sub-cell geometric queries
logical chunk ownership
atomic vertex mutation
localized dirty propagation
render projection without reverse authority
```

The following are not Terrain authority:

```text
THREE.BufferGeometry
THREE.Mesh
render-sector vertex buffers
GPU buffers
raycast hit Y
computed normals
materials
presentation caches
```

## 12. Vertical numeric model

Canonical elevation is a signed 32-bit logical integer.

The production vertical scale is:

```text
1 LogicalElevation = 250,000 micrometers
                   = 0.25 meters
```

Three.js conversion occurs only at presentation boundaries:

```text
worldYmeters = logicalElevation * 0.25
```

Gameplay-domain comparisons must not rely on presentation floats when an integer/fixed-point comparison can express the rule.

Phase 1 also preserves a future Terraform mutation envelope reference:

```text
8 logical units = 2 meters
```

This does not define Phase 2 Terraform interaction behavior; it only requires Terrain generation to avoid consuming the complete valid vertical domain.

## 13. Terrain logical chunk storage

`TerrainState` is logically partitioned into the same `16 × 16` logical chunk grid defined by World.

Each Terrain chunk stores only vertices for which `GridTopology` identifies that chunk as owner.

Therefore:

```text
one VertexCoord
=
one canonical LogicalElevation
=
one owner Chunk
```

A consumer querying a seam vertex resolves ownership through World topology and reads the one owner value.

Chunk partitioning is storage/update topology, not geometric segmentation. The geometric surface remains continuous across logical chunk boundaries.

## 14. Partial and full Terrain state

Terrain Core may represent a state in which only a subset of logical chunks is loaded.

Queries that require unavailable chunk authority return an explicit unavailable result rather than fabricating data.

However the Phase 1 production new-city path requires:

```text
all 256 logical Terrain chunks materialized
```

before the city enters normal playable presentation.

This distinction allows future streaming architecture without making partial state the production self-contained city baseline.

## 15. Terrain surface authority

Because Terrain is a vertex-authoritative heightfield with fixed triangulation, the continuous playable ground surface is defined by:

```text
canonical Vertex elevations
+
fixed Cell triangulation
```

There is no independent mesh-defined surface authority.

Conceptually:

```text
TerrainState
    ↓
TerrainSurfaceEvaluator
    ↓
Resolved Terrain Surface
    ├─ vertex elevation
    ├─ cell triangles
    ├─ sub-cell height
    ├─ slope facts
    └─ surface plane facts
```

Three.js mesh construction consumes this surface definition.

## 16. Fixed triangulation

Every Cell uses the same diagonal:

```text
NW ───── SE
```

With local cell corners:

```text
NW -------- NE
| \         |
|   \       |
|     \     |
SW -------- SE
```

The two semantic triangles are therefore:

```text
SW / SE / NW
NW / SE / NE
```

The diagonal never changes based on elevation.

At a point lying exactly on the diagonal, triangle selection uses one documented deterministic tie rule and both triangle planes must agree on height along the shared edge.

Roads, Buildings, Terraform, slope queries, picking validation, and presentation must eventually consume this same topology rather than inventing alternate interpolation.

## 17. Sub-cell sampling

Terrain sub-cell horizontal coordinates use fixed-point Q16 semantics:

```text
u, v ∈ [0, 65536]
```

where `0` and `65536` represent the cell edges.

Triangle selection for the NW→SE diagonal is based on the exact integer relation corresponding to the diagonal rather than a float epsilon.

Interpolated height is represented as fixed-point logical elevation during gameplay calculations.

Presentation code may convert the final result to JavaScript floating-point meters.

## 18. Terrain queries

The Terrain read surface must support, at minimum:

```text
get elevation at VertexCoord
get owning logical Chunk
get Cell surface description
get sub-cell surface height
get containing semantic triangle
get deterministic slope/grade facts
get TerrainRevision
get loaded/full-state status
```

Expected out-of-bounds or unloaded-state conditions are explicit query outcomes, not hidden clamps.

Terrain does not answer policy questions such as:

```text
Can a road be built here?
Can a building be placed here?
What does Terraform cost?
Can this Region be purchased?
```

Terrain answers geometric/state facts; consuming systems own their policy.

## 19. Slope and numeric comparison

Gameplay slope decisions must be reproducible independently of GPU, browser frame timing, and floating-point presentation details.

The binding rule is:

```text
integer/fixed-point terrain geometry for gameplay comparison
float vectors only for presentation where exact gameplay authority is not required
```

A Terrain slope query may expose integer rise/run or another exact rational/fixed representation suitable for cross-multiplication.

Consumer policy should compare exact quantities rather than convert to degrees and compare floating-point values when avoidable.

## 20. Deterministic terrain generation

The production generation identity carried into Phase 1 is:

```text
generationProfileId      = balanced-temperate-generation
generationProfileVersion = 2
```

Generation contract:

```text
MapDefinition
+
GenerationProfile
+
explicit caller-selected Seed64
        ↓
Generate exactly once
        ↓
Immutable ProductionTerrainField
        ↓
Materialize TerrainState
```

The generator must not depend on:

```text
Math.random()
render frame order
camera state
GPU results
wall-clock time
Promise completion order
thread scheduling order
platform float quirks for canonical decisions
```

### 20.1 Seed contract

Seed is an explicit unsigned 64-bit value represented at external/config boundaries as a fixed-width hexadecimal string.

The initial accepted production seed catalog contains:

```text
0x5EED5EED5EED5EED
```

The caller explicitly selects a seed from the accepted catalog.

Forbidden behavior:

```text
try seed A
if unsuitable silently try B
if unsuitable silently try C
```

Required behavior:

```text
selected seed
    ↓
generate once
    ↓
evaluate once
    ↓
pass or explicit failure
```

### 20.2 Terrain output fingerprint

The web implementation must establish a deterministic Terrain-output fingerprint over canonical generated elevations in a documented canonical coordinate order.

The Unity reference fingerprint is evidence for the reference implementation only and is not a compatibility target for the TypeScript implementation.

The fingerprint is verification metadata, not MapDefinition identity and not a configuration hash.

## 21. Starting-candidate evaluation

Terrain generation produces deterministic terrain facts used to evaluate the four World-defined starting candidates.

Ownership remains separated:

```text
World
  owns candidate Regions + StartAnchorCell

Terrain
  owns generated surface facts

New City caller/UI
  chooses among eligible candidates
```

The app must not invent candidate eligibility from rendered meshes.

The exact suitability rule belongs in the binding Terrain generation/new-city specification before implementation. It must be deterministic, testable without Three.js, and produce the same result for the same MapDefinition/profile/seed.

## 22. New City construction flow

Phase 1 does not require a new orchestration package solely to construct initial authorities.

The app composition root may perform construction from explicit, already-decided inputs because no running gameplay authority is being mutated yet.

Canonical flow:

```text
Caller selects explicit valid Seed64
        ↓
Terrain generation preparation
        ↓
Generate immutable full ProductionTerrainField
        ↓
Evaluate 4 starting candidates
        ↓
Caller selects one eligible Region
        ↓
Construct MapState
  StartingRegionId = selection
  UnlockedRegionIds = { selection }
        +
Construct full TerrainState from the exact prepared field
        ↓
Attach Three.js presentation
        ↓
Playable Phase 1 world
```

The app composition root may assemble this graph but must not contain hidden terrain suitability rules or silently change seed/starting-region choices.

If future new-city creation mutates already-live multiple authorities rather than constructing initial state, A7 orchestration rules apply.

## 23. Terrain mutation foundation

Terrain mutation is atomic and single-authority.

A mutation request conceptually contains a finite set of requested vertex edits.

Processing contract:

```text
Prepare edits
    ↓
Normalize deterministic order
    ↓
Validate all coordinates/values/chunk availability
    ↓
if any edit invalid
    -> reject entire request, change nothing
    ↓
Apply only actual value changes
    ↓
if no canonical value changed
    -> success/no-op, revision unchanged
    ↓
otherwise
    TerrainRevision += 1
    produce TerrainChangeSet
```

Expected invalid input must not cause partial mutation.

Duplicate edits targeting one VertexCoord in the same request are rejected unless the command contract later defines one unambiguous normalization rule. Phase 1 should prefer rejection because it exposes caller mistakes.

## 24. `TerrainRevision`

`TerrainRevision` is monotonically increasing logical state sequencing owned by Terrain.

Binding rules:

```text
successful canonical change -> +1 revision
rejected mutation           -> unchanged
pure no-op mutation         -> unchanged
presentation rebuild        -> unchanged
query                        -> unchanged
```

Revision does not represent render frame number, wall-clock time, save version, or generation profile version.

## 25. `TerrainChangeSet`

After a successful canonical mutation, Terrain produces a deterministic change report containing enough owner facts to update derived consumers.

At minimum it identifies:

```text
previous TerrainRevision
new TerrainRevision
changed VertexCoords
affected Cells
touching logical Chunks
```

Affected Cells and Chunks are derived through `GridTopology`, not separately guessed by presentation code.

Change ordering is deterministic so tests and downstream consumers do not depend on insertion order.

## 26. Three.js terrain presentation

Three.js is a projection of Terrain authority.

Presentation pipeline:

```text
TerrainState / Terrain queries
        ↓
Resolved Terrain Surface
        ↓
Terrain Three.js projection
        ↓
THREE.BufferGeometry
THREE.Mesh
material
presentation normals
raycast target
```

No reverse mutation path exists from mesh vertices back into Terrain canonical state.

### 26.1 Render sectors

Presentation uses an `8 × 8` render-sector partition:

```text
64 sectors
64 × 64 gameplay cells per sector
2 × 2 logical chunks per sector
```

This is distinct from logical chunk ownership:

```text
logical Chunk = canonical storage/update topology
render Sector  = derived presentation partition
```

A render sector may duplicate boundary vertices in GPU buffers because those copies are derived and immutable with respect to gameplay authority.

### 26.2 Localized rebuild

A Terrain mutation rebuilds only render sectors affected by the `TerrainChangeSet` and their required seam-normal neighborhoods.

Presentation must derive the affected set from canonical topology/change facts rather than scanning or rebuilding the entire world by default.

### 26.3 Seam correctness

Adjacent render sectors must project the same canonical seam positions.

Normal generation must use sufficient incident surface information so visual normals do not create visible false seams where the canonical surface is continuous.

## 27. Picking and semantic query authority

Three.js raycasting may be used to identify a candidate hit in world space.

The authoritative interaction flow is:

```text
pointer
   ↓
Three.js raycast
   ↓
candidate world X/Z
   ↓
World coordinate conversion
   ↓
Terrain semantic Query
   ↓
authoritative terrain facts
```

A raycast hit's interpolated GPU/mesh Y value is not itself gameplay authority.

When a semantic result matters, the app asks Terrain to evaluate the canonical surface at that horizontal location.

## 28. Public package surfaces

### 28.1 World

Expected Phase 1 surfaces:

```text
@web-three-city/world
    read/observe public surface

@web-three-city/world/composition
    app-only construction surface when required
```

A World command surface is not created in Phase 1 unless a real runtime World mutation use case is approved. Initial starting-region state is construction input, while region-expansion gameplay is deferred.

World root may expose stable public values and immutable/read-only capabilities needed by consumers, including coordinate values and GridTopology reads.

### 28.2 Terrain

Expected Phase 1 surfaces:

```text
@web-three-city/terrain
    read/observe surface

@web-three-city/terrain/commands
    atomic Terrain mutation surface

@web-three-city/terrain/composition
    app-only construction/presentation wiring
```

Terrain presentation implementation remains internal to the package unless an app construction entrypoint must be deliberately exposed through `./composition`.

## 29. Approved system dependency direction

Phase 1 approves one direct system read edge:

```text
systems/terrain
      ↓ read-only
systems/world "."
```

Reason:

- Terrain exists in the World-owned grid;
- World owns coordinates, MapDefinition, and GridTopology semantics;
- duplicating those formulas/types inside Terrain would create competing spatial truth;
- the dependency is read-only;
- World does not depend on Terrain;
- the production system graph remains acyclic;
- Terrain never imports World command or composition surfaces.

Terrain application/contracts may consume deliberately public World values/read contracts as required.

Terrain domain internals must still preserve A5 dependency discipline; mapping at the application boundary is preferred where importing an outer World contract into pure domain internals would violate the frozen internal-layer model.

## 30. Snapshot ownership contracts

Phase 1 defines snapshot semantics but does not create concrete persistence infrastructure.

### 30.1 World snapshot

World owns a snapshot capable of representing:

```text
MapDefinition identity/version
StartingRegionId
UnlockedRegionIds in canonical order
```

The snapshot represents World authority; it is not a save-file container.

### 30.2 Terrain snapshot

Terrain owns snapshot semantics capable of representing:

```text
MapDefinition identity linkage
Terrain generation identity
selected generation seed provenance
TerrainRevision
loaded/full-state status
logical chunk snapshots
owned logical elevations
```

Chunk snapshot ordering and vertex ordering are canonical.

### 30.3 Persistence direction

Future persistence remains downstream:

```text
World Snapshot -----┐
                    ├──> future persistence adapter -> bytes/storage
Terrain Snapshot ---┘
```

Forbidden:

```text
World -> persistence implementation
Terrain -> persistence implementation
Mesh -> persistence authority
```

Concrete binary/IndexedDB/file encoding and save/load lifecycle are deferred beyond Phase 1.

## 31. Determinism contract

For the Phase 1 scope, deterministic behavior means:

```text
same MapDefinition
+
same generation profile/version
+
same explicit seed
+
same starting-region choice
+
same ordered mutation inputs
=
same canonical World/Terrain result
```

Deterministic equality is independent of:

```text
browser FPS
GPU
camera
render ordering
wall-clock time
machine speed
Promise scheduling
presentation sector rebuild order
```

Tests compare canonical state and exact integer/fixed-point facts, not screenshots as the primary correctness authority.

## 32. Error and rejection model

Expected input/business-invalid conditions are explicit and typed at application boundaries.

Examples include:

```text
coordinate out of bounds
unknown MapDefinition
invalid Region selection
starting Region not eligible
invalid elevation value
unloaded Terrain owner chunk
conflicting duplicate vertex edit
mutation rejected atomically
unsupported generation profile/version
seed not in accepted production catalog
```

No expected rejection should be represented only as an incidental thrown string from deep implementation code.

Programmer invariant failures remain distinct from expected caller rejection.

## 33. Testing strategy

Phase 1 follows A9 and uses the narrowest authoritative layer.

### 33.1 World focused tests

Required categories:

```text
coordinate validity
Cell -> Chunk mapping
Cell -> local Cell
Vertex owner Chunk at interiors, seams, corners, boundaries
Vertex incident Cells
Vertex touching Chunks
Cell neighbors
world position -> Cell bounds behavior
Region coverage/non-overlap/connectivity
Region adjacency
starting anchor membership
MapState invariants
snapshot canonical ordering
```

### 33.2 Terrain focused tests

Required categories:

```text
one canonical vertex owner
integer elevation conversion
fixed NW-SE triangulation
Q16 triangle selection
sub-cell interpolation
slope exactness
chunk query across seams
partial-state unavailable semantics
atomic mutation rejection
no-op revision semantics
single-increment revision semantics
TerrainChangeSet incidence
snapshot canonical ordering
```

### 33.3 Generation tests

Required categories:

```text
same seed -> same canonical output
same seed repeated in different execution order -> same output
no Math.random dependency
explicit seed only
no fallback seed mining
candidate evaluation determinism
production field complete materialization
fingerprint stability for frozen generator version
```

### 33.4 Presentation tests

Most presentation projection can be tested without a browser when pure geometry builders are isolated.

Browser verification is reserved for behavior that requires real Three.js/browser interaction, such as:

```text
app boots with visible Terrain
raycast/pointer integration
localized render-sector update visible in scene
resource disposal/browser errors
```

### 33.5 Repository acceptance

Phase 1 cannot close unless the relevant exact-head verification passes:

```text
format
lint
typecheck
focused tests
system integration tests
architecture checker
production build
targeted browser tests
Sonar quality gate
clean worktree
```

## 34. Phase 1 vertical-slice acceptance

The minimum production-foundation slice is:

```text
Boot app
   ↓
Resolve production MapDefinition
   ↓
Construct GridTopology
   ↓
Use explicit valid Seed64
   ↓
Generate deterministic full Terrain field
   ↓
Evaluate four starting candidates
   ↓
Choose one eligible Region explicitly
   ↓
Construct MapState + full TerrainState
   ↓
Project Terrain into 8×8 Three.js render sectors
   ↓
Render
   ↓
Raycast candidate location
   ↓
Resolve World Cell
   ↓
Query canonical Terrain surface
```

Acceptance requires that no step relies on Mesh as gameplay truth.

## 35. Binding specification set required before implementation

This Phase 1 document is the cross-system design umbrella.

Before production implementation, it should be refined into binding system specifications under the existing documentation model:

```text
docs/systems/world/
├─ README.md
└─ specs/
   ├─ WORLD-SYSTEM-DESIGN.md
   ├─ WORLD-SPATIAL-CONTRACT.md
   └─ MAP-AND-REGION-CONTRACT.md

docs/systems/terrain/
├─ README.md
└─ specs/
   ├─ TERRAIN-SYSTEM-DESIGN.md
   ├─ TERRAIN-AUTHORITY-CONTRACT.md
   ├─ TERRAIN-SURFACE-CONTRACT.md
   ├─ TERRAIN-GENERATION-CONTRACT.md
   ├─ TERRAIN-MUTATION-CONTRACT.md
   └─ TERRAIN-PRESENTATION-CONTRACT.md
```

Those documents refine algorithms and public contracts without changing the ownership decisions frozen here once this Phase 1 design is approved.

## 36. Recommended Phase 1 delivery sequence

After the design/specification set is frozen, implementation should proceed in dependency order:

```text
P1-A  World / Map / Grid / Region contracts + system
  ↓
P1-B  Terrain authority + logical chunk storage + queries
  ↓
P1-C  Terrain surface / fixed triangulation / Q16 geometry
  ↓
P1-D  Deterministic generation + new-city preparation
  ↓
P1-E  Atomic Terrain mutation + revision/change reporting
  ↓
P1-F  Three.js render sectors + picking
  ↓
P1-G  Snapshot contracts + full vertical-slice verification
```

Each delivery should remain independently testable and should not pre-create later gameplay packages.

## 37. Deferred decisions

The following are deliberately outside this Phase 1 umbrella and require later design before implementation in their own phases:

```text
Terraform player interaction semantics
Road grade policy
Building foundation policy
Region purchase/economy policy
simulation time/scheduler
ECS/data-oriented runtime policy
Hydrology/Water
concrete persistence encoding
save/load transaction lifecycle
runtime event delivery
large-world streaming beyond core partial-Terrain representability
```

The exact procedural algorithm and exact starting-candidate suitability formula are specified by the binding Terrain generation contract; this umbrella fixes their authority, inputs, determinism, and failure semantics.

## 38. Phase 1 final invariants

```text
World owns Map, Grid, Regions, and spatial vocabulary.
Map is a World concept, not a separate system package.
MapDefinition is immutable configuration.
MapState owns city-specific starting/unlocked Region state.
The production map is finite: 512 × 512 cells at 8m per cell.
Logical chunks are 32 × 32 cells; the map has 16 × 16 logical chunks.
GridTopology is the sole owner of World grid formulas.
Shared Terrain vertices have one south-west logical owner.
Terrain canonical authority is signed integer elevation at VertexCoord.
1 elevation unit = 0.25m.
Terrain chunks never keep competing mutable seam copies.
The continuous ground truth is canonical elevations + fixed NW→SE triangulation.
Sub-cell gameplay sampling uses deterministic fixed-point semantics.
Terrain generation uses explicit seed selection and never silently mines fallback seeds.
Terrain mutation is atomic.
No-op/rejected mutation does not advance TerrainRevision.
TerrainChangeSet derives affected topology from GridTopology.
Logical Chunks != Three.js Render Sectors.
Three.js is presentation only.
Raycast hit data is not semantic Terrain authority.
World/Terrain own snapshot meaning; persistence remains downstream.
Terrain may read World root contracts through one approved acyclic read-only edge.
foundation/spatial remains absent until generic ownership is proven.
Phase 1 creates no Roads, Zoning, Buildings, simulation runtime, ECS, or Terraform product tool.
```