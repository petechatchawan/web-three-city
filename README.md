# Web Three City

A mobile-first, browser-native 3D city-building game inspired by the accessibility of TheoTown and implemented as an original TypeScript + Three.js architecture.

## Current phase

The project is in architecture and specification. Production implementation has not started.

The first milestone is **Web Terrain Foundation v0.1**:

- `128 × 128` world grid
- shared corner-height lattice
- quantized height levels `0–4`
- deterministic one-sided Coastal preset
- chunked Three.js terrain presentation
- seam-safe canonical normals
- orthographic isometric camera and terrain picking
- Shape Atlas, seam, skirt, and picking fixtures

Water, terraforming, roads, zoning, buildings, and city simulation are intentionally deferred to later milestones.

## Specification

See [Web Terrain Foundation v0.1 Design](docs/superpowers/specs/2026-07-27-web-terrain-foundation-v0-1-design.md).

## Design principles

- World data is authoritative; rendering is derived presentation.
- Core terrain logic is independent of Three.js and browser APIs.
- WebGL2 is the baseline; WebGPU is a later enhancement.
- Mobile interaction and constrained devices are first-class targets.
- The implementation does not copy source code or assets from `lo-th/3d.city` or Micropolis-derived projects.
