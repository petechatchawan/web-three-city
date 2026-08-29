# P1-F Three.js Presentation Architecture Design

- **Status:** APPROVED — OWNER APPROVED 2026-08-30
- **Date:** 2026-08-30
- **Scope:** P1-F Three.js Render Sectors + Semantic Picking
- **Owner:** `systems/terrain`
- **Depends on:** P1-A through P1-E merged authority, `TERRAIN-SYSTEM-DESIGN.md`, `TERRAIN-PRESENTATION-CONTRACT.md`, `TERRAIN-SURFACE-CONTRACT.md`, `TERRAIN-MUTATION-CONTRACT.md`

## 1. Purpose

P1-F introduces the first concrete Three.js projection of canonical Terrain. The design must make rendering maintainable and performant without allowing rendering state to become gameplay authority.

The binding direction is one-way:

```text
World / Terrain canonical authority
              ↓
      semantic read contracts
              ↓
    Terrain Three.js Presentation
              ↓
      BufferGeometry / Mesh / GPU
```

There is no reverse mutation path from Three.js objects, raycast output, normals, render sectors, or GPU buffers into Terrain authority.

The primary architectural decision in this design is to decompose Terrain presentation into small subsystems with one responsibility each rather than putting topology, geometry creation, resource ownership, dirty rebuild, and picking into one large `terrain-projection.ts` module.

## 2. Goals

P1-F must provide:

1. deterministic 8×8 render-sector topology over the 512×512 Cell production map;
2. exact mesh triangulation matching the frozen Terrain Surface Contract;
3. seam-safe presentation normals derived from the global semantic neighborhood;
4. localized deterministic sector invalidation from `TerrainChangeSet`;
5. explicit ownership and disposal of Three.js resources;
6. a thin projection lifecycle that owns 64 sector meshes under one root `THREE.Group`;
7. Raycaster-based candidate detection followed by authoritative World + Terrain semantic re-query;
8. browser-independent tests for geometry/topology/invalidation and targeted browser tests only where real WebGL/Raycaster behavior is required;
9. architecture that can later adopt profiling-driven optimizations without changing World or Terrain authority.

## 3. Non-goals

P1-F explicitly does not introduce:

```text
LOD
terrain streaming
async rebuild scheduler
Web Worker geometry pipeline
BVH/raycast acceleration policy
WebGPU abstraction
render graph
GPU heightmap authority
sector cache eviction
sub-buffer mutation
Terraform gameplay policy
persistence of render state
runtime event bus
```

These are deferred optimization/product concerns. P1-F is a deterministic synchronous derived projection.

### 3.1 Owner execution constraints

The owner additionally requires the implementation to optimize for maintainability, developer experience, and functional-programming style:

```text
functional core / imperative shell
no scattered magic numbers
no class hierarchy for application-owned presentation code
immutable inputs/results where practical
side effects isolated to Three.js resource and projection lifecycle boundaries
small explicit functions over generic framework abstractions
fail-fast invariants instead of silent fallback
```

Frozen numeric values are not forbidden, but each value has exactly one named owner. Presentation code must derive secondary values rather than repeating literals. In particular:

- `RENDER_SECTOR_CELLS = 64` is owned by render-sector topology; vertex counts, sector counts, and index counts are derived from it.
- World dimensions and `cellSizeMeters` come from `MapDefinitionRead`; geometry/picking do not repeat `512` or `8` as local magic numbers.
- vertical conversion uses Terrain-owned `logicalElevationToMeters()` rather than repeating `0.25`.
- Q16 conversion uses Terrain-owned `Q16_ONE`; the browser pick upper bound is derived as `Q16_ONE - 1`.

Three.js itself is class-based, but P1-F-owned code uses factory functions, pure transforms, immutable records, and closure-owned lifecycle state rather than introducing additional application classes.

## 4. External best-practice constraints

This design follows the relevant Three.js resource and geometry model:

- `BufferGeometry` is the canonical Three.js structure for indexed vertex positions, normals, indices, and other parallel attributes.
- GPU-backed Three.js resources are not fully reclaimed merely because JavaScript objects become unreachable; geometries/materials/textures require explicit `dispose()` lifecycle calls when no longer used.
- `BufferGeometry.computeVertexNormals()` averages normals from faces represented inside that geometry. Because Terrain intentionally duplicates boundary vertices between render sectors, sector-local normal generation would omit incident faces from adjacent sectors and can produce visible lighting seams. P1-F therefore computes normals from the global semantic neighborhood instead.
- `Raycaster` provides object intersections and a world-space intersection point. That point is presentation evidence only; gameplay Terrain facts are resolved again through World and Terrain semantic reads.
- Fewer larger meshes generally reduce scene-graph/draw-call overhead compared with one mesh per Cell. The frozen 64-sector partition therefore provides a reasonable Phase-1 balance between draw-call locality and localized rebuilds.

Reference documentation:

- https://threejs.org/docs/pages/BufferGeometry.html
- https://threejs.org/docs/pages/Raycaster.html
- https://threejs.org/manual/en/how-to-dispose-of-objects.html
- https://threejs.org/manual/en/cleanup.html
- https://threejs.org/manual/en/optimize-lots-of-objects.html

## 5. Ownership model

### 5.1 Canonical owners

```text
World
  owns CellCoord / VertexCoord / ChunkCoord and topology semantics

Terrain
  owns LogicalElevation / TerrainRevision / exact surface semantics

Terrain Presentation
  owns RenderSectorCoord / Three.js geometry / normals / materials / meshes

App Presentation
  owns Scene / Camera / Renderer / viewport lifecycle
```

Render-sector topology must never be promoted into World public vocabulary. It is a rendering partition only.

### 5.2 Public-surface rule

Terrain remains:

```text
@web-three-city/terrain
  read/observe only

@web-three-city/terrain/commands
  mutation only

@web-three-city/terrain/composition
  system construction + app-only Three.js projection construction
```

Three.js types may appear only on the deliberate `./composition` presentation surface where necessary. They must never leak into Terrain root or `./commands`.

### 5.3 Dependency direction

Inside `systems/terrain`:

```text
composition
    ↓
presentation/three
    ↓
Terrain contracts + World root contracts

presentation/three
    X application internals
    X Terrain mutable state internals
    X app scene internals

domain
    X Three.js
application
    X Three.js
commands
    X Three.js
```

Presentation reads semantic capabilities; it does not reach into private Terrain storage.

## 6. Internal subsystem layout

The approved P1-F direction is:

```text
systems/terrain/src/presentation/three/
├─ topology/
│  ├─ render-sector.ts
│  └─ dirty-sectors.ts
├─ geometry/
│  ├─ build-sector-geometry.ts
│  └─ presentation-normal.ts
├─ resources/
│  ├─ terrain-material.ts
│  └─ sector-resource.ts
├─ projection/
│  ├─ sector-registry.ts
│  └─ terrain-projection.ts
└─ picking/
   └─ semantic-pick.ts
```

This is an internal responsibility boundary, not five new packages or five canonical systems. All modules remain owned by `systems/terrain`.

## 7. Topology subsystem

### 7.1 Responsibility

`topology/render-sector.ts` owns only presentation partition math:

```text
Cell ↔ RenderSector
RenderSector ↔ Cell bounds
RenderSector key/order
```

It does not build Three.js objects and does not read Terrain elevation.

### 7.2 Frozen topology

```text
RENDER_SECTOR_CELLS = 64
SECTOR_AXIS_COUNT    = 8
TOTAL_SECTORS        = 64
```

Private value:

```ts
interface RenderSectorCoord {
  readonly x: number;
  readonly z: number;
}
```

A sector `(sx,sz)` covers:

```text
cellX = sx*64 .. sx*64+63
cellZ = sz*64 .. sz*64+63
```

Canonical sector ordering is `(z,x)` ascending.

### 7.3 Why RenderSector remains private

Logical Chunk is canonical storage/update topology. Render Sector is a derived presentation optimization. Keeping them distinct prevents future changes in render granularity from becoming save/schema/gameplay migrations.

## 8. Dirty-sector subsystem

### 8.1 Responsibility

`topology/dirty-sectors.ts` converts a successful `TerrainChangeSet` into the exact set of render sectors that require geometry/normal refresh.

```text
TerrainChangeSet.affectedCells
          ↓
expand each Cell by one valid Moore neighborhood
          ↓
map valid Cells to RenderSector
          ↓
de-duplicate
          ↓
sort (z,x)
          ↓
DirtyRenderSectors
```

### 8.2 Normal dependency expansion

For every affected Cell, include valid Cells at:

```text
dx ∈ {-1,0,1}
dz ∈ {-1,0,1}
```

This exists because the normal of a changed canonical vertex can affect duplicated presentation vertices in a neighboring sector even when that neighboring sector contains no directly changed elevation.

### 8.3 Locality invariant

A normal local mutation must not default to rebuilding all 64 sectors. A mutation away from a render-sector edge should normally dirty one sector. Seam/corner edits may dirty adjacent sectors as dictated by the one-Cell normal neighborhood.

## 9. Geometry subsystem

### 9.0 Functional read boundary

`geometry/read-sector-surface.ts` performs the only Terrain elevation read pass required to build one render sector. It captures the sector's 65×65 visible vertices plus the clipped one-vertex halo needed by global normal computation. The resulting snapshot hides its internal typed storage behind immutable read functions and records one Terrain revision.

```text
TerrainAuthorityRead
        ↓ one bounded read pass
SectorSurfaceSnapshot
        ↓
  pure geometry + normal transforms
```

This prevents geometry and normal code from independently re-querying the same canonical vertices thousands of times and gives both calculations one coherent read snapshot. For a full interior sector, the maximum elevation-read footprint is 67×67 vertices rather than repeated per-face/per-vertex Terrain queries.

If the Terrain revision changes during snapshot capture, construction fails loudly as an invariant violation; a mixed-revision presentation snapshot is never published.

### 9.1 Responsibility

`geometry/build-sector-geometry.ts` separates deterministic data generation from Three.js object creation:

```text
RenderSectorCoord + SectorSurfaceSnapshot + RenderSectorLayout
                    ↓
          SectorGeometryData
                    ↓ thin Three.js adapter
             THREE.BufferGeometry
```

`SectorGeometryData` contains typed position/normal/index arrays and is generated without a Scene, Mesh, Material, Renderer, DOM access, or mutable registry. The final `BufferGeometry` allocation is a narrow library boundary.

It owns no scene nodes, registry, renderer, material lifecycle, camera, DOM, or mutation orchestration.

### 9.2 Sector geometry shape

Each sector contains:

```text
64 × 64 Cells
65 × 65 presentation vertices = 4,225
4,096 Cells
8,192 triangles
24,576 triangle indices
```

Presentation vertices on sector boundaries are intentionally duplicated. Canonical elevation is not.

### 9.3 Position projection

For canonical World Vertex `(x,z)` with LogicalElevation `h`:

```text
position.x = x * 8
position.y = h * 0.25
position.z = z * 8
```

The builder should write directly to typed arrays and create BufferAttributes without allocating a `THREE.Vector3` per vertex.

Recommended Phase-1 buffers:

```text
position: Float32Array(4225 * 3)
normal:   Float32Array(4225 * 3)
index:    Uint16Array(24576)
```

`Uint16Array` is sufficient because the largest local vertex index is 4,224.

### 9.4 Fixed triangle topology

Every Cell must emit exactly:

```text
SW, SE, NW
NW, SE, NE
```

For first Cell of Sector `(0,0)`:

```text
[0, 1, 65, 65, 1, 66]
```

No height-dependent diagonal selection is allowed.

### 9.5 Bounds

After attributes/indices are complete, geometry should have deterministic bounding volumes suitable for frustum culling/raycast behavior. Phase 1 may call Three.js bounding-box/bounding-sphere computation once per built geometry.

## 10. Presentation-normal subsystem

### 10.1 Responsibility

`geometry/presentation-normal.ts` derives a visual normal for a canonical World Vertex using every valid semantic triangle incident to that vertex, including triangles across render-sector boundaries.

It is deliberately separate from sector geometry construction because its dependency radius is larger than a sector-local vertex copy.

### 10.2 Global-normal rule

```text
World Vertex
    ↓
World incident Cells
    ↓
fixed semantic triangles that contain this vertex
    ↓
unnormalized face normals
    ↓
sum
    ↓
normalize once
```

The same World Vertex requested by two adjacent sectors must produce numerically equivalent normal components.

### 10.3 Prohibited shortcut

Do not use sector-local `geometry.computeVertexNormals()` as the Terrain normal authority. Three.js correctly averages faces represented in a geometry, but a sector boundary geometry does not contain all semantic incident faces from its neighboring sector.

### 10.4 Performance rule

Normal calculation may use floating-point math because it is presentation only. Implementation should avoid unnecessary temporary-object allocation in the inner 4,225-vertex loop; numeric accumulators are preferred over repeated `Vector3` creation unless profiling proves the difference irrelevant.

## 11. Resource subsystem

### 11.1 Shared material ownership

`resources/terrain-material.ts` creates exactly one Phase-1 Terrain material per `TerrainThreeProjection`.

All 64 sector meshes share that material.

A localized sector rebuild therefore replaces/disposes geometry without recreating the shared material.

The material is disposed exactly once when the projection itself is disposed.

### 11.2 Sector resource ownership

`resources/sector-resource.ts` owns the concrete relation:

```text
RenderSectorCoord
+ BufferGeometry
+ shared Terrain Material
        ↓
      THREE.Mesh
```

A sector resource owns its geometry and scene node, but does not own the shared material.

### 11.3 Disposal invariants

On sector replacement:

```text
create replacement geometry/resource successfully
→ detach old sector mesh
→ dispose old geometry
→ install replacement mesh
```

On projection disposal:

```text
for all registered sectors
  detach mesh
  dispose geometry exactly once
clear registry
remove root from parent if attached
dispose shared material exactly once
mark projection disposed
```

`dispose()` is idempotent.

No call path may dispose the shared material while live sector meshes still depend on it.

## 12. Sector registry subsystem

### 12.1 Responsibility

`projection/sector-registry.ts` owns only the mapping:

```text
RenderSectorCoord → SectorResource / THREE.Mesh
```

It provides deterministic iteration and replacement bookkeeping. It does not calculate dirty sectors, build geometry, inspect Terrain mutations, or own the shared material.

### 12.2 Registry invariants

```text
exactly one live resource per registered RenderSectorCoord
at full attach: exactly 64 sectors
canonical iteration order: (z,x)
replacement affects only the requested key
clear leaves zero retained sector resources
```

This isolates mutable presentation bookkeeping from geometry math.

## 13. Terrain projection subsystem

### 13.1 Responsibility

`projection/terrain-projection.ts` is a thin lifecycle orchestrator, not a geometry implementation.

It coordinates:

```text
root Group
shared material
sector registry
geometry builder
dirty-sector resolver
semantic picking delegate
resource disposal
```

It must not duplicate formulas owned by those modules.

### 13.2 Initial attach

Production Phase 1 requires full Terrain authority before projection construction.

Initial construction:

```text
verify Terrain completeness = full
→ create root THREE.Group
→ create shared Terrain material
→ build sectors (z=0..7, x=0..7)
→ register 64 resources
→ return projection
```

The projection does not call Terrain generation or mutate Terrain.

### 13.3 Rebuild lifecycle

`rebuild(changeSet)` is synchronous in P1-F and uses a staged functional-core/imperative-shell transaction:

```text
TerrainChangeSet
→ validate revision continuity
→ computeDirtyRenderSectors
→ build all replacement sector resources into a temporary staged array
→ if any build fails: dispose staged replacements; keep all currently attached resources unchanged
→ if all builds succeed: replace requested registry entries in canonical order
→ detach/dispose superseded geometries
→ advance projectedRevision to changeSet.newRevision
```

The projection records `projectedRevision` at initial attach, and every initial sector snapshot must match that same revision before the projection is published. After all 64 resources are built, `terrain.revision()` must still equal `projectedRevision`.

The same rule applies during rebuild staging: every staged sector snapshot must equal `changeSet.newRevision`, and Terrain revision is rechecked once more before live swap. A rebuild is accepted only when `changeSet.previousRevision === projectedRevision` and `changeSet.newRevision === terrain.revision()`. Skipped, stale, or out-of-order change sets fail loudly instead of silently leaving an under-invalidated visual projection.

No async queue, debounce policy, worker, retry loop, or whole-map fallback is introduced.

A `changed=false` receipt/change set with no dirty sectors is a no-op.

### 13.4 Failure behavior

Canonical Terrain commits remain valid if presentation rebuilding fails. Presentation failure does not roll back Terrain revision or elevation.

Where replacement construction can fail before old resource removal, the old sector should remain attached rather than deliberately destroying the last valid visual projection. Programming invariant failures may throw/fail loudly; they must not fabricate semantic Terrain results.

## 14. Composition-facing projection contract

Terrain `./composition` may expose a presentation-specific contract such as:

```ts
export interface TerrainThreeProjection {
  readonly root: THREE.Group;
  rebuild(changeSet: TerrainChangeSet): void;
  pick(raycaster: THREE.Raycaster): TerrainSemanticPickResult;
  dispose(): void;
}
```

`pick()` is a narrow convenience entrypoint that delegates to the separate picking subsystem; this keeps app composition from knowing registry internals.

If implementation evidence shows that exposing `pick()` directly is unnecessary for the Phase-1 app, it may remain an app/test-facing composition helper instead. The invariant is that semantic picking implementation stays separate from projection lifecycle internals.

## 15. Picking subsystem

### 15.1 Responsibility

`picking/semantic-pick.ts` transforms a Three.js raycast candidate into semantic World/Terrain facts.

```text
Raycaster
  ↓ intersects Terrain projection root/sector meshes
closest Terrain candidate
  ↓ use candidate point X/Z only
World.worldPositionToCell
  ↓
World.cellBounds
  ↓
cell-local Q16 conversion
  ↓
Terrain.sampleSurface
  ↓
Semantic Terrain result
```

### 15.2 Q16 conversion

After World resolves the containing Cell:

```text
uQ16 = clamp(round(localX / 8 * 65536), 0, 65535)
vQ16 = clamp(round(localZ / 8 * 65536), 0, 65535)
```

World half-open Cell mapping resolves exact east/north boundaries to the adjacent Cell before this conversion. Out-of-bounds X/Z is rejected; it is never clamped into the map.

### 15.3 Raycast-Y prohibition

`intersection.point.y`, face normals, interpolated UVs, or mesh vertices are not returned as Terrain authority.

Authoritative height/triangle/slope facts come from `TerrainAuthorityRead.sampleSurface()` at the resolved semantic coordinate.

### 15.4 Semantic result

A presentation-facing result may carry:

```ts
interface TerrainSemanticPick {
  readonly cell: CellCoord;
  readonly triangle: TerrainTriangle;
  readonly heightQ16: number;
  readonly riseX: number;
  readonly riseZ: number;
  readonly revision: TerrainRevision;
}
```

No `THREE.Mesh`, `Face`, `Vector3`, geometry index, or sector ID is required by gameplay consumers.

## 16. App scene boundary

Current `apps/game/src/presentation/create-scene.ts` owns Scene, PerspectiveCamera, WebGLRenderer, resize observation, and renderer disposal. P1-F should change only what is required for Terrain integration.

Recommended app-private capability:

```ts
interface ScenePresentation {
  readonly available: boolean;
  readonly scene?: THREE.Scene;
  readonly camera?: THREE.PerspectiveCamera;
  render(): void;
  dispose(): void;
}
```

The app composition root performs:

```text
create scene
create Terrain projection
scene.add(projection.root)
render
```

Terrain projection does not receive `WebGLRenderer`, DOM elements, `ResizeObserver`, or viewport ownership.

Camera far plane/position may be adjusted to show the 4096m map, but camera policy remains app presentation responsibility.

If WebGLRenderer creation fails, semantic World/Terrain construction remains valid. Presentation unavailability does not replace or mutate authority.

### 16.1 P1-F browser harness boundary

P1-F needs real WebGL/Raycaster evidence before P1-G wires World/Terrain into the production `createGame()` path. To avoid moving P1-G production composition earlier, P1-F uses a dedicated Vite test page:

```text
apps/game/terrain-phase-1.html
  → apps/game/tests/terrain-phase-1-harness.ts
```

The harness may depend on World/Terrain composition surfaces as test/dev dependencies, construct real prepared World/Terrain authority, attach the real Terrain projection to the real app ScenePresentation, and expose only deterministic DOM diagnostics/test controls. `apps/game/src/bootstrap/main.ts` and production `createGame()` remain free of World/Terrain composition until P1-G.

P1-G later promotes World/Terrain from app test/dev dependencies to production dependencies when the actual new-city vertical slice is wired.

## 17. Mutation-to-render synchronization

P1-F does not create an event bus. Direct caller synchronization remains explicit:

```text
const result = terrain.commands.applyEdits(command)

if success && changed
  terrainProjection.rebuild(result.value.changeSet)
  scene.render()
```

This makes causal ordering explicit:

```text
canonical commit first
→ derived presentation synchronization second
```

A presentation failure cannot transform the successful command into a rejected Terrain mutation.

## 18. Testing architecture

### 18.1 Topology tests — Vitest

Prove:

```text
8×8 sector coverage
64×64 Cells per sector
no Cell gaps/overlaps
canonical sector order
Cell→sector mapping at 63/64 seams and outer boundaries
```

### 18.2 Geometry tests — Vitest, no WebGLRenderer

Use real `THREE.BufferGeometry` in Node and prove:

```text
4225 positions
24576 indices
first fixed-diagonal indices = [0,1,65,65,1,66]
position projection uses 8m / 0.25m exactly
adjacent-sector duplicate seam positions are numerically equal
bounding volumes exist when required
```

### 18.3 Normal tests — Vitest

Use a non-flat field and prove:

```text
same seam World Vertex normal from both sectors is equivalent
corner/edge/interior incident-triangle handling is correct
normal length approximately 1 after normalization
sector-local-only normal implementation would fail the seam vector
```

### 18.4 Dirty-sector tests — Vitest

Prove:

```text
interior mutation → local sector only
sector-edge mutation → required adjacent sectors
sector-corner mutation → required 2×2 neighborhood when applicable
map-edge expansion clips invalid Cells
output de-duplicated and sorted (z,x)
never defaults to all 64 sectors
```

### 18.5 Resource tests — Vitest

Use actual Three.js dispose events or equivalent observable bookkeeping to prove:

```text
sector replacement disposes old geometry exactly once
unaffected sector resources retain object identity
shared material is not disposed during localized rebuild
projection dispose disposes all sector geometries and shared material once
second dispose is a no-op
registry becomes empty
```

### 18.6 Browser tests — Playwright Chromium

Only browser-dependent behavior is proven here:

```text
real WebGL Terrain becomes visible
projection attaches exactly 64 sector meshes
real THREE.Raycaster hits Terrain
semantic pick result equals Terrain query result, not raw hit Y
localized rebuild causes no pageerror
projection/app disposal causes no uncaught browser errors
```

Browser tests are not the sole proof of triangle topology or normal correctness.

## 19. Performance characteristics

Initial Phase-1 projection is intentionally predictable:

```text
64 Meshes
64 BufferGeometry instances
1 shared Terrain material
270,400 presentation vertex copies maximum before considering index sharing
1,572,864 triangle indices across all sectors
```

The 64-sector choice avoids one Mesh per Cell and still preserves localized rebuild boundaries. This aligns with Three.js guidance that reducing very large numbers of independent scene objects/draw calls is generally beneficial, without collapsing the full map into one geometry that would force global rebuilds.

No additional optimization mechanism is approved without profiling evidence.

## 20. Maintainability rules

1. One module owns one formula/responsibility; projection orchestration must not reimplement topology or geometry math.
2. `RenderSectorCoord` stays private to presentation.
3. Geometry builder never constructs a renderer or accesses DOM.
4. Material creation never occurs inside the per-sector vertex loop.
5. Sector registry never calculates dirty sets.
6. Dirty resolver never imports Three.js.
7. Normal resolver never uses Mesh/GPU state as semantic input.
8. Picking never trusts raycast Y for Terrain truth.
9. Resource disposal ownership is explicit and testable.
10. Presentation errors never mutate/rollback Terrain authority.
11. No speculative abstraction for LOD/workers/streaming enters P1-F.
12. New Three.js dependencies remain confined to Terrain presentation/composition and app presentation.
13. P1-F-owned modules prefer pure functions/factories over classes; mutation is restricted to registry/resource/projection closure state.
14. Map width/height/cell size, elevation scale, Q16 scale, sector counts, vertex counts, and index counts are consumed from canonical owners or derived from named constants; literals are not repeated through implementation files.
15. Geometry and normal math consume a coherent `SectorSurfaceSnapshot`; they do not independently query canonical Terrain for every face.
16. Projection rebuild validates revision continuity and stages all replacements before mutating the live scene/registry.

## 21. Proposed file map for P1-F

```text
systems/terrain/
├─ src/
│  ├─ contracts/terrain-three.ts
│  ├─ presentation/three/
│  │  ├─ topology/
│  │  │  ├─ render-sector.ts
│  │  │  └─ dirty-sectors.ts
│  │  ├─ geometry/
│  │  │  ├─ read-sector-surface.ts
│  │  │  ├─ build-sector-geometry.ts
│  │  │  └─ presentation-normal.ts
│  │  ├─ resources/
│  │  │  ├─ terrain-material.ts
│  │  │  └─ sector-resource.ts
│  │  ├─ projection/
│  │  │  ├─ sector-registry.ts
│  │  │  └─ terrain-projection.ts
│  │  └─ picking/
│  │     └─ semantic-pick.ts
│  ├─ composition/
│  │  └─ create-terrain.ts
│  └─ composition.ts
├─ tests/
│  ├─ render-sector.test.ts
│  ├─ dirty-sectors.test.ts
│  ├─ sector-surface.test.ts
│  ├─ presentation-normal.test.ts
│  ├─ semantic-pick.test.ts
│  └─ terrain-projection.test.ts

apps/game/
├─ terrain-phase-1.html                 # test-only Vite entry; not production bootstrap
├─ src/
│  └─ presentation/create-scene.ts
└─ tests/
   └─ terrain-phase-1-harness.ts

tests/browser/
└─ terrain-phase-1.spec.ts
```

If implementation reveals two listed files are trivially inseparable, they may be combined only when responsibility remains clear and tests do not lose an independent boundary. Do not create additional folders/interfaces solely to mirror this diagram.

## 22. P1-F delivery decomposition

The existing frozen umbrella plan remains authoritative, but implementation should refine Tasks 12–13 into these reviewable internal stages:

### P1-F.1 — Topology + Dirty Invalidation

```text
render-sector topology
dirty-sector mapping
no Three.js dependency required for dirty resolver
```

### P1-F.2 — Geometry + Global Presentation Normals

```text
Three.js BufferGeometry dependency
positions
fixed indices
global seam-safe normals
bounds
```

### P1-F.3 — Resource + Projection Lifecycle

```text
shared Terrain material
sector resources
sector registry
64-sector initial projection
localized replacement
idempotent disposal
```

### P1-F.4 — Semantic Picking + App Scene Integration

```text
Raycaster candidate
World Cell resolution
Q16 conversion
Terrain semantic query
app scene attach/render/camera adjustment
browser verification
```

These are implementation stages inside one P1-F delivery/PR unless execution evidence justifies a smaller PR split. They do not create new product milestones or canonical systems.

## 23. Acceptance criteria

P1-F is complete only when all of the following hold:

```text
64 render sectors built from full Terrain
4225 vertices and 8192 triangles per full sector
fixed NW→SE semantic topology reproduced exactly
shared boundary positions equal
shared boundary normals equivalent from either sector
localized TerrainChangeSet rebuild does not default to 64 sectors
unaffected sector resource identity survives localized rebuild
replaced geometry is disposed
shared material survives rebuild and is disposed once at projection teardown
projection dispose is idempotent
Raycaster hit is re-evaluated through World + Terrain
raycast Y is not semantic authority
Terrain root and commands surfaces contain no Three.js types
Terrain domain/application contain no Three.js imports
app owns Scene/Camera/Renderer; Terrain owns projection contents
browser WebGL/Raycaster path passes without page errors
architecture checker remains at zero violations
```

## 24. Binding architecture summary

```text
                         apps/game
                            │
                 ┌──────────┴───────────┐
                 │                      │
          Scene Presentation     Game Composition
     Scene/Camera/Renderer              │
                 │                      │
                 │ add(root)            │ create
                 ▼                      ▼
        ┌────────────────────────────────────┐
        │        TerrainThreeProjection      │
        │                                    │
        │  Projection Orchestrator           │
        │      │        │        │           │
        │      ▼        ▼        ▼           │
        │  Registry   Dirty     Picking      │
        │      │      Resolver     │          │
        │      ▼                   │          │
        │  Sector Resource         │          │
        │      │                   │          │
        │      ▼                   │          │
        │ Geometry Builder ◄──── TerrainRead │
        │      │                   ▲          │
        │      ▼                   │          │
        │ Global Normal Resolver ──┘          │
        │                                    │
        └────────────────────────────────────┘
                 ▲                 ▲
                 │                 │
          Terrain read        World spatial read
                 ▲                 ▲
                 │                 │
          Terrain authority    World authority
```

The design intentionally makes the full Three.js layer disposable. If every Mesh/BufferGeometry/material under the projection is destroyed and recreated from the same Terrain/World reads, the semantic game state is unchanged. That is the defining authority test for P1-F.
