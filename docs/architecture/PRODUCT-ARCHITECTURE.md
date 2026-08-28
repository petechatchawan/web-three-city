# Product Architecture

- **Status:** FROZEN
- **Date:** 2026-08-28
- **Scope:** Repository-wide product architecture
- **Authority:** Constitutional architecture document

## Product identity

`web-three-city` is a web-based 3D city builder with these architectural characteristics:

- simulation-first;
- mobile-first interaction and presentation;
- single-player;
- offline-capable direction;
- deterministic gameplay by default;
- Three.js as the primary 3D presentation technology.

The product is best understood as:

```text
Deterministic City Simulation
        +
Interactive 3D Presentation
```

Three.js is therefore a presentation technology, not canonical gameplay state.

## Architectural principles

### P01 — One concept, one canonical authority

Each gameplay concept has exactly one owning authority. Competing mutable truths for the same concept are forbidden.

### P02 — Canonical state, derived state, and presentation are distinct

```text
Canonical Authority
        ↓
Derived Domain State
        ↓
Application / Query Projection
        ↓
Presentation Projection
```

Derived or rendered state MUST NOT silently mutate canonical authority.

### P03 — Mutation is explicit

Gameplay mutation occurs through explicit application boundaries. UI, renderer, event subscribers, and arbitrary helpers do not directly mutate canonical state.

### P04 — Dependencies point toward more stable layers

Canonical repository direction:

```text
apps/*
  ↓
orchestration/*
  ↓
systems/*
  ↓
foundation/*
```

This is a dependency rule, not a claim that every runtime call follows this exact stack.

### P05 — Cross-system behavior is explicit

Queries, commands, integration events, and multi-authority orchestration have distinct semantics defined by ADR-001.

### P06 — Simulation time and presentation time are separate

Browser frame cadence, wall-clock time, and canonical simulation advancement are different concepts. Detailed runtime semantics are governed by ADR-002.

### P07 — Determinism is a runtime invariant

Given the same canonical starting state, deterministic inputs, seed state, scheduler registry, and simulation advancement, canonical results must be reproducible independently of FPS or machine speed.

### P08 — Systems are independently understandable and testable

An owning system should be understandable through its public contracts and system documentation without requiring readers to inspect unrelated system internals.

Core gameplay must be testable without DOM, WebGL, or browser startup unless the browser itself is the behavior under test.

### P09 — Persistence stores authority, not reconstructed presentation

Persistence targets canonical state and explicit versioned metadata. Render meshes, transient presentation caches, and other reconstructable state are not persistence authority.

Detailed persistence and transaction semantics are governed by ADR-003.

### P10 — Public contracts are deliberate

A file is not public because it exists in a folder named `contracts`. Public authority is established by declared package exports.

Cross-system public contracts must be intentionally exported, minimal, immutable where practical, and free of internal implementation types.

### P11 — Browser tests are not the default test layer

Domain and application logic use fast local tests first. Browser verification is reserved for browser-dependent behavior, critical journeys, and visual authority.

### P12 — Performance optimization cannot redefine authority

Data-oriented storage, ECS-like processing, caching, instancing, pooling, and spatial indexing may change implementation strategy but must not silently introduce a second canonical truth.

### P13 — No legacy inheritance

Previous implementation, specifications, tests, package topology, persistence formats, verification tooling, and gameplay decisions are outside the active architecture boundary.

The current product is designed from current requirements and current architecture documents only.

Historical commits may remain in Git for repository continuity, but they are archival only and MUST NOT be inspected, copied, migrated, or used as design input unless the owner explicitly requests a historical investigation.

No current system design requires a legacy audit.

## Architectural layers

### `foundation/*`

Contains generic primitives and infrastructure contracts with no gameplay ownership.

Foundation MUST NOT depend on gameplay systems, orchestration, or applications.

Gameplay-specific concepts do not belong in foundation merely because they are shared.

### `systems/*`

Each top-level system package represents a bounded gameplay authority or bounded gameplay capability.

Examples may eventually include World, Terrain, Roads, Zoning, Buildings, Households, Economy, Mobility, and Traffic, but packages are created only when their system design is approved.

### `orchestration/*`

Contains explicit application policy that coordinates multiple mutation authorities or another genuine cross-system concern.

It is a namespace of concerns, not one mandatory monolithic package.

### `apps/*`

Applications own composition, bootstrap, UI shell, browser integration, and product wiring. They do not become the home of canonical gameplay rules or hidden multi-system business policy.

## System ownership contract

Every gameplay system specification must identify, where applicable:

```text
Purpose
Canonical Authority
Derived State
Commands
Queries
Integration Events
Persistence Ownership
External Dependencies
Presentation Projection
Testing Boundary
```

A system that cannot identify its authority boundary clearly is not ready for implementation.

## Terminology glossary

### System

In this repository, **system** means a bounded gameplay authority/capability package under `systems/*`.

This is not the same as the ECS term “system”. If ADR-004 permits ECS-oriented internals, documentation and code should prefer **ECS processor** or another unambiguous term for frame/tick processors where practical.

### Contract

A contract is an externally observable type or protocol eligible for deliberate package export, such as query DTOs, commands, integration-event types, result types, or rejection types.

Being located under `contracts/` does not itself make a type public.

### Port

This repository uses **port** to mean a dependency-inversion interface required by a system implementation, typically an outbound dependency from its application/domain boundary.

This differs from some classical Hexagonal Architecture literature where “port” may also describe a public inbound interface.

Repository rule:

```text
ports/* = internal by default
contracts/* = eligible for public export
package.json exports = actual public authority
```

Public root or command contracts MUST NOT reference internal `ports/*` types.

A selected construction-only dependency interface may be exposed through a `./composition` surface when necessary to wire dependency inversion; such a type remains a composition contract and MUST NOT leak into the read or command surfaces.

### Adapter

An adapter connects a port or public contract to a concrete technology/provider. Adapters do not acquire gameplay authority merely because they can read or translate state.

## Public contract evolution

A complete long-lived Public Contract Evolution Policy is a known gap and is not yet frozen.

Until external compatibility requirements exist, a breaking internal-monorepo contract change must update the owner and all affected consumers atomically in the same change and update contract verification.

Persistence/replay compatibility is separately governed by ADR-003.

If external packages, plugins/mods, network protocols, or independently versioned consumers become real requirements, a dedicated contract-evolution ADR is required.

## Testing philosophy

Default verification layering:

```text
Focused unit/domain/application
        ↓
Owning system verification
        ↓
Affected consumer verification
        ↓
Repository/tooling verification when triggered
        ↓
Targeted browser verification when browser-observable
        ↓
Critical journey / visual / full-browser release evidence when required
```

Selective Verification is designed from the current package topology and current requirements only. No pre-reset verification implementation is an input or authority.

## Documentation authority

Repository-wide architecture lives under:

```text
docs/architecture/
```

System-specific binding material lives under:

```text
docs/systems/<system>/
```

Repository ADRs refine specific architectural questions and MUST NOT contradict this Product Architecture without explicitly superseding the conflicting principle through an approved architecture change.

## Final invariants

```text
One concept -> one canonical authority.
Canonical != derived != presentation.
Three.js is presentation, not gameplay truth.
Mutation is explicit.
Cross-system behavior is explicit.
Simulation != render frame.
Determinism is a product invariant.
Public API is deliberate package export.
Systems are testable without booting the whole game.
Persistence stores canonical authority.
Optimization never creates a second truth.
No legacy inheritance.
Historical commits are archival unless the owner explicitly requests investigation.
```