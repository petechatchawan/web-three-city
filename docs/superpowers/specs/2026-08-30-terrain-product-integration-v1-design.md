# Terrain Product Integration v1 Design

- **Status:** FROZEN — OWNER APPROVED 2026-08-30
- **Date:** 2026-08-30
- **Scope:** Seeded Terrain generation, canonical save/restore, Terrain debug visualization, production camera/input, semantic pointer picking, New/Load/Resume City lifecycle, IndexedDB persistence, and clean application UI
- **Base:** P1-F Three.js Terrain Presentation at `15205bb5c0f47bba5ddfe005ce5c3ad63d79f259`

## 1. Goal

Turn the current verified Terrain engine/presentation into a maintainable product path that can be used from the main application:

```text
Home
├─ Resume City
├─ New City
│  └─ explicit Seed64 -> deterministic Terrain -> select eligible Region -> create/save -> game
└─ Load City
   └─ saved canonical World/Terrain -> validate/restore -> game

Game
├─ production PC/mobile camera
├─ semantic Terrain picking
├─ Terrain debug visualization
└─ explicit Save
```

This tranche does not add Terraform, Roads, Zoning, Buildings, Hydrology/Water, economy, simulation time, ECS, cloud sync, or background autosave.

## 2. Architecture choice

Use existing ownership boundaries and add one real orchestration concern:

```text
apps/game
  ├─ screens / UI primitives
  ├─ camera + input presentation
  ├─ pointer -> Raycaster adapter
  ├─ IndexedDB adapter
  └─ composition adapters
            │
            ▼
orchestration/city-session
  ├─ New City workflow
  ├─ Load City workflow
  ├─ Resume City workflow
  └─ Save City workflow
            │
      ┌─────┴─────┐
      ▼           ▼
systems/world   systems/terrain
```

`orchestration/city-session` owns sequencing, not World/Terrain authority. Because architecture rules forbid orchestration from consuming system `./composition`, the orchestration concern consumes narrow lifecycle ports supplied by `apps/game` composition adapters. Those adapters are wiring only; they call World/Terrain composition factories and do not decide policy.

## 3. Cross-cutting implementation principles

### 3.1 Functional core / imperative shell

Pure/deterministic functions own:

```text
Seed64 parsing/canonicalization
camera reducer/constraints
pointer coordinate conversion
gesture classification
save validation/codec mapping
debug geometry data derivation
city-session decision sequencing where side effects are represented by ports
```

Imperative boundaries own:

```text
Three.js object allocation/disposal
DOM listeners and pointer capture
IndexedDB requests/transactions
crypto random seed generation
clock/UUID adapters
screen mounting/unmounting
```

No new application `class` is required. Factories plus closure-owned state are preferred unless a third-party API requires construction.

### 3.2 No magic product constants

Each product value has one named owner. Examples:

```text
Map dimensions/cell size        -> MapDefinitionRead
Terrain logical elevation range -> Terrain elevation owner
Render-sector size              -> RENDER_SECTOR_CELLS
Seed format                     -> Terrain Seed64 parser
Camera limits/speeds            -> CITY_CAMERA_DEFAULT_CONFIG
Gesture thresholds              -> CITY_INPUT_DEFAULT_CONFIG
Debug normal stride/length      -> TERRAIN_DEBUG_DEFAULT_CONFIG
Save schema/database versions   -> persistence schema owner
UI dimensions/tokens            -> CSS design tokens
```

Derived values are calculated rather than re-authored.

### 3.3 No presentation authority leak

Never persist or treat as semantic truth:

```text
THREE.Mesh
BufferGeometry
Material
normal buffers
Raycaster hit Y
RenderSector IDs
camera state
DOM state
debug visibility
```

The same saved World/Terrain must be able to destroy and recreate all Three.js/UI objects without changing semantic state.

## 4. Seeded Terrain generation v2 semantics

### 4.1 Product behavior

The generator algorithm already supports arbitrary 64-bit seed input. Product preparation currently restricts use to one accepted seed and one expected fingerprint. That restriction is removed.

Valid external Seed64:

```text
0x + exactly 16 hexadecimal digits
```

Canonical representation is uppercase hexadecimal after `0x`.

Flow:

```text
caller-selected Seed64
-> canonicalize/validate
-> generate exactly once
-> validate production envelope
-> fingerprint generated field
-> evaluate all World starting candidates
-> reject if no eligible candidate
-> return PreparedProductionTerrain
```

No seed retry/mining occurs inside Terrain. UI may explicitly ask the user to Randomize and generate another caller-selected seed.

### 4.2 Fingerprint semantics

A fingerprint identifies generated canonical Terrain output for the selected seed. It is not a global constant across all seeds.

The historical production vector remains a golden regression vector:

```text
Seed        0x5EED5EED5EED5EED
Fingerprint 0xF2FA29BFD2AEB069
```

Changing the generator algorithm under `balanced-temperate-generation / 2` remains forbidden. Golden vectors and algorithm-level tests catch accidental changes.

### 4.3 World ownership correction

`acceptedTerrainSeeds` is removed from World MapDefinition. Seed validity belongs to Terrain generation, not World spatial/map authority. World continues to own the Terrain generation profile identity/version attached to the map.

## 5. Canonical snapshots and restore

### 5.1 World

World owns its snapshot and restore validation:

```text
MapDefinition identity/version
StartingRegionId
UnlockedRegionIds canonical order
```

`restoreWorldSystem()` is a composition-only construction surface. Invalid map identity, unknown Region, duplicate/unordered invalid data, or inconsistent starting/unlocked state rejects explicitly.

### 5.2 Terrain

Terrain snapshot stores:

```text
snapshotVersion
generationProfileId/version
mapDefinitionId
selectedSeed64
fingerprint
revision
completeness
chunks ordered (z,x)
  chunkCoord
  owned canonical elevations ordered (z,x)
```

No presentation state is stored.

`restoreTerrainSystem()` validates all metadata, chunk ownership/count, canonical vertex uniqueness, elevation validity, completeness, and optional fingerprint/provenance consistency before publishing a TerrainSystem.

Restore does not regenerate Terrain. The saved canonical authority is authoritative for an existing city.

### 5.3 Round-trip invariant

```text
Generate -> mutate -> snapshot -> destroy -> restore
```

must preserve:

```text
canonical elevations
revision
World MapState
Terrain provenance
semantic surface query results
```

Recreating Three.js projection after restore must not mutate the restored state.

## 6. Terrain debug visualization

Debug visualization is system-owned Three.js presentation because it projects Terrain semantics. It is separate from the production Terrain mesh.

```text
TerrainThreeProjection
  -> production surface

TerrainThreeDebugOverlay
  -> optional diagnostic layers
```

Layers:

```text
cellGrid
renderSectors
vertices
triangles
normals
elevation
```

All are off by default.

### 6.1 Resource topology

Debug resources are per render sector where locality matters. `TerrainChangeSet` maps through the existing dirty-sector resolver so enabled geometry is rebuilt only for affected sectors.

The debug overlay has one lifecycle owner and exposes:

```ts
setVisibility(next)
rebuild(changeSet)
dispose()
```

No debug layer mutates Terrain.

### 6.2 Grid

Gameplay grid derives spacing from `MapDefinitionRead.cellSizeMeters`. Lines conform to canonical Terrain elevations; a flat world-Y grid is forbidden.

### 6.3 Normals

Normal visualization samples semantic presentation normals with a configured stride. Full 263,169-vector display is not the default.

### 6.4 Elevation

Elevation visualization uses an overlay material/vertex-color representation and derives normalization from observed/canonical values according to one debug config. It never changes production material or canonical elevations.

## 7. Production camera system

Production camera is app presentation, not a gameplay system package and not Terrain authority.

### 7.1 State model

Canonical camera presentation state is plain data:

```ts
CityCameraState {
  targetX
  targetY
  targetZ
  distance
  azimuthRadians
  elevationRadians
}
```

A pure reducer applies intents:

```text
pan
rotate
zoom
reset
```

A Three.js adapter maps the resulting state to `PerspectiveCamera.position/lookAt`.

### 7.2 Constraints

Bounds derive from MapDefinition and config. Target X/Z is clamped to playable extent. Distance and elevation are clamped to configured min/max. Camera Y target may use semantic Terrain picking when available, but the camera never changes Terrain.

### 7.3 Desktop controls

```text
Tap/click without drag -> semantic pick
Primary drag           -> pan
Secondary drag         -> rotate
Wheel                   -> zoom
```

A movement beyond the configured tap threshold cancels tap/pick.

### 7.4 Mobile controls

```text
one-finger tap          -> semantic pick
one-finger drag         -> pan
two-finger centroid     -> pan
two-finger distance     -> zoom
two-finger angle        -> rotate
```

The viewport uses Pointer Events as the single hardware-agnostic input model and `touch-action: none` only on the interactive 3D viewport so browser scrolling/zoom does not steal game gestures. Pointer capture is acquired during active gestures and released on up/cancel/dispose.

No document-global pointer listeners are required.

## 8. Semantic picking

Three.js remains candidate detection only.

```text
Pointer client coordinates
-> viewport-local NDC
-> Raycaster
-> candidate Terrain mesh intersection
-> candidate X/Z only
-> World.worldPositionToCell
-> Cell bounds -> Q16 local coordinates
-> Terrain.sampleSurface
-> authoritative TerrainPick
```

Production pick returns:

```text
CellCoord
uQ16/vQ16
world X/Z candidate
world Y from semantic Terrain height
triangle
riseX/riseZ/runUnits
revision
```

Raw `intersection.point.y` is never propagated as semantic result.

Picking is routed only after gesture arbitration declares a tap/click. Camera drag/pinch/rotate must never also activate pick.

## 9. City session orchestration

`@web-three-city/orchestration-city-session` coordinates lifecycle across World, Terrain, and persistence without owning either system's domain.

### 9.1 Ports

The concern owns narrow ports for capabilities it cannot directly import:

```text
WorldLifecyclePort
TerrainLifecyclePort
CitySaveRepository
Clock
IdSource
```

Lifecycle ports are implemented in app composition using system `./composition` factories. Persistence/clock/id are environment ports implemented by browser adapters.

### 9.2 New City

```text
prepare World definition
-> prepare Terrain from explicit seed
-> return preview facts + eligible Regions
-> caller selects eligible Region
-> construct World/Terrain
-> capture canonical save
-> repository.save()
-> return live CitySession
```

Generation and city creation are two explicit stages so UI can show the generated seed/fingerprint and eligible Regions before committing a new city.

### 9.3 Load City

```text
repository.load(cityId)
-> validate save envelope/schema
-> restore World
-> restore Terrain
-> mark lastPlayedAt through explicit save transaction
-> return live CitySession
```

No fallback regeneration occurs for corrupt save data.

### 9.4 Resume City

Resume means the valid save with highest `lastPlayedAt`; deterministic tie break is `cityId` ascending. If no save exists, result is `empty`, not an invented city.

### 9.5 Save City

Save captures World/Terrain snapshots from the live session and writes one complete CitySave record in one repository operation. The save operation is explicit. This tranche does not rely on unload/pagehide autosave.

## 10. Persistence adapter

Browser persistence uses IndexedDB, not localStorage, because canonical Terrain state is large structured data.

### 10.1 Database

One app-owned database with explicit version and one `cities` object store keyed by `cityId`. Required indexes:

```text
lastPlayedAt
updatedAt
```

A repository write is one IndexedDB `readwrite` transaction for the complete CitySave record. Never clear in one transaction and rewrite in another.

### 10.2 Save schema

```text
CitySaveV1
schemaVersion = 1
cityId
name
createdAt
updatedAt
lastPlayedAt
worldSnapshot
terrainSnapshot
```

Data is structured-clone compatible only: no functions, DOM nodes, Three.js instances, Map/Set authority objects, or class instances are stored.

### 10.3 Failure semantics

Persistence errors are typed at the repository boundary and surfaced to UI. Save failure does not destroy the live city. Corrupt/unsupported records are not silently deleted or regenerated.

## 11. UI / DX direction

No React dependency is introduced only to obtain shadcn. The existing vanilla TypeScript app uses a small app-owned design system inspired by shadcn's visual language.

### 11.1 Design tokens

One CSS token owner defines background, foreground, card, muted, border, input, accent, destructive, radius, focus-ring, spacing and shadow values. Components consume tokens rather than raw repeated colors.

### 11.2 UI primitives

Create focused DOM factories only when reused:

```text
button
card
input/field
badge
switch/checkbox row
empty state
```

No generic component framework is built.

### 11.3 Screens

Home:

```text
Resume card when available
New City action
Load City action
```

New City:

```text
City name
Seed64 input
Randomize
Generate
Generated fingerprint / eligibility
Starting Region selection
Create City
```

Load City:

```text
saved city cards
name
seed
updated time
Load
```

Game shell:

```text
city identity/status
3D viewport
Save action
Debug panel trigger
compact Terrain debug switches
```

Responsive layout is mobile-first. Touch targets are at least 44 CSS px. Focus states and semantic controls are mandatory.

## 12. Application lifecycle

`apps/game` bootstrap becomes asynchronous because IndexedDB initialization and initial save lookup are asynchronous.

```text
bootstrap
-> create repository
-> create city-session orchestrator
-> list/latest saves
-> mount Home
```

Entering a live city creates scene + Terrain projection + debug overlay + production camera/input/picking. Leaving the game disposes all presentation/input resources before mounting another screen. World/Terrain semantic objects may then be released normally.

## 13. Error handling

Expected errors are discriminated results at system/orchestration boundaries. Programming invariants throw loudly.

Examples:

```text
invalid Seed64                -> inline New City validation
no eligible starting Region  -> generated preview rejection
unsupported save schema      -> Load error; no fallback
invalid World snapshot       -> Load error
invalid Terrain snapshot     -> Load error
IndexedDB unavailable/write  -> UI error; live session retained
WebGL unavailable            -> semantic session may exist; game presentation unavailable
```

## 14. Testing strategy

### Unit / package

```text
Seed64 parsing + golden vectors
arbitrary-seed determinism
World restore validation
Terrain snapshot/restore round trip
all debug layer geometry/locality/disposal
camera reducer and bounds
gesture state machine: mouse/touch/cancel
pointer -> NDC math
semantic pick ignores raw Y
city-session New/Load/Resume/Save policy
save codec/schema validation
```

### Browser

Desktop Chromium:

```text
Home -> New City -> explicit seed -> generate -> choose Region -> create
camera pan/rotate/zoom
click pick
Debug grid + representative layers
Save -> Home -> Load -> same city
Resume latest city
```

Mobile emulation:

```text
one-finger pan
single tap pick
two-pointer pinch zoom
rotation gesture
no accidental pick after drag/pinch
44px UI targets / responsive screens
```

IndexedDB E2E uses the real browser database and clears the test database explicitly between scenarios.

## 15. Delivery decomposition

This design is implemented through separate plans:

1. Seed + World/Terrain snapshot/restore.
2. Terrain debug visualization.
3. Production camera/input/picking.
4. City-session orchestration + IndexedDB + UI/application flow.
5. Integrated browser/release gate.

Each plan is independently reviewable and must keep architecture at zero violations.

## 16. Binding invariants

```text
Terrain generation accepts any canonical valid Seed64 and never mines/retries a different seed.
The canonical seed/fingerprint pair remains a golden generator regression vector.
World no longer owns a Terrain seed whitelist.
Save/restore stores canonical World/Terrain only.
Restore never regenerates an existing city's Terrain.
Debug presentation is disposable derived state and off by default.
Production camera state is app presentation data, not gameplay authority.
Pointer Events are the unified PC/mobile input path.
Gesture arbitration happens before picking.
Raycaster Y is never semantic Terrain height.
New/Load/Resume/Save cross-system sequencing belongs to city-session orchestration.
Orchestration never imports system ./composition; app adapters supply lifecycle ports.
IndexedDB writes complete CitySave records transactionally and never rely on unload autosave.
UI uses app-owned tokens/primitives without introducing React/shadcn runtime dependency.
```
