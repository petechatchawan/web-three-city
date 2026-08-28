# World Spatial Contract

- **Status:** REVIEW DRAFT — NOT FROZEN
- **Date:** 2026-08-29
- **Owner:** `systems/world`
- **Depends on:** World System Design, Phase 1 World/Map/Terrain Design

## 1. Production spatial constants

```text
WORLD_WIDTH_CELLS        = 512
WORLD_HEIGHT_CELLS       = 512
CELL_SIZE_METERS         = 8
LOGICAL_CHUNK_SIZE_CELLS = 32
CHUNK_COUNT_X            = 16
CHUNK_COUNT_Z            = 16
VERTEX_COUNT_X           = 513
VERTEX_COUNT_Z           = 513
```

Horizontal axes:

```text
+X = East
+Z = North
```

Vertical presentation axis:

```text
+Y = Up
```

The south-west corner of Cell `(0,0)` is world `(0m, 0m)` in X/Z.

## 2. Coordinate validity

### CellCoord

```text
0 <= x < 512
0 <= z < 512
```

### VertexCoord

```text
0 <= x <= 512
0 <= z <= 512
```

### ChunkCoord

```text
0 <= x < 16
0 <= z < 16
```

Invalid coordinates are explicit invalid/out-of-bounds outcomes. Public topology operations do not silently clamp invalid caller coordinates.

## 3. World position mapping

Cell `(x,z)` owns the half-open horizontal interval:

```text
X = [x*8, (x+1)*8)
Z = [z*8, (z+1)*8)
```

For an in-bounds world horizontal position:

```text
cellX = floor(worldX / 8)
cellZ = floor(worldZ / 8)
```

Exact outer north/east boundaries `worldX = 4096` or `worldZ = 4096` are outside any Cell. They may correspond to outer Terrain vertices but not a gameplay Cell.

Negative positions and positions beyond 4096m are out of bounds.

## 4. Cell to logical Chunk

Normative formula:

```text
chunkX = floor(cellX / 32)
chunkZ = floor(cellZ / 32)
```

Local Cell coordinate:

```text
localX = cellX mod 32
localZ = cellZ mod 32
```

For valid Cells this produces Chunk coordinates `[0,15]` and local coordinates `[0,31]`.

## 5. Normative shared Vertex owner rule

The south-west seam rule is normative, not illustrative.

For one valid Vertex axis coordinate `v`, chunk size `S = 32`, and chunk count `N = 16`:

```text
ownerAxis(v) =
  if v == 0
    then 0
    else min(floor((v - 1) / S), N - 1)
```

Therefore:

```text
ownerChunk(vertex) = ChunkCoord(
  ownerAxis(vertex.x),
  ownerAxis(vertex.z)
)
```

This yields:

```text
interior vertex       -> containing Chunk
X seam vertex         -> west Chunk
Z seam vertex         -> south Chunk
X+Z seam intersection -> south-west Chunk
outer west/south edge -> first Chunk
outer east/north edge -> last existing Chunk
```

No alternate seam-owner calculation is permitted in Terrain or another system.

## 6. Required seam/boundary verification matrix

At minimum these production vectors are normative tests:

| VertexCoord | Owner Chunk | Reason |
| --- | --- | --- |
| `(0,0)` | `(0,0)` | south-west outer corner |
| `(1,1)` | `(0,0)` | interior |
| `(31,31)` | `(0,0)` | interior before seam |
| `(32,1)` | `(0,0)` | X seam, west wins |
| `(33,1)` | `(1,0)` | first interior vertex east of seam |
| `(1,32)` | `(0,0)` | Z seam, south wins |
| `(32,32)` | `(0,0)` | seam intersection, south-west wins |
| `(64,32)` | `(1,0)` | second X seam + first Z seam |
| `(32,64)` | `(0,1)` | first X seam + second Z seam |
| `(512,0)` | `(15,0)` | east outer boundary |
| `(0,512)` | `(0,15)` | north outer boundary |
| `(32,512)` | `(0,15)` | north boundary + X seam |
| `(512,32)` | `(15,0)` | east boundary + Z seam |
| `(512,512)` | `(15,15)` | north-east outer corner |

Tests must also cover every internal seam index `k*32`, `k = 1..15`, not only the examples above.

## 7. Vertex incident Cells

A valid Vertex may touch 1, 2, or 4 Cells.

Candidate incident Cells are:

```text
(x-1,z-1)
(x,  z-1)
(x-1,z)
(x,  z)
```

Only valid Cells are returned.

Canonical order is row-major by `(z,x)` ascending after invalid candidates are removed.

Examples:

```text
Vertex (0,0)       -> Cell (0,0)
Vertex (512,512)   -> Cell (511,511)
interior Vertex    -> 4 incident Cells
non-corner boundary -> 2 incident Cells
```

## 8. Vertex touching logical Chunks

`touchingChunks(vertex)` is derived from the owner Chunks of the valid incident Cells and returned de-duplicated in canonical `(z,x)` ascending order.

It may contain 1, 2, or 4 Chunks.

`ownerChunk(vertex)` must always be a member of `touchingChunks(vertex)`.

## 9. Cell neighbors

Cardinal neighbor order is normative:

```text
North, East, South, West
```

Out-of-bounds neighbors are omitted; remaining entries preserve this relative order.

Diagonal neighbors are not part of the cardinal-neighbor contract.

## 10. Cell rectangles and intersecting Chunks

A `CellRect` uses half-open coordinates:

```text
xStartInclusive
zStartInclusive
xEndExclusive
zEndExclusive
```

A valid non-empty rectangle must stay within `[0,512] × [0,512]` cell-edge coordinates.

Intersecting logical Chunks are returned in canonical `(z,x)` ascending order with no duplicates.

## 11. Canonical ordering

Whenever a World topology query returns a set/list whose semantic meaning is unordered, public serialization/query output uses deterministic order:

```text
primary: z ascending
secondary: x ascending
```

RegionId ordering is separately defined by MapDefinition canonical Region order.

Consumers must not rely on JavaScript object/Map insertion order as semantic ordering.

## 12. Integer semantics

All logical coordinates are integers. Fractional logical Cell/Vertex/Chunk coordinates are invalid.

Grid formulas use integer arithmetic. Three.js floating-point coordinates enter World only through explicit world-position conversion at the presentation/application boundary.

## 13. Ownership of formulas

These formulas belong to World. Terrain and future systems may consume the public World spatial read surface but must not copy independent seam/chunk/incidence formulas into their domain as competing authority.

Performance caches are permitted only when observationally equivalent to this contract.

## 14. Testing requirements

Required focused tests include:

```text
all coordinate bounds
all 15 internal X seams
all 15 internal Z seams
all seam intersections
all four outer edges
all four outer corners
cell-to-chunk transition boundaries
local Cell mapping
incident Cell counts/order
vertex touching Chunk counts/order
cardinal neighbor boundaries/order
CellRect chunk intersection
world position half-open boundary behavior
```

Property-style exhaustive tests over the 513×513 Vertex domain are encouraged because the domain is small enough for deterministic verification.

## 15. Binding invariants

```text
GridTopology is the only spatial formula authority.
The south-west Vertex owner formula is normative.
Invalid public coordinates never silently clamp.
A shared Terrain Vertex has exactly one owner Chunk.
Touching/incident sets are deterministic and de-duplicated.
World-position Cell mapping is half-open on north/east edges.
Logical coordinate semantics do not depend on Three.js transforms or camera state.
```
