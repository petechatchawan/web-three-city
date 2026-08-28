# Terrain Generation Contract

- **Status:** REVIEW DRAFT — NOT FROZEN
- **Date:** 2026-08-29
- **Owner:** `systems/terrain`
- **Depends on:** Terrain Authority Contract, Terrain Surface Contract, Map and Region Contract

## 1. Profile identity

```text
generationProfileId      = balanced-temperate-generation
generationProfileVersion = 2
```

The algorithm below is the exact Phase 1 web generation contract. It is a current TypeScript/Three.js product design, not a requirement to reproduce Unity implementation bytes.

## 2. Inputs

Generation consumes exactly:

```text
validated MapDefinition
balanced-temperate-generation / 2
explicit caller-selected accepted Seed64
```

No other ambient state is input.

Forbidden inputs:

```text
Math.random()
wall-clock time
camera/render state
GPU result
Promise completion order
thread ordering
browser/device identity
```

## 3. Seed64 representation

External/config Seed64 is a fixed-width unsigned hexadecimal string:

```text
0x + exactly 16 hexadecimal digits
```

Internal seed arithmetic uses unsigned 64-bit modulo `2^64` semantics. JavaScript implementation uses `bigint` for this contract, never lossy Number conversion of the full Seed64.

## 4. Layer seed derivation — SplitMix64

Starting state is the selected Seed64.

For each of five noise layers, in order, execute:

```text
state = (state + 0x9E3779B97F4A7C15) mod 2^64
z = state
z = (z xor (z >> 30)) * 0xBF58476D1CE4E5B9 mod 2^64
z = (z xor (z >> 27)) * 0x94D049BB133111EB mod 2^64
z = z xor (z >> 31)
layerSeed32 = low 32 bits of z
```

For accepted seed `0x5EED5EED5EED5EED`, normative layer seeds are:

```text
L0 0xB6E4D3F7
L1 0x598B0C68
L2 0x2B21BFCF
L3 0x8EACDFE9
L4 0x9EF86EE7
```

## 5. Deterministic 32-bit lattice hash

All operations below use JavaScript unsigned-32 behavior after each step; multiplication uses `Math.imul` low-32-bit semantics.

```text
hash32(seed, gx, gz):
  h = u32(seed xor u32(imul(gx, 0x9E3779B1)) xor u32(imul(gz, 0x85EBCA77)))
  h = u32(h xor (h >>> 16))
  h = u32(imul(h, 0x7FEB352D))
  h = u32(h xor (h >>> 15))
  h = u32(imul(h, 0x846CA68B))
  h = u32(h xor (h >>> 16))
  return h
```

Lattice value is signed Q15-like integer:

```text
value = ((hash32 >>> 16) & 0xFFFF) - 32768
```

Range:

```text
[-32768, 32767]
```

## 6. Q16 fade and interpolation

Let `Q = 65536`.

For `t` in `[0,Q]`, cubic smoothstep is evaluated with exact integer floor for non-negative intermediates:

```text
t2 = floor(t*t / Q)
fadeQ16(t) = floor(t2 * (3*Q - 2*t) / Q)
```

Integer interpolation is:

```text
lerpInt(a,b,t) = a + truncTowardZero((b-a)*t / Q)
```

The truncation rule is normative for negative deltas.

## 7. One value-noise layer

For a Vertex coordinate `(x,z)` and layer period `P` in Cell/Vertex lattice units:

```text
gx = floor(x / P)
gz = floor(z / P)
rx = x mod P
rz = z mod P

tx = floor(rx * Q / P)
tz = floor(rz * Q / P)
fx = fadeQ16(tx)
fz = fadeQ16(tz)
```

Hash four coarse lattice corners:

```text
SW = value(gx,   gz)
SE = value(gx+1, gz)
NW = value(gx,   gz+1)
NE = value(gx+1, gz+1)
```

Then:

```text
south = lerpInt(SW, SE, fx)
north = lerpInt(NW, NE, fx)
noise = lerpInt(south, north, fz)
```

No floating-point interpolation is used for canonical generation.

## 8. Production octave table

| Layer | Period | Amplitude (LogicalElevation units) |
| ----: | -----: | ---------------------------------: |
|     0 |    128 |                                 64 |
|     1 |     64 |                                 32 |
|     2 |     32 |                                 16 |
|     3 |     16 |                                  8 |
|     4 |      8 |                                  4 |

Base elevation:

```text
BASE_ELEVATION = 160
```

Final generated elevation:

```text
weighted = Σ(noiseLayer[i] * amplitude[i])
delta = truncTowardZero(weighted / 32768)
elevation = BASE_ELEVATION + delta
```

No post-generation smoothing/clamping is permitted in profile version 2. Generation fails invariant verification if output falls outside the profile envelope `[32,288]`, although the defined algorithm is expected to remain within that envelope.

## 9. Canonical generation order

The immutable `ProductionTerrainField` is evaluated conceptually in global Vertex order:

```text
for z = 0..512
  for x = 0..512
```

An optimized implementation may compute in another physical order only if final canonical values are bit-identical and fingerprinted in the canonical order.

Generation output is immutable. Terrain materialization consumes this exact prepared field; it does not regenerate using hidden inputs.

## 10. Production output verification vectors

For seed `0x5EED5EED5EED5EED`, expected elevations include:

| VertexCoord | LogicalElevation |
| ----------- | ---------------: |
| `(0,0)`     |               91 |
| `(256,256)` |              213 |
| `(512,512)` |              222 |
| `(153,191)` |              164 |
| `(358,191)` |              177 |
| `(153,319)` |              154 |
| `(358,319)` |              134 |

These vectors are supplemental. The full-field fingerprint is the release authority for generator output.

## 11. Terrain output fingerprint

Fingerprint algorithm is 64-bit FNV-1a modulo `2^64`.

```text
OFFSET = 14695981039346656037
PRIME  = 1099511628211
```

Byte stream is exactly:

```text
u32 little-endian vertexWidth  = 513
u32 little-endian vertexHeight = 513
then for z=0..512, x=0..512:
  signed LogicalElevation encoded as two's-complement int32 little-endian
```

The fingerprint intentionally excludes seed/profile/config bytes; it fingerprints canonical Terrain output, not configuration identity.

For the production acceptance vector:

```text
MapDefinition: production-v1 / 1
Generator:     balanced-temperate-generation / 2
Seed:          0x5EED5EED5EED5EED
Fingerprint:   0xF2FA29BFD2AEB069
```

The Unity reference fingerprint is not used as a compatibility target.

## 12. Starting-candidate suitability formula

Terrain evaluates each World-defined starting candidate after full field generation and before `MapState` construction.

For candidate anchor Cell `(ax,az)`, evaluation patch is exactly a 9×9 Cell square with radius 4:

```text
cells x = ax-4 .. ax+4
cells z = az-4 .. az+4
```

MapDefinition validation already guarantees this entire patch belongs to the candidate Region and remains in bounds.

A candidate is eligible iff all conditions hold:

```text
A. all required Terrain vertices are available
B. every Cell in the 9×9 patch has corner elevation range <= 8 units (2m)
C. all 10×10 patch vertices have total elevation range <= 24 units (6m)
D. the anchor Cell corner elevation range <= 4 units (1m)
```

Cell corner range means `max(NW,NE,SW,SE)-min(...)`.

No Three.js, rendered normal, water, road, building, economy, or UI fact participates in Phase 1 suitability.

## 13. Candidate evaluation output

Evaluation returns immutable deterministic facts per candidate:

```text
RegionId
eligible
patchElevationRange
maxCellCornerRange
anchorCellCornerRange
reasons[]
```

Reason order is fixed:

```text
TERRAIN_START_UNAVAILABLE
TERRAIN_START_CELL_RELIEF_EXCEEDED
TERRAIN_START_PATCH_RELIEF_EXCEEDED
TERRAIN_START_ANCHOR_RELIEF_EXCEEDED
```

Only failed reasons are included, preserving this order.

## 14. Production candidate acceptance vector

For the accepted production seed, all four production candidates are eligible:

| Region | patch range | max Cell range | anchor range | Eligible |
| ------ | ----------: | -------------: | -----------: | -------- |
| `R06`  |           8 |              2 |            1 | yes      |
| `R08`  |          11 |              3 |            2 | yes      |
| `R11`  |           6 |              2 |            1 | yes      |
| `R13`  |          20 |              4 |            2 | yes      |

The accepted seed catalog entry is valid only while this eligibility vector and full-field fingerprint match the frozen profile contract.

## 15. No seed mining

Required production behavior:

```text
caller selects accepted seed
-> generate once
-> fingerprint once
-> evaluate candidates once
-> success or explicit failure
```

Forbidden:

```text
retry another seed
mutate selected seed silently
search until all candidates pass
adjust Terrain after suitability evaluation
```

## 16. Failure semantics

Expected generation/preparation failures include:

```text
TERRAIN_GENERATION_PROFILE_UNSUPPORTED
TERRAIN_GENERATION_SEED_INVALID
TERRAIN_GENERATION_SEED_NOT_ACCEPTED
TERRAIN_GENERATION_OUTPUT_OUT_OF_RANGE
TERRAIN_GENERATION_FINGERPRINT_MISMATCH
TERRAIN_GENERATION_NO_ELIGIBLE_START
```

Production preparation rejects on fingerprint mismatch; it never accepts a silently changed algorithm under the same profile version.

## 17. Tests

Required tests:

```text
SplitMix64 vectors
five derived layer seeds
hash32 vectors
fade/lerp signed truncation vectors
noise corner/edge values
sample production elevations
full 513×513 fingerprint
repeat generation equality
independence from Math.random/browser/render order
all four candidate metrics/eligibility
explicit seed rejection
no fallback seed behavior
```

## 18. Binding invariants

```text
Profile version 2 is an exact integer algorithm.
Seed64 stays exact 64-bit.
Canonical generation uses no floating-point decisions.
One selected seed generates exactly once.
Output fingerprint is 0xF2FA29BFD2AEB069 for the production vector.
All four current starting candidates are eligible for the accepted seed.
Suitability is pure Terrain/World data logic with no presentation dependency.
Changing algorithm/output under the same profile version is forbidden.
```
