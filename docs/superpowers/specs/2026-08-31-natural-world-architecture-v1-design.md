# Natural World Architecture v1 — Design

- **Status:** DRAFT — OWNER REVIEW REQUIRED
- **Date:** 2026-08-31
- **Scope:** Natural-world system ownership, dependency direction, generation, and Terrain-change reconciliation
- **Base:** `master@2718dd0683beefb781729cf6448c089eacb19211`
- **Depends on:** Product Architecture, ADR-001, World contracts, Terrain Engine v1 Production Closure

## 1. Purpose

Terrain Engine v1 is production closed. Before Terraform product work begins, the repository needs a stable architectural answer for natural-world concerns that will consume Terrain later:

```text
Water / Hydrology
Ground / Soil
Shoreline / Coastline classification
Vegetation / Forests
Procedural + authored natural-world generation
```

This design freezes ownership and dependency direction only. It does **not** reopen Terrain Engine v1 and does not prematurely freeze hydrology algorithms, shoreline thresholds, vegetation placement density, rendering details, or Terraform tool semantics.

The goal is to make future Terraform, Water, Ground, Environment, Vegetation, save/load, and map-authoring work fit one deterministic architecture without creating competing world truths.

## 2. Current repository facts

Current production systems are:

```text
systems/world
systems/terrain
```

Terrain already owns:

```text
canonical elevation authority
deterministic generation
exact surface/query semantics
atomic mutation
TerrainRevision
TerrainChangeSet
snapshot/restore
Three.js projection
```

The frozen Terrain mutation receipt already reports deterministic invalidation facts:

```text
TerrainChangeSet {
  previousRevision
  newRevision
  changedVertices[]
  affectedCells[]
  touchingLogicalChunks[]
}
```

No Water, Ground, Shoreline, Environment, or Vegetation authority currently exists.

Terrain generation profile `balanced-temperate-generation / 2` currently generates elevation only. It explicitly excludes water and downstream gameplay facts from Terrain suitability.

## 3. Architecture decision

### 3.1 Selected approach — separate bounded authorities

Natural-world concerns are split into independently owned systems/capabilities:

```text
systems/world
      ↓
systems/terrain
      ↓
systems/ground
      ↓
systems/water
      ↓
systems/environment
      ↓
systems/vegetation
```

The diagram expresses the preferred direct-query dependency direction, not mandatory implementation calls for every feature.

Selected ownership:

```text
World        = map identity, dimensions, coordinates, regions, source metadata
Terrain      = canonical land geometry/elevation
Ground       = canonical surface ground/soil classification
Water        = canonical water bodies and hydrology state
Environment  = derived natural-world classification, including shoreline/coastline
Vegetation   = canonical vegetation state affected by gameplay
```

Cross-authority mutation caused by Terrain edits or natural processes belongs in explicit orchestration, not hidden event subscribers or system-to-system command calls.

### 3.2 Rejected approach — one mega Environment system

Rejected shape:

```text
Environment
├─ Terrain
├─ Water
├─ Soil
├─ Shoreline
└─ Vegetation
```

Reasons:

- creates an oversized authority boundary;
- makes persistence and mutation ownership ambiguous;
- couples unrelated algorithms and release cadence;
- makes future Roads, Buildings, Forestry, Flooding, and Terraform consumers depend on one broad package;
- conflicts with the repository principle `one concept -> one canonical authority`.

### 3.3 Rejected approach — put all natural data in World

Rejected because `systems/world` is spatial/map foundation, not gameplay ownership for hydrology, soil, ecology, or forestry state.

World may reference generation/source metadata but does not absorb downstream canonical state.

## 4. Ownership matrix

| Concern | Owner | Canonical? | Persisted? | Terrain may mutate it? |
| --- | --- | --- | --- | --- |
| Map dimensions / regions / coordinates | World | yes | yes/versioned metadata | no |
| Elevation / terrain geometric authority | Terrain | yes | yes | n/a |
| Ground/soil type | Ground | yes | owner-defined snapshot/source identity | no |
| Water bodies / level / hydrology state | Water | yes | yes when required by state semantics | no |
| Shoreline / coastline / riverbank classification | Environment | derived | no | no |
| Biome-like environmental classification | Environment | derived in v1 | no | no |
| Vegetation/forest gameplay state | Vegetation | yes | yes | no |
| Terrain erosion result | Terrain after explicit Terrain command | yes in Terrain | via Terrain snapshot | Water cannot mutate Terrain directly |
| Flood risk | Water-derived query | derived | no unless future simulation requires canonical history | no |
| Freshwater availability | Water-derived query | derived | no | no |
| Water transport network | future transport/mobility consumer | separate | separate | no |
| Canal construction geometry | future infrastructure/waterway authority | separate | separate | no |

## 5. World system boundary

World continues to own spatial and map-definition facts such as:

```text
MapDefinition
CellCoord / VertexCoord
map bounds
regions
starting candidates
logical chunk topology
```

World does not own:

```text
elevation
water state
soil type
shoreline classification
vegetation state
```

Future map definitions may add natural-world source/profile references, for example conceptually:

```text
NaturalWorldSourceConfig {
  terrain
  ground
  water
  vegetation
}
```

Exact schema is deferred until the first new owning system is specified. The current `MapDefinitionSource` is not changed by this design alone.

## 6. Terrain boundary remains frozen

Natural World v1 does not change Terrain canonical authority or storage.

Terrain continues to expose only Terrain facts through deliberate public surfaces.

Natural-world systems may consume Terrain root read/query APIs where the dependency graph remains acyclic.

They must not:

```text
deep-import Terrain internals
write TerrainState
write Terrain presentation geometry
infer canonical Terrain from Three.js meshes
persist a second elevation field
silently clamp/normalize Terrain edits
```

`TerrainChangeSet` is sufficient as the current coordinate-level invalidation fact. This architecture does not require adding Water, Soil, Shoreline, or Vegetation semantics to `TerrainChangeSet`.

## 7. Ground / Soil system

### 7.1 Purpose

`systems/ground` owns what the surface ground is made of, independently from the Terrain elevation shape.

Initial product vocabulary may include:

```text
LOAM
SAND
CLAY
ROCK
```

Additional categories require an owning Ground contract revision rather than ad-hoc strings in consumers.

### 7.2 Canonical authority

V1 direction:

```text
GroundTypeField[World.CellCoord]
```

A World Cell is the canonical horizontal addressing unit for Ground v1. This does not make Terrain samples or Terrain vertices into Ground cells.

The exact compact storage representation remains an implementation detail.

### 7.3 Generation dependency

Ground generation may depend on:

```text
World map facts
Terrain read facts
explicit Ground generation profile
explicit deterministic seed
```

It does not depend on Water in v1. This keeps the direct-query graph acyclic and avoids a Water <-> Ground package cycle when Water later needs permeability or runoff properties.

### 7.4 Runtime Terrain edits

Ground v1 is **not automatically reclassified** merely because Terraform changes elevation.

Reason: soil/ground material represents location material, not a visual color chosen from current slope.

Future excavation/subsurface strata may introduce depth-aware ground layers through a Ground vNext design. That is outside this architecture freeze.

## 8. Water / Hydrology system

### 8.1 Purpose

`systems/water` owns physical water state and deterministic hydrology semantics.

The Water system is expected eventually to represent:

```text
WaterBody identity
kind / connectivity
water level or surface state
fresh / brackish / salt classification
flow state where applicable
flood occupancy / flood hazard facts where applicable
```

Examples include natural rivers, lakes, ocean/sea water, and later water occupying constructed waterways.

### 8.2 Canonical authority

Water canonical state is separate from Terrain.

Exact numerical representation is intentionally deferred to the Water System Design because it depends on the selected hydrology model. The architecture requirement is:

```text
Terrain elevation truth != Water level/volume/flow truth
```

Water may query Terrain and Ground but may not mutate them.

### 8.3 Dependency direction

Preferred direct read edges:

```text
Water -> World
Water -> Terrain
Water -> Ground
```

Ground must not directly depend on Water in v1.

### 8.4 Erosion ownership

Water may calculate erosion potential or expose hydrology facts used by erosion policy.

Water **must not** directly issue Terrain commands.

If erosion becomes gameplay/simulation behavior:

```text
Water read facts
+ Ground read facts
+ erosion policy
        ↓
explicit cross-system orchestration
        ↓
Terrain command
        ↓
Terrain commit
        ↓
Water reconciliation
```

This preserves ADR-001: one system does not command another system's mutation surface.

### 8.5 Canals

Natural World v1 does not assign constructed canal geometry to Water.

Future canal construction belongs to an explicit infrastructure/waterway authority. Water may then represent water state occupying that geometry through approved read/orchestration contracts.

This avoids conflating:

```text
constructed infrastructure authority
with
physical water authority
```

## 9. Environment classification system

### 9.1 Purpose

`systems/environment` is a derived natural-world classification capability.

V1 includes shoreline/coastline semantics and leaves room for broader deterministic classifications without making Environment a mega canonical state owner.

### 9.2 Shoreline authority

Shoreline is derived from the relationship among upstream truths:

```text
Terrain exact surface
+ Water canonical surface/occupancy
+ Ground classification
        ↓
Environment shoreline classification
```

Conceptual output may include:

```text
ShorelineSegment / ShorelineCell
├─ BEACH
├─ ROCKY_SHORE
├─ CLIFF
├─ MARSH / WETLAND
└─ RIVERBANK
```

Exact thresholds are deferred to the Environment System Design.

### 9.3 Coastline definition

Coastline is not an independent mutable authority.

Conceptually:

```text
Coastline = Shoreline where adjacent WaterBody is ocean/sea class
```

Likewise, riverbank and lake shore are shoreline classifications associated with their WaterBody kinds.

### 9.4 Derived-state rule

Environment classification is reconstructable and is not persisted as canonical save data in v1.

Implementation may cache derived results, but cache identity must include the relevant upstream revisions/source identities and cache invalidation must not become gameplay authority.

## 10. Vegetation / Forest system

### 10.1 Purpose

`systems/vegetation` owns natural vegetation that can eventually be removed, harvested, protected, burned, replanted, or otherwise changed by gameplay.

Expected categories include:

```text
trees / forest
grassland
shrubs
wetland vegetation
```

Exact taxonomy and placement granularity are deferred.

### 10.2 Canonical authority

Vegetation is canonical rather than a permanently regenerated presentation scatter because future gameplay requires durable identity/change.

Initial vegetation can be procedurally generated, but after materialization gameplay state belongs to Vegetation and is persisted according to the Vegetation snapshot contract.

Three.js instances are presentation projection only.

### 10.3 Generation inputs

Vegetation generation may consume:

```text
World
Terrain
Ground
Water
Environment classifications
explicit Vegetation generation profile
explicit deterministic seed
```

Typical suitability examples:

```text
steep rock          -> sparse/no forest
loam + moisture     -> forest/grass suitability
wet lowland         -> wetland vegetation
sand + coast        -> beach vegetation profile
```

These are illustrative; exact ecological rules belong to the Vegetation System Design.

## 11. Direct dependency graph

The preferred graph is intentionally acyclic:

```text
World
  ↑
Terrain
  ↑
Ground
  ↑
Water
  ↑
Environment
  ↑
Vegetation
```

More precisely, multiple read edges are allowed:

```text
Terrain      -> World
Ground       -> World + Terrain
Water        -> World + Terrain + Ground
Environment  -> World + Terrain + Ground + Water
Vegetation   -> World + Terrain + Ground + Water + Environment
```

A system imports only another system's root read surface. No system imports another system's `./commands` or `./composition` surface.

If a future requirement would introduce a direct dependency cycle, one direction must be inverted through an owner-defined read port and app composition as required by ADR-001.

## 12. Natural-world generation architecture

### 12.1 Generation is deterministic per owning system

Each owning system owns its own generation algorithm/profile and versioning.

Conceptual pipeline:

```text
validated MapDefinition
+ selected city/world seed identity
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

This is a dependency pipeline, not permission for a central generator to write every system's internals.

Each system validates and materializes its own state.

### 12.2 Seed policy

Current Terrain generation compatibility is preserved:

```text
Terrain receives the caller-selected Terrain Seed64 unchanged.
```

Natural-world systems introduced later receive explicit deterministic seeds/source identities. Domain-separated seed derivation is allowed only through a frozen, versioned Natural World Generation contract.

This design intentionally does not pick an ad-hoc hash/PRNG derivation algorithm yet.

No system may use ambient `Math.random()`, wall-clock time, renderer state, or device identity for canonical generation.

### 12.3 Generation profile independence

Profile versions are system-owned:

```text
TerrainGenerationProfileVersion
GroundGenerationProfileVersion
WaterGenerationProfileVersion
VegetationGenerationProfileVersion
```

Changing Ground generation does not require pretending Terrain generation changed.

### 12.4 No central mega-state

There is no canonical `NaturalWorldState` duplicating all system state.

A higher-level generation/bootstrap result may aggregate read-only identities/receipts for diagnostics, but canonical ownership remains with each system.

## 13. Procedural, hand-crafted, and hybrid maps

The long-term map pipeline supports three source modes per owning system:

```text
PROCEDURAL
AUTHORED
HYBRID
```

### 13.1 Procedural

The owning system receives validated map facts, explicit profile/version, and explicit deterministic seed/source identity, then produces its canonical initial state.

### 13.2 Authored

A map-authoring tool produces an external versioned payload for the owning system.

The owning system validates and materializes that payload through an approved import/construction boundary.

The editor never writes internal runtime objects directly.

### 13.3 Hybrid

Hybrid maps combine a deterministic procedural base with explicit authored overrides through an owner-defined versioned source format.

The merge rule belongs to the owning system and must be deterministic.

### 13.4 Map Editor boundary

A future Map Editor is an application/tooling surface, not canonical authority.

Conceptual flow:

```text
Map Editor UI
   ↓
versioned authored source payloads
   ↓
owner validation/import
   ↓
canonical system state
```

Map editor implementation is not part of Natural World v1 implementation scope.

## 14. Terrain change propagation

### 14.1 Terrain stays the first commit owner

For a Terrain mutation:

```text
Terrain command
  ↓
validate
  ↓
atomic Terrain commit
  ↓
TerrainMutationReceipt / TerrainChangeSet
```

The Terrain command does not synchronously mutate Water, Environment, Ground, or Vegetation.

### 14.2 `TerrainChangeSet` is the invalidation seed

Natural-world reconciliation can begin from:

```text
changedVertices
affectedCells
touchingLogicalChunks
previousRevision
newRevision
```

Consumers may expand the affected region according to their own algorithmic neighborhood requirements.

Example:

```text
Terrain affectedCells
  ↓
Water expands to hydrologically connected region if required
  ↓
Environment invalidates shoreline classifications intersecting changed Water/Terrain region
  ↓
Vegetation validates affected placements
```

Terrain does not need to know those expansion rules.

## 15. Cross-system reconciliation after Terraform or other Terrain edits

### 15.1 Explicit orchestration

Once more than Terrain is implemented and a Terrain edit requires mutations in other canonical authorities, coordination belongs in a dedicated orchestration concern, conceptually:

```text
orchestration/natural-world-reconciliation
```

Expected high-level flow:

```text
player/natural-process intent
        ↓
Terrain command
        ↓ success
TerrainChangeSet
        ↓
Water reconcile command, if Water state is affected
        ↓
Environment derived invalidation/reclassification
        ↓
Vegetation reconcile command, if canonical vegetation becomes invalid
        ↓
presentation refreshes
```

The exact package is created only when a second mutation authority actually exists.

### 15.2 No hidden event-driven mutation

A Water or Vegetation subscriber must not silently mutate canonical state when caller correctness depends on that result.

Integration Events may later notify independent consumers, but correctness-sensitive multi-authority updates require explicit orchestration under ADR-001.

### 15.3 Failure semantics

Terrain commit success is not retroactively converted into Terrain rejection if a later downstream reconciliation fails.

Before multi-authority Terraform ships, its owning orchestration design must define recovery/dirty-state behavior under the repository's persistence/transaction policy.

This design does not invent partial rollback across systems before ADR-003 is implemented.

## 16. Terraform implications

Natural World Architecture v1 intentionally does not freeze Terraform strength, brush size, flatten rules, preview, gesture, cost, or elevation bounds.

It freezes only these integration constraints:

1. Terraform must use the Terrain command surface; it cannot mutate Terrain internals.
2. Terraform may query Water/Ground/Environment/Vegetation public read surfaces for validation/product feedback when those systems exist.
3. Once a Terraform action affects multiple canonical authorities, coordination must be explicit orchestration rather than system-to-system commands.
4. `TerrainChangeSet` is the starting invalidation fact; Terrain does not gain Water/Vegetation semantics.
5. Future Terraform Undo design must account for canonical downstream changes caused by the same player action. It may not restore Terrain while leaving required dependent authority in an impossible state.
6. Until downstream systems exist, Terraform may remain Terrain-only without speculative Water/Ground/Vegetation implementation.

## 17. Runtime update model by subsystem

### Ground

```text
Terrain edit
-> no automatic Ground mutation in v1
```

### Water

```text
Terrain edit
-> explicit Water reconciliation when affected
```

Exact local-vs-connected-region recomputation belongs to Water design.

### Environment

```text
Terrain/Water/Ground revision/source change
-> derived cache invalidation
-> deterministic recomputation on demand or scheduled projection refresh
```

No canonical Environment mutation is required for shoreline classification.

### Vegetation

```text
Terrain/Water/Environment change
-> explicit validation/reconciliation of affected canonical vegetation
```

Whether invalid vegetation is removed, relocated, damaged, or rejected is a Vegetation/feature policy and must not be hidden inside Terrain.

## 18. Persistence and save/load ownership

Each canonical owner defines its own versioned snapshot/source contract.

Expected direction:

```text
CitySave envelope
├─ World identity/state
├─ Terrain snapshot
├─ Ground snapshot/source identity
├─ Water snapshot
└─ Vegetation snapshot
```

Environment shoreline/biome classification is derived and is not persisted as canonical v1 save state.

No subsystem may serialize Three.js meshes, materials, instancing buffers, debug overlays, or other reconstructable presentation state as canonical natural-world authority.

Cross-system save consistency belongs to persistence/city-session orchestration rather than one gameplay system.

## 19. Gameplay consumer boundaries

Natural-world systems expose facts; downstream gameplay owns its own policy.

Examples:

```text
Water freshwater query
    -> utility/water-service gameplay decides supply mechanics

Water navigability query
    -> transport/mobility decides routes

Water flood-hazard query
    -> buildings/roads/insurance/economy decide consequences

Ground bearing/suitability query
    -> building/road construction decides cost/validity

Vegetation state
    -> forestry/conservation/economy decides exploitation/protection rules
```

Water must not become the owner of transport, economy, building validity, or utility-service gameplay simply because those systems consume water facts.

## 20. Presentation ownership

Each owning system may provide its own Three.js presentation integration through its approved package architecture.

Examples:

```text
Terrain      -> terrain mesh
Water        -> water surface/flow visuals
Environment  -> shoreline material/decal classification projection
Vegetation   -> instanced trees/grass/shrubs
```

Presentation remains downstream from canonical/derived state.

Visual shoreline, foam, waves, tree billboards, and material blending never become gameplay authority.

## 21. Initial implementation order

After owner approval of this architecture, implementation should proceed by separate spec/plan cycles rather than one giant natural-world PR.

Recommended order:

```text
NW0  Natural World architecture/contracts documentation
     ↓
Terraform v1 design + Terrain-only implementation
     ↓
NW1  Ground Foundation
     ↓
NW2  Water/Hydrology Foundation
     ↓
NW3  Environment + Shoreline Classification
     ↓
NW4  Vegetation Foundation
     ↓
NW5  Natural-world reconciliation integration
     ↓
NW6  Procedural natural-world generation integration
     ↓
NW7  Authored/Hybrid map source contracts
     ↓
Map Editor implementation later
```

Reason for Ground before Water: Water may consume permeability/runoff-related Ground facts, while Ground v1 deliberately does not depend on Water. This preserves an acyclic direct dependency graph.

Terraform may start after NW0 because Terrain already exposes the mutation/query primitives Terraform requires. The design above prevents Terraform from accidentally owning future Water, Soil, Shoreline, or Vegetation semantics.

## 22. Required subsystem design gates

Before each subsystem implementation, its own design must identify:

```text
Purpose
Canonical Authority
Derived State
Queries
Commands
Integration Events if any
Generation profile/source contract
Revision semantics
Snapshot/restore policy
External read dependencies
Terrain-change reconciliation behavior if applicable
Presentation boundary
Performance budget/baseline plan
Tests and release gates
```

Specific required questions:

### Ground design

```text
exact GroundType taxonomy
Cell-level storage contract
generation algorithm/profile
construction suitability properties
snapshot/source strategy
```

### Water design

```text
hydrology model
water-body identity/connectivity
water level/volume representation
flow representation
river/lake/ocean initialization
flood semantics
reconciliation neighborhood
revision/event model
snapshot/restore
```

### Environment design

```text
shoreline geometry/addressing
classification thresholds
coastline/riverbank/lakeshore queries
cache/revision invalidation
```

### Vegetation design

```text
canonical granularity
species/category taxonomy
initial generation
deterministic placement
harvest/removal/conservation semantics
reconciliation after Terrain/Water changes
snapshot/restore
```

## 23. Verification gates for Natural World architecture

NW0 documentation/architecture acceptance requires:

```text
Terrain Engine v1 remains unchanged
no new natural-world runtime package yet
no competing Terrain authority
no Water/Ground/Vegetation fields added to World or Terrain
ownership matrix has no duplicate mutable authority
direct dependency direction is acyclic by design
multi-authority mutation is explicitly orchestration-owned
shoreline is derived, not a separately persisted truth
procedural/authored/hybrid source modes preserve owning-system validation
```

Future implementation gates must include architecture-tool verification for package surfaces and cycle detection.

## 24. Explicit non-goals

Natural World Architecture v1 does not implement or freeze:

```text
hydraulic simulation algorithm
Navier-Stokes or fluid physics
rain/weather system
season system
climate simulation
erosion rate equations
shoreline classification thresholds
wave rendering
ocean shader
vegetation assets/species list
forestry economy
map editor UI
canal construction tool
Terraform product semantics
Roads/building integration
```

These remain future owner-specific designs.

## 25. Binding invariants proposed for freeze

```text
Terrain Engine v1 stays production closed.
World owns spatial/map identity, not natural-world gameplay state.
Terrain owns land geometry/elevation only.
Ground owns canonical ground/soil classification.
Water owns canonical water bodies and hydrology state.
Environment derives shoreline/coastline; it does not create a second Water or Terrain truth.
Vegetation owns gameplay-relevant vegetation state.
No system imports another system's command or composition surface.
Direct system read dependencies remain acyclic.
Water never mutates Terrain directly; erosion is explicit cross-system orchestration.
TerrainChangeSet remains Terrain-only and seeds downstream invalidation.
Correctness-sensitive downstream mutation after Terrain edits is explicit orchestration.
Each owning system owns its own deterministic generation profile/version.
Terrain's existing selected Seed64 compatibility is preserved.
Procedural, authored, and hybrid map data enter through owner validation boundaries.
Derived natural-world presentation/cache state is never persistence authority.
Terraform can begin after this architecture freeze without implementing all natural-world systems first.
```

## 26. Decision checkpoint

If the owner approves this written design, the next action is to mark the Natural World Architecture v1 contract as approved/frozen and create a focused implementation plan for **NW0 documentation/contract closure only**.

Runtime Ground/Water/Environment/Vegetation implementation remains separate future milestones, while Terraform v1 may proceed immediately after NW0 closure.
