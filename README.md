# Web Three City

A mobile-first, browser-native 3D city-building game inspired by the accessibility of TheoTown and implemented as an original TypeScript + Three.js architecture.

## Current state

The playable world foundations on `master` include:

- deterministic `128 × 128` Terrain and derived Water;
- orthographic isometric camera, picking, and mobile interaction;
- Raise, Lower, and Flatten terraforming with preview and Undo;
- deterministic Road placement, connectivity, bulldoze, Save/Load, and rendering;
- Residential, Commercial, and Industrial zoning with Road access, occupancy guards, Save/Load, and Undo;
- data-driven Residential, Commercial, and Industrial Buildings;
- deterministic lot allocation, Road frontage, construction lifecycle, automatic growth, bulldoze, and Save/Load;
- deterministic game time with Pause, `1×`, `2×`, `4×`, and single-tick Step.

The active planning milestone is **RCI Demand & Occupancy Foundation v0.1**. Its approved design introduces Citizen records, relationships, Households, Dwelling Units, Workplaces, Employment, Migration, R/C/I Demand, and demand-controlled Building growth. Production implementation has not started.

## System documentation

Start with the [System Documentation Registry](docs/systems/README.md) for concise current-state handoffs, ownership, integrations, persistence, limitations, and links to each system's Specs, ADRs, TDD plans, and verification.

Key entries:

- [Terrain](docs/systems/terrain/README.md)
- [Roads](docs/systems/roads/README.md)
- [Zoning](docs/systems/zoning/README.md)
- [Buildings](docs/systems/buildings/README.md)
- [Simulation Time](docs/systems/simulation-time/README.md)
- [RCI Demand & Occupancy](docs/systems/rci/README.md)
- [Economy boundary](docs/systems/economy/README.md)

Older workflow documents under `docs/superpowers/` remain readable during phased migration. New system artifacts use the system-centric structure.

## Design principles

- World data is authoritative; rendering is derived presentation.
- Core simulation and mutation logic is independent of Three.js and browser APIs.
- Cross-domain changes are immutable, deterministic, atomic, and revision-fenced.
- Facts have one canonical authority; derived projections are reproducible.
- System behavior and living documentation change in the same PR.
- WebGL2 is the baseline; WebGPU is a later enhancement.
- Mobile interaction and constrained devices are first-class targets.
- The implementation does not copy source code or assets from `lo-th/3d.city` or Micropolis-derived projects.

## Development

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm test:browser
```

See [Development Workflow](docs/development-workflow.md) for repository checks and contribution flow.

## License

The source code in this repository is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Pete Chatchawan.
