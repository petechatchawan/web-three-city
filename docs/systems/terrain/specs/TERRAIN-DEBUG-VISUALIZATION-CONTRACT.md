# Terrain Debug Visualization Contract

- **Status:** FROZEN — OWNER APPROVED 2026-08-30
- **Owner:** `systems/terrain`

## Purpose

Provide optional visual diagnostics for Terrain geometry/authority without changing production Terrain semantics.

## Layers

```text
cellGrid       gameplay Cell boundaries conforming to Terrain
renderSectors  render-sector boundaries
vertices       canonical Terrain Vertex positions
triangles      fixed semantic triangle topology
normals        sampled global presentation normals
elevation      colorized Terrain elevation surface
```

All layers default to hidden.

## Public presentation capability

`TerrainThreeDebugOverlay` is exposed from `@web-three-city/terrain/composition` and owns one Three.js root Group.

```ts
readonly root
setVisibility(partialOrFullState)
rebuild(changeSet)
dispose()
```

Visibility state is presentation-only and is not part of Terrain snapshot.

## Locality

Geometry/resources are organized by the existing render-sector topology. Mutation rebuild uses the existing `DirtySectorResolver` and only rebuilds enabled dirty sector resources. Unaffected object identity remains stable.

## Height authority

Every diagnostic point/line/surface derives Y from canonical Terrain reads/snapshot data. A flat constant-Y gameplay grid is forbidden.

## Configuration

One `TERRAIN_DEBUG_DEFAULT_CONFIG` owns:

```text
surface offset used only to prevent z fighting
normal sample stride
normal vector display length
point display size
line opacity/width-compatible parameters
```

Map/world values are derived from MapDefinition; RenderSector size comes from its existing owner.

## Disposal

Every created BufferGeometry/Material is explicitly disposed by the overlay owner. Rebuild disposes replaced resources only; `dispose()` is idempotent.

## Tests

```text
all layers hidden by default
cell-grid spacing derives from MapDefinition
seam endpoint equality
dirty-sector locality for enabled layers
normal sampling stride behavior
triangle topology reuse
elevation coloring deterministic
old geometry disposal and unaffected identity preservation
dispose all resources exactly once
```
