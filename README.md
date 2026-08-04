# Web Three City

A mobile-first, browser-native 3D city-building game inspired by the accessibility of TheoTown and implemented as an original TypeScript + Three.js architecture.

## Current phase

The project is implementing its playable world foundations. The following systems are established on `master`:

- `128 × 128` deterministic terrain and water
- orthographic isometric camera, picking, and mobile interaction
- Raise, Lower, and Flatten terraforming with preview and Undo
- deterministic Road placement, connectivity, bulldoze, Save/Load, and rendering
- Residential, Commercial, and Industrial zoning with paint, remove, Road access, occupancy guards, Save/Load, and Undo

The current milestone is **Building Content & Occupancy Foundation v0.1**:

- data-driven Building Definitions and authoritative Building Instances
- canonical rectangular footprints with quarter-turn rotation
- deterministic lot allocation, content selection, orientation, and Road frontage
- explicit Zone development and Building bulldoze while preserving the underlying Zone
- derived Building occupancy shared by Road, Zone, and Terraform guards
- WorldSaveV3 migration and Building Undo
- cube-composed low-poly Residential, Commercial, and Industrial prototypes

Economy, demand, population, jobs, utilities, services, traffic, upgrades, abandonment, and final artwork remain outside this milestone.

## Specifications

- [Web Terrain Foundation v0.1](docs/superpowers/specs/2026-07-27-web-terrain-foundation-v0-1-design.md)
- [Building Content & Occupancy Foundation v0.1](docs/superpowers/specs/2026-08-03-building-content-occupancy-foundation-v0-1-design.md)

## Design principles

- World data is authoritative; rendering is derived presentation.
- Core simulation and mutation logic is independent of Three.js and browser APIs.
- Cross-domain changes are immutable, deterministic, atomic, and revision-fenced.
- WebGL2 is the baseline; WebGPU is a later enhancement.
- Mobile interaction and constrained devices are first-class targets.
- The implementation does not copy source code or assets from `lo-th/3d.city` or Micropolis-derived projects.

## License

The source code in this repository is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Pete Chatchawan.
