# Terrain Presentation Contract

- **Status:** FROZEN — OWNER APPROVED 2026-08-29
- **Date:** 2026-08-29
- **Owner:** `systems/terrain`
- **Depends on:** Terrain System Design, Terrain Surface Contract, Terrain Mutation Contract, World Spatial Contract, A7, A9

## 1. Purpose

Terrain presentation projects canonical Terrain into Three.js while preserving the strict direction:

```text
Terrain authority
   ↓
exact surface semantics
   ↓
Three.js projection
```

There is no reverse authority from Mesh/GPU state to Terrain.

## 2. Ownership/location

System-specific Three.js code belongs inside:

```text
systems/terrain/src/presentation/three/
```

when implementation is approved.

The app composition root constructs/attaches/disposes the projection through Terrain `./composition` as required by A6/A7.

No separate `terrain-three` package is justified in Phase 1.

## 3. Render sector topology

Presentation partition is exactly:

```text
RENDER_SECTOR_CELLS = 64
SECTOR_COUNT_X       = 8
SECTOR_COUNT_Z       = 8
TOTAL_SECTORS        = 64
```

Sector coordinate is presentation-owned and must not be promoted into World public spatial vocabulary.

A Sector `(sx,sz)` covers Cells:

```text
x = sx*64 .. sx*64+63
z = sz*64 .. sz*64+63
```

One Sector covers `2 × 2` World logical Chunks.

## 4. Logical Chunk versus Render Sector

```text
Logical Chunk
= canonical storage/update partition owned by World/Terrain

Render Sector
= derived rendering partition owned by Terrain presentation
```

Render-sector boundaries never change canonical Vertex ownership.

GPU buffers may duplicate shared boundary vertices because those copies are derived.

## 5. Sector mesh topology

Each full production Sector contains:

```text
64 × 64 Cells
65 × 65 presentation vertices
4096 Cells
8192 triangles
```

Vertex positions are derived from World coordinates and Terrain canonical elevations.

Triangle indices for every Cell reproduce the exact Terrain Surface Contract:

```text
SW / SE / NW
NW / SE / NE
```

No presentation optimization may flip diagonals.

## 6. Position projection

For World Vertex `(x,z)` with LogicalElevation `h`:

```text
position.x = x * 8
position.z = z * 8
position.y = h * 0.25
```

One Three.js world unit equals one meter.

The BufferGeometry coordinate values are derived floats and must never be read back to reconstruct `LogicalElevation`.

## 7. Presentation normals

Normals are visual derived data, not gameplay slope authority.

For each canonical World Vertex used by a Sector, the presentation normal is derived from the unnormalized face normals of all valid semantic triangles incident to that World Vertex, including triangles located across Sector boundaries.

Consequences:

```text
same World Vertex
-> same incident canonical surface neighborhood
-> equivalent presentation normal
```

Sector-local truncation of the normal neighborhood is forbidden because it would create false visual seams.

Normal computation may use floating-point vector math because normals are presentation-only.

## 8. Initial build

Production Phase 1 presentation attaches only after a full 256-Chunk TerrainState exists.

Initial presentation constructs 64 Sectors from public/internal Terrain read authority. It never generates Terrain itself.

A presentation build failure does not mutate Terrain or MapState.

## 9. Localized mutation rebuild

`TerrainChangeSet` is the canonical invalidation input.

For each mutation:

```text
changedVertices
  ↓
affectedCells (already World-derived)
  ↓
expand by one Cell Moore neighborhood for smooth-normal dependencies
  ↓
map valid dirty Cells to 64×64 Render Sectors
  ↓
de-duplicate Sector set
  ↓
rebuild only those Sectors
```

The one-Cell expansion includes all valid Cells with `dx,dz ∈ {-1,0,1}` around each affected Cell.

Sector rebuild order is canonical `(sz,sx)` ascending but render order has no gameplay meaning.

A normal-only dependency is allowed to rebuild a whole Sector; Phase 1 does not require sub-buffer patching.

## 10. Full rebuild policy

Full 64-Sector rebuild is allowed only for:

```text
initial attach
explicit full Terrain replacement/reload in a future lifecycle
presentation recovery/diagnostics
```

A normal localized Terrain mutation must not rebuild all 64 Sectors by default.

## 11. Material responsibility

Terrain presentation owns Terrain-specific visual material selection/configuration. Material appearance does not affect gameplay Terrain classification in Phase 1.

Grass/soil/rock coloring, lighting parameters, and future texture detail remain derived presentation choices unless a later system spec introduces canonical terrain-material gameplay semantics.

## 12. Raycast role

Three.js Raycaster may identify a candidate intersection with Terrain Sector meshes.

Raycast returns a presentation candidate only:

```text
candidate X/Z
candidate object/sector
presentation Y
```

The authoritative semantic result is re-evaluated through World + Terrain queries.

## 13. Semantic picking pipeline

```text
pointer
  ↓
Three.js Raycaster
  ↓
candidate world X/Z
  ↓
World worldPositionToCell
  ↓
cell-local Q16 coordinate conversion
  ↓
Terrain surface query
  ↓
Cell / triangle / exact height / slope facts
```

Raycast Y is ignored as semantic height authority.

## 14. Cell-local Q16 conversion for picks

After World resolves a containing Cell, compute local X/Z meters from its south-west corner.

For browser/presentation float input:

```text
u = clamp(round(localXMeters / 8 * 65536), 0, 65535)
v = clamp(round(localZMeters / 8 * 65536), 0, 65535)
```

The upper clamp remains `65535` because a point whose semantic coordinate is exactly on the east/north Cell edge belongs to the adjacent Cell under World half-open mapping. Public direct Terrain Q16 queries may still accept `65536` when a caller explicitly addresses a Cell boundary.

## 15. Out-of-bounds picking

If raycast X/Z cannot resolve a valid World Cell, semantic Terrain pick result is out-of-bounds/no-terrain-cell.

Presentation does not clamp the pick into the nearest map Cell.

## 16. Resource lifecycle

Terrain Three.js projection owns disposal of all resources it creates, including as applicable:

```text
BufferGeometry
Material instances
textures created by Terrain presentation
raycast acceleration structures
Sector scene nodes
```

`dispose()` is idempotent at the public composition lifecycle boundary.

Rebuilt Sector resources are disposed/replaced without leaking old GPU resources.

## 17. Scene ownership

Terrain projection may create a root `THREE.Group` or equivalent object for app attachment. The app owns where that root is attached in the product scene; Terrain owns the contents/resources under its projection root.

The app must not mutate Mesh vertices as a gameplay edit path.

## 18. Browser-independent tests

Pure projection builders should prove without browser startup:

```text
Sector-to-Cell coverage
65×65 position projection
8192 fixed-diagonal triangles
sector seam positions equal
normal neighborhood includes cross-sector incident triangles
ChangeSet dirty-sector mapping
one-Cell normal invalidation expansion
resource replacement bookkeeping where technology-independent
```

## 19. Targeted browser tests

Browser tests are justified for:

```text
actual WebGL Terrain visibility
real Raycaster hit -> semantic Terrain query flow
localized Sector refresh observable without page error
resize/camera integration where required
resource disposal with no uncaught browser errors
```

Browser tests must not become the sole proof of Terrain geometry semantics.

## 20. Forbidden patterns

```text
Mesh vertex Y read back as Terrain authority
render Sector used as save/storage partition
height-dependent triangle flip
sector-local seam normals
full-world rebuild for every edit
app directly editing Terrain BufferGeometry as gameplay mutation
raycast result used without semantic Terrain query when gameplay facts matter
```

## 21. Binding invariants

```text
64 Render Sectors are presentation-only.
Every sector reproduces the fixed Terrain triangulation.
Boundary GPU vertices may duplicate but canonical elevation never does.
Smooth normals use the global incident-triangle neighborhood.
Localized mutation rebuilds only dirty sectors plus required normal neighborhood.
Raycast proposes a point; Terrain query determines semantic truth.
Three.js resource lifecycle is explicit and disposable.
Presentation failure never mutates or rolls back Terrain authority.
```
