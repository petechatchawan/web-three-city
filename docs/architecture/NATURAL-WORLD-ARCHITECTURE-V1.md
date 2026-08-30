# Natural World Architecture v1

- **Status:** FROZEN — OWNER APPROVED 2026-08-31
- **Date:** 2026-08-31
- **Scope:** Natural-world ownership, dependency direction, generation boundaries, and Terrain-change reconciliation
- **Base design:** `docs/superpowers/specs/2026-08-31-natural-world-architecture-v1-design.md`
- **Terrain baseline:** `master@2718dd0683beefb781729cf6448c089eacb19211`
- **Depends on:** Product Architecture, ADR-001, World contracts, Terrain Engine v1 Production Closure

## 1. Decision

Terrain Engine v1 remains production closed. Natural-world behavior is split into separate bounded authorities/capabilities rather than being absorbed into Terrain, World, or one mega Environment system.

Canonical ownership is:

```text
World        = map identity, dimensions, coordinates, regions, source metadata
Terrain      = canonical land geometry/elevation
Ground       = canonical surface ground/soil classification
Water        = canonical water bodies and hydrology state
Environment  = derived natural-world classification, including shoreline/coastline
Vegetation   = canonical vegetation state affected by gameplay
```

The preferred direct-query dependency direction is acyclic:

```text
Terrain      -> World
Ground       -> World + Terrain
Water        -> World + Terrain + Ground
Environment  -> World + Terrain + Ground + Water
Vegetation   -> World + Terrain + Ground + Water + Environment
```

A system may import another system only through its approved root read surface. System-to-system command/composition imports remain forbidden by ADR-001.

## 2. Terrain remains frozen

Natural World v1 does not modify Terrain authority, storage, generation profile, mutation semantics, snapshot format, or Three.js ownership.

Natural-world systems may consume Terrain public read/query contracts but must not:

```text
deep-import Terrain internals
mutate TerrainState
persist a second elevation truth
infer canonical Terrain from Three.js meshes
attach Water, Soil, Shoreline, or Vegetation semantics to TerrainChangeSet
```

The existing `TerrainChangeSet` is sufficient as the coordinate-level invalidation seed:

```text
previousRevision
newRevision
changedVertices[]
affectedCells[]
touchingLogicalChunks[]
```

Consumers own any algorithm-specific expansion beyond those coordinates.

## 3. Ground / Soil ownership

`systems/ground` owns surface ground classification independently from Terrain elevation.

V1 direction:

```text
GroundTypeField[World.CellCoord]
```

Initial vocabulary may include:

```text
LOAM
SAND
CLAY
ROCK
```

Ground generation may depend on World, Terrain, an explicit Ground generation profile, and an explicit deterministic seed/source identity.

Ground v1 does not depend directly on Water. This preserves an acyclic dependency graph and allows Water later to consume Ground permeability/runoff facts without creating `Ground <-> Water` coupling.

Terraform elevation changes do not automatically rewrite Ground type in v1. Ground represents material/classification, not a color derived from current slope.

## 4. Water / Hydrology ownership

`systems/water` owns physical water state and deterministic hydrology semantics, including future concepts such as:

```text
WaterBody identity
river / lake / ocean or sea classification
water level or surface state
fresh / brackish / salt classification
flow state
flood occupancy / flood hazard
```

Water authority is distinct from Terrain authority:

```text
Terrain elevation truth != Water level/volume/flow truth
```

Water may read World, Terrain, and Ground. Water may not directly mutate Ground or Terrain.

### Erosion

Water may calculate erosion potential, but erosion that changes land geometry must be explicit cross-system orchestration:

```text
Water read facts
+ Ground read facts
+ erosion policy
        ↓
explicit orchestration
        ↓
Terrain command
        ↓
Terrain commit
        ↓
Water reconciliation
```

A Water subscriber must never secretly issue correctness-critical Terrain mutation.

### Canals

Constructed canal geometry is not Water authority. A future infrastructure/waterway owner may define constructed geometry; Water may represent physical water occupying it through approved contracts.

## 5. Environment / Shoreline ownership

`systems/environment` is a derived natural-world classification capability, not a mega canonical state owner.

Shoreline is derived from upstream truths:

```text
Terrain exact surface
+ Water canonical surface/occupancy
+ Ground classification
        ↓
Environment shoreline classification
```

Possible classifications include:

```text
BEACH
ROCKY_SHORE
CLIFF
MARSH / WETLAND
RIVERBANK
```

Exact thresholds belong to the Environment System Design.

Coastline is not independent mutable state. Conceptually:

```text
Coastline = Shoreline adjacent to ocean/sea-class WaterBody
```

Environment classifications are reconstructable in v1 and are not persisted as canonical save authority. Caches are allowed only as derived data keyed/invalidation-safe against upstream identities/revisions.

## 6. Vegetation / Forest ownership

`systems/vegetation` owns natural vegetation that can later be removed, harvested, protected, burned, replanted, or otherwise changed by gameplay.

Expected categories include:

```text
trees / forest
grassland
shrubs
wetland vegetation
```

Vegetation is canonical after initial materialization because future gameplay changes must persist. Three.js vegetation instances are presentation only.

Vegetation generation may consume World, Terrain, Ground, Water, Environment classification, an explicit Vegetation generation profile, and an explicit deterministic seed/source identity.

## 7. Natural-world generation

Each owning system owns its own generation algorithm, validation, profile/version, and materialization boundary.

Dependency pipeline:

```text
validated MapDefinition
+ explicit source/seed identities
        ↓
Terrain generation
        ↓
Ground generation
        ↓
Water generation / hydrology initialization
        ↓
Environment derived classification
        ↓
Vegetation generation
```

This pipeline does not create a central canonical `NaturalWorldState` and does not permit a central generator to write system internals.

Canonical generation must not depend on:

```text
Math.random()
wall-clock time
render/GPU results
browser/device identity
Promise completion order
```

Terrain keeps its existing caller-selected Seed64 semantics unchanged. Domain-separated seed derivation for future natural-world systems requires its own frozen, versioned contract before use.

## 8. Procedural, authored, and hybrid maps

Long-term source modes are supported per owning system:

```text
PROCEDURAL
AUTHORED
HYBRID
```

### Procedural

The owner receives validated map facts, explicit generation profile/version, and explicit deterministic source/seed identity and materializes its own state.

### Authored

A map-authoring tool produces a versioned source payload. The owning system validates/imports the payload; the editor never writes runtime internals directly.

### Hybrid

An owner-defined deterministic merge combines a procedural base with versioned authored overrides.

A future Map Editor is an application/tooling surface, not canonical authority.

## 9. Terrain-change propagation

A Terrain mutation always commits to Terrain first:

```text
Terrain command
  ↓
validate
  ↓
atomic Terrain commit
  ↓
TerrainMutationReceipt / TerrainChangeSet
```

Terrain does not synchronously mutate Water, Environment, Ground, or Vegetation.

Natural-world consumers begin invalidation/reconciliation from Terrain's existing coordinate facts and expand according to their own algorithms.

Example:

```text
Terrain affectedCells
  ↓
Water expands to required hydrological region
  ↓
Environment refreshes impacted shoreline classification
  ↓
Vegetation validates impacted canonical placements/state
```

Ground v1 remains stable under elevation-only Terraform unless a future Ground command/policy explicitly changes it.

## 10. Cross-system reconciliation

When a Terrain edit requires mutation of more than one canonical authority, sequencing belongs in explicit orchestration, conceptually:

```text
orchestration/natural-world-reconciliation
```

The orchestration concern may coordinate typed commands and failures. It must not turn Integration Events into hidden commands or violate owning-system atomicity.

Environment refresh remains derived invalidation/recomputation rather than a second canonical mutation authority.

The exact consistency policy for Water/Vegetation reconciliation is deferred until those systems exist and ADR-003 persistence/transaction requirements are concrete.

## 11. Terraform relationship

Terraform remains a separate player-facing system/capability that translates player intent into Terrain commands.

Natural World v1 does not require Ground, Water, Environment, or Vegetation runtime implementation before Terraform v1 begins.

Terraform may proceed against the already-frozen Terrain public contracts. As natural-world systems are introduced later, cross-authority effects attach through explicit reconciliation/orchestration rather than by reopening Terrain or embedding natural-world policy inside Terraform.

## 12. Milestone order

Frozen roadmap order:

```text
NW0  Natural World Architecture closure
 ↓
Terraform v1
 ↓
NW1  Ground Foundation
 ↓
NW2  Water / Hydrology Foundation
 ↓
NW3  Environment + Shoreline
 ↓
NW4  Vegetation Foundation
 ↓
NW5  Natural-world reconciliation
 ↓
NW6  Full procedural natural-world generation
 ↓
NW7  Authored / Hybrid map contracts
 ↓
Map Editor
```

Each runtime subsystem milestone receives its own focused system spec and implementation plan. Natural World v1 is not permission to implement NW1-NW7 as one coupled change.

## 13. Deferred decisions

The following are intentionally not frozen by this architecture record:

```text
Water numerical solver / volume representation
river generation algorithm
lake/ocean boundary algorithm
flow cadence and simulation scheduler integration
shoreline classification thresholds
soil compact storage encoding
vegetation taxonomy and placement density
vegetation object granularity
flood-history persistence
climate/weather model
erosion rate/formula
constructed canal authority design
natural-world seed derivation algorithm
Map Editor UX/file format
```

Each belongs to the owning subsystem design or a dedicated cross-system ADR/spec when implementation reaches that milestone.

## 14. Binding invariants

```text
Terrain Engine v1 remains production closed.
One natural-world concept has one owning authority.
World remains spatial/map foundation, not natural-world mega-state.
Ground, Water, and Vegetation own distinct canonical state.
Environment shoreline/coastline is derived, not competing canonical truth.
Direct system read dependencies remain acyclic.
Systems never command other systems directly.
Water cannot mutate Terrain directly.
Erosion that changes Terrain uses explicit orchestration.
Existing TerrainChangeSet remains Terrain-only and is sufficient as the invalidation seed.
Ground v1 is stable under elevation-only Terraform.
Initial vegetation may be generated, but post-materialization vegetation gameplay state is canonical and persisted by Vegetation.
Procedural/authored/hybrid sources enter through owning-system validation boundaries.
Canonical generation uses deterministic explicit inputs only.
Terrain Seed64 compatibility is preserved.
Terraform may proceed before NW1-NW7 runtime implementation.
Each NW runtime milestone gets a separate focused spec and implementation plan.
```
