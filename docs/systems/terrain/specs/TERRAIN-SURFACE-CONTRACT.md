# Terrain Surface Contract

- **Status:** REVIEW DRAFT — NOT FROZEN
- **Date:** 2026-08-29
- **Owner:** `systems/terrain`
- **Depends on:** Terrain Authority Contract, World Spatial Contract

## 1. Surface authority

The continuous Phase 1 ground surface is uniquely defined by:

```text
canonical Vertex LogicalElevations
+
fixed NW→SE triangulation for every Cell
```

No bilinear surface, mesh interpolation, GPU normal, or raycast result is an independent geometric truth.

## 2. Cell corner convention

For Cell `(x,z)`:

```text
NW = Vertex(x,   z+1)
NE = Vertex(x+1, z+1)
SW = Vertex(x,   z)
SE = Vertex(x+1, z)
```

Local sub-cell coordinates:

```text
u = west -> east
v = south -> north
Q = 65536
0 <= u <= Q
0 <= v <= Q
```

## 3. Fixed triangulation

Every Cell uses the NW→SE diagonal.

Triangle IDs are stable semantic values:

```text
SW_TRIANGLE = [SW, SE, NW]
NE_TRIANGLE = [NW, SE, NE]
```

The diagonal never changes based on heights, normals, camera, rendering optimization, or neighboring Cells.

## 4. Normative diagonal tie rule

The diagonal equation in Q16 coordinates is:

```text
u + v = Q
```

Triangle selection is normative:

```text
if u + v <= Q
  -> SW_TRIANGLE
else
  -> NE_TRIANGLE
```

Therefore a point exactly on the NW→SE diagonal belongs to `SW_TRIANGLE` for semantic triangle identity.

Both triangle height equations are required to produce the same height on the shared diagonal; the tie affects triangle identity/derived slope facts, not positional continuity.

## 5. Exact sub-cell height

Height query returns `LogicalElevationQ16`, where one canonical LogicalElevation unit equals `65536` Q16 height units.

### SW_TRIANGLE

Barycentric weights in Q16 denominator `Q`:

```text
wSW = Q - u - v
wSE = u
wNW = v
```

Exact height numerator/result in LogicalElevationQ16:

```text
heightQ16 = SW*wSW + SE*wSE + NW*wNW
```

because the weights already sum to `Q`.

### NE_TRIANGLE

```text
wNW = Q - u
wSE = Q - v
wNE = u + v - Q

heightQ16 = NW*wNW + SE*wSE + NE*wNE
```

All operations use exact integer arithmetic for the Phase 1 elevation/coordinate bounds.

## 6. Boundary semantics

Sub-cell coordinates `u=0/Q` and `v=0/Q` are valid. Adjacent Cells querying the same shared edge must return identical height values from the shared canonical endpoint elevations.

A public world-position query first resolves the containing Cell using World half-open Cell semantics. The outer east/north map boundary has no containing Cell; explicit Vertex queries remain valid there.

## 7. Cell surface description

A Terrain Cell surface read may expose immutable facts:

```text
CellCoord
four corner LogicalElevations
fixed diagonal identity
SW triangle descriptor
NE triangle descriptor
TerrainRevision used for the read
```

It must not expose mutable internal entities or Three.js geometry.

## 8. Exact slope facts

For `SW_TRIANGLE`, exact elevation rises across one full Cell width are:

```text
riseX = SE - SW
riseZ = NW - SW
```

For `NE_TRIANGLE`:

```text
riseX = NE - NW
riseZ = NE - SE
```

Horizontal Cell width is exactly:

```text
8m = 32 LogicalElevation-length units
```

A slope query therefore exposes an exact rational-grade representation such as:

```text
riseXUnits
riseZUnits
runUnits = 32
```

Consumers compare grade thresholds using integer cross-multiplication/squared quantities where practical rather than converting to floating-point degrees as gameplay authority.

## 9. Triangle plane continuity

Within a triangle the surface is planar. Across the fixed internal diagonal, height is continuous but slope may change. Across Cell edges, height is continuous because both Cells share canonical edge vertices; slope may change at the edge.

This piecewise-planar topology is intentional gameplay geometry.

## 10. Surface query outcomes

Surface queries distinguish:

```text
success
out-of-bounds
unavailable because required owner Chunk is not loaded
```

A query requiring four Cell corner vertices is unavailable if any required canonical vertex authority is unavailable.

No fallback interpolation from a subset of corners is permitted.

## 11. Presentation conversion

Three.js geometry converts:

```text
X/Z = World meters
Y   = heightQ16 / 65536 * 0.25m
```

Presentation may use floating-point positions after the exact semantic surface has been determined.

## 12. Normal semantics

Gameplay does not use rendered vertex normals as slope authority.

Presentation normals may be smooth-shaded derived data. For a shared render-sector boundary vertex, normal construction must use the same global incident-triangle neighborhood so duplicate GPU boundary vertices receive equivalent normals.

## 13. Normative test vectors

Required tests include at least:

```text
u=0,v=0       -> SW corner / SW_TRIANGLE
u=Q,v=0       -> SE corner / SW_TRIANGLE (diagonal endpoint)
u=0,v=Q       -> NW corner / SW_TRIANGLE (diagonal endpoint)
u=Q,v=Q       -> NE corner / NE_TRIANGLE
u=Q/2,v=Q/2   -> diagonal / SW_TRIANGLE
u+v=Q-1       -> SW_TRIANGLE
u+v=Q         -> SW_TRIANGLE
u+v=Q+1       -> NE_TRIANGLE
```

For arbitrary corner elevations, tests must prove both formulas agree for multiple exact diagonal points.

Cross-Cell tests must prove shared-edge height equality.

## 14. Forbidden alternatives

```text
height-dependent diagonal flipping
bilinear runtime height query as a second truth
Three.js Raycaster interpolated Y as gameplay answer
float epsilon deciding semantic triangle
normal vector deciding buildability/slope policy
sector-local seam normals that visibly disagree
```

## 15. Binding invariants

```text
NW→SE triangulation is global and immutable.
Diagonal ties belong to SW_TRIANGLE.
Q16 triangle selection uses exact integer u+v comparison.
Sub-cell height is triangle barycentric height, not bilinear interpolation.
Gameplay slope facts derive from the same triangle plane.
Mesh/raycast/normals cannot redefine the surface.
```
